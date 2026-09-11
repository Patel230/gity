"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Code2,
  Database,
  FileText,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  Layers3,
  Network,
  Pause,
  Play,
  RotateCcw,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Workflow,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common/error-state";
import { FilterSelect, textOptions } from "@/components/common/filter-select";
import { PageHead } from "@/components/layout/page-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGraph } from "@/features/graph/use-graph";
import { useRepoServiceCandidates } from "@/features/nexus/use-nexus";
import { WorkspaceMap } from "@/features/nexus/workspace-map";
import { useRepoReferences } from "@/features/repositories/use-repo-snapshot";
import { normalizeBaselineGraph } from "@/lib/nexus/normalize";
import type { NexusEdge, NexusGraphSnapshot, NexusNode, NexusNodeType } from "@/lib/nexus/types";
import type { GithubRepo } from "@/lib/github/types";
import { cn, formatNumber, timeAgo } from "@/lib/utils";

type NexusView = "overview" | "architecture" | "services" | "flows" | "infrastructure" | "repositories" | "explore" | "tour" | "docs" | "changes";

const VIEWS: { id: NexusView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "architecture", label: "Architecture" },
  { id: "services", label: "Services" },
  { id: "flows", label: "Flows" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "repositories", label: "Repositories" },
  { id: "explore", label: "Explore" },
  { id: "tour", label: "Tour" },
  { id: "docs", label: "Docs" },
  { id: "changes", label: "Changes" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All entities" },
  { value: "organization", label: "Organizations" },
  { value: "repository", label: "Repositories" },
  { value: "service", label: "Services" },
  { value: "api", label: "APIs" },
  { value: "event", label: "Events" },
  { value: "topic", label: "Topics" },
  { value: "queue", label: "Queues" },
  { value: "database", label: "Databases" },
  { value: "infrastructure", label: "Infrastructure" },
];

export default function NexusPage() {
  const { repos, runs, isLoading, ciLoading, error, dataUpdatedAt } = useGraph(true);
  const queryClient = useQueryClient();
  const [view, setView] = useState<NexusView>("overview");
  const [orgFilter, setOrgFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [expandedOrganizations, setExpandedOrganizations] = useState<Set<string>>(new Set());
  const [flowServiceId, setFlowServiceId] = useState<string | null>(null);
  const [tourStep, setTourStep] = useState(0);
  const [tourPlaying, setTourPlaying] = useState(false);
  const [repoFocus, setRepoFocus] = useState<string | null>(null);
  const [orgFocus, setOrgFocus] = useState<string | null>(null);
  const [workspaceKey, setWorkspaceKey] = useState(0);

  const scopedRepos = useMemo(() => repos.filter((repo) => orgFilter === "all" || repo.ownerLogin === orgFilter), [orgFilter, repos]);
  const filteredRepos = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scopedRepos.filter((repo) => !needle || `${repo.fullName} ${repo.description ?? ""} ${repo.primaryLanguage ?? ""}`.toLowerCase().includes(needle));
  }, [query, scopedRepos]);
  const references = useRepoReferences(scopedRepos, null);
  const serviceCandidates = useRepoServiceCandidates(scopedRepos);
  const graphUpdatedAt = Math.max(dataUpdatedAt, references.dataUpdatedAt, serviceCandidates.dataUpdatedAt);
  const [refreshing, setRefreshing] = useState(false);
  const graph = useMemo(() => normalizeBaselineGraph({ repos: filteredRepos, references: references.snapshot?.references, services: serviceCandidates.snapshot?.services, signals: serviceCandidates.snapshot?.signals, connections: serviceCandidates.snapshot?.connections, runs, indexedAt: graphUpdatedAt ? new Date(graphUpdatedAt).toISOString() : undefined }), [filteredRepos, graphUpdatedAt, references.snapshot?.references, runs, serviceCandidates.snapshot?.connections, serviceCandidates.snapshot?.services, serviceCandidates.snapshot?.signals]);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = graph.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const orgOptions = useMemo(() => textOptions(repos.map((repo) => repo.ownerLogin), "organizations"), [repos]);
  const latestRunByRepo = useMemo(() => {
    const latest = new Map<string, (typeof runs)[number]>();
    runs.forEach((run) => {
      const current = latest.get(run.repoFullName);
      if (!current || run.updatedAt > current.updatedAt) latest.set(run.repoFullName, run);
    });
    return latest;
  }, [runs]);

  useEffect(() => {
    if (!tourPlaying) return;
    const timer = window.setInterval(() => setTourStep((step) => (step + 1) % TOUR_STEPS.length), 2800);
    return () => window.clearInterval(timer);
  }, [tourPlaying]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const repo = params.get("repo");
    const org = params.get("org");
    if (repo || org) {
      // Intentional URL hydration after SSR.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRepoFocus(repo);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrgFocus(org);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView("repositories");
    }
  }, []);

  function selectNode(node: NexusNode) {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }

  function openRepoDossier(fullName: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("repo", fullName);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    setRepoFocus(fullName);
    setWorkspaceKey((key) => key + 1);
    setView("repositories");
  }

  function toggleOrganization(id: string) {
    setExpandedOrganizations((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function refreshNexus() {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ queryKey: ["gity"], type: "active" });
    } finally {
      setRefreshing(false);
    }
  }

  if (isLoading) return <NexusLoading />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-4">
      <PageHead title="Gitty Nexus" sub={`${filteredRepos.length} repositories · a living architecture baseline grounded in repository evidence`} right={<div className="flex items-center gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => void refreshNexus()} disabled={refreshing}><RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />{refreshing ? "Refreshing" : "Refresh Nexus"}</Button><Badge variant={ciLoading ? "warning" : references.isLoading || serviceCandidates.isLoading ? "info" : "outline"}><Network className="size-3" />{ciLoading ? "checking signals" : references.isLoading ? "indexing references" : serviceCandidates.isLoading ? "indexing services" : graph.indexedAt ? `indexed ${timeAgo(graph.indexedAt)}` : "baseline ready"}</Badge></div>} />
      <Card accent={1}><CardContent className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center"><div className="flex items-center gap-2 lg:mr-2"><span className="grid size-8 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]"><Network className="size-4" /></span><span><span className="block text-xs font-semibold">System understanding</span><span className="block text-[10px] text-muted-foreground">Evidence before inference · visible GitHub scope</span></span></div><div className="relative min-w-0 flex-1 lg:min-w-[220px]"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an organization, repository, or entity…" aria-label="Search Nexus" className="h-8 pl-8 text-xs" /></div><FilterSelect value={orgFilter} onChange={(value) => { setOrgFilter(value); setSelectedNodeId(null); }} label="Organizations" options={orgOptions} wide /><div role="tablist" aria-label="Nexus views" className="flex min-w-0 gap-1 overflow-x-auto border-t border-border/70 pt-2 lg:border-0 lg:pt-0">{VIEWS.map((item) => <Button key={item.id} type="button" role="tab" aria-selected={view === item.id} variant={view === item.id ? "default" : "ghost"} size="sm" onClick={() => setView(item.id)}>{item.label}</Button>)}</div></CardContent></Card>
      {view === "overview" ? <OverviewView graph={graph} repos={filteredRepos} referencesLoading={references.isLoading} serviceCoverage={serviceCandidates.snapshot} onView={setView} /> : null}
      {view === "architecture" ? <ArchitectureView graph={graph} repos={filteredRepos} selectedNode={selectedNode} selectedEdge={selectedEdge} expandedOrganizations={expandedOrganizations} onSelectNode={selectNode} onSelectEdge={(edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }} onToggleOrganization={toggleOrganization} onOpenRepo={openRepoDossier} /> : null}
      {view === "services" ? <ServicesView graph={graph} selectedNode={selectedNode} isLoading={serviceCandidates.isLoading} error={serviceCandidates.error} onSelectNode={selectNode} onOpenRepo={openRepoDossier} onPlayFlow={(serviceId) => { setFlowServiceId(serviceId); setView("flows"); }} /> : null}
      {view === "flows" ? <FlowsView graph={graph} serviceId={flowServiceId} onClearService={() => setFlowServiceId(null)} /> : null}
      {view === "infrastructure" ? <InfrastructureView graph={graph} /> : null}
      {view === "repositories" ? <RepositoriesView focusKey={workspaceKey} initialRepo={repoFocus} initialOrg={orgFocus} /> : null}
      {view === "explore" ? <ExploreView graph={graph} onSelectNode={selectNode} /> : null}
      {view === "tour" ? <TourView step={tourStep} playing={tourPlaying} onStep={setTourStep} onPlay={() => setTourPlaying((playing) => !playing)} onRestart={() => { setTourPlaying(false); setTourStep(0); }} /> : null}
      {view === "docs" ? <DocsView /> : null}
      {view === "changes" ? <ChangesView repos={filteredRepos} latestRunByRepo={latestRunByRepo} onOpenRepo={openRepoDossier} /> : null}
    </div>
  );
}

