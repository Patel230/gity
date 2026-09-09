/**
 * POST /api/refresh — renews an expiring user token via its refresh token.
 * Same secret handling as /api/exchange: server-side only, nothing stored.
 */
interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

const TOKEN_URL = "https://github.com/login/oauth/access_token";

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function onRequestPost({
  request,
  env,
}: {
  request: Request;
  env: Env;
}): Promise<Response> {
  let body: { refresh_token?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!body.refresh_token) return json({ error: "bad_request" }, 400);
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: body.refresh_token,
      }),
    });
  } catch {
    return json({ error: "upstream_unreachable" }, 502);
  }
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || data.error || !data.access_token) {
    const code = typeof data.error === "string" ? data.error : "exchange_failed";
    return json({ error: code }, 400);
  }
  const { access_token, expires_in, refresh_token, refresh_token_expires_in, token_type } = data;
  return json({ access_token, expires_in, refresh_token, refresh_token_expires_in, token_type });
}
