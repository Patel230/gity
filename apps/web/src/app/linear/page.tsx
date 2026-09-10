"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDot, ExternalLink, FileText, Layers3, LogOut, Timer, UserRoundX, Users, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/common/error-state";
import { FilterSelect, allOption, textOptions } from "@/components/common/filter-select";
import { PageHead } from "@/components/layout/page-head";
import { StatCard, StatCardLoading } from "@/components/common/stat-card";
import { useLinear } from "@/features/linear/use-linear";
import { LinearAnalytics } from "@/features/linear/charts";
import { timeAgo } from "@/lib/utils";

function projectStatusStyle(type?: string) {
  const colors: Record<string, string> = {
    backlog: "#8b7cf6",
    planned: "#5aa9e6",
    started: "#dbc66f",
    paused: "#e07a9a",
    completed: "#7dd3a8",
    canceled: "#f04848",
  };
  const color = colors[type ?? ""] ?? "#8b7cf6";
  return { borderColor: `${color}88`, backgroundColor: `${color}1f`, color };
}

function priorityLabel(priority?: number) {
  return ({ 1: "Urgent", 2: "High", 3: "Medium", 4: "Low" } as Record<number, string>)[priority ?? 0] ?? "No priority";
}

function priorityVariant(priority?: number): "outline" | "info" | "warning" | "destructive" {
  if (priority === 1) return "destructive";
  if (priority === 2) return "warning";
  if (priority === 3) return "info";
  return "outline";
}

function dueLabel(date: string) {
  return `due ${date.slice(5)}`;
}

