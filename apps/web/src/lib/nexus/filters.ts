import type { NexusGraphSnapshot, NexusNode, NexusNodeType } from "./types";

export interface NexusFilter {
  query?: string;
  types?: NexusNodeType[];
  repositoryId?: string;
  organizationId?: string;
  runtime?: string;
  environment?: string;
}

export function filterNexusNodes(snapshot: NexusGraphSnapshot, filter: NexusFilter): NexusNode[] {
  const query = filter.query?.trim().toLowerCase();
  const types = filter.types?.length ? new Set(filter.types) : null;
  return snapshot.nodes.filter((node) => {
    if (types && !types.has(node.type)) return false;
    if (filter.repositoryId && !node.repositoryIds.includes(filter.repositoryId)) return false;
    if (filter.organizationId && node.organizationId !== filter.organizationId) return false;
    if (filter.runtime && node.runtime !== filter.runtime) return false;
    if (filter.environment && node.environment !== filter.environment) return false;
    if (!query) return true;
    return `${node.name} ${node.description ?? ""} ${node.type}`.toLowerCase().includes(query);
  });
}
