"use client";

import { useAuth, useViewerUser } from "@/lib/auth";
import {
  allIssuesOptions,
  allPrsOptions,
  ciStatesOptions,
  prCiStatesOptions,
  fetchIssueDelta,
  fetchPrDelta,
  reposOptions,
} from "@/lib/github/queries";
import type { GithubIssue, GithubPullRequest } from "@/lib/github/types";
import { useDeltaSearch, useLiveQuery } from "../use-github";

export function usePullRequests() {
  const { token, fingerprint: fp } = useAuth();
  const viewer = useViewerUser();
  const login = viewer.data?.login;
  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const ciQ = useLiveQuery({ ...ciStatesOptions(token, fp, reposQ.data) });
  const prsQ = useDeltaSearch<GithubPullRequest>(
    { ...allPrsOptions(token, fp, login) },
    "prs",
    (since) => fetchPrDelta(token!, login!, since),
    (all) => all,
  );

  const sorted = [...(prsQ.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const prCiQ = useLiveQuery({ ...prCiStatesOptions(token, fp, sorted) });

  return {
    prs: sorted,
    openCount: sorted.filter((p) => p.state === "open" || p.state === "draft").length,
    repos: reposQ.data ?? [],
    ciStates: ciQ.data ?? {},
    prCiStates: prCiQ.data ?? {},
    isLoading: prsQ.isLoading,
    isRefreshing: reposQ.isFetching || prsQ.isFetching || ciQ.isFetching || prCiQ.isFetching,
    error: (prsQ.error ?? reposQ.error) as Error | null,
    dataUpdatedAt: Math.max(prsQ.dataUpdatedAt, reposQ.dataUpdatedAt),
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
    isRefreshing: reposQ.isFetching || issuesQ.isFetching,
    error: (issuesQ.error ?? reposQ.error) as Error | null,
    dataUpdatedAt: Math.max(issuesQ.dataUpdatedAt, reposQ.dataUpdatedAt),
  };
}
