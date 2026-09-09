# Gity Agent API

Gity exposes an optional read-only JSON-RPC endpoint for MCP-compatible agent
runners:

```text
POST https://<gity-domain>/api/agent
GET  https://<gity-domain>/api/agent
```

Every request requires the server-side agent credential:

```http
Authorization: Bearer <GITY_AGENT_TOKEN>
Content-Type: application/json
```

The endpoint never accepts a browser Gity token. It creates a short-lived
GitHub App installation token from Cloudflare secrets for each tool call.

## Configuration

Configure these in the Cloudflare Pages production environment:

```text
GITY_AGENT_TOKEN       encrypted secret used by the agent client
GITHUB_APP_ID          GitHub App numeric ID
GITHUB_APP_PRIVATE_KEY encrypted GitHub App PEM private key
GITHUB_INSTALLATION_ID GitHub App installation ID
GITY_AGENT_ORIGIN      optional exact browser-client origin
```

The GitHub App should have only the read permissions required by the tools. Do
not put any of these values in the repository, browser code, or chat messages.

## Discovery

`GET /api/agent` returns the tool manifest. JSON-RPC discovery is also
available:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {}
}
```

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

## Read-only tools

| Tool | Required arguments | Purpose |
|---|---|---|
| `get_viewer` | none | Installation account identity |
| `list_repositories` | none | Visible repositories, max 100 per page |
| `list_pull_requests` | `owner`, `repo` | Pull requests for one repository |
| `search_issues` | `query` | Bounded issue/PR search |
| `get_workflow_runs` | `owner`, `repo` | Recent Actions runs |
| `get_recent_activity` | `login` | Recent public user activity |

Example:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "list_pull_requests",
    "arguments": {
      "owner": "owner",
      "repo": "repository",
      "state": "open",
      "per_page": 30
    }
  }
}
```

Successful results return JSON as a text content item. Invalid credentials
return HTTP 401. Invalid JSON-RPC or tool input returns a JSON-RPC error. GitHub
authentication or upstream failures are returned as a JSON-RPC tool error.

## Verification checklist

After configuring production secrets, verify in this order:

1. `GET /api/agent` with no authorization returns `401`.
2. `GET /api/agent` with the agent bearer token returns the tool manifest.
3. `initialize` returns the server name and protocol version.
4. `tools/list` returns the six read-only tools.
5. `get_viewer` returns the installation identity.
6. `list_repositories` returns only repositories visible to the installation.
7. A malformed tool call is rejected without a GitHub request.
8. Repeating steps 2–7 produces the same results without leaked credentials.

Write operations are intentionally absent until task persistence, human
approval, repository scope checks, idempotency, and an audit log are deployed.
