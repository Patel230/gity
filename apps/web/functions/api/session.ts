import type { GityEnv } from "../lib/env";
import { getSession } from "../lib/session";

export async function onRequestGet({
  request,
  env,
}: {
  request: Request;
  env: GityEnv;
}): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) {
    return Response.json(
      { authenticated: false },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    {
      authenticated: true,
      session: {
        login: session.login,
        name: session.name,
        avatarUrl: session.avatarUrl,
        htmlUrl: session.htmlUrl,
        fingerprint: session.fingerprint,
        expiresAt: session.expiresAt,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
