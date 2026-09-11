# Gity — Personal GitHub Command Center

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Gity is an **open-source (MIT)** multi-user GitHub dashboard on the edge: a static
Next.js frontend on **Cloudflare Pages** plus Pages Functions for secure GitHub
login, encrypted sessions, D1-backed response caching, resilient relay retries,
and the optional protected read-only agent API. GitHub remains the source of truth;
D1 stores only session metadata and short-lived per-user API response caches.

The canonical orientation surface is **Gitty Nexus** at `/nexus` (with the repository-oriented
compatibility view at `/map`). It groups repositories
by ownership, shows verified fork lineage and exact bounded code references between repos,
surfaces delivery and CI signals, and opens a selected repository into a dossier with its
README, codebase shape, recent commits, changed paths, pull requests, and issues. Relationship
edges are evidence-backed and bounded; an absent edge is never presented as proof that no
dependency exists.

## Architecture

```
Browser / Gity (Cloudflare Pages, static)
   │  HttpOnly gity_session cookie; no OAuth token in browser storage
   ▼
Pages Functions (same origin)
   ├── /api/exchange, /api/refresh, /api/logout, /api/session
   ├── /api/github ──► GitHub REST + GraphQL
   ├── /api/linear ──► Linear GraphQL + OAuth2
   └── D1 (Drizzle ORM)
       ├── encrypted OAuth sessions
       ├── encrypted Linear connections
       └── 60-second per-user GitHub response cache
```

- OAuth access and refresh tokens are encrypted at rest in D1 and never returned to the browser.
- The same-origin relay authenticates server sessions from the HttpOnly cookie; PAT fallback
  requests remain explicitly browser-held and are not cached server-side.
- Cache misses return the GitHub result immediately while the D1 write runs in the Pages
  background; repeat requests can be served without another GitHub call.
- Login codes are swapped for sessions in `functions/api/*` (same origin — no CORS involved).
- UI components never make raw GitHub calls. All data flows through:
  - `src/lib/github/` — transport (`client.ts`), GraphQL docs (`graphql.ts`), typed REST
    helpers (`rest.ts`), TanStack Query keys/options (`queries.ts`), shared models
    (`types.ts`), rate-limit store (`rate-limit.ts`), pagination helpers (`pagination.ts`).
  - `src/features/<domain>/` — service hooks (`overview`, `organizations`, `repositories`,
    `pull-requests`, `issues`, `actions`, `activity`, `streak`, `search`) that compose the
    query layer and aggregate for the UI.

## Stack

Cloudflare Pages (hosting) + Pages Functions · Cloudflare D1 + Drizzle ORM · Next.js (App Router,
static export) · TypeScript (strict) · Tailwind CSS · shadcn-style UI · TanStack Query · Recharts ·
Lucide icons. Dark mode first.

## Local setup

```bash
npm install
npm run dev     # http://localhost:3000
```

For local UI work, the app can still use a PAT. For full OAuth/session behavior, run Pages
Functions with a D1 binding and configure `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and
`SESSION_ENCRYPTION_KEY` as runtime variables/secrets.

## Login options

**1. Connect with GitHub (recommended).** One-click PKCE login creates a server-side
HttpOnly session with the app's read permissions. Works for public and private repos and
renews automatically while the tab is open. GitHub tokens never enter browser storage.

**2. Personal access token.** Fine-grained PAT pasted in the browser, stored in
localStorage or sessionStorage. Identical data access — the offline-capable fallback.

### Linear integration (read-only)

The `/linear` page connects one Linear workspace per GitHub user through Linear OAuth2
with PKCE. Gity reads teams, projects, and recent issues through Linear's GraphQL API;
it does not create or modify Linear data. OAuth tokens are encrypted in the D1
`linear_connections` table and are never sent to the browser.

To enable it, create a Linear OAuth application and register:

```text
https://<your-pages-domain>/api/linear/callback
```

Add `LINEAR_CLIENT_ID` and encrypted `LINEAR_CLIENT_SECRET` to the Cloudflare Pages
project, apply `npm run db:migrate:remote` from `apps/web`, and redeploy. The current
production callback is `https://gity-49t.pages.dev/api/linear/callback`.

### Enabling “Connect with GitHub” (deployer setup, one time)

GitHub requires a `client_secret` to exchange login codes, so the swap happens in
`functions/api/*` (the only server-side code in Gity):

1. On your GitHub App (`gity-command-center`): add a **Callback URL**
   `https://<your-pages-domain>/auth/callback/` and generate a **client secret**.
2. In Cloudflare dashboard → Pages project → Settings → Environment variables:
   - `GITHUB_CLIENT_ID` = `Iv1.…` (plain variable — Client IDs are public).
   - `GITHUB_CLIENT_SECRET` = the secret ( **Encrypt** it).
   - `SESSION_ENCRYPTION_KEY` = a long random value ( **Encrypt** it).
3. Apply the D1 migration from `apps/web`: `npm run db:migrate:remote`.
4. Redeploy. Users click “Connect with GitHub”, approve, and land
   back in the dashboard — no token pasting.

## Hosting on Cloudflare

Monorepo layout: `apps/web` is the deployable project (Next.js static export in
`out/` + `functions/`). Deploy via the Cloudflare dashboard (free):

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** →
   select `Patel230/gity`.
