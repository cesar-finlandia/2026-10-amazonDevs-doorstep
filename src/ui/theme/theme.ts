// src/ui/theme/theme.ts — theme persistence and first-paint logic (DP-UI §3.1).
// Requirement IDs: FR-19
import { useCallback, useEffect, useState } from "react";

export type ThemeName = "light" | "dark";

export const THEME_KEY = "dr-theme";

export function initialTheme(prefersDark: boolean, stored: string | null): ThemeName {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}

export function readStoredTheme(storage?: Pick<Storage, "getItem">): string | null {
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
    if (!store) return null;
    return store.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

export function persistTheme(t: ThemeName, storage?: Pick<Storage, "setItem">): void {
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
    store?.setItem(THEME_KEY, t);
  } catch {
    /* storage blocked: the theme still applies for this load */
  }
}

export function applyTheme(t: ThemeName, root?: HTMLElement): void {
  const el = root ?? (typeof document !== "undefined" ? document.documentElement : undefined);
  if (el) el.dataset["theme"] = t;
}

export function useTheme(): { theme: ThemeName; set(t: ThemeName): void } {
  const [theme, setTheme] = useState<ThemeName>(() =>
    typeof document !== "undefined" && document.documentElement.dataset["theme"] === "dark" ? "dark" : "light",
  );
  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);
  const set = useCallback((t: ThemeName) => setTheme(t), []);
  return { theme, set };
}
