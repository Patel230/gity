"use client";

import { useMemo } from "react";
import { toYMD } from "@/lib/utils";
import { cn } from "@/lib/utils";

const LEVELS = [
  "bg-muted",
  "bg-[color-mix(in_srgb,var(--success)_30%,transparent)]",
  "bg-[color-mix(in_srgb,var(--success)_55%,transparent)]",
  "bg-[color-mix(in_srgb,var(--success)_80%,transparent)]",
  "bg-[var(--success)]",
];

function level(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

/**
 * GitHub-style contribution heatmap (last N weeks, columns = weeks).
 * `days` may be sparse; missing days render as empty.
 */
export function Heatmap({
  days,
  weeks = 26,
  cell = 11,
}: {
  days: Map<string, number> | { date: string; count: number }[];
  weeks?: number;
  cell?: number;
}) {
  const map = useMemo(
    () => (Array.isArray(days) ? new Map(days.map((d) => [d.date, d.count])) : days),
    [days],
  );

  const columns = useMemo(() => {
    const today = new Date();
    // Start on the Sunday `weeks` ago.
    const start = new Date(today);
    start.setDate(start.getDate() - (weeks * 7 - 1) - today.getDay());
    const cols: { date: Date; count: number }[][] = [];
    const cursor = new Date(start);
    for (let w = 0; w < weeks; w++) {
      const col: { date: Date; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const inFuture = cursor > today;
        col.push({
          date: new Date(cursor),
          count: inFuture ? -1 : (map.get(toYMD(cursor)) ?? 0),
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      cols.push(col);
    }
    return cols;
  }, [map, weeks]);

  return (
    <div className="flex gap-[3px] overflow-x-auto pb-1" role="img" aria-label="Activity heatmap">
      {columns.map((col, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {col.map((day, di) =>
            day.count < 0 ? (
              <span key={di} style={{ width: cell, height: cell }} />
            ) : (
              <span
                key={di}
                title={`${toYMD(day.date)}: ${day.count} contribution(s)`}
                style={{ width: cell, height: cell }}
                className={cn("heatmap-day", LEVELS[level(day.count)])}
              />
            ),
          )}
        </div>
      ))}
    </div>
  );
}
