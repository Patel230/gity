# Nexus indexing

## Pipeline

```text
Git provider -> indexer -> parsers/analyzers -> normalized entities
             -> resolver -> graph snapshot -> explanation/query layer
```

The first baseline is computed from the already available repository metadata,
verified fork metadata, exact bounded reference scan, and delivery signals.
The next indexer stages add contracts, service boundaries, infrastructure, and
documentation as separate evidence producers.

## Index lifecycle

Every workspace snapshot should expose:

- indexed-at timestamp;
- source revision or provider snapshot where available;
- running, ready, partial, stale, and failed status;
- visible repository count versus analyzed repository count;
- permission gaps and rate-limit constraints;
- a manual refresh action.

Incremental updates should begin with manual refresh and changed repositories.
Webhook and scheduled refresh can follow once the persisted snapshot/API is in
place. Expensive analysis must not run on every architecture question.

## Safety and scale

Fetchers must respect GitHub visibility and permissions, redact secret-like
values, cap file sizes/excerpts, and avoid logging source contents. The UI
starts with a bounded 2D graph and progressively loads groups. Server-side
indexing and viewport-aware queries are required before targeting hundreds of
repositories or thousands of services.
