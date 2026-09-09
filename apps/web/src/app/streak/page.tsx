"use client";

import { CalendarCheck2, Flame, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState } from "@/components/common/error-state";
import { Heatmap } from "@/components/common/heatmap";
import { StatCard, StatCardLoading } from "@/components/common/stat-card";
import { PageHead } from "@/components/layout/page-head";
import { useStreak } from "@/features/streak/use-streak";

export default function StreakPage() {
  const { streak: s, isLoading, error } = useStreak();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHead title="Gity Activity Streak" sub="Loading contribution history…" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardLoading key={i} />
          ))}
        </div>
      </div>
    );
  }
  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-4">
      <PageHead
        title="Gity Activity Streak"
        sub="Custom to Gity — an active day is any day with a commit, PR opened/merged, issue opened/closed, or review. May not exactly match GitHub's contribution graph."
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Current streak" value={`${s.current} day${s.current === 1 ? "" : "s"}`} sub={s.todayActive ? `active today (${s.todayCount})` : "not active yet today"} icon={Flame} tone="warning" />
        <StatCard label="Longest streak" value={`${s.longest} day${s.longest === 1 ? "" : "s"}`} sub="in fetched history" icon={Trophy} tone="info" />
        <StatCard label="Active · last 30d" value={`${s.active30}/30`} icon={CalendarCheck2} />
        <StatCard label="Active · last 365d" value={s.active365} sub={`${s.totalContributions.toLocaleString()} contributions`} icon={CalendarCheck2} tone="success" />
      </div>

      <Card accent={20}>
        <CardHeader>
          <CardTitle>Last 30 days</CardTitle>
          <CardDescription>{s.active30} of 30 days active</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={(s.active30 / 30) * 100} />
        </CardContent>
      </Card>

      <Card accent={11}>
        <CardHeader>
          <CardTitle>Contributions by day</CardTitle>
          <CardDescription>Last 52 weeks · from GitHub's contribution calendar overlaid with today's live events</CardDescription>
        </CardHeader>
        <CardContent>
          {s.days.length === 0 ? (
            <EmptyState title="No contribution data" hint="The token needs read access to contribution data." />
          ) : (
            <Heatmap days={s.days} weeks={52} cell={10} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
