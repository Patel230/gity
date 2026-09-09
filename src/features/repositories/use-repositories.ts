"use client";

import { useAuth } from "@/lib/auth";
import { ciStatesOptions, reposOptions } from "@/lib/github/queries";
import { useLiveQuery } from "../use-github";

/** All repos with CI states merged in. */
export function useRepositories() {
  const { token, fingerprint: fp } = useAuth();
  const reposQ = useLiveQuery({ ...reposOptions(token, fp) });
  const ciQ = useLiveQuery({ ...ciStatesOptions(token, fp, reposQ.data) });

  const repos = (reposQ.data ?? []).map((r) => ({
    ...r,
    ciState: ciQ.data?.[r.fullName] ?? r.ciState,
  }));

  return {
    repos,
    ciLoading: ciQ.isFetching,
    isLoading: reposQ.isLoading,
    error: (reposQ.error ?? null) as Error | null,
    dataUpdatedAt: reposQ.dataUpdatedAt,
    refetch: () => {
      void reposQ.refetch();
      void ciQ.refetch();
    },
  };
}
