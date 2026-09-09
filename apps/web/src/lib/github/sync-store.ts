/**
 * Incremental sync markers. Full search snapshots are expensive, so after the
 * first complete fetch we record WHEN it happened; later syncs fetch only
 * items updated since that day (`updated:>=YYYY-MM-DD`) and merge by id.
 * Day granularity (not timestamp) with id-merge makes same-day overlap
 * harmless. Manual Refresh clears markers to force a true full re-sync.
 */
"use client";

export type SyncKind = "prs-open" | "prs-merged" | "issues";

const KEY = (kind: SyncKind) => `gity.sync.${kind}`;

export function getLastSync(kind: SyncKind): number | null {
  try {
    const raw = window.localStorage.getItem(KEY(kind));
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function setLastSync(kind: SyncKind, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(KEY(kind), String(now));
  } catch {
    /* ignore */
  }
}

export function clearAllSync(): void {
  try {
    for (const k of ["prs-open", "prs-merged", "issues"] as SyncKind[]) {
      window.localStorage.removeItem(KEY(k));
    }
  } catch {
    /* ignore */
  }
}
