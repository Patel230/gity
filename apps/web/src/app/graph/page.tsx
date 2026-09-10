"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleDot,
  Clock3,
  Database,
  ExternalLink,
  GitBranch,
  GitFork,
  GitPullRequest,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Network,
  Star,
  Workflow,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/common/error-state";
import { FilterSelect, allOption, textOptions, type FilterOption } from "@/components/common/filter-select";
import { PageHead } from "@/components/layout/page-head";
import { useGraph } from "@/features/graph/use-graph";
import type { GithubRepo, GithubWorkflowRun } from "@/lib/github/types";
import { formatNumber, timeAgo } from "@/lib/utils";

type GraphView = "topology" | "workflows";
type GraphGroup = { login: string; repos: GithubRepo[] };

export default function GraphPage() {
  const { repos, runs, isLoading, error, dataUpdatedAt } = useGraph();
  const [view, setView] = useState<GraphView>("topology");
  const [orgFilter, setOrgFilter] = useState("all");
  const [repoFilter, setRepoFilter] = useState("all");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  const orgOptions = useMemo(
    () => textOptions(repos.map((repo) => repo.ownerLogin), "organizations"),
    [repos],
  );
  const repoOptions = useMemo<FilterOption[]>(
    () => [
      allOption("repositories"),
      ...repos
        .slice()
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .map((repo) => ({ value: repo.fullName, label: repo.fullName })),
    ],
    [repos],
  );

  const filteredRepos = useMemo(
    () => repos.filter((repo) =>
      (orgFilter === "all" || repo.ownerLogin === orgFilter) &&
      (repoFilter === "all" || repo.fullName === repoFilter),
    ),
    [orgFilter, repoFilter, repos],
  );
  const graphGroups = useMemo(() => groupRepos(filteredRepos), [filteredRepos]);
  const visibleRuns = useMemo(
    () => runs.filter((run) => filteredRepos.some((repo) => repo.fullName === run.repoFullName)),
    [filteredRepos, runs],
  );
  const latestRuns = useMemo(() => latestRunByRepo(visibleRuns), [visibleRuns]);
  const selected = repos.find((repo) => repo.fullName === selectedRepo) ?? null;
  const activeRuns = visibleRuns.filter((run) => run.status === "in_progress" || run.status === "queued");
  const failingRepos = filteredRepos.filter((repo) => repo.ciState === "failing");

  function chooseOrg(value: string) {
    setOrgFilter(value);
    if (value !== "all" && repoFilter !== "all" && !repos.some((repo) => repo.ownerLogin === value && repo.fullName === repoFilter)) {
      setRepoFilter("all");
    }
    setSelectedRepo(null);
  }

  function chooseRepo(value: string) {
    setRepoFilter(value);
    const repo = repos.find((item) => item.fullName === value);
    if (repo) setOrgFilter(repo.ownerLogin);
    setSelectedRepo(value === "all" ? null : value);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHead title="Graph" sub="Loading your repository topology…" />
        <div className="grid gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-md border border-border bg-card" />)}
        </div>
        <div className="h-[520px] animate-pulse rounded-md border border-border bg-card" />
      </div>
    );
  }
  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-4">
      <PageHead
        title="Graph"
        sub={`${filteredRepos.length} repositories across ${graphGroups.length} organization scopes · updated ${dataUpdatedAt ? timeAgo(new Date(dataUpdatedAt).toISOString()) : "—"}`}
        right={<Badge variant={activeRuns.length ? "info" : "outline"}><Activity className="size-3" /> {activeRuns.length ? `${activeRuns.length} running` : "Topology view"}</Badge>}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <GraphStat label="Organizations" value={graphGroups.length} icon={Building2} />
        <GraphStat label="Repositories" value={filteredRepos.length} icon={Database} />
        <GraphStat label="Active workflows" value={activeRuns.length} icon={Workflow} tone={activeRuns.length ? "info" : "default"} />
        <GraphStat label="Failing CI" value={failingRepos.length} icon={XCircle} tone={failingRepos.length ? "destructive" : "success"} />
      </div>

      <Card accent={6}>
        <CardContent className="flex flex-col gap-2 pt-3 sm:flex-row sm:items-center">
          <FilterSelect value={orgFilter} onChange={chooseOrg} label="Organizations" options={orgOptions} wide />
          <FilterSelect value={repoFilter} onChange={chooseRepo} label="Repositories" options={repoOptions} wide />
          <div className="flex-1" />
          <Tabs value={view} onValueChange={(value) => setView(value as GraphView)}>
            <TabsList>
              <TabsTrigger value="topology"><Network className="mr-1.5 inline size-3.5" />Topology</TabsTrigger>
              <TabsTrigger value="workflows"><Workflow className="mr-1.5 inline size-3.5" />Workflow flow</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {view === "topology" ? (
        <>
          <Card accent={7}>
            <CardHeader>
              <CardTitle>Organization → repository topology</CardTitle>
              <CardDescription>Ownership relationships from the repositories visible to your GitHub account. Select a repository to inspect its signals.</CardDescription>
            </CardHeader>
            <CardContent>
              {graphGroups.length === 0 ? (
                <EmptyState title="No repositories match" hint="Try All organizations or All repositories." />
              ) : (
                <TopologyMap groups={graphGroups} selectedRepo={selectedRepo} onSelect={setSelectedRepo} onSelectOrg={chooseOrg} />
              )}
            </CardContent>
          </Card>
          <ArchitectureSignals repos={filteredRepos} />
          {selected ? <RepositoryInspector repo={selected} run={latestRuns.get(selected.fullName)} onClose={() => setSelectedRepo(null)} /> : null}
        </>
      ) : (
        <WorkflowFlow runs={visibleRuns} latestRuns={latestRuns} />
      )}
    </div>
  );
}

