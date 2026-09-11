"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";

const REPO_URL = "https://github.com/Patel230/gity";
// Same-origin relay follows GitHub's canonical redirect server-side, so no
// CORS preflight/redirect issue. Logged-out visitors get a 401 here and fall
// through to the direct canonical URL below.
const RELAY_URL = `/api/github?url=${encodeURIComponent("https://api.github.com/repos/Patel230/gity")}`;
// Canonical repository URL (stable numeric ID): api.github.com answers this
// directly with `Access-Control-Allow-Origin: *`, unlike the 301 from
// /repos/{owner}/{name} whose redirect response carries no CORS headers.
const DIRECT_URL = "https://api.github.com/repositories/1362500092";

async function fetchStarCount(): Promise<number | null> {
  const parse = async (response: Response): Promise<number | null> => {
    if (!response.ok) return null;
    const repo: { stargazers_count?: number } | null = await response.json().catch(() => null);
    return typeof repo?.stargazers_count === "number" ? repo.stargazers_count : null;
  };
  try {
    const stars = await parse(await fetch(RELAY_URL, { headers: { Accept: "application/vnd.github+json" } }));
    if (stars !== null) return stars;
  } catch {
    /* relay unreachable or sessionless: fall through to direct */
  }
  try {
    return await parse(await fetch(DIRECT_URL, { headers: { Accept: "application/vnd.github+json" } }));
  } catch {
    return null;
  }
}

export function GithubStarLink({ compact = false }: { compact?: boolean }) {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void fetchStarCount().then((count) => {
      if (active && count !== null) setStars(count);
    });
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
