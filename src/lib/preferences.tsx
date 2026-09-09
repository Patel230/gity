/**
 * User preferences: theme + Live Refresh polling.
 * Live Refresh is polling, not true real-time — there are no webhooks
 * and no backend in Gity by design.
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

export type PollInterval = "off" | "15s" | "30s" | "60s" | "5m";
export type Theme = "dark" | "light";

export const POLL_MS: Record<PollInterval, number | false> = {
  off: false,
  "15s": 15_000,
  "30s": 30_000,
  "60s": 60_000,
  "5m": 300_000,
};

export const POLL_LABEL: Record<PollInterval, string> = {
  off: "Off",
  "15s": "Every 15 sec",
  "30s": "Every 30 sec",
  "60s": "Every 60 sec",
  "5m": "Every 5 min",
};

interface Prefs {
  theme: Theme;
  setTheme: (t: Theme) => void;
  poll: PollInterval;
  setPoll: (p: PollInterval) => void;
  /** TanStack refetchInterval value honoring tab visibility. */
  refreshInterval: number | false;
}

const PrefsContext = createContext<Prefs | null>(null);

function read<T extends string>(key: string, fallback: T): T {
  try {
    return (window.localStorage.getItem(key) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [poll, setPollState] = useState<PollInterval>("30s");
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    setThemeState(read("gity.theme", "dark"));
    setPollState(read("gity.poll", "30s"));
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    try {
      window.localStorage.setItem("gity.theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const setPoll = useCallback((p: PollInterval) => {
    setPollState(p);
    try {
      window.localStorage.setItem("gity.poll", p);
    } catch {
      /* ignore */
    }
  }, []);

  // While the tab is hidden, poll at most every 5 min to save rate limit.
  const refreshInterval = useMemo<number | false>(() => {
    const base = POLL_MS[poll];
    if (base === false) return false;
    if (!tabVisible) return Math.max(base, 300_000);
    return base;
  }, [poll, tabVisible]);

  const value = useMemo(
    () => ({ theme, setTheme, poll, setPoll, refreshInterval }),
    [theme, setTheme, poll, setPoll, refreshInterval],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}
