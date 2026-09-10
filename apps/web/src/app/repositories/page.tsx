"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FilterSelect, textOptions } from "@/components/common/filter-select";
import { Skeleton } from "@/components/ui/skeleton";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { CiDot } from "@/components/common/ci-dot";
import { EmptyState, ErrorState } from "@/components/common/error-state";
import { PageHead } from "@/components/layout/page-head";
import { useRepositories } from "@/features/repositories/use-repositories";
import { formatNumber, timeAgo } from "@/lib/utils";

type SortKey = "pushed" | "stars" | "name" | "prs" | "issues";

export default function RepositoriesPage() {
  const { repos, isLoading, error } = useRepositories();
  const [q, setQ] = useState("");
  const [org, setOrg] = useState("all");
  const [vis, setVis] = useState("all");
  const [lang, setLang] = useState("all");
  const [arch, setArch] = useState("all");
  const [activity, setActivity] = useState("all");
  const [sort, setSort] = useState<SortKey>("pushed");

  const orgOptions = useMemo(() => textOptions(repos.map((r) => r.ownerLogin), "organizations"), [repos]);
  const languageOptions = useMemo(
    () => textOptions(repos.map((r) => r.primaryLanguage).filter(Boolean) as string[], "languages"),
    [repos],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = repos.filter((r) => {
      if (org !== "all" && r.ownerLogin !== org) return false;
      if (vis !== "all" && (vis === "private") !== r.isPrivate) return false;
      if (lang !== "all" && r.primaryLanguage !== lang) return false;
      if (arch === "archived" && !r.isArchived) return false;
      if (arch === "active" && r.isArchived) return false;
      if (activity === "active" && daysSince(r.pushedAt) > 30) return false;
      if (activity === "inactive" && daysSince(r.pushedAt) <= 30) return false;
      if (needle && !`${r.fullName} ${r.description ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const by: Record<SortKey, (a: (typeof out)[number], b: (typeof out)[number]) => number> = {
      pushed: (a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""),
      stars: (a, b) => b.stars - a.stars,
      name: (a, b) => a.fullName.localeCompare(b.fullName),
      prs: (a, b) => b.openPrCount - a.openPrCount,
      issues: (a, b) => b.openIssueCount - a.openIssueCount,
    };
    return out.sort(by[sort]);
  }, [repos, q, org, vis, lang, arch, activity, sort]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHead title="Repositories" sub="Loading…" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-3">
      <PageHead title="Repositories" sub={`${rows.length} of ${repos.length} repos`} />
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search repos…" className="w-48" />
        <FilterSelect value={org} onChange={setOrg} label="Organizations" options={orgOptions} />
        <FilterSelect value={vis} onChange={setVis} label="Visibility" options={[{ value: "all", label: "All visibility" }, { value: "public", label: "Public" }, { value: "private", label: "Private" }]} />
        <FilterSelect value={lang} onChange={setLang} label="Languages" options={languageOptions} />
        <FilterSelect value={arch} onChange={setArch} label="Archived" options={[{ value: "all", label: "All archived" }, { value: "active", label: "Active" }, { value: "archived", label: "Archived" }]} />
        <FilterSelect value={activity} onChange={setActivity} label="Activity" options={[{ value: "all", label: "All activity" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowDownUp className="size-3" />
          <FilterSelect
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            label="Sort by"
            options={[
              { value: "pushed", label: "Last pushed" },
              { value: "stars", label: "Stars" },
              { value: "name", label: "Name" },
              { value: "prs", label: "Open PRs" },
              { value: "issues", label: "Open issues" },
            ]}
          />
        </span>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No repositories match" hint="Loosen the filters or check token access." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Repository</TH>
              <TH>Owner</TH>
              <TH>Visibility</TH>
              <TH>Language</TH>
              <TH className="text-right">Stars</TH>
              <TH className="text-right">Forks</TH>
              <TH className="text-right">PRs</TH>
              <TH className="text-right">Issues</TH>
              <TH>CI</TH>
              <TH>Branch</TH>
              <TH>Pushed</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((r) => (
              <TR key={r.fullName}>
                <TD>
                  <a href={r.htmlUrl} target="_blank" rel="noopener" className="font-mono text-xs font-medium hover:text-[var(--primary)] hover:underline">
                    {r.name}
                  </a>
                  {r.isArchived && <Badge variant="outline" className="ml-1.5">archived</Badge>}
                  {r.isFork && <Badge variant="outline" className="ml-1.5">fork</Badge>}
                  {r.description && <p className="max-w-56 truncate text-[11px] text-muted-foreground">{r.description}</p>}
                </TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <Avatar src={r.ownerAvatarUrl} alt={r.ownerLogin} className="size-4" />
                    {r.ownerLogin}
                  </span>
                </TD>
                <TD>
                  <Badge variant={r.isPrivate ? "warning" : "success"}>{r.visibility}</Badge>
                </TD>
                <TD>
                  {r.primaryLanguage ? (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="size-2 rounded-full" style={{ background: r.primaryLanguageColor ?? "#888" }} />
                      {r.primaryLanguage}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TD>
                <TD className="text-right font-mono tabular-nums"><span className="inline-flex items-center gap-1"><Star className="size-3 text-muted-foreground" />{formatNumber(r.stars)}</span></TD>
                <TD className="text-right font-mono tabular-nums">{formatNumber(r.forks)}</TD>
                <TD className="text-right font-mono tabular-nums">{r.openPrCount}</TD>
                <TD className="text-right font-mono tabular-nums">{r.openIssueCount}</TD>
                <TD><CiDot state={r.ciState} /></TD>
                <TD className="font-mono text-xs">{r.defaultBranch}</TD>
                <TD className="whitespace-nowrap text-xs text-muted-foreground">{timeAgo(r.pushedAt)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}