export default function LinearPage() {
  const { session, data, isLoading, dataLoading, error, disconnect } = useLinear();
  const searchParams = useSearchParams();
  const [teamFilter, setTeamFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const visibleIssues = useMemo(() => (data?.issues ?? []).filter((issue) => {
    const matchesTeam = teamFilter === "all" || issue.team?.key === teamFilter;
    const matchesAssignee = assigneeFilter === "all" || (issue.assignee?.name ?? "Unassigned") === assigneeFilter;
    return matchesTeam && matchesAssignee;
  }), [data?.issues, teamFilter, assigneeFilter]);
  const activeIssues = visibleIssues.filter((issue) => !["completed", "canceled"].includes(issue.state?.type ?? ""));
  const snapshotDate = data ? new Date(data.fetchedAt).toISOString().slice(0, 10) : "";
  const snapshotTime = data?.fetchedAt ?? 0;
  const urgentIssues = visibleIssues.filter((issue) => issue.priority === 1 || issue.priority === 2);
  const overdueIssues = visibleIssues.filter((issue) => issue.dueDate && issue.dueDate < snapshotDate && !["completed", "canceled"].includes(issue.state?.type ?? ""));
  const dueSoonIssues = visibleIssues.filter((issue) => {
    if (!issue.dueDate || ["completed", "canceled"].includes(issue.state?.type ?? "")) return false;
    const due = new Date(`${issue.dueDate}T23:59:59`).getTime();
    return due >= snapshotTime && due <= snapshotTime + 7 * 24 * 60 * 60 * 1000;
  });
  const unassignedIssues = visibleIssues.filter((issue) => !issue.assignee);
  const myTimesheet = useMemo(() => data?.documents.find((document) => /timesheet/i.test(document.title) && (!document.creator || !data.viewer || document.creator.name === data.viewer.name)) ?? data?.documents.find((document) => /timesheet/i.test(document.title)), [data]);
  const teamOptions = useMemo(() => [allOption("teams"), ...(data ? textOptions(data.teams.map((team) => team.key), "teams").slice(1).map((option) => ({ ...option, label: `${option.value} · ${data.teams.find((team) => team.key === option.value)?.name ?? option.value}` })) : [])], [data]);
  const assigneeOptions = useMemo(() => [allOption("contributors"), ...(data ? textOptions(data.issues.map((issue) => issue.assignee?.name ?? "Unassigned"), "contributors").slice(1) : [])], [data]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setDisconnectError(null);
    try { await disconnect(); } catch (err) { setDisconnectError(err instanceof Error ? err.message : "Unable to disconnect Linear."); } finally { setDisconnecting(false); }
  };

  if (isLoading) return <div className="space-y-4"><PageHead title="Linear" sub="Loading your Linear workspace…" /><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <StatCardLoading key={index} />)}</div><Card><CardContent className="h-64 animate-pulse" /></Card></div>;
  if (error && !session) return <ErrorState error={error} />;
  if (!session?.configured || !session.connected) return <ConnectionCard configured={session?.configured ?? false} status={searchParams.get("linear")} />;
  if (!data && dataLoading) return <div className="space-y-4"><PageHead title="Linear" sub="Loading your Linear workspace…" /><Card><CardContent className="h-64 animate-pulse" /></Card></div>;
  if (error || !data) return <ErrorState error={error ?? new Error("Linear data is unavailable.")} />;

  return <div className="space-y-4">
    <PageHead title="Linear" sub={`${data.teams.length} teams · ${data.projects.length} projects · read-only workspace view`} right={<Badge variant="success"><CheckCircle2 className="size-3" /> connected</Badge>} />
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><StatCard label="Teams" value={data.teams.length} icon={Users} /><StatCard label="Projects" value={data.projects.length} icon={Layers3} /><StatCard label="Active issues" value={activeIssues.length} icon={CircleDot} tone="info" /><StatCard label="Updated issues" value={visibleIssues.length} icon={Workflow} /><StatCard label="Urgent / high" value={urgentIssues.length} sub="needs attention" icon={AlertTriangle} tone={urgentIssues.length ? "destructive" : "success"} /><StatCard label="Due next 7 days" value={dueSoonIssues.length} sub={`${overdueIssues.length} overdue`} icon={CalendarClock} tone={overdueIssues.length ? "warning" : "default"} /><StatCard label="Unassigned" value={unassignedIssues.length} sub="needs an owner" icon={UserRoundX} tone={unassignedIssues.length ? "warning" : "success"} /><StatCard label="In cycles" value={visibleIssues.filter((issue) => issue.cycle?.name).length} sub="scheduled work" icon={Timer} tone="info" /></div>
    <Card accent={12}><CardContent className="flex flex-col gap-2 pt-3 sm:flex-row sm:items-center"><FilterSelect value={teamFilter} onChange={setTeamFilter} label="Teams" options={teamOptions} wide /><FilterSelect value={assigneeFilter} onChange={setAssigneeFilter} label="Contributors" options={assigneeOptions} wide /><span className="text-xs text-muted-foreground">Showing the latest 100 issues returned by Linear.</span><div className="flex-1" /><Button size="sm" variant="secondary" disabled={disconnecting} onClick={handleDisconnect}><LogOut className="size-3.5" /> {disconnecting ? "Disconnecting…" : "Disconnect"}</Button></CardContent></Card>
    {disconnectError ? <p className="text-xs text-[var(--destructive)]">{disconnectError}</p> : null}
    <LinearAnalytics issues={visibleIssues} projects={data.projects} />
    <Card accent={19}><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-4 text-[var(--primary)]" /> My timesheet</CardTitle><CardDescription>Read-only shortcut to your timesheet document in Linear.</CardDescription></CardHeader><CardContent>{myTimesheet ? <a href={myTimesheet.url} target="_blank" rel="noopener" className="flex items-center gap-2 rounded border border-border bg-background/30 px-3 py-2 text-xs hover:bg-accent"><FileText className="size-3.5 shrink-0 text-[var(--primary)]" /><span className="min-w-0 flex-1 truncate">{myTimesheet.title}</span><span className="shrink-0 text-[10px] text-muted-foreground">updated {timeAgo(myTimesheet.updatedAt)}</span><ExternalLink className="size-3 shrink-0 text-muted-foreground" /></a> : <p className="text-xs text-muted-foreground">No timesheet document was found in the latest Linear documents.</p>}</CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]"><Card accent={13}><CardHeader><CardTitle>Projects</CardTitle><CardDescription>Projects visible in the connected Linear workspace.</CardDescription></CardHeader><CardContent className="space-y-1">{data.projects.length ? data.projects.map((project) => <a key={project.id} href={project.url} target="_blank" rel="noopener" className="flex items-center gap-2 rounded px-1.5 py-2 text-xs hover:bg-accent"><Layers3 className="size-3.5 shrink-0 text-[var(--primary)]" /><span className="min-w-0 flex-1 truncate">{project.name}</span><Badge variant="outline" style={projectStatusStyle(project.state?.type)}>{project.state?.name ?? "No state"}</Badge><ExternalLink className="size-3 text-muted-foreground" /></a>) : <EmptyState title="No projects found" hint="This workspace has no visible projects." />}</CardContent></Card><Card accent={14}><CardHeader><CardTitle>Recent issues</CardTitle><CardDescription>Most recently updated issues, with ownership, priority, cycle, and workflow state.</CardDescription></CardHeader><CardContent className="space-y-1">{visibleIssues.length ? visibleIssues.map((issue) => <a key={issue.id} href={issue.url} target="_blank" rel="noopener" className="flex items-center gap-2 rounded px-1.5 py-2 text-xs hover:bg-accent"><span className="w-16 shrink-0 font-mono text-[10px] text-[var(--primary)]">{issue.identifier}</span><span className="min-w-0 flex-1 truncate">{issue.title}</span>{issue.priority ? <Badge variant={priorityVariant(issue.priority)}>{priorityLabel(issue.priority)}</Badge> : null}{issue.cycle?.name ? <span className="hidden max-w-24 truncate text-[10px] text-muted-foreground xl:inline">{issue.cycle.name}</span> : null}{issue.dueDate ? <span className={`hidden shrink-0 text-[10px] sm:inline ${overdueIssues.some((item) => item.id === issue.id) ? "text-[var(--destructive)]" : "text-muted-foreground"}`}>{dueLabel(issue.dueDate)}</span> : null}<Badge variant={issue.state?.type === "completed" ? "success" : issue.state?.type === "canceled" ? "outline" : "info"}>{issue.state?.name ?? "Unknown"}</Badge><span className="hidden w-14 shrink-0 text-right text-[10px] text-muted-foreground sm:inline">{timeAgo(issue.updatedAt)}</span></a>) : <EmptyState title="No issues found" hint="No issues match the selected filters." />}</CardContent></Card></div>
  </div>;
}