function GraphStat({ label, value, icon: Icon, tone = "default" }: { label: string; value: number; icon: typeof Database; tone?: "default" | "info" | "success" | "destructive" }) {
  const toneClass = tone === "destructive" ? "text-[var(--destructive)]" : tone === "success" ? "text-[var(--success)]" : tone === "info" ? "text-[var(--primary)]" : "text-foreground";
  return (
    <Card>
      <CardContent className="flex items-center gap-2.5 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-[var(--primary)]"><Icon className="size-4" /></span>
        <span className="min-w-0"><span className="block truncate text-[11px] text-muted-foreground">{label}</span><span className={`block text-lg font-semibold ${toneClass}`}>{formatNumber(value)}</span></span>
      </CardContent>
    </Card>
  );
}

function groupRepos(repos: GithubRepo[]) {
  const groups = new Map<string, GithubRepo[]>();
  for (const repo of repos) groups.set(repo.ownerLogin, [...(groups.get(repo.ownerLogin) ?? []), repo]);
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([login, items]) => ({ login, repos: items }));
}

function TopologyMap({ groups, selectedRepo, onSelect, onSelectOrg }: { groups: GraphGroup[]; selectedRepo: string | null; onSelect: (fullName: string) => void; onSelectOrg: (login: string) => void }) {
  const focused = groups.length === 1;
  return (
    <div className="space-y-3">
      {focused ? (
        <FocusedOrganization group={groups[0]} selectedRepo={selectedRepo} onSelect={onSelect} />
      ) : (
        <OrganizationOverview groups={groups} onSelectOrg={onSelectOrg} />
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 pt-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--primary)]" /> organization scope</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--success)]" /> healthy CI</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--destructive)]" /> failing CI</span>
        {!focused ? <span className="ml-auto">Select a scope to expand its repositories</span> : <span className="ml-auto">{groups[0].repos.length} repositories in this scope</span>}
      </div>
    </div>
  );
}

