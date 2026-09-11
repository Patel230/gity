/**
 * Typed GitHub REST helpers. Used where REST is better than GraphQL:
 * token check, search (PR/issue aggregation), Actions, events.
 */
import { graphqlFetch, restFetch } from "./client";
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
  GithubRepoCommit,
  GithubRepoCommitDetail,
  GithubRepoFilePreview,
  GithubRepoReferenceSnapshot,
  GithubRepoArchitectureConnection,
  GithubRepoArchitectureSignal,
  GithubRepoServiceSnapshot,
  GithubRepoSnapshot,
  GithubRepoWorkSnapshot,
  GithubUser,
  GithubWorkflowRun,
  ReviewState,
} from "./types";
import { extractArchitectureConnections } from "../nexus/analyzers";

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

interface RestSearchPayload {
  items: RestSearchItem[];
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

export async function fetchViewer(token: string | null): Promise<GithubUser> {
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
export async function checkToken(token: string | null): Promise<GithubUser> {
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

export async function fetchOrgs(token: string | null): Promise<GithubOrg[]> {
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
  parent: { nameWithOwner: string } | null;
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

interface RestContentEntry {
  name: string;
  path: string;
  type: string;
  content?: string;
  encoding?: string;
}

interface RestCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
  };
  author: { login: string; avatar_url: string } | null;
}

interface RestCommitDetail extends RestCommit {
  files?: { filename: string; status: string; additions: number; deletions: number; changes: number }[];
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
    parentFullName: n.parent?.nameWithOwner ?? null,
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
export async function fetchAllRepos(token: string | null): Promise<GithubRepo[]> {
  const nodes = await fetchAllConnectionPages(
    async (after) => {
      const data = await graphqlFetch<ReposPayload>(token, REPOS_QUERY, { after });
      return data.viewer.repositories;
    },
    { maxPages: 50 },
  );
  return nodes.map(toRepo);
}

/** Find reviewable service-shaped boundaries without assuming one repo is one service. */
export async function fetchRepoServiceCandidates(
  token: string | null,
  repos: GithubRepo[],
  maxRepos = 20,
): Promise<GithubRepoServiceSnapshot> {
  const selected = repos.slice(0, maxRepos);
  const queue = [...selected];
  const candidates: GithubRepoServiceSnapshot["services"] = [];
  const signals: GithubRepoArchitectureSignal[] = [];
  const connections: GithubRepoArchitectureConnection[] = [];
  let analyzedRepos = 0;
  const serviceDirectoryNames = new Set(["app", "apps", "cmd", "service", "services", "worker", "workers"]);
  const runtimeManifests = new Set(["Cargo.toml", "Dockerfile", "go.mod", "package.json", "pyproject.toml", "serverless.yml", "wrangler.toml"]);

  const scan = async (repo: GithubRepo) => {
    const [owner, name] = repo.fullName.split("/");
    if (!owner || !name) return;
    try {
      const root = await restFetch<RestContentEntry[]>(token, `/repos/${owner}/${name}/contents`, { query: { ref: repo.defaultBranch } });
      analyzedRepos += 1;
      signals.push(...root.data.map((entry) => architectureSignal(repo, entry)).filter((signal): signal is GithubRepoArchitectureSignal => Boolean(signal)));
      const connectionFiles = new Map<string, RestContentEntry>();
      root.data.filter((entry) => entry.type === "file" && isArchitectureContent(entry.name)).forEach((entry) => connectionFiles.set(entry.path, entry));
      const roots = root.data.filter((entry) => entry.type === "dir" && serviceDirectoryNames.has(entry.name.toLowerCase()));
      for (const serviceRoot of roots.slice(0, 4)) {
        try {
          const children = await restFetch<RestContentEntry[]>(token, `/repos/${owner}/${name}/contents/${serviceRoot.path.split("/").map((part) => encodeURIComponent(part)).join("/")}`, { query: { ref: repo.defaultBranch } });
          children.data.filter((entry) => entry.type === "file" && isArchitectureContent(entry.name)).forEach((entry) => connectionFiles.set(entry.path, entry));
          const childDirs = children.data.filter((entry) => entry.type === "dir").slice(0, 12);
          if (childDirs.length) candidates.push(...childDirs.map((entry) => ({ repositoryFullName: repo.fullName, name: entry.name, path: entry.path, signal: "service-directory" as const, purpose: repo.description, runtime: repo.primaryLanguage })));
          else candidates.push({ repositoryFullName: repo.fullName, name: serviceRoot.name, path: serviceRoot.path, signal: "service-directory", purpose: repo.description, runtime: repo.primaryLanguage });
        } catch {
          candidates.push({ repositoryFullName: repo.fullName, name: serviceRoot.name, path: serviceRoot.path, signal: "service-directory", purpose: repo.description, runtime: repo.primaryLanguage });
        }
      }
      if (!roots.length) {
        const manifest = root.data.find((entry) => entry.type === "file" && runtimeManifests.has(entry.name));
        if (manifest) candidates.push({ repositoryFullName: repo.fullName, name: repo.name, path: manifest.path, signal: "runtime-manifest", purpose: repo.description, runtime: repo.primaryLanguage });
      }
      const servicePaths = candidates.filter((candidate) => candidate.repositoryFullName === repo.fullName).map((candidate) => candidate.path);
      const files = [...connectionFiles.values()].slice(0, 8);
      const content = await Promise.all(files.map(async (entry) => {
        try {
          const response = await restFetch<RestContentEntry>(token, `/repos/${owner}/${name}/contents/${entry.path.split("/").map((part) => encodeURIComponent(part)).join("/")}`, { query: { ref: repo.defaultBranch } });
          return { entry, text: response.data.encoding === "base64" && response.data.content ? decodeBase64(response.data.content).slice(0, 80_000) : "" };
        } catch {
          return { entry, text: "" };
        }
      }));
      for (const item of content) {
        if (!item.text) continue;
        const sourceServicePath = servicePaths.find((path) => item.entry.path === path || item.entry.path.startsWith(`${path}/`)) ?? null;
        connections.push(...extractArchitectureConnections(item.text, item.entry.path, repo.fullName, sourceServicePath));
      }
    } catch {
      // A partial permission failure should not hide candidates from other repos.
    }
  };

  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) await scan(queue.shift()!);
  });
  await Promise.all(workers);
  return {
    services: [...new Map(candidates.map((candidate) => [`${candidate.repositoryFullName}:${candidate.path}`, candidate])).values()],
    signals: [...new Map(signals.map((signal) => [`${signal.repositoryFullName}:${signal.type}:${signal.path}`, signal])).values()],
    connections: [...new Map(connections.map((connection) => [`${connection.repositoryFullName}:${connection.relation}:${connection.targetName}:${connection.sourcePath}`, connection])).values()],
    analyzedRepos,
    totalRepos: repos.length,
    truncated: selected.length < repos.length,
  };
}

