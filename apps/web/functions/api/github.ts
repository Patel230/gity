/**
 * Same-origin GitHub relay used only when a browser/network blocks direct
 * calls to api.github.com. The token is forwarded for one request and never
 * stored or logged by this function.
 */
const GITHUB_HOST = "api.github.com";

export async function onRequest({ request }: { request: Request }): Promise<Response> {
  const incoming = new URL(request.url);
  const targetValue = incoming.searchParams.get("url");
  if (!targetValue) return Response.json({ error: "missing_url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(targetValue);
  } catch {
    return Response.json({ error: "invalid_url" }, { status: 400 });
  }
  if (target.protocol !== "https:" || target.hostname !== GITHUB_HOST) {
    return Response.json({ error: "upstream_not_allowed" }, { status: 400 });
  }

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("Accept", "application/vnd.github+json");
  headers.set("X-GitHub-Api-Version", "2022-11-28");

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    });
  } catch {
    return Response.json({ error: "upstream_unreachable" }, { status: 502 });
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("set-cookie");
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
