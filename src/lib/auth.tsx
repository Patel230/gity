/**
 * Token storage — browser-local only.
 * SECURITY: a frontend-only app cannot keep a secret. Anyone (or any
 * script) with access to this browser profile can read storage.
 * Gity is therefore a personal dashboard, not a multi-user service.
 *
 * Sign-in is via Personal Access Token. One-click OAuth/device login is
 * deliberately NOT offered: GitHub's login endpoints
 * (github.com/login/...) send no CORS headers, so no pure-browser app can
 * complete those flows — only api.github.com is browser-callable.
 */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeyBase, viewerOptions } from "./github/queries";
import { resetRateLimits } from "./github/rate-limit";

const LOCAL_KEY = "gity.token";
const SESSION_KEY = "gity.token.session";
const SESSION_OBJ = "gity.session";

export type StorageMode = "local" | "session";

interface AuthState {
  token: string | null;
  fingerprint: string;
  storageMode: StorageMode;
  setToken: (token: string, mode: StorageMode) => void;
  clearToken: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function readStoredToken(): { token: string | null; mode: StorageMode } {
  if (typeof window === "undefined") return { token: null, mode: "local" };
  try {
    const obj = window.localStorage.getItem(SESSION_OBJ);
    if (obj) {
      const s = JSON.parse(obj) as { token?: string; mode?: StorageMode };
      if (s.token) return { token: s.token, mode: s.mode ?? "local" };
    }
    const local = window.localStorage.getItem(LOCAL_KEY);
    if (local) return { token: local, mode: "local" };
    const session = window.sessionStorage.getItem(SESSION_KEY);
    if (session) return { token: session, mode: "session" };
  } catch {
    /* storage unavailable */
  }
  return { token: null, mode: "local" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [fingerprint, setFingerprint] = useState("anon");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredToken();
    setTokenState(stored.token);
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
    setTokenState(next);
  }, []);

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
  }, []);

  const value = useMemo(
    () => ({ token, fingerprint, storageMode, setToken, clearToken }),
    [token, fingerprint, storageMode, setToken, clearToken],
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
