/**
 * Read-only agent API for Gity.
 *
 * This is intentionally a small MCP-style JSON-RPC surface that can be used
 * by an agent runner without exposing browser credentials. It authenticates
 * with a server-side bearer token and a GitHub App installation token.
 */

interface Env {
  GITY_AGENT_TOKEN?: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_INSTALLATION_ID?: string;
  GITY_AGENT_ORIGIN?: string;
}

const GITHUB_API = "https://api.github.com";
const MAX_PAGE_SIZE = 100;
const MAX_REQUEST_BYTES = 32_768;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type Tool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
    additionalProperties: false;
  };
};

const TOOLS: Tool[] = [
  {
    name: "get_viewer",
    description: "Get the GitHub App installation account identity.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_repositories",
    description: "List repositories visible to the GitHub App installation.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "1-based page number, maximum 10." },
        per_page: { type: "number", description: "Items per page, maximum 100." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_pull_requests",
    description: "List pull requests for one repository.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        state: { type: "string", description: "open, closed, or all." },
        page: { type: "number" },
        per_page: { type: "number" },
      },
      required: ["owner", "repo"],
      additionalProperties: false,
    },
  },
  {
    name: "search_issues",
    description: "Search GitHub issues and pull requests with a bounded query.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "GitHub issue search query." },
        page: { type: "number" },
        per_page: { type: "number" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_workflow_runs",
    description: "Get recent GitHub Actions workflow runs for one repository.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        page: { type: "number" },
        per_page: { type: "number" },
      },
      required: ["owner", "repo"],
      additionalProperties: false,
    },
  },
  {
    name: "get_recent_activity",
    description: "Get recent public activity for a GitHub user.",
    inputSchema: {
      type: "object",
      properties: { login: { type: "string" }, per_page: { type: "number" } },
      required: ["login"],
      additionalProperties: false,
    },
  },
];

function headers(origin: string | undefined): Headers {
  const result = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  });
  if (origin) {
    result.set("Access-Control-Allow-Origin", origin);
    result.set("Vary", "Origin");
  }
  return result;
}

function json(data: unknown, status = 200, env?: Env): Response {
  return new Response(JSON.stringify(data), { status, headers: headers(env?.GITY_AGENT_ORIGIN) });
}

function error(id: JsonRpcRequest["id"], code: number, message: string, env?: Env): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }),
    { status: 200, headers: headers(env?.GITY_AGENT_ORIGIN) },
  );
}

function base64url(value: ArrayBuffer | string): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToBytes(pem: string): { bytes: ArrayBuffer; format: "pkcs8" | "pkcs1" } {
  const format = pem.includes("BEGIN RSA PRIVATE KEY") ? "pkcs1" : "pkcs8";
  const value = pem.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----|-----END (?:RSA )?PRIVATE KEY-----|\s/g, "");
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes: bytes.buffer, format };
}

function derLength(length: number): Uint8Array {
  if (length < 128) return new Uint8Array([length]);
  const bytes: number[] = [];
  for (let value = length; value > 0; value >>>= 8) bytes.unshift(value & 0xff);
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function wrapPkcs1AsPkcs8(pkcs1: ArrayBuffer): ArrayBuffer {
  const algorithm = new Uint8Array([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const key = new Uint8Array(pkcs1);
  const octetLength = derLength(key.length);
  const octet = new Uint8Array(1 + octetLength.length + key.length);
  octet[0] = 0x04;
  octet.set(octetLength, 1);
  octet.set(key, 1 + octetLength.length);
  const body = new Uint8Array(version.length + algorithm.length + octet.length);
  body.set(version, 0);
  body.set(algorithm, version.length);
  body.set(octet, version.length + algorithm.length);
  const sequenceLength = derLength(body.length);
  const result = new Uint8Array(1 + sequenceLength.length + body.length);
  result[0] = 0x30;
  result.set(sequenceLength, 1);
  result.set(body, 1 + sequenceLength.length);
  return result.buffer;
}

async function createAppJwt(env: Env): Promise<string> {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) throw new Error("GitHub App credentials are not configured.");
  const privateKey = pemToBytes(env.GITHUB_APP_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKey.format === "pkcs1" ? wrapPkcs1AsPkcs8(privateKey.bytes) : privateKey.bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => base64url(JSON.stringify(value));
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID })}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(signature)}`;
}

async function createInstallationToken(env: Env): Promise<string> {
  if (!env.GITHUB_INSTALLATION_ID) throw new Error("GitHub App installation is not configured.");
  const jwt = await createAppJwt(env);
  const response = await fetch(`${GITHUB_API}/app/installations/${encodeURIComponent(env.GITHUB_INSTALLATION_ID)}/access_tokens`, {
    method: "POST",
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${jwt}`, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Gity-Agent" },
  });
  if (!response.ok) throw new Error(`GitHub App authentication failed (${response.status}).`);
  const body = (await response.json()) as { token?: string };
  if (!body.token) throw new Error("GitHub App returned no installation token.");
  return body.token;
}

