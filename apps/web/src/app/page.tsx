"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CircleDot,
  Database,
  Flame,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  Play,
  Zap,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CiDot } from "@/components/common/ci-dot";
import { EmptyState, ErrorState } from "@/components/common/error-state";
import { Heatmap } from "@/components/common/heatmap";
import { RateLimitPanel } from "@/components/common/rate-limit";
import { StatCard, StatCardLoading } from "@/components/common/stat-card";
import { useOverview } from "@/features/overview/use-overview";
import { IssueActivityChart, PrActivityChart } from "@/features/overview/charts";
import { useStreak } from "@/features/streak/use-streak";
import { timeAgo } from "@/lib/utils";

export default function OverviewPage() {
  const ov = useOverview();
  const streak = useStreak();

  // Core failure (repos/orgs/PRs/issues) blocks the whole page; everything
  // else degrades to per-section skeletons via `ready` flags.
  if (!ov.ready.core && ov.error) return <ErrorState error={ov.error} onRetry={ov.refetch} />;
  if (!ov.ready.core) return <OverviewLoading />;

  const s = ov.stats;
  const num = (v: number, ok: boolean): string | number => (ok ? v : "…");
  return (
    <div className="space-y-4">
      <PageHead title="Overview" sub="Everything happening across your GitHub, right now." />

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Organizations" value={s.orgCount} icon={Building2} accent={1} />
        <StatCard label="Repositories" value={s.repoCount} sub={`${s.publicCount} public · ${s.privateCount} private · ${s.archivedCount} archived`} icon={Database} accent={2} />
        <StatCard label="Open PRs" value={s.openPrs} sub={`${s.draftPrs} drafts`} icon={GitPullRequest} tone="info" accent={3} />
        <StatCard label="Merged today" value={s.mergedToday} sub={`${s.mergedWeek} this week`} icon={GitMerge} tone="success" accent={4} />
        <StatCard label="Open issues" value={s.openIssues} sub={`${s.issuesClosedToday} closed today`} icon={CircleDot} tone="warning" accent={5} />
        <StatCard label="Failing CI" value={num(s.failingCount, ov.ready.ci)} sub={ov.ready.ci ? (s.failingCount ? "needs attention" : "all green") : "checking…"} icon={AlertTriangle} tone={s.failingCount && ov.ready.ci ? "destructive" : "success"} accent={6} />
        <StatCard label="Workflows running" value={num(s.runningCount, ov.ready.runs)} icon={Play} tone="info" accent={7} />
        <StatCard label="Commits today" value={num(s.commitsToday, ov.ready.events)} icon={GitCommitHorizontal} accent={8} />
        <StatCard label="Active repos today" value={num(s.activeToday, ov.ready.events)} icon={Zap} accent={9} />
        <Link href="/streak">
          <StatCard label="Gity streak" value={`${streak.streak.current}d`} sub={streak.streak.todayActive ? `active today (${streak.streak.todayCount})` : "not active yet today"} icon={Flame} tone="warning" accent={10} />
        </Link>
      </div>

      {/* Charts */}
      <div className="grid gap-2 lg:grid-cols-2">
        <Card accent={11}>
          <CardHeader>
            <CardTitle>PR activity</CardTitle>
            <CardDescription>PRs opened per day · last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <PrActivityChart data={s.prByDay} />
          </CardContent>
        </Card>
        <Card accent={12}>
          <CardHeader>
            <CardTitle>Issue activity</CardTitle>
            <CardDescription>Opened vs closed per day · last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <IssueActivityChart opened={s.issuesOpenedByDay} closed={s.issuesClosedByDay} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        {/* Heatmap */}
        <Card accent={13} className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activity heatmap</CardTitle>
            <CardDescription>Contributions per day · last 26 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            {ov.ready.contrib ? (
              ov.contributions.length ? (
                <Heatmap days={ov.contributions} weeks={26} />
              ) : (
                <EmptyState title="No contribution data" hint="The contributions endpoint may be blocked for this token." />
              )
            ) : (
              <Skeleton className="h-28 w-full" />
            )}
          </CardContent>
        </Card>
        {/* CI health */}
        <Card accent={14}>
          <CardHeader>
            <CardTitle>CI health</CardTitle>
            <CardDescription>Default-branch status · recently pushed repos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!ov.ready.ci ? (
              <Skeleton className="h-24 w-full" />
            ) : s.failingRepos.length === 0 ? (
              <EmptyState title="No failing repos" hint="Checked the most recently pushed repos." />
            ) : (
              s.failingRepos.slice(0, 6).map((r) => (
                <a key={r.fullName} href={r.htmlUrl} target="_blank" rel="noopener" className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-accent">
                  <CiDot state={r.ciState} />
                  <span className="truncate font-mono">{r.fullName}</span>
                </a>
              ))
            )}
            <Link href="/actions" className="block pt-1 text-xs text-[var(--primary)] hover:underline">
              View all workflows →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        {/* Most active repos */}
        <Card accent={15}>
          <CardHeader>
            <CardTitle>Most active repos</CardTitle>
            <CardDescription>By recent event volume</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {s.mostActive.length === 0 && <EmptyState title="No recent activity" />}
            {s.mostActive.map((a) => (
              <a key={a.fullName} href={a.repo?.htmlUrl ?? `https://github.com/${a.fullName}`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-accent">
                <Avatar src={a.repo?.ownerAvatarUrl} alt={a.fullName} className="size-5" />
                <span className="min-w-0 flex-1 truncate font-mono">{a.fullName}</span>
                <Badge variant="default">{a.count}</Badge>
              </a>
            ))}
          </CardContent>
        </Card>
        {/* Recent activity */}
        <Card accent={16} className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest events across your GitHub</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {!ov.ready.events ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
            {ov.events.length === 0 && <EmptyState title="No recent events" />}
            {ov.events.slice(0, 10).map((e) => (
              <a key={e.id} href={e.htmlUrl} target="_blank" rel="noopener" className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-accent">
                <Avatar src={e.actorAvatarUrl} alt={e.actorLogin} className="size-5" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{e.actorLogin}</span>{" "}
                  <span className="text-muted-foreground">{e.title}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{e.repoFullName}</span>
                <span className="hidden w-16 shrink-0 text-right text-[11px] text-muted-foreground sm:inline">{timeAgo(e.createdAt)}</span>
              </a>
            ))}
            <Link href="/activity" className="block pt-1 text-xs text-[var(--primary)] hover:underline">
              Full activity feed →
            </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card accent={17}>
        <CardHeader>
          <CardTitle>Rate limits</CardTitle>
          <CardDescription>Live budget from GitHub response headers</CardDescription>
        </CardHeader>
        <CardContent>
          <RateLimitPanel />
        </CardContent>
      </Card>
    </div>
  );
}

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
      <div className="relative pl-3">
        <span className="absolute bottom-0 left-0 top-0 w-0.5 rounded-full bg-primary" />
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]">gity / {title.toLowerCase()}</p>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

function OverviewLoading() {
  return (
    <div className="space-y-4">
      <PageHead title="Overview" sub="Loading your GitHub…" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <StatCardLoading key={i} />
        ))}
      </div>
    </div>
  );
}
