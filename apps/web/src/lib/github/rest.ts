/**
 * Typed GitHub REST helpers. Used where REST is better than GraphQL:
 * token check, search (PR/issue aggregation), Actions, events.
 */
import { graphqlFetch, restFetch, restFetchAll } from "./client";
import {
  CONTRIBUTIONS_QUERY,
  ORGS_QUERY,
  PR_CI_QUERY,
  REPO_CI_QUERY,
  REPO_PRS_QUERY,
  REPOS_QUERY,
  SEARCH_ISSUES_QUERY,
  VIEWER_QUERY,
} from "./graphql";
import {
  connectionNodes,
  fetchAllConnectionPages,
  type GraphqlConnection,
} from "./pagination";
import type {
  ActivityItem,
  CiState,
  ContributionDay,
  GithubIssue,
  GithubOrg,
  GithubPullRequest,
  GithubRepo,
  GithubUser,
  GithubWorkflowRun,
  ReviewState,
} from "./types";

/* ---------------------------------- types --------------------------------- */

interface RestUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

interface RestSearchItem {
  id: number;
  number: number;
  title: string;
  state: string;
  draft?: boolean;
  pull_request?: { merged_at?: string | null; url: string };
  user: { login: string; avatar_url: string } | null;
  repository_url: string;
  labels: { name: string; color: string }[];
  assignees: { login: string }[];
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
}

