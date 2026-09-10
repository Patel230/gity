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
  // Render the first 100 recent PRs immediately. The complete history sync
  // starts after that fast head query and replaces it when ready.
  const headQ = useLiveQuery({ ...allPrsOptions(token, fp, login, "head") });
  const fullQ = useDeltaSearch<GithubPullRequest>(
    { ...allPrsOptions(token, fp, login), enabled: fp !== "anon" && !!login && headQ.data !== undefined },
    "prs",
    (since) => fetchPrDelta(token, login!, since),
    (all) => all,
  );

  const visiblePrs = fullQ.data ?? headQ.data ?? [];
  const sorted = [...visiblePrs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const prCiQ = useLiveQuery({ ...prCiStatesOptions(token, fp, sorted) });

  return {
    prs: sorted,
    openCount: sorted.filter((p) => p.state === "open" || p.state === "draft").length,
    repos: reposQ.data ?? [],
    ciStates: ciQ.data ?? {},
    prCiStates: prCiQ.data ?? {},
    isLoading: headQ.data === undefined && fullQ.data === undefined && (headQ.isLoading || fullQ.isLoading),
    isRefreshing: reposQ.isFetching || headQ.isFetching || fullQ.isFetching || ciQ.isFetching || prCiQ.isFetching,
    error: (fullQ.error ?? headQ.error ?? reposQ.error) as Error | null,
    dataUpdatedAt: Math.max(fullQ.dataUpdatedAt, headQ.dataUpdatedAt, reposQ.dataUpdatedAt),
  };
}

export function useIssues() {
  const { token, fingerprint: fp } = useAuth();
  const viewer = useViewerUser();
  const login = viewer.data?.login;
  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const headQ = useLiveQuery({ ...allIssuesOptions(token, fp, login, "head") });
  const fullQ = useDeltaSearch<GithubIssue>(
    { ...allIssuesOptions(token, fp, login), enabled: fp !== "anon" && !!login && headQ.data !== undefined },
    "issues",
    (since) => fetchIssueDelta(token, login!, since),
    (all) => all,
  );
  const visibleIssues = fullQ.data ?? headQ.data ?? [];

  return {
    issues: [...visibleIssues].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    repos: reposQ.data ?? [],
    isLoading: headQ.data === undefined && fullQ.data === undefined && (headQ.isLoading || fullQ.isLoading),
    isRefreshing: reposQ.isFetching || headQ.isFetching || fullQ.isFetching,
    error: (fullQ.error ?? headQ.error ?? reposQ.error) as Error | null,
    dataUpdatedAt: Math.max(fullQ.dataUpdatedAt, headQ.dataUpdatedAt, reposQ.dataUpdatedAt),
  };
}
