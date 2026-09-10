/**
 * Low-level GitHub transport.
 * - Browser → api.github.com by default, with a same-origin relay fallback
 *   when a local network blocker prevents direct access.
 * - PATs are passed in per call; server sessions use same-origin cookies.
 * - Maps failures to GithubApiError and records rate limits.
 */
import { recordGraphqlRateLimit, recordRestRateLimit } from "./rate-limit";
import { GithubApiError } from "./types";
import { parseLinkHeader, toGithubError } from "./pagination";
import { fetchWithGatewayFallback } from "./transport";

export const REST_BASE = "https://api.github.com";
export const GRAPHQL_URL = "https://api.github.com/graphql";

function authHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.message === "string") return body.message;
    if (Array.isArray(body?.errors)) {
      return body.errors
        .map((e: { message?: string }) => e.message)
        .filter(Boolean)
        .join("; ");
    }
  } catch {
    /* non-JSON body */
  }
  return "";
}

async function proxyFetch(url: string, init: RequestInit): Promise<Response> {
  return fetchWithTimeout(`/api/github?url=${encodeURIComponent(url)}`, init);
}

const GITHUB_REQUEST_TIMEOUT_MS = 15_000;

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GITHUB_REQUEST_TIMEOUT_MS);
  const callerSignal = init?.signal;
  const abortFromCaller = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", abortFromCaller, { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  });
}

function classifyRestError(res: Response, message: string): GithubApiError {
  const msg = message || `GitHub request failed (${res.status}).`;
  if (res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      const reset = Number(res.headers.get("x-ratelimit-reset") ?? "0") * 1000;
      return new GithubApiError("rate-limit", 403, "GitHub REST rate limit exhausted.", {
        resetAt: reset || undefined,
      });
    }
    if (/rate limit/i.test(message)) {
      return new GithubApiError("rate-limit", 403, message, {
        resetAt:
          Number(res.headers.get("x-ratelimit-reset") ?? "0") * 1000 || undefined,
      });
    }
    return new GithubApiError(
      "forbidden",
      403,
      `${msg} Check that the token has the required read permission.`,
    );
  }
  if (res.status === 429) {
    return new GithubApiError("rate-limit", 429, "GitHub rate limit hit (429).", {
      resetAt:
        Number(res.headers.get("x-ratelimit-reset") ?? "0") * 1000 || undefined,
    });
  }
  return toGithubError(res.status, msg);
}

/** Single REST request returning parsed JSON. */
export async function restFetch<T>(
  token: string | null,
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> },
): Promise<{ data: T; headers: Headers }> {
  const url = new URL(path.startsWith("http") ? path : `${REST_BASE}${path}`);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  let res: Response;
  const requestInit = {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  };
  try {
    res = token
      ? await fetchWithGatewayFallback(
          () => fetchWithTimeout(url.toString(), requestInit),
          () => proxyFetch(url.toString(), requestInit),
        )
      : await proxyFetch(url.toString(), requestInit);
  } catch {
    throw new GithubApiError(
      "blocked",
      0,
      "GitHub could not be reached directly or through Gity's relay. Check your network, VPN, firewall, or browser extensions, then retry.",
    );
  }
  recordRestRateLimit(res.headers);
  if (!res.ok) throw classifyRestError(res, await readErrorMessage(res));
  return { data: (await res.json()) as T, headers: res.headers };
}

/** Fetch every page of a paginated REST endpoint (follows Link headers). */
export async function restFetchAll<T>(
  token: string | null,
  path: string,
  opts?: {
    query?: Record<string, string | number | undefined>;
    perPage?: number;
    maxPages?: number;
  },
): Promise<T[]> {
  const maxPages = opts?.maxPages ?? 20;
  const perPage = opts?.perPage ?? 100;
  const all: T[] = [];
  let url: string | null = null;
  const firstQuery = { ...(opts?.query ?? {}), per_page: perPage };
  for (let page = 0; page < maxPages; page++) {
    let data: T[];
    let headers: Headers;
    if (url) {
      const r: { data: T[]; headers: Headers } = await restFetch<T[]>(token, url);
      data = r.data;
      headers = r.headers;
    } else {
      const r: { data: T[]; headers: Headers } = await restFetch<T[]>(token, path, {
        query: firstQuery,
      });
      data = r.data;
      headers = r.headers;
    }
    all.push(...data);
    const nextUrl: string | null = parseLinkHeader(headers.get("link")).next ?? null;
    if (!nextUrl || data.length === 0) break;
    url = nextUrl;
  }
  return all;
}

export interface GraphqlResponse<T> {
  data?: T;
  errors?: { message: string; type?: string }[];
}

/** Single GraphQL request. */
export async function graphqlFetch<T>(
  token: string | null,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  };
  try {
    // Server sessions must stay same-origin; PAT compatibility requests can
    // still use the direct path and fall back to the relay when blocked.
    res = token
      ? await fetchWithGatewayFallback(
          () => proxyFetch(GRAPHQL_URL, requestInit),
          () => fetchWithTimeout(GRAPHQL_URL, requestInit),
        )
      : await proxyFetch(GRAPHQL_URL, requestInit);
  } catch {
    throw new GithubApiError(
      "blocked",
      0,
      "GitHub could not be reached directly or through Gity's relay. Check your network, VPN, firewall, or browser extensions, then retry.",
    );
  }
  recordRestRateLimit(res.headers, "rest");
  if (res.status === 401)
    throw new GithubApiError(
      "auth",
      401,
      "GitHub rejected the token (401). It may be expired, revoked, or malformed.",
    );
  if (!res.ok) throw classifyRestError(res, await readErrorMessage(res));
  const body = (await res.json()) as GraphqlResponse<T> & {
    data?: T & { rateLimit?: { limit: number; remaining: number; resetAt: string } };
  };
  if (body.data?.rateLimit) recordGraphqlRateLimit(body.data.rateLimit);
  if (body.errors?.length) {
    const message = body.errors.map((e) => e.message).join("; ");
    const type = body.errors[0]?.type ?? "";
    if (/rate limit/i.test(message) || type === "RATE_LIMITED")
      throw new GithubApiError("rate-limit", 200, `GitHub GraphQL rate limit: ${message}`);
    if (/forbidden|permission|resource not accessible/i.test(message))
      throw new GithubApiError("forbidden", 200, `GitHub refused the query: ${message}`);
    if (!body.data) throw new GithubApiError("server", 200, `GitHub GraphQL error: ${message}`);
    // Partial data + errors (e.g. a repo the token can't see): log and continue with partial data.
    console.warn("[gity] GraphQL partial errors:", message);
  }
  if (!body.data) throw new GithubApiError("server", 200, "GitHub returned no data.");
  return body.data;
}
