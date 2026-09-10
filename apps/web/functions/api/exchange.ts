/**
 * POST /api/exchange — swaps a short-lived OAuth code (+ PKCE verifier)
 * for an encrypted server-side D1 session. GitHub tokens never reach the
 * browser and are never logged.
 */
import type { GityEnv } from "../lib/env";
import { createSession } from "../lib/session";

const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function onRequestPost({
  request,
  env,
}: {
  request: Request;
  env: GityEnv;
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

  try {
    if (new URL(body.redirect_uri).origin !== new URL(request.url).origin) {
      return json({ error: "invalid_redirect_uri" }, 400);
    }
  } catch {
    return json({ error: "invalid_redirect_uri" }, 400);
  }

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(TOKEN_URL, {
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

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
  };
  if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
    return json(
      { error: typeof tokenData.error === "string" ? tokenData.error : "exchange_failed" },
      400,
    );
  }

  let profileResponse: Response;
  try {
    profileResponse = await fetch(USER_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + tokenData.access_token,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Gity-Session",
      },
    });
  } catch {
    return json({ error: "profile_unreachable" }, 502);
  }
  if (!profileResponse.ok) return json({ error: "profile_failed" }, 502);

  const profile = (await profileResponse.json()) as {
    id?: number;
    login?: string;
    name?: string | null;
    avatar_url?: string;
    html_url?: string;
  };
  if (!profile.id || !profile.login) return json({ error: "profile_failed" }, 502);

  const expiresAt = tokenData.expires_in
    ? Date.now() + tokenData.expires_in * 1000
    : null;
  try {
    const session = await createSession(
      env,
      {
        id: String(profile.id),
        login: profile.login,
        name: profile.name ?? null,
        avatarUrl: profile.avatar_url ?? "",
        htmlUrl: profile.html_url ?? "",
      },
      {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        expiresAt,
      },
    );
    return json(
      {
        session: {
          login: profile.login,
          name: profile.name ?? null,
          avatarUrl: profile.avatar_url ?? "",
          htmlUrl: profile.html_url ?? "",
          fingerprint: session.fingerprint,
          expiresAt: session.expiresAt,
        },
      },
      200,
      { "Set-Cookie": session.cookie },
    );
  } catch {
    console.error("[gity-auth] session creation failed");
    return json({ error: "session_unavailable" }, 503);
  }
}
