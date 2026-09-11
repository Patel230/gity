"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Box,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  CircleDot,
  Clock3,
  Code2,
  Database,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  GitPullRequest,
  Layers3,
  LockKeyhole,
  Map as MapIcon,
  Package,
  FileText,
  Folder,
  Play,
  Search,
  Share2,
  ShieldCheck,
  Star,
  Terminal,
  Workflow,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/common/error-state";
import { FilterSelect, textOptions } from "@/components/common/filter-select";
import { PageHead } from "@/components/layout/page-head";
import { Input } from "@/components/ui/input";
import { useGraph } from "@/features/graph/use-graph";
import { useRepoCommitDetail, useRepoCommits, useRepoDirectory, useRepoFilePreview, useRepoReferences, useRepoSnapshot, useRepoWork } from "@/features/repositories/use-repo-snapshot";
import type { GithubRepo, GithubRepoCommit, GithubRepoCommitDetail, GithubRepoFilePreview, GithubRepoReferenceSnapshot, GithubRepoSnapshot, GithubRepoWorkSnapshot, GithubWorkflowRun } from "@/lib/github/types";
import { normalizeBaselineGraph } from "@/lib/nexus/normalize";
import type { NexusGraphSnapshot } from "@/lib/nexus/types";
import { ageInDays, cn, formatNumber, timeAgo } from "@/lib/utils";

type RepoGroup = { login: string; repos: GithubRepo[] };

