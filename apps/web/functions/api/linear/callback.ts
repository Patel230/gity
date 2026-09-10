import type { GityEnv } from "../../lib/env";
import {
  clearOAuthCookie,
  constantTimeEqual,
  LINEAR_STATE_COOKIE,
  LINEAR_VERIFIER_COOKIE,
  readCookie,
  saveLinearConnection,
} from "../../lib/linear";
import { getSession } from "../../lib/session";

const TOKEN_URL = "https://api.linear.app/oauth/token";
const GRAPHQL_URL = "https://api.linear.app/graphql";

function redirect(request: Request, result: string): Response {
  const headers = new Headers({ Location: new URL(`/linear?linear=${result}`, request.url).toString(), "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearOAuthCookie(LINEAR_STATE_COOKIE));
  headers.append("Set-Cookie", clearOAuthCookie(LINEAR_VERIFIER_COOKIE));
  return new Response(null, { status: 303, headers });
}

export async function onRequestGet({ request, env }: { request: Request; env: GityEnv }): Promise<Response> {
  const session = await getSession(request, env);
  const url = new URL(request.url);
  if (!session || !env.LINEAR_CLIENT_ID) return redirect(request, "unauthorized");
  if (url.searchParams.get("error")) return redirect(request, "denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = readCookie(request, LINEAR_STATE_COOKIE);
  const verifier = readCookie(request, LINEAR_VERIFIER_COOKIE);
  if (!code || !state || !storedState || !verifier || !constantTimeEqual(state, storedState)) {
    return redirect(request, "invalid-state");
  }

  const callback = new URL("/api/linear/callback", request.url).toString();
  const form = new URLSearchParams({
    code,
    redirect_uri: callback,
    client_id: env.LINEAR_CLIENT_ID,
    code_verifier: verifier,
    grant_type: "authorization_code",
  });
  if (env.LINEAR_CLIENT_SECRET) form.set("client_secret", env.LINEAR_CLIENT_SECRET);

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
  } catch {
    return redirect(request, "upstream-error");
  }
  const tokenData = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
  if (!tokenResponse.ok || !tokenData.access_token) return redirect(request, "exchange-failed");

  let profileResponse: Response;
  try {
    profileResponse = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${tokenData.access_token}` },
      body: JSON.stringify({ query: "query LinearViewer { viewer { id name } }" }),
    });
  } catch {
    return redirect(request, "profile-error");
  }
  const profilePayload = await profileResponse.json() as { data?: { viewer?: { id?: string; name?: string | null } }; errors?: unknown[] };
  const viewer = profilePayload.data?.viewer;
  if (!profileResponse.ok || profilePayload.errors?.length || !viewer?.id) return redirect(request, "profile-failed");

  try {
    await saveLinearConnection(env, session.userId, { id: viewer.id, name: viewer.name ?? null }, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
      scope: tokenData.scope ?? "read",
    });
  } catch {
    console.error("[gity-linear] connection storage failed");
    return redirect(request, "storage-failed");
  }
  return redirect(request, "connected");
}