interface RestWorkflowRun {
  id: number;
  run_number: number;
  name: string | null;
  workflow_id: number;
  status: string;
  conclusion: string | null;
  head_branch: string;
  event: string;
  actor: { login: string } | null;
  repository: { full_name: string };
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface RestEvent {
  id: string;
  type: string;
  actor: { login: string; avatar_url: string };
  repo: { name: string };
  payload: {
    commits?: { sha: string }[];
    action?: string;
    pull_request?: { html_url: string; title: string; number: number };
    issue?: { html_url: string; title: string; number: number };
    release?: { html_url: string; name: string | null; tag_name: string };
    review?: { html_url: string; state: string };
    ref_type?: string;
  };
  created_at: string;
}

/* --------------------------------- viewer --------------------------------- */

export async function fetchViewer(token: string): Promise<GithubUser> {
  const data = await graphqlFetch<{
    viewer: { login: string; name: string | null; avatarUrl: string; url: string };
  }>(token, VIEWER_QUERY);
  return {
    login: data.viewer.login,
    name: data.viewer.name,
    avatarUrl: data.viewer.avatarUrl,
    htmlUrl: data.viewer.url,
  };
}

/** Lightweight token check that also proves basic REST access. */
export async function checkToken(token: string): Promise<GithubUser> {
  const { data } = await restFetch<RestUser>(token, "/user");
  return {
    login: data.login,
    name: data.name,
    avatarUrl: data.avatar_url,
    htmlUrl: data.html_url,
  };
}

/* ---------------------------------- orgs ---------------------------------- */

interface OrgsPayload {
  viewer: {
    organizations: GraphqlConnection<{
      login: string;
      name: string | null;
      avatarUrl: string;
      description: string | null;
    }>;
  };
}

export async function fetchOrgs(token: string): Promise<GithubOrg[]> {
  const nodes = await fetchAllConnectionPages(
    async (after) => {
      const data = await graphqlFetch<OrgsPayload>(token, ORGS_QUERY, { after });
      return data.viewer.organizations;
    },
    { maxPages: 10 },
  );
  return nodes.map((o) => ({
    login: o.login,
    name: o.name,
    avatarUrl: o.avatarUrl,
    description: o.description,
    repoCount: 0,
    openPrCount: 0,
    openIssueCount: 0,
    lastActivityAt: null,
  }));
}

/* ---------------------------------- repos ---------------------------------- */

interface RepoNode {
  id: string;
  name: string;
  nameWithOwner: string;
  description: string | null;
  isPrivate: boolean;
  isArchived: boolean;
  isFork: boolean;
  primaryLanguage: { name: string; color: string | null } | null;
  stargazerCount: number;
  forkCount: number;
  defaultBranchRef: { name: string } | null;
  pushedAt: string | null;
  updatedAt: string | null;
  url: string;
  owner: { login: string; avatarUrl: string };
  pullRequests: { totalCount: number };
  issues: { totalCount: number };
}

interface ReposPayload {
  viewer: { repositories: GraphqlConnection<RepoNode> };
}

function toRepo(n: RepoNode): GithubRepo {
  return {
    id: n.id,
    name: n.name,
    fullName: n.nameWithOwner,
    ownerLogin: n.owner.login,
    ownerAvatarUrl: n.owner.avatarUrl,
    description: n.description,
    visibility: n.isPrivate ? "private" : "public",
    isPrivate: n.isPrivate,
    isArchived: n.isArchived,
    isFork: n.isFork,
    primaryLanguage: n.primaryLanguage?.name ?? null,
    primaryLanguageColor: n.primaryLanguage?.color ?? null,
    stars: n.stargazerCount,
    forks: n.forkCount,
    openPrCount: n.pullRequests.totalCount,
    openIssueCount: n.issues.totalCount,
    defaultBranch: n.defaultBranchRef?.name ?? "main",
    pushedAt: n.pushedAt,
    updatedAt: n.updatedAt,
    htmlUrl: n.url,
    ciState: "unknown",
  };
}

/** All repositories visible to the viewer (personal + org), fully paginated. */
export async function fetchAllRepos(token: string): Promise<GithubRepo[]> {
  const nodes = await fetchAllConnectionPages(
    async (after) => {
      const data = await graphqlFetch<ReposPayload>(token, REPOS_QUERY, { after });
      return data.viewer.repositories;
    },
    { maxPages: 50 },
  );
  return nodes.map(toRepo);
}

/** Default-branch combined CI state for one repo (graceful when checks are inaccessible). */
export async function fetchRepoCiState(
  token: string,
  owner: string,
  name: string,
): Promise<CiState> {
  try {
    const data = await graphqlFetch<{
      repository: {
        defaultBranchRef: { target: { statusCheckRollup: { state: string } | null } | null } | null;
      } | null;
    }>(token, REPO_CI_QUERY, { owner, name });
    const state = data.repository?.defaultBranchRef?.target?.statusCheckRollup?.state;
    switch (state) {
      case "SUCCESS":
        return "passing";
      case "FAILURE":
      case "ERROR":
        return "failing";
      case "PENDING":
      case "EXPECTED":
        return "pending";
      default:
        return state ? "no-checks" : "unknown";
    }
  } catch {
    return "unknown";
  }
}

/** CI state for a pull request's latest head commit. */
export async function fetchPullRequestCiState(
  token: string,
  owner: string,
  name: string,
  number: number,
): Promise<CiState> {
  try {
    const data = await graphqlFetch<{
      repository: {
        pullRequest: {
          commits: { nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } | null }> };
        } | null;
      } | null;
    }>(token, PR_CI_QUERY, { owner, name, number });
    return ciStateFromRollup(
      data.repository?.pullRequest?.commits.nodes[0]?.commit?.statusCheckRollup?.state,
    );
  } catch {
    return "unknown";
  }
}

/* ------------------------------- PRs / issues ------------------------------ */

function reviewStateFrom(
  reviewDecision: string | null | undefined,
  reviewRequestsTotal: number | undefined,
): ReviewState {
  switch (reviewDecision) {
    case "APPROVED":
      return "approved";
    case "CHANGES_REQUESTED":
      return "changes_requested";
    case "REVIEW_REQUIRED":
      return reviewRequestsTotal ? "review_required" : "none";
    case "COMMENTED":
      return "commented";
    default:
      return reviewRequestsTotal ? "review_required" : "none";
  }
}

interface SearchPayload {
  search: GraphqlConnection<
    | {
        __typename: "PullRequest";
        id: string;
        number: number;
        title: string;
        state: string;
        isDraft: boolean;
        merged: boolean;
        mergedAt: string | null;
        closedAt: string | null;
        createdAt: string;
        updatedAt: string;
        author: { login: string; avatarUrl: string } | null;
        repository: { nameWithOwner: string; owner: { login: string } };
        additions: number;
        deletions: number;
        changedFiles: number;
        url: string;
        reviewDecision: string | null;
        reviewRequests: { totalCount: number };
      }
    | {
        __typename: "Issue";
        id: string;
        number: number;
        title: string;
        state: string;
        createdAt: string;
        updatedAt: string;
        closedAt: string | null;
        author: { login: string; avatarUrl: string } | null;
        repository: { nameWithOwner: string; owner: { login: string } };
        assignees: { nodes: { login: string }[] };
        labels: { nodes: { name: string; color: string }[] };
        comments: { totalCount: number };
        url: string;
      }
  >;
}

