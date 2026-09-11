"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { EmptyState, ErrorState } from "@/components/common/error-state";
import { FilterSelect, textOptions } from "@/components/common/filter-select";
import { PageHead } from "@/components/layout/page-head";
import { useIssues } from "@/features/pull-requests/use-prs-issues";
import { ageInDays, timeAgo } from "@/lib/utils";

type Tab = "open" | "closed" | "stale" | "mine" | "all";

export default function IssuesPage() {
  const { issues, repos, isLoading, error } = useIssues();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("open");
  const [org, setOrg] = useState("all");
  const [repo, setRepo] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [label, setLabel] = useState("all");
  const [q, setQ] = useState("");

  const orgOptions = useMemo(
    () => textOptions([...repos.map((r) => r.ownerLogin), ...issues.map((i) => i.orgLogin)], "organizations"),
    [repos, issues],
  );
  const repoOptions = useMemo(() => {
    const names = [
      ...repos
        .filter((r) => org === "all" || r.ownerLogin === org)
        .map((r) => r.fullName),
      ...issues
        .filter((i) => org === "all" || i.orgLogin === org)
        .map((i) => i.repoFullName),
    ];
    return textOptions(names, "repositories");
  }, [repos, issues, org]);
  const assignees = useMemo(
    () => [...new Set(issues.flatMap((i) => i.assignees))].sort(),
    [issues],
  );
  const labels = useMemo(
    () => [...new Set(issues.flatMap((i) => i.labels.map((l) => l.name)))].sort(),
    [issues],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return issues.filter((i) => {
      if (tab === "open" && i.state !== "open") return false;
      if (tab === "closed" && i.state !== "closed") return false;
      if (tab === "stale" && !(i.state === "open" && ageInDays(i.updatedAt) >= 30)) return false;
      if (tab === "mine" && !(i.assignees.length > 0 && i.state === "open")) return false;
      if (org !== "all" && i.orgLogin !== org) return false;
      if (repo !== "all" && i.repoFullName !== repo) return false;
      if (assignee !== "all" && !i.assignees.includes(assignee)) return false;
      if (label !== "all" && !i.labels.some((l) => l.name === label)) return false;
      if (needle && !`${i.title} #${i.number} ${i.repoFullName}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [issues, tab, org, repo, assignee, label, q]);

  const counts = useMemo(
    () => ({
      open: issues.filter((i) => i.state === "open").length,
      closed: issues.filter((i) => i.state === "closed").length,
      stale: issues.filter((i) => i.state === "open" && ageInDays(i.updatedAt) >= 30).length,
      mine: issues.filter((i) => i.state === "open" && i.assignees.length > 0).length,
      all: issues.length,
    }),
    [issues],
  );

  const retry = () => {
    void queryClient.invalidateQueries({ queryKey: ["gity"] });
  };

  if (isLoading && issues.length === 0) {
    return (
      <div className="space-y-4">
        <PageHead title="Issues" sub="Loading…" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error && issues.length === 0) return <ErrorState error={error} onRetry={retry} />;

  return (
    <div className="space-y-3">
      <PageHead title="Issues" sub={`${rows.length} of ${issues.length} issues · pull requests are never counted here`} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          {(Object.keys(counts) as Tab[]).map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t === "mine" ? "assigned" : t} · {counts[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search issues…" className="w-44" />
        <FilterSelect value={org} onChange={(v) => { setOrg(v); setRepo("all"); }} options={orgOptions} label="Organizations" />
        <FilterSelect value={repo} onChange={setRepo} options={repoOptions} label="Repositories" wide />
        <FilterSelect value={assignee} onChange={setAssignee} options={textOptions(assignees, "assignees")} label="Assignees" />
        <FilterSelect value={label} onChange={setLabel} options={textOptions(labels, "labels")} label="Labels" />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No issues" hint="Nothing matches this filter set." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Issue</TH>
              <TH>Repository</TH>
              <TH>Author</TH>
              <TH>State</TH>
              <TH>Assignees</TH>
              <TH>Labels</TH>
              <TH className="text-right">Age</TH>
              <TH className="text-right">Updated</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((i) => (
              <TR key={i.id}>
                <TD>
                  <a href={i.htmlUrl} target="_blank" rel="noopener" className="group text-xs font-medium hover:text-[var(--primary)] hover:underline">
                    <span className="mr-1.5 font-mono text-muted-foreground">#{i.number}</span>
                    {i.title}
                    <ExternalLink className="ml-1 inline size-3 opacity-0 group-hover:opacity-100" />
                  </a>
                  {i.comments > 0 && <p className="text-[11px] text-muted-foreground">{i.comments} comments</p>}
                </TD>
                <TD className="whitespace-nowrap font-mono text-xs"><Link href={`/map?repo=${encodeURIComponent(i.repoFullName)}`} className="hover:text-[var(--primary)] hover:underline" title="Open repository dossier">{i.repoFullName}</Link></TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <Avatar src={i.authorAvatarUrl} alt={i.authorLogin} className="size-4" />
                    {i.authorLogin}
                  </span>
                </TD>
                <TD>
                  {i.state === "open" ? <Badge variant="success">open</Badge> : <Badge variant="info">closed</Badge>}
                </TD>
                <TD className="max-w-32 truncate text-xs text-muted-foreground">
                  {i.assignees.length ? i.assignees.join(", ") : "—"}
                </TD>
                <TD>
                  <span className="flex max-w-44 flex-wrap gap-1">
                    {i.labels.slice(0, 3).map((l) => (
                      <span key={l.name} className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-px text-[10px]">
                        <span className="size-1.5 rounded-full" style={{ background: `#${l.color}` }} />
                        {l.name}
                      </span>
                    ))}
                  </span>
                </TD>
                <TD className="whitespace-nowrap text-right text-xs text-muted-foreground">{Math.floor(ageInDays(i.createdAt))}d</TD>
                <TD className="whitespace-nowrap text-right text-xs text-muted-foreground">{timeAgo(i.updatedAt)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
