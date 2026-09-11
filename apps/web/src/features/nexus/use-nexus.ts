"use client";

import { useAuth } from "@/lib/auth";
import { repoServiceCandidatesOptions } from "@/lib/github/queries";
import type { GithubRepo } from "@/lib/github/types";
import { useLiveQuery } from "../use-github";

export function useRepoServiceCandidates(repos: GithubRepo[]) {
  const { token, fingerprint: fp } = useAuth();
  const query = useLiveQuery({ ...repoServiceCandidatesOptions(token, fp, repos) });
  return {
    snapshot: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}