function OrganizationOverview({ groups, onSelectOrg }: { groups: GraphGroup[]; onSelectOrg: (login: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => {
        const failing = group.repos.filter((repo) => repo.ciState === "failing").length;
        const openPrs = group.repos.reduce((sum, repo) => sum + repo.openPrCount, 0);
        const openIssues = group.repos.reduce((sum, repo) => sum + repo.openIssueCount, 0);
        const languages = [...new Set(group.repos.map((repo) => repo.primaryLanguage).filter(Boolean))].slice(0, 3);
        return (
          <button type="button" key={group.login} onClick={() => onSelectOrg(group.login)} className="group rounded-md border border-border bg-card/70 p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/70 hover:bg-card" aria-label={`Expand ${group.login} repositories`}>
            <div className="flex items-center gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-[var(--primary)]"><Building2 className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{group.login}</span><span className="block text-[10px] text-muted-foreground">{group.repos.length} {group.repos.length === 1 ? "repository" : "repositories"}</span></span><ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" /></div>
            <div className="mt-3 flex min-h-6 items-center gap-1 overflow-hidden" aria-hidden="true">
              {group.repos.slice(0, 12).map((repo) => <span key={repo.fullName} title={repo.name} className={`size-3 shrink-0 rounded-full border border-background ${repo.ciState === "failing" ? "bg-[var(--destructive)]" : repo.ciState === "passing" ? "bg-[var(--success)]" : repo.ciState === "pending" ? "bg-[var(--warning)]" : "bg-[var(--border)]"}`} />)}
              {group.repos.length > 12 ? <span className="ml-1 text-[10px] text-muted-foreground">+{group.repos.length - 12}</span> : null}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground"><span className="truncate">{languages.length ? languages.join(" · ") : "Languages undeclared"}</span><span className="ml-auto shrink-0">{failing ? `${failing} failing` : `${openPrs} PRs · ${openIssues} issues`}</span></div>
            <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-muted"><span className={`block h-full rounded-full ${failing ? "bg-[var(--destructive)]" : "bg-[var(--success)]"}`} style={{ width: `${Math.max(8, ((group.repos.length - failing) / Math.max(1, group.repos.length)) * 100)}%` }} /></div>
          </button>
        );
      })}
    </div>
  );
}

function FocusedOrganization({ group, selectedRepo, onSelect }: { group: GraphGroup; selectedRepo: string | null; onSelect: (fullName: string) => void }) {
  const openPrs = group.repos.reduce((sum, repo) => sum + repo.openPrCount, 0);
  const openIssues = group.repos.reduce((sum, repo) => sum + repo.openIssueCount, 0);
  return (
    <div className="rounded-md border border-border/70 bg-background/40 p-3">
      <div className="grid gap-3 lg:grid-cols-[190px_28px_minmax(0,1fr)] lg:items-center">
        <div className="rounded-md border border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_8%,var(--card))] p-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-accent text-[var(--primary)]"><Building2 className="size-4" /></span><span className="min-w-0 truncate text-sm font-semibold">{group.login}</span></div><p className="mt-2 text-[10px] text-muted-foreground">{group.repos.length} repos · {openPrs} PRs · {openIssues} issues</p></div>
        <ArrowRight className="mx-auto hidden size-5 text-[var(--primary)] lg:block" />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {group.repos.map((repo) => <RepoNode key={repo.fullName} repo={repo} selected={selectedRepo === repo.fullName} onSelect={onSelect} />)}
        </div>
      </div>
    </div>
  );
}

function RepoNode({ repo, selected, onSelect }: { repo: GithubRepo; selected: boolean; onSelect: (fullName: string) => void }) {
  const ci = repo.ciState;
  return (
    <button type="button" onClick={() => onSelect(repo.fullName)} className={`min-h-[92px] rounded-md border bg-card p-2.5 text-left shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:border-primary/70 ${selected ? "border-primary ring-2 ring-primary/25" : "border-border"}`} aria-label={`Inspect ${repo.fullName}`}>
      <span className="flex items-start gap-2"><span className="grid size-6 shrink-0 place-items-center rounded bg-accent text-[var(--primary)]"><Database className="size-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate font-mono text-xs font-semibold">{repo.name}</span><span className="block truncate text-[10px] text-muted-foreground">{repo.ownerLogin}</span></span>{repo.isPrivate ? <LockKeyhole className="size-3 text-muted-foreground" /> : null}</span>
      <span className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-[10px] text-muted-foreground">{repo.primaryLanguage ?? "No language"}</span><CiBadge state={ci} /></span>
    </button>
  );
}

