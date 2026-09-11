import type { GithubRepo } from "../github/types";
import type { NexusBaselineInput, NexusEdge, NexusEvidence, NexusGraphSnapshot, NexusNode } from "./types";

const SYSTEM_ID = "system:workspace";

function id(type: string, value: string): string {
  return `${type}:${value.toLowerCase()}`;
}

function repoId(repo: GithubRepo): string {
  return id("repository", repo.fullName);
}

function evidenceId(source: string, target: string, path: string): string {
  return id("evidence", `${source}->${target}:${path}`);
}

function metadataEvidence(repo: GithubRepo, indexedAt: string): NexusEvidence {
  return {
    id: id("evidence", `${repo.fullName}:metadata`),
    repositoryId: repoId(repo),
    path: null,
    kind: "metadata",
    locator: repo.htmlUrl,
    observedAt: indexedAt,
  };
}

function node(repo: GithubRepo, indexedAt: string, evidence: NexusEvidence): NexusNode {
  return {
    id: repoId(repo),
    type: "repository",
    name: repo.name,
    description: repo.description,
    repositoryIds: [repoId(repo)],
    organizationId: id("organization", repo.ownerLogin),
    domainId: null,
    runtime: null,
    environment: null,
    confidence: "confirmed",
    evidenceIds: [evidence.id],
    indexedAt,
    metadata: {
      fullName: repo.fullName,
      language: repo.primaryLanguage,
      branch: repo.defaultBranch,
      visibility: repo.visibility,
      archived: repo.isArchived,
      ciState: repo.ciState,
      stars: repo.stars,
      openPullRequests: repo.openPrCount,
      openIssues: repo.openIssueCount,
    },
  };
}

function edge(sourceId: string, targetId: string, type: NexusEdge["type"], confidence: NexusEdge["confidence"], evidenceIds: string[], explanation: string, indexedAt: string, protocol: string | null = null): NexusEdge {
  return { id: id("edge", `${type}:${sourceId}->${targetId}`), sourceId, targetId, type, protocol, confidence, evidenceIds, explanation, indexedAt };
}

/**
 * Build the deterministic repository-level graph used by the first Nexus
 * surface. It deliberately does not guess services or dependencies from names.
 */
