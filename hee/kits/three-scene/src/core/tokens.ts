// Requirement IDs: HEE-KIT-01
export interface ThreeTokens {
  background: string;               // CSS colour
  ground: string;
  accent: string;                   // selection and highlight
  text: string;
  materials: Record<string, string>; // token name → colour, e.g. { primary: "#...", secondary: "#..." }
  fog?: { color: string; near: number; far: number };
}

// Neutral greys + one neutral blue accent. Demo only: entries map their own
// brand tokens onto the --scene-* custom properties; the kit defines no brand.
export const NEUTRAL_DEMO_TOKENS: ThreeTokens = {
  background: "#23262b",
  ground: "#3a3e45",
  accent: "#6f9fd8",
  text: "#e8eaed",
  materials: {
    primary: "#9aa0a8",
    secondary: "#6b7078",
    floor: "#43474e",
  },
};

const WARNED = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (WARNED.has(key)) return;
  WARNED.add(key);
  console.warn(message);
}

function computedValue(el: Element | undefined, name: string): string {
  if (!el || typeof getComputedStyle !== "function") return "";
  try {
    return getComputedStyle(el).getPropertyValue(name).trim();
  } catch {
    return "";
  }
}

function inlineMaterialNames(el: Element | undefined): string[] {
  const out: string[] = [];
  try {
    const style = (el as unknown as { style?: CSSStyleDeclaration } | undefined)?.style;
    if (!style) return out;
    for (let i = 0; i < style.length; i++) {
      const prop = style.item(i);
      if (prop.startsWith("--scene-mat-")) out.push(prop.slice("--scene-mat-".length));
    }
  } catch {
    /* ignore */
  }
  return out;
}

export function readTokensFromCss(root?: HTMLElement): ThreeTokens {
  const el = (root as unknown as Element | undefined) ??
    (typeof document !== "undefined" ? document.documentElement : undefined);
  const pick = (name: string, fallback: string): string => {
    const v = computedValue(el, name);
    if (v) return v;
    warnOnce(name, `[three-scene] CSS property ${name} is missing; using the neutral demo value.`);
    return fallback;
  };
  const background = pick("--scene-bg", NEUTRAL_DEMO_TOKENS.background);
  const ground = pick("--scene-ground", NEUTRAL_DEMO_TOKENS.ground);
  const accent = pick("--scene-accent", NEUTRAL_DEMO_TOKENS.accent);
  const text = pick("--scene-text", NEUTRAL_DEMO_TOKENS.text);
  const names = new Set<string>([...Object.keys(NEUTRAL_DEMO_TOKENS.materials), ...inlineMaterialNames(el)]);
  const materials: Record<string, string> = {};
  for (const name of names) {
    materials[name] = pick(`--scene-mat-${name}`, NEUTRAL_DEMO_TOKENS.materials[name] ?? "#808080");
  }
  return { background, ground, accent, text, materials };
}

export function __resetTokenWarningsForTests(): void {
  WARNED.clear();
}