function ConnectionCard({ configured, status }: { configured: boolean; status: string | null }) {
  const statusCopy: Record<string, string> = { connected: "Linear is connected.", denied: "Linear authorization was cancelled.", "invalid-state": "The authorization expired. Please try again.", "not-configured": "Linear OAuth is not configured on this deployment." };
  return <div className="mx-auto max-w-2xl space-y-4"><PageHead title="Linear" sub="Connect product work to your GitHub workspace" /><Card accent={17}><CardHeader><CardTitle className="flex items-center gap-2"><Layers3 className="size-4 text-[var(--primary)]" /> Linear workspace</CardTitle><CardDescription>Read-only access to teams, projects, cycles, and issues. Gity stores the OAuth tokens encrypted on the server.</CardDescription></CardHeader><CardContent className="space-y-3 text-xs text-muted-foreground">{status && statusCopy[status] ? <p className="rounded border border-border bg-background/30 p-2 text-foreground">{statusCopy[status]}</p> : null}{configured ? <><p>Connect your Linear account to see the latest product work in Gity. No issue changes or write actions are enabled.</p><a href="/api/linear/authorize" className={buttonVariants({ size: "sm" })}>Connect Linear</a></> : <><p>Finish the one-time setup by adding <code className="font-mono text-foreground">LINEAR_CLIENT_ID</code> and <code className="font-mono text-foreground">LINEAR_CLIENT_SECRET</code> as Cloudflare Pages secrets.</p><p>Use the callback URL <code className="break-all font-mono text-foreground">https://gity-49t.pages.dev/api/linear/callback</code> in the Linear OAuth application.</p></>}</CardContent></Card></div>;
}