2. Build settings: **Root directory `apps/web`**, framework preset **Next.js
   (Static HTML Export)**, build command `npm run build`, output directory `out`.
   (Dependencies install inside `apps/web` — it is self-contained.)
3. If the Pages project is connected to Git, every push to `main` redeploys automatically.
   For the current unconnected project, deploy the built `out/` directory explicitly:
   `CLOUDFLARE_ACCOUNT_ID=<account-id> npx wrangler pages deploy out --project-name gity`.
4. Add the `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `SESSION_ENCRYPTION_KEY` variables as above
   to enable login, then register the Callback URL on the GitHub App.

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

## Session and token security (read this)

The recommended OAuth path stores GitHub credentials encrypted in D1 and gives the browser
only an opaque `HttpOnly; Secure; SameSite=Lax` session cookie. Session rows are scoped to a
GitHub user, expire with the GitHub token, and are never included in API responses or logs.

The PAT path is intentionally a compatibility fallback. PATs are stored only in browser
storage and can be read by scripts running in that browser profile.

- OAuth is the correct path for public/multi-user deployments.
- Never paste a PAT on a shared machine; use short expirations; remove it in Settings when done.
- Rotate `SESSION_ENCRYPTION_KEY` only with a planned session invalidation, because old
  encrypted sessions cannot be decrypted with a new key.

## Live Refresh (auto-update)

There are no webhooks, and GitHub offers no push/streaming API for this —
so true real-time is impossible for a frontend. Gity instead implements
**automatic polling in two tiers**:

- **Live tier** (workflow runs, recent activity): polls on your interval while the
  tab is active. These are cheap REST calls with the highest signal value.
- **Calm tier** (repos, PRs, issues, CI, contributions): refreshes automatically every
  15 minutes. A 30s poll on the repos query alone would burn the 5,000/hr GraphQL budget
  in minutes.
- There is no manual refresh control: persisted data paints immediately and automatic
  incremental sync keeps it current without forcing full-history reloads.
- Interval configurable in Settings: **Off / 15s / 30s / 60s / 5 min**.
- TanStack Query keeps the current view in the browser, while D1 keeps short-lived server
  responses available across tabs and repeat visits for the same user.

## Agent API (read-only)

Gity also includes an optional protected MCP-style JSON-RPC endpoint at
`/api/agent`. It is designed for an agent runner to inspect GitHub without
receiving a user's browser token. It currently exposes bounded read-only tools
for the viewer, repositories, pull requests, issue search, Actions runs, and
recent activity.

The endpoint requires a bearer token (`GITY_AGENT_TOKEN`) and authenticates to
GitHub with a GitHub App installation token generated from
`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_INSTALLATION_ID`. GitHub
App installation tokens are short-lived; Gity requests one for each tool call
and never returns it to the agent.

Configure these values as encrypted Cloudflare Pages variables/secrets. Keep
the agent token private and set `GITY_AGENT_ORIGIN` only when a browser-based
agent client needs cross-origin access. Write operations are intentionally not
available yet; they will be added only with explicit approval and audit-log
support.

Example tool call:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_repositories",
    "arguments": { "per_page": 30 }
  }
}
```

We deliberately call this “Live Refresh”, never “real-time”, in the UI.

## GitHub API rate limits

- REST (5,000/hr), Search (30 req/min), and GraphQL (5,000 pts/hr) budgets are tracked from
  response headers/payloads and shown in the header (remaining %) and on Overview/Settings.
- Protection strategy: TanStack Query caching + shared query keys (request deduplication),
  bounded per-repo fan-out (CI states, workflow runs), paginated-but-capped search windows,
  and polling that pauses when the tab is hidden.
- PR/issue aggregation uses the issue-search index (`involves:`), with one shared PR
  snapshot powering both open and merged views; the search index caps at ~1,000 results.
- **Incremental sync, not full search every time:** the first PR/issue listing fetches
  every page once and records a sync marker; later syncs fetch only items updated
  since that day (`updated:>=YYYY-MM-DD`) and merge by id. A failed refresh keeps the
  last successful snapshot visible and reports the error instead of pretending stale
  data is current.

## Operations and scale

- Relay responses expose `X-Gity-Relay-Attempts` and `Server-Timing`; upstream failures are
  recorded in Cloudflare Pages function logs without tokens or query strings.
- D1 migrations live in `apps/web/migrations/` and the schema is defined in
  `apps/web/functions/lib/schema.ts`; Drizzle is used for typed session/cache queries.
- If usage grows substantially, move the relay to a dedicated monitored Worker with
  per-user rate limiting and centralized observability; the session/data model is already
  separated so that migration remains incremental.

## Gity Activity Streak

The Streak page is **custom to Gity** and may not match GitHub's contribution graph: an active
day is any day with a commit/push, PR opened, PR merged, issue opened/closed, or review —
built from the contribution calendar overlaid with today's live events.

## Contributing

PRs welcome. Keep the UI static and keep secrets server-side: no secrets in the bundle
(except the public GitHub-App Client ID). Run `npx tsc --noEmit`, `npm test`, and `npm run build`
before pushing.

## License

MIT — see [LICENSE](LICENSE). Free for personal and commercial use.
