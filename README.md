# Gity — Personal GitHub Command Center

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Gity is an **open-source (MIT)** personal GitHub dashboard on the edge: a static
Next.js frontend on **Cloudflare Pages** plus three tiny **Pages Functions** that exist
only to complete GitHub login. **GitHub itself is the source of truth**: the browser
fetches data directly from the GitHub REST and GraphQL APIs. No database, no Redis,
no webhooks, no MCP server. Connect with GitHub and it works across your public and
private repositories.

## Architecture

```
Browser / Gity (Cloudflare Pages, static)
   ├── GitHub GraphQL API  (nested repo / PR / issue / contribution data)
   ├── GitHub REST API     (search, Actions, events, token check)
   └── Pages Functions ─┐  (login only: /api/config, /api/exchange, /api/refresh)
                        │   holds client_secret server-side, stores nothing
                        ▼
                      GitHub
```

- Data calls go browser → `api.github.com` directly. The token is only ever sent to GitHub.
- Login codes are swapped for tokens in `functions/api/*` (same origin — no CORS involved).
- UI components never make raw GitHub calls. All data flows through:
  - `src/lib/github/` — transport (`client.ts`), GraphQL docs (`graphql.ts`), typed REST
    helpers (`rest.ts`), TanStack Query keys/options (`queries.ts`), shared models
    (`types.ts`), rate-limit store (`rate-limit.ts`), pagination helpers (`pagination.ts`).
  - `src/features/<domain>/` — service hooks (`overview`, `organizations`, `repositories`,
    `pull-requests`, `issues`, `actions`, `activity`, `streak`, `search`) that compose the
    query layer and aggregate for the UI.

## Stack

Cloudflare Pages (hosting) + Pages Functions (login exchange) · Next.js (App Router,
static export) · TypeScript (strict) · Tailwind CSS · shadcn-style UI · TanStack Query ·
Recharts · Lucide icons. Dark mode first.

## Local setup

```bash
npm install
npm run dev     # http://localhost:3000
```

Open the app and sign in with GitHub or paste a token when prompted (or in Settings).
That's it — no server configuration, no env secrets.

## Login options

**1. Connect with GitHub (recommended).** One-click PKCE login → `ghu_` user token with
the app's read permissions. Works for public and private repos, auto-refreshes while the
tab is open. Requires the one-time deployer setup below.

**2. Personal access token.** Fine-grained PAT pasted in the browser, stored in
localStorage or sessionStorage. Identical data access — the offline-capable fallback.

### Enabling “Connect with GitHub” (deployer setup, one time)

GitHub requires a `client_secret` to exchange login codes, so the swap happens in
`functions/api/*` (the only server-side code in Gity):

1. On your GitHub App (`gity-command-center`): add a **Callback URL**
   `https://<your-pages-domain>/auth/callback/` and generate a **client secret**.
2. In Cloudflare dashboard → Pages project → Settings → Environment variables:
   - `GITHUB_CLIENT_ID` = `Iv1.…` (plain variable — Client IDs are public).
   - `GITHUB_CLIENT_SECRET` = the secret ( **Encrypt** it).
3. Redeploy (automatic on push). Users click “Connect with GitHub”, approve, and land
   back in the dashboard — no token pasting.

## Hosting on Cloudflare

Monorepo layout: `apps/web` is the deployable project (Next.js static export in
`out/` + `functions/`). Deploy via the Cloudflare dashboard (free):

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** →
   select `Patel230/gity`.
2. Build settings: **Root directory `apps/web`**, framework preset **Next.js
   (Static HTML Export)**, build command `npm run build`, output directory `out`.
   (Dependencies install inside `apps/web` — it is self-contained.)
3. Every push to `main` redeploys automatically, with preview URLs per PR.
4. Add the `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` environment variables as above
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

## Token security (read this)

Gity stores the token **only in browser storage** (localStorage by default, sessionStorage
optionally) and sends it **only to `api.github.com`**. A frontend-only app cannot keep a
secret: anyone or any script with access to this browser profile can read the token.

- Suitable for **personal/local use**.
- **Not appropriate for a public multi-user deployment** — that would need a backend token
  vault, which is out of scope for V1 by design.
- Never paste a token on a shared machine; use short expirations; remove it in Settings when done.

## Live Refresh (auto-update)

There are no webhooks, and GitHub offers no push/streaming API for this —
so true real-time is impossible for a frontend. Gity instead implements
**automatic polling in two tiers**:

- **Live tier** (workflow runs, recent activity): polls on your interval while the
  tab is active. These are cheap REST calls with the highest signal value.
- **Calm tier** (repos, PRs, issues, CI, contributions): refreshes on page open,
  window focus/reconnect, and manual Refresh — never on the interval. A 30s poll
  on the repos query alone would burn the 5,000/hr GraphQL budget in minutes.
- A manual **Refresh** button invalidates all queries; header shows `Updated Xs ago`.
- Interval configurable in Settings: **Off / 15s / 30s / 60s / 5 min**.
- Last session's data is cached in the browser, so revisits paint instantly and
  then quietly revalidate live from GitHub in the background.

We deliberately call this “Live Refresh”, never “real-time”, in the UI.

## GitHub API rate limits

- REST (5,000/hr), Search (30 req/min), and GraphQL (5,000 pts/hr) budgets are tracked from
  response headers/payloads and shown in the header (remaining %) and on Overview/Settings.
- Protection strategy: TanStack Query caching + shared query keys (request deduplication),
  bounded per-repo fan-out (CI states, workflow runs), paginated-but-capped search windows,
  and polling that pauses when the tab is hidden.
- PR/issue aggregation uses the issue-search index (`involves:`) plus detailed per-repo
  fetches for the most active repos; the search index caps at ~1,000 results.
- **Incremental sync, not full search every time:** the first PR/issue listing fetches
  every page once and records a sync marker; later syncs fetch only items updated
  since that day (`updated:>=YYYY-MM-DD`) and merge by id. The manual Refresh button
  clears markers for a true full re-sync (heals deleted/transferred items).

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