/**
 * GraphQL issue-search across everything visible to the viewer.
 * PullRequest nodes and Issue nodes are strictly separated —
 * issues that are actually PRs are never double-counted.
 */
export async function fetchSearchPrsAndIssues(
  token: string,
  query: string,
  opts?: { maxPages?: number },
): Promise<{ prs: GithubPullRequest[]; issues: GithubIssue[] }> {
  const nodes = await fetchAllConnectionPages(
    async (after) => {
      const data = await graphqlFetch<SearchPayload>(token, SEARCH_ISSUES_QUERY, {
        q: query,
        after,
      });
      return data.search;
    },
    { maxPages: opts?.maxPages ?? 10 },
  );
  const prs: GithubPullRequest[] = [];
  const issues: GithubIssue[] = [];
  for (const n of nodes) {
    if (n.__typename === "PullRequest") {
      prs.push({
        id: n.id,
        number: n.number,
        title: n.title,
        repoFullName: n.repository.nameWithOwner,
        orgLogin: n.repository.owner.login,
        authorLogin: n.author?.login ?? "ghost",
        authorAvatarUrl: n.author?.avatarUrl ?? "",
        state: n.merged ? "merged" : n.state === "OPEN" ? (n.isDraft ? "draft" : "open") : "closed",
        isDraft: n.isDraft,
        reviewState: reviewStateFrom(n.reviewDecision, n.reviewRequests?.totalCount),
        reviewRequested: (n.reviewRequests?.totalCount ?? 0) > 0,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        closedAt: n.closedAt,
        mergedAt: n.mergedAt,
        additions: n.additions,
        deletions: n.deletions,
        changedFiles: n.changedFiles,
        htmlUrl: n.url,
        fromSearchIndex: true,
      });
    } else {
      issues.push({
        id: n.id,
        number: n.number,
        title: n.title,
        repoFullName: n.repository.nameWithOwner,
        orgLogin: n.repository.owner.login,
        authorLogin: n.author?.login ?? "ghost",
        authorAvatarUrl: n.author?.avatarUrl ?? "",
        state: n.state === "OPEN" ? "open" : "closed",
        assignees: n.assignees.nodes.map((a) => a.login),
        labels: n.labels.nodes.map((l) => ({ name: l.name, color: l.color })),
        comments: n.comments.totalCount,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        closedAt: n.closedAt,
        htmlUrl: n.url,
      });
    }
  }
  return { prs, issues };
}

/** REST search fallback for PR aggregation (also powers author/org-scoped lists). */
export async function searchPrsRest(
  token: string,
  query: string,
  opts?: { maxPages?: number },
): Promise<GithubPullRequest[]> {
  const items = await restFetchAll<RestSearchItem>(token, "/search/issues", {
    query: { q: `${query} type:pr`, per_page: 100 },
    maxPages: opts?.maxPages ?? 10,
  });
  return items
    .filter((i) => i.pull_request)
    .map((i) => {
      const mergedAt = i.pull_request?.merged_at ?? null;
      return {
        id: `rest-pr-${i.id}`,
        number: i.number,
        title: i.title,
        repoFullName: repoFullNameFromUrl(i.repository_url),
        orgLogin: repoFullNameFromUrl(i.repository_url).split("/")[0] ?? "",
        authorLogin: i.user?.login ?? "ghost",
        authorAvatarUrl: i.user?.avatar_url ?? "",
        state: mergedAt
          ? ("merged" as const)
          : i.state === "open"
            ? i.draft
              ? ("draft" as const)
              : ("open" as const)
            : ("closed" as const),
        isDraft: !!i.draft,
        reviewState: "none" as ReviewState,
        reviewRequested: false,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        closedAt: i.closed_at,
        mergedAt,
        additions: 0,
        deletions: 0,
        changedFiles: 0,
        htmlUrl: i.html_url,
        fromSearchIndex: true,
      };
    });
}

