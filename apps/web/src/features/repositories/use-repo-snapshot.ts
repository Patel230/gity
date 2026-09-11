"use client";

import { useAuth } from "@/lib/auth";
import { repoCommitDetailOptions, repoCommitsOptions, repoDirectoryOptions, repoFileOptions, repoReferencesOptions, repoSnapshotOptions, repoWorkOptions } from "@/lib/github/queries";
import type { GithubRepo } from "@/lib/github/types";
import { useLiveQuery } from "../use-github";

export function useRepoSnapshot(repo: GithubRepo | null) {
  const { token, fingerprint: fp } = useAuth();
  const query = useLiveQuery({ ...repoSnapshotOptions(token, fp, repo) });
  return {
    snapshot: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useRepoDirectory(repo: GithubRepo | null, path: string | null) {
  const { token, fingerprint: fp } = useAuth();
  const query = useLiveQuery({ ...repoDirectoryOptions(token, fp, repo, path) });
  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useRepoFilePreview(repo: GithubRepo | null, path: string | null) {
  const { token, fingerprint: fp } = useAuth();
  const query = useLiveQuery({ ...repoFileOptions(token, fp, repo, path) });
  return {
    preview: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useRepoCommits(repo: GithubRepo | null) {
  const { token, fingerprint: fp } = useAuth();
  const query = useLiveQuery({ ...repoCommitsOptions(token, fp, repo) });
  return { commits: query.data ?? [], isLoading: query.isLoading, error: query.error as Error | null };
}

export function useRepoCommitDetail(repo: GithubRepo | null, sha: string | null) {
  const { token, fingerprint: fp } = useAuth();
  const query = useLiveQuery({ ...repoCommitDetailOptions(token, fp, repo, sha) });
  return { detail: query.data ?? null, isLoading: query.isLoading, error: query.error as Error | null };
}

export function useRepoReferences(repos: GithubRepo[], priorityRepo?: GithubRepo | null) {
  const { token, fingerprint: fp } = useAuth();
  const query = useLiveQuery({ ...repoReferencesOptions(token, fp, repos, priorityRepo) });
  return { snapshot: query.data ?? null, isLoading: query.isLoading, error: query.error as Error | null, dataUpdatedAt: query.dataUpdatedAt };
}

export function useRepoWork(repo: GithubRepo | null) {
  const { token, fingerprint: fp } = useAuth();
  const query = useLiveQuery({ ...repoWorkOptions(token, fp, repo) });
  return {
    work: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
