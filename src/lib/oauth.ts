/**
 * Browser OAuth login (Authorization Code + PKCE, S256) for the GitHub App.
 * The browser NEVER sees the client_secret: code exchange happens in the
 * minimal exchange worker (worker/), which the frontend calls here.
 * PKCE binds the flow to this browser session (state + code_verifier in
 * sessionStorage — tab-scoped, never persisted).
 */

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";

export function authWorkerUrl(): string {
  return (process.env.NEXT_PUBLIC_AUTH_WORKER_URL ?? "").replace(/\/$/, "");
}

export function callbackUrl(): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${window.location.origin}${base}/auth/callback/`;
}

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomString(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
}

async function s256(verifier: string): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
}

export async function getClientId(): Promise<string> {
  const base = authWorkerUrl();
  if (!base) throw new Error("Login service is not configured on this deployment.");
  const res = await fetch(`${base}/api/config`);
  if (!res.ok) throw new Error("Login service is unreachable. Try again or use a token.");
  const { client_id } = (await res.json()) as { client_id?: string };
  if (!client_id) throw new Error("Login service is misconfigured (no client ID).");
  return client_id;
}

/** Step 1: redirect the tab to GitHub's authorize page. */
export async function startLogin(): Promise<void> {
  const clientId = await getClientId();
  const state = randomString(16);
  const verifier = randomString(64);
  const challenge = await s256(verifier);
  sessionStorage.setItem("gity.oauth.state", state);
  sessionStorage.setItem("gity.oauth.verifier", verifier);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl(),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  window.location.assign(`${AUTHORIZE_URL}?${params.toString()}`);
}

export interface OAuthTokens {
  accessToken: string;
  expiresIn?: number;
  refreshToken?: string;
}

/** Step 2 (callback page): validate state, swap code for tokens via worker. */
export async function finishLogin(search: string): Promise<OAuthTokens> {
  const q = new URLSearchParams(search);
  const code = q.get("code");
  const state = q.get("state");
  const err = q.get("error");
  if (err) throw new Error(err === "access_denied" ? "You denied access on GitHub." : `GitHub refused authorization (${err}).`);
  const expectedState = sessionStorage.getItem("gity.oauth.state");
  const verifier = sessionStorage.getItem("gity.oauth.verifier");
  sessionStorage.removeItem("gity.oauth.state");
  sessionStorage.removeItem("gity.oauth.verifier");
  if (!code || !state || state !== expectedState || !verifier) {
    throw new Error("Login session mismatch. Please start again — never share login links.");
  }
  const base = authWorkerUrl();
  const res = await fetch(`${base}/api/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, redirect_uri: callbackUrl() }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error === "bad_verification_code"
        ? "This login link expired or was already used. Please start again."
        : "Could not complete login. Please try again.",
    );
  }
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token,
  };
}

/** Renew an expiring token via the worker (secret stays server-side). */
export async function refreshTokens(refreshToken: string): Promise<OAuthTokens> {
  const base = authWorkerUrl();
  const res = await fetch(`${base}/api/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error("Session expired. Please connect again.");
  }
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token,
  };
}
