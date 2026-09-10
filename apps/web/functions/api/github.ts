/**
 * Same-origin GitHub relay used only when a browser/network blocks direct
 * calls to api.github.com. The token is forwarded for one request and never
 * stored or logged by this function.
 */
const GITHUB_HOST = "api.github.com";

export async function onRequest({ request }: { request: Request }): Promise<Response> {
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

  // Rebuild the upstream request instead of forwarding browser/Cloudflare
  // metadata (Origin, Referer, content-length, sec-fetch-*, etc.). Those
  // headers are not useful to GitHub and can make a streamed POST fail.
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Gity-GitHub-Relay",
  });
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");
  if (authorization) headers.set("Authorization", authorization);
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
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
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
