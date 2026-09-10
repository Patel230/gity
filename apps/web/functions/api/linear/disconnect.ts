import type { GityEnv } from "../../lib/env";
import { deleteLinearConnection } from "../../lib/linear";

export async function onRequestPost({ request, env }: { request: Request; env: GityEnv }): Promise<Response> {
  if (request.headers.get("Origin") && request.headers.get("Origin") !== new URL(request.url).origin) {
    return Response.json({ error: "cross_origin_request" }, { status: 403 });
  }
  await deleteLinearConnection(request, env);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
