import type { GityEnv } from "../../lib/env";
import { createPkcePair, secureOAuthCookie, LINEAR_STATE_COOKIE, LINEAR_VERIFIER_COOKIE } from "../../lib/linear";
import { getSession } from "../../lib/session";

function redirect(request: Request, result: string): Response {
  return Response.redirect(new URL(`/linear?linear=${result}`, request.url).toString(), 303);
}

export async function onRequestGet({ request, env }: { request: Request; env: GityEnv }): Promise<Response> {
  if (!env.LINEAR_CLIENT_ID) return redirect(request, "not-configured");
  if (!(await getSession(request, env))) return redirect(request, "unauthorized");

  const { state, verifier, challenge } = await createPkcePair();
  const callback = new URL("/api/linear/callback", request.url).toString();
  const authorize = new URL("https://linear.app/oauth/authorize");
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: env.LINEAR_CLIENT_ID,
    redirect_uri: callback,
    state,
    scope: "read",
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  const headers = new Headers({ Location: authorize.toString(), "Cache-Control": "no-store" });
  headers.append("Set-Cookie", secureOAuthCookie(LINEAR_STATE_COOKIE, state));
  headers.append("Set-Cookie", secureOAuthCookie(LINEAR_VERIFIER_COOKIE, verifier));
  return new Response(null, { status: 302, headers });
}
