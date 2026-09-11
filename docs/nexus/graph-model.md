# Nexus graph model

## Entity types

```text
organization, system, domain, repository, service, api, event, topic, queue,
database, cache, bucket, external_service, runtime, infrastructure,
deployment, actor
```

## Edge types

```text
contains, owns, depends_on, calls, publishes, subscribes_to, reads_from,
writes_to, deployed_on, routes_to, imports, triggers, authenticates_via
```

## Confidence

- `confirmed`: directly represented by authoritative provider metadata or a
  declared contract/configuration.
- `high`: deterministic evidence strongly supports the relation, but it is not
  an explicit provider fact.
- `inferred`: a heuristic or multi-signal conclusion that needs contextual
  review.
- `needs_review`: conflicting, stale, incomplete, or AI-generated evidence.

AI conclusions never become `confirmed` without deterministic evidence.

## Evidence

Evidence records identify a repository, bounded path/locator, source kind,
observation time, and optional sanitized excerpt. Source kinds are ordered by
reliability:

```text
metadata/contracts > OpenAPI/protobuf/GraphQL > infrastructure > config
> static analysis > manifests > docs > AI
```

The graph stores provenance and summaries, not access tokens, secrets, or
production payloads.
