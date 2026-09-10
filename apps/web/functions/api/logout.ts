import type { GityEnv } from "../lib/env";
import { clearSessionCookie, deleteSession, isSameOrigin } from "../lib/session";

export async function onRequestPost({
  request,
  env,
}: {
  request: Request;
  env: GityEnv;
}): Promise<Response> {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "cross_origin_request" }, { status: 403 });
  }
  try {
    await deleteSession(request, env);
  } catch {
    console.warn("[gity-auth] session deletion failed");
  }
  return Response.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": clearSessionCookie(),
      },
    },
  );
}
