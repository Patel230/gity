/**
 * POST /api/refresh — renews the encrypted server-side OAuth session.
 * The refresh token is read from the HttpOnly cookie-backed D1 session.
 */
import type { GityEnv } from "../lib/env";
import { getSession, isSameOrigin, updateSessionTokens } from "../lib/session";

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
  env: GityEnv;
}): Promise<Response> {
  if (!isSameOrigin(request)) return json({ error: "cross_origin_request" }, 403);
  const session = await getSession(request, env);
  if (!session) return json({ error: "unauthorized" }, 401);
  if (!session.refreshToken) return json({ error: "session_expired" }, 401);

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
      }),
    });
  } catch {
    return json({ error: "upstream_unreachable" }, 502);
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
  };
  if (!response.ok || data.error || !data.access_token) {
    return json({ error: "session_expired" }, 401);
  }

  const expiresAt = data.expires_in
    ? Date.now() + data.expires_in * 1000
    : null;
  try {
    await updateSessionTokens(env, session.id, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? session.refreshToken,
      expiresAt,
    });
  } catch {
    return json({ error: "session_unavailable" }, 503);
  }
  return json({
    session: {
      login: session.login,
      name: session.name,
      avatarUrl: session.avatarUrl,
      htmlUrl: session.htmlUrl,
      fingerprint: session.fingerprint,
      expiresAt,
    },
  });
}
