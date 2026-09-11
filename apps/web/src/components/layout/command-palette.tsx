"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CircleDot,
  Database,
  FileText,
  GitPullRequest,
  Search,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { GithubIssue, GithubPullRequest, GithubRepo } from "@/lib/github/types";

export interface PaletteData {
  repos: GithubRepo[];
  prs: GithubPullRequest[];
  issues: GithubIssue[];
  orgs: string[];
}

const LIMIT = 8;

/** Global command/search palette (⌘K / Ctrl+K): repos, PRs, issues, orgs. */
export function CommandPalette({ data }: { data: PaletteData }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    const match = (s: string) => s.toLowerCase().includes(needle);
    return {
      repos: data.repos.filter((r) => match(r.fullName)).slice(0, LIMIT),
      prs: data.prs
        .filter((p) => match(p.title) || match(`#${p.number}`) || match(p.repoFullName))
        .slice(0, LIMIT),
      issues: data.issues
        .filter((i) => match(i.title) || match(`#${i.number}`) || match(i.repoFullName))
        .slice(0, LIMIT),
      orgs: data.orgs.filter((o) => match(o)).slice(0, LIMIT),
    };
  }, [q, data]);

  const go = (url: string) => {
    setOpen(false);
    setQ("");
    window.open(url, "_blank", "noopener");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden h-8 w-64 min-w-0 items-center gap-2 rounded-md border border-input bg-transparent px-2.5 text-xs text-muted-foreground hover:bg-accent md:inline-flex"
      >
        <Search className="size-3.5" />
        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">Search repos, PRs, issues…</span>
        <kbd className="rounded border border-border px-1 font-mono text-[10px]">⌘K</kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input md:hidden"
        aria-label="Search"
      >
        <Search className="size-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[8%] max-w-xl p-0">
          <div className="border-b border-border p-2">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search repositories, PRs, issues, organizations…"
              className="border-0 focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[50vh] overflow-auto p-2">
            {!results ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                Type to search across {data.repos.length} repos, {data.prs.length} PRs,{" "}
                {data.issues.length} issues.
              </p>
            ) : (
              <>
                <PaletteGroup
                  icon={<Building2 className="size-3.5" />}
                  title="Organizations"
                  empty="No matching orgs"
                  items={results.orgs.map((o) => ({
                    key: o,
                    label: o,
                    onPick: () => {
                      setOpen(false);
                      router.push(`/nexus?org=${encodeURIComponent(o)}`);
                    },
                  }))}
                />
                <PaletteGroup
                  icon={<Database className="size-3.5" />}
                  title="Repositories"
                  empty="No matching repos"
                  items={results.repos.map((r) => ({
                    key: r.fullName,
                    label: r.fullName,
                    sub: r.description ?? undefined,
                    onPick: () => {
                      setOpen(false);
                      setQ("");
                      router.push(`/nexus?repo=${encodeURIComponent(r.fullName)}`);
                    },
                  }))}
                />
                <PaletteGroup
                  icon={<GitPullRequest className="size-3.5" />}
                  title="Pull requests"
                  empty="No matching PRs"
                  items={results.prs.map((p) => ({
                    key: p.id,
                    label: `#${p.number} ${p.title}`,
                    sub: p.repoFullName,
                    onPick: () => go(p.htmlUrl),
                  }))}
                />
                <PaletteGroup
                  icon={<CircleDot className="size-3.5" />}
                  title="Issues"
                  empty="No matching issues"
                  items={results.issues.map((i) => ({
                    key: i.id,
                    label: `#${i.number} ${i.title}`,
                    sub: i.repoFullName,
                    onPick: () => go(i.htmlUrl),
                  }))}
                />
              </>
            )}
          </div>
          <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <FileText className="size-3" /> External links open github.com in a new tab
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PaletteGroup({
  icon,
  title,
  items,
  empty,
}: {
  icon: React.ReactNode;
  title: string;
  empty: string;
  items: { key: string; label: string; sub?: string; onPick: () => void }[];
}) {
  if (items.length === 0)
    return (
      <div className="px-2 py-2">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {icon} {title}
        </p>
        <p className="mt-1 pl-5 text-xs text-muted-foreground/70">{empty}</p>
      </div>
    );
  return (
    <div className="px-2 py-2">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon} {title}
      </p>
      <ul className="mt-1">
        {items.map((it) => (
          <li key={it.key}>
            <button
              onClick={it.onPick}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
            >
              <Avatar alt={it.label} className="size-5" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{it.label}</span>
                {it.sub ? (
                  <span className="block truncate text-[11px] text-muted-foreground">{it.sub}</span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
