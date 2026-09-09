/**
 * POST /api/exchange — swaps a short-lived OAuth code (+ PKCE verifier)
 * for user tokens. The client_secret never leaves this function.
 * Stores nothing, logs no tokens, returns only token fields.
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
  let body: { code?: string; code_verifier?: string; redirect_uri?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!body.code || !body.code_verifier || !body.redirect_uri) {
    return json({ error: "bad_request" }, 400);
  }
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: body.code,
        code_verifier: body.code_verifier,
        redirect_uri: body.redirect_uri,
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
