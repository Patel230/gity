/**
 * Same-origin GitHub relay used only when a browser/network blocks direct
 * calls to api.github.com. PATs are forwarded for one request; OAuth sessions
 * are decrypted server-side and never exposed to the browser or logs.
 */
import {
  cacheKey,
  getCachedGithubResponse,
  putCachedGithubResponse,
} from "../lib/cache";
import type { GityEnv } from "../lib/env";
import { getSession, isSameOrigin } from "../lib/session";

const GITHUB_HOST = "api.github.com";

export async function onRequest({
  request,
  env,
  waitUntil,
}: {
  request: Request;
  env: GityEnv;
  waitUntil?: (promise: Promise<unknown>) => void;
}): Promise<Response> {
  const startedAt = Date.now();
  const incoming = new URL(request.url);
  const targetValue = incoming.searchParams.get("url");
  if (!targetValue) return relayError("missing_url", 400);

  let target: URL;
  try {
    target = new URL(targetValue);
  } catch {
    return relayError("invalid_url", 400);
  }
  if (target.protocol !== "https:" || target.hostname !== GITHUB_HOST) {
    return relayError("upstream_not_allowed", 400);
  }

  const explicitAuthorization = request.headers.get("authorization");
  let session = null;
  if (!explicitAuthorization) {
    if (!isSameOrigin(request)) return relayError("cross_origin_request", 403);
    if (request.method === "POST" && target.pathname !== "/graphql") {
      return relayError("method_not_allowed", 405);
    }
    try {
      session = await getSession(request, env);
    } catch {
      console.error("[gity-relay] session lookup failed");
    }
    if (!session) return relayError("unauthorized", 401, 0, startedAt);
    if (session.expiresAt !== null && session.expiresAt <= Date.now()) {
      return relayError("session_expired", 401, 0, startedAt);
    }
  }

  // Rebuild the upstream request instead of forwarding browser/Cloudflare
  // metadata (Origin, Referer, content-length, sec-fetch-*, etc.). Those
  // headers are not useful to GitHub and can make a streamed POST fail.
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Gity-GitHub-Relay",
  });
  const contentType = request.headers.get("content-type");
  if (explicitAuthorization) headers.set("Authorization", explicitAuthorization);
  else if (session) headers.set("Authorization", "Bearer " + session.accessToken);
  if (contentType) headers.set("Content-Type", contentType);
  else if (request.method !== "GET" && request.method !== "HEAD") {
    headers.set("Content-Type", "application/json");
  }

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.arrayBuffer();
    } catch {
      return relayError("bad_request", 400);
    }
  }

  const key = session ? await cacheKey(target.toString(), body) : null;
  if (key && session) {
    try {
      const cached = await getCachedGithubResponse(env, session, key);
      if (cached) {
        const cachedHeaders = new Headers({
          "Cache-Control": "no-store",
          "Content-Type": cached.contentType,
          "X-Gity-Cache": "hit",
          "X-Gity-Relay": "github",
          "X-Gity-Relay-Attempts": "0",
          "Server-Timing": "github-cache;dur=0",
        });
        if (cached.rateLimitRemaining) {
          cachedHeaders.set("X-RateLimit-Remaining", cached.rateLimitRemaining);
        }
        if (cached.rateLimitReset) {
          cachedHeaders.set("X-RateLimit-Reset", cached.rateLimitReset);
        }
        return new Response(cached.body, {
          status: cached.status,
          headers: cachedHeaders,
        });
      }
    } catch {
      console.warn("[gity-relay] cache read failed");
    }
  }

  let upstream: Response | undefined;
  let attempts = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    attempts = attempt + 1;
    try {
      upstream = await fetch(target, {
        method: request.method,
        headers,
        body,
      });
      if (![502, 503, 504].includes(upstream.status) || attempt === 2) break;
      // GitHub's edge can briefly return gateway errors during high fan-out
      // dashboard loads. Retry those responses before exposing a failure.
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    } catch {
      if (attempt === 2) {
        console.warn("[gity-relay] upstream unreachable", {
          method: request.method,
          path: target.pathname,
          attempts,
        });
        return relayError("upstream_unreachable", 502, attempts, startedAt);
      }
    }
  }
  if (!upstream) return relayError("upstream_unreachable", 502, attempts, startedAt);

  if (!upstream.ok) {
    console.warn("[gity-relay] upstream failure", {
      method: request.method,
      path: target.pathname,
      status: upstream.status,
      attempts,
    });
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("set-cookie");
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Gity-Relay", "github");
  responseHeaders.set("X-Gity-Relay-Attempts", String(attempts));
  responseHeaders.set("Server-Timing", `github-relay;dur=${Date.now() - startedAt}`);
  const upstreamContentType = upstream.headers.get("content-type") ?? "";
  if (key && session && upstream.ok && upstreamContentType.includes("json")) {
    const responseBody = await upstream.text();
    const cacheWrite = putCachedGithubResponse(env, session, key, upstream, responseBody).catch(() => {
      console.warn("[gity-relay] cache write failed");
    });
    if (waitUntil) waitUntil(cacheWrite);
    else await cacheWrite;
    responseHeaders.set("X-Gity-Cache", "miss");
    return new Response(responseBody, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

function relayError(
  error: string,
  status: number,
  attempts = 0,
  startedAt = Date.now(),
): Response {
  return Response.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Gity-Relay": "error",
        "X-Gity-Relay-Attempts": String(attempts),
        "Server-Timing": `github-relay;dur=${Date.now() - startedAt}`,
      },
    },
  );
}
