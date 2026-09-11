/**
 * Shared GitHub domain types for Gity.
 * These are UI-friendly models produced by the data layer
 * (src/lib/github/*). UI components must only consume these
 * (via src/lib/github/queries.ts and src/features/*), never
 * raw REST/GraphQL payloads.
 */

export interface GithubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  /** CI state for the PR head commit when available. */
  ciState?: CiState;
}

export interface GithubOrg {
  login: string;
  name: string | null;
  avatarUrl: string;
  description: string | null;
  /** Repositories the viewer can see in this org (may be partial if access is limited). */
  repoCount: number;
  openPrCount: number;
  openIssueCount: number;
  lastActivityAt: string | null;
}

export type RepoVisibility = "public" | "private" | "internal";
export type CiState = "passing" | "failing" | "pending" | "unknown" | "no-checks";

export interface GithubRepo {
  id: string;
  name: string;
  fullName: string;
  ownerLogin: string;
  ownerAvatarUrl: string;
  description: string | null;
  visibility: RepoVisibility;
  isPrivate: boolean;
  isArchived: boolean;
  isFork: boolean;
  /** The upstream repository when GitHub identifies this repository as a fork. */
  parentFullName: string | null;
  primaryLanguage: string | null;
  primaryLanguageColor: string | null;
  stars: number;
  forks: number;
  openPrCount: number;
  openIssueCount: number;
  defaultBranch: string;
  pushedAt: string | null;
  updatedAt: string | null;
  htmlUrl: string;
  /** Latest known CI state derived from the default-branch commit status / check runs. */
  ciState: CiState;
}

export interface GithubRepoSnapshot {
  fullName: string;
  rootEntries: { name: string; path: string; type: "file" | "dir" }[];
  readme: { title: string | null; excerpt: string | null };
  codeOwners: { path: string; owners: string[] } | null;
}

export interface GithubRepoFilePreview {
  fullName: string;
  path: string;
  content: string;
  truncated: boolean;
}

export interface GithubRepoCommit {
  sha: string;
  message: string;
  authorLogin: string;
  authorAvatarUrl: string;
  authoredAt: string | null;
  htmlUrl: string;
}

export interface GithubRepoCommitDetail {
  sha: string;
  message: string;
  files: { path: string; status: string; additions: number; deletions: number; changes: number }[];
}

export interface GithubRepoReferenceSnapshot {
  references: { sourceFullName: string; targetFullName: string; path: string; signal: "github-link" | "scoped-package" }[];
  analyzedRepos: number;
  totalRepos: number;
  truncated: boolean;
}

export interface GithubRepoServiceCandidate {
  repositoryFullName: string;
  name: string;
  path: string;
  signal: "service-directory" | "runtime-manifest";
  purpose?: string | null;
  runtime?: string | null;
}

export interface GithubRepoServiceSnapshot {
  services: GithubRepoServiceCandidate[];
  signals: GithubRepoArchitectureSignal[];
  connections: GithubRepoArchitectureConnection[];
  analyzedRepos: number;
  totalRepos: number;
  truncated: boolean;
}

export interface GithubRepoArchitectureConnection {
  repositoryFullName: string;
  sourcePath: string;
  sourceServicePath: string | null;
  relation: "publishes" | "subscribes_to" | "calls";
  targetName: string;
  protocol: string | null;
}

export interface GithubRepoArchitectureSignal {
  repositoryFullName: string;
  name: string;
  path: string;
  type: "api" | "event" | "topic" | "queue" | "database" | "infrastructure";
  signal: "contract-file" | "architecture-directory" | "runtime-config";
}

export interface GithubRepoWorkSnapshot {
  fullName: string;
  prs: GithubPullRequest[];
  issues: GithubIssue[];
}

export type PrState = "open" | "draft" | "merged" | "closed";
export type ReviewState =
  | "approved"
  | "changes_requested"
  | "review_required"
  | "commented"
  | "dismissed"
  | "none";

export interface GithubPullRequest {
  id: string;
  number: number;
  title: string;
  repoFullName: string;
  orgLogin: string;
  authorLogin: string;
  authorAvatarUrl: string;
  state: PrState;
  isDraft: boolean;
  reviewState: ReviewState;
  reviewRequested: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  htmlUrl: string;
  /** CI state for the PR head commit when available. */
  ciState?: CiState;
  /** True when the record came from the issue-search index (review fields may be partial). */
  fromSearchIndex: boolean;
}

export interface GithubIssue {
  id: string;
  number: number;
  title: string;
  repoFullName: string;
  orgLogin: string;
  authorLogin: string;
  authorAvatarUrl: string;
  state: "open" | "closed";
  assignees: string[];
  labels: { name: string; color: string }[];
  comments: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  htmlUrl: string;
}

export type WorkflowConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required"
  | "neutral"
  | "stale"
  | null;

export type WorkflowStatus = "queued" | "in_progress" | "completed" | "waiting" | "requested" | "pending";

export interface GithubWorkflowRun {
  id: number;
  runNumber: number;
  name: string | null;
  workflowName: string;
  repoFullName: string;
  orgLogin: string;
  status: WorkflowStatus;
  conclusion: WorkflowConclusion;
  branch: string;
  event: string;
  actorLogin: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
}

export type ActivityKind =
  | "commit"
  | "push"
  | "pr_opened"
  | "pr_merged"
  | "pr_closed"
  | "issue_opened"
  | "issue_closed"
  | "review"
  | "release"
  | "other";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  actorLogin: string;
  actorAvatarUrl: string;
  repoFullName: string;
  title: string;
  htmlUrl: string;
  createdAt: string;
  commits?: number;
}

export interface ContributionDay {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface RateLimitSnapshot {
  rest: { limit: number; remaining: number; resetAt: number } | null;
  search: { limit: number; remaining: number; resetAt: number } | null;
  graphql: { limit: number; remaining: number; resetAt: number } | null;
  updatedAt: number;
}

export type GithubErrorKind =
  | "auth"
  | "forbidden"
  | "rate-limit"
  | "not-found"
  | "validation"
  | "server"
  | "blocked"
  | "network";

export class GithubApiError extends Error {
  kind: GithubErrorKind;
  status: number;
  resetAt?: number;
  documentationUrl?: string;

  constructor(
    kind: GithubErrorKind,
    status: number,
    message: string,
    opts?: { resetAt?: number; documentationUrl?: string },
  ) {
    super(message);
    this.name = "GithubApiError";
    this.kind = kind;
    this.status = status;
    this.resetAt = opts?.resetAt;
    this.documentationUrl = opts?.documentationUrl;
  }
}
