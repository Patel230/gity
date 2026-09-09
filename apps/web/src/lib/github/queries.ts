/**
 * Gity query layer — the ONLY place UI code gets GitHub data from.
 * UI components/hooks import from here (or from src/features/* which
 * wraps these), never from client.ts / rest.ts / graphql.ts directly.
 *
 * Each query is keyed by token-hash + params so caches are isolated
 * per token and deduplicated across components.
 */
import { queryOptions, useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  fetchAllRepos,
  fetchContributionDays,
  fetchOrgs,
  fetchRepoCiState,
  fetchRepoOpenPrs,
  fetchRepoWorkflowRuns,
  fetchSearchPrsAndIssues,
  fetchUserEvents,
  fetchViewer,
  searchIssuesRest,
  searchPrsRest,
} from "./rest";
import type {
  ActivityItem,
  ContributionDay,
  GithubApiError,
  GithubIssue,
  GithubOrg,
  GithubPullRequest,
  GithubRepo,
  GithubUser,
  GithubWorkflowRun,
} from "./types";

/** Non-reversible token fingerprint for query keys (never the token itself). */
async function tokenFingerprint(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function queryKeyBase(token: string): Promise<string[]> {
  try {
    return ["gity", await tokenFingerprint(token)];
  } catch {
    return ["gity", `len-${token.length}`];
  }
}

export const qk = {
  viewer: (fp: string) => ["gity", fp, "viewer"] as const,
  orgs: (fp: string) => ["gity", fp, "orgs"] as const,
  repos: (fp: string) => ["gity", fp, "repos"] as const,
  ciStates: (fp: string) => ["gity", fp, "ci-states"] as const,
  // PR/issue/event keys include the login + repo signature so the first fetch
  // happens only when dependencies arrive (no stale empty cache), and refires
  // exactly once when they do. `depth` separates the fast head query used for
  // dashboard pulses from the full query used for complete listings.
  openPrs: (fp: string, login = "", sig = "", depth: SearchDepth = "full") =>
    ["gity", fp, "prs", "open", login, sig, depth] as const,
  mergedPrs: (fp: string, login = "", depth: SearchDepth = "full") =>
    ["gity", fp, "prs", "merged", login, depth] as const,
  allIssues: (fp: string, login = "", depth: SearchDepth = "full") =>
    ["gity", fp, "issues", "all", login, depth] as const,
  workflowRuns: (fp: string) => ["gity", fp, "actions", "runs"] as const,
  events: (fp: string, login: string) => ["gity", fp, "events", login] as const,
  contributions: (fp: string, login: string) =>
    ["gity", fp, "contributions", login] as const,
};

/**
 * Search depth: "head" fetches page 1 only (100 most recent — fast, enough
 * for dashboard stats and feeds); "full" paginates to exhaustion (complete
 * listings on dedicated pages; GitHub caps search at ~1,000 results).
 */
export type SearchDepth = "head" | "full";

function depthPages(depth: SearchDepth): number {
  return depth === "head" ? 1 : 10;
}

/**
 * Refresh tiers.
 * - LIVE (workflow runs, events): follow the user's Live Refresh poll — cheap
 *   REST calls with high signal value, so they stay on the 15s–5m interval.
 * - CALM (everything else): refresh on mount, window-focus, and manual
 *   Refresh only — never on the interval. A 30s poll on the repos query alone
 *   (~600 GraphQL points) would burn the 5,000/hr budget in minutes and stall
 *   the whole app on 429s. Spread CALM into a builder's options to opt out.
 */
const CALM = { refetchInterval: false as const };

/* ------------------------------- options ---------------------------------- */

export function viewerOptions(token: string | null, fp: string) {
  return queryOptions<GithubUser, GithubApiError>({
    ...CALM,
    queryKey: qk.viewer(fp),
    queryFn: () => fetchViewer(token!),
    enabled: !!token,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: (count, err) =>
      count < 2 && err.kind !== "auth" && err.kind !== "forbidden",
  });
}

export function orgsOptions(token: string | null, fp: string) {
  return queryOptions<GithubOrg[], GithubApiError>({
    ...CALM,
    queryKey: qk.orgs(fp),
    queryFn: () => fetchOrgs(token!),
    enabled: !!token,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: (count, err) =>
      count < 2 && err.kind !== "auth" && err.kind !== "forbidden",
  });
}

export function reposOptions(token: string | null, fp: string) {
  return queryOptions<GithubRepo[], GithubApiError>({
    ...CALM,
    queryKey: qk.repos(fp),
    queryFn: () => fetchAllRepos(token!),
    enabled: !!token,
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    retry: (count, err) =>
      count < 2 && err.kind !== "auth" && err.kind !== "forbidden",
  });
}

/**
 * CI states for the most recently pushed repos. Bounded (default 20) to
 * protect rate limits — one GraphQL query per repo.
 */
export function ciStatesOptions(
  token: string | null,
  fp: string,
  repos: GithubRepo[] | undefined,
) {
  const targets = (repos ?? [])
    .filter((r) => !r.isArchived)
    .sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""))
    .slice(0, 12);
  const ids = targets.map((r) => r.fullName).join(",");
  return queryOptions<Record<string, GithubRepo["ciState"]>, GithubApiError>({
    ...CALM,
    queryKey: [...qk.ciStates(fp), ids],
    queryFn: async () => {
      const out: Record<string, GithubRepo["ciState"]> = {};
      // Small concurrency to stay friendly to rate limits.
      const queue = [...targets];
      const workers = Array.from({ length: 6 }, async () => {
        while (queue.length) {
          const repo = queue.shift()!;
          const [owner, name] = repo.fullName.split("/");
          out[repo.fullName] = await fetchRepoCiState(token!, owner, name);
        }
      });
      await Promise.all(workers);
      return out;
    },
    enabled: !!token && targets.length > 0,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });
}

