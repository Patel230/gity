"use client";

import { useMemo, useState } from "react";
import {
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  Tag,
  CircleDot,
  Eye,
  XCircle,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/common/error-state";
import { PageHead } from "@/components/layout/page-head";
import { useActivity } from "@/features/activity/use-activity";
import type { ActivityKind } from "@/lib/github/types";
import { timeAgo } from "@/lib/utils";

const KIND_META: Record<ActivityKind, { icon: typeof GitCommitHorizontal; label: string; tone: "success" | "info" | "warning" | "destructive" | "default" }> = {
  push: { icon: GitCommitHorizontal, label: "push", tone: "default" },
  commit: { icon: GitCommitHorizontal, label: "commit", tone: "default" },
  pr_opened: { icon: GitPullRequest, label: "PR opened", tone: "success" },
  pr_merged: { icon: GitMerge, label: "PR merged", tone: "info" },
  pr_closed: { icon: XCircle, label: "PR closed", tone: "destructive" },
  issue_opened: { icon: CircleDot, label: "issue opened", tone: "warning" },
  issue_closed: { icon: CircleDot, label: "issue closed", tone: "info" },
  review: { icon: Eye, label: "review", tone: "info" },
  release: { icon: Tag, label: "release", tone: "success" },
  other: { icon: GitCommitHorizontal, label: "activity", tone: "default" },
};

export default function ActivityPage() {
  const [range, setRange] = useState<"1" | "7" | "30">("7");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const { items, isLoading, error } = useActivity(range === "1" ? 1 : range === "7" ? 7 : 30);

  const kinds = useMemo(() => [...new Set(items.map((i) => i.kind))].sort(), [items]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (kind !== "all" && i.kind !== kind) return false;
      if (needle && !`${i.title} ${i.repoFullName} ${i.actorLogin}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [items, kind, q]);

  // Group by day.
  const groups = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const day = new Date(r.createdAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      const arr = map.get(day) ?? [];
      arr.push(r);
      map.set(day, arr);
    }
    return [...map.entries()];
  }, [rows]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHead title="Activity" sub="Loading…" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-3">
      <PageHead title="Activity" sub={`${rows.length} events · unified feed across pushes, PRs, issues, reviews, releases`} />
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={range} onValueChange={(v) => setRange(v as "1" | "7" | "30")}>
          <TabsList>
            <TabsTrigger value="1">Today</TabsTrigger>
            <TabsTrigger value="7">7 days</TabsTrigger>
            <TabsTrigger value="30">30 days</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={kind} onValueChange={setKind}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {kinds.map((k) => (
              <TabsTrigger key={k} value={k}>{KIND_META[k].label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter feed…" className="w-44" />
      </div>
      {rows.length === 0 && (
        <EmptyState title="No activity in range" hint="Try a wider range, or check token permissions for events." />
      )}
      {groups.map(([day, list], index) => (
        <div key={day}>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{day}</p>
          <Card accent={(index % 20) + 1}>
            <CardContent className="space-y-0.5 pt-3">
              {list.map((e) => {
                const meta = KIND_META[e.kind];
                const Icon = meta.icon;
                return (
                  <a key={e.id} href={e.htmlUrl} target="_blank" rel="noopener" className="flex items-center gap-2.5 rounded px-1.5 py-1.5 text-xs hover:bg-accent">
                    <Avatar src={e.actorAvatarUrl} alt={e.actorLogin} className="size-5" />
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{e.actorLogin}</span>{" "}
                      <span className="text-muted-foreground">{e.title}</span>
                    </span>
                    <Badge variant={meta.tone}>{meta.label}</Badge>
                    <span className="hidden w-36 shrink-0 truncate text-right font-mono text-[11px] text-muted-foreground sm:inline">{e.repoFullName}</span>
                    <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground">{timeAgo(e.createdAt)}</span>
                  </a>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