export function normalizeBaselineGraph(input: NexusBaselineInput): NexusGraphSnapshot {
  const indexedAt = input.indexedAt ?? new Date().toISOString();
  const repos = input.repos;
  const repoByName = new Map(repos.map((repo) => [repo.fullName, repo]));
  const evidence = repos.map((repo) => metadataEvidence(repo, indexedAt));
  const nodes: NexusNode[] = [
    {
      id: SYSTEM_ID,
      type: "system",
      name: "Workspace",
      description: "The visible GitHub workspace represented by this Nexus snapshot.",
      repositoryIds: repos.map(repoId),
      organizationId: null,
      domainId: null,
      runtime: null,
      environment: null,
      confidence: "confirmed",
      evidenceIds: [],
      indexedAt,
      metadata: { scope: "visible repositories" },
    },
  ];
  const edges: NexusEdge[] = [];
  const orgs = [...new Set(repos.map((repo) => repo.ownerLogin))].sort((a, b) => a.localeCompare(b));
  for (const login of orgs) {
    const orgId = id("organization", login);
    const orgRepos = repos.filter((repo) => repo.ownerLogin === login);
    nodes.push({
      id: orgId,
      type: "organization",
      name: login,
      description: null,
      repositoryIds: orgRepos.map(repoId),
      organizationId: orgId,
      domainId: null,
      runtime: null,
      environment: null,
      confidence: "confirmed",
      evidenceIds: orgRepos.map((repo) => id("evidence", `${repo.fullName}:metadata`)),
      indexedAt,
      metadata: { repositoryCount: orgRepos.length },
    });
    edges.push(edge(SYSTEM_ID, orgId, "contains", "confirmed", [], `Workspace contains organization ${login}.`, indexedAt));
    for (const repo of orgRepos) {
      const rid = repoId(repo);
      edges.push(edge(orgId, rid, "contains", "confirmed", [id("evidence", `${repo.fullName}:metadata`)], `${login} owns visible repository ${repo.fullName}.`, indexedAt));
      edges.push(edge(orgId, rid, "owns", "confirmed", [id("evidence", `${repo.fullName}:metadata`)], `GitHub metadata identifies ${login} as the owner of ${repo.fullName}.`, indexedAt));
    }
  }
  nodes.push(...repos.map((repo) => node(repo, indexedAt, metadataEvidence(repo, indexedAt))));

  for (const candidate of input.services ?? []) {
    const repo = repoByName.get(candidate.repositoryFullName);
    if (!repo) continue;
    const evId = evidenceId(repo.fullName, `${repo.fullName}:${candidate.name}`, candidate.path);
    evidence.push({
      id: evId,
      repositoryId: repoId(repo),
      path: candidate.path,
      kind: candidate.signal === "runtime-manifest" ? "config" : "static_analysis",
      locator: `${repo.htmlUrl}/tree/${repo.defaultBranch}/${candidate.path}`,
      excerpt: candidate.signal === "runtime-manifest" ? "Runtime manifest found at this repository boundary." : "Explicit service-shaped directory found in this repository.",
      observedAt: indexedAt,
    });
    const serviceId = id("service", `${repo.fullName}:${candidate.path}`);
    nodes.push({
      id: serviceId,
      type: "service",
      name: candidate.name,
      description: candidate.purpose ?? (candidate.signal === "runtime-manifest" ? "Candidate runtime boundary; confirm whether this repository contains one or more deployable services." : "Candidate service boundary detected from an explicit service-shaped directory."),
      repositoryIds: [repoId(repo)],
      organizationId: id("organization", repo.ownerLogin),
      domainId: null,
      runtime: candidate.runtime ?? repo.primaryLanguage,
      environment: null,
      confidence: candidate.signal === "runtime-manifest" ? "needs_review" : "inferred",
      evidenceIds: [evId],
      indexedAt,
      metadata: { repositoryFullName: repo.fullName, path: candidate.path, candidate: true, signal: candidate.signal, runtime: candidate.runtime ?? repo.primaryLanguage },
    });
    edges.push(edge(repoId(repo), serviceId, "contains", "high", [evId], `${repo.fullName} contains a candidate service boundary at ${candidate.path}.`, indexedAt));
  }

  for (const signal of input.signals ?? []) {
    const repo = repoByName.get(signal.repositoryFullName);
    if (!repo) continue;
    const evId = evidenceId(repo.fullName, `${signal.type}:${signal.name}`, signal.path);
    evidence.push({
      id: evId,
      repositoryId: repoId(repo),
      path: signal.path,
      kind: signal.type === "api" ? "contract" : signal.type === "infrastructure" ? "infra" : "config",
      locator: `${repo.htmlUrl}/tree/${repo.defaultBranch}/${signal.path}`,
      excerpt: `Architecture signal detected from ${signal.signal}.`,
      observedAt: indexedAt,
    });
    const signalId = id(signal.type, `${repo.fullName}:${signal.path}`);
    nodes.push({
      id: signalId,
      type: signal.type,
      name: signal.name,
      description: `Architecture signal detected from ${signal.path}; inspect the evidence before treating it as a confirmed ${signal.type}.`,
      repositoryIds: [repoId(repo)],
      organizationId: id("organization", repo.ownerLogin),
      domainId: null,
      runtime: null,
      environment: null,
      confidence: signal.signal === "contract-file" ? "high" : "inferred",
      evidenceIds: [evId],
      indexedAt,
      metadata: { repositoryFullName: repo.fullName, path: signal.path, signal: signal.signal },
    });
    edges.push(edge(repoId(repo), signalId, "contains", signal.signal === "contract-file" ? "high" : "inferred", [evId], `${repo.fullName} contains a ${signal.type} signal at ${signal.path}.`, indexedAt));
  }

  for (const connection of input.connections ?? []) {
    const repo = repoByName.get(connection.repositoryFullName);
    if (!repo) continue;
    const sourceRepositoryId = repoId(repo);
    const sourceService = connection.sourceServicePath
      ? nodes.find((candidate) => candidate.type === "service" && candidate.repositoryIds.includes(sourceRepositoryId) && candidate.metadata.path === connection.sourceServicePath)
      : undefined;
    const sourceId = sourceService?.id ?? sourceRepositoryId;
    const targetType = connection.relation === "calls" ? "external_service" : connection.protocol === "kafka" ? "topic" : connection.protocol === "amqp" || connection.protocol === "sqs" ? "queue" : "event";
    const existingTarget = nodes.find((candidate) => candidate.type === targetType && candidate.name.toLowerCase() === connection.targetName.toLowerCase());
    const evId = evidenceId(repo.fullName, `${connection.relation}:${connection.targetName}`, connection.sourcePath);
    if (!evidence.some((item) => item.id === evId)) {
      evidence.push({
        id: evId,
        repositoryId: sourceRepositoryId,
        path: connection.sourcePath,
        kind: "static_analysis",
        locator: `${repo.htmlUrl}/blob/${repo.defaultBranch}/${connection.sourcePath}`,
        excerpt: `Explicit ${connection.relation.replaceAll("_", " ")} target ${connection.targetName} detected.`,
        observedAt: indexedAt,
      });
    }
    const targetId = existingTarget?.id ?? id(targetType, targetType === "external_service" ? connection.targetName : `${repo.fullName}:${connection.targetName}`);
    if (!existingTarget) {
      nodes.push({
        id: targetId,
        type: targetType,
        name: connection.targetName,
        description: targetType === "external_service" ? "External dependency inferred from an explicit call target." : `Message endpoint inferred from an explicit ${connection.relation.replaceAll("_", " ")} claim.`,
        repositoryIds: targetType === "external_service" ? [] : [sourceRepositoryId],
        organizationId: targetType === "external_service" ? null : id("organization", repo.ownerLogin),
        domainId: null,
        runtime: null,
        environment: null,
        confidence: "inferred",
        evidenceIds: [evId],
        indexedAt,
        metadata: { repositoryFullName: repo.fullName, path: connection.sourcePath, target: connection.targetName },
      });
    } else {
      if (!existingTarget.evidenceIds.includes(evId)) existingTarget.evidenceIds = [...existingTarget.evidenceIds, evId];
      if (targetType !== "external_service" && !existingTarget.repositoryIds.includes(sourceRepositoryId)) existingTarget.repositoryIds = [...existingTarget.repositoryIds, sourceRepositoryId];
    }
    edges.push(edge(sourceId, targetId, connection.relation, "inferred", [evId], `Explicit ${connection.relation.replaceAll("_", " ")} claim in ${connection.sourcePath} targets ${connection.targetName}.`, indexedAt, connection.protocol));
    if (connection.relation === "subscribes_to") {
      edges.push(edge(targetId, sourceId, "triggers", "inferred", [evId], `${connection.targetName} is wired to trigger ${sourceService?.name ?? repo.name} through the subscription detected in ${connection.sourcePath}.`, indexedAt, connection.protocol));
    }
  }

  for (const signal of input.signals ?? []) {
    const signalNodeId = id(signal.type, `${signal.repositoryFullName}:${signal.path}`);
    const service = nodes.find((candidate) => candidate.type === "service" && candidate.repositoryIds.includes(id("repository", signal.repositoryFullName)) && typeof candidate.metadata.path === "string" && (signal.path === candidate.metadata.path || signal.path.startsWith(`${candidate.metadata.path}/`)));
    if (service && nodes.some((candidate) => candidate.id === signalNodeId)) {
      edges.push(edge(service.id, signalNodeId, "contains", "high", nodes.find((candidate) => candidate.id === signalNodeId)?.evidenceIds ?? [], `${service.name} contains an evidence signal at ${signal.path}.`, indexedAt));
    }
  }

  for (const repo of repos) {
    if (repo.parentFullName) {
      const parent = repoByName.get(repo.parentFullName);
      if (parent) {
        edges.push(edge(repoId(parent), repoId(repo), "depends_on", "confirmed", [id("evidence", `${repo.fullName}:metadata`)], `${repo.fullName} is a GitHub fork of ${parent.fullName}.`, indexedAt));
      }
    }
  }
  for (const reference of input.references ?? []) {
    const source = repoByName.get(reference.sourceFullName);
    const target = repoByName.get(reference.targetFullName);
    if (!source || !target) continue;
    const evId = evidenceId(source.fullName, target.fullName, reference.path);
    evidence.push({
      id: evId,
      repositoryId: repoId(source),
      path: reference.path,
      kind: reference.signal === "scoped-package" ? "manifest" : "docs",
      locator: `${source.htmlUrl}/blob/${source.defaultBranch}/${reference.path}`,
      observedAt: indexedAt,
    });
    edges.push(edge(repoId(source), repoId(target), "imports", "high", [evId], `Exact cross-repository reference detected in ${reference.path}.`, indexedAt));
  }

  return {
    version: 1,
    indexedAt,
    scope: { repositoryCount: repos.length, analyzedRepositoryCount: repos.length },
    nodes,
    edges: [...new Map(edges.map((item) => [item.id, item])).values()],
    evidence: [...new Map(evidence.map((item) => [item.id, item])).values()],
  };
}
