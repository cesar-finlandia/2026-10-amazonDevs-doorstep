// Requirement IDs: HEE-KIT-02
// Copied from src/llm/models.ts of the chassis (DP-W00 §3.3); the parity test
// tests/hee/kit-llm-parity.test.ts compares both on the same fixture list.
export interface ModelInfo { name: string; version: number; tier: "pro" | "flash"; preview: boolean }

export function parseModelName(name: string): ModelInfo | null {
  const lower = name.toLowerCase();
  for (const banned of ["lite", "image", "tts", "live", "audio", "embedding", "thinking-exp"]) {
    if (lower.includes(banned)) return null;
  }
  const m = /^gemini-(\d+(?:\.\d+)?)-(pro|flash)(-preview(?:-[\w.]+)?)?$/.exec(name);
  if (!m) return null;
  return { name, version: Number(m[1]), tier: m[2] as "pro" | "flash", preview: Boolean(m[3]) };
}

export function pickModel(names: string[], tier: "pro" | "flash"): string | null {
  const parsed: ModelInfo[] = [];
  for (const n of names) {
    const info = parseModelName(n);
    if (info && info.tier === tier) parsed.push(info);
  }
  parsed.sort((a, b) => {
    if (b.version !== a.version) return b.version - a.version;
    if (a.preview !== b.preview) return a.preview ? 1 : -1;
    return 0;
  });
  return parsed.length > 0 ? (parsed[0] as ModelInfo).name : null;
}
