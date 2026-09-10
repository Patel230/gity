import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { decryptSecret, encryptSecret, getSession, isSameOrigin, type SessionRecord } from "./session";
import { linearConnections } from "./schema";
import type { GityEnv } from "./env";

export const LINEAR_STATE_COOKIE = "gity_linear_state";
export const LINEAR_VERIFIER_COOKIE = "gity_linear_verifier";
const OAUTH_COOKIE_MAX_AGE = 10 * 60;

export interface LinearTokenSet {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  scope?: string;
}

export interface LinearConnectionRecord {
  userId: string;
  linearUserId: string;
  linearUserName: string | null;
  workspaceName: string | null;
  scope: string;
  expiresAt: number | null;
  updatedAt: number;
}

export interface LinearSessionContext {
  session: SessionRecord;
  connection: LinearConnectionRecord;
  accessToken: string;
  refreshToken: string | null;
}

function database(env: GityEnv) {
  if (!env.DB) throw new Error("D1 binding DB is not configured.");
  return drizzle(env.DB);
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomValue(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") ?? "";
  for (const item of header.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}

export function secureOAuthCookie(name: string, value: string): string {
  return `${name}=${value}; Max-Age=${OAUTH_COOKIE_MAX_AGE}; Path=/api/linear; HttpOnly; Secure; SameSite=Lax`;
}

export function clearOAuthCookie(name: string): string {
  return `${name}=; Max-Age=0; Path=/api/linear; HttpOnly; Secure; SameSite=Lax`;
}

export function constantTimeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let result = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) result |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return result === 0;
}

export async function createPkcePair(): Promise<{ state: string; verifier: string; challenge: string }> {
  const state = randomValue(24);
  const verifier = randomValue(48);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { state, verifier, challenge: base64url(new Uint8Array(digest)) };
}

export async function getLinearSessionContext(
  request: Request,
  env: GityEnv,
): Promise<LinearSessionContext | null> {
  const session = await getSession(request, env);
  if (!session || !env.DB || !env.SESSION_ENCRYPTION_KEY) return null;
  const rows = await database(env)
    .select()
    .from(linearConnections)
    .where(eq(linearConnections.userId, session.userId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  try {
    return {
      session,
      connection: {
        userId: row.userId,
        linearUserId: row.linearUserId,
        linearUserName: row.linearUserName,
        workspaceName: row.workspaceName,
        scope: row.scope,
        expiresAt: row.expiresAt,
        updatedAt: row.updatedAt,
      },
      accessToken: await decryptSecret(env, row.accessTokenEncrypted),
      refreshToken: row.refreshTokenEncrypted ? await decryptSecret(env, row.refreshTokenEncrypted) : null,
    };
  } catch {
    return null;
  }
}

export async function saveLinearConnection(
  env: GityEnv,
  userId: string,
  profile: { id: string; name?: string | null; workspaceName?: string | null },
  tokens: LinearTokenSet,
): Promise<void> {
  const now = Date.now();
  const client = database(env);
  await client
    .insert(linearConnections)
    .values({
      userId,
      linearUserId: profile.id,
      linearUserName: profile.name ?? null,
      workspaceName: profile.workspaceName ?? null,
      accessTokenEncrypted: await encryptSecret(env, tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken ? await encryptSecret(env, tokens.refreshToken) : null,
      scope: tokens.scope ?? "read",
      expiresAt: tokens.expiresAt ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: linearConnections.userId,
      set: {
        linearUserId: profile.id,
        linearUserName: profile.name ?? null,
        workspaceName: profile.workspaceName ?? null,
        accessTokenEncrypted: await encryptSecret(env, tokens.accessToken),
        refreshTokenEncrypted: tokens.refreshToken ? await encryptSecret(env, tokens.refreshToken) : null,
        scope: tokens.scope ?? "read",
        expiresAt: tokens.expiresAt ?? null,
        updatedAt: now,
      },
    })
    .run();
}

export async function updateLinearTokens(
  env: GityEnv,
  userId: string,
  tokens: LinearTokenSet,
): Promise<void> {
  await database(env)
    .update(linearConnections)
    .set({
      accessTokenEncrypted: await encryptSecret(env, tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken ? await encryptSecret(env, tokens.refreshToken) : undefined,
      expiresAt: tokens.expiresAt ?? null,
      updatedAt: Date.now(),
    })
    .where(eq(linearConnections.userId, userId))
    .run();
}

export async function deleteLinearConnection(request: Request, env: GityEnv): Promise<void> {
  if (!isSameOrigin(request) || !env.DB) return;
  const session = await getSession(request, env);
  if (!session) return;
  await database(env).delete(linearConnections).where(eq(linearConnections.userId, session.userId)).run();
}