/** REST search fallback for issue aggregation — excludes anything with `pull_request`. */
export async function searchIssuesRest(
  token: string,
  query: string,
  opts?: { maxPages?: number },
): Promise<GithubIssue[]> {
  const items = await restFetchAll<RestSearchItem>(token, "/search/issues", {
    query: { q: `${query} type:issue`, per_page: 100 },
    maxPages: opts?.maxPages ?? 10,
  });
  return items
    .filter((i) => !i.pull_request)
    .map((i) => ({
      id: `rest-issue-${i.id}`,
      number: i.number,
      title: i.title,
      repoFullName: repoFullNameFromUrl(i.repository_url),
      orgLogin: repoFullNameFromUrl(i.repository_url).split("/")[0] ?? "",
      authorLogin: i.user?.login ?? "ghost",
      authorAvatarUrl: i.user?.avatar_url ?? "",
      state: i.state === "open" ? ("open" as const) : ("closed" as const),
      assignees: i.assignees.map((a) => a.login),
      labels: i.labels.map((l) => ({ name: l.name, color: l.color })),
      comments: i.comments,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
      closedAt: i.closed_at,
      htmlUrl: i.html_url,
    }));
}

function repoFullNameFromUrl(repositoryUrl: string): string {
  const m = repositoryUrl.match(/\/repos\/(.+)$/);
  return m ? m[1] : "unknown/unknown";
}

interface RepoPrNode {
  id: string;
  number: number;
  title: string;
  isDraft: boolean;
  author: { login: string; avatarUrl: string } | null;
  reviewDecision: string | null;
  reviewRequests: { totalCount: number };
  commits: {
    nodes: Array<{
      commit: { statusCheckRollup: { state: string } | null } | null;
    }>;
  };
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  url: string;
}

function ciStateFromRollup(state: string | null | undefined): CiState {
  switch (state) {
    case "SUCCESS":
      return "passing";
    case "FAILURE":
    case "ERROR":
      return "failing";
    case "PENDING":
    case "EXPECTED":
      return "pending";
    default:
      return state ? "no-checks" : "unknown";
  }
}

/** Open PRs for one repo (detailed — review decisions included). */
export async function fetchRepoOpenPrs(
  token: string,
  owner: string,
  name: string,
): Promise<GithubPullRequest[]> {
  try {
    const nodes = await fetchAllConnectionPages(
      async (after) => {
        const data = await graphqlFetch<{
          repository: { pullRequests: GraphqlConnection<RepoPrNode> } | null;
        }>(token, REPO_PRS_QUERY, { owner, name, after });
        return (
          data.repository?.pullRequests ?? {
            nodes: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          }
        );
      },
      { maxPages: 2 },
    );
    return nodes.map((n) => ({
      id: n.id,
      number: n.number,
      title: n.title,
      repoFullName: `${owner}/${name}`,
      orgLogin: owner,
      authorLogin: n.author?.login ?? "ghost",
      authorAvatarUrl: n.author?.avatarUrl ?? "",
      state: n.isDraft ? ("draft" as const) : ("open" as const),
      isDraft: n.isDraft,
      reviewState: reviewStateFrom(n.reviewDecision, n.reviewRequests.totalCount),
      reviewRequested: n.reviewRequests.totalCount > 0,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      closedAt: null,
      mergedAt: null,
      additions: n.additions,
      deletions: n.deletions,
      changedFiles: n.changedFiles,
      htmlUrl: n.url,
      ciState: ciStateFromRollup(n.commits.nodes[0]?.commit?.statusCheckRollup?.state),
      fromSearchIndex: false,
    }));
  } catch {
    return [];
  }
}

/* --------------------------------- actions --------------------------------- */

export function toWorkflowRun(
  r: RestWorkflowRun,
  workflowName: string,
): GithubWorkflowRun {
  return {
    id: r.id,
    runNumber: r.run_number,
    name: r.name,
    workflowName,
    repoFullName: r.repository.full_name,
    orgLogin: r.repository.full_name.split("/")[0] ?? "",
    status: (r.status as GithubWorkflowRun["status"]) ?? "completed",
    conclusion: (r.conclusion as GithubWorkflowRun["conclusion"]) ?? null,
    branch: r.head_branch,
    event: r.event,
    actorLogin: r.actor?.login ?? "ghost",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    htmlUrl: r.html_url,
  };
}

