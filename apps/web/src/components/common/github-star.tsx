"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";

const REPO_URL = "https://github.com/Patel230/gity";

export function GithubStarLink({ compact = false }: { compact?: boolean }) {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch("https://api.github.com/repos/Patel230/gity", { headers: { Accept: "application/vnd.github+json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((repo: { stargazers_count?: number } | null) => {
        if (active && typeof repo?.stargazers_count === "number") setStars(repo.stargazers_count);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={compact
        ? "inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        : "inline-flex items-center gap-2 rounded-md border border-border bg-card/70 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-[var(--primary)] hover:text-foreground"}
      aria-label="View Gity on GitHub"
    >
      <Star className="size-3.5 text-[var(--warning)]" />
      <span>{compact ? "GitHub" : "View on GitHub"}</span>
      {!compact && <span className="border-l border-border pl-2 font-mono tabular-nums">★ {stars ?? "—"}</span>}
    </a>
  );
}
