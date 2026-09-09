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
    const known = new Set(base.map((o) => o.login));
    const extras: GithubOrg[] = [];

    // GitHub's viewer.organizations only contains memberships. Repositories
    // can also be visible through public access or collaboration, so include
    // every owner represented in the repository query as an accessible scope.
    for (const [login, ownerRepos] of byOrg) {
      if (known.has(login)) continue;
      const isViewer = login === viewer.data?.login;
      extras.push({
        login,
        name: isViewer ? (viewer.data?.name ?? login) : login,
        avatarUrl:
          isViewer
            ? viewer.data?.avatarUrl ?? ownerRepos[0]?.ownerAvatarUrl ?? ""
            : ownerRepos[0]?.ownerAvatarUrl ?? "",
        description: isViewer
          ? "Personal repositories"
          : "Repositories accessible to you",
        repoCount: 0,
        openPrCount: 0,
        openIssueCount: 0,
        lastActivityAt: null,
      });
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
