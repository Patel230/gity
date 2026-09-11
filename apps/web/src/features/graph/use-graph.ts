"use client";

import { useAuth } from "@/lib/auth";
import { usePrefs } from "@/lib/preferences";
import { RUNS_POLL_FLOOR_MS, ciStatesOptions, reposOptions, workflowRunsOptions } from "@/lib/github/queries";
import { useLiveQuery } from "../use-github";

/** Repository ownership topology, bounded CI states, and an optional Actions snapshot. */
export function useGraph(loadWorkflows = false) {
  const { token, fingerprint: fp } = useAuth();
  const { refreshInterval } = usePrefs();
  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const ciQ = useLiveQuery({ ...ciStatesOptions(token, fp, reposQ.data) });
  const workflowOptions = workflowRunsOptions(token, fp, reposQ.data, 30);
  const runsQ = useLiveQuery({
    ...workflowOptions,
    enabled: loadWorkflows && workflowOptions.enabled,
    // Floor the fan-out poll: one REST call per repo per tick.
    refetchInterval: refreshInterval === false ? false : Math.max(refreshInterval, RUNS_POLL_FLOOR_MS),
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
    // A failed runs poll must never blank the page: TanStack keeps the last
    // snapshot and the next tick retries. Only repos failure blocks.
    error: reposQ.error as Error | null,
    runsError: runsQ.error as Error | null,
    dataUpdatedAt: Math.max(reposQ.dataUpdatedAt, ciQ.dataUpdatedAt, runsQ.dataUpdatedAt),
  };
}
