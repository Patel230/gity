"use client";

import { useLiveQuery } from "../use-github";

export interface LinearSession {
  configured: boolean;
  connected: boolean;
  connection: { userName: string | null; workspaceName: string | null; scope: string; expiresAt: number | null; updatedAt: number } | null;
}

export interface LinearTeam { id: string; name: string; key: string; color: string | null }
export interface LinearProject { id: string; name: string; url: string; state: { name: string; type: string } | null }
export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  state: { name: string; type: string; color: string | null } | null;
  assignee: { name: string } | null;
  team: { name: string; key: string } | null;
  project: { name: string } | null;
}

export interface LinearData {
  viewer: { id: string; name: string | null } | null;
  teams: LinearTeam[];
  projects: LinearProject[];
  issues: LinearIssue[];
  fetchedAt: number;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Linear request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

export function useLinear() {
  const sessionQ = useLiveQuery<LinearSession, Error>({
    queryKey: ["gity", "linear", "session"],
    queryFn: () => getJson<LinearSession>("/api/linear/session"),
    // Connection state can change outside this tab during OAuth; always
    // validate it when the Linear page mounts instead of trusting persisted data.
    staleTime: 0,
    gcTime: 15 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnMount: "always",
    retry: false,
  });
  const dataQ = useLiveQuery<LinearData, Error>({
    queryKey: ["gity", "linear", "data"],
    queryFn: () => getJson<LinearData>("/api/linear/data"),
    enabled: sessionQ.data?.connected === true,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnMount: "always",
    retry: 1,
  });
  const disconnect = async () => {
    const response = await fetch("/api/linear/disconnect", { method: "POST", credentials: "include" });
    if (!response.ok) throw new Error("Unable to disconnect Linear.");
    await sessionQ.refetch();
  };
  return {
    session: sessionQ.data,
    data: dataQ.data,
    isLoading: sessionQ.isLoading || (sessionQ.data?.connected === true && dataQ.isLoading),
    dataLoading: dataQ.isLoading,
    error: sessionQ.error ?? dataQ.error,
    disconnect,
  };
}
