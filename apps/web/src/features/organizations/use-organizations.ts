"use client";

import { useMemo } from "react";
import { useAuth, useViewerUser } from "@/lib/auth";
import { openPrsOptions, allIssuesOptions, orgsOptions, reposOptions } from "@/lib/github/queries";
import type { GithubOrg } from "@/lib/github/types";
import { useLiveQuery } from "../use-github";

/** Organizations enriched with repo/PR/issue counts + last activity. */
export function useOrganizations() {
  const { token, fingerprint: fp } = useAuth();
  const viewer = useViewerUser();
  const orgsQ = useLiveQuery({ ...orgsOptions(token, fp) });
  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const prsQ = useLiveQuery({ ...openPrsOptions(token, fp, viewer.data?.login, reposQ.data, "head") });
  const issuesQ = useLiveQuery({ ...allIssuesOptions(token, fp, viewer.data?.login, "head") });

  const orgs: (GithubOrg & { repos: typeof reposQ.data })[] = useMemo(() => {
    const repos = reposQ.data ?? [];
    const prs = prsQ.data ?? [];
    const issues = issuesQ.data ?? [];
    const byOrg = new Map<string, typeof repos>();
    for (const r of repos) {
      const arr = byOrg.get(r.ownerLogin) ?? [];
      arr.push(r);
      byOrg.set(r.ownerLogin, arr);
    }
    const base = orgsQ.data ?? [];
    // Include personal scope as a pseudo-org when the user owns repos.
    const known = new Set(base.map((o) => o.login));
    const extras: GithubOrg[] = [];
    if (viewer.data?.login && !known.has(viewer.data.login)) {
      const mine = byOrg.get(viewer.data.login) ?? [];
      if (mine.length > 0) {
        extras.push({
          login: viewer.data.login,
          name: viewer.data.name ?? viewer.data.login,
          avatarUrl: viewer.data.avatarUrl,
          description: "Personal repositories",
          repoCount: 0,
          openPrCount: 0,
          openIssueCount: 0,
          lastActivityAt: null,
        });
      }
    }
    return [...base, ...extras].map((o) => {
      const orgRepos = byOrg.get(o.login) ?? [];
      const orgPrs = prs.filter((p) => p.orgLogin === o.login);
      const orgIssues = issues.filter(
        (i) => i.orgLogin === o.login && i.state === "open",
      );
      const lastActivity = [orgPrs[0]?.updatedAt, orgIssues[0]?.updatedAt, orgRepos[0]?.pushedAt]
        .filter(Boolean)
        .sort()
        .pop() as string | undefined;
      return {
        ...o,
        repoCount: orgRepos.length,
        openPrCount: orgPrs.length,
        openIssueCount: orgIssues.length,
        lastActivityAt: lastActivity ?? null,
        repos: orgRepos,
      };
    }).sort((a, b) => b.repoCount - a.repoCount);
  }, [orgsQ.data, reposQ.data, prsQ.data, issuesQ.data, viewer.data]);

  return {
    orgs,
    isLoading: orgsQ.isLoading || reposQ.isLoading,
    error: (orgsQ.error ?? reposQ.error) as Error | null,
    dataUpdatedAt: Math.max(orgsQ.dataUpdatedAt, reposQ.dataUpdatedAt),
  };
}
