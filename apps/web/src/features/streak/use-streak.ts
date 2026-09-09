"use client";

import { useMemo } from "react";
import { useAuth, useViewerUser } from "@/lib/auth";
import {
  allIssuesOptions,
  contributionsOptions,
  eventsOptions,
  mergedPrsOptions,
  openPrsOptions,
  reposOptions,
} from "@/lib/github/queries";
import { toYMD } from "@/lib/utils";
import { useLiveQuery } from "../use-github";

/**
 * Gity Activity Streak — custom to Gity, may not match GitHub's graph.
 * Active day = ≥1 of: commit/push, PR opened, PR merged, issue opened,
 * issue closed, code review. Built from the contribution calendar plus
 * today's live events (the calendar API lags by up to ~24h).
 */
export function useStreak() {
  const { token, fingerprint: fp } = useAuth();
  const viewer = useViewerUser();
  const login = viewer.data?.login;

  const contribQ = useLiveQuery({ ...contributionsOptions(token, fp, login) });
  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const eventsQ = useLiveQuery({ ...eventsOptions(token, fp, login) });
  const openPrsQ = useLiveQuery({ ...openPrsOptions(token, fp, login, reposQ.data, "head") });
  const mergedPrsQ = useLiveQuery({ ...mergedPrsOptions(token, fp, login, "head") });
  const issuesQ = useLiveQuery({ ...allIssuesOptions(token, fp, login, "head") });

  const streak = useMemo(() => {
    const active = new Map<string, number>();
    for (const d of contribQ.data ?? []) {
      if (d.count > 0) active.set(d.date, (active.get(d.date) ?? 0) + d.count);
    }
    // Overlay live events (covers today + anything the calendar hasn't indexed).
    const bump = (iso: string | null) => {
      if (!iso) return;
      const k = toYMD(new Date(iso));
      active.set(k, (active.get(k) ?? 0) + 1);
    };
    for (const e of eventsQ.data ?? []) {
      if (["push", "commit", "pr_opened", "pr_merged", "issue_opened", "issue_closed", "review"].includes(e.kind))
        bump(e.createdAt);
    }
    for (const p of [...(openPrsQ.data ?? []), ...(mergedPrsQ.data ?? [])]) {
      bump(p.createdAt);
      bump(p.mergedAt);
    }
    for (const i of issuesQ.data ?? []) {
      bump(i.createdAt);
      bump(i.closedAt);
    }

    const today = toYMD(new Date());
    const days: { date: string; count: number }[] = [...active.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const activeSet = new Set(days.map((d) => d.date));

    // Current streak: count back from today (today may still be inactive).
    let cursor = new Date();
    if (!activeSet.has(toYMD(cursor))) cursor.setDate(cursor.getDate() - 1);
    let current = 0;
    while (activeSet.has(toYMD(cursor))) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // Longest streak in fetched history.
    let longest = 0;
    let run = 0;
    let prev: string | null = null;
    for (const d of days) {
      if (prev) {
        const diff =
          (new Date(d.date).getTime() - new Date(prev).getTime()) / 86_400_000;
        run = diff === 1 ? run + 1 : 1;
      } else {
        run = 1;
      }
      longest = Math.max(longest, run);
      prev = d.date;
    }

    const inLast = (n: number) => {
      const cutoff = toYMD(new Date(Date.now() - (n - 1) * 86_400_000));
      return days.filter((d) => d.date >= cutoff);
    };
    const last30 = inLast(30);
    const last365 = inLast(365);

    return {
      current,
      longest,
      active30: last30.length,
      active365: last365.length,
      totalActive: days.length,
      totalContributions: days.reduce((n, d) => n + d.count, 0),
      days,
      todayActive: activeSet.has(today),
      todayCount: active.get(today) ?? 0,
    };
  }, [contribQ.data, eventsQ.data, openPrsQ.data, mergedPrsQ.data, issuesQ.data]);

  return {
    streak,
    isLoading: contribQ.isLoading,
    error: contribQ.error as Error | null,
    dataUpdatedAt: contribQ.dataUpdatedAt,
  };
}
