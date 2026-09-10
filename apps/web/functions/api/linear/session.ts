import type { GityEnv } from "../../lib/env";
import { getLinearSessionContext } from "../../lib/linear";
import { getSession } from "../../lib/session";

export async function onRequestGet({ request, env }: { request: Request; env: GityEnv }): Promise<Response> {
  if (!(await getSession(request, env))) return Response.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const context = await getLinearSessionContext(request, env);
  return Response.json({
    configured: Boolean(env.LINEAR_CLIENT_ID),
    connected: Boolean(context),
    connection: context ? {
      userName: context.connection.linearUserName,
      workspaceName: context.connection.workspaceName,
      scope: context.connection.scope,
      expiresAt: context.connection.expiresAt,
      updatedAt: context.connection.updatedAt,
    } : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
