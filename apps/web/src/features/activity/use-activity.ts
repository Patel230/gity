"use client";

import { useMemo } from "react";
import { useAuth, useViewerUser } from "@/lib/auth";
import { allIssuesOptions, eventsOptions, mergedPrsOptions, openPrsOptions, reposOptions } from "@/lib/github/queries";
import type { ActivityItem, ActivityKind } from "@/lib/github/types";
import { useLiveQuery } from "../use-github";

/** Unified activity feed: events + PR/issue open/merge/close, filterable by range. */
export function useActivity(rangeDays: 1 | 7 | 30) {
  const { token, fingerprint: fp } = useAuth();
  const viewer = useViewerUser();
  const login = viewer.data?.login;
  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const eventsQ = useLiveQuery({ ...eventsOptions(token, fp, login) });
  const openPrsQ = useLiveQuery({ ...openPrsOptions(token, fp, login, reposQ.data, "head") });
  const mergedPrsQ = useLiveQuery({ ...mergedPrsOptions(token, fp, login, "head") });
  const issuesQ = useLiveQuery({ ...allIssuesOptions(token, fp, login, "head") });

  const items: ActivityItem[] = useMemo(() => {
    const cutoff = Date.now() - rangeDays * 86_400_000;
    const out: ActivityItem[] = [...(eventsQ.data ?? [])];
    for (const p of [...(openPrsQ.data ?? []), ...(mergedPrsQ.data ?? [])]) {
      const kind: ActivityKind =
        p.state === "merged" ? "pr_merged" : p.state === "closed" ? "pr_closed" : "pr_opened";
      const at = kind === "pr_merged" ? (p.mergedAt ?? p.updatedAt) : p.createdAt;
      out.push({
        id: `pr-${p.id}-${kind}`,
        kind,
        actorLogin: p.authorLogin,
        actorAvatarUrl: p.authorAvatarUrl,
        repoFullName: p.repoFullName,
        title: `PR #${p.number}: ${p.title}`,
        htmlUrl: p.htmlUrl,
        createdAt: at,
      });
      if (p.mergedAt && kind === "pr_merged") {
        // Also count the open event if within range.
        out.push({
          id: `pr-${p.id}-pr_opened`,
          kind: "pr_opened",
          actorLogin: p.authorLogin,
          actorAvatarUrl: p.authorAvatarUrl,
          repoFullName: p.repoFullName,
          title: `PR #${p.number} opened: ${p.title}`,
          htmlUrl: p.htmlUrl,
          createdAt: p.createdAt,
        });
      }
    }
    for (const i of issuesQ.data ?? []) {
      out.push({
        id: `issue-${i.id}-opened`,
        kind: "issue_opened",
        actorLogin: i.authorLogin,
        actorAvatarUrl: i.authorAvatarUrl,
        repoFullName: i.repoFullName,
        title: `Issue #${i.number}: ${i.title}`,
        htmlUrl: i.htmlUrl,
        createdAt: i.createdAt,
      });
      if (i.closedAt) {
        out.push({
          id: `issue-${i.id}-closed`,
          kind: "issue_closed",
          actorLogin: i.authorLogin,
          actorAvatarUrl: i.authorAvatarUrl,
          repoFullName: i.repoFullName,
          title: `Issue #${i.number} closed: ${i.title}`,
          htmlUrl: i.htmlUrl,
          createdAt: i.closedAt,
        });
      }
    }
    const seen = new Set<string>();
    return out
      .filter((e) => new Date(e.createdAt).getTime() >= cutoff)
      .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [eventsQ.data, openPrsQ.data, mergedPrsQ.data, issuesQ.data, rangeDays]);

  return {
    items,
    isLoading: eventsQ.isLoading || openPrsQ.isLoading || issuesQ.isLoading,
    error: (eventsQ.error ?? openPrsQ.error ?? issuesQ.error) as Error | null,
    dataUpdatedAt: Math.max(eventsQ.dataUpdatedAt, openPrsQ.dataUpdatedAt, issuesQ.dataUpdatedAt),
  };
}