/** Open PRs involving the viewer + detailed per-repo open PRs for top repos. */
export function openPrsOptions(
  token: string | null,
  fp: string,
  login: string | undefined,
  repos: GithubRepo[] | undefined,
  depth: SearchDepth = "full",
) {
  const top =
    depth === "full"
      ? (repos ?? [])
          .filter((r) => r.openPrCount > 0 && !r.isArchived)
          .sort((a, b) => b.openPrCount - a.openPrCount)
          .slice(0, 12)
      : [];
  const sig = top.map((r) => r.fullName).join(",");
  return queryOptions<GithubPullRequest[], GithubApiError>({
    ...CALM,
    queryKey: qk.openPrs(fp, login ?? "", sig, depth),
    queryFn: async () => {
      const byKey = new Map<string, GithubPullRequest>();
      // 1) Everything involving the viewer (authored/assigned/mentioned).
      if (login) {
        try {
          const { prs } = await fetchSearchPrsAndIssues(
            token!,
            `is:pr involves:${login} sort:updated-desc`,
            { maxPages: depthPages(depth) },
          );
          for (const pr of prs.filter(
            (p) => p.state === "open" || p.state === "draft",
          ))
            byKey.set(pr.id, pr);
        } catch {
          /* fall through to per-repo fetch */
        }
      }
      // 2) Detailed open PRs (with review decisions) for the most active repos.
      const queue = [...top];
      const workers = Array.from({ length: 5 }, async () => {
        while (queue.length) {
          const repo = queue.shift()!;
          const [owner, name] = repo.fullName.split("/");
          const prs = await fetchRepoOpenPrs(token!, owner, name);
          for (const pr of prs) byKey.set(pr.id, pr);
        }
      });
      await Promise.all(workers);
      // 3) REST fallback if both came up empty but repos report open PRs.
      if (byKey.size === 0 && login) {
        const prs = await searchPrsRest(token!, `involves:${login}`, { maxPages: depthPages(depth) });
        for (const pr of prs.filter(
          (p) => p.state === "open" || p.state === "draft",
        ))
          byKey.set(pr.id, pr);
      }
      return [...byKey.values()].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );
    },
    enabled: !!token && !!login,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: (count, err) =>
      count < 2 && err.kind !== "auth" && err.kind !== "forbidden",
  });
}

/** Recently merged/closed PRs involving the viewer (powers merged-today/week stats). */
export function mergedPrsOptions(
  token: string | null,
  fp: string,
  login: string | undefined,
  depth: SearchDepth = "full",
) {
  return queryOptions<GithubPullRequest[], GithubApiError>({
    ...CALM,
    queryKey: qk.mergedPrs(fp, login ?? "", depth),
    queryFn: async () => {
      if (!login) return [];
      try {
        const { prs } = await fetchSearchPrsAndIssues(
          token!,
          `is:pr involves:${login} sort:updated-desc`,
          { maxPages: depthPages(depth) },
        );
        return prs.filter((p) => p.state === "merged" || p.state === "closed");
      } catch {
        const prs = await searchPrsRest(token!, `involves:${login}`, { maxPages: depthPages(depth) });
        return prs.filter((p) => p.state === "merged" || p.state === "closed");
      }
    },
    enabled: !!token && !!login,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: (count, err) =>
      count < 2 && err.kind !== "auth" && err.kind !== "forbidden",
  });
}

