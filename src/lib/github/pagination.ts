/**
 * Pagination helpers: REST Link-header traversal and
 * GraphQL connection traversal. Never assume 100 == all.
 */
import { GithubApiError } from "./types";

export interface PageResult<T> {
  items: T[];
  /** Parsed `rel="next"` URL, if any. */
  nextUrl: string | null;
  headers: Headers;
}

export function parseLinkHeader(header: string | null): Record<string, string> {
  const links: Record<string, string> = {};
  if (!header) return links;
  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
    if (match) links[match[2]] = match[1];
  }
  return links;
}

export interface GraphqlConnection<T> {
  nodes?: (T | null)[] | null;
  edges?: ({ node?: T | null } | null)[] | null;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount?: number;
}

export function connectionNodes<T>(conn: GraphqlConnection<T>): T[] {
  if (conn.nodes) return conn.nodes.filter((n): n is T => n != null);
  if (conn.edges)
    return conn.edges
      .map((e) => e?.node)
      .filter((n): n is T => n != null);
  return [];
}

/** Sequentially fetch all pages of a GraphQL connection field. */
export async function fetchAllConnectionPages<TNode, TArgs>(
  fetchPage: (after: string | null) => Promise<GraphqlConnection<TNode>>,
  opts?: { maxPages?: number; onPage?: (nodes: TNode[]) => void },
): Promise<TNode[]> {
  const maxPages = opts?.maxPages ?? 50; // 50 * 100 = 5k nodes safety cap
  const all: TNode[] = [];
  let after: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const conn = await fetchPage(after);
    const nodes = connectionNodes(conn);
    all.push(...nodes);
    opts?.onPage?.(nodes);
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
    after = conn.pageInfo.endCursor;
  }
  return all;
}

export function toGithubError(status: number, message: string): GithubApiError {
  if (status === 401)
    return new GithubApiError(
      "auth",
      status,
      "GitHub rejected the token (401). It may be expired, revoked, or malformed.",
    );
  if (status === 403)
    return new GithubApiError(
      "forbidden",
      status,
      message ||
        "GitHub refused the request (403). The token likely lacks the required permission.",
    );
  if (status === 404)
    return new GithubApiError("not-found", status, message || "Not found (404).");
  if (status === 422)
    return new GithubApiError(
      "validation",
      status,
      message || "GitHub rejected the request parameters (422).",
    );
  if (status >= 500)
    return new GithubApiError(
      "server",
      status,
      message || `GitHub is having issues (${status}). Try again shortly.`,
    );
  return new GithubApiError("server", status, message || `Request failed (${status}).`);
}
