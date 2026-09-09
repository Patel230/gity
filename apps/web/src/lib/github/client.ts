/**
 * Low-level GitHub transport.
 * - Browser → api.github.com only. No proxy, no backend.
 * - Token is passed in per call (never read from env).
 * - Maps failures to GithubApiError and records rate limits.
 */
import { recordGraphqlRateLimit, recordRestRateLimit } from "./rate-limit";
import { GithubApiError } from "./types";
import { parseLinkHeader, toGithubError } from "./pagination";

export const REST_BASE = "https://api.github.com";
export const GRAPHQL_URL = "https://api.github.com/graphql";

function authHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
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
  token: string,
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
  try {
    res = await fetch(url.toString(), {
      ...init,
      headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
    });
  } catch (e) {
    throw new GithubApiError(
      "blocked",
      0,
      "Request to GitHub was blocked before it completed (the browser reports CORS/network failure). This is almost always a local blocker — ad-blocker, privacy extension, VPN, firewall, or antivirus — not a Gity bug. See Settings → Connection test.",
    );
  }
  recordRestRateLimit(res.headers);
  if (!res.ok) throw classifyRestError(res, await readErrorMessage(res));
  return { data: (await res.json()) as T, headers: res.headers };
}

/** Fetch every page of a paginated REST endpoint (follows Link headers). */
export async function restFetchAll<T>(
  token: string,
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
  let first = true;
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
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e) {
    throw new GithubApiError(
      "blocked",
      0,
      "Request to GitHub was blocked before it completed (the browser reports CORS/network failure). This is almost always a local blocker — ad-blocker, privacy extension, VPN, firewall, or antivirus — not a Gity bug. See Settings → Connection test.",
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
