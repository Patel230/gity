/**
 * Incremental sync markers. Full search snapshots are expensive, so after the
 * first complete fetch we record WHEN it happened; later syncs fetch only
 * items updated since that day (`updated:>=YYYY-MM-DD`) and merge by id.
 * Day granularity (not timestamp) with id-merge makes same-day overlap
 * harmless. Markers survive transient failures so automatic retries never
 * turn a normal refresh into an expensive full-history scan.
 */
"use client";

export type SyncKind = "prs" | "issues";

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
    // Remove pre-deduplication keys too, so old browser profiles do not retain
    // misleading state after upgrading to the shared PR snapshot.
    for (const key of ["gity.sync.prs", "gity.sync.prs-open", "gity.sync.prs-merged", "gity.sync.issues"]) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