function CiBadge({ state }: { state: GithubRepo["ciState"] }) {
  if (state === "passing") return <Badge variant="success"><CheckCircle2 className="size-3" />passing</Badge>;
  if (state === "failing") return <Badge variant="destructive"><XCircle className="size-3" />failing</Badge>;
  if (state === "pending") return <Badge variant="warning"><Clock3 className="size-3" />pending</Badge>;
  return <Badge variant="outline">{state === "no-checks" ? "no CI" : "unknown"}</Badge>;
}

function ArchitectureSignals({ repos }: { repos: GithubRepo[] }) {
  const languages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const repo of repos) counts.set(repo.primaryLanguage ?? "Undeclared", (counts.get(repo.primaryLanguage ?? "Undeclared") ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [repos]);
  const totalStars = repos.reduce((sum, repo) => sum + repo.stars, 0);
  const totalForks = repos.reduce((sum, repo) => sum + repo.forks, 0);
  const archived = repos.filter((repo) => repo.isArchived).length;
  return (
    <Card accent={8}>
      <CardHeader><CardTitle>Architecture signals</CardTitle><CardDescription>Repository-level signals that help you understand the workspace shape at a glance.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-2">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium"><Layers3 className="size-3.5 text-[var(--primary)]" />Primary languages</div>
          {languages.length === 0 ? <p className="text-xs text-muted-foreground">No language data available.</p> : languages.map(([language, count]) => <div key={language} className="flex items-center gap-2 text-xs"><span className="w-24 truncate text-muted-foreground">{language}</span><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(8, (count / Math.max(1, repos.length)) * 100)}%` }} /></span><span className="w-6 text-right font-mono text-muted-foreground">{count}</span></div>)}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Signal label="Stars" value={totalStars} icon={Star} />
          <Signal label="Forks" value={totalForks} icon={GitFork} />
          <Signal label="Archived" value={archived} icon={Archive} />
        </div>
      </CardContent>
    </Card>
  );
}

function Signal({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Star }) {
  return <div className="rounded-md border border-border/70 bg-background/35 p-2.5"><Icon className="size-3.5 text-[var(--primary)]" /><p className="mt-2 text-[11px] text-muted-foreground">{label}</p><p className="font-mono text-sm font-semibold">{formatNumber(value)}</p></div>;
}

function RepositoryInspector({ repo, run, onClose }: { repo: GithubRepo; run?: GithubWorkflowRun; onClose: () => void }) {
  return (
    <Card accent={9}>
      <CardHeader><div className="flex items-start justify-between gap-2"><div><CardTitle>{repo.fullName}</CardTitle><CardDescription className="mt-1">Repository details and the latest workflow signal.</CardDescription></div><Button variant="ghost" size="sm" onClick={onClose}>Close</Button></div></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InspectorItem icon={GitPullRequest} label="Open PRs" value={formatNumber(repo.openPrCount)} />
        <InspectorItem icon={CircleDot} label="Open issues" value={formatNumber(repo.openIssueCount)} />
        <InspectorItem icon={GitBranch} label="Default branch" value={repo.defaultBranch} />
        <InspectorItem icon={Activity} label="Latest push" value={timeAgo(repo.pushedAt)} />
        <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground"><CiBadge state={repo.ciState} />{repo.isArchived ? <Badge variant="warning"><Archive className="size-3" />archived</Badge> : null}<span>{run ? `Latest Actions: ${run.workflowName} · ${run.conclusion ?? run.status} · ${timeAgo(run.updatedAt)}` : "No workflow snapshot for this repository"}</span><a href={repo.htmlUrl} target="_blank" rel="noopener" className="ml-auto inline-flex items-center gap-1 text-[var(--primary)] hover:underline">Open on GitHub <ExternalLink className="size-3" /></a></div>
      </CardContent>
    </Card>
  );
}

function InspectorItem({ icon: Icon, label, value }: { icon: typeof GitBranch; label: string; value: string }) {
  return <div className="flex items-center gap-2 rounded-md border border-border/70 bg-background/35 p-2.5"><Icon className="size-3.5 text-[var(--primary)]" /><span><span className="block text-[10px] text-muted-foreground">{label}</span><span className="block truncate font-mono text-xs">{value}</span></span></div>;
}

function WorkflowFlow({ runs, latestRuns }: { runs: GithubWorkflowRun[]; latestRuns: Map<string, GithubWorkflowRun> }) {
  const active = runs.filter((run) => run.status === "in_progress" || run.status === "queued");
  const ordered = [...active, ...[...latestRuns.values()].filter((run) => !active.some((item) => item.id === run.id))];
  return (
    <Card accent={10}>
      <CardHeader><CardTitle>Workflow flow</CardTitle><CardDescription>Event → workflow → result for the latest Actions snapshot available across the selected repositories. Active runs are highlighted and refresh with your workspace preference.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {ordered.length === 0 ? <EmptyState title="No workflow runs found" hint="The selected repositories have no Actions runs visible to your token." /> : ordered.map((run) => <WorkflowLane key={run.id} run={run} />)}
      </CardContent>
    </Card>
  );
}

function WorkflowLane({ run }: { run: GithubWorkflowRun }) {
  const active = run.status === "in_progress" || run.status === "queued";
  const success = run.conclusion === "success";
  const failed = run.conclusion === "failure" || run.conclusion === "timed_out";
  return (
    <a href={run.htmlUrl} target="_blank" rel="noopener" className={`group grid gap-2 rounded-md border p-2.5 transition hover:border-primary/60 lg:grid-cols-[minmax(160px,1fr)_24px_minmax(240px,1.4fr)_24px_minmax(150px,0.8fr)] lg:items-center ${active ? "border-primary/60 bg-[color-mix(in_srgb,var(--primary)_7%,transparent)]" : "border-border/70 bg-background/25"}`}>
      <div className="flex min-w-0 items-center gap-2"><span className="grid size-7 shrink-0 place-items-center rounded bg-accent text-[var(--primary)]"><GitBranch className="size-3.5" /></span><span className="min-w-0"><span className="block truncate text-xs font-medium">{run.event} · {run.branch}</span><span className="block truncate font-mono text-[10px] text-muted-foreground">{run.repoFullName}</span></span></div>
      <ArrowRight className="hidden size-3.5 text-muted-foreground lg:block" />
      <div className="flex min-w-0 items-center gap-2 rounded border border-border/70 bg-card px-2 py-1.5"><Workflow className={`size-3.5 shrink-0 text-[var(--primary)] ${active ? "animate-pulse" : ""}`} /><span className="min-w-0"><span className="block truncate text-xs font-medium">{run.workflowName}</span><span className="block truncate text-[10px] text-muted-foreground">run #{run.runNumber} · by {run.actorLogin}</span></span></div>
      <ArrowRight className="hidden size-3.5 text-muted-foreground lg:block" />
      <div className="flex items-center justify-between gap-2"><Badge variant={active ? "info" : success ? "success" : failed ? "destructive" : "outline"}>{active ? <LoaderCircle className="size-3 animate-spin" /> : success ? <CheckCircle2 className="size-3" /> : failed ? <XCircle className="size-3" /> : <Clock3 className="size-3" />}{active ? run.status.replace("_", " ") : run.conclusion ?? run.status}</Badge><span className="text-[10px] text-muted-foreground">{timeAgo(run.updatedAt)}</span></div>
    </a>
  );
}

function latestRunByRepo(runs: GithubWorkflowRun[]) {
  const latest = new Map<string, GithubWorkflowRun>();
  for (const run of runs) {
    const current = latest.get(run.repoFullName);
    if (!current || run.updatedAt > current.updatedAt) latest.set(run.repoFullName, run);
  }
  return latest;
}
