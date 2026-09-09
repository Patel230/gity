/**
 * GitHub Device Authorization Flow (RFC 8628) for a **GitHub App**.
 *
 * Why device flow: a static site on GitHub Pages has no backend, so it
 * cannot keep an OAuth `client_secret`. The normal web flow is therefore
 * impossible. The device flow with a *GitHub App* (not an OAuth App —
 * those still require the secret) needs only the public Client ID, which
 * is safe to embed in the frontend bundle via NEXT_PUBLIC_GITHUB_CLIENT_ID.
 *
 * Result: a `ghu_` user-to-server token acting as the signed-in user, with
 * access to public AND private repos per the app's permissions. Tokens
 * expire after ~8h and are renewed with the `ghr_` refresh token
 * (also secret-free).
 */
import { GithubApiError } from "./github/types";

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface DeviceToken {
  accessToken: string;
  expiresIn?: number;
  refreshToken?: string;
  refreshTokenExpiresIn?: number;
  tokenType: string;
}

export type DeviceFlowErrorKind = "denied" | "expired" | "network" | "server";

export class DeviceFlowError extends Error {
  kind: DeviceFlowErrorKind;
  constructor(kind: DeviceFlowErrorKind, message: string) {
    super(message);
    this.name = "DeviceFlowError";
    this.kind = kind;
  }
}

async function postJson<T>(url: string, body: Record<string, string>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new DeviceFlowError(
      "network",
      e instanceof Error
        ? `Could not reach github.com (${e.message}). Check your connection or use a PAT instead.`
        : "Could not reach github.com. Check your connection or use a PAT instead.",
    );
  }
  if (!res.ok)
    throw new DeviceFlowError("server", `github.com returned ${res.status}. Try again.`);
  return (await res.json()) as T;
}

/** Step 1: get a user code for the user to enter at github.com/login/device. */
export async function requestDeviceCode(clientId: string): Promise<DeviceCode> {
  const r = await postJson<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
    error?: string;
    error_description?: string;
  }>(DEVICE_CODE_URL, { client_id: clientId });
  if (r.error || !r.device_code)
    throw new DeviceFlowError("server", r.error_description ?? "GitHub refused the device request.");
  return {
    deviceCode: r.device_code,
    userCode: r.user_code,
    verificationUri: r.verification_uri,
    expiresIn: r.expires_in,
    interval: r.interval,
  };
}

interface TokenSuccess {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  token_type: string;
  error?: undefined;
}

interface TokenFailure {
  error: string;
  error_description?: string;
  access_token?: undefined;
}

/**
 * Step 2: poll until the user authorizes (or denies / the code expires).
 * Respects the server-provided interval; abort via AbortSignal (cancel button).
 */
export async function pollDeviceToken(
  clientId: string,
  deviceCode: string,
  intervalSec: number,
  signal: AbortSignal,
): Promise<DeviceToken> {
  let interval = Math.max(5, intervalSec);
  for (;;) {
    if (signal.aborted) throw new DeviceFlowError("expired", "Sign-in was cancelled.");
    const r = await postJson<TokenSuccess | TokenFailure>(TOKEN_URL, {
      client_id: clientId,
      device_code: deviceCode,
      grant_type: DEVICE_GRANT,
    });
    if (r.access_token) {
      return {
        accessToken: r.access_token,
        expiresIn: r.expires_in,
        refreshToken: r.refresh_token,
        refreshTokenExpiresIn: r.refresh_token_expires_in,
        tokenType: r.token_type,
      };
    }
    const f = r as TokenFailure;
    switch (f.error) {
      case "authorization_pending":
        await sleep(interval * 1000, signal);
        break;
      case "slow_down":
        interval += 5;
        await sleep(interval * 1000, signal);
        break;
      case "access_denied":
        throw new DeviceFlowError("denied", "You denied access on GitHub. No token was issued.");
      case "expired_token":
        throw new DeviceFlowError("expired", "The code expired before authorization. Start again.");
      default:
        throw new DeviceFlowError(
          "server",
          f.error_description ?? `Authorization failed (${f.error ?? "unknown"}).`,
        );
    }
  }
}

/** Renew an expiring `ghu_` token using its `ghr_` refresh token (secret-free). */
export async function refreshOAuthToken(
  clientId: string,
  refreshToken: string,
): Promise<DeviceToken> {
  const r = await postJson<TokenSuccess | TokenFailure>(TOKEN_URL, {
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  if (!r.access_token)
    throw new GithubApiError(
      "auth",
      401,
      r.error === "bad_refresh_token"
        ? "Session expired (refresh token revoked or expired). Please sign in again."
        : "Could not refresh the GitHub session. Please sign in again.",
    );
  return {
    accessToken: r.access_token,
    expiresIn: r.expires_in,
    refreshToken: r.refresh_token,
    refreshTokenExpiresIn: r.refresh_token_expires_in,
    tokenType: r.token_type,
  };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DeviceFlowError("expired", "Sign-in was cancelled."));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Public Client ID baked in at build time. Empty when the deployer didn't set one. */
export function githubClientId(): string {
  return process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ?? "";
}
