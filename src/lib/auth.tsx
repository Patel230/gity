/**
 * Token storage — browser-local only.
 * SECURITY: a frontend-only app cannot keep a secret. Anyone (or any
 * script) with access to this browser profile can read storage.
 * Gity is therefore a personal dashboard, not a multi-user service.
 *
 * Two credential kinds:
 * - `pat`: user-pasted Personal Access Token (legacy keys kept for compat).
 * - `oauth`: `ghu_` token from GitHub-App Device Flow ("Sign in with GitHub"),
 *   auto-refreshed with its `ghr_` refresh token while the tab is open.
 */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { githubClientId, refreshOAuthToken } from "./device-flow";
import { queryKeyBase, viewerOptions } from "./github/queries";
import { resetRateLimits } from "./github/rate-limit";

const LOCAL_KEY = "gity.token";
const SESSION_KEY = "gity.token.session";
const SESSION_OBJ = "gity.session";

export type StorageMode = "local" | "session";
export type CredentialKind = "pat" | "oauth";

export interface OAuthMeta {
  refreshToken: string | null;
  expiresAt: number | null;
  obtainedAt: number;
}

interface AuthState {
  token: string | null;
  kind: CredentialKind | null;
  oauth: OAuthMeta | null;
  fingerprint: string;
  storageMode: StorageMode;
  setToken: (token: string, mode: StorageMode) => void;
  setOAuthSession: (accessToken: string, meta: Omit<OAuthMeta, "obtainedAt">) => void;
  refreshOAuth: () => Promise<boolean>;
  clearToken: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function readStored(): { token: string | null; kind: CredentialKind | null; oauth: OAuthMeta | null; mode: StorageMode } {
  if (typeof window === "undefined")
    return { token: null, kind: null, oauth: null, mode: "local" };
  try {
    const obj = window.localStorage.getItem(SESSION_OBJ);
    if (obj) {
      const s = JSON.parse(obj) as {
        token: string;
        kind: CredentialKind;
        refreshToken?: string | null;
        expiresAt?: number | null;
        obtainedAt?: number;
        mode?: StorageMode;
      };
      if (s.token)
        return {
          token: s.token,
          kind: s.kind,
          oauth:
            s.kind === "oauth"
              ? {
                  refreshToken: s.refreshToken ?? null,
                  expiresAt: s.expiresAt ?? null,
                  obtainedAt: s.obtainedAt ?? Date.now(),
                }
              : null,
          mode: s.mode ?? "local",
        };
    }
    // Legacy PAT keys.
    const local = window.localStorage.getItem(LOCAL_KEY);
    if (local) return { token: local, kind: "pat", oauth: null, mode: "local" };
    const session = window.sessionStorage.getItem(SESSION_KEY);
    if (session) return { token: session, kind: "pat", oauth: null, mode: "session" };
  } catch {
    /* storage unavailable */
  }
  return { token: null, kind: null, oauth: null, mode: "local" };
}

function persist(token: string, kind: CredentialKind, oauth: OAuthMeta | null, mode: StorageMode) {
  window.localStorage.removeItem(LOCAL_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
  if (kind === "oauth" || mode === "local") {
    window.localStorage.setItem(
      SESSION_OBJ,
      JSON.stringify({
        token,
        kind,
        refreshToken: oauth?.refreshToken ?? null,
        expiresAt: oauth?.expiresAt ?? null,
        obtainedAt: oauth?.obtainedAt ?? Date.now(),
        mode,
      }),
    );
  } else {
    window.localStorage.removeItem(SESSION_OBJ);
    window.sessionStorage.setItem(SESSION_KEY, token);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [kind, setKind] = useState<CredentialKind | null>(null);
  const [oauth, setOauth] = useState<OAuthMeta | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [fingerprint, setFingerprint] = useState("anon");
  const [hydrated, setHydrated] = useState(false);
  const refreshing = useRef(false);

  useEffect(() => {
    const stored = readStored();
    setTokenState(stored.token);
    setKind(stored.kind);
    setOauth(stored.oauth);
    setStorageMode(stored.mode);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      setFingerprint("anon");
      return;
    }
    queryKeyBase(token)
      .then(([_, fp]) => setFingerprint(fp))
      .catch(() => setFingerprint(`len-${token.length}`));
  }, [token, hydrated]);

  const clearToken = useCallback(() => {
    try {
      window.localStorage.removeItem(LOCAL_KEY);
      window.localStorage.removeItem(SESSION_OBJ);
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    resetRateLimits();
    setTokenState(null);
    setKind(null);
    setOauth(null);
  }, []);

  const setToken = useCallback((next: string, mode: StorageMode) => {
    try {
      persist(next, "pat", null, mode);
    } catch {
      /* ignore */
    }
    resetRateLimits();
    setStorageMode(mode);
    setKind("pat");
    setOauth(null);
    setTokenState(next);
  }, []);

  const setOAuthSession = useCallback(
    (accessToken: string, meta: Omit<OAuthMeta, "obtainedAt">) => {
      const full: OAuthMeta = { ...meta, obtainedAt: Date.now() };
      try {
        persist(accessToken, "oauth", full, "local");
      } catch {
        /* ignore */
      }
      resetRateLimits();
      setStorageMode("local");
      setKind("oauth");
      setOauth(full);
      setTokenState(accessToken);
    },
    [],
  );

  const refreshOAuth = useCallback(async (): Promise<boolean> => {
    const clientId = githubClientId();
    const rt = oauth?.refreshToken;
    if (!token || kind !== "oauth" || !rt || !clientId || refreshing.current) return false;
    refreshing.current = true;
    try {
      const t = await refreshOAuthToken(clientId, rt);
      setOAuthSession(t.accessToken, {
        refreshToken: t.refreshToken ?? rt,
        expiresAt: t.expiresIn ? Date.now() + t.expiresIn * 1000 : null,
      });
      return true;
    } catch {
      clearToken(); // refresh token dead → force re-login via TokenGate
      return false;
    } finally {
      refreshing.current = false;
    }
  }, [token, kind, oauth?.refreshToken, setOAuthSession, clearToken]);

  // Proactively refresh expiring OAuth tokens (5 min early) while the tab is open.
  useEffect(() => {
    if (kind !== "oauth" || !oauth?.expiresAt || !oauth.refreshToken) return;
    const msLeft = oauth.expiresAt - Date.now();
    const delay = Math.max(0, msLeft - 5 * 60_000);
    const t = setTimeout(() => {
      void refreshOAuth();
    }, delay);
    return () => clearTimeout(t);
  }, [kind, oauth?.expiresAt, oauth?.refreshToken, refreshOAuth]);

  const value = useMemo(
    () => ({ token, kind, oauth, fingerprint, storageMode, setToken, setOAuthSession, refreshOAuth, clearToken }),
    [token, kind, oauth, fingerprint, storageMode, setToken, setOAuthSession, refreshOAuth, clearToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Authenticated viewer (disabled until a token exists). */
export function useViewerUser() {
  const { token, fingerprint } = useAuth();
  return useQuery({
    ...viewerOptions(token, fingerprint),
    refetchInterval: false,
  });
}
