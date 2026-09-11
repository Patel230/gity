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
  fetchRepoCommits,
  fetchRepoCommitDetail,
  fetchRepoReferences,
  fetchRepoServiceCandidates,
  fetchRepoDirectory,
  fetchRepoFilePreview,
  fetchRepoSnapshot,
  fetchRepoWorkSnapshot,
  fetchPullRequestCiState,
  fetchRepoWorkflowRuns,
  fetchSearchPrsAndIssues,
  fetchUserEvents,
  fetchViewer,
  searchIssuesRest,
  searchPrsRest,
} from "./rest";
import { GithubApiError } from "./types";
import type {
  ActivityItem,
  ContributionDay,
  GithubIssue,
  GithubOrg,
  GithubPullRequest,
  GithubRepo,
  GithubRepoCommit,
  GithubRepoCommitDetail,
  GithubRepoReferenceSnapshot,
  GithubRepoServiceSnapshot,
  GithubRepoFilePreview,
  GithubRepoSnapshot,
  GithubRepoWorkSnapshot,
  GithubUser,
  GithubWorkflowRun,
} from "./types";

/**
 * Synchronous token fingerprint for query keys (never the token itself).
 * cyrb53: 53-bit, non-crypto — plenty for cache namespacing, and crucially
 * synchronous, so the fingerprint is final on the very first render and
 * queries never fire a wasted wave under a placeholder key.
 */