/** Issues involving the viewer (PRs strictly excluded). */
export function allIssuesOptions(
  token: string | null,
  fp: string,
  login: string | undefined,
  depth: SearchDepth = "full",
) {
  return queryOptions<GithubIssue[], GithubApiError>({
    ...CALM,
    queryKey: qk.allIssues(fp, login ?? "", depth),
    queryFn: async () => {
      if (!login) return [];
      try {
        const { issues } = await fetchSearchPrsAndIssues(
          token!,
          `is:issue involves:${login} sort:updated-desc`,
          { maxPages: depthPages(depth) },
        );
        return issues;
      } catch {
        return searchIssuesRest(token!, `involves:${login}`, { maxPages: depthPages(depth) });
      }
    },
    enabled: !!token && !!login,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: (count, err) =>
      count < 2 && err.kind !== "auth" && err.kind !== "forbidden",
  });
}

/** Latest workflow run per repo for the most recently pushed repos (bounded). */
export function workflowRunsOptions(
  token: string | null,
  fp: string,
  repos: GithubRepo[] | undefined,
  limit = 20,
) {
  const targets = (repos ?? [])
    .filter((r) => !r.isArchived)
    .sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""))
    .slice(0, limit);
  const ids = targets.map((r) => r.fullName).join(",");
  return queryOptions<GithubWorkflowRun[], GithubApiError>({
    queryKey: [...qk.workflowRuns(fp), ids],
    queryFn: async () => {
      const out: GithubWorkflowRun[] = [];
      const queue = [...targets];
      const workers = Array.from({ length: 6 }, async () => {
        while (queue.length) {
          const repo = queue.shift()!;
          // Latest run per repo keeps this to 1 REST call per repo.
          const runs = await fetchRepoWorkflowRuns(token!, repo.fullName, 3);
          if (runs[0]) out.push(runs[0]);
          // Also keep any currently-running runs for the "running now" section.
          for (const r of runs.slice(1)) {
            if (r.status === "in_progress" || r.status === "queued") out.push(r);
          }
        }
      });
      await Promise.all(workers);
      return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    enabled: !!token && targets.length > 0,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });
}

export function eventsOptions(
  token: string | null,
  fp: string,
  login: string | undefined,
) {
  return queryOptions<ActivityItem[], GithubApiError>({
    queryKey: qk.events(fp, login ?? "unknown"),
    queryFn: () => fetchUserEvents(token!, login!),
    enabled: !!token && !!login,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });
}

/** Full-year contribution calendar (4 quarterly windows — GraphQL caps range length). */
export function contributionsOptions(
  token: string | null,
  fp: string,
  login: string | undefined,
) {
  return queryOptions<ContributionDay[], GithubApiError>({
    ...CALM,
    queryKey: qk.contributions(fp, login ?? "unknown"),
    queryFn: async () => {
      const now = new Date();
      const windows: { from: string; to: string }[] = [];
      for (let i = 3; i >= 0; i--) {
        const to = new Date(now);
        to.setMonth(to.getMonth() - i * 3);
        const from = new Date(to);
        from.setMonth(from.getMonth() - 3);
        if (i === 0) {
          windows.push({ from: from.toISOString(), to: now.toISOString() });
        } else {
          windows.push({ from: from.toISOString(), to: to.toISOString() });
        }
      }
      const results = await Promise.all(
        windows.map((w) => fetchContributionDays(token!, login!, w.from, w.to)),
      );
      const byDate = new Map<string, number>();
      for (const days of results)
        for (const d of days) byDate.set(d.date, Math.max(byDate.get(d.date) ?? 0, d.count));
      return [...byDate.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    enabled: !!token && !!login,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });
}

/* ------------------------------ convenience ------------------------------- */

export function useViewer(token: string | null, fp: string): UseQueryResult<GithubUser, GithubApiError> {
  return useQuery(viewerOptions(token, fp));
}
