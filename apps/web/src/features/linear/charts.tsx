"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LinearIssue, LinearProject } from "./use-linear";

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
} as const;

const chartColors = ["var(--primary)", "var(--success)", "var(--warning)", "#8b7cf6", "#5aa9e6", "#e07a9a", "#78c091", "#c59bdb"];

type CountDatum = { name: string; count: number; color?: string | null };

function groupedCounts(values: string[], limit = 7): CountDatum[] {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const visible = sorted.slice(0, limit).map(([name, count]) => ({ name, count }));
  const other = sorted.slice(limit).reduce((total, [, count]) => total + count, 0);
  return other ? [...visible, { name: "Other", count: other }] : visible;
}

function ChartEmpty() {
  return <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">No issue data available.</div>;
}

function HorizontalBars({ data }: { data: CountDatum[] }) {
  if (!data.length) return <ChartEmpty />;
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 4 }} barCategoryGap={6}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(value: string) => value.length > 14 ? `${value.slice(0, 13)}…` : value} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} cursor={{ fill: "var(--accent)" }} />
          <Bar dataKey="count" name="Issues" fill="var(--primary)" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function IssueStatusChart({ data }: { data: CountDatum[] }) {
  if (!data.length) return <ChartEmpty />;
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={72} paddingAngle={2} stroke="var(--card)" strokeWidth={2}>
            {data.map((entry, index) => <Cell key={entry.name} fill={entry.color || chartColors[index % chartColors.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LinearAnalytics({ issues, projects }: { issues: LinearIssue[]; projects: LinearProject[] }) {
  const statuses = [...new Map(issues.map((issue) => [issue.state?.name ?? "No status", issue.state?.color])).entries()]
    .map(([name, color]) => ({ name, count: issues.filter((issue) => (issue.state?.name ?? "No status") === name).length, color }));
  const assignees = groupedCounts(issues.map((issue) => issue.assignee?.name ?? "Unassigned"));
  const teams = groupedCounts(issues.map((issue) => issue.team?.key ?? "No team"));
  const projectStatuses = groupedCounts(projects.map((project) => project.state?.name ?? "No status"));

  return (
    <section className="space-y-2" aria-label="Linear analytics">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-sm font-semibold">Work distribution</h2>
          <p className="text-xs text-muted-foreground">Breakdown of the issues and projects currently returned by Linear.</p>
        </div>
        <span className="hidden text-[10px] text-muted-foreground sm:inline">Derived from {issues.length} issues</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-md border border-border bg-card text-card-foreground" data-card-accent="15">
          <div className="px-4 pt-3.5"><h3 className="text-sm font-semibold">Issues by status</h3><p className="text-xs text-muted-foreground">Workflow state distribution</p></div>
          <div className="px-4 pb-4 pt-3"><IssueStatusChart data={statuses} /></div>
        </div>
        <div className="rounded-md border border-border bg-card text-card-foreground" data-card-accent="16">
          <div className="px-4 pt-3.5"><h3 className="text-sm font-semibold">Issues by assignee</h3><p className="text-xs text-muted-foreground">Ownership, including unassigned work</p></div>
          <div className="px-4 pb-4 pt-3"><HorizontalBars data={assignees} /></div>
        </div>
        <div className="rounded-md border border-border bg-card text-card-foreground" data-card-accent="17">
          <div className="px-4 pt-3.5"><h3 className="text-sm font-semibold">Issues by team</h3><p className="text-xs text-muted-foreground">Where the latest work is concentrated</p></div>
          <div className="px-4 pb-4 pt-3"><HorizontalBars data={teams} /></div>
        </div>
        <div className="rounded-md border border-border bg-card text-card-foreground" data-card-accent="18">
          <div className="px-4 pt-3.5"><h3 className="text-sm font-semibold">Projects by status</h3><p className="text-xs text-muted-foreground">Portfolio status across visible projects</p></div>
          <div className="px-4 pb-4 pt-3"><HorizontalBars data={projectStatuses} /></div>
        </div>
      </div>
    </section>
  );
}
