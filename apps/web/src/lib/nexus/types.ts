import type { GithubRepo, GithubRepoArchitectureConnection, GithubRepoArchitectureSignal, GithubRepoReferenceSnapshot, GithubRepoServiceSnapshot, GithubWorkflowRun } from "../github/types";

export type NexusNodeType =
  | "organization"
  | "system"
  | "domain"
  | "repository"
  | "service"
  | "api"
  | "event"
  | "topic"
  | "queue"
  | "database"
  | "cache"
  | "bucket"
  | "external_service"
  | "runtime"
  | "infrastructure"
  | "deployment"
  | "actor";

export type NexusEdgeType =
  | "contains"
  | "owns"
  | "depends_on"
  | "calls"
  | "publishes"
  | "subscribes_to"
  | "reads_from"
  | "writes_to"
  | "deployed_on"
  | "routes_to"
  | "imports"
  | "triggers"
  | "authenticates_via";

export type NexusConfidence = "confirmed" | "high" | "inferred" | "needs_review";
export type NexusEvidenceKind = "metadata" | "contract" | "infra" | "config" | "static_analysis" | "manifest" | "docs" | "ai";

export interface NexusEvidence {
  id: string;
  repositoryId: string;
  path: string | null;
  kind: NexusEvidenceKind;
  locator?: string;
  excerpt?: string;
  observedAt: string;
}

export interface NexusNode {
  id: string;
  type: NexusNodeType;
  name: string;
  description: string | null;
  repositoryIds: string[];
  organizationId: string | null;
  domainId: string | null;
  runtime: string | null;
  environment: string | null;
  confidence: NexusConfidence;
  evidenceIds: string[];
  indexedAt: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface NexusEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: NexusEdgeType;
  protocol: string | null;
  confidence: NexusConfidence;
  evidenceIds: string[];
  explanation: string;
  indexedAt: string;
}

export interface NexusGraphSnapshot {
  version: 1;
  indexedAt: string;
  scope: { repositoryCount: number; analyzedRepositoryCount: number };
  nodes: NexusNode[];
  edges: NexusEdge[];
  evidence: NexusEvidence[];
}

export interface NexusBaselineInput {
  repos: GithubRepo[];
  references?: GithubRepoReferenceSnapshot["references"];
  services?: GithubRepoServiceSnapshot["services"];
  signals?: GithubRepoArchitectureSignal[];
  connections?: GithubRepoArchitectureConnection[];
  runs?: GithubWorkflowRun[];
  indexedAt?: string;
}