function OverviewView({ graph, repos, referencesLoading, serviceCoverage, onView }: { graph: NexusGraphSnapshot; repos: GithubRepo[]; referencesLoading: boolean; serviceCoverage: { analyzedRepos: number; totalRepos: number; truncated: boolean } | null; onView: (view: NexusView) => void }) {
  const organizations = graph.nodes.filter((node) => node.type === "organization").length;
  const importedEdges = graph.edges.filter((edge) => edge.type === "imports");
  const confirmed = graph.edges.filter((edge) => edge.confidence === "confirmed").length;
  const byOrg = graph.nodes.filter((node) => node.type === "organization");
  const services = graph.nodes.filter((node) => node.type === "service");
  const explicitConnections = graph.edges.filter((edge) => edge.type === "publishes" || edge.type === "subscribes_to" || edge.type === "calls");
  const count = (type: NexusNodeType) => graph.nodes.filter((node) => node.type === type).length;
  const coverage = serviceCoverage ? `${serviceCoverage.analyzedRepos}/${serviceCoverage.totalRepos} scanned` : "waiting";
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Building2} label="Organizations" value={organizations} hint="visible owners" /><Metric icon={Database} label="Repositories" value={repos.length} hint="visible scope" /><Metric icon={GitFork} label="Verified connections" value={graph.edges.length} hint={`${confirmed} confirmed`} /><Metric icon={Code2} label="Exact imports" value={importedEdges.length} hint={referencesLoading ? "scan in progress" : "evidence-backed"} /><Metric icon={Layers3} label="Service candidates" value={services.length} hint="review before confirmation" /><Metric icon={Workflow} label="API signals" value={count("api")} hint="contract files" /><Metric icon={CircleDot} label="Events / topics" value={count("event") + count("topic")} hint={`${explicitConnections.length} explicit connections`} /><Metric icon={Server} label="Infrastructure" value={count("infrastructure")} hint="config signals" /></div><Card accent={2}><CardHeader><CardTitle>System landscape</CardTitle><CardDescription>Start at an owner boundary, expand a group, then follow only relationships with evidence.</CardDescription></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{byOrg.map((org) => <button key={org.id} type="button" onClick={() => onView("architecture")} className="rounded-md border border-border/70 bg-background/25 p-3 text-left transition hover:border-primary/60 hover:bg-accent"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs font-semibold"><Building2 className="size-3.5 text-[var(--primary)]" />{org.name}</span><Badge variant="outline">{org.metadata.repositoryCount ?? 0} repos</Badge></div><p className="mt-2 text-[10px] text-muted-foreground">Organization boundary · click to open the clustered architecture view</p></button>)}{byOrg.length === 0 ? <EmptyState title="No visible organizations" hint="Check that the connected GitHub token can see repository metadata." /> : null}</div></CardContent></Card><div className="grid gap-4 lg:grid-cols-3"><SignalCard icon={Workflow} title="Contracts" value={count("api") ? `${count("api")} signals` : "Not indexed"} text="OpenAPI, protobuf, and GraphQL-like contract files are attached with evidence." /><SignalCard icon={Server} title="Infrastructure" value={count("infrastructure") ? `${count("infrastructure")} signals` : "Not indexed"} text="Deployment locations will be attached once infrastructure analyzers are available." /><SignalCard icon={ShieldCheck} title="Index coverage" value={coverage} text={serviceCoverage?.truncated ? "This baseline is bounded; refresh or narrow the organization to analyze more sources." : "Manual refresh re-runs the bounded evidence scan without duplicating state."} /></div></div>;
}

function ArchitectureView({ graph, repos, selectedNode, selectedEdge, expandedOrganizations, onSelectNode, onSelectEdge, onToggleOrganization, onOpenRepo }: { graph: NexusGraphSnapshot; repos: GithubRepo[]; selectedNode: NexusNode | null; selectedEdge: NexusEdge | null; expandedOrganizations: Set<string>; onSelectNode: (node: NexusNode) => void; onSelectEdge: (edge: NexusEdge) => void; onToggleOrganization: (id: string) => void; onOpenRepo: (fullName: string) => void }) {
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"><Card accent={2}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-1.5"><Network className="size-3.5 text-[var(--primary)]" /> Architecture</CardTitle><CardDescription>Progressive disclosure: organization → repository → service → evidence-backed connection. Expand an organization to see its repositories, then use the relationship rail for service and interface edges.</CardDescription></div><Badge variant="outline">{graph.nodes.length} entities · {graph.edges.length} edges</Badge></div></CardHeader><CardContent><ArchitectureCanvas graph={graph} repos={repos} expandedOrganizations={expandedOrganizations} selectedNodeId={selectedNode?.id ?? null} selectedEdgeId={selectedEdge?.id ?? null} onSelectNode={onSelectNode} onSelectEdge={onSelectEdge} onToggleOrganization={onToggleOrganization} /><RelationshipRail graph={graph} onSelectEdge={onSelectEdge} /></CardContent></Card><EntityPanel node={selectedNode} edge={selectedEdge} graph={graph} onSelectNode={onSelectNode} onOpenRepo={onOpenRepo} /></div>;
}

function ArchitectureCanvas({ graph, repos, expandedOrganizations, selectedNodeId, selectedEdgeId, onSelectNode, onSelectEdge, onToggleOrganization }: { graph: NexusGraphSnapshot; repos: GithubRepo[]; expandedOrganizations: Set<string>; selectedNodeId: string | null; selectedEdgeId: string | null; onSelectNode: (node: NexusNode) => void; onSelectEdge: (edge: NexusEdge) => void; onToggleOrganization: (id: string) => void }) {
  const orgs = graph.nodes.filter((node) => node.type === "organization").sort((a, b) => a.name.localeCompare(b.name));
  const reposByOrg = new Map<string, NexusNode[]>();
  graph.nodes.filter((node) => node.type === "repository").forEach((node) => { if (node.organizationId) reposByOrg.set(node.organizationId, [...(reposByOrg.get(node.organizationId) ?? []), node]); });
  const nodeWidth = 188;
  const columnWidth = 238;
  const rowHeight = 82;
  const positions = new Map<string, { x: number; y: number }>();
  orgs.forEach((org, column) => { if (!expandedOrganizations.has(org.id)) return; (reposByOrg.get(org.id) ?? []).forEach((node, row) => positions.set(node.id, { x: column * columnWidth + 18, y: 92 + row * rowHeight })); });
  const visibleEdges = graph.edges.filter((edge) => (edge.type === "imports" || edge.type === "depends_on") && positions.has(edge.sourceId) && positions.has(edge.targetId));
  const maxRows = Math.max(1, ...orgs.map((org) => expandedOrganizations.has(org.id) ? (reposByOrg.get(org.id)?.length ?? 0) : 0));
  const width = Math.max(700, orgs.length * columnWidth + 24);
  const height = 130 + maxRows * rowHeight;
  return orgs.length ? <div className="overflow-x-auto pb-1"><div className="relative" style={{ width, height }}><svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${width} ${height}`} aria-label="Architecture connections"><defs><marker id="nexus-edge-arrow" markerHeight="6" markerWidth="6" orient="auto-start-reverse" refX="5" refY="3" viewBox="0 0 6 6"><path d="M0,0 L6,3 L0,6 z" fill="var(--primary)" /></marker></defs>{visibleEdges.map((edge) => { const source = positions.get(edge.sourceId); const target = positions.get(edge.targetId); if (!source || !target) return null; const startX = source.x + nodeWidth; const startY = source.y + 32; const endX = target.x; const endY = target.y + 32; const curveX = (startX + endX) / 2; const active = selectedEdgeId === edge.id || selectedNodeId === edge.sourceId || selectedNodeId === edge.targetId; const path = `M ${startX} ${startY} C ${curveX} ${startY}, ${curveX} ${endY}, ${endX} ${endY}`; return <g key={edge.id}><path d={path} fill="none" stroke="var(--primary)" strokeDasharray={edge.type === "depends_on" ? "4 4" : undefined} strokeOpacity={active ? 0.95 : 0.42} strokeWidth={active ? 2.4 : 1.4} markerEnd="url(#nexus-edge-arrow)" /><path d={path} fill="none" stroke="transparent" strokeWidth="12" className="pointer-events-auto cursor-pointer" onClick={() => onSelectEdge(edge)} aria-label={`Explain ${edge.type} connection`} /></g>; })}</svg>{orgs.map((org, column) => { const children = reposByOrg.get(org.id) ?? []; const expanded = expandedOrganizations.has(org.id); return <div key={org.id} className="absolute" style={{ left: column * columnWidth + 8, top: 4, width: nodeWidth + 20 }}><button type="button" onClick={() => { onSelectNode(org); onToggleOrganization(org.id); }} aria-expanded={expanded} className={cn("flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left transition hover:border-primary/60 hover:bg-accent", selectedNodeId === org.id ? "border-primary ring-1 ring-primary/25" : "border-border/70 bg-background/35")}><span className="flex min-w-0 items-center gap-1.5"><Building2 className="size-3.5 shrink-0 text-[var(--primary)]" /><span className="truncate font-mono text-[11px] font-semibold">{org.name}</span></span><span className="flex items-center gap-1"><Badge variant="outline">{children.length}</Badge><ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} /></span></button>{expanded ? children.map((node, row) => <button key={node.id} type="button" onClick={() => onSelectNode(node)} aria-label={`Inspect repository ${node.name}`} className={cn("absolute left-1 flex h-16 items-center gap-2 rounded-md border bg-card p-2 text-left transition hover:-translate-y-0.5 hover:border-primary/70", selectedNodeId === node.id ? "border-primary ring-2 ring-primary/25" : "border-border/80")} style={{ width: nodeWidth, top: 88 + row * rowHeight }}><span className="grid size-6 shrink-0 place-items-center rounded bg-accent text-[var(--primary)]"><Database className="size-3.5" /></span><span className="min-w-0"><span className="block truncate font-mono text-[11px] font-semibold">{node.name}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{String(node.metadata.language ?? "language undeclared")} · {ciLabel(String(node.metadata.ciState ?? "unknown"))}</span></span></button>) : <button type="button" onClick={() => onToggleOrganization(org.id)} className="mt-2 w-full rounded border border-dashed border-border/70 px-2 py-1.5 text-left text-[10px] text-muted-foreground hover:border-primary/50 hover:text-foreground">Expand {children.length} repositories</button>}</div>; })}<p className="absolute bottom-0 left-1 text-[10px] text-muted-foreground">{repos.length} repositories in this scope · solid = exact import · dashed = verified fork lineage</p></div></div> : <EmptyState title="No architecture entities match" hint="Try clearing the search or organization filter." />;
}

function RelationshipRail({ graph, onSelectEdge }: { graph: NexusGraphSnapshot; onSelectEdge: (edge: NexusEdge) => void }) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const relationships = graph.edges.filter((edge) => ["imports", "depends_on", "calls", "publishes", "subscribes_to"].includes(edge.type)).slice(0, 24);
  return <div className="mt-4 border-t border-border/70 pt-3"><div className="mb-2 flex items-center justify-between gap-2"><div><p className="text-xs font-semibold">System relationships</p><p className="text-[10px] text-muted-foreground">Select an edge to see why it exists and where it was detected.</p></div><Badge variant="outline">{relationships.length} shown</Badge></div>{relationships.length ? <div className="grid gap-1.5 md:grid-cols-2">{relationships.map((edge) => <button key={edge.id} type="button" onClick={() => onSelectEdge(edge)} className="flex min-w-0 items-center gap-2 rounded-md border border-border/70 bg-background/25 px-2.5 py-2 text-left transition hover:border-primary/60 hover:bg-accent"><span className="min-w-0 flex-1 truncate font-mono text-[10px]">{nodes.get(edge.sourceId)?.name ?? edge.sourceId}</span><span className="shrink-0 text-[9px] uppercase tracking-[0.08em] text-[var(--primary)]">{edge.type.replaceAll("_", " ")}</span><ArrowRight className="size-3 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-right font-mono text-[10px]">{nodes.get(edge.targetId)?.name ?? edge.targetId}</span></button>)}</div> : <p className="rounded-md border border-dashed border-border/70 p-2.5 text-[10px] text-muted-foreground">No service or cross-repository relationships are available in this scope.</p>}</div>;
}

function EntityPanel({ node, edge, graph, onSelectNode, onOpenRepo, onPlayFlow = () => undefined }: { node: NexusNode | null; edge: NexusEdge | null; graph: NexusGraphSnapshot; onSelectNode: (node: NexusNode) => void; onOpenRepo: (fullName: string) => void; onPlayFlow?: () => void }) {
  if (edge) { const source = graph.nodes.find((item) => item.id === edge.sourceId); const target = graph.nodes.find((item) => item.id === edge.targetId); return <Card accent={3} className="h-fit"><CardHeader><CardTitle className="flex items-center gap-1.5"><ArrowRight className="size-3.5 text-[var(--primary)]" /> Connection explanation</CardTitle><CardDescription>Why this relationship is present</CardDescription></CardHeader><CardContent className="space-y-3"><div className="rounded-md border border-border/70 bg-background/25 p-2.5"><p className="font-mono text-xs">{source?.name ?? edge.sourceId}</p><p className="my-1 text-[10px] uppercase tracking-[0.12em] text-[var(--primary)]">{edge.type}</p><p className="font-mono text-xs">{target?.name ?? edge.targetId}</p></div><p className="text-xs leading-relaxed text-muted-foreground">{edge.explanation}</p><div className="flex flex-wrap gap-1.5"><Badge variant={edge.confidence === "confirmed" ? "success" : "info"}>{edge.confidence}</Badge><Badge variant="outline">{edge.evidenceIds.length} evidence</Badge>{edge.protocol ? <Badge variant="outline">{edge.protocol}</Badge> : null}</div><p className="text-[10px] text-muted-foreground">Future contract analyzers will add protocol, producer/consumer, and payload summaries here.</p></CardContent></Card>; }
  if (!node) return <Card accent={3} className="h-fit"><CardHeader><CardTitle>Focus an entity</CardTitle><CardDescription>Click a group or repository in the architecture canvas.</CardDescription></CardHeader><CardContent><div className="flex items-center gap-2 rounded-md border border-dashed border-border/70 p-3 text-xs text-muted-foreground"><Network className="size-4 text-[var(--primary)]" />The side panel stays with the graph while you explore.</div></CardContent></Card>;
  const connected = graph.edges.filter((item) => item.sourceId === node.id || item.targetId === node.id);
  const evidence = graph.evidence.filter((item) => node.evidenceIds.includes(item.id));
  if (node.type === "service") return <ServiceProfile node={node} graph={graph} evidence={evidence} onSelectNode={onSelectNode} onOpenRepo={onOpenRepo} onPlayFlow={onPlayFlow} />;
  return <Card accent={3} className="h-fit"><CardHeader><div className="flex items-start justify-between gap-2"><div><p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--primary)]">{node.type}</p><CardTitle>{node.name}</CardTitle></div><Badge variant={node.confidence === "confirmed" ? "success" : "info"}>{node.confidence}</Badge></div><CardDescription>{node.description ?? "No description is available in the current evidence."}</CardDescription></CardHeader><CardContent className="space-y-3"><PanelSection title="Overview"><p className="text-xs text-muted-foreground">{node.type === "organization" ? `${node.metadata.repositoryCount ?? 0} visible repositories` : node.type === "repository" ? `${String(node.metadata.language ?? "Undeclared")} · ${String(node.metadata.branch ?? "default branch")}` : "Workspace scope"}</p></PanelSection><PanelSection title="Connections">{connected.length ? <div className="space-y-1.5">{connected.slice(0, 8).map((item) => { const otherId = item.sourceId === node.id ? item.targetId : item.sourceId; const other = graph.nodes.find((candidate) => candidate.id === otherId); return <button key={item.id} type="button" onClick={() => other && onSelectNode(other)} className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1.5 text-left text-[10px] hover:bg-accent"><span className="min-w-0 truncate"><span className="font-mono">{other?.name ?? otherId}</span><span className="ml-1 text-muted-foreground">· {item.type}</span></span><ArrowRight className="size-3 shrink-0 text-muted-foreground" /></button>; })}</div> : <p className="text-xs text-muted-foreground">No verified connection in this scope.</p>}</PanelSection><PanelSection title="Evidence">{evidence.length ? evidence.map((item) => <div key={item.id} className="flex items-center gap-2 text-[10px] text-muted-foreground"><FileText className="size-3 shrink-0 text-[var(--primary)]" /><span className="truncate">{item.path ?? item.kind}</span><Badge variant="outline" className="ml-auto">{item.kind}</Badge></div>) : <p className="text-xs text-muted-foreground">No file evidence attached; this entity comes from provider metadata.</p>}</PanelSection>{node.type === "repository" ? <button type="button" onClick={() => onOpenRepo(String(node.metadata.fullName ?? node.name))} className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline">Open repository dossier <ArrowUpRight className="size-3" /></button> : null}</CardContent></Card>;
}

function ServiceProfile({ node, graph, evidence, onSelectNode, onOpenRepo, onPlayFlow }: { node: NexusNode; graph: NexusGraphSnapshot; evidence: NexusGraphSnapshot["evidence"]; onSelectNode: (node: NexusNode) => void; onOpenRepo: (fullName: string) => void; onPlayFlow: () => void }) {
  const repository = graph.nodes.find((candidate) => candidate.type === "repository" && node.repositoryIds.includes(candidate.id));
  const nodes = new Map(graph.nodes.map((candidate) => [candidate.id, candidate]));
  const relationships = graph.edges.filter((edge) => (edge.sourceId === node.id || edge.targetId === node.id) && edge.type !== "contains");
  const inputEdgeTypes = new Set(["subscribes_to", "reads_from", "authenticates_via", "triggers"]);
  const upstream = relationships.filter((edge) => edge.targetId === node.id || (edge.sourceId === node.id && inputEdgeTypes.has(edge.type)));
  const downstream = relationships.filter((edge) => !upstream.includes(edge) && (edge.sourceId === node.id || edge.targetId === node.id));
  const summarize = (edges: NexusEdge[], types: string[]) => edges.filter((edge) => types.includes(edge.type)).length;
  const interfaceCount = summarize(relationships, ["calls", "publishes", "subscribes_to"]);
  return <Card accent={3} className="h-fit"><CardHeader><div className="flex items-start justify-between gap-2"><div><p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--primary)]">service profile</p><CardTitle>{node.name}</CardTitle></div><Badge variant={node.confidence === "confirmed" ? "success" : "info"}>{node.confidence}</Badge></div><CardDescription>{node.description ?? "No service description is available in the current evidence."}</CardDescription></CardHeader><CardContent className="space-y-3"><PanelSection title="Overview"><div className="space-y-1 text-xs text-muted-foreground"><p><span className="text-foreground">Repository:</span> {repository?.name ?? "unresolved"}</p><p><span className="text-foreground">Boundary:</span> <span className="font-mono">/{String(node.metadata.path ?? "unknown")}</span></p><p><span className="text-foreground">Runtime:</span> {String(node.metadata.runtime ?? node.runtime ?? "undeclared")}</p><p><span className="text-foreground">Interfaces:</span> {interfaceCount} · <span className="text-foreground">Evidence:</span> {evidence.length}</p></div></PanelSection><PanelSection title="Responsibilities"><p className="text-xs leading-relaxed text-muted-foreground">{node.description ?? "This boundary was detected from repository structure and needs review to establish its responsibilities."}</p></PanelSection><PanelSection title="Upstream / downstream"><div className="space-y-2">{upstream.length ? <RelationshipGroup label="Upstream" nodeId={node.id} edges={upstream} nodes={nodes} onSelectNode={onSelectNode} /> : null}{downstream.length ? <RelationshipGroup label="Downstream" nodeId={node.id} edges={downstream} nodes={nodes} onSelectNode={onSelectNode} /> : null}{!upstream.length && !downstream.length ? <p className="text-xs text-muted-foreground">No relationship edges are available for this service yet.</p> : null}</div></PanelSection><PanelSection title="Evidence">{evidence.length ? evidence.map((item) => <div key={item.id} className="flex items-center gap-2 text-[10px] text-muted-foreground"><FileText className="size-3 shrink-0 text-[var(--primary)]" /><span className="truncate">{item.path ?? item.kind}</span><Badge variant="outline" className="ml-auto">{item.kind}</Badge></div>) : <p className="text-xs text-muted-foreground">No file evidence attached.</p>}</PanelSection>{relationships.length ? <Button type="button" size="sm" onClick={onPlayFlow}><Play className="size-3.5" /> Play related flow</Button> : null}{repository ? <button type="button" onClick={() => onOpenRepo(String(repository.metadata.fullName ?? repository.name))} className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline">Open repository dossier <ArrowUpRight className="size-3" /></button> : null}</CardContent></Card>;
}

function RelationshipGroup({ label, nodeId, edges, nodes, onSelectNode }: { label: string; nodeId: string; edges: NexusEdge[]; nodes: Map<string, NexusNode>; onSelectNode: (node: NexusNode) => void }) {
  return <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">{label}</p><div className="space-y-1">{edges.slice(0, 6).map((edge) => { const neighbor = nodes.get(edge.sourceId === nodeId ? edge.targetId : edge.sourceId); return <button key={edge.id} type="button" onClick={() => neighbor && onSelectNode(neighbor)} className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-[10px] hover:bg-accent"><span className="min-w-0 truncate"><span className="font-mono">{neighbor?.name ?? "unknown"}</span><span className="ml-1 text-muted-foreground">· {edge.type}{edge.protocol ? ` · ${edge.protocol}` : ""}</span></span><Badge variant="outline">{edge.confidence}</Badge></button>; })}</div></div>;
}

function ServicesView({ graph, selectedNode, isLoading, error, onSelectNode, onOpenRepo, onPlayFlow }: { graph: NexusGraphSnapshot; selectedNode: NexusNode | null; isLoading: boolean; error: Error | null; onSelectNode: (node: NexusNode) => void; onOpenRepo: (fullName: string) => void; onPlayFlow: (serviceId: string) => void }) {
  const services = graph.nodes.filter((node) => node.type === "service");
  const focused = selectedNode?.type === "service" ? selectedNode : null;
  if (isLoading) return <Card accent={3}><CardHeader><CardTitle className="flex items-center gap-1.5"><Layers3 className="size-3.5 text-[var(--primary)]" /> Service candidates</CardTitle><CardDescription>Reading explicit service-shaped directories and runtime manifests from the visible repositories…</CardDescription></CardHeader><CardContent><div className="space-y-2"><div className="h-12 animate-pulse rounded-md bg-muted" /><div className="h-12 animate-pulse rounded-md bg-muted" /></div></CardContent></Card>;
  if (error) return <ErrorState error={error} />;
  return services.length ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"><Card accent={3}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-1.5"><Layers3 className="size-3.5 text-[var(--primary)]" /> Service candidates</CardTitle><CardDescription>These are reviewable boundaries, not unquestioned claims. A repository may contain many services or none.</CardDescription></div><Badge variant="outline">{services.length} candidates</Badge></div></CardHeader><CardContent><div className="grid gap-2 md:grid-cols-2">{services.map((service) => <button key={service.id} type="button" onClick={() => onSelectNode(service)} className={cn("rounded-md border p-3 text-left transition hover:border-primary/60 hover:bg-accent", focused?.id === service.id ? "border-primary ring-1 ring-primary/25" : "border-border/70 bg-background/25")}><div className="flex items-start justify-between gap-2"><span className="truncate font-mono text-xs font-semibold">{service.name}</span><Badge variant={service.confidence === "inferred" ? "info" : "warning"}>{service.confidence.replace("_", " ")}</Badge></div><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{service.description}</p><p className="mt-2 truncate font-mono text-[10px] text-[var(--primary)]">{String(service.metadata.repositoryFullName)} · /{String(service.metadata.path)}</p></button>)}</div><p className="mt-3 text-[10px] text-muted-foreground">A candidate becomes a confirmed service only after stronger contract, runtime, deployment, or human-review evidence is available.</p></CardContent></Card><EntityPanel node={focused} edge={null} graph={graph} onSelectNode={onSelectNode} onOpenRepo={onOpenRepo} onPlayFlow={() => focused && onPlayFlow(focused.id)} /></div> : <PlaceholderView icon={Layers3} title="No service candidates detected" description="The current scan found no explicit service-shaped directories or supported runtime manifests in this visible scope. That is not proof that no services exist." items={["Add contracts or runtime metadata to improve detection", "Use the repository dossier to inspect codebase shape", "Future analyzers will cover services, workers, APIs, and deployments"]} />;
}
function FlowsView({ graph, serviceId, onClearService }: { graph: NexusGraphSnapshot; serviceId: string | null; onClearService: () => void }) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const service = serviceId ? nodes.get(serviceId) : null;
  const steps = graph.edges
    .filter((edge) => edge.type === "imports" || edge.type === "depends_on" || edge.type === "publishes" || edge.type === "subscribes_to" || edge.type === "calls")
    .filter((edge) => !serviceId || edge.sourceId === serviceId || edge.targetId === serviceId)
    .map((edge) => ({ edge, source: nodes.get(edge.sourceId), target: nodes.get(edge.targetId) }))
    .filter((step): step is { edge: NexusEdge; source: NexusNode; target: NexusNode } => Boolean(step.source && step.target))
    .slice(0, 8);
  return steps.length ? <FlowPlayer steps={steps} serviceName={service?.name} onClearService={serviceId ? onClearService : undefined} /> : <PlaceholderView icon={Workflow} title="Real flows need real evidence" description={service ? `No evidence-backed relationship trace is available for ${service.name}.` : "No evidence-backed relationship trace is available in this scope. The baseline intentionally does not invent a business flow from repository names or activity order."} items={["Actor → gateway/API → service", "Events, queues, and databases", "Sanitized educational payload summaries", "Future named use-case playback"]} />;
}

function FlowPlayer({ steps, serviceName, onClearService }: { steps: { edge: NexusEdge; source: NexusNode; target: NexusNode }[]; serviceName?: string; onClearService?: () => void }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = steps[step] ?? steps[0];
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setStep((value) => value >= steps.length - 1 ? 0 : value + 1), 2400);
    return () => window.clearInterval(timer);
  }, [playing, steps.length]);
  return <Card accent={4}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-1.5"><Workflow className="size-3.5 text-[var(--primary)]" /> Evidence-backed relationship trace</CardTitle><CardDescription>{serviceName ? `Showing relationships connected to ${serviceName}. ` : "This playback combines verified repository movement with explicit, still-inferred publish, subscribe, and call claims. "}It does not invent a business workflow.</CardDescription></div><div className="flex items-center gap-2">{onClearService ? <Button type="button" size="sm" variant="ghost" onClick={onClearService}>Show all</Button> : null}<Badge variant="info">{steps.length} relationship steps</Badge></div></div></CardHeader><CardContent><div className="rounded-md border border-primary/30 bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] p-3"><div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground"><span className="font-mono uppercase tracking-[0.12em] text-[var(--primary)]">Playing step {step + 1}</span><span>·</span><span>{current.edge.confidence} confidence</span><span>·</span><span>{current.edge.type}</span></div><div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center"><FlowNodeCard node={current.source} active /><div className="flex flex-1 items-center gap-2 text-[var(--primary)]"><span className="h-px flex-1 bg-primary/40" /><span className="relative grid size-8 shrink-0 place-items-center rounded-full border border-primary/45 bg-background"><span className="absolute inset-1 rounded-full bg-primary/25 animate-ping" /><ArrowRight className="relative size-4" /></span><span className="h-px flex-1 bg-primary/40" /></div><FlowNodeCard node={current.target} active /></div><p className="mt-3 text-[10px] text-muted-foreground">{current.edge.explanation}</p><div className="mt-2 flex items-center gap-2"><FileText className="size-3 shrink-0 text-[var(--primary)]" /><span className="truncate text-[10px] text-muted-foreground">{current.edge.evidenceIds.length ? "Evidence attached to this relationship" : "Provider relationship metadata"}</span></div></div><div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">{steps.map((item, index) => <button key={item.edge.id} type="button" onClick={() => { setPlaying(false); setStep(index); }} className={cn("min-w-[150px] rounded-md border p-2 text-left", index === step ? "border-primary bg-accent" : "border-border/70 hover:bg-accent")}><span className="font-mono text-[10px] text-[var(--primary)]">{String(index + 1).padStart(2, "0")}</span><span className="mt-1 block truncate text-[10px] font-medium">{item.source.name} → {item.target.name}</span><span className="mt-1 block text-[9px] text-muted-foreground">{item.edge.type} · {item.edge.confidence}</span></button>)}</div><div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3"><Button type="button" size="sm" variant="secondary" onClick={() => { setPlaying(false); setStep((value) => Math.max(0, value - 1)); }} disabled={step === 0}>Previous</Button><Button type="button" size="sm" onClick={() => { setPlaying(false); setStep((value) => value >= steps.length - 1 ? 0 : value + 1); }}>Next</Button><Button type="button" size="sm" variant="outline" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}{playing ? "Pause" : "Play"}</Button><Button type="button" size="sm" variant="ghost" onClick={() => { setPlaying(false); setStep(0); }}><RotateCcw className="size-3.5" /> Restart</Button></div></CardContent></Card>;
}

function FlowNodeCard({ node, active }: { node: NexusNode; active?: boolean }) { return <div className={cn("min-w-0 flex-1 rounded-md border bg-card p-3", active ? "border-primary ring-1 ring-primary/25" : "border-border/70")}><div className="flex items-center gap-2"><span className="grid size-7 shrink-0 place-items-center rounded bg-accent text-[var(--primary)]"><Database className="size-3.5" /></span><span className="min-w-0"><span className="block truncate font-mono text-xs font-semibold">{node.name}</span><span className="block text-[10px] text-muted-foreground">{node.type}</span></span></div></div>; }
function InfrastructureView({ graph }: { graph: NexusGraphSnapshot }) {
  const infrastructure = graph.nodes.filter((node) => node.type === "infrastructure");
  return infrastructure.length ? <Card accent={5}><CardHeader><CardTitle className="flex items-center gap-1.5"><Server className="size-3.5 text-[var(--primary)]" /> Infrastructure signals</CardTitle><CardDescription>Configuration evidence is visible now; deployment location remains unconfirmed until an infrastructure analyzer resolves it.</CardDescription></CardHeader><CardContent><div className="grid gap-2 md:grid-cols-2">{infrastructure.map((node) => <div key={node.id} className="rounded-md border border-border/70 bg-background/25 p-3"><div className="flex items-start justify-between gap-2"><span className="font-mono text-xs font-semibold">{node.name}</span><Badge variant="info">{node.confidence}</Badge></div><p className="mt-2 text-[10px] text-muted-foreground">{node.description}</p><p className="mt-2 truncate font-mono text-[10px] text-[var(--primary)]">{String(node.metadata.repositoryFullName)} · /{String(node.metadata.path)}</p></div>)}</div><p className="mt-3 text-[10px] text-muted-foreground">Next: connect these signals to service deployments, environments, clusters, queues, databases, and external resources.</p></CardContent></Card> : <PlaceholderView icon={Server} title="Infrastructure is not indexed yet" description="The infrastructure view will connect services to deployment locations and environments once Terraform, Kubernetes, workflow, and runtime analyzers are available." items={["Runtime and environment", "Deployment and infrastructure resources", "Where a service runs", "Evidence path and confidence"]} />;
}
function RepositoriesView({ focusKey, initialRepo, initialOrg }: { focusKey: number; initialRepo: string | null; initialOrg: string | null }) {
  return <WorkspaceMap key={focusKey} initialRepo={initialRepo} initialOrg={initialOrg} />;
}
function ExploreView({ graph, onSelectNode }: { graph: NexusGraphSnapshot; onSelectNode: (node: NexusNode) => void }) {
  const [typeFilter, setTypeFilter] = useState<NexusNodeType | "all">("all");
  const groups = new Map<NexusNodeType, NexusNode[]>();
  graph.nodes.filter((node) => typeFilter === "all" || node.type === typeFilter).forEach((node) => groups.set(node.type, [...(groups.get(node.type) ?? []), node]));
  return <Card accent={2}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-1.5"><Search className="size-3.5 text-[var(--primary)]" /> Explore entities</CardTitle><CardDescription>Search uses the normalized graph vocabulary. Current baseline entities are organizations and repositories; deeper entity types arrive through indexing phases.</CardDescription></div><FilterSelect value={typeFilter} onChange={(value) => setTypeFilter(value as NexusNodeType | "all")} label="Entity type" options={TYPE_OPTIONS} /></div></CardHeader><CardContent className="space-y-4">{[...groups.entries()].map(([type, nodes]) => <div key={type}><div className="mb-2 flex items-center gap-2"><Badge variant="outline">{type}</Badge><span className="text-[10px] text-muted-foreground">{nodes.length} entities</span></div><div className="flex flex-wrap gap-1.5">{nodes.slice(0, 40).map((node) => <button key={node.id} type="button" onClick={() => onSelectNode(node)} className="inline-flex items-center gap-1.5 rounded border border-border/70 bg-background/25 px-2 py-1.5 text-left text-[10px] hover:border-primary/60 hover:bg-accent"><span className="font-mono">{node.name}</span><span className="text-muted-foreground">{node.confidence}</span></button>)}</div></div>)}{groups.size === 0 ? <p className="text-xs text-muted-foreground">No entities match this type filter.</p> : null}</CardContent></Card>;
}

const TOUR_STEPS = [
  { title: "Start with the workspace", text: "Nexus begins with the visible GitHub scope and keeps provider facts separate from future inference." },
  { title: "Expand an organization", text: "Organization groups are collapsed by default so a large workspace does not become a spaghetti graph." },
  { title: "Inspect a repository", text: "Repository nodes open the workspace dossier while remaining part of the larger system model." },
  { title: "Follow evidence-backed edges", text: "Solid edges are exact code references; dashed edges are verified GitHub fork lineage." },
  { title: "Grow into services and flows", text: "Service, interface, infrastructure, and real use-case flow analyzers will attach to this same normalized graph." },
];
function TourView({ step, playing, onStep, onPlay, onRestart }: { step: number; playing: boolean; onStep: (step: number) => void; onPlay: () => void; onRestart: () => void }) { const current = TOUR_STEPS[step] ?? TOUR_STEPS[0]; return <Card accent={4}><CardHeader><CardTitle className="flex items-center gap-1.5"><Play className="size-3.5 text-[var(--primary)]" /> Nexus tour</CardTitle><CardDescription>A short textual/visual model of how to read the architecture surface.</CardDescription></CardHeader><CardContent><div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]"><div className="rounded-md border border-primary/35 bg-[color-mix(in_srgb,var(--primary)_6%,transparent)] p-4"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--primary)]">Step {step + 1} of {TOUR_STEPS.length}</p><h3 className="mt-2 text-base font-semibold">{current.title}</h3><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{current.text}</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => onStep(Math.max(0, step - 1))} disabled={step === 0}>Previous</Button><Button type="button" size="sm" onClick={() => onStep((step + 1) % TOUR_STEPS.length)}>{step === TOUR_STEPS.length - 1 ? "Restart" : "Next"}</Button><Button type="button" size="sm" variant="outline" onClick={onPlay}>{playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}{playing ? "Pause" : "Play"}</Button><Button type="button" size="sm" variant="ghost" onClick={onRestart}><RotateCcw className="size-3.5" /> Restart</Button></div></div><div className="space-y-2">{TOUR_STEPS.map((item, index) => <button key={item.title} type="button" onClick={() => onStep(index)} className={cn("flex w-full items-start gap-2 rounded-md border p-2.5 text-left", index === step ? "border-primary bg-accent" : "border-border/70 hover:bg-accent")}><span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted font-mono text-[10px]">{index + 1}</span><span><span className="block text-xs font-medium">{item.title}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{item.text}</span></span></button>)}</div></div></CardContent></Card>; }

function DocsView() { return <div className="grid gap-4 lg:grid-cols-2"><Card accent={5}><CardHeader><CardTitle className="flex items-center gap-1.5"><FileText className="size-3.5 text-[var(--primary)]" /> Nexus documentation</CardTitle><CardDescription>Architecture decisions live beside the implementation so the model can evolve coherently.</CardDescription></CardHeader><CardContent className="space-y-2 text-xs text-muted-foreground"><p><strong className="text-foreground">Evidence first.</strong> Provider metadata and deterministic evidence are distinct from inferred conclusions.</p><p><strong className="text-foreground">Progressive disclosure.</strong> Organization and domain groups are expanded before services and interfaces.</p><p><strong className="text-foreground">Repositories.</strong> Ownership, references, codebase shape, commits, and current work live in the Nexus repository workspace — no separate map needed.</p></CardContent></Card><PlaceholderView icon={FileText} title="Documentation context is next" description="Repository docs will become evidence attached to services and flows, not an absolute source of truth. Drift detection will compare documentation with detected architecture." items={["README and design-doc context", "Contract/documentation drift", "Source locator and confidence", "Reviewable architecture notes"]} /></div>; }
function ChangesView({ repos, latestRunByRepo, onOpenRepo }: { repos: GithubRepo[]; latestRunByRepo: Map<string, { workflowName: string; status: string; conclusion: string | null; updatedAt: string }>; onOpenRepo: (fullName: string) => void }) { const ordered = repos.slice().sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? "")).slice(0, 12); return <Card accent={6}><CardHeader><CardTitle className="flex items-center gap-1.5"><GitCommitHorizontal className="size-3.5 text-[var(--primary)]" /> Architectural changes</CardTitle><CardDescription>Recent repository and delivery signals are visible now; affected-service analysis will follow the service index.</CardDescription></CardHeader><CardContent><div className="space-y-1.5">{ordered.map((repo) => { const run = latestRunByRepo.get(repo.fullName); return <button key={repo.fullName} type="button" onClick={() => onOpenRepo(repo.fullName)} className="flex w-full items-center gap-3 rounded-md border border-border/70 bg-background/25 px-3 py-2.5 text-left hover:border-primary/60 hover:bg-accent"><span className="grid size-7 shrink-0 place-items-center rounded bg-accent text-[var(--primary)]"><GitBranch className="size-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate font-mono text-xs font-medium">{repo.fullName}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">pushed {timeAgo(repo.pushedAt)} · {repo.primaryLanguage ?? "language undeclared"}</span></span>{run ? <Badge variant={run.conclusion === "failure" ? "destructive" : run.status === "in_progress" ? "info" : "outline"}>{run.workflowName} · {run.conclusion ?? run.status}</Badge> : <Badge variant="outline">no Actions run</Badge>}<ArrowRight className="size-3 shrink-0 text-muted-foreground" /></button>; })}{ordered.length === 0 ? <EmptyState title="No recent changes" hint="No repositories match this scope." /> : null}</div><p className="mt-3 text-[10px] text-muted-foreground">This view does not claim a service was affected until architecture evidence can support that conclusion.</p></CardContent></Card>; }

function PlaceholderView({ icon: Icon, title, description, items }: { icon: LucideIcon; title: string; description: string; items: string[] }) { return <Card accent={3}><CardHeader><CardTitle className="flex items-center gap-1.5"><Icon className="size-3.5 text-[var(--primary)]" /> {title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2">{items.map((item) => <div key={item} className="flex items-center gap-2 rounded-md border border-dashed border-border/70 bg-background/20 p-3 text-xs text-muted-foreground"><CircleDot className="size-3.5 shrink-0 text-[var(--primary)]" />{item}</div>)}</div></CardContent></Card>; }
function Metric({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: number | string; hint: string }) { return <Card><CardContent className="flex items-center gap-3 py-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-[var(--primary)]"><Icon className="size-4" /></span><span className="min-w-0"><span className="block text-[10px] text-muted-foreground">{label}</span><span className="block text-lg font-semibold leading-tight">{typeof value === "number" ? formatNumber(value) : value}</span><span className="block truncate text-[10px] text-muted-foreground">{hint}</span></span></CardContent></Card>; }
function SignalCard({ icon: Icon, title, value, text }: { icon: LucideIcon; title: string; value: string; text: string }) { return <Card><CardContent className="space-y-2 py-3"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs font-medium"><Icon className="size-3.5 text-[var(--primary)]" />{title}</span><Badge variant="outline">{value}</Badge></div><p className="text-[10px] leading-relaxed text-muted-foreground">{text}</p></CardContent></Card>; }
function PanelSection({ title, children }: { title: string; children: React.ReactNode }) { return <div className="border-t border-border/70 pt-3 first:border-t-0 first:pt-0"><p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{title}</p>{children}</div>; }
function CiBadge({ state }: { state: GithubRepo["ciState"] }) { if (state === "passing") return <Badge variant="success"><CheckCircle2 className="size-3" />passing</Badge>; if (state === "failing") return <Badge variant="destructive"><XCircle className="size-3" />failing</Badge>; if (state === "pending") return <Badge variant="warning"><Clock3 className="size-3" />pending</Badge>; return <Badge variant="outline">{state === "no-checks" ? "no CI" : "unchecked"}</Badge>; }
function ciLabel(value: string) { return value === "passing" ? "healthy" : value === "failing" ? "failing" : value === "pending" ? "pending" : value === "no-checks" ? "no CI" : "unchecked"; }
function NexusLoading() { return <div className="space-y-4"><PageHead title="Gitty Nexus" sub="Loading architecture baseline…" /><div className="grid gap-3 sm:grid-cols-3"><div className="h-20 animate-pulse rounded-md border border-border bg-card" /><div className="h-20 animate-pulse rounded-md border border-border bg-card" /><div className="h-20 animate-pulse rounded-md border border-border bg-card" /></div><div className="h-[420px] animate-pulse rounded-md border border-border bg-card" /></div>; }
