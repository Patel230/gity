/**
 * Client-side rate-limit tracking.
 * Updated from REST response headers and GraphQL `rateLimit` payloads.
 * Exposes a tiny subscription store (no external state library needed)
 * plus a React hook for displaying limits in the UI.
 */
"use client";

import { useSyncExternalStore } from "react";
import type { RateLimitSnapshot } from "./types";

type Bucket = "rest" | "search" | "graphql";

let snapshot: RateLimitSnapshot = {
  rest: null,
  search: null,
  graphql: null,
  updatedAt: 0,
};

const listeners = new Set<() => void>();

function emit() {
  snapshot = { ...snapshot, updatedAt: Date.now() };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RateLimitSnapshot {
  return snapshot;
}

export function recordRestRateLimit(
  headers: Headers,
  bucket: Bucket = "rest",
): void {
  const limit = headers.get("x-ratelimit-limit");
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  if (!limit || !remaining || !reset) return;
  // Search API uses a dedicated bucket.
  const key: Bucket =
    bucket === "rest" && headers.get("x-ratelimit-resource") === "search"
      ? "search"
      : bucket;
  snapshot = {
    ...snapshot,
    [key]: {
      limit: Number(limit),
      remaining: Number(remaining),
      resetAt: Number(reset) * 1000,
    },
    updatedAt: Date.now(),
  };
  listeners.forEach((l) => l());
}

export function recordGraphqlRateLimit(rateLimit: {
  limit: number;
  remaining: number;
  resetAt: string;
}): void {
  snapshot = {
    ...snapshot,
    graphql: {
      limit: rateLimit.limit,
      remaining: rateLimit.remaining,
      resetAt: new Date(rateLimit.resetAt).getTime(),
    },
    updatedAt: Date.now(),
  };
  listeners.forEach((l) => l());
}

export function resetRateLimits(): void {
  snapshot = { rest: null, search: null, graphql: null, updatedAt: 0 };
  listeners.forEach((l) => l());
}

/** Lowest remaining share across known buckets (0..1), or null when unknown. */
export function lowestRemainingShare(s: RateLimitSnapshot): number | null {
  const shares: number[] = [];
  for (const b of [s.rest, s.search, s.graphql]) {
    if (b && b.limit > 0) shares.push(b.remaining / b.limit);
  }
  if (shares.length === 0) return null;
  return Math.min(...shares);
}

export function useRateLimits(): RateLimitSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