export default function RepoMapPage() {
  const pathname = usePathname();
  const surface = pathname === "/nexus" || pathname === "/graph" ? "nexus" : "map";
  const { repos, runs, isLoading, ciLoading, runsLoading, error, dataUpdatedAt } = useGraph(true);
  const [orgFilter, setOrgFilter] = useState("all");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [requestedRepo, setRequestedRepo] = useState<string | null>(null);
  const [requestedOrg, setRequestedOrg] = useState<string | null>(null);
  const [repoQuery, setRepoQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const repo = params.get("repo");
    const org = params.get("org");
    const status = params.get("status");
    const query = params.get("q");
    // Intentional URL hydration after SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (repo) setRequestedRepo(repo);
    // Intentional URL hydration after SSR.
    if (org) setRequestedOrg(org);
    // Intentional URL hydration after SSR.
    if (status === "attention" || status === "active") setStatusFilter(status);
    // Intentional URL hydration after SSR.
    if (query) setRepoQuery(query);
  }, []);

  const orgOptions = useMemo(() => textOptions(repos.map((repo) => repo.ownerLogin), "organizations"), [repos]);
  const effectiveOrgFilter = orgFilter !== "all" ? orgFilter : requestedOrg ?? "all";
  const scopedRepos = useMemo(
    () => repos.filter((repo) => effectiveOrgFilter === "all" || repo.ownerLogin === effectiveOrgFilter),
    [effectiveOrgFilter, repos],
  );
  const filteredRepos = useMemo(
    () => {
      const needle = repoQuery.trim().toLowerCase();
      return scopedRepos.filter((repo) => {
        if (statusFilter === "attention" && repo.ciState !== "failing" && repo.ciState !== "pending") return false;
        if (statusFilter === "active" && (repo.isArchived || !repo.pushedAt || ageInDays(repo.pushedAt) > 30)) return false;
        return !needle || `${repo.fullName} ${repo.description ?? ""} ${repo.primaryLanguage ?? ""}`.toLowerCase().includes(needle);
      });
    },
    [repoQuery, scopedRepos, statusFilter],
  );
  const groups = useMemo(() => groupRepos(filteredRepos), [filteredRepos]);
  const selected = filteredRepos.find((repo) => repo.fullName === (selectedRepo ?? requestedRepo)) ?? null;
  const latestRuns = useMemo(() => latestRunByRepo(runs), [runs]);
  const selectedRun = selected ? latestRuns.get(selected.fullName) : undefined;
  const { snapshot, isLoading: snapshotLoading, error: snapshotError } = useRepoSnapshot(selected);
  const { commits, isLoading: commitsLoading, error: commitsError } = useRepoCommits(selected);
  const { snapshot: referenceSnapshot, isLoading: referencesLoading, error: referencesError } = useRepoReferences(scopedRepos, selected);
  const { work, isLoading: workLoading, error: workError } = useRepoWork(selected);
  const baselineGraph = useMemo(
    () => normalizeBaselineGraph({ repos: scopedRepos, references: referenceSnapshot?.references, runs, indexedAt: dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : undefined }),
    [dataUpdatedAt, referenceSnapshot?.references, runs, scopedRepos],
  );
  const activeRuns = runs.filter((run) => (run.status === "queued" || run.status === "in_progress") && filteredRepos.some((repo) => repo.fullName === run.repoFullName));
  const failingCount = filteredRepos.filter((repo) => repo.ciState === "failing").length;

  useEffect(() => {
    if (!requestedRepo || requestedRepo !== selected?.fullName) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("repo-dossier")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [requestedRepo, selected?.fullName]);

  useEffect(() => {
    if (!requestedRepo || !filteredRepos.length || filteredRepos.some((repo) => repo.fullName === requestedRepo)) return;
    // Keep a conflicting deep link from pointing at a different fallback dossier.
    updateMapUrl(effectiveOrgFilter === "all" ? null : effectiveOrgFilter, null);
  }, [effectiveOrgFilter, filteredRepos, requestedRepo]);

  function chooseOrg(value: string) {
    setOrgFilter(value);
    setRequestedOrg(null);
    setRequestedRepo(null);
    setSelectedRepo(null);
    updateMapUrl(value === "all" ? null : value, null);
  }

  function chooseRepo(fullName: string) {
    setSelectedRepo(fullName);
    setRequestedRepo(fullName);
    updateMapUrl(effectiveOrgFilter === "all" ? null : effectiveOrgFilter, fullName);
  }

  function clearRepoFocus() {
    setSelectedRepo(null);
    setRequestedRepo(null);
    updateMapUrl(effectiveOrgFilter === "all" ? null : effectiveOrgFilter, null);
  }

  function changeRepoQuery(value: string) {
    setRepoQuery(value);
    setRequestedRepo(null);
    setSelectedRepo(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("repo");
    if (value.trim()) params.set("q", value);
    else params.delete("q");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }

  function chooseStatus(value: string) {
    setStatusFilter(value);
    setRequestedRepo(null);
    setSelectedRepo(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("repo");
    if (value === "all") params.delete("status");
    else params.set("status", value);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }

  if (isLoading) return <MapLoading />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-4">
      <PageHead
        title={surface === "nexus" ? "Gitty Nexus" : "System map"}
        sub={`${filteredRepos.length} repositories · ${surface === "nexus" ? "a living architecture baseline grounded in repository evidence" : "understand ownership, code references, delivery flow, and repository health in one place"}`}
        right={<div className="flex items-center gap-2"><CopyMapLink selected={selected} /><Badge variant={ciLoading ? "warning" : activeRuns.length ? "info" : "outline"}><Activity className="size-3" />{ciLoading ? "checking CI" : activeRuns.length ? `${activeRuns.length} workflows live` : dataUpdatedAt ? `synced ${timeAgo(new Date(dataUpdatedAt).toISOString())}` : "live map"}</Badge></div>}
      />

      {surface === "nexus" ? <NexusBaselineSummary graph={baselineGraph} referencesLoading={referencesLoading} /> : null}

      <Card accent={1} className="overflow-hidden">
        <CardContent className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]">
              <MapIcon className="size-4" />
            </span>
            <span>
            <span className="block text-xs font-semibold">{surface === "nexus" ? "Nexus architecture baseline" : "System map"}</span>
            <span className="block text-[10px] text-muted-foreground">Click any node to inspect it · evidence before inference</span>
            </span>
          </div>
          <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={repoQuery} onChange={(event) => changeRepoQuery(event.target.value)} placeholder="Find a repo, language, or signal…" aria-label="Find a repository" className="h-8 pl-8 text-xs" />
          </div>
          <FilterSelect value={effectiveOrgFilter} onChange={chooseOrg} label="Organizations" options={orgOptions} wide />
          <FilterSelect value={statusFilter} onChange={chooseStatus} label="Status" options={[{ value: "all", label: "All repositories" }, { value: "attention", label: "Needs attention" }, { value: "active", label: "Recently active" }]} wide />
          <span className="hidden items-center gap-1.5 text-[10px] text-muted-foreground lg:flex">
            <span className="size-2 rounded-full bg-[var(--success)]" /> healthy
            <span className="ml-2 size-2 rounded-full bg-[var(--destructive)]" /> needs attention
          </span>
        </CardContent>
      </Card>

      {groups.length ? <SectionIndex hasSelection={!!selected} /> : null}
      {selected ? <SelectedFocusBar repo={selected} onClear={clearRepoFocus} /> : null}

      {groups.length === 0 ? (
        <EmptyState title="No repositories to map" hint="Try All organizations or check that your token can see repository metadata." />
      ) : (
        <>
          <Card id="workspace-map" accent={2} className="scroll-mt-20">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>How the workspace fits together</CardTitle>
                  <CardDescription>Ownership is the source of truth. The delivery path is ordered by the latest repository activity and Actions signals.</CardDescription>
                </div>
                <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">signal-based map</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <OwnershipMap groups={groups} selectedRepo={selected?.fullName ?? null} onSelect={chooseRepo} />
            </CardContent>
          </Card>

          <DependencyGraph repos={filteredRepos} references={referenceSnapshot?.references ?? []} selectedRepo={selected?.fullName ?? null} onSelect={chooseRepo} />
          <RepositoryRelationships repos={filteredRepos} selectedRepo={selected?.fullName ?? null} onSelect={chooseRepo} />
          <CodeReferenceFlow repos={filteredRepos} snapshot={referenceSnapshot} isLoading={referencesLoading} error={referencesError} selectedRepo={selected?.fullName ?? null} onSelect={chooseRepo} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.85fr)]">
            <Card id="delivery-flow" accent={3} className="scroll-mt-20">
              <CardHeader>
                <CardTitle>Delivery flow</CardTitle>
                <CardDescription>Recent work moving through each repository in the selected scope.</CardDescription>
              </CardHeader>
              <CardContent>
                <DeliveryFlow repos={filteredRepos} latestRuns={latestRuns} onSelect={chooseRepo} />
              </CardContent>
            </Card>
            <WorkspaceSignals repos={filteredRepos} activeRuns={activeRuns} failingCount={failingCount} ciLoading={ciLoading} />
          </div>

          {selected ? (
            <>
              <RepositoryOverview repo={selected} run={selectedRun} runsLoading={runsLoading} snapshot={snapshot} latestCommit={commits[0]} relatedRepos={scopedRepos} references={referenceSnapshot?.references ?? []} onSelect={chooseRepo} />
              <RepositoryChanges key={selected.fullName} commits={commits} isLoading={commitsLoading} error={commitsError} repo={selected} />
              <CodebaseSnapshot key={selected.fullName} repo={selected} snapshot={snapshot} isLoading={snapshotLoading} error={snapshotError} />
              <RepositoryWork work={work} isLoading={workLoading} error={workError} />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function NexusBaselineSummary({ graph, referencesLoading }: { graph: NexusGraphSnapshot; referencesLoading: boolean }) {
  const organizations = graph.nodes.filter((node) => node.type === "organization").length;
  const repositories = graph.nodes.filter((node) => node.type === "repository").length;
  const confirmed = graph.edges.filter((edge) => edge.confidence === "confirmed").length;
  const evidenceBacked = graph.edges.filter((edge) => edge.evidenceIds.length > 0).length;
  return (
    <Card accent={1}>
      <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold">Architecture baseline</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Normalized workspace entities are the foundation for future domains, services, interfaces, and flows.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] sm:flex sm:items-center">
          <span><strong className="font-mono text-foreground">{organizations}</strong> orgs</span>
          <span><strong className="font-mono text-foreground">{repositories}</strong> repos</span>
          <span><strong className="font-mono text-foreground">{graph.edges.length}</strong> connections</span>
          <span className="text-muted-foreground">{confirmed} confirmed · {evidenceBacked} evidenced</span>
          {referencesLoading ? <span className="col-span-2 text-[var(--primary)] sm:col-span-1">scanning references…</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SelectedFocusBar({ repo, onClear }: { repo: GithubRepo; onClear: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/35 bg-[color-mix(in_srgb,var(--primary)_6%,var(--card))] px-3 py-2"><div className="flex min-w-0 items-center gap-2"><span className="size-2 shrink-0 rounded-full bg-[var(--primary)]" /><span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">inspecting</span><span className="truncate font-mono text-xs font-semibold">{repo.fullName}</span><span className="hidden text-[10px] text-muted-foreground sm:inline">{repo.primaryLanguage ?? "language undeclared"} · {repo.defaultBranch}</span></div><div className="flex shrink-0 items-center gap-3"><a href="#repo-dossier" className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--primary)] hover:underline">Jump to dossier <ArrowRight className="size-3" /></a><button type="button" onClick={onClear} className="text-[10px] text-muted-foreground hover:text-foreground hover:underline">Clear focus</button></div></div>;
}

function CopyMapLink({ selected }: { selected: GithubRepo | null }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = new URL(window.location.href);
    if (selected) url.searchParams.set("repo", selected.fullName);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return <Button type="button" variant="secondary" size="sm" onClick={() => void copyLink()} title="Copy a shareable System Map link"><Share2 className="size-3.5" />{copied ? "Link copied" : "Share view"}</Button>;
}

function SectionIndex({ hasSelection }: { hasSelection: boolean }) {
  const sections = [
    ["workspace-map", "Workspace"],
    ["dependency-graph", "Graph"],
    ["repository-relationships", "Relationships"],
    ["code-reference-flow", "Code flow"],
    ["delivery-flow", "Delivery"],
    ...(hasSelection ? [["repo-dossier", "Dossier"], ["recent-changes", "Changes"], ["codebase-shape", "Codebase"], ["current-work", "Work"]] : []),
  ];
  return <nav aria-label="System map sections" className="flex items-center gap-1 overflow-x-auto rounded-md border border-border/70 bg-card/40 p-1"><span className="shrink-0 px-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Jump to</span>{sections.map(([id, label]) => <a key={id} href={`#${id}`} className="shrink-0 rounded px-2 py-1 text-[10px] text-muted-foreground transition hover:bg-accent hover:text-foreground">{label}</a>)}</nav>;
}

type GraphEdge = { from: string; to: string; kind: "fork" | "code"; path?: string };

function DependencyGraph({ repos, references, selectedRepo, onSelect }: { repos: GithubRepo[]; references: GithubRepoReferenceSnapshot["references"]; selectedRepo: string | null; onSelect: (fullName: string) => void }) {
  const nodeWidth = 176;
  const nodeHeight = 66;
  const columnWidth = 250;
  const rowHeight = 90;
  const groups = groupRepos(repos);
  const nodes = groups.flatMap((group, groupIndex) => group.repos.map((repo, rowIndex) => ({ repo, x: groupIndex * columnWidth + 16, y: rowIndex * rowHeight + 20 })));
  const nodeByName = new Map(nodes.map((node) => [node.repo.fullName, node]));
  const visibleNames = new Set(repos.map((repo) => repo.fullName));
  const edges: GraphEdge[] = [
    ...repos.filter((repo) => repo.parentFullName && visibleNames.has(repo.parentFullName)).map((repo) => ({ from: repo.parentFullName!, to: repo.fullName, kind: "fork" as const })),
    ...references.filter((reference) => visibleNames.has(reference.sourceFullName) && visibleNames.has(reference.targetFullName)).map((reference) => ({ from: reference.sourceFullName, to: reference.targetFullName, kind: "code" as const, path: reference.path })),
  ];
  const uniqueEdges = [...new Map(edges.map((edge) => [`${edge.kind}:${edge.from}:${edge.to}`, edge])).values()];
  const visibleEdges = uniqueEdges.slice(0, 28);
  const width = Math.max(720, groups.length * columnWidth + 32);
  const height = Math.max(150, Math.max(...groups.map((group) => group.repos.length), 1) * rowHeight + 20);

  return (
    <Card id="dependency-graph" accent={3} className="scroll-mt-20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-1.5"><Workflow className="size-3.5 text-[var(--primary)]" /> Dependency graph</CardTitle>
            <CardDescription>One visual topology of the selected repositories. Lines are verified fork lineage or exact code references; click a node to open its dossier.</CardDescription>
          </div>
          <Badge variant={uniqueEdges.length ? "info" : "outline"} className="hidden shrink-0 sm:inline-flex">{uniqueEdges.length ? `${uniqueEdges.length} verified edge${uniqueEdges.length === 1 ? "" : "s"}` : "no verified edges"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {uniqueEdges.length ? <div className="overflow-x-auto pb-1"><div className="relative" style={{ width, height }}>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${width} ${height}`}>
            <defs><marker id="map-edge-arrow" markerHeight="6" markerWidth="6" orient="auto-start-reverse" refX="5" refY="3" viewBox="0 0 6 6"><path d="M0,0 L6,3 L0,6 z" fill="var(--primary)" /></marker></defs>
            {visibleEdges.map((edge) => {
              const source = nodeByName.get(edge.from);
              const target = nodeByName.get(edge.to);
              if (!source || !target) return null;
              const startX = source.x + nodeWidth;
              const startY = source.y + nodeHeight / 2;
              const endX = target.x;
              const endY = target.y + nodeHeight / 2;
              const curveX = (startX + endX) / 2;
              const emphasized = selectedRepo === edge.from || selectedRepo === edge.to;
              return <path key={`${edge.kind}:${edge.from}:${edge.to}`} d={`M ${startX} ${startY} C ${curveX} ${startY}, ${curveX} ${endY}, ${endX} ${endY}`} fill="none" stroke="var(--primary)" strokeDasharray={edge.kind === "fork" ? "4 4" : undefined} strokeOpacity={emphasized ? 0.95 : 0.42} strokeWidth={emphasized ? 2.2 : 1.4} markerEnd="url(#map-edge-arrow)" />;
            })}
          </svg>
          {groups.map((group, groupIndex) => <div key={group.login} className="absolute flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground" style={{ left: groupIndex * columnWidth + 16, top: 2 }}><Building2 className="size-3 text-[var(--primary)]" />{group.login}</div>)}
          {nodes.map(({ repo, x, y }) => <button key={repo.fullName} type="button" onClick={() => onSelect(repo.fullName)} aria-label={`Inspect ${repo.fullName}`} className={cn("absolute rounded-md border bg-card p-2 text-left transition hover:-translate-y-0.5 hover:border-primary/70", selectedRepo === repo.fullName ? "border-primary ring-2 ring-primary/25" : "border-border/80")} style={{ width: nodeWidth, height: nodeHeight, left: x, top: y }}>
            <span className="flex items-start gap-2"><span className="grid size-6 shrink-0 place-items-center rounded bg-accent text-[var(--primary)]"><Database className="size-3.5" /></span><span className="min-w-0"><span className="block truncate font-mono text-[11px] font-semibold">{repo.fullName}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{repo.primaryLanguage ?? "language undeclared"} · {repo.ciState === "passing" ? "healthy" : repo.ciState === "failing" ? "failing" : repo.ciState === "pending" ? "pending" : repo.ciState === "no-checks" ? "no CI" : "unchecked"}</span></span></span>
          </button>)}
        </div></div> : <div className="flex items-center gap-2 rounded-md border border-dashed border-border/70 bg-background/20 p-3 text-xs text-muted-foreground"><Workflow className="size-4 shrink-0 text-[var(--primary)]" /> No verified fork or exact code-reference edge is visible in this scope. The graph does not infer relationships from repository names.</div>}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 pt-2 text-[10px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="h-px w-4 bg-[var(--primary)]" /> exact code reference</span><span className="inline-flex items-center gap-1.5"><span className="h-px w-4 border-t border-dashed border-[var(--primary)]" /> verified fork lineage</span>{uniqueEdges.length > visibleEdges.length ? <span>+{uniqueEdges.length - visibleEdges.length} more edges · narrow the scope to focus</span> : null}</div>
      </CardContent>
    </Card>
  );
}

function RepositoryChanges({ repo, commits, isLoading, error }: { repo: GithubRepo; commits: GithubRepoCommit[]; isLoading: boolean; error: Error | null }) {
  const [expandedSha, setExpandedSha] = useState<string | null>(null);
  const commitDetail = useRepoCommitDetail(repo, expandedSha);

  function toggleCommit(sha: string) {
    setExpandedSha((current) => (current === sha ? null : sha));
  }

  return (
    <Card id="recent-changes" accent={6} className="scroll-mt-20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-1.5"><GitCommitHorizontal className="size-3.5 text-[var(--primary)]" /> Recent changes</CardTitle>
            <CardDescription>Latest commits on {repo.defaultBranch}—the fastest way to see where this codebase is moving.</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {commits.length ? <Badge variant="outline">{commits.length} shown</Badge> : null}
            <a href={`${repo.htmlUrl}/commits/${repo.defaultBranch}`} target="_blank" rel="noopener" className="hidden items-center gap-1 text-xs text-[var(--primary)] hover:underline sm:inline-flex">Full history <ArrowUpRight className="size-3" /></a>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-1.5"><div className="h-10 animate-pulse rounded-md bg-muted" /><div className="h-10 animate-pulse rounded-md bg-muted" /><div className="h-10 animate-pulse rounded-md bg-muted" /></div>
        ) : error ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-background/25 p-3 text-xs text-muted-foreground"><span>Recent commits could not be read with this token.</span><a href={`${repo.htmlUrl}/commits/${repo.defaultBranch}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline">Open history <ArrowUpRight className="size-3" /></a></div>
        ) : commits.length ? (
          <div className="space-y-1">
            {commits.map((commit) => <CommitRow key={commit.sha} commit={commit} expanded={expandedSha === commit.sha} onToggle={() => toggleCommit(commit.sha)} detail={expandedSha === commit.sha ? commitDetail.detail : null} detailLoading={expandedSha === commit.sha && commitDetail.isLoading} detailError={expandedSha === commit.sha ? commitDetail.error : null} />)}
          </div>
        ) : (
          <EmptyState title="No recent commits" hint={`No commit history was returned for ${repo.defaultBranch}.`} />
        )}
      </CardContent>
    </Card>
  );
}

function CommitRow({ commit, expanded, onToggle, detail, detailLoading, detailError }: { commit: GithubRepoCommit; expanded: boolean; onToggle: () => void; detail: GithubRepoCommitDetail | null; detailLoading: boolean; detailError: Error | null }) {
  return <div className="rounded-md border border-transparent transition hover:border-border/70 hover:bg-accent"><div className="flex items-center gap-1.5"><button type="button" onClick={onToggle} aria-expanded={expanded} className="group flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1.5 text-left"><span className="grid size-4 shrink-0 place-items-center text-muted-foreground">{expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}</span><Avatar src={commit.authorAvatarUrl} alt={commit.authorLogin} className="size-6" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium group-hover:text-[var(--primary)]">{commit.message}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground"><span className="font-mono">{commit.authorLogin}</span> · {timeAgo(commit.authoredAt)}</span></span><span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline">{commit.sha.slice(0, 7)}</span></button><a href={commit.htmlUrl} target="_blank" rel="noopener" aria-label={`Open commit ${commit.sha.slice(0, 7)} on GitHub`} className="mr-1.5 rounded p-1 text-muted-foreground hover:text-[var(--primary)]"><ArrowUpRight className="size-3" /></a></div>{expanded ? <CommitDetail detail={detail} isLoading={detailLoading} error={detailError} /> : null}</div>;
}

function CommitDetail({ detail, isLoading, error }: { detail: GithubRepoCommitDetail | null; isLoading: boolean; error: Error | null }) {
  if (isLoading) return <div className="mx-8 mb-2 space-y-1 rounded-md border border-border/70 bg-background/30 p-2"><div className="h-4 animate-pulse rounded bg-muted" /><div className="h-4 animate-pulse rounded bg-muted" /></div>;
  if (error) return <p className="mx-8 mb-2 rounded-md border border-border/70 bg-background/30 p-2 text-[10px] text-muted-foreground">Changed files could not be read. Open the commit on GitHub for the full diff.</p>;
  if (!detail) return null;
  return <div className="mx-8 mb-2 rounded-md border border-border/70 bg-background/30 p-2"><div className="mb-1.5 flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">changed paths</span><span className="text-[10px] text-muted-foreground">{detail.files.length} file{detail.files.length === 1 ? "" : "s"}</span></div>{detail.files.length ? <div className="space-y-0.5">{detail.files.slice(0, 10).map((file) => <div key={file.path} className="flex items-center gap-2 text-[10px]"><span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">{file.path}</span><span className="hidden text-[var(--primary)] sm:inline">{file.status}</span><span className="shrink-0 font-mono text-[var(--success)]">+{file.additions}</span><span className="shrink-0 font-mono text-[var(--destructive)]">-{file.deletions}</span></div>)}</div> : <p className="text-[10px] text-muted-foreground">No changed-file summary was returned for this commit.</p>}{detail.files.length > 10 ? <p className="mt-1.5 text-[10px] text-muted-foreground">+{detail.files.length - 10} more paths · open the full diff on GitHub</p> : null}</div>;
}

function updateMapUrl(org: string | null, repo: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (org) params.set("org", org);
  else params.delete("org");
  if (repo) params.set("repo", repo);
  else params.delete("repo");
  const query = params.toString();
  window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
}

function OwnershipMap({ groups, selectedRepo, onSelect }: { groups: RepoGroup[]; selectedRepo: string | null; onSelect: (fullName: string) => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleGroup(login: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(login)) next.delete(login);
      else next.add(login);
      return next;
    });
  }

  return (
    <div className="space-y-3 overflow-x-auto pb-1">
      <div className="min-w-[720px] space-y-3">
        {groups.map((group) => {
          const failing = group.repos.filter((repo) => repo.ciState === "failing").length;
          const pending = group.repos.filter((repo) => repo.ciState === "pending").length;
          const noChecks = group.repos.filter((repo) => repo.ciState === "no-checks").length;
          const unchecked = group.repos.filter((repo) => repo.ciState === "unknown").length;
          const isCollapsed = collapsed.has(group.login);
          return (
            <div key={group.login} className="grid grid-cols-[170px_30px_minmax(0,1fr)] items-center gap-2 rounded-lg border border-border/70 bg-background/25 p-2.5">
              <button type="button" onClick={() => toggleGroup(group.login)} aria-expanded={!isCollapsed} aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${group.login} repositories`} className="rounded-md border border-[color-mix(in_srgb,var(--primary)_40%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_7%,var(--card))] p-2.5 text-left transition hover:border-primary/70">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-md bg-accent text-[var(--primary)]"><Building2 className="size-3.5" /></span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{group.login}</span>
                  {isCollapsed ? <ChevronRight className="size-3 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-3 shrink-0 text-muted-foreground" />}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{group.repos.length} repos</span>
                  <span className={failing ? "text-[var(--destructive)]" : pending ? "text-[var(--warning)]" : noChecks || unchecked ? "text-muted-foreground" : "text-[var(--success)]"}>{failing ? `${failing} failing` : pending ? `${pending} pending` : noChecks ? `${noChecks} no CI` : unchecked ? `${unchecked} unchecked` : "all healthy"}</span>
                </div>
              </button>
              <ArrowRight className="mx-auto size-4 text-[var(--primary)]" />
              {isCollapsed ? <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/70 bg-background/20 p-2">{group.repos.map((repo) => <CompactRepoNode key={repo.fullName} repo={repo} selected={repo.fullName === selectedRepo} onSelect={onSelect} />)}</div> : <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{group.repos.map((repo) => <RepoNode key={repo.fullName} repo={repo} selected={repo.fullName === selectedRepo} onSelect={onSelect} />)}</div>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 pt-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--primary)]" /> organization scope</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--success)]" /> healthy delivery</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--destructive)]" /> failing delivery</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--warning)]" /> pending</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full border border-border" /> no CI / unchecked</span>
        <span className="ml-auto">{selectedRepo ? "dossier open" : "select a repo to open its dossier"} · {groups.length} ownership scope{groups.length === 1 ? "" : "s"} · {groups.reduce((count, group) => count + group.repos.length, 0)} repos</span>
      </div>
    </div>
  );
}

function CompactRepoNode({ repo, selected, onSelect }: { repo: GithubRepo; selected: boolean; onSelect: (fullName: string) => void }) {
  const failing = repo.ciState === "failing";
  return <button type="button" onClick={() => onSelect(repo.fullName)} className={cn("inline-flex max-w-full items-center gap-1.5 rounded border bg-card px-2 py-1.5 text-left hover:border-primary/70 hover:bg-accent", selected ? "border-primary ring-1 ring-primary/25" : "border-border")} aria-label={`Inspect ${repo.fullName}`}><span className="max-w-36 truncate font-mono text-[10px]">{repo.name}</span><span className={cn("size-1.5 shrink-0 rounded-full", failing ? "bg-[var(--destructive)]" : repo.ciState === "passing" ? "bg-[var(--success)]" : repo.ciState === "pending" ? "bg-[var(--warning)]" : "bg-[var(--border)]")} /></button>;
}

function RepoNode({ repo, selected, onSelect }: { repo: GithubRepo; selected: boolean; onSelect: (fullName: string) => void }) {
  const healthy = repo.ciState === "passing";
  const failing = repo.ciState === "failing";
  return (
    <button type="button" onClick={() => onSelect(repo.fullName)} className={cn("group min-h-[76px] rounded-md border bg-card p-2.5 text-left transition hover:-translate-y-0.5 hover:border-primary/70", selected ? "border-primary ring-2 ring-primary/25" : "border-border") } aria-label={`Inspect ${repo.fullName}`}>
      <span className="flex items-start gap-2">
        <span className={cn("grid size-6 shrink-0 place-items-center rounded bg-accent", failing ? "text-[var(--destructive)]" : "text-[var(--primary)]")}><Database className="size-3.5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-xs font-semibold">{repo.name}</span>
          <span className="block truncate text-[10px] text-muted-foreground">{repo.primaryLanguage ?? "language undeclared"}</span>
        </span>
        {repo.isPrivate ? <LockKeyhole className="size-3 shrink-0 text-muted-foreground" /> : null}
      </span>
      <span className="mt-2 flex items-center justify-between gap-2 text-[10px]">
        <span className="truncate text-muted-foreground">{repo.openPrCount} PRs · {repo.openIssueCount} issues</span>
        <span className={cn("size-2 shrink-0 rounded-full", healthy ? "bg-[var(--success)]" : failing ? "bg-[var(--destructive)]" : repo.ciState === "pending" ? "bg-[var(--warning)]" : "bg-[var(--border)]")} />
      </span>
    </button>
  );
}

function RepositoryRelationships({ repos, selectedRepo, onSelect }: { repos: GithubRepo[]; selectedRepo: string | null; onSelect: (fullName: string) => void }) {
  const repoByName = new Map(repos.map((repo) => [repo.fullName, repo]));
  const lineage = repos.filter((repo) => repo.parentFullName).map((child) => ({
    child,
    parent: repoByName.get(child.parentFullName!),
    parentFullName: child.parentFullName!,
  }));

  return (
    <Card id="repository-relationships" accent={3} className="scroll-mt-20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-1.5"><GitFork className="size-3.5 text-[var(--primary)]" /> Repository relationships</CardTitle>
            <CardDescription>Verified fork lineage from GitHub metadata. These edges are factual; the activity flow below is intentionally shown as a separate signal.</CardDescription>
          </div>
          <Badge variant={lineage.length ? "info" : "outline"} className="hidden shrink-0 sm:inline-flex">{lineage.length ? `${lineage.length} lineage${lineage.length === 1 ? "" : "s"}` : "no fork edges"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {lineage.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {lineage.slice(0, 8).map(({ child, parent, parentFullName }) => (
              <div key={child.fullName} className="flex min-w-0 items-center gap-2 rounded-md border border-border/70 bg-background/25 p-2">
                <RelationshipNode repo={parent} label={parent?.fullName ?? parentFullName} external={!parent} selected={selectedRepo === parentFullName} onSelect={onSelect} />
                <ArrowRight className="size-4 shrink-0 text-[var(--primary)]" />
                <RelationshipNode repo={child} label={child.fullName} selected={selectedRepo === child.fullName} onSelect={onSelect} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border/70 bg-background/20 p-3 text-xs text-muted-foreground">
            <GitFork className="size-4 shrink-0 text-[var(--primary)]" />
            No verified fork relationship is visible in this scope. Gity keeps dependency edges honest instead of inferring them from repository names.
          </div>
        )}
        {lineage.length > 8 ? <p className="mt-2 text-[10px] text-muted-foreground">+{lineage.length - 8} more lineage edges · narrow the organization or repository search to focus the map</p> : null}
      </CardContent>
    </Card>
  );
}

function CodeReferenceFlow({ repos, snapshot, isLoading, error, selectedRepo, onSelect }: { repos: GithubRepo[]; snapshot: GithubRepoReferenceSnapshot | null; isLoading: boolean; error: Error | null; selectedRepo: string | null; onSelect: (fullName: string) => void }) {
  const visibleNames = new Set(repos.map((repo) => repo.fullName));
  const repoByName = new Map(repos.map((repo) => [repo.fullName, repo]));
  const references = snapshot?.references.filter((reference) => visibleNames.has(reference.sourceFullName) && visibleNames.has(reference.targetFullName)) ?? [];
  return (
    <Card id="code-reference-flow" accent={4} className="scroll-mt-20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-1.5"><Workflow className="size-3.5 text-[var(--primary)]" /> Code reference flow</CardTitle>
            <CardDescription>Exact references found in a bounded source scan and resolved across the full selected scope—no name-based guesses.</CardDescription>
          </div>
          <Badge variant={references.length ? "info" : "outline"} className="hidden shrink-0 sm:inline-flex">{snapshot ? `${references.length} edge${references.length === 1 ? "" : "s"} · ${snapshot.analyzedRepos}/${snapshot.totalRepos} scanned` : "checking"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-2 md:grid-cols-2"><div className="h-14 animate-pulse rounded-md bg-muted" /><div className="h-14 animate-pulse rounded-md bg-muted" /></div>
        ) : error ? (
          <p className="rounded-md border border-border/70 bg-background/25 p-3 text-xs text-muted-foreground">The code-reference scan could not complete with this token. Ownership, lineage, and activity signals are still available.</p>
        ) : references.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {references.slice(0, 12).map((reference) => (
            <div key={`${reference.sourceFullName}:${reference.targetFullName}`} className="flex min-w-0 items-center gap-2 rounded-md border border-border/70 bg-background/25 p-2">
                <RelationshipNode repo={repoByName.get(reference.sourceFullName)} label={reference.sourceFullName} selected={selectedRepo === reference.sourceFullName} onSelect={onSelect} />
                <ArrowRight className="size-4 shrink-0 text-[var(--primary)]" />
                <RelationshipNode repo={repoByName.get(reference.targetFullName)} label={reference.targetFullName} selected={selectedRepo === reference.targetFullName} onSelect={onSelect} />
                {repoByName.get(reference.sourceFullName) ? <a href={`${repoByName.get(reference.sourceFullName)!.htmlUrl}/blob/${repoByName.get(reference.sourceFullName)!.defaultBranch}/${reference.path}`} target="_blank" rel="noopener" className="flex max-w-32 shrink-0 items-center gap-1 truncate text-[10px] text-muted-foreground hover:text-[var(--primary)] hover:underline" title={`Open evidence in ${reference.path}`}><span className="truncate">{reference.signal === "scoped-package" ? "package" : "link"} · {reference.path}</span><ArrowUpRight className="size-3 shrink-0" /></a> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border/70 bg-background/20 p-3 text-xs text-muted-foreground"><Workflow className="size-4 shrink-0 text-[var(--primary)]" /> No exact cross-repository code reference was detected in the bounded scan. That is different from proving no dependency exists.</div>
        )}
        {snapshot ? <p className="mt-2 text-[10px] text-muted-foreground">Checked {snapshot.analyzedRepos} of {snapshot.totalRepos} repositories{snapshot.truncated ? `, prioritizing ${selectedRepo ? "the selected repo and " : ""}most recently pushed sources` : ""}. Search or narrow the organization to focus the scan.</p> : null}
        {references.length > 12 ? <p className="mt-2 text-[10px] text-muted-foreground">+{references.length - 12} more edges in the current scope.</p> : null}
      </CardContent>
    </Card>
  );
}

function RelationshipNode({ repo, label, external = false, selected, onSelect }: { repo?: GithubRepo; label: string; external?: boolean; selected: boolean; onSelect: (fullName: string) => void }) {
  const content = <><span className="grid size-6 shrink-0 place-items-center rounded bg-accent text-[var(--primary)]"><Database className="size-3.5" /></span><span className="min-w-0"><span className="block truncate font-mono text-[11px] font-medium">{label}</span><span className="block truncate text-[10px] text-muted-foreground">{external ? "outside selected scope" : repo?.primaryLanguage ?? "repository"}</span></span></>;
  const className = cn("flex min-w-0 flex-1 items-center gap-2 rounded border px-2 py-1.5 text-left", selected ? "border-primary ring-1 ring-primary/25" : "border-border/70", !external && "hover:border-primary/60 hover:bg-accent");
  return external ? <a href={`https://github.com/${label}`} target="_blank" rel="noopener" className={cn(className, "hover:border-primary/60 hover:bg-accent")} aria-label={`Open ${label} on GitHub`}>{content}<ArrowUpRight className="size-3 shrink-0 text-muted-foreground" /></a> : <button type="button" onClick={() => onSelect(repo!.fullName)} className={className} aria-label={`Inspect ${repo!.fullName}`}>{content}</button>;
}

function DeliveryFlow({ repos, latestRuns, onSelect }: { repos: GithubRepo[]; latestRuns: Map<string, GithubWorkflowRun>; onSelect: (fullName: string) => void }) {
  const ordered = repos.slice().sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""));
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max items-stretch gap-2">
        {ordered.slice(0, 8).map((repo, index) => {
          const run = latestRuns.get(repo.fullName);
          const live = run?.status === "queued" || run?.status === "in_progress";
          const failed = repo.ciState === "failing" || run?.conclusion === "failure" || run?.conclusion === "timed_out";
          return (
            <div key={repo.fullName} className="flex items-center gap-2">
              <button type="button" onClick={() => onSelect(repo.fullName)} className={cn("w-[150px] rounded-md border bg-background/35 p-2.5 text-left transition hover:-translate-y-0.5 hover:border-primary/70", live && "border-primary/60", failed && "border-[color-mix(in_srgb,var(--destructive)_55%,var(--border))]") }>
                <div className="flex items-center justify-between gap-2">
                  <span className="grid size-6 place-items-center rounded bg-accent text-[var(--primary)]"><GitBranch className="size-3.5" /></span>
                  <span className={cn("size-2 rounded-full", live ? "animate-pulse bg-[var(--primary)]" : failed ? "bg-[var(--destructive)]" : "bg-[var(--success)]")} />
                </div>
                <p className="mt-2 truncate font-mono text-xs font-semibold">{repo.name}</p>
                <p className="mt-1 truncate text-[10px] text-muted-foreground">{run ? `${run.event} → ${run.workflowName}` : `push → ${repo.defaultBranch}`}</p>
                <p className={cn("mt-2 truncate text-[10px]", failed ? "text-[var(--destructive)]" : live ? "text-[var(--primary)]" : "text-muted-foreground")}>{run ? `→ ${run.conclusion ?? run.status} · ${timeAgo(run.updatedAt)}` : `last push ${timeAgo(repo.pushedAt)}`}</p>
              </button>
              {index < Math.min(ordered.length, 8) - 1 ? <ArrowRight className="size-4 shrink-0 text-border" /> : null}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">Ordered by latest push · arrows show workspace activity, not a source-code import graph.</p>
    </div>
  );
}

function WorkspaceSignals({ repos, activeRuns, failingCount, ciLoading }: { repos: GithubRepo[]; activeRuns: GithubWorkflowRun[]; failingCount: number; ciLoading: boolean }) {
  const languages = useMemo(() => {
    const counts = new Map<string, number>();
    repos.forEach((repo) => counts.set(repo.primaryLanguage ?? "Undeclared", (counts.get(repo.primaryLanguage ?? "Undeclared") ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [repos]);
  const healthy = repos.filter((repo) => repo.ciState === "passing").length;
  const ciChecked = repos.filter((repo) => repo.ciState === "passing" || repo.ciState === "failing" || repo.ciState === "pending").length;
  const pending = repos.filter((repo) => repo.ciState === "pending").length;
  const noChecks = repos.filter((repo) => repo.ciState === "no-checks").length;
  const unchecked = repos.filter((repo) => repo.ciState === "unknown").length;
  const stars = repos.reduce((sum, repo) => sum + repo.stars, 0);
  const healthValue = ciLoading ? "checking…" : [`${ciChecked ? `${healthy}/${ciChecked} checks passing` : "no CI signals"}`, failingCount ? `${failingCount} failing` : "", pending ? `${pending} pending` : "", noChecks ? `${noChecks} no CI` : "", unchecked ? `${unchecked} unchecked` : ""].filter(Boolean).join(" · ");
  return (
    <Card accent={4}>
      <CardHeader><CardTitle>Workspace signals</CardTitle><CardDescription>The quick read for where the system is healthy, busy, or needs attention.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <SignalRow icon={ShieldCheck} label="Delivery health" value={healthValue} tone={ciLoading ? "neutral" : failingCount ? "bad" : pending ? "active" : noChecks || unchecked ? "neutral" : "good"} />
        <SignalRow icon={Play} label="Actions" value={activeRuns.length ? `${activeRuns.length} running now` : "quiet right now"} tone={activeRuns.length ? "active" : "neutral"} />
        <SignalRow icon={Star} label="Reach" value={`${formatNumber(stars)} stars across scope`} tone="neutral" />
        <div className="border-t border-border/70 pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium"><Layers3 className="size-3.5 text-[var(--primary)]" /> Stack mix</div>
          <div className="space-y-2">{languages.map(([language, count]) => <div key={language} className="flex items-center gap-2 text-[10px]"><span className="w-24 truncate text-muted-foreground">{language}</span><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(8, (count / Math.max(1, repos.length)) * 100)}%` }} /></span><span className="w-4 text-right font-mono text-muted-foreground">{count}</span></div>)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function SignalRow({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: "good" | "bad" | "active" | "neutral" }) {
  const color = tone === "good" ? "text-[var(--success)]" : tone === "bad" ? "text-[var(--destructive)]" : tone === "active" ? "text-[var(--primary)]" : "text-foreground";
  return <div className="flex items-center gap-2.5 rounded-md border border-border/70 bg-background/30 p-2.5"><span className={cn("grid size-7 place-items-center rounded bg-accent", color)}><Icon className="size-3.5" /></span><span className="min-w-0"><span className="block text-[10px] text-muted-foreground">{label}</span><span className={cn("block truncate text-xs font-medium", color)}>{value}</span></span></div>;
}

function RepositoryOverview({ repo, run, runsLoading, snapshot, latestCommit, relatedRepos, references, onSelect }: { repo: GithubRepo; run?: GithubWorkflowRun; runsLoading: boolean; snapshot: GithubRepoSnapshot | null; latestCommit?: GithubRepoCommit; relatedRepos: GithubRepo[]; references: GithubRepoReferenceSnapshot["references"]; onSelect: (fullName: string) => void }) {
  const failed = repo.ciState === "failing" || run?.conclusion === "failure" || run?.conclusion === "timed_out";
  const live = run?.status === "queued" || run?.status === "in_progress";
  const pending = repo.ciState === "pending" || run?.status === "pending" || run?.status === "waiting" || run?.status === "requested";
  const noDeliverySignal = !run && (repo.ciState === "no-checks" || repo.ciState === "unknown");
  return (
    <Card id="repo-dossier" accent={5} className="scroll-mt-20">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--primary)]">selected repository</p>
            <CardTitle className="truncate text-base">{repo.fullName}</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">{repo.description ?? "No repository description. Use the signals below to orient yourself in this codebase."}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CopyBriefButton repo={repo} run={run} snapshot={snapshot} latestCommit={latestCommit} relatedRepos={relatedRepos} references={references} />
            <CiBadge state={repo.ciState} />
            <a href={repo.htmlUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline">GitHub <ArrowUpRight className="size-3" /></a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <OverviewStat icon={GitPullRequest} label="Open PRs" value={formatNumber(repo.openPrCount)} />
          <OverviewStat icon={CircleDot} label="Open issues" value={formatNumber(repo.openIssueCount)} />
          <OverviewStat icon={Star} label="Stars" value={formatNumber(repo.stars)} />
          <OverviewStat icon={GitFork} label="Forks" value={formatNumber(repo.forks)} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <DetailTile icon={Code2} label="Primary language" value={repo.primaryLanguage ?? "Undeclared"} hint="detected by GitHub" />
          <DetailTile icon={GitBranch} label="Default branch" value={repo.defaultBranch} hint={repo.isArchived ? "archived repository" : "active branch"} />
          <DetailTile icon={repo.isPrivate ? LockKeyhole : Box} label="Visibility" value={repo.visibility} hint={repo.isFork ? "forked repository" : "source repository"} />
          <DetailTile icon={Activity} label="Latest push" value={timeAgo(repo.pushedAt)} hint={repo.pushedAt ? new Date(repo.pushedAt).toLocaleDateString() : "no push timestamp"} />
        </div>

        {snapshot?.codeOwners ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-border/70 bg-background/25 px-3 py-2 text-[10px]"><ShieldCheck className="size-3.5 shrink-0 text-[var(--primary)]" /><span className="font-medium">Code ownership</span>{snapshot.codeOwners.owners.length ? <span className="font-mono text-muted-foreground">{snapshot.codeOwners.owners.join(" · ")}</span> : <span className="text-muted-foreground">file found, no owner entries parsed</span>}<span className="text-muted-foreground">from /{snapshot.codeOwners.path}</span></div> : null}

        <RepoConnections repo={repo} relatedRepos={relatedRepos} references={references} onSelect={onSelect} />

        <div className="grid gap-3 border-t border-border/70 pt-3 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-xs font-medium"><Terminal className="size-3.5 text-[var(--primary)]" /> What to look at first</div><Badge variant="outline">repo orientation</Badge></div>
            <div className="grid gap-2 sm:grid-cols-3">
              <OrientationStep index="01" icon={Code2} title="Read the stack" text={`${repo.primaryLanguage ?? "Unknown language"} · ${repo.defaultBranch}`} />
              <OrientationStep index="02" icon={GitPullRequest} title="Check the queue" text={`${repo.openPrCount} open PR${repo.openPrCount === 1 ? "" : "s"} · ${repo.openIssueCount} issues`} />
              <OrientationStep index="03" icon={Workflow} title="Trace delivery" text={run ? `${run.workflowName} · ${run.event}` : "No recent Actions run"} />
            </div>
          </div>
          <div className={cn("rounded-md border p-3", failed ? "border-[color-mix(in_srgb,var(--destructive)_45%,var(--border))] bg-[color-mix(in_srgb,var(--destructive)_6%,transparent)]" : "border-border/70 bg-background/25")}>
            <div className="flex items-center gap-2"><span className={cn("grid size-7 place-items-center rounded", failed ? "bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)] text-[var(--destructive)]" : live || pending ? "bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]" : noDeliverySignal ? "bg-accent text-muted-foreground" : "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]")}>{failed ? <XCircle className="size-4" /> : live || pending ? <Clock3 className="size-4" /> : noDeliverySignal ? <Activity className="size-4" /> : <CheckCircle2 className="size-4" />}</span><span><span className="block text-[10px] text-muted-foreground">Latest delivery signal</span><span className="block text-xs font-medium">{failed ? "Needs attention" : live ? "In motion" : pending ? "Checks pending" : noDeliverySignal ? "No CI signal" : "Ready to ship"}</span></span></div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{runsLoading && !run ? "Loading the latest Actions run…" : run ? `${run.workflowName} · ${run.conclusion ?? run.status} · ${timeAgo(run.updatedAt)}` : "No workflow snapshot is visible for this repository."}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 pt-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Building2 className="size-3" /> owned by {repo.ownerLogin}</span>
          <span className="inline-flex items-center gap-1.5"><GitCommitHorizontal className="size-3" /> pushed {timeAgo(repo.pushedAt)}</span>
          <span className="inline-flex items-center gap-1.5"><Package className="size-3" /> {repo.isArchived ? "archived" : "active"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function RepoConnections({ repo, relatedRepos, references, onSelect }: { repo: GithubRepo; relatedRepos: GithubRepo[]; references: GithubRepoReferenceSnapshot["references"]; onSelect: (fullName: string) => void }) {
  const upstream = repo.parentFullName ? relatedRepos.find((item) => item.fullName === repo.parentFullName) : undefined;
  const forks = relatedRepos.filter((item) => item.parentFullName === repo.fullName);
  const uses = references.filter((reference) => reference.sourceFullName === repo.fullName).map((reference) => ({ repo: relatedRepos.find((item) => item.fullName === reference.targetFullName), path: reference.path })).filter((item): item is { repo: GithubRepo; path: string } => !!item.repo);
  const usedBy = references.filter((reference) => reference.targetFullName === repo.fullName).map((reference) => ({ repo: relatedRepos.find((item) => item.fullName === reference.sourceFullName), path: reference.path })).filter((item): item is { repo: GithubRepo; path: string } => !!item.repo);
  const hasUpstream = Boolean(repo.parentFullName);
  const total = (hasUpstream ? 1 : 0) + forks.length + uses.length + usedBy.length;
  return <div className="border-t border-border/70 pt-3"><div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-xs font-medium"><GitFork className="size-3.5 text-[var(--primary)]" /> Connected in this scope</div><Badge variant="outline">{total} connection{total === 1 ? "" : "s"}</Badge></div>{total ? <div className="flex flex-wrap gap-1.5">{repo.parentFullName ? upstream ? <ConnectionChip repo={upstream} label="upstream" onSelect={onSelect} /> : <ExternalConnectionChip fullName={repo.parentFullName} label="upstream · outside scope" /> : null}{forks.slice(0, 4).map((item) => <ConnectionChip key={`fork-${item.fullName}`} repo={item} label="fork" onSelect={onSelect} />)}{uses.slice(0, 4).map((item) => <ConnectionChip key={`uses-${item.repo.fullName}`} repo={item.repo} label="references" evidence={item.path} onSelect={onSelect} />)}{usedBy.slice(0, 4).map((item) => <ConnectionChip key={`used-by-${item.repo.fullName}`} repo={item.repo} label="referenced by" evidence={item.path} onSelect={onSelect} />)}</div> : <p className="rounded-md border border-dashed border-border/70 bg-background/20 p-2.5 text-[10px] text-muted-foreground">No verified upstream, fork, or exact code-reference edge is visible for this repository in the selected scope.</p>}{total > 13 ? <p className="mt-1.5 text-[10px] text-muted-foreground">Showing the first 13 connections in the dossier; see the relationship cards above for the full bounded view.</p> : null}</div>;
}

function ConnectionChip({ repo, label, evidence, onSelect }: { repo: GithubRepo; label: string; evidence?: string; onSelect: (fullName: string) => void }) {
  return <button type="button" onClick={() => onSelect(repo.fullName)} className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded border border-border/70 bg-background/25 px-2 py-1.5 text-left transition hover:border-primary/60 hover:bg-accent" aria-label={`${label}: inspect ${repo.fullName}`}><span className="grid size-5 shrink-0 place-items-center rounded bg-accent text-[var(--primary)]"><Database className="size-3" /></span><span className="min-w-0"><span className="block truncate font-mono text-[10px]">{repo.fullName}</span><span className="block max-w-36 truncate text-[9px] text-muted-foreground" title={evidence ? `${label} evidence: ${evidence}` : label}>{evidence ? `${label} · ${evidence}` : label}</span></span><ArrowRight className="size-3 shrink-0 text-muted-foreground" /></button>;
}

function ExternalConnectionChip({ fullName, label }: { fullName: string; label: string }) {
  return <a href={`https://github.com/${fullName}`} target="_blank" rel="noopener" className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded border border-dashed border-border/70 bg-background/20 px-2 py-1.5 hover:border-primary/60 hover:bg-accent" aria-label={`Open ${fullName} on GitHub`}><span className="grid size-5 shrink-0 place-items-center rounded bg-accent text-muted-foreground"><Database className="size-3" /></span><span className="min-w-0"><span className="block truncate font-mono text-[10px]">{fullName}</span><span className="block text-[9px] text-muted-foreground">{label}</span></span><ArrowUpRight className="size-3 shrink-0 text-muted-foreground" /></a>;
}

function CopyBriefButton({ repo, run, snapshot, latestCommit, relatedRepos, references }: { repo: GithubRepo; run?: GithubWorkflowRun; snapshot: GithubRepoSnapshot | null; latestCommit?: GithubRepoCommit; relatedRepos: GithubRepo[]; references: GithubRepoReferenceSnapshot["references"] }) {
  const [copied, setCopied] = useState(false);

  async function copyBrief() {
    const surfaces = snapshot ? detectSurfaces(snapshot.rootEntries.map((entry) => entry.name)) : [];
    const root = snapshot?.rootEntries.slice(0, 12).map((entry) => `${entry.type === "dir" ? "dir" : "file"}: ${entry.name}`).join(", ") ?? "not loaded";
    const forks = relatedRepos.filter((item) => item.parentFullName === repo.fullName).map((item) => item.fullName);
    const uses = references.filter((reference) => reference.sourceFullName === repo.fullName).map((reference) => `${reference.targetFullName} (${reference.path})`);
    const usedBy = references.filter((reference) => reference.targetFullName === repo.fullName).map((reference) => `${reference.sourceFullName} (${reference.path})`);
    const lines = [
      `${repo.fullName} — repository brief`,
      `Owner: ${repo.ownerLogin}`,
      `Stack: ${repo.primaryLanguage ?? "undeclared"}`,
      `Branch: ${repo.defaultBranch}`,
      `Visibility: ${repo.visibility}${repo.isArchived ? " · archived" : ""}`,
      `Upstream: ${repo.parentFullName ?? "none detected"}`,
      `Forks in scope: ${forks.length ? forks.join(", ") : "none detected"}`,
      `References: ${uses.length ? uses.join(", ") : "none detected"}`,
      `Referenced by: ${usedBy.length ? usedBy.join(", ") : "none detected"}`,
      `CI: ${repo.ciState}`,
      `Open work: ${repo.openPrCount} PRs · ${repo.openIssueCount} issues`,
      `Latest push: ${repo.pushedAt ? new Date(repo.pushedAt).toISOString() : "unknown"}`,
      `Latest commit: ${latestCommit ? `${latestCommit.message} · ${latestCommit.authorLogin} · ${timeAgo(latestCommit.authoredAt)}` : "not loaded"}`,
      `README: ${snapshot?.readme.title ?? "not found"}${snapshot?.readme.excerpt ? ` — ${snapshot.readme.excerpt}` : ""}`,
      `Code owners: ${snapshot?.codeOwners ? `${snapshot.codeOwners.owners.length ? snapshot.codeOwners.owners.join(", ") : "no owner entries parsed"} (${snapshot.codeOwners.path})` : "not detected"}`,
      `Detected surfaces: ${surfaces.length ? surfaces.join(", ") : "none"}`,
      `Root: ${root}`,
      `Latest workflow: ${run ? `${run.workflowName} · ${run.conclusion ?? run.status} · ${run.event}` : "not available"}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return <Button type="button" variant="secondary" size="sm" onClick={() => void copyBrief()} title="Copy a grounded repository brief for an agent or teammate"><Clipboard className="size-3.5" />{copied ? "Copied" : "Copy brief"}</Button>;
}

function CodebaseSnapshot({ repo, snapshot, isLoading, error }: { repo: GithubRepo; snapshot: GithubRepoSnapshot | null; isLoading: boolean; error: Error | null }) {
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const directory = useRepoDirectory(repo, openPath);
  const file = useRepoFilePreview(repo, selectedFile);
  const surfaces = snapshot ? detectSurfaces(snapshot.rootEntries.map((entry) => entry.name)) : [];
  return (
    <Card id="codebase-shape" accent={6} className="scroll-mt-20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-1.5"><BookOpen className="size-3.5 text-[var(--primary)]" /> Codebase shape</CardTitle>
            <CardDescription>Read the repository from the outside in: root structure, documentation, and the surfaces most likely to matter first.</CardDescription>
          </div>
          <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">contents snapshot</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]"><div className="h-40 animate-pulse rounded-md border border-border/70 bg-background/25" /><div className="h-40 animate-pulse rounded-md border border-border/70 bg-background/25" /></div>
        ) : error ? (
          <div className="flex flex-col gap-2 rounded-md border border-[color-mix(in_srgb,var(--warning)_45%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_6%,transparent)] p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">The code surface could not be read with this token. Repository metadata is still available.</p><a href={`${repo.htmlUrl}/tree/${repo.defaultBranch}`} target="_blank" rel="noopener" className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--primary)] hover:underline">Browse on GitHub <ArrowUpRight className="size-3" /></a></div>
        ) : !snapshot ? (
          <EmptyState title="No codebase snapshot" hint="Select a repository to load its root structure." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-md border border-border/70 bg-background/25 p-3">
              <div className="mb-3 flex items-center justify-between gap-2"><div><p className="text-xs font-medium">Repository anatomy</p><p className="mt-0.5 text-[10px] text-muted-foreground">Top-level files and folders · click a folder to explore</p></div><Badge variant="default">{snapshot.rootEntries.length} entries</Badge></div>
              <div className="grid gap-1 sm:grid-cols-2">
                {snapshot.rootEntries.slice(0, 12).map((entry) => <TreeEntryRow key={entry.path} entry={entry} onOpen={setOpenPath} onOpenFile={setSelectedFile} />)}
              </div>
              {snapshot.rootEntries.length > 12 ? <p className="mt-2 border-t border-border/70 pt-2 text-[10px] text-muted-foreground">+{snapshot.rootEntries.length - 12} more root entries · browse the full tree on GitHub</p> : null}
              {openPath ? <DirectoryPanel path={openPath} entries={directory.entries} isLoading={directory.isLoading} error={directory.error} onBack={(path) => { setOpenPath(path); setSelectedFile(null); }} onOpen={(path) => { setOpenPath(path); setSelectedFile(null); }} onOpenFile={setSelectedFile} /> : null}
              {selectedFile ? <FilePreview repo={repo} preview={file.preview} isLoading={file.isLoading} error={file.error} /> : null}
            </div>
            <div className="space-y-3 rounded-md border border-border/70 bg-background/25 p-3">
              <div><p className="flex items-center gap-1.5 text-xs font-medium"><BookOpen className="size-3.5 text-[var(--primary)]" /> README signal</p><p className="mt-2 text-sm font-medium">{snapshot.readme.title ?? "No README title"}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{snapshot.readme.excerpt ?? "No readable README excerpt was found. Start with the root structure and default branch."}</p></div>
              <div className="border-t border-border/70 pt-3"><p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Detected surfaces</p><div className="flex flex-wrap gap-1.5">{surfaces.length ? surfaces.map((surface) => <Badge key={surface} variant="info">{surface}</Badge>) : <span className="text-[11px] text-muted-foreground">No common entry points detected</span>}</div></div>
              <a href={`${repo.htmlUrl}/tree/${repo.defaultBranch}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline">Browse full source tree <ArrowUpRight className="size-3" /></a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TreeEntryRow({ entry, onOpen, onOpenFile }: { entry: GithubRepoSnapshot["rootEntries"][number]; onOpen: (path: string) => void; onOpenFile: (path: string) => void }) {
  const content = <><span className="grid size-6 shrink-0 place-items-center rounded bg-accent text-[var(--primary)]">{entry.type === "dir" ? <Folder className="size-3.5" /> : <FileText className="size-3.5" />}</span><span className="min-w-0"><span className="block truncate font-mono text-[11px] group-hover:text-[var(--primary)]">{entry.name}</span><span className="block text-[10px] text-muted-foreground">{entry.type === "dir" ? "folder" : "file"}</span></span>{entry.type === "dir" ? <ArrowRight className="ml-auto size-3 shrink-0 text-muted-foreground" /> : <ArrowUpRight className="ml-auto size-3 shrink-0 text-muted-foreground" />}</>;
  const className = "group flex min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent";
  return entry.type === "dir" ? <button type="button" onClick={() => onOpen(entry.path)} className={className} aria-label={`Open ${entry.path}`}>{content}</button> : <button type="button" onClick={() => onOpenFile(entry.path)} className={className} aria-label={`Preview ${entry.path}`}>{content}</button>;
}

function DirectoryPanel({ path, entries, isLoading, error, onBack, onOpen, onOpenFile }: { path: string; entries: GithubRepoSnapshot["rootEntries"]; isLoading: boolean; error: Error | null; onBack: (path: string | null) => void; onOpen: (path: string) => void; onOpenFile: (path: string) => void }) {
  const slash = path.lastIndexOf("/");
  const parent = slash > 0 ? path.slice(0, slash) : null;
  return <div className="mt-3 border-t border-border/70 pt-3"><div className="mb-2 flex items-center justify-between gap-2"><p className="min-w-0 truncate font-mono text-[10px] text-[var(--primary)]">/{path}</p><button type="button" onClick={() => onBack(parent)} className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground">← {parent ? "parent" : "root"}</button></div>{isLoading ? <div className="space-y-1"><div className="h-7 animate-pulse rounded bg-muted" /><div className="h-7 animate-pulse rounded bg-muted" /><div className="h-7 animate-pulse rounded bg-muted" /></div> : error ? <p className="text-[10px] text-[var(--warning)]">This folder could not be read with the current token.</p> : entries.length ? <div className="grid gap-1 sm:grid-cols-2">{entries.slice(0, 20).map((entry) => <TreeEntryRow key={entry.path} entry={entry} onOpen={onOpen} onOpenFile={onOpenFile} />)}</div> : <p className="text-[10px] text-muted-foreground">This folder is empty.</p>}{entries.length > 20 ? <p className="mt-2 text-[10px] text-muted-foreground">+{entries.length - 20} more entries · use GitHub for the full directory</p> : null}</div>;
}

function FilePreview({ repo, preview, isLoading, error }: { repo: GithubRepo; preview: GithubRepoFilePreview | null; isLoading: boolean; error: Error | null }) {
  return <div className="mt-3 border-t border-border/70 pt-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-1.5"><FileText className="size-3.5 text-[var(--primary)]" /><span className="text-xs font-medium">File preview</span>{preview ? <span className="truncate font-mono text-[10px] text-muted-foreground">/{preview.path}</span> : null}</div>{preview ? <a href={`${repo.htmlUrl}/blob/${repo.defaultBranch}/${preview.path}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[10px] text-[var(--primary)] hover:underline">Open on GitHub <ArrowUpRight className="size-3" /></a> : null}</div>{isLoading ? <div className="h-40 animate-pulse rounded-md bg-muted" /> : error ? <p className="rounded-md border border-border/70 bg-background/30 p-2 text-[10px] text-muted-foreground">This file cannot be previewed in Gity. Open it on GitHub for the full source.</p> : preview ? <pre className="max-h-80 overflow-auto rounded-md border border-border/70 bg-[#0b0c15] p-3 font-mono text-[10px] leading-relaxed text-foreground"><code>{preview.content}{preview.truncated ? "\n\n… preview clipped · open the full file on GitHub" : ""}</code></pre> : null}</div>;
}

function RepositoryWork({ work, isLoading, error }: { work: GithubRepoWorkSnapshot | null; isLoading: boolean; error: Error | null }) {
  return <Card id="current-work" accent={7} className="scroll-mt-20"><CardHeader><CardTitle className="flex items-center gap-1.5"><GitPullRequest className="size-3.5 text-[var(--primary)]" /> Current work</CardTitle><CardDescription>Latest direct repository work—separate from activity involving only you.</CardDescription></CardHeader><CardContent>{isLoading ? <div className="grid gap-3 lg:grid-cols-2"><div className="h-36 animate-pulse rounded-md border border-border/70 bg-background/25" /><div className="h-36 animate-pulse rounded-md border border-border/70 bg-background/25" /></div> : error ? <p className="rounded-md border border-[color-mix(in_srgb,var(--warning)_45%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_6%,transparent)] p-3 text-xs text-muted-foreground">Current work could not be read with this token. The repository map and metadata are still available.</p> : work ? <div className="grid gap-3 lg:grid-cols-2"><WorkColumn icon={GitPullRequest} title="Pull requests" count={work.prs.length}>{work.prs.length ? work.prs.slice(0, 6).map((pr) => <a key={pr.id} href={pr.htmlUrl} target="_blank" rel="noopener" className="flex items-center gap-2 rounded px-1.5 py-1.5 text-xs hover:bg-accent"><Badge variant="outline">#{pr.number}</Badge><span className="min-w-0 flex-1 truncate">{pr.title}</span><Badge variant={pr.reviewState === "changes_requested" ? "destructive" : pr.reviewRequested || pr.reviewState === "review_required" ? "warning" : pr.isDraft ? "outline" : "success"}>{pr.reviewState === "changes_requested" ? "changes" : pr.reviewRequested || pr.reviewState === "review_required" ? "review" : pr.isDraft ? "draft" : "open"}</Badge><ArrowUpRight className="size-3 shrink-0 text-muted-foreground" /></a>) : <p className="px-1.5 py-3 text-xs text-muted-foreground">No open pull requests in the latest snapshot.</p>}</WorkColumn><WorkColumn icon={CircleDot} title="Issues" count={work.issues.length}>{work.issues.length ? work.issues.slice(0, 6).map((issue) => <a key={issue.id} href={issue.htmlUrl} target="_blank" rel="noopener" className="flex items-center gap-2 rounded px-1.5 py-1.5 text-xs hover:bg-accent"><Badge variant="outline">#{issue.number}</Badge><span className="min-w-0 flex-1 truncate">{issue.title}</span>{issue.labels[0] ? <span className="hidden max-w-24 truncate text-[10px] text-muted-foreground sm:inline">{issue.labels[0].name}</span> : null}<span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(issue.updatedAt)}</span><ArrowUpRight className="size-3 shrink-0 text-muted-foreground" /></a>) : <p className="px-1.5 py-3 text-xs text-muted-foreground">No open issues in the latest snapshot.</p>}</WorkColumn></div> : <p className="text-xs text-muted-foreground">No current work snapshot.</p>}</CardContent></Card>;
}

function WorkColumn({ icon: Icon, title, count, children }: { icon: LucideIcon; title: string; count: number; children: React.ReactNode }) {
  return <div className="rounded-md border border-border/70 bg-background/25 p-3"><div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-xs font-medium"><Icon className="size-3.5 text-[var(--primary)]" />{title}</div><Badge variant="default">{count} found</Badge></div><div className="space-y-0.5">{children}</div><p className="mt-2 border-t border-border/70 pt-2 text-[10px] text-muted-foreground">Showing up to 6 · bounded latest snapshot</p></div>;
}

function detectSurfaces(names: string[]): string[] {
  const lower = new Set(names.map((name) => name.toLowerCase()));
  const surfaces: string[] = [];
  if (lower.has("src") || lower.has("app") || lower.has("lib")) surfaces.push("application code");
  if (["package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json"].some((name) => lower.has(name))) surfaces.push("JavaScript / Node");
  if (["pyproject.toml", "requirements.txt", "poetry.lock", "setup.py"].some((name) => lower.has(name))) surfaces.push("Python");
  if (lower.has("go.mod") || lower.has("go.sum")) surfaces.push("Go");
  if (lower.has("cargo.toml") || lower.has("cargo.lock")) surfaces.push("Rust");
  if (lower.has(".github")) surfaces.push("GitHub automation");
  if (lower.has("dockerfile") || lower.has("docker-compose.yml") || lower.has("compose.yml")) surfaces.push("containers");
  if (lower.has("tests") || lower.has("test") || lower.has("__tests__")) surfaces.push("tests");
  if (lower.has("docs") || lower.has("documentation")) surfaces.push("documentation");
  return surfaces;
}

function OverviewStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="flex items-center gap-2 rounded-md border border-border/70 bg-background/30 p-2.5"><Icon className="size-3.5 text-[var(--primary)]" /><span><span className="block text-[10px] text-muted-foreground">{label}</span><span className="block font-mono text-sm font-semibold">{value}</span></span></div>;
}

function DetailTile({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint: string }) {
  return <div className="rounded-md border border-border/70 bg-background/25 p-2.5"><Icon className="size-3.5 text-[var(--primary)]" /><p className="mt-2 text-[10px] text-muted-foreground">{label}</p><p className="truncate font-mono text-xs font-medium">{value}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{hint}</p></div>;
}

function OrientationStep({ index, icon: Icon, title, text }: { index: string; icon: LucideIcon; title: string; text: string }) {
  return <div className="rounded-md border border-border/70 bg-background/25 p-2.5"><div className="flex items-center justify-between"><Icon className="size-3.5 text-[var(--primary)]" /><span className="font-mono text-[10px] text-muted-foreground">{index}</span></div><p className="mt-2 text-[11px] font-medium">{title}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{text}</p></div>;
}

function CiBadge({ state }: { state: GithubRepo["ciState"] }) {
  if (state === "passing") return <Badge variant="success"><CheckCircle2 className="size-3" /> passing</Badge>;
  if (state === "failing") return <Badge variant="destructive"><XCircle className="size-3" /> failing</Badge>;
  if (state === "pending") return <Badge variant="warning"><Clock3 className="size-3" /> pending</Badge>;
  return <Badge variant="outline">{state === "no-checks" ? "no CI" : "unknown CI"}</Badge>;
}

function groupRepos(repos: GithubRepo[]): RepoGroup[] {
  const groups = new Map<string, GithubRepo[]>();
  repos.forEach((repo) => groups.set(repo.ownerLogin, [...(groups.get(repo.ownerLogin) ?? []), repo]));
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([login, items]) => ({ login, repos: items.sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? "")) }));
}

function latestRunByRepo(runs: GithubWorkflowRun[]) {
  const latest = new Map<string, GithubWorkflowRun>();
  runs.forEach((run) => {
    const current = latest.get(run.repoFullName);
    if (!current || run.updatedAt > current.updatedAt) latest.set(run.repoFullName, run);
  });
  return latest;
}

function MapLoading() {
  return <div className="space-y-4"><PageHead title="System map" sub="Loading workspace signals…" /><div className="grid gap-2 sm:grid-cols-3"><div className="h-20 animate-pulse rounded-md border border-border bg-card" /><div className="h-20 animate-pulse rounded-md border border-border bg-card" /><div className="h-20 animate-pulse rounded-md border border-border bg-card" /></div><div className="h-[440px] animate-pulse rounded-md border border-border bg-card" /><div className="h-56 animate-pulse rounded-md border border-border bg-card" /></div>;
}
