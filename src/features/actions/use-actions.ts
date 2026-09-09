"use client";

import { useAuth } from "@/lib/auth";
import { reposOptions, workflowRunsOptions } from "@/lib/github/queries";
import { useLiveQuery } from "../use-github";

export function useActions() {
  const { token, fingerprint: fp } = useAuth();
  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const runsQ = useLiveQuery({ ...workflowRunsOptions(token, fp, reposQ.data) });

  const runs = runsQ.data ?? [];
  const failed = runs.filter((r) => r.conclusion === "failure" || r.conclusion === "timed_out");
  const running = runs.filter((r) => r.status === "in_progress");
  const queued = runs.filter((r) => r.status === "queued");
  const succeeded = runs.filter((r) => r.conclusion === "success");

  // Latest run per repo for the summary, failed-first ordering.
  const byRepo = new Map<string, (typeof runs)[number]>();
  for (const r of runs) {
    const cur = byRepo.get(r.repoFullName);
    if (!cur || r.updatedAt > cur.updatedAt) byRepo.set(r.repoFullName, r);
  }
  const rank = (r: (typeof runs)[number]) =>
    r.conclusion === "failure" || r.conclusion === "timed_out"
      ? 0
      : r.status === "in_progress"
        ? 1
        : r.status === "queued"
          ? 2
          : 3;
  const latestPerRepo = [...byRepo.values()].sort(
    (a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt),
  );

  return {
    runs,
    failed,
    running,
    queued,
    succeeded,
    latestPerRepo,
    isLoading: runsQ.isLoading || reposQ.isLoading,
    error: (runsQ.error ?? reposQ.error) as Error | null,
    dataUpdatedAt: runsQ.dataUpdatedAt,
  };
}
