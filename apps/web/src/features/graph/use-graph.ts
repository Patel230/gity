"use client";

import { useAuth } from "@/lib/auth";
import { ciStatesOptions, reposOptions, workflowRunsOptions } from "@/lib/github/queries";
import { useLiveQuery } from "../use-github";

/** Repository ownership topology, bounded CI states, and an optional Actions snapshot. */
export function useGraph(loadWorkflows = false) {
  const { token, fingerprint: fp } = useAuth();
  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const ciQ = useLiveQuery({ ...ciStatesOptions(token, fp, reposQ.data) });
  const workflowOptions = workflowRunsOptions(token, fp, reposQ.data, 30);
  const runsQ = useLiveQuery({
    ...workflowOptions,
    enabled: loadWorkflows && workflowOptions.enabled,
  });

  const repos = (reposQ.data ?? []).map((repo) => ({
    ...repo,
    ciState: ciQ.data?.[repo.fullName] ?? repo.ciState,
  }));

  return {
    repos,
    runs: runsQ.data ?? [],
    isLoading: reposQ.isLoading,
    ciLoading: ciQ.isLoading,
    runsLoading: loadWorkflows && runsQ.isLoading,
    error: (reposQ.error ?? runsQ.error) as Error | null,
    dataUpdatedAt: Math.max(reposQ.dataUpdatedAt, ciQ.dataUpdatedAt, runsQ.dataUpdatedAt),
  };
}
