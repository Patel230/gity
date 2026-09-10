import type { GityEnv } from "../../lib/env";
import { getLinearSessionContext, updateLinearTokens } from "../../lib/linear";
import { getSession } from "../../lib/session";

const TOKEN_URL = "https://api.linear.app/oauth/token";
const GRAPHQL_URL = "https://api.linear.app/graphql";
const LINEAR_QUERY = `query GityLinearData {
  viewer { id name }
  teams(first: 50) { nodes { id name key color } }
  projects(first: 50) { nodes { id name url state { name type } } }
  issues(first: 100, orderBy: updatedAt) {
    nodes {
      id identifier title url createdAt updatedAt
      state { name type color }
      assignee { name }
      team { name key }
      project { name }
    }
  }
}`;

type RawData = {
  viewer?: { id: string; name: string | null };
  teams?: { nodes: { id: string; name: string; key: string; color: string | null }[] };
  projects?: { nodes: { id: string; name: string; url: string; state: { name: string; type: string } | null }[] };
  issues?: { nodes: {
    id: string; identifier: string; title: string; url: string; createdAt: string; updatedAt: string;
    state: { name: string; type: string; color: string | null } | null;
    assignee: { name: string } | null;
    team: { name: string; key: string } | null;
    project: { name: string } | null;
  }[] };
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function refreshToken(env: GityEnv, userId: string, refresh: string): Promise<string | null> {
  if (!env.LINEAR_CLIENT_ID) return null;
  const form = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: env.LINEAR_CLIENT_ID });
  if (env.LINEAR_CLIENT_SECRET) form.set("client_secret", env.LINEAR_CLIENT_SECRET);
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
  } catch {
    return null;
  }
  const data = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!response.ok || !data.access_token) return null;
  await updateLinearTokens(env, userId, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refresh,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
  });
  return data.access_token;
}

async function queryLinear(accessToken: string): Promise<RawData> {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ query: LINEAR_QUERY }),
  });
  const payload = await response.json() as { data?: RawData; errors?: { message?: string }[] };
  if (!response.ok || payload.errors?.length || !payload.data) throw new Error("Linear data request failed");
  return payload.data;
}

export async function onRequestGet({ request, env }: { request: Request; env: GityEnv }): Promise<Response> {
  if (!(await getSession(request, env))) return json({ error: "unauthorized" }, 401);
  const context = await getLinearSessionContext(request, env);
  if (!context) return json({ error: "linear_not_connected" }, 404);

  let accessToken = context.accessToken;
  if (context.connection.expiresAt && context.connection.expiresAt < Date.now() + 2 * 60_000 && context.refreshToken) {
    accessToken = await refreshToken(env, context.session.userId, context.refreshToken) ?? accessToken;
  }
  let data: RawData;
  try {
    data = await queryLinear(accessToken);
  } catch {
    if (!context.refreshToken) return json({ error: "linear_request_failed" }, 502);
    const refreshed = await refreshToken(env, context.session.userId, context.refreshToken);
    if (!refreshed) return json({ error: "linear_session_expired" }, 401);
    try {
      data = await queryLinear(refreshed);
    } catch {
      return json({ error: "linear_request_failed" }, 502);
    }
  }
  return json({
    viewer: data.viewer ?? null,
    teams: data.teams?.nodes ?? [],
    projects: data.projects?.nodes ?? [],
    issues: data.issues?.nodes ?? [],
    fetchedAt: Date.now(),
  });
}