export function tokenFingerprint(token: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < token.length; i++) {
    const ch = token.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

export const qk = {
  viewer: (fp: string) => ["gity", fp, "viewer"] as const,
  orgs: (fp: string) => ["gity", fp, "orgs"] as const,
  repos: (fp: string) => ["gity", fp, "repos"] as const,
  repoSnapshot: (fp: string, fullName = "") => ["gity", fp, "repo-snapshot", fullName] as const,
  repoServices: (fp: string, ids: string) => ["gity", fp, "nexus", "services", ids] as const,
  ciStates: (fp: string) => ["gity", fp, "ci-states"] as const,
  prCiStates: (fp: string) => ["gity", fp, "pr-ci-states"] as const,
  // PR/issue/event keys include the login so the first fetch
  // happens only when dependencies arrive (no stale empty cache), and refires
  // exactly once when they do. `depth` separates the fast head query used for
  // dashboard pulses from the full query used for complete listings.
  prsAll: (fp: string, login = "", depth: SearchDepth = "full") =>
    ["gity", fp, "prs", "all", login, depth] as const,
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
 * Server-side sort is only requested for head queries, where recency order
 * decides WHICH 100 items we keep. Full queries enumerate every page anyway
 * and every consumer sorts client-side — skipping the global sort makes
 * GitHub's search pages return noticeably faster.
 */
function searchQuery(kind: "pr" | "issue", login: string, depth: SearchDepth): string {
  const sort = depth === "head" ? " sort:updated-desc" : "";
  return `is:${kind} involves:${login}${sort}`;
}

/**
 * Refresh tiers.
 * - LIVE (workflow runs, events): follow the user's Live Refresh poll — cheap
 *   REST calls with high signal value, so they stay on the 15s–5m interval.
 * - CALM (everything else): refresh automatically every 15 minutes. This keeps
 *   the dashboard current without a user-facing refresh control or a 30s poll
 *   on the repos query (~600 GraphQL points), which could burn the budget in
 *   minutes and stall the whole app on 429s.
 */
const CALM_REFRESH_MS = 15 * 60_000;
const CALM = {
  refetchInterval: CALM_REFRESH_MS,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
};

/**
 * Retry policy: transient failures (network hiccups, GitHub 5xx) get a second
 * chance with backoff. Auth, permission, and rate-limit failures NEVER retry —
 * retrying a 429 only deepens the hole and stalls the whole dashboard.
 */
function retryPolicy(count: number, err: { kind: string }): boolean {
  return (
    count < 2 &&
    err.kind !== "auth" &&
    err.kind !== "forbidden" &&
    err.kind !== "rate-limit"
  );
}

/* ------------------------------- options ---------------------------------- */

export function viewerOptions(token: string | null, fp: string) {
  return queryOptions<GithubUser, GithubApiError>({
    ...CALM,
    queryKey: qk.viewer(fp),
    queryFn: () => fetchViewer(token),
    enabled: fp !== "anon",
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

export function orgsOptions(token: string | null, fp: string) {
  return queryOptions<GithubOrg[], GithubApiError>({
    ...CALM,
    queryKey: qk.orgs(fp),
    queryFn: () => fetchOrgs(token),
    enabled: fp !== "anon",
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

export function reposOptions(token: string | null, fp: string) {
  return queryOptions<GithubRepo[], GithubApiError>({
    ...CALM,
    queryKey: qk.repos(fp),
    queryFn: () => fetchAllRepos(token),
    enabled: fp !== "anon",
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

export function repoSnapshotOptions(
  token: string | null,
  fp: string,
  repo: GithubRepo | null,
) {
  return queryOptions<GithubRepoSnapshot, GithubApiError>({
    ...CALM,
    queryKey: qk.repoSnapshot(fp, repo?.fullName ?? ""),
    queryFn: () => fetchRepoSnapshot(token, repo!.fullName, repo!.defaultBranch),
    enabled: fp !== "anon" && !!repo,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

export function repoDirectoryOptions(
  token: string | null,
  fp: string,
  repo: GithubRepo | null,
  path: string | null,
) {
  return queryOptions<GithubRepoSnapshot["rootEntries"], GithubApiError>({
    ...CALM,
    queryKey: [...qk.repoSnapshot(fp, repo?.fullName ?? ""), "directory", path ?? ""],
    queryFn: () => fetchRepoDirectory(token, repo!.fullName, repo!.defaultBranch, path!),
    enabled: fp !== "anon" && !!repo && !!path,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

export function repoFileOptions(
  token: string | null,
  fp: string,
  repo: GithubRepo | null,
  path: string | null,
) {
  return queryOptions<GithubRepoFilePreview, GithubApiError>({
    ...CALM,
    queryKey: [...qk.repoSnapshot(fp, repo?.fullName ?? ""), "file", path ?? ""],
    queryFn: () => fetchRepoFilePreview(token, repo!.fullName, repo!.defaultBranch, path!),
    enabled: fp !== "anon" && !!repo && !!path,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

export function repoCommitsOptions(
  token: string | null,
  fp: string,
  repo: GithubRepo | null,
) {
  return queryOptions<GithubRepoCommit[], GithubApiError>({
    ...CALM,
    queryKey: [...qk.repoSnapshot(fp, repo?.fullName ?? ""), "commits"],
    queryFn: () => fetchRepoCommits(token, repo!.fullName, repo!.defaultBranch),
    enabled: fp !== "anon" && !!repo,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

export function repoCommitDetailOptions(
  token: string | null,
  fp: string,
  repo: GithubRepo | null,
  sha: string | null,
) {
  return queryOptions<GithubRepoCommitDetail, GithubApiError>({
    ...CALM,
    queryKey: [...qk.repoSnapshot(fp, repo?.fullName ?? ""), "commit", sha ?? ""],
    queryFn: () => fetchRepoCommitDetail(token, repo!.fullName, sha!),
    enabled: fp !== "anon" && !!repo && !!sha,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

export function repoReferencesOptions(
  token: string | null,
  fp: string,
  repos: GithubRepo[],
  priorityRepo?: GithubRepo | null,
) {
  const ids = repos.map((repo) => `${repo.fullName}:${repo.defaultBranch}`).join(",");
  // Keep the shared workspace snapshot reusable when the selected repository
  // is already one of the default sources. Only a quieter repository outside
  // that set needs a distinct prioritized scan.
  const defaultSources = repos
    .slice()
    .sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""))
    .slice(0, 16);
  const priority = priorityRepo && !defaultSources.some((repo) => repo.fullName === priorityRepo.fullName) ? priorityRepo.fullName : "";
  return queryOptions<GithubRepoReferenceSnapshot, GithubApiError>({
    ...CALM,
    queryKey: [...qk.repoSnapshot(fp, "workspace"), "references", ids, priority],
    queryFn: () => fetchRepoReferences(token, repos, 16, priority || undefined),
    enabled: fp !== "anon" && repos.length > 0,
    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

export function repoServiceCandidatesOptions(token: string | null, fp: string, repos: GithubRepo[]) {
  const ids = repos.map((repo) => `${repo.fullName}:${repo.defaultBranch}`).join(",");
  return queryOptions<GithubRepoServiceSnapshot, GithubApiError>({
    ...CALM,
    queryKey: qk.repoServices(fp, ids),
    queryFn: () => fetchRepoServiceCandidates(token, repos, 20),
    enabled: fp !== "anon" && repos.length > 0,
    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

export function repoWorkOptions(
  token: string | null,
  fp: string,
  repo: GithubRepo | null,
) {
  return queryOptions<GithubRepoWorkSnapshot, GithubApiError>({
    ...CALM,
    queryKey: [...qk.repoSnapshot(fp, repo?.fullName ?? ""), "work"],
    queryFn: () => fetchRepoWorkSnapshot(token, repo!.fullName),
    enabled: fp !== "anon" && !!repo,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
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
          out[repo.fullName] = await fetchRepoCiState(token, owner, name);
        }
      });
      await Promise.all(workers);
      return out;
    },
    enabled: fp !== "anon" && targets.length > 0,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

/** Head-commit CI states for the PRs currently visible in the listing. */
export function prCiStatesOptions(
  token: string | null,
  fp: string,
  prs: GithubPullRequest[] | undefined,
) {
  // CI is enrichment, not a reason to hold the whole listing hostage. Keep
  // the first screen useful while avoiding one GraphQL request per PR.
  const targets = (prs ?? []).slice(0, 24);
  const ids = targets.map((p) => `${p.repoFullName}#${p.number}`).join(",");
  return queryOptions<Record<string, GithubRepo["ciState"]>, GithubApiError>({
    ...CALM,
    queryKey: [...qk.prCiStates(fp), ids],
    queryFn: async () => {
      const out: Record<string, GithubRepo["ciState"]> = {};
      const queue = [...targets];
      const workers = Array.from({ length: 6 }, async () => {
        while (queue.length) {
          const pr = queue.shift()!;
          const [owner, name] = pr.repoFullName.split("/");
          out[`${pr.repoFullName}#${pr.number}`] = await fetchPullRequestCiState(token, owner, name, pr.number);
        }
      });
      await Promise.all(workers);
      return out;
    },
    enabled: fp !== "anon" && targets.length > 0,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

/** All PRs involving the viewer. Open/merged consumers share this request. */
export function allPrsOptions(
  token: string | null,
  fp: string,
  login: string | undefined,
  depth: SearchDepth = "full",
) {
  return queryOptions<GithubPullRequest[], GithubApiError>({
    ...CALM,
    queryKey: qk.prsAll(fp, login ?? "", depth),
    queryFn: async () => {
      if (!login) return [];
      try {
        const { prs } = await fetchSearchPrsAndIssues(
          token,
          searchQuery("pr", login, depth),
          { maxPages: depthPages(depth) },
        );
        return prs;
      } catch (error) {
        if (
          error instanceof GithubApiError &&
          !["blocked", "server", "network"].includes(error.kind)
        ) {
          throw error;
        }
        return searchPrsRest(token, `involves:${login}`, { maxPages: depthPages(depth) });
      }
    },
    enabled: fp !== "anon" && !!login,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

/** Open PRs derived from the shared PR search. */
export function openPrsOptions(
  token: string | null,
  fp: string,
  login: string | undefined,
  _repos?: GithubRepo[],
  depth: SearchDepth = "full",
) {
  return {
    ...allPrsOptions(token, fp, login, depth),
    select: (prs: GithubPullRequest[]) =>
      prs.filter((p) => p.state === "open" || p.state === "draft"),
  };
}

/** Merged/closed PRs derived from the shared PR search. */
export function mergedPrsOptions(
  token: string | null,
  fp: string,
  login: string | undefined,
  depth: SearchDepth = "full",
) {
  return {
    ...allPrsOptions(token, fp, login, depth),
    select: (prs: GithubPullRequest[]) =>
      prs.filter((p) => p.state === "merged" || p.state === "closed"),
  };
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
          token,
          searchQuery("issue", login, depth),
          { maxPages: depthPages(depth) },
        );
        return issues;
      } catch (error) {
        if (
          error instanceof GithubApiError &&
          !["blocked", "server", "network"].includes(error.kind)
        ) {
          throw error;
        }
        return searchIssuesRest(token, `involves:${login}`, { maxPages: depthPages(depth) });
      }
    },
    enabled: fp !== "anon" && !!login,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

/**
 * Delta fetchers for incremental sync: everything involving the viewer that
 * changed on/after a given day. Deltas are almost always a single fast page.
 * Returned UNFILTERED (any state) so the merge step can move items between
 * buckets (e.g. open → merged); callers apply their bucket filter after merge.
 */
export async function fetchPrDelta(
  token: string | null,
  login: string,
  sinceYMD: string,
): Promise<GithubPullRequest[]> {
  const { prs } = await fetchSearchPrsAndIssues(
    token,
    `is:pr involves:${login} updated:>=${sinceYMD}`,
    { maxPages: 10 },
  );
  return prs;
}

export async function fetchIssueDelta(
  token: string | null,
  login: string,
  sinceYMD: string,
): Promise<GithubIssue[]> {
  const { issues } = await fetchSearchPrsAndIssues(
    token,
    `is:issue involves:${login} updated:>=${sinceYMD}`,
    { maxPages: 10 },
  );
  return issues;
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
          const runs = await fetchRepoWorkflowRuns(token, repo.fullName, 3);
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
    enabled: fp !== "anon" && targets.length > 0,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

export function eventsOptions(
  token: string | null,
  fp: string,
  login: string | undefined,
) {
  return queryOptions<ActivityItem[], GithubApiError>({
    queryKey: qk.events(fp, login ?? "unknown"),
    queryFn: () => fetchUserEvents(token, login!),
    enabled: fp !== "anon" && !!login,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
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
        windows.map((w) => fetchContributionDays(token, login!, w.from, w.to)),
      );
      const byDate = new Map<string, number>();
      for (const days of results)
        for (const d of days) byDate.set(d.date, Math.max(byDate.get(d.date) ?? 0, d.count));
      return [...byDate.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    enabled: fp !== "anon" && !!login,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: (count, err) => retryPolicy(count, err),
  });
}

/* ------------------------------ convenience ------------------------------- */

export function useViewer(token: string | null, fp: string): UseQueryResult<GithubUser, GithubApiError> {
  return useQuery(viewerOptions(token, fp));
}
