"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { GithubApiError } from "@/lib/github/types";
import { getLastSync, setLastSync, type SyncKind } from "@/lib/github/sync-store";
import { toYMD } from "@/lib/utils";
import { usePrefs } from "@/lib/preferences";

export function useTokenContext() {
  const { token, fingerprint } = useAuth();
  const { refreshInterval } = usePrefs();
  return { token, fp: fingerprint, pollMs: refreshInterval };
}

/** Live-refreshing useQuery: polls on the configured interval, refetches on focus. */

export function useLiveQuery<TData, TError = GithubApiError>(options: Parameters<
  typeof useQuery<TData, TError>
>[0]) {
  const { refreshInterval } = usePrefs();
  return useQuery({
    ...options,
    refetchInterval: options.refetchInterval ?? refreshInterval,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? true,
  } as Parameters<typeof useQuery<TData, TError>>[0]);
}

/** Pure id-merge: delta items overwrite same-id snapshot items, rest kept. */
export function mergeById<T extends { id: string }>(prev: T[], delta: T[]): T[] {
  if (delta.length === 0) return prev;
  const map = new Map(prev.map((p) => [p.id, p]));
  for (const d of delta) map.set(d.id, d);
  return [...map.values()];
}

/**
 * Incremental sync wrapper for full-depth search queries.
 *
 * - First run ever (no snapshot or no marker): full fetch, marker recorded.
 * - Later runs: fetch only items updated since the marker day, merge by id,
 *   apply the bucket filter. One fast page instead of up to ten slow ones.
 * - Delta failure keeps the snapshot (except auth/permission errors, which
 *   rethrow so the UI can demand a fresh token). Manual Refresh clears
 *   markers elsewhere, forcing the next run back to full.
 */
export function useDeltaSearch<T extends { id: string }>(
  options: Parameters<typeof useLiveQuery<T[]>>[0],
  kind: SyncKind,
  fetchDelta: (sinceYMD: string) => Promise<T[]>,
  select: (all: T[]) => T[],
) {
  const client = useQueryClient();
  const key = options.queryKey as readonly unknown[];
  const runFull = options.queryFn as unknown as () => Promise<T[]>;
  return useLiveQuery<T[]>({
    ...options,
    queryFn: async () => {
      const prev = client.getQueryData<T[]>(key);
      const since = getLastSync(kind);
      if (!prev?.length || !since) {
        const full = await runFull();
        setLastSync(kind);
        return full;
      }
      let delta: T[];
      try {
        delta = await fetchDelta(toYMD(new Date(since)));
      } catch (e) {
        if (e instanceof GithubApiError && (e.kind === "auth" || e.kind === "forbidden")) throw e;
        return prev;
      }
      setLastSync(kind);
      return select(mergeById(prev, delta));
    },
  });
}
