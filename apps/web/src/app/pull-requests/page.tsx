"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { EmptyState, ErrorState } from "@/components/common/error-state";
import { CiDot } from "@/components/common/ci-dot";
import { FilterSelect, textOptions } from "@/components/common/filter-select";
import { PageHead } from "@/components/layout/page-head";
import { usePullRequests } from "@/features/pull-requests/use-prs-issues";
import type { GithubPullRequest } from "@/lib/github/types";
import { ageInDays, timeAgo } from "@/lib/utils";

type Tab = "open" | "draft" | "review" | "approved" | "merged" | "closed" | "stale" | "all";

export default function PullRequestsPage() {
  const { prs, repos, prCiStates, isLoading, error } = usePullRequests();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("open");
  const [org, setOrg] = useState("all");
  const [repo, setRepo] = useState("all");
  const [author, setAuthor] = useState("all");
  const [q, setQ] = useState("");

  const orgOptions = useMemo(
    () => textOptions([...repos.map((r) => r.ownerLogin), ...prs.map((p) => p.orgLogin)], "organizations"),
    [repos, prs],
  );
  const repoOptions = useMemo(() => {
    const names = [
      ...repos
        .filter((r) => org === "all" || r.ownerLogin === org)
        .map((r) => r.fullName),
      ...prs
        .filter((p) => org === "all" || p.orgLogin === org)
        .map((p) => p.repoFullName),
    ];
    return textOptions(names, "repositories");
  }, [repos, prs, org]);
  const authorOptions = useMemo(() => textOptions(prs.map((p) => p.authorLogin), "authors"), [prs]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return prs.filter((p) => {
      if (tab === "open" && !(p.state === "open" || p.state === "draft")) return false;
      if (tab === "draft" && p.state !== "draft") return false;
      if (tab === "review" && !(p.reviewRequested || p.reviewState === "review_required")) return false;
      if (tab === "approved" && p.reviewState !== "approved") return false;
      if (tab === "merged" && p.state !== "merged") return false;
      if (tab === "closed" && p.state !== "closed") return false;
      if (tab === "stale" && !(ageInDays(p.updatedAt) >= 30 && (p.state === "open" || p.state === "draft"))) return false;
      if (org !== "all" && p.orgLogin !== org) return false;
      if (repo !== "all" && p.repoFullName !== repo) return false;
      if (author !== "all" && p.authorLogin !== author) return false;
      if (needle && !`${p.title} #${p.number} ${p.repoFullName}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [prs, tab, org, repo, author, q]);

  const counts = useMemo(() => countBy(prs), [prs]);

  const retry = () => {
    void queryClient.invalidateQueries({ queryKey: ["gity"] });
  };

  if (isLoading && prs.length === 0) {
    return (
      <div className="space-y-4">
        <PageHead title="Pull requests" sub="Loading…" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error && prs.length === 0) return <ErrorState error={error} onRetry={retry} />;

  return (
    <div className="space-y-3">
      <PageHead title="Pull requests" sub={`${rows.length} of ${prs.length} PRs · click to open on GitHub`} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          {(Object.keys(counts) as Tab[]).map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t} · {counts[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search PRs…" className="w-44" />
        <FilterSelect value={org} onChange={(v) => { setOrg(v); setRepo("all"); }} options={orgOptions} label="Organizations" />
        <FilterSelect value={repo} onChange={setRepo} options={repoOptions} label="Repositories" wide />
        <FilterSelect value={author} onChange={setAuthor} options={authorOptions} label="Authors" />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No pull requests" hint="Nothing matches this filter set. PR coverage comes from repos you can access." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>PR</TH>
              <TH>Repository</TH>
              <TH>Author</TH>
              <TH>State</TH>
              <TH>Review</TH>
              <TH>CI/CD</TH>
              <TH className="text-right">Age</TH>
              <TH className="text-right">Updated</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((p) => (
              <TR key={p.id}>
                <TD>
                  <a href={p.htmlUrl} target="_blank" rel="noopener" className="group text-xs font-medium hover:text-[var(--primary)] hover:underline">
                    <span className="mr-1.5 font-mono text-muted-foreground">#{p.number}</span>
                    {p.title}
                    <ExternalLink className="ml-1 inline size-3 opacity-0 group-hover:opacity-100" />
                  </a>
                  {(p.additions > 0 || p.deletions > 0) && (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      <span className="text-[var(--success)]">+{p.additions}</span>{" "}
                      <span className="text-[var(--destructive)]">−{p.deletions}</span>
                      {" · "}{p.changedFiles} files
                    </p>
                  )}
                </TD>
                <TD className="whitespace-nowrap font-mono text-xs">{p.repoFullName}</TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <Avatar src={p.authorAvatarUrl} alt={p.authorLogin} className="size-4" />
                    {p.authorLogin}
                  </span>
                </TD>
                <TD><StateBadge state={p.state} /></TD>
                <TD><ReviewBadge p={p} /></TD>
                <TD><CiDot state={prCiStates[`${p.repoFullName}#${p.number}`] ?? "unknown"} showLabel /></TD>
                <TD className="whitespace-nowrap text-right text-xs text-muted-foreground">{Math.floor(ageInDays(p.createdAt))}d</TD>
                <TD className="whitespace-nowrap text-right text-xs text-muted-foreground">{timeAgo(p.updatedAt)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
      {repos.length === 0 && null}
    </div>
  );
}

function countBy(prs: GithubPullRequest[]): Record<Tab, number> {
  const open = prs.filter((p) => p.state === "open" || p.state === "draft");
  return {
    open: open.length,
    draft: prs.filter((p) => p.state === "draft").length,
    review: prs.filter((p) => p.reviewRequested || p.reviewState === "review_required").length,
    approved: prs.filter((p) => p.reviewState === "approved").length,
    merged: prs.filter((p) => p.state === "merged").length,
    closed: prs.filter((p) => p.state === "closed").length,
    stale: open.filter((p) => ageInDays(p.updatedAt) >= 30).length,
    all: prs.length,
  };
}

function StateBadge({ state }: { state: GithubPullRequest["state"] }) {
  const map = {
    open: <Badge variant="success">open</Badge>,
    draft: <Badge variant="outline">draft</Badge>,
    merged: <Badge variant="info">merged</Badge>,
    closed: <Badge variant="destructive">closed</Badge>,
  };
  return map[state];
}

function ReviewBadge({ p }: { p: GithubPullRequest }) {
  switch (p.reviewState) {
    case "approved":
      return <Badge variant="success">approved</Badge>;
    case "changes_requested":
      return <Badge variant="destructive">changes requested</Badge>;
    case "review_required":
      return <Badge variant="warning">review requested</Badge>;
    case "commented":
      return <Badge variant="default">commented</Badge>;
    default:
      return <span className="whitespace-nowrap text-xs text-muted-foreground">Not reviewed</span>;
  }
}
