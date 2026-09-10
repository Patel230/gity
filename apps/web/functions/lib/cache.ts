import { and, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { githubCache } from "./schema";
import type { GityEnv } from "./env";
import type { SessionRecord } from "./session";

const MAX_CACHE_BYTES = 800_000;
const CACHE_TTL_MS = 60_000;

export interface CachedGithubResponse {
  status: number;
  body: string;
  contentType: string;
  rateLimitRemaining: string | null;
  rateLimitReset: string | null;
}

export async function cacheKey(
  target: string,
  body: ArrayBuffer | undefined,
): Promise<string> {
  const bodyText = body ? new TextDecoder().decode(body) : "";
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(target + "\n" + bodyText),
  );
  return Array.from(
    new Uint8Array(bytes),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function getCachedGithubResponse(
  env: GityEnv,
  session: SessionRecord | null,
  key: string,
): Promise<CachedGithubResponse | null> {
  if (!env.DB || !session) return null;
  const rows = await drizzle(env.DB)
    .select()
    .from(githubCache)
    .where(
      and(
        eq(githubCache.userId, session.userId),
        eq(githubCache.cacheKey, key),
        gt(githubCache.expiresAt, Date.now()),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row
    ? {
        status: row.status,
        body: row.body,
        contentType: row.contentType,
        rateLimitRemaining: row.rateLimitRemaining?.toString() ?? null,
        rateLimitReset: row.rateLimitReset?.toString() ?? null,
      }
    : null;
}

export async function putCachedGithubResponse(
  env: GityEnv,
  session: SessionRecord | null,
  key: string,
  response: Response,
  body: string,
): Promise<void> {
  if (!env.DB || !session || response.status < 200 || response.status >= 300) return;
  if (new TextEncoder().encode(body).byteLength > MAX_CACHE_BYTES) return;
  const now = Date.now();
  const contentType = response.headers.get("content-type") ?? "application/json";
  const rateLimitRemaining = numberHeader(
    response.headers.get("x-ratelimit-remaining"),
  );
  const rateLimitReset = numberHeader(response.headers.get("x-ratelimit-reset"));

  await drizzle(env.DB)
    .insert(githubCache)
    .values({
      userId: session.userId,
      cacheKey: key,
      status: response.status,
      body,
      contentType,
      rateLimitRemaining,
      rateLimitReset,
      expiresAt: now + CACHE_TTL_MS,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [githubCache.userId, githubCache.cacheKey],
      set: {
        status: response.status,
        body,
        contentType,
        rateLimitRemaining,
        rateLimitReset,
        expiresAt: now + CACHE_TTL_MS,
        createdAt: now,
      },
    })
    .run();
}

function numberHeader(value: string | null): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
