"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CircleDot,
  Database,
  Flame,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  Map as MapIcon,
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
import { ageInDays, cn, timeAgo } from "@/lib/utils";
import type { GithubPullRequest, GithubRepo, GithubWorkflowRun } from "@/lib/github/types";
import { PageHead } from "@/components/layout/page-head";

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
      <PageHead
        title="Overview"
        sub="Everything happening across your GitHub, right now."
        right={<Link href="/map" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-xs font-medium transition-colors hover:border-primary/60 hover:bg-accent"><MapIcon className="size-3.5 text-[var(--primary)]" />Open system map</Link>}
      />

      <FocusQueue
        failingRepos={s.failingRepos}
        openPrs={ov.openPrs}
        runs={ov.runs}
        runsReady={ov.ready.runs}
      />

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
                <Link key={r.fullName} href={`/map?repo=${encodeURIComponent(r.fullName)}`} className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-accent">
                  <CiDot state={r.ciState} />
                  <span className="truncate font-mono">{r.fullName}</span>
                </Link>
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
            {s.mostActive.map((a) => {
              const content = <><Avatar src={a.repo?.ownerAvatarUrl} alt={a.fullName} className="size-5" /><span className="min-w-0 flex-1 truncate font-mono">{a.fullName}</span><Badge variant="default">{a.count}</Badge></>;
              return a.repo ? <Link key={a.fullName} href={`/map?repo=${encodeURIComponent(a.fullName)}`} className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-accent">{content}</Link> : <a key={a.fullName} href={`https://github.com/${a.fullName}`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-accent">{content}</a>;
            })}
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

function FocusQueue({ failingRepos, openPrs, runs, runsReady }: { failingRepos: GithubRepo[]; openPrs: GithubPullRequest[]; runs: GithubWorkflowRun[]; runsReady: boolean }) {
  const items: FocusItem[] = [];
  failingRepos.slice(0, 2).forEach((repo) => {
    items.push({
      label: "Fix failing CI",
      detail: repo.fullName,
      href: `/map?repo=${encodeURIComponent(repo.fullName)}`,
      tone: "danger",
      icon: AlertTriangle,
    });
  });
  openPrs
    .filter((pr) => pr.reviewRequested || pr.reviewState === "review_required" || pr.reviewState === "changes_requested")
    .slice(0, 2)
    .forEach((pr) => {
      items.push({
        label: pr.reviewState === "changes_requested" ? "Resolve requested changes" : "Review requested",
        detail: `#${pr.number} · ${pr.repoFullName}`,
        href: pr.htmlUrl,
        tone: "warning",
        icon: GitPullRequest,
        external: true,
      });
    });
  if (runsReady) {
    runs
      .filter((run) => run.status === "in_progress" || run.status === "queued")
      .slice(0, 2)
      .forEach((run) => {
        items.push({
          label: run.status === "queued" ? "Watch queued workflow" : "Watch running workflow",
          detail: `${run.repoFullName} · ${run.workflowName}`,
          href: run.htmlUrl,
          tone: "active",
          icon: Play,
          external: true,
        });
      });
  }
  if (items.length < 4) {
    openPrs
      .filter((pr) => (pr.state === "open" || pr.state === "draft") && ageInDays(pr.updatedAt) >= 14)
      .sort((a, b) => ageInDays(b.updatedAt) - ageInDays(a.updatedAt))
      .slice(0, 4 - items.length)
      .forEach((pr) => {
        items.push({
          label: "Unblock a stale PR",
          detail: `#${pr.number} · ${pr.repoFullName} · ${Math.floor(ageInDays(pr.updatedAt))}d quiet`,
          href: pr.htmlUrl,
          tone: "muted",
          icon: GitPullRequest,
          external: true,
        });
      });
  }
  const visible = items.slice(0, 4);

  return (
    <Card accent={18} className="overflow-hidden">
      <CardContent className="flex flex-col gap-3 pt-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 lg:w-52 lg:shrink-0">
          <span className="grid size-8 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]"><Zap className="size-4" /></span>
          <span><span className="block text-xs font-semibold">Focus queue</span><span className="block text-[10px] text-muted-foreground">The next useful things to look at</span></span>
        </div>
        {visible.length ? (
          <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
            {visible.map((item) => <FocusItemRow key={`${item.label}-${item.detail}`} item={item} />)}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[color-mix(in_srgb,var(--success)_6%,transparent)] px-3 py-2"><CheckCircle2 className="size-4 text-[var(--success)]" /><span className="text-xs text-[var(--success)]">No urgent signals. Your workspace is in a good place.</span></div>
        )}
      </CardContent>
    </Card>
  );
}

type FocusItem = { label: string; detail: string; href: string; tone: "danger" | "warning" | "active" | "muted"; icon: typeof AlertTriangle; external?: boolean };

function FocusItemRow({ item }: { item: FocusItem }) {
  const Icon = item.icon;
  const tone = item.tone === "danger" ? "text-[var(--destructive)]" : item.tone === "warning" ? "text-[var(--warning)]" : item.tone === "active" ? "text-[var(--primary)]" : "text-muted-foreground";
  const content = <><span className={cn("grid size-6 shrink-0 place-items-center rounded bg-accent", tone)}><Icon className="size-3.5" /></span><span className="min-w-0 flex-1"><span className={cn("block truncate text-[10px] font-medium", tone)}>{item.label}</span><span className="block truncate font-mono text-[10px] text-muted-foreground">{item.detail}</span></span>{item.external ? <ArrowUpRight className="size-3 shrink-0 text-muted-foreground" /> : <ArrowRight className="size-3 shrink-0 text-muted-foreground" />}</>;
  const className = "group flex min-w-0 items-center gap-2 rounded-md border border-border/70 bg-background/25 px-2 py-1.5 transition hover:border-primary/60 hover:bg-accent";
  return item.external ? <a href={item.href} target="_blank" rel="noopener" className={className}>{content}</a> : <Link href={item.href} className={className}>{content}</Link>;
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
