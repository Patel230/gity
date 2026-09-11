"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, ChevronDown, ChevronRight, CircleDot, Database, GitPullRequest, Map as MapIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/error-state";
import { PageHead } from "@/components/layout/page-head";
import { useOrganizations } from "@/features/organizations/use-organizations";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function OrganizationsPage() {
  const { orgs, isLoading, error } = useOrganizations();
  const [open, setOpen] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHead title="Organizations" sub="Loading…" />
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }
  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-4">
      <PageHead
        title="Organizations"
        sub={`${orgs.length} organization scope(s) accessible to you`}
        right={
          <Link href="/map" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-xs font-medium transition-colors hover:border-primary/60 hover:bg-accent">
            <MapIcon className="size-3.5 text-[var(--primary)]" />
            Open system map
          </Link>
        }
      />
      {orgs.length === 0 && (
        <EmptyState title="No organizations" hint="Your token can't see any orgs. Personal repos (if any) would appear here too." />
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {orgs.map((o, index) => {
          const expanded = open === o.login;
          return (
            <Card key={o.login} accent={(index % 20) + 1}>
              <CardContent className="pt-3.5">
                <button
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => setOpen(expanded ? null : o.login)}
                >
                  <Avatar src={o.avatarUrl} alt={o.login} className="size-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {o.name ?? o.login}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {o.login}
                    </span>
                  </span>
                  <span className="hidden shrink-0 gap-1.5 sm:flex">
                    <Badge variant="default">
                      <Database className="size-3" /> {o.repoCount}
                    </Badge>
                    <Badge variant="info">
                      <GitPullRequest className="size-3" /> {o.openPrCount}
                    </Badge>
                    <Badge variant="warning">
                      <CircleDot className="size-3" /> {o.openIssueCount}
                    </Badge>
                  </span>
                  {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1 sm:hidden">
                    <Building2 className="size-3" /> {o.repoCount} repos · {o.openPrCount} PRs · {o.openIssueCount} issues
                  </span>
                  <span className="hidden sm:inline">{o.description ?? "No description"}</span>
                  <span>active {timeAgo(o.lastActivityAt)}</span>
                </div>
                <div className={cn("grid transition-all", expanded ? "mt-2 grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="overflow-hidden">
                    <div className="space-y-0.5 border-t border-border pt-2">
                      {(o.repos ?? []).slice(0, 20).map((r) => (
                        <Link key={r.fullName} href={`/map?repo=${encodeURIComponent(r.fullName)}`} className="flex items-center justify-between rounded px-1.5 py-1 font-mono text-xs hover:bg-accent" title="Open repository dossier">
                          <span className="truncate">{r.name}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {r.openPrCount} PR · {r.openIssueCount} issues · {timeAgo(r.pushedAt)}
                          </span>
                        </Link>
                      ))}
                      {(o.repos ?? []).length > 20 && (
                        <p className="px-1.5 py-1 text-[11px] text-muted-foreground">
                          +{(o.repos ?? []).length - 20} more — see Repos filtered by org
                        </p>
                      )}
                      <Link href={`/map?org=${encodeURIComponent(o.login)}`} className="mt-1 inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-[var(--primary)] hover:bg-accent hover:underline">
                        <MapIcon className="size-3" /> Map this organization
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
