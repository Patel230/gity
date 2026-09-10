"use client";

import { useEffect, useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { POLL_LABEL, usePrefs } from "@/lib/preferences";

function useNow(stepMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(t);
  }, [stepMs]);
  return now;
}

/** Header refresh cluster: Live Refresh state, manual refresh, last-updated age. */
export function RefreshControl({ lastUpdatedAt }: { lastUpdatedAt?: number }) {
  const qc = useQueryClient();
  const fetching = useIsFetching();
  const { poll, refreshInterval } = usePrefs();
  const now = useNow();
  const [last, setLast] = useState<number>(() => Date.now());

  // Track the most recent time all fetches settled.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fetching === 0) setLast(Date.now());
  }, [fetching]);

  const base = lastUpdatedAt ?? last;
  const ageS = Math.max(0, Math.round((now - base) / 1000));
  const age =
    ageS < 5 ? "just now" : ageS < 60 ? `${ageS}s ago` : `${Math.floor(ageS / 60)}m ago`;

  return (
    <div className="flex items-center gap-1.5">
      <span
        title={refreshInterval === false ? "Live Refresh is off" : `Live Refresh: ${POLL_LABEL[poll]} (polling — not true real-time)`}
        className="hidden items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-2 py-1 text-[10px] font-medium text-[var(--primary)] sm:inline-flex"
      >
        <span className="relative flex size-1.5">
          {refreshInterval !== false && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-50" />
          )}
          <span
            className={
              refreshInterval === false
                ? "relative inline-flex size-1.5 rounded-full bg-muted-foreground"
                : "relative inline-flex size-1.5 rounded-full bg-[var(--primary)]"
            }
          />
        </span>
        {refreshInterval === false ? (
          <Pause className="size-3" />
        ) : (
          <Play className="size-3" />
        )}
        {refreshInterval === false ? "Paused" : POLL_LABEL[poll]}
      </span>
      <span aria-live="polite" className="hidden text-[10px] text-muted-foreground md:inline" title="Age of the freshest visible data">
        {fetching > 0 ? "Updating…" : `Updated ${age}`}
      </span>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          // Keep the incremental sync markers: a normal retry must not turn
          // into a slow full-history scan after a transient failure.
          qc.invalidateQueries({ queryKey: ["gity"] });
        }}
        disabled={fetching > 0}
        title="Refetch GitHub data now (incremental when possible)"
        aria-label={fetching > 0 ? "Refreshing GitHub data" : "Refresh all GitHub data"}
      >
        <RefreshCw className={fetching > 0 ? "size-3.5 animate-spin" : "size-3.5"} />
        Refresh
      </Button>
    </div>
  );
}
