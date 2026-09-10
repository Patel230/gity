import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { sessions, users } from "./schema";
import type { GityEnv } from "./env";

export const SESSION_COOKIE = "gity_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export interface GithubProfile {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
}

export interface SessionRecord {
  id: string;
  userId: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  fingerprint: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
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

function fromBase64url(value: string): Uint8Array {
  const remainder = value.length % 4;
  const padding = remainder === 0 ? "" : "=".repeat(4 - remainder);
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding),
    (char) => char.charCodeAt(0),
  );
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64url(new Uint8Array(bytes));
}

async function encryptionKey(env: GityEnv): Promise<CryptoKey> {
  if (!env.SESSION_ENCRYPTION_KEY) {
    throw new Error("SESSION_ENCRYPTION_KEY is not configured.");
  }
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(env.SESSION_ENCRYPTION_KEY),
  );
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(env: GityEnv, value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(env),
    new TextEncoder().encode(value),
  );
  return base64url(iv) + "." + base64url(new Uint8Array(encrypted));
}

export async function encryptSecret(env: GityEnv, value: string): Promise<string> {
  return encrypt(env, value);
}

async function decrypt(env: GityEnv, value: string): Promise<string> {
  const [ivPart, encryptedPart] = value.split(".");
  if (!ivPart || !encryptedPart) throw new Error("Invalid encrypted session value.");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64url(ivPart) as unknown as BufferSource },
    await encryptionKey(env),
    fromBase64url(encryptedPart) as unknown as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

export async function decryptSecret(env: GityEnv, value: string): Promise<string> {
  return decrypt(env, value);
}

function randomValue(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function cookie(request: Request): string | null {
  const header = request.headers.get("Cookie") ?? "";
  for (const item of header.split(";")) {
    const [name, ...value] = item.trim().split("=");
    if (name === SESSION_COOKIE) return value.join("=") || null;
  }
  return null;
}

export function sessionCookie(value: string): string {
  return (
    SESSION_COOKIE +
    "=" +
    value +
    "; Max-Age=" +
    COOKIE_MAX_AGE +
    "; Path=/; HttpOnly; Secure; SameSite=Lax"
  );
}

export function clearSessionCookie(): string {
  return SESSION_COOKIE + "=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax";
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function createSession(
  env: GityEnv,
  profile: GithubProfile,
  tokens: SessionTokens,
): Promise<{ cookie: string; fingerprint: string; expiresAt: number | null }> {
  const now = Date.now();
  const raw = randomValue();
  const id = crypto.randomUUID();
  const fingerprint = randomValue(12);
  const databaseClient = database(env);

  await databaseClient
    .insert(users)
    .values({
      id: profile.id,
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      htmlUrl: profile.htmlUrl,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        login: profile.login,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        htmlUrl: profile.htmlUrl,
        updatedAt: now,
      },
    })
    .run();

  await databaseClient
    .insert(sessions)
    .values({
      id,
      userId: profile.id,
      tokenHash: await digest(raw),
      accessTokenEncrypted: await encrypt(env, tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken
        ? await encrypt(env, tokens.refreshToken)
        : null,
      fingerprint,
      expiresAt: tokens.expiresAt ?? null,
      createdAt: now,
      lastSeenAt: now,
    })
    .run();

  return {
    cookie: sessionCookie(raw),
    fingerprint,
    expiresAt: tokens.expiresAt ?? null,
  };
}

export async function getSession(
  request: Request,
  env: GityEnv,
): Promise<SessionRecord | null> {
  const raw = cookie(request);
  if (!raw || !env.DB || !env.SESSION_ENCRYPTION_KEY) return null;
  const rows = await database(env)
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, await digest(raw)))
    .limit(1);
  const found = rows[0];
  if (!found) return null;

  try {
    return {
      id: found.session.id,
      userId: found.session.userId,
      login: found.user.login,
      name: found.user.name,
      avatarUrl: found.user.avatarUrl,
      htmlUrl: found.user.htmlUrl,
      fingerprint: found.session.fingerprint,
      accessToken: await decrypt(env, found.session.accessTokenEncrypted),
      refreshToken: found.session.refreshTokenEncrypted
        ? await decrypt(env, found.session.refreshTokenEncrypted)
        : null,
      expiresAt: found.session.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function updateSessionTokens(
  env: GityEnv,
  sessionId: string,
  tokens: SessionTokens,
): Promise<void> {
  await database(env)
    .update(sessions)
    .set({
      accessTokenEncrypted: await encrypt(env, tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken
        ? await encrypt(env, tokens.refreshToken)
        : null,
      expiresAt: tokens.expiresAt ?? null,
      lastSeenAt: Date.now(),
    })
    .where(eq(sessions.id, sessionId))
    .run();
}

export async function deleteSession(request: Request, env: GityEnv): Promise<void> {
  if (!env.DB) return;
  const raw = cookie(request);
  if (!raw) return;
  await database(env)
    .delete(sessions)
    .where(eq(sessions.tokenHash, await digest(raw)))
    .run();
}
