# Gitty Nexus

Gitty Nexus is Gitty's living system-understanding layer. It connects the
visible GitHub workspace to a progressively richer model of systems, domains,
repositories, services, interfaces, and connections.

The initial implementation is intentionally repository-first. It normalizes
organization ownership, repository metadata, verified fork lineage, exact
cross-repository references, and delivery signals. Later analyzers can add
services, contracts, events, data stores, infrastructure, and use-case flows
without changing the UI's fundamental vocabulary.

## Product contract

- `/nexus` is the only system-understanding entry point. The former `/map` and
  `/graph` routes are removed; the repository workspace (ownership, references,
  delivery signals, dossier) lives in the Nexus Repositories view.
- Every non-trivial relationship needs evidence and a confidence level.
- Missing evidence is shown as unknown; repository names are never treated as
  proof of a dependency.
- Source and payload content is bounded, permission-aware, sanitized, and never
  treated as a place to store secrets.

## Documents

- [Architecture](./architecture.md)
- [Graph model](./graph-model.md)
- [Indexing](./indexing.md)
- [Flows](./flows.md)
- [Decisions](./decisions.md)
- [Roadmap](./roadmap.md)