function isArchitectureContent(name: string): boolean {
  return /openapi|swagger|graphql|\.proto$|schema|event|topic|queue|kafka|redpanda|rabbitmq|amqp|sqs|compose|terraform|kubernetes|k8s|wrangler|\.tf$|\.ya?ml$/i.test(name);
}

function architectureSignal(repo: GithubRepo, entry: RestContentEntry): GithubRepoArchitectureSignal | null {
  const value = entry.name.toLowerCase();
  let type: GithubRepoArchitectureSignal["type"] | null = null;
  let signal: GithubRepoArchitectureSignal["signal"] = "architecture-directory";
  if (/openapi|swagger|graphql|\.proto$|schema\.graphql/.test(value)) {
    type = "api";
    signal = "contract-file";
  } else if (/kafka|redpanda|topic|topics/.test(value)) type = "topic";
  else if (/event|events/.test(value)) type = "event";
  else if (/queue|queues|rabbitmq|sqs/.test(value)) type = "queue";
  else if (/database|databases|postgres|mysql|mongo|redis|migration|migrations/.test(value)) type = "database";
  else if (/infra|infrastructure|terraform|kubernetes|k8s|helm|docker-compose|kustomization|serverless|\.tf$|wrangler/.test(value)) {
    type = "infrastructure";
    signal = entry.type === "file" ? "runtime-config" : "architecture-directory";
  }
  if (!type) return null;
  return { repositoryFullName: repo.fullName, name: entry.name, path: entry.path, type, signal };
}

