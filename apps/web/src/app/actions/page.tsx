"use client";

import { CheckCircle2, Clock, Loader, XCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/error-state";
import { StatCard, StatCardLoading } from "@/components/common/stat-card";
import { PageHead } from "@/components/layout/page-head";
import { useActions } from "@/features/actions/use-actions";
import type { GithubWorkflowRun } from "@/lib/github/types";
import { timeAgo } from "@/lib/utils";

export default function ActionsPage() {
  const { failed, running, queued, succeeded, latestPerRepo, isLoading, error } = useActions();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHead title="Actions" sub="Loading workflow runs…" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardLoading key={i} />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-4">
      <PageHead title="Actions" sub="Latest workflow run per repo · failed first · click to open on GitHub" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Failed" value={failed.length} icon={XCircle} tone={failed.length ? "destructive" : "default"} />
        <StatCard label="Running" value={running.length} icon={Loader} tone="info" />
        <StatCard label="Queued" value={queued.length} icon={Clock} tone="warning" />
        <StatCard label="Successful" value={succeeded.length} icon={CheckCircle2} tone="success" />
      </div>

      {(running.length > 0 || queued.length > 0) && (
        <Card accent={18}>
          <CardHeader>
            <CardTitle>Running now</CardTitle>
            <CardDescription>{running.length} in progress · {queued.length} queued</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {[...running, ...queued].slice(0, 10).map((r) => (
              <RunRow key={r.id} run={r} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card accent={19}>
        <CardHeader>
          <CardTitle>Recent completed runs by repository</CardTitle>
          <CardDescription>{latestPerRepo.length} repos with workflow data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {latestPerRepo.length === 0 && (
            <EmptyState title="No workflow runs found" hint="Repos need Actions runs visible to your token. The token needs Actions: read." />
          )}
          {latestPerRepo.map((r) => (
            <RunRow key={`${r.repoFullName}-${r.id}`} run={r} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function RunRow({ run }: { run: GithubWorkflowRun }) {
  return (
    <div className="flex items-center gap-2 rounded px-1.5 py-1.5 text-xs hover:bg-accent">
      <StatusIcon run={run} />
      <span className="min-w-0 flex-1">
        <a href={run.htmlUrl} target="_blank" rel="noopener" className="block truncate font-medium hover:text-[var(--primary)] hover:underline">
          {run.workflowName} <span className="font-mono text-muted-foreground">#{run.runNumber}</span>
        </a>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          <Link href={`/map?repo=${encodeURIComponent(run.repoFullName)}`} className="hover:text-[var(--primary)] hover:underline" title="Open repository dossier">{run.repoFullName}</Link> · {run.branch} · {run.event} · by {run.actorLogin}
        </span>
      </span>
      <a href={run.htmlUrl} target="_blank" rel="noopener" aria-label={`Open ${run.workflowName} run ${run.runNumber} on GitHub`}><StatusBadge run={run} /></a>
      <span className="hidden w-16 shrink-0 text-right text-[11px] text-muted-foreground sm:inline">
        {timeAgo(run.updatedAt)}
      </span>
    </div>
  );
}

function StatusIcon({ run }: { run: GithubWorkflowRun }) {
  if (run.status === "in_progress") return <Loader className="size-4 shrink-0 animate-spin text-[var(--primary)]" />;
  if (run.status === "queued") return <Clock className="size-4 shrink-0 text-[var(--warning)]" />;
  if (run.conclusion === "success") return <CheckCircle2 className="size-4 shrink-0 text-[var(--success)]" />;
  if (run.conclusion === "failure" || run.conclusion === "timed_out")
    return <XCircle className="size-4 shrink-0 text-[var(--destructive)]" />;
  return <Clock className="size-4 shrink-0 text-muted-foreground" />;
}

function StatusBadge({ run }: { run: GithubWorkflowRun }) {
  if (run.status === "in_progress") return <Badge variant="info">running</Badge>;
  if (run.status === "queued") return <Badge variant="warning">queued</Badge>;
  if (run.conclusion === "success") return <Badge variant="success">success</Badge>;
  if (run.conclusion === "failure" || run.conclusion === "timed_out")
    return <Badge variant="destructive">{run.conclusion === "timed_out" ? "timed out" : "failed"}</Badge>;
  return <Badge variant="outline">{run.conclusion ?? run.status}</Badge>;
}
