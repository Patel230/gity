"use client";

import { useAuth } from "@/lib/auth";
import { reposOptions, workflowRunsOptions } from "@/lib/github/queries";
import { useLiveQuery } from "../use-github";

/** Repository ownership topology plus a bounded Actions snapshot for the Graph page. */
export function useGraph(loadWorkflows = false) {
  const { token, fingerprint: fp } = useAuth();
  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const workflowOptions = workflowRunsOptions(token, fp, reposQ.data, 30);
  const runsQ = useLiveQuery({
    ...workflowOptions,
    enabled: loadWorkflows && workflowOptions.enabled,
  });

  return {
    repos: reposQ.data ?? [],
    runs: runsQ.data ?? [],
    isLoading: reposQ.isLoading,
    runsLoading: loadWorkflows && runsQ.isLoading,
    error: (reposQ.error ?? runsQ.error) as Error | null,
    dataUpdatedAt: Math.max(reposQ.dataUpdatedAt, runsQ.dataUpdatedAt),
  };
}