/** Latest workflow runs for a repo (REST — the right tool for Actions). */
export async function fetchRepoWorkflowRuns(
  token: string,
  fullName: string,
  perPage = 10,
): Promise<GithubWorkflowRun[]> {
  try {
    const { data } = await restFetch<{
      workflow_runs: RestWorkflowRun[];
    }>(token, `/repos/${fullName}/actions/runs`, {
      query: { per_page: perPage },
    });
    return data.workflow_runs.map((r) =>
      toWorkflowRun(
        { ...r, repository: { full_name: fullName } },
        r.name ?? "workflow",
      ),
    );
  } catch {
    return [];
  }
}

/* --------------------------------- activity -------------------------------- */

export async function fetchUserEvents(
  token: string,
  login: string,
  perPage = 100,
): Promise<ActivityItem[]> {
  try {
    const { data } = await restFetch<RestEvent[]>(
      token,
      `/users/${login}/events`,
      { query: { per_page: perPage } },
    );
    return data.flatMap(toActivityItems);
  } catch {
    return [];
  }
}

function toActivityItems(e: RestEvent): ActivityItem[] {
  const base = {
    actorLogin: e.actor.login,
    actorAvatarUrl: e.actor.avatar_url,
    repoFullName: e.repo.name,
    createdAt: e.created_at,
  };
  switch (e.type) {
    case "PushEvent":
      return [
        {
          ...base,
          id: e.id,
          kind: "push",
          title: `Pushed ${e.payload.commits?.length ?? 0} commit(s)`,
          htmlUrl: `https://github.com/${e.repo.name}/commits`,
          commits: e.payload.commits?.length ?? 0,
        },
      ];
    case "PullRequestEvent": {
      const pr = e.payload.pull_request;
      const action = e.payload.action;
      return [
        {
          ...base,
          id: e.id,
          kind:
            action === "closed"
              ? "pr_closed"
              : action === "opened"
                ? "pr_opened"
                : "other",
          title: `PR #${pr?.number ?? "?"} ${action ?? ""}: ${pr?.title ?? ""}`.trim(),
          htmlUrl: pr?.html_url ?? `https://github.com/${e.repo.name}/pulls`,
        },
      ];
    }
    case "IssuesEvent": {
      const issue = e.payload.issue;
      return [
        {
          ...base,
          id: e.id,
          kind: e.payload.action === "closed" ? "issue_closed" : "issue_opened",
          title: `Issue #${issue?.number ?? "?"} ${e.payload.action ?? ""}: ${issue?.title ?? ""}`.trim(),
          htmlUrl: issue?.html_url ?? `https://github.com/${e.repo.name}/issues`,
        },
      ];
    }
    case "PullRequestReviewEvent":
      return [
        {
          ...base,
          id: e.id,
          kind: "review",
          title: `Reviewed PR (${e.payload.review?.state ?? "review"})`,
          htmlUrl: e.payload.review?.html_url ?? `https://github.com/${e.repo.name}/pulls`,
        },
      ];
    case "ReleaseEvent": {
      const r = e.payload.release;
      return [
        {
          ...base,
          id: e.id,
          kind: "release",
          title: `Released ${r?.name ?? r?.tag_name ?? ""}`.trim(),
          htmlUrl: r?.html_url ?? `https://github.com/${e.repo.name}/releases`,
        },
      ];
    }
    case "CreateEvent":
      if (e.payload.ref_type !== "repository") return [];
      return [
        {
          ...base,
          id: e.id,
          kind: "other",
          title: `Created repository ${e.repo.name}`,
          htmlUrl: `https://github.com/${e.repo.name}`,
        },
      ];
    default:
      return [];
  }
}

/* ------------------------------- contributions ------------------------------ */

export async function fetchContributionDays(
  token: string,
  login: string,
  from: string,
  to: string,
): Promise<ContributionDay[]> {
  const data = await graphqlFetch<{
    user: {
      contributionsCollection: {
        contributionCalendar: {
          weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
        };
      };
    } | null;
  }>(token, CONTRIBUTIONS_QUERY, { login, from, to });
  const weeks =
    data.user?.contributionsCollection.contributionCalendar.weeks ?? [];
  return weeks.flatMap((w) =>
    w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })),
  );
}

export function connectionNodesExport() {
  return connectionNodes;
}
