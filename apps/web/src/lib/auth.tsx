/**
 * Authentication state.
 *
 * OAuth access and refresh tokens stay in the encrypted server-side session.
 * A local PAT remains available as an explicit compatibility fallback for
 * deployments where OAuth is not configured.
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
import { tokenFingerprint, viewerOptions } from "./github/queries";
import { resetRateLimits } from "./github/rate-limit";
import { refreshTokens } from "./oauth";
import type { ServerSession } from "./oauth";

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
  serverSession: ServerSession | null;
  ready: boolean;
  fingerprint: string;
  storageMode: StorageMode;
  setToken: (token: string, mode: StorageMode) => void;
  setServerSession: (session: ServerSession) => void;
  refreshOAuth: () => Promise<boolean>;
  clearToken: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function readStoredToken(): {
  token: string | null;
  kind: CredentialKind | null;
  oauth: OAuthMeta | null;
  mode: StorageMode;
} {
  if (typeof window === "undefined")
    return { token: null, kind: null, oauth: null, mode: "local" };
  try {
    const obj = window.localStorage.getItem(SESSION_OBJ);
    if (obj) {
      const s = JSON.parse(obj) as {
        token?: string;
        kind?: CredentialKind;
        refreshToken?: string | null;
        expiresAt?: number | null;
        obtainedAt?: number;
        mode?: StorageMode;
      };
      if (s.token)
        return {
          token: s.token,
          kind: s.kind ?? "pat",
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
    const local = window.localStorage.getItem(LOCAL_KEY);
    if (local) return { token: local, kind: "pat", oauth: null, mode: "local" };
    const session = window.sessionStorage.getItem(SESSION_KEY);
    if (session) return { token: session, kind: "pat", oauth: null, mode: "session" };
  } catch {
    /* storage unavailable */
  }
  return { token: null, kind: null, oauth: null, mode: "local" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [kind, setKind] = useState<CredentialKind | null>(null);
  const [oauth, setOauth] = useState<OAuthMeta | null>(null);
  const [serverSession, setServerSessionState] = useState<ServerSession | null>(null);
  const [ready, setReady] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [fingerprint, setFingerprint] = useState("anon");
  const refreshing = useRef(false);

  const setServerSession = useCallback((session: ServerSession) => {
    try {
      window.localStorage.removeItem(LOCAL_KEY);
      window.localStorage.removeItem(SESSION_OBJ);
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    resetRateLimits();
    setStorageMode("local");
    setKind("oauth");
    setOauth({ refreshToken: null, expiresAt: session.expiresAt, obtainedAt: Date.now() });
    setServerSessionState(session);
    setFingerprint(session.fingerprint);
    setTokenState(null);
    setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const stored = readStoredToken();
      if (cancelled) return;
      // Intentional browser-storage hydration after SSR.
      setTokenState(stored.token);
      setKind(stored.kind);
      setOauth(stored.oauth);
      setStorageMode(stored.mode);
      setFingerprint(stored.token ? tokenFingerprint(stored.token) : "anon");
      if (stored.token) {
        setReady(true);
        return;
      }
      try {
        const response = await fetch("/api/session", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!cancelled && response.ok) {
          const data = (await response.json()) as { session?: ServerSession };
          if (data.session) {
            if (data.session.expiresAt !== null && data.session.expiresAt <= Date.now()) {
              try {
                const renewed = await refreshTokens();
                if (!cancelled) {
                  setServerSession(renewed.session);
                }
              } catch {
                /* expired session will return to the sign-in screen */
              }
            } else {
              setServerSessionState(data.session);
              setKind("oauth");
              setOauth({
                refreshToken: null,
                expiresAt: data.session.expiresAt,
                obtainedAt: Date.now(),
              });
              setFingerprint(data.session.fingerprint);
            }
          }
        }
      } catch {
        /* unauthenticated or API unavailable */
      }
      if (!cancelled) setReady(true);
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [setServerSession]);

  const setToken = useCallback((next: string, mode: StorageMode) => {
    try {
      window.localStorage.removeItem(LOCAL_KEY);
      window.localStorage.removeItem(SESSION_OBJ);
      window.sessionStorage.removeItem(SESSION_KEY);
      if (mode === "local") {
        window.localStorage.setItem(
          SESSION_OBJ,
          JSON.stringify({ token: next, kind: "pat", mode }),
        );
      } else {
        window.sessionStorage.setItem(SESSION_KEY, next);
      }
    } catch {
      /* ignore */
    }
    resetRateLimits();
    setStorageMode(mode);
    setKind("pat");
    setOauth(null);
    setServerSessionState(null);
    setFingerprint(tokenFingerprint(next));
    setTokenState(next);
  }, []);

  const clearToken = useCallback(() => {
    if (serverSession || kind === "oauth") {
      void fetch("/api/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    }
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
    setServerSessionState(null);
    setFingerprint("anon");
  }, [kind, serverSession]);

  const refreshOAuth = useCallback(async (): Promise<boolean> => {
    if (kind !== "oauth" || refreshing.current) return false;
    refreshing.current = true;
    try {
      const t = await refreshTokens();
      setServerSession(t.session);
      return true;
    } catch {
      clearToken();
      return false;
    } finally {
      refreshing.current = false;
    }
  }, [kind, setServerSession, clearToken]);

  // Proactively refresh the server session (5 min early) while the tab is open.
  useEffect(() => {
    if (kind !== "oauth" || !oauth?.expiresAt) return;
    const delay = Math.max(0, oauth.expiresAt - Date.now() - 5 * 60_000);
    const t = setTimeout(() => {
      void refreshOAuth();
    }, delay);
    return () => clearTimeout(t);
  }, [kind, oauth?.expiresAt, refreshOAuth]);

  const value = useMemo(
    () => ({ token, kind, oauth, serverSession, ready, fingerprint, storageMode, setToken, setServerSession, refreshOAuth, clearToken }),
    [token, kind, oauth, serverSession, ready, fingerprint, storageMode, setToken, setServerSession, refreshOAuth, clearToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Authenticated viewer (disabled until PAT or server session hydration completes). */
export function useViewerUser() {
  const { token, fingerprint } = useAuth();
  return useQuery({
    ...viewerOptions(token, fingerprint),
    refetchInterval: false,
  });
}
