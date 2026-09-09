# Gity — Personal GitHub Command Center

[![Deploy to GitHub Pages](https://github.com/Patel230/gity/actions/workflows/deploy.yml/badge.svg)](https://github.com/Patel230/gity/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Gity is a **frontend-only, open-source (MIT)** personal GitHub dashboard. There is no backend, no database,
no Redis, no webhook service, and no MCP server. **GitHub itself is the source of truth**:
the browser fetches data directly from the GitHub REST and GraphQL APIs. It deploys as a
static site to **GitHub Pages** — sign in with your GitHub account and it works across your
public and private repositories.

## Architecture

```
Browser / Gity
   ├── GitHub GraphQL API  (nested repo / PR / issue / contribution data)
   └── GitHub REST API     (search, Actions, events, token check)
            │
            ▼
          GitHub
```

- No API proxy: `src/app/api` does not exist by design. The token is only ever sent to `api.github.com`.
- UI components never make raw GitHub calls. All data flows through:
  - `src/lib/github/` — transport (`client.ts`), GraphQL docs (`graphql.ts`), typed REST
    helpers (`rest.ts`), TanStack Query keys/options (`queries.ts`), shared models
    (`types.ts`), rate-limit store (`rate-limit.ts`), pagination helpers (`pagination.ts`).
  - `src/features/<domain>/` — service hooks (`overview`, `organizations`, `repositories`,
    `pull-requests`, `issues`, `actions`, `activity`, `streak`, `search`) that compose the
    query layer and aggregate for the UI.

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS · shadcn-style UI · TanStack Query ·
Recharts · Lucide icons. Dark mode first.

## Local setup

```bash
npm install
npm run dev     # http://localhost:3000
```

Open the app and sign in with GitHub or paste a token when prompted (or in Settings).
That's it — no server configuration, no env secrets.

## Login options

**Personal access token (the supported sign-in).** A fine-grained PAT pasted in the
browser, stored in localStorage or sessionStorage. Full data access, including private
repos. See “Creating a fine-grained GitHub PAT” below for the minimum permissions.

### Why no “Sign in with GitHub” button?

We tried — and GitHub's platform says no. A static site has no backend, so the normal
OAuth web flow (needs a `client_secret`) is impossible, and the Device Flow fallback
(which needs only a public Client ID) is also unusable from a browser: we verified that
`github.com/login/device/code` sends **no CORS headers**, so every browser `fetch` to it
fails, while `api.github.com` explicitly allows browser origins (`access-control-allow-origin: *`).
GitHub only intends those login endpoints for servers/CLIs. One-click login would require
a small token-exchange backend, which Gity deliberately doesn't have — the PAT path gives
identical access with zero infrastructure.

## Hosting on GitHub Pages

Gity builds as a fully static export (`output: "export"` → `out/`). Pushing to `main`
triggers `.github/workflows/deploy.yml`, which builds and deploys via GitHub Actions.
One-time repo setup: **Settings → Pages → Source: “GitHub Actions”**. The workflow sets
the project-pages base path (`/<repo>`) automatically; nothing else to configure.

## Creating a fine-grained GitHub PAT

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** →
Generate new token. Minimum read permissions for full Gity functionality:

| Permission | Why |
|---|---|
| Metadata (mandatory) | required on every fine-grained token |
| Contents: read | repos, languages, branches |
| Pull requests: read | PR lists, review states |
| Issues: read | issues, labels |
| Actions: read | workflow runs |
| Checks / Commit statuses: read | CI state |
| Members (Organization): read | org listing |

Classic-token fallback: `repo` + `read:org` scopes cover everything but grant more than needed.
If an org enforces SAML SSO, authorize the token for that org (“Configure SSO”) or org data 404s.

## Token security (read this)

Gity stores the token **only in browser storage** (localStorage by default, sessionStorage
optionally) and sends it **only to `api.github.com`**. A frontend-only app cannot keep a
secret: anyone or any script with access to this browser profile can read the token.

- Suitable for **personal/local use**.
- **Not appropriate for a public multi-user deployment** — that would need a backend token
  vault, which is out of scope for V1 by design.
- Never paste a token on a shared machine; use short expirations; remove it in Settings when done.

## Live Refresh (auto-update)

There are no webhooks and no backend, and GitHub offers no push/streaming API for this —
so true real-time is impossible for a Pages-hosted frontend. Gity instead implements
**automatic near-live polling**:

- Important overview data refetches every **30s by default** while the tab is active.
- Polling backs off to ≥5 min while the tab is hidden, and refetches immediately on window focus/reconnect.
- A manual **Refresh** button invalidates all queries; header shows `Updated Xs ago`.
- Configurable in Settings: **Off / 15s / 30s / 60s / 5 min**. 15s is the closest to
  “real-time” the GitHub API allows without burning rate limits.

We deliberately call this “Live Refresh”, never “real-time”, in the UI.

## GitHub API rate limits

- REST (5,000/hr), Search (30 req/min), and GraphQL (5,000 pts/hr) budgets are tracked from
  response headers/payloads and shown in the header (remaining %) and on Overview/Settings.
- Protection strategy: TanStack Query caching + shared query keys (request deduplication),
  bounded per-repo fan-out (CI states, workflow runs), paginated-but-capped search windows,
  and polling that pauses when the tab is hidden.
- PR/issue aggregation uses the issue-search index (`involves:`) plus detailed per-repo
  fetches for the most active repos; the search index caps at ~1,000 results, which is
  surfaced honestly in the UI counts.

## Gity Activity Streak

The Streak page is **custom to Gity** and may not match GitHub's contribution graph: an active
day is any day with a commit/push, PR opened, PR merged, issue opened/closed, or review —
built from the contribution calendar overlaid with today's live events.

## Contributing

PRs welcome. Keep it frontend-only: no backends, no proxies, no secrets in the bundle
(except the public GitHub-App Client ID). Run `npx tsc --noEmit` and `npm run build`
before pushing.

## License

MIT — see [LICENSE](LICENSE). Free for personal and commercial use.
