"use client";

import { useAuth, useViewerUser } from "@/lib/auth";
import {
  allIssuesOptions,
  fetchIssueDelta,
  fetchPrDelta,
  mergedPrsOptions,
  openPrsOptions,
  reposOptions,
} from "@/lib/github/queries";
import type { GithubIssue, GithubPullRequest } from "@/lib/github/types";
import { useDeltaSearch, useLiveQuery } from "../use-github";

const isOpenPr = (p: GithubPullRequest) => p.state === "open" || p.state === "draft";
const isMergedPr = (p: GithubPullRequest) => p.state === "merged" || p.state === "closed";

export function usePullRequests() {
  const { token, fingerprint: fp } = useAuth();
  const viewer = useViewerUser();
  const login = viewer.data?.login;
  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const openQ = useDeltaSearch<GithubPullRequest>(
    { ...openPrsOptions(token, fp, login, reposQ.data) },
    "prs-open",
    (since) => fetchPrDelta(token!, login!, since),
    (all) => all.filter(isOpenPr),
  );
  const mergedQ = useDeltaSearch<GithubPullRequest>(
    { ...mergedPrsOptions(token, fp, login) },
    "prs-merged",
    (since) => fetchPrDelta(token!, login!, since),
    (all) => all.filter(isMergedPr),
  );

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
  const login = viewer.data?.login;
  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const issuesQ = useDeltaSearch<GithubIssue>(
    { ...allIssuesOptions(token, fp, login) },
    "issues",
    (since) => fetchIssueDelta(token!, login!, since),
    (all) => all,
  );

  return {
    issues: (issuesQ.data ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    repos: reposQ.data ?? [],
    isLoading: issuesQ.isLoading,
    error: issuesQ.error as Error | null,
    dataUpdatedAt: issuesQ.dataUpdatedAt,
  };
}
