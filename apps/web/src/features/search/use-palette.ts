"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, useViewerUser } from "@/lib/auth";
import {
  allIssuesOptions,
  openPrsOptions,
  orgsOptions,
  reposOptions,
} from "@/lib/github/queries";
import type { PaletteData } from "@/components/layout/command-palette";

/**
 * Shared data for the global command palette.
 * Uses the SAME query keys as the pages, so TanStack Query deduplicates —
 * the header never causes extra GitHub requests once a page has loaded.
 */
export function usePaletteData(): PaletteData {
  const { token, fingerprint: fp } = useAuth();
  const viewer = useViewerUser();
  const login = viewer.data?.login;

  // No polling here — pages own Live Refresh; the palette reads shared cache.
  const reposQ = useQuery({ ...reposOptions(token, fp), refetchInterval: false });
  const prsQ = useQuery({
    ...openPrsOptions(token, fp, login, reposQ.data, "head"),
    refetchInterval: false,
  });
  const issuesQ = useQuery({
    ...allIssuesOptions(token, fp, login, "head"),
    refetchInterval: false,
  });
  const orgsQ = useQuery({ ...orgsOptions(token, fp), refetchInterval: false });

  return useMemo<PaletteData>(
    () => ({
      repos: reposQ.data ?? [],
      prs: prsQ.data ?? [],
      issues: issuesQ.data ?? [],
      orgs: (orgsQ.data ?? []).map((o) => o.login),
    }),
    [reposQ.data, prsQ.data, issuesQ.data, orgsQ.data],
  );
}
