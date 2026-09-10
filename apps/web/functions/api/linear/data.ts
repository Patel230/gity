import type { GityEnv } from "../../lib/env";
import { getLinearSessionContext, updateLinearTokens } from "../../lib/linear";
import { getSession } from "../../lib/session";

const TOKEN_URL = "https://api.linear.app/oauth/token";
const GRAPHQL_URL = "https://api.linear.app/graphql";
const LINEAR_QUERY = `query GityLinearData {
  viewer { id name }
  teams(first: 50) { nodes { id name key color } }
  projects(first: 50) { nodes { id name url status { name type } } }
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
const DOCUMENTS_QUERY = `query GityLinearDocuments {
  documents(first: 50, orderBy: updatedAt) {
    nodes { id title url updatedAt creator { name } }
  }
}`;
const ISSUE_DETAILS_QUERY = `query GityLinearIssueDetails {
  issues(first: 100, orderBy: updatedAt) {
    nodes {
      id priority dueDate estimate
      cycle { name }
      labels { nodes { name color } }
    }
  }
}`;

type RawData = {
  viewer?: { id: string; name: string | null };
  teams?: { nodes: { id: string; name: string; key: string; color: string | null }[] };
  projects?: { nodes: { id: string; name: string; url: string; status: { name: string; type: string } | null }[] };
  issues?: { nodes: {
    id: string; identifier: string; title: string; url: string; createdAt: string; updatedAt: string;
    state: { name: string; type: string; color: string | null } | null;
    assignee: { name: string } | null;
    team: { name: string; key: string } | null;
    project: { name: string } | null;
    priority?: number;
    dueDate?: string | null;
    estimate?: number | null;
    cycle?: { name: string | null } | null;
    labels?: { nodes: { name: string; color: string }[] };
  }[] };
};
type RawDocuments = { nodes: { id: string; title: string; url: string; updatedAt: string; creator: { name: string } | null }[] };
type RawIssueDetails = { nodes: { id: string; priority: number; dueDate: string | null; estimate: number | null; cycle: { name: string | null } | null; labels: { nodes: { name: string; color: string }[] } }[] };

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
  let response: Response;
  try {
    response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ query: LINEAR_QUERY }),
    });
  } catch (error) {
    console.error("[gity-linear] GraphQL fetch failed", error instanceof Error ? error.message : "unknown error");
    throw new Error("Linear data request failed");
  }
  let payload: { data?: RawData; errors?: { message?: string }[] };
  try {
    payload = await response.json() as { data?: RawData; errors?: { message?: string }[] };
  } catch {
    console.error("[gity-linear] GraphQL response was not JSON", response.status);
    throw new Error("Linear data request failed");
  }
  if (!response.ok || payload.errors?.length || !payload.data) {
    console.error("[gity-linear] GraphQL request failed", response.status, JSON.stringify(payload.errors ?? []).slice(0, 1200));
    throw new Error("Linear data request failed");
  }
  return payload.data;
}

async function queryLinearDocuments(accessToken: string): Promise<RawDocuments> {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ query: DOCUMENTS_QUERY }),
  });
  let payload: { data?: { documents?: RawDocuments }; errors?: { message?: string }[] };
  try {
    payload = await response.json() as { data?: { documents?: RawDocuments }; errors?: { message?: string }[] };
  } catch {
    throw new Error("Linear documents request failed");
  }
  if (!response.ok || payload.errors?.length || !payload.data?.documents) {
    throw new Error("Linear documents request failed");
  }
  return payload.data.documents;
}

async function queryLinearIssueDetails(accessToken: string): Promise<RawIssueDetails> {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ query: ISSUE_DETAILS_QUERY }),
  });
  let payload: { data?: { issues?: RawIssueDetails }; errors?: { message?: string }[] };
  try {
    payload = await response.json() as { data?: { issues?: RawIssueDetails }; errors?: { message?: string }[] };
  } catch {
    throw new Error("Linear issue details request failed");
  }
  if (!response.ok || payload.errors?.length || !payload.data?.issues) {
    throw new Error("Linear issue details request failed");
  }
  return payload.data.issues;
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
  let documents: RawDocuments = { nodes: [] };
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
  try {
    documents = await queryLinearDocuments(accessToken);
  } catch {
    console.warn("[gity-linear] Documents unavailable; continuing without documents");
  }
  let issueDetails: RawIssueDetails = { nodes: [] };
  try {
    issueDetails = await queryLinearIssueDetails(accessToken);
  } catch {
    console.warn("[gity-linear] Issue details unavailable; continuing with core issue data");
  }
  const detailsById = new Map(issueDetails.nodes.map((issue) => [issue.id, issue]));
  return json({
    viewer: data.viewer ?? null,
    teams: data.teams?.nodes ?? [],
    projects: (data.projects?.nodes ?? []).map((project) => ({ ...project, state: project.status })),
    issues: (data.issues?.nodes ?? []).map((issue) => {
      const details = detailsById.get(issue.id);
      return {
        ...issue,
        priority: details?.priority ?? 0,
        dueDate: details?.dueDate ?? null,
        estimate: details?.estimate ?? null,
        cycle: details?.cycle ?? null,
        labels: details?.labels?.nodes ?? [],
      };
    }),
    documents: documents.nodes,
    fetchedAt: Date.now(),
  });
}
