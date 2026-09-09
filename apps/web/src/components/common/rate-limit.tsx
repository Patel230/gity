"use client";

import { Gauge } from "lucide-react";
import { useRateLimits, lowestRemainingShare } from "@/lib/github/rate-limit";
import { cn } from "@/lib/utils";

function fmt(n: number | null): string {
  return n == null ? "—" : n.toLocaleString();
}

/** Compact remaining-limits indicator for the header. */
export function RateLimitBadge() {
  const snap = useRateLimits();
  const share = lowestRemainingShare(snap);
  const tone =
    share == null
      ? "text-muted-foreground"
      : share < 0.1
        ? "text-[var(--destructive)]"
        : share < 0.3
          ? "text-[var(--warning)]"
          : "text-muted-foreground";
  const title = [
    `REST: ${fmt(snap.rest?.remaining ?? null)}/${fmt(snap.rest?.limit ?? null)}`,
    `Search: ${fmt(snap.search?.remaining ?? null)}/${fmt(snap.search?.limit ?? null)}`,
    `GraphQL: ${fmt(snap.graphql?.remaining ?? null)}/${fmt(snap.graphql?.limit ?? null)}`,
  ].join("\n");
  return (
    <span
      title={title}
      className={cn("inline-flex cursor-help items-center gap-1 font-mono text-[11px] tabular-nums", tone)}
    >
      <Gauge className="size-3.5" />
      {share == null ? "limit —" : `${Math.round(share * 100)}%`}
    </span>
  );
}

/** Full rate-limit panel for Settings / Overview. */
export function RateLimitPanel() {
  const snap = useRateLimits();
  const rows = [
    { label: "REST", v: snap.rest },
    { label: "Search", v: snap.search },
    { label: "GraphQL", v: snap.graphql },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{r.label}</span>
          <span className="font-mono tabular-nums">
            {r.v ? (
              <>
                {r.v.remaining.toLocaleString()} / {r.v.limit.toLocaleString()}
                <span className="ml-2 text-muted-foreground">
                  resets {new Date(r.v.resetAt).toLocaleTimeString()}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">no data yet</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
