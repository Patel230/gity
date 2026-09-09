"use client";

import { useAuth, useViewerUser } from "@/lib/auth";
import { allIssuesOptions, mergedPrsOptions, openPrsOptions, reposOptions } from "@/lib/github/queries";
import { useLiveQuery } from "../use-github";

export function usePullRequests() {
  const { token, fingerprint: fp } = useAuth();
  const viewer = useViewerUser();
  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const openQ = useLiveQuery({ ...openPrsOptions(token, fp, viewer.data?.login, reposQ.data) });
  const mergedQ = useLiveQuery({ ...mergedPrsOptions(token, fp, viewer.data?.login) });

  const prs = [...(openQ.data ?? []), ...(mergedQ.data ?? [])];
  const seen = new Set<string>();
  const deduped = prs.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));

  return {
    prs: deduped.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    openCount: openQ.data?.length ?? 0,
    repos: reposQ.data ?? [],
    isLoading: openQ.isLoading || mergedQ.isLoading,
    error: (openQ.error ?? mergedQ.error) as Error | null,
    dataUpdatedAt: Math.max(openQ.dataUpdatedAt, mergedQ.dataUpdatedAt),
  };
}

export function useIssues() {
  const { token, fingerprint: fp } = useAuth();
  const viewer = useViewerUser();
  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const issuesQ = useLiveQuery({ ...allIssuesOptions(token, fp, viewer.data?.login) });

  return {
    issues: (issuesQ.data ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    repos: reposQ.data ?? [],
    isLoading: issuesQ.isLoading,
    error: issuesQ.error as Error | null,
    dataUpdatedAt: issuesQ.dataUpdatedAt,
  };
}
