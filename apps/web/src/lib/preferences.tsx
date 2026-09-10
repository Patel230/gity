/**
 * User preferences: named dark theme + Live Refresh polling.
 * Live Refresh is polling, not true real-time — there are no webhooks.
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
export type Appearance = "dark" | "light";

type ThemeVars = { background: string; card: string; foreground: string; primary: string; border: string; accent: string; mutedForeground: string };
const makeTheme = (label: string, vars: Partial<ThemeVars>) => ({
  label,
  vars: { background: "#181926", card: "#24273a", foreground: "#cad3f5", primary: "#dbc66f", border: "#5a5130", accent: "#3a3416", mutedForeground: "#a5adcb", ...vars },
});

export const THEMES = {
  "default-dark": makeTheme("Default Dark", { background: "#11121d", card: "#171827", foreground: "#cad3f5", primary: "#dbc66f", border: "#3b3d5a", accent: "#282844", mutedForeground: "#9699b5" }),
  "default-light": makeTheme("Default Light", { background: "#f5f1e8", card: "#fffaf0", foreground: "#30281d", primary: "#9a6718", border: "#cdbd9f", accent: "#eadfca", mutedForeground: "#756650" }),
  "warm-copper": makeTheme("Warm Copper", { background: "#100b08", card: "#1c1210", foreground: "#f5e5d4", primary: "#e08b57", border: "#694737", accent: "#50301f", mutedForeground: "#c19a82" }),
  "aurora-circuit": makeTheme("Aurora Circuit", { background: "#071217", card: "#0e2026", foreground: "#d9f7f4", primary: "#62d6c6", border: "#28535a", accent: "#153d43", mutedForeground: "#8bb9bb" }),
  "cinder-bloom": makeTheme("Cinder Bloom", { background: "#1d1017", card: "#2d1723", foreground: "#f9dce8", primary: "#f28bb5", border: "#75405a", accent: "#54283f", mutedForeground: "#c28da5" }),
  "violet-static": makeTheme("Violet Static", { background: "#141128", card: "#201a3b", foreground: "#f0ecfa", primary: "#c4a7ff", border: "#584985", accent: "#34295c", mutedForeground: "#aaa0cd" }),
  "pine-signal": makeTheme("Pine Signal", { background: "#081713", card: "#10251d", foreground: "#e2f3dc", primary: "#a8d66c", border: "#376044", accent: "#1d422c", mutedForeground: "#97b99b" }),
  "paper-cobalt": makeTheme("Paper Cobalt", { background: "#111827", card: "#1e293b", foreground: "#e0f2fe", primary: "#60a5fa", border: "#3b82f6", accent: "#172554", mutedForeground: "#93c5fd" }),
  "solar-ash": makeTheme("Solar Ash", { background: "#191610", card: "#292218", foreground: "#fae9c3", primary: "#fbbf24", border: "#705b2a", accent: "#493817", mutedForeground: "#c8aa68" }),
  "neon-orchard": makeTheme("Neon Orchard", { background: "#0b1710", card: "#13271b", foreground: "#ddfbe5", primary: "#52e38c", border: "#287047", accent: "#123c28", mutedForeground: "#8fc9a4" }),
  "desert-paper": makeTheme("Desert Paper", { background: "#241b15", card: "#35271d", foreground: "#f5e5cf", primary: "#e7a86b", border: "#77533d", accent: "#503522", mutedForeground: "#c5a58c" }),
  "edge-dark": makeTheme("Edge Dark", { background: "#0c0d11", card: "#17191f", foreground: "#e5e7eb", primary: "#a3e635", border: "#374151", accent: "#26351d", mutedForeground: "#9ca3af" }),
  "read-roomy": makeTheme("Read Roomy", { background: "#151719", card: "#202327", foreground: "#f1f5f9", primary: "#f59e0b", border: "#475569", accent: "#3b2b12", mutedForeground: "#94a3b8" }),
  "anakmagang-dark": makeTheme("Anakmagang Dark", { background: "#17131d", card: "#241b2d", foreground: "#f5eafa", primary: "#e879f9", border: "#633b75", accent: "#472052", mutedForeground: "#c4a4d1" }),
  "reedge-dark": makeTheme("Reedge Dark", { background: "#0c1517", card: "#132225", foreground: "#d9fbf5", primary: "#2dd4bf", border: "#2f5c5b", accent: "#123b3b", mutedForeground: "#8bbdb8" }),
  "quattro-rally": makeTheme("quattro rally", { background: "#151617", card: "#222426", foreground: "#f5f5f4", primary: "#facc15", border: "#55585c", accent: "#44380d", mutedForeground: "#a8aaad" }),
  noir: makeTheme("noir", { background: "#08090b", card: "#111316", foreground: "#e6e7e9", primary: "#f0f0f0", border: "#3b3d42", accent: "#25272b", mutedForeground: "#9b9da3" }),
  ocean: makeTheme("ocean", { background: "#071923", card: "#0d2938", foreground: "#d8f3ff", primary: "#38bdf8", border: "#24536b", accent: "#123e55", mutedForeground: "#8eb8ca" }),
  dracula: makeTheme("dracula", { background: "#171521", card: "#28243a", foreground: "#f8f8f2", primary: "#bd93f9", border: "#5b4d7a", accent: "#42345b", mutedForeground: "#b9b3ca" }),
  nord: makeTheme("nord", { background: "#242933", card: "#2e3440", foreground: "#eceff4", primary: "#88c0d0", border: "#4c566a", accent: "#3b4859", mutedForeground: "#a5b1c2" }),
  "tokyo-night": makeTheme("tokyo night", { background: "#10131f", card: "#1a1b2b", foreground: "#c0caf5", primary: "#7aa2f7", border: "#3b4261", accent: "#283457", mutedForeground: "#7982a9" }),
  sky: makeTheme("sky", { background: "#0c1824", card: "#12273a", foreground: "#e0f2fe", primary: "#7dd3fc", border: "#315776", accent: "#164e63", mutedForeground: "#8fb4cb" }),
  "catppuccin-mocha": makeTheme("catppuccin mocha", { background: "#11111b", card: "#1e1e2e", foreground: "#cdd6f4", primary: "#cba6f7", border: "#45475a", accent: "#313244", mutedForeground: "#a6adc8" }),
  "catppuccin-macchiato": makeTheme("catppuccin macchiato", { background: "#181926", card: "#24273a", foreground: "#cad3f5", primary: "#c6a0f6", border: "#494d64", accent: "#363a4f", mutedForeground: "#a5adcb" }),
  "catppuccin-frappe": makeTheme("catppuccin frappe", { background: "#232634", card: "#303446", foreground: "#c6d0f5", primary: "#ca9ee6", border: "#51576d", accent: "#414559", mutedForeground: "#a5adce" }),
  "rose-pine": makeTheme("rosé pine", { background: "#191724", card: "#26233a", foreground: "#e0def4", primary: "#ebbcba", border: "#524b6b", accent: "#403852", mutedForeground: "#908caa" }),
  "rose-pine-moon": makeTheme("rosé pine moon", { background: "#232136", card: "#2a273f", foreground: "#e0def4", primary: "#f6c177", border: "#56506e", accent: "#443f5a", mutedForeground: "#908caa" }),
  gruvbox: makeTheme("gruvbox", { background: "#1d2021", card: "#282828", foreground: "#ebdbb2", primary: "#fabd2f", border: "#665c54", accent: "#504945", mutedForeground: "#bdae93" }),
  sunset: makeTheme("sunset", { background: "#211524", card: "#342039", foreground: "#ffe4e6", primary: "#fb7185", border: "#70415e", accent: "#52253f", mutedForeground: "#d09aae" }),
  homebrew: makeTheme("homebrew", { background: "#101510", card: "#182218", foreground: "#d1fae5", primary: "#86efac", border: "#3f6349", accent: "#1f482c", mutedForeground: "#8fba9b" }),
  grass: makeTheme("grass", { background: "#0d180e", card: "#172719", foreground: "#dcfce7", primary: "#4ade80", border: "#38643f", accent: "#1c4927", mutedForeground: "#8fbc96" }),
  baitong: makeTheme("baitong", { background: "#141715", card: "#222822", foreground: "#e7f1dd", primary: "#b8d66b", border: "#53644c", accent: "#33452c", mutedForeground: "#a3b69a" }),
  redsands: makeTheme("redsands", { background: "#1b0e0c", card: "#2c1714", foreground: "#ffe4d6", primary: "#fb8068", border: "#754137", accent: "#54251e", mutedForeground: "#cb9687" }),
  "catppuccin-latte": makeTheme("catppuccin latte", { background: "#eff1f5", card: "#e6e9ef", foreground: "#4c4f69", primary: "#8839ef", border: "#bcc0cc", accent: "#dce0e8", mutedForeground: "#6c6f85" }),
  "rose-pine-dawn": makeTheme("rosé pine dawn", { background: "#faf4ed", card: "#fffaf3", foreground: "#575279", primary: "#907aa9", border: "#cecacd", accent: "#f2e9df", mutedForeground: "#797593" }),
  papercolor: makeTheme("papercolor", { background: "#eee8d5", card: "#fdf6e3", foreground: "#586e75", primary: "#268bd2", border: "#c8c1a5", accent: "#e5dfc8", mutedForeground: "#839496" }),
  paper: makeTheme("paper", { background: "#f5f5f0", card: "#ffffff", foreground: "#303030", primary: "#365f91", border: "#c9c9c2", accent: "#e6e6df", mutedForeground: "#66665f" }),
  "gruvbox-light": makeTheme("gruvbox light", { background: "#fbf1c7", card: "#f2e5bc", foreground: "#3c3836", primary: "#af3a03", border: "#bdae93", accent: "#ebdbb2", mutedForeground: "#7c6f64" }),
  mono: makeTheme("mono", { background: "#111111", card: "#1d1d1d", foreground: "#eeeeee", primary: "#ffffff", border: "#555555", accent: "#333333", mutedForeground: "#aaaaaa" }),
  everforest: makeTheme("Everforest", { background: "#2d353b", card: "#343f44", foreground: "#d3c6aa", primary: "#a7c080", border: "#4f585e", accent: "#475258", mutedForeground: "#9da9a0" }),
  kanagawa: makeTheme("Kanagawa", { background: "#1f1f28", card: "#2a2a37", foreground: "#dcd7ba", primary: "#7e9cd8", border: "#54546d", accent: "#363646", mutedForeground: "#9898a7" }),
  "one-dark": makeTheme("One Dark", { background: "#282c34", card: "#21252b", foreground: "#abb2bf", primary: "#61afef", border: "#4b5263", accent: "#333842", mutedForeground: "#7f848e" }),
  solarized: makeTheme("Solarized", { background: "#002b36", card: "#073642", foreground: "#839496", primary: "#2aa198", border: "#586e75", accent: "#164b55", mutedForeground: "#657b83" }),
  monokai: makeTheme("Monokai", { background: "#272822", card: "#303129", foreground: "#f8f8f2", primary: "#a6e22e", border: "#57584e", accent: "#414239", mutedForeground: "#a6a69c" }),
  "github-dark": makeTheme("GitHub Dark", { background: "#0d1117", card: "#161b22", foreground: "#e6edf3", primary: "#2f81f7", border: "#30363d", accent: "#21262d", mutedForeground: "#8b949e" }),
  "github-light": makeTheme("GitHub Light", { background: "#ffffff", card: "#f6f8fa", foreground: "#1f2328", primary: "#0969da", border: "#d0d7de", accent: "#eaeef2", mutedForeground: "#656d76" }),
  "ayu-mirage": makeTheme("Ayu Mirage", { background: "#1f2430", card: "#242936", foreground: "#cbccc6", primary: "#ffcc66", border: "#4d5566", accent: "#333a4a", mutedForeground: "#8a919e" }),
  "material-ocean": makeTheme("Material Ocean", { background: "#0f111a", card: "#1a1e2e", foreground: "#a6accd", primary: "#82aaff", border: "#3b4158", accent: "#252a3a", mutedForeground: "#717cb4" }),
  horizon: makeTheme("Horizon", { background: "#1c1e26", card: "#232530", foreground: "#d5d8da", primary: "#e95678", border: "#4a4d5a", accent: "#343642", mutedForeground: "#a2a4ab" }),
} as const;

export type Theme = keyof typeof THEMES;

/** Curated OSS palette set exposed in Settings. */
export const FEATURED_THEMES = [
  "default-dark", "default-light",
  "catppuccin-macchiato", "catppuccin-mocha", "catppuccin-frappe", "catppuccin-latte",
  "dracula", "nord", "tokyo-night", "gruvbox", "rose-pine", "rose-pine-moon",
  "rose-pine-dawn", "everforest", "kanagawa", "one-dark", "solarized", "monokai",
  "github-dark", "github-light", "ayu-mirage", "material-ocean",
] as const satisfies readonly Theme[];

