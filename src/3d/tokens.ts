// src/3d/tokens.ts — DP-UI's palette as the scene's materials (DP-3D §5.6).
// Maps the flat record of src/ui/tokens/tokens.ts (keys without "--") onto the
// kit's palette. A missing key falls back to the record's `accent` and warns
// once. No hex literal appears in this file or anywhere else under src/3d/.
// Requirement IDs: FR-19, FR-20
import { useEffect, useState } from "react";
import type { ThreeTokens } from "src/kits/three-scene/src/react/index.js";
import { MATERIAL_TOKENS } from "src/3d/adapter.js";

const warnedKeys = new Set<string>();

function warnOnce(key: string): void {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(`[3d] scene token "${key}" is missing; using accent.`);
}

/** Test hook: forget warned keys so the warn-once behaviour can be re-observed. */
export function __resetTokenWarningsForTests(): void {
  warnedKeys.clear();
}

export function tokensFromRecord(record: Record<string, string>): ThreeTokens {
  const fallback = record["accent"] ?? "";
  const materials: Record<string, string> = {};
  for (const name of MATERIAL_TOKENS) {
    const key = `scene-mat-${name}`;
    const value = record[key];
    if (value === undefined) {
      warnOnce(key);
      materials[name] = fallback;
    } else {
      materials[name] = value;
    }
  }
  return {
    background: record["scene-bg"] ?? fallback,
    ground: record["scene-ground"] ?? fallback,
    accent: record["scene-accent"] ?? fallback,
    text: record["scene-text"] ?? fallback,
    materials,
  };
}

/** The scene's custom properties read off the document root. Reads exactly the
 *  fifteen keys this scene uses and never warns: the kit's readTokensFromCss
 *  additionally probes its demo-only neutral keys (primary/secondary/floor),
 *  whose missing-key warnings would violate the zero-warnings contract, so
 *  this plan reads the same computed values directly. A missing key falls back
 *  to the record's `accent`, mirroring tokensFromRecord. */
export function readSceneTokens(root?: HTMLElement): ThreeTokens {
  const el: Element | undefined = root ?? (typeof document !== "undefined" ? document.documentElement : undefined);
  const get = (name: string): string => {
    try {
      if (!el || typeof getComputedStyle !== "function") return "";
      return getComputedStyle(el).getPropertyValue(name).trim();
    } catch {
      return "";
    }
  };
  const accent = get("--scene-accent") || get("--accent");
  const pick = (name: string): string => get(name) || accent;
  const materials: Record<string, string> = {};
  for (const name of MATERIAL_TOKENS) materials[name] = pick(`--scene-mat-${name}`);
  return {
    background: pick("--scene-bg"),
    ground: pick("--scene-ground"),
    accent,
    text: pick("--scene-text"),
    materials,
  };
}

/** Re-reads when <html data-theme> changes (MutationObserver). */
export function useSceneTokens(): ThreeTokens {
  const [tokens, setTokens] = useState<ThreeTokens>(() => readSceneTokens());
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setTokens(readSceneTokens());
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return tokens;
}
