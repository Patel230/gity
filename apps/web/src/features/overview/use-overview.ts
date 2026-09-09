"use client";

import { useMemo, useState } from "react";
import { useAuth, useViewerUser } from "@/lib/auth";
import {
  ciStatesOptions,
  contributionsOptions,
  eventsOptions,
  mergedPrsOptions,
  allIssuesOptions,
  openPrsOptions,
  orgsOptions,
  reposOptions,
  workflowRunsOptions,
} from "@/lib/github/queries";
import { startOfDay, toYMD } from "@/lib/utils";
import { useLiveQuery } from "../use-github";

/**
 * Overview service: loads every dataset the dashboard needs (all deduped
 * by shared query keys) and derives the headline stats + chart series.
 */
export function useOverview() {
  const [now] = useState(() => Date.now());
  const { token, fingerprint: fp } = useAuth();
  const viewer = useViewerUser();
  const login = viewer.data?.login;

  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const orgsQ = useLiveQuery({ ...orgsOptions(token, fp) });
  const openPrsQ = useLiveQuery({ ...openPrsOptions(token, fp, login, reposQ.data, "head") });
  const mergedPrsQ = useLiveQuery({ ...mergedPrsOptions(token, fp, login, "head") });
  const issuesQ = useLiveQuery({ ...allIssuesOptions(token, fp, login, "head") });
  const runsQ = useLiveQuery({ ...workflowRunsOptions(token, fp, reposQ.data) });
  const eventsQ = useLiveQuery({ ...eventsOptions(token, fp, login) });
  const ciQ = useLiveQuery({ ...ciStatesOptions(token, fp, reposQ.data) });
  const contribQ = useLiveQuery({
    ...contributionsOptions(token, fp, login),
    refetchInterval: false as const,
  });

  const stats = useMemo(() => {
    const repos = reposQ.data ?? [];
    const openPrs = openPrsQ.data ?? [];
    const mergedPrs = mergedPrsQ.data ?? [];
    const issues = issuesQ.data ?? [];
    const runs = runsQ.data ?? [];
    const events = eventsQ.data ?? [];

    const today = toYMD(new Date());
    const weekAgo = toYMD(new Date(now - 7 * 86_400_000));

    const mergedToday = mergedPrs.filter(
      (p) => p.mergedAt && toYMD(new Date(p.mergedAt)) === today,
    ).length;
    const mergedWeek = mergedPrs.filter(
      (p) => p.mergedAt && toYMD(new Date(p.mergedAt)) >= weekAgo,
    ).length;
    const issuesClosedToday = issues.filter(
      (i) => i.state === "closed" && i.closedAt && toYMD(new Date(i.closedAt)) === today,
    ).length;

    const ci = { ...(ciQ.data ?? {}) };
    const withCi = repos.map((r) =>
      ci[r.fullName] ? { ...r, ciState: ci[r.fullName] } : r,
    );
    const failingRepos = withCi.filter((r) => r.ciState === "failing");
    const running = runs.filter(
      (r) => r.status === "in_progress" || r.status === "queued",
    );

    const commitsToday = events.filter(
      (e) => (e.kind === "push" || e.kind === "commit") && toYMD(new Date(e.createdAt)) === today,
    ).reduce((n, e) => n + (e.commits ?? 1), 0);

    const activeToday = new Set(
      events
        .filter((e) => toYMD(new Date(e.createdAt)) === today)
        .map((e) => e.repoFullName),
    ).size;

    // Most active repos (last 30d event volume + recent pushes).
    const volume = new Map<string, number>();
    for (const e of events) volume.set(e.repoFullName, (volume.get(e.repoFullName) ?? 0) + 1);
    const mostActive = [...volume.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([fullName, count]) => ({
        repo: repos.find((r) => r.fullName === fullName) ?? null,
        fullName,
        count,
      }));

    // PR activity last 14 days (opened per day) + issue activity (opened/closed per day).
    const prByDay = bucketByDay(
      [...openPrs.map((p) => p.createdAt), ...mergedPrs.map((p) => p.createdAt)],
      14,
    );
    const issuesOpenedByDay = bucketByDay(
      issues.map((i) => i.createdAt),
      14,
    );
    const issuesClosedByDay = bucketByDay(
      issues.filter((i) => i.closedAt).map((i) => i.closedAt as string),
      14,
    );

    const scopeLogins = new Set([
      ...(orgsQ.data ?? []).map((o) => o.login),
      ...repos.map((r) => r.ownerLogin),
    ]);

    return {
      orgCount: scopeLogins.size,
      repoCount: repos.length,
      publicCount: repos.filter((r) => !r.isPrivate).length,
      privateCount: repos.filter((r) => r.isPrivate).length,
      archivedCount: repos.filter((r) => r.isArchived).length,
      openPrs: openPrs.length,
      draftPrs: openPrs.filter((p) => p.isDraft).length,
      mergedToday,
      mergedWeek,
      openIssues: issues.filter((i) => i.state === "open").length,
      issuesClosedToday,
      failingRepos,
      failingCount: failingRepos.length,
      runningCount: running.length,
      commitsToday,
      activeToday,
      mostActive,
      prByDay,
      issuesOpenedByDay,
      issuesClosedByDay,
      withCi,
    };
  }, [reposQ.data, orgsQ.data, openPrsQ.data, mergedPrsQ.data, issuesQ.data, runsQ.data, eventsQ.data, ciQ.data, now]);

  const isLoading =
    reposQ.isLoading || orgsQ.isLoading || openPrsQ.isLoading || issuesQ.isLoading;
  const error =
    reposQ.error ?? orgsQ.error ?? openPrsQ.error ?? mergedPrsQ.error ?? issuesQ.error;

  // Progressive readiness — the page renders each section as its data lands
  // instead of gating everything on the slowest query.
  const ready = {
    core: !reposQ.isLoading && !orgsQ.isLoading && !openPrsQ.isLoading && !issuesQ.isLoading,
    runs: !runsQ.isLoading,
    events: !eventsQ.isLoading,
    ci: !ciQ.isLoading,
    contrib: !contribQ.isLoading,
  };

  const dataUpdatedAt = Math.max(
    reposQ.dataUpdatedAt,
    openPrsQ.dataUpdatedAt,
    issuesQ.dataUpdatedAt,
    runsQ.dataUpdatedAt,
  );

  return {
    viewer: viewer.data,
    stats,
    repos: reposQ.data ?? [],
    events: eventsQ.data ?? [],
    runs: runsQ.data ?? [],
    openPrs: openPrsQ.data ?? [],
    contributions: contribQ.data ?? [],
    isLoading,
    ready,
    error: error as Error | null,
    dataUpdatedAt,
    refetch: () => {
      void reposQ.refetch();
      void openPrsQ.refetch();
      void mergedPrsQ.refetch();
      void issuesQ.refetch();
      void runsQ.refetch();
      void eventsQ.refetch();
    },
  };
}

function bucketByDay(dates: string[], days: number): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of dates) {
    try {
      const k = toYMD(new Date(d));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    } catch {
      /* ignore */
    }
  }
  const out: { date: string; count: number }[] = [];
  const today = startOfDay(new Date());
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = toYMD(d);
    out.push({ date: k.slice(5), count: counts.get(k) ?? 0 });
  }
  return out;
}
