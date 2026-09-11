# Nexus architecture

```text
Git provider
  -> fetcher and permission boundary
  -> deterministic parsers and analyzers
  -> normalized entities and evidence
  -> resolver and confidence assignment
  -> versioned graph snapshot
  -> graph query API
  -> Nexus views and entity side panel
```

The existing GitHub transport, OAuth session handling, PAT compatibility,
Cloudflare relay, D1 response cache, and React Query cache remain shared
infrastructure. Nexus adds analysis and graph modules beside those adapters;
it does not make UI components consume raw GitHub responses.

## Progressive disclosure

The default view should move through:

```text
organization -> domain/subsystem -> repository -> service
             -> interface/event/data dependency -> connection explanation
```

The renderer must cluster and collapse by default. It should load deeper nodes
only after a user expands or focuses a group. A flat all-to-all graph is not a
valid default for a large organization.

## UI surfaces

Nexus grows around these views:

- Overview: meaningful counts, index health, confidence coverage, and changes.
- Architecture: clustered 2D graph with focus, expand/collapse, filters, and
  edge explanations.
- Services: service cards and a side-panel detail view.
- Flows: named use cases with sanitized, animated data movement.
- Infrastructure: runtimes, deployments, environments, and resources.
- Repositories: the existing detailed repository map and dossier.
- Explore: entity search, breadcrumbs, and upstream/downstream navigation.

The service panel stays open over the graph. Navigation is reserved for
deep-linking or explicitly requested repository/source pages.