function stringParam(params: Record<string, unknown>, name: string, max = 100): string {
  const value = params[name];
  if (typeof value !== "string" || value.length === 0 || value.length > max) throw new Error(`Invalid ${name}.`);
  return value;
}

function pageParams(params: Record<string, unknown>): { page: number; per_page: number } {
  const page = typeof params.page === "number" && Number.isInteger(params.page) ? params.page : 1;
  const perPage = typeof params.per_page === "number" && Number.isInteger(params.per_page) ? params.per_page : 30;
  if (page < 1 || page > 10 || perPage < 1 || perPage > MAX_PAGE_SIZE) throw new Error("Invalid pagination.");
  return { page, per_page: perPage };
}

async function github(token: string, path: string, query?: Record<string, string | number>): Promise<unknown> {
  const url = new URL(`${GITHUB_API}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Gity-Agent" } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`GitHub request failed (${response.status}).`);
  return body;
}

async function callTool(name: string, params: Record<string, unknown>, token: string): Promise<unknown> {
  if (name === "get_viewer") return github(token, "/user");
  if (name === "list_repositories") {
    const page = pageParams(params);
    return github(token, "/installation/repositories", page);
  }
  if (name === "list_pull_requests") {
    const owner = stringParam(params, "owner", 100);
    const repo = stringParam(params, "repo", 100);
    const page = pageParams(params);
    const state = params.state === undefined ? "open" : stringParam(params, "state", 10);
    if (!["open", "closed", "all"].includes(state)) throw new Error("Invalid state.");
    return github(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, { ...page, state });
  }
  if (name === "search_issues") {
    const query = stringParam(params, "query", 256);
    const page = pageParams(params);
    return github(token, "/search/issues", { ...page, q: query });
  }
  if (name === "get_workflow_runs") {
    const owner = stringParam(params, "owner", 100);
    const repo = stringParam(params, "repo", 100);
    const page = pageParams(params);
    return github(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs`, page);
  }
  if (name === "get_recent_activity") {
    const login = stringParam(params, "login", 100);
    const perPage = params.per_page === undefined ? 30 : params.per_page;
    if (typeof perPage !== "number" || !Number.isInteger(perPage) || perPage < 1 || perPage > 100) throw new Error("Invalid per_page.");
    return github(token, `/users/${encodeURIComponent(login)}/events`, { per_page: perPage });
  }
  throw new Error("Unknown tool.");
}

async function authorized(request: Request, env: Env): Promise<boolean> {
  const expected = env.GITY_AGENT_TOKEN;
  const received = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !received) return false;
  const [expectedDigest, receivedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(received)),
  ]);
  const left = new Uint8Array(expectedDigest);
  const right = new Uint8Array(receivedDigest);
  let different = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    different |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return different === 0;
}

export async function onRequest({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(env.GITY_AGENT_ORIGIN) });
  if (!(await authorized(request, env))) return json({ error: "unauthorized" }, 401, env);
  if (request.method === "GET") return json({ name: "gity", version: "1", tools: TOOLS }, 200, env);
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, env);

  let body: JsonRpcRequest;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) return error(null, -32600, "Request is too large.", env);
    body = JSON.parse(rawBody) as JsonRpcRequest;
  } catch {
    return error(null, -32700, "Invalid JSON.", env);
  }
  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") return error(body.id, -32600, "Invalid JSON-RPC request.", env);
  if (body.method === "initialize") return json({ jsonrpc: "2.0", id: body.id ?? null, result: { protocolVersion: "2025-06-18", serverInfo: { name: "gity", version: "1" }, capabilities: { tools: {} } } }, 200, env);
  if (body.method === "tools/list") return json({ jsonrpc: "2.0", id: body.id ?? null, result: { tools: TOOLS } }, 200, env);
  if (body.method !== "tools/call") return error(body.id, -32601, "Method not found.", env);

  const params = body.params ?? {};
  const name = params.name;
  const args = params.arguments;
  if (typeof name !== "string" || !TOOLS.some((tool) => tool.name === name) || (args !== undefined && (typeof args !== "object" || args === null || Array.isArray(args)))) return error(body.id, -32602, "Invalid tool arguments.", env);
  try {
    const token = await createInstallationToken(env);
    const result = await callTool(name, (args ?? {}) as Record<string, unknown>, token);
    return json({ jsonrpc: "2.0", id: body.id ?? null, result: { content: [{ type: "text", text: JSON.stringify(result) }] } }, 200, env);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Agent tool failed.";
    return error(body.id, -32000, message, env);
  }
}