/** Lightweight codebase orientation for one selected repository. */
export async function fetchRepoSnapshot(
  token: string | null,
  fullName: string,
  branch: string,
): Promise<GithubRepoSnapshot> {
  const [owner, name] = fullName.split("/");
  if (!owner || !name) throw new Error("Invalid repository name.");

  const rootPromise = restFetch<RestContentEntry[]>(token, `/repos/${owner}/${name}/contents`, {
    query: { ref: branch },
  });
  const readmePromise = (async () => {
    try {
      return await restFetch<RestContentEntry>(token, `/repos/${owner}/${name}/readme`, {
        query: { ref: branch },
      });
    } catch {
      // A repository can have no README or a token can lack contents access.
      return null;
    }
  })();
  const root = await rootPromise;
  const rootNames = new Set(root.data.map((entry) => entry.name));
  const codeOwnersPath = rootNames.has("CODEOWNERS") ? "CODEOWNERS" : rootNames.has(".github") ? ".github/CODEOWNERS" : null;
  const [readmeResponse, codeOwners] = await Promise.all([
    readmePromise,
    codeOwnersPath ? fetchRepoCodeOwners(token, owner, name, branch, codeOwnersPath) : Promise.resolve(null),
  ]);
  const rootEntries = root.data
    .filter((entry) => entry.type === "file" || entry.type === "dir")
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      type: entry.type === "dir" ? ("dir" as const) : ("file" as const),
    }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));

  let readme: GithubRepoSnapshot["readme"] = { title: null, excerpt: null };
  if (readmeResponse?.data.content && readmeResponse.data.encoding === "base64") {
    const decoded = decodeBase64(readmeResponse.data.content);
    const lines = decoded.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const title = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim() ?? null;
    const excerpt = lines
      .filter((line) => !/^#{1,6}\s+/.test(line) && !/^[-*_`>]/.test(line))
      .join(" ")
      .replace(/[`*_\[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 260) || null;
    readme = { title, excerpt };
  }

  return { fullName, rootEntries, readme, codeOwners };
}

async function fetchRepoCodeOwners(
  token: string | null,
  owner: string,
  name: string,
  branch: string,
  path: string,
): Promise<{ path: string; owners: string[] } | null> {
  try {
    const encodedPath = path.split("/").map((part) => encodeURIComponent(part)).join("/");
    const response = await restFetch<RestContentEntry>(token, `/repos/${owner}/${name}/contents/${encodedPath}`, {
      query: { ref: branch },
    });
    if (!response.data.content || response.data.encoding !== "base64") return null;
    const content = decodeBase64(response.data.content);
    const owners = new Set<string>();
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      for (const candidate of trimmed.split(/\s+/).slice(1)) {
        if (candidate.startsWith("@") || candidate.includes("@")) owners.add(candidate);
      }
      if (owners.size >= 12) break;
    }
    return { path, owners: [...owners].slice(0, 12) };
  } catch {
    return null;
  }
}

/** Fetch one directory only when a user expands it in Repo Map. */
export async function fetchRepoDirectory(
  token: string | null,
  fullName: string,
  branch: string,
  path: string,
): Promise<GithubRepoSnapshot["rootEntries"]> {
  const [owner, name] = fullName.split("/");
  if (!owner || !name) throw new Error("Invalid repository name.");
  const encodedPath = path.split("/").map((part) => encodeURIComponent(part)).join("/");
  const response = await restFetch<RestContentEntry[]>(token, `/repos/${owner}/${name}/contents/${encodedPath}`, {
    query: { ref: branch },
  });
  return response.data
    .filter((entry) => entry.type === "file" || entry.type === "dir")
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      type: entry.type === "dir" ? ("dir" as const) : ("file" as const),
    }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
}

/** Fetch a bounded text preview for one file selected in Repo Map. */
export async function fetchRepoFilePreview(
  token: string | null,
  fullName: string,
  branch: string,
  path: string,
): Promise<GithubRepoFilePreview> {
  const [owner, name] = fullName.split("/");
  if (!owner || !name) throw new Error("Invalid repository name.");
  const encodedPath = path.split("/").map((part) => encodeURIComponent(part)).join("/");
  const response = await restFetch<RestContentEntry>(token, `/repos/${owner}/${name}/contents/${encodedPath}`, {
    query: { ref: branch },
  });
  if (!response.data.content || response.data.encoding !== "base64") throw new Error("This file cannot be previewed as text.");
  const decoded = decodeBase64(response.data.content);
  const maxCharacters = 12_000;
  const maxLines = 180;
  const clipped = decoded.slice(0, maxCharacters);
  const lines = clipped.split(/\r?\n/);
  const truncated = decoded.length > maxCharacters || lines.length > maxLines;
  return {
    fullName,
    path,
    content: lines.slice(0, maxLines).join("\n"),
    truncated,
  };
}

/** Recent default-branch commits for repository orientation. */
export async function fetchRepoCommits(
  token: string | null,
  fullName: string,
  branch: string,
  perPage = 8,
): Promise<GithubRepoCommit[]> {
  const response = await restFetch<RestCommit[]>(token, `/repos/${fullName}/commits`, {
    query: { sha: branch, per_page: perPage },
  });
  return response.data.map((commit) => ({
    sha: commit.sha,
    message: commit.commit.message.split(/\r?\n/, 1)[0] ?? "Untitled commit",
    authorLogin: commit.author?.login ?? commit.commit.author?.name ?? "unknown",
    authorAvatarUrl: commit.author?.avatar_url ?? "",
    authoredAt: commit.commit.author?.date ?? null,
    htmlUrl: commit.html_url,
  }));
}

/** On-demand file summary for one commit, kept separate from the commit list. */
export async function fetchRepoCommitDetail(
  token: string | null,
  fullName: string,
  sha: string,
): Promise<GithubRepoCommitDetail> {
  const response = await restFetch<RestCommitDetail>(token, `/repos/${fullName}/commits/${encodeURIComponent(sha)}`);
  return {
    sha: response.data.sha,
    message: response.data.commit.message.split(/\r?\n/, 1)[0] ?? "Untitled commit",
    files: (response.data.files ?? []).map((file) => ({
      path: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
    })),
  };
}

const REFERENCE_FILES = ["package.json", "go.mod", "Cargo.toml", "pyproject.toml", "README.md"];

/**
 * Find exact, repository-shaped references in a bounded source scan.
 * References are resolved against every repository in the selected scope, so
 * a quiet target repository is not lost just because it was not selected as a
 * source to inspect. This intentionally does not infer edges from names alone.
 */
export async function fetchRepoReferences(
  token: string | null,
  repos: GithubRepo[],
  limit = 16,
  priorityFullName?: string,
): Promise<GithubRepoReferenceSnapshot> {
  const ordered = repos
    .slice()
    .sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""))
  const priority = priorityFullName ? ordered.find((repo) => repo.fullName === priorityFullName) : undefined;
  const sources = [
    ...(priority ? [priority] : []),
    ...ordered.filter((repo) => repo.fullName !== priorityFullName),
  ].slice(0, limit);
  const references: GithubRepoReferenceSnapshot["references"] = [];
  const queue = [...sources];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const source = queue.shift();
      if (!source) return;
      const text = await fetchReferenceFile(token, source);
      if (!text) continue;
      for (const target of repos) {
        if (target.fullName === source.fullName) continue;
        const signal = referenceSignal(text.content, source, target);
        if (signal) references.push({ sourceFullName: source.fullName, targetFullName: target.fullName, path: text.path, signal });
      }
    }
  });
  await Promise.all(workers);
  const deduped = [...new Map(references.map((reference) => [`${reference.sourceFullName}:${reference.targetFullName}`, reference])).values()]
    .sort((a, b) => `${a.sourceFullName}:${a.targetFullName}`.localeCompare(`${b.sourceFullName}:${b.targetFullName}`));
  return { references: deduped, analyzedRepos: sources.length, totalRepos: repos.length, truncated: repos.length > sources.length };
}

async function fetchReferenceFile(token: string | null, repo: GithubRepo): Promise<{ path: string; content: string } | null> {
  const [owner, name] = repo.fullName.split("/");
  if (!owner || !name) return null;
  try {
    const root = await restFetch<RestContentEntry[]>(token, `/repos/${owner}/${name}/contents`, { query: { ref: repo.defaultBranch } });
    const rootNames = new Set(root.data.filter((entry) => entry.type === "file").map((entry) => entry.name));
    const path = REFERENCE_FILES.find((candidate) => rootNames.has(candidate));
    if (!path) return null;
    const response = await restFetch<RestContentEntry>(token, `/repos/${owner}/${name}/contents/${encodeURIComponent(path)}`, { query: { ref: repo.defaultBranch } });
    if (!response.data.content || response.data.encoding !== "base64") return null;
    const content = decodeBase64(response.data.content);
    return content ? { path, content: content.slice(0, 40_000) } : null;
  } catch {
    return null;
  }
}

function referenceSignal(text: string, source: GithubRepo, target: GithubRepo): "github-link" | "scoped-package" | null {
  const [owner, name] = target.fullName.split("/");
  if (!owner || !name) return null;
  const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fullName = escaped(`${owner}/${name}`);
  if (new RegExp(`github\\.com[/:]${fullName}(?:\\.git)?(?:[^A-Za-z0-9_-]|$)`, "i").test(text)) return "github-link";
  if (source.primaryLanguage === "JavaScript" || source.primaryLanguage === "TypeScript") {
    if (new RegExp(`['\"]@${escaped(owner)}/${escaped(name)}(?:['\"@/:]|$)`, "i").test(text)) return "scoped-package";
  }
  return null;
}

function decodeBase64(value: string): string {
  try {
    const binary = atob(value.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

/** Default-branch combined CI state for one repo (graceful when checks are inaccessible). */
export async function fetchRepoCiState(
  token: string | null,
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
  token: string | null,
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
  token: string | null,
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
  token: string | null,
  query: string,
  opts?: { maxPages?: number },
): Promise<GithubPullRequest[]> {
  const items = await searchRestItems(token, `${query} type:pr`, opts?.maxPages ?? 10);
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
  token: string | null,
  query: string,
  opts?: { maxPages?: number },
): Promise<GithubIssue[]> {
  const items = await searchRestItems(token, `${query} type:issue`, opts?.maxPages ?? 10);
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

/** GitHub search wraps results in an `items` field, unlike list endpoints. */
async function searchRestItems(token: string | null, query: string, maxPages: number): Promise<RestSearchItem[]> {
  const items: RestSearchItem[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await restFetch<RestSearchPayload>(token, "/search/issues", {
      query: { q: query, per_page: 100, page },
    });
    items.push(...response.data.items);
    if (response.data.items.length < 100) break;
  }
  return items;
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
  token: string | null,
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

/** Open issues for one repository (search keeps pull requests out of the result). */
export async function fetchRepoOpenIssues(
  token: string | null,
  fullName: string,
  perPage = 10,
): Promise<GithubIssue[]> {
  try {
    const { data } = await restFetch<RestSearchPayload>(token, "/search/issues", {
      query: { q: `repo:${fullName} is:issue is:open`, per_page: perPage, sort: "updated", direction: "desc" },
    });
    const orgLogin = fullName.split("/")[0] ?? "";
    return data.items
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        id: `repo-issue-${issue.id}`,
        number: issue.number,
        title: issue.title,
        repoFullName: fullName,
        orgLogin,
        authorLogin: issue.user?.login ?? "ghost",
        authorAvatarUrl: issue.user?.avatar_url ?? "",
        state: "open" as const,
        assignees: issue.assignees.map((assignee) => assignee.login),
        labels: issue.labels.map((label) => ({ name: label.name, color: label.color })),
        comments: issue.comments,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at,
        htmlUrl: issue.html_url,
      }));
  } catch {
    return [];
  }
}

/** Bounded current-work snapshot for the selected repository. */
export async function fetchRepoWorkSnapshot(
  token: string | null,
  fullName: string,
): Promise<GithubRepoWorkSnapshot> {
  const [owner, name] = fullName.split("/");
  if (!owner || !name) throw new Error("Invalid repository name.");
  const [prs, issues] = await Promise.all([
    fetchRepoOpenPrs(token, owner, name),
    fetchRepoOpenIssues(token, fullName),
  ]);
  return { fullName, prs, issues };
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
  token: string | null,
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
  token: string | null,
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
  token: string | null,
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
