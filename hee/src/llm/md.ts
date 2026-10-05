// Requirement IDs: HEE-INFRA-01, HEE-INFRA-02, HEE-INFRA-03, HEE-INFRA-04
// Behaviour identical to src/pgm/plan-depth.ts exports.

/** Body of a top-level `## <heading>` section (up to the next `## `), or null when absent. */
export function topSection(body: string, heading: string): string | null {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start < 0) return null;
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s(?!#)/.test(lines[i] ?? "")) break;
    out.push(lines[i] ?? "");
  }
  return out.join("\n");
}

/** Body of a `### <heading...>` subsection inside `text` (up to the next ### or ##), or null. */
export function subSection(text: string, headingPrefix: string): string | null {
  const lines = text.split(/\r?\n/);
  const re = new RegExp(`^###\\s+${escapeRe(headingPrefix)}`, "i");
  const start = lines.findIndex((l) => re.test(l.trim()));
  if (start < 0) return null;
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{2,3}\s/.test(lines[i] ?? "")) break;
    out.push(lines[i] ?? "");
  }
  return out.join("\n");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Data rows of the first markdown table in `text` (header and separator excluded). */
export function tableRows(text: string): string[] {
  const rows = text.split(/\r?\n/).filter((l) => /^\s*\|.*\|\s*$/.test(l));
  return rows.filter((r, i) => !(i === 1 && /^\s*\|[\s:|-]+\|\s*$/.test(r))).slice(1);
}
