"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import type { GithubApiError } from "@/lib/github/types";
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