const LIGHT_VARS = {
  background: "#f5f1e8", card: "#fffaf0", foreground: "#30281d", primary: "#9a6718",
  border: "#cdbd9f", accent: "#eadfca", mutedForeground: "#756650",
};

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
  appearance: Appearance;
  setAppearance: (a: Appearance) => void;
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
  const [theme, setThemeState] = useState<Theme>("catppuccin-macchiato");
  const [appearance, setAppearanceState] = useState<Appearance>("dark");
  const [poll, setPollState] = useState<PollInterval>("30s");
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const storedTheme = read("gity.theme", "catppuccin-macchiato");
    // Intentional browser-storage hydration after SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(storedTheme in THEMES ? storedTheme as Theme : "catppuccin-macchiato");
    const storedAppearance = read("gity.appearance", "dark") as Appearance;
    setAppearanceState(storedAppearance === "light" ? "light" : "dark");
    setPollState(read("gity.poll", "30s"));
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const vars = appearance === "light" ? LIGHT_VARS : THEMES[theme].vars;
    const cssVars: Record<string, string> = {
      background: vars.background, card: vars.card, "card-foreground": vars.foreground,
      foreground: vars.foreground, primary: vars.primary, "primary-foreground": vars.background,
      border: vars.border, input: vars.border, ring: vars.primary, accent: vars.accent,
      "muted-foreground": vars.mutedForeground,
    };
    try {
      for (const [key, value] of Object.entries(cssVars)) document.documentElement.style.setProperty(`--${key}`, value);
      document.documentElement.classList.toggle("light", appearance === "light");
      document.documentElement.classList.toggle("dark", appearance === "dark");
      window.localStorage.setItem("gity.theme", theme);
      window.localStorage.setItem("gity.appearance", appearance);
    } catch {
      /* ignore */
    }
  }, [theme, appearance]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const setAppearance = useCallback((a: Appearance) => setAppearanceState(a), []);
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
    () => ({ theme, setTheme, appearance, setAppearance, poll, setPoll, refreshInterval }),
    [theme, setTheme, appearance, setAppearance, poll, setPoll, refreshInterval],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}
