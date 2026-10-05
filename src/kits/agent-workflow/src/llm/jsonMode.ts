// Requirement IDs: HEE-KIT-02
export const RETRY_PROMPT_TEMPLATE =
  "Your previous reply did not pass validation. Errors: {{errors}}\n" +
  "Return ONLY the corrected JSON document that satisfies the schema. No prose, no code fence, no commentary. Keep every value that was already correct.";

export function retryPrompt(errors: string[]): string {
  return RETRY_PROMPT_TEMPLATE.replace("{{errors}}", errors.join("; "));
}

export function stripFence(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) {
    const lines = t.split("\n");
    lines.shift();
    if (lines.length > 0 && lines[lines.length - 1]?.trim() === "```") lines.pop();
    else if (lines.length > 0 && lines[lines.length - 1]?.trim().endsWith("```")) {
      lines[lines.length - 1] = (lines[lines.length - 1] as string).replace(/```\s*$/, "");
    }
    let joined = lines.join("\n").trim();
    if (joined.startsWith("json\n") || joined.startsWith("json\r")) joined = joined.slice(4).trim();
    else if (joined.startsWith("json ")) joined = joined.slice(4).trim();
    return joined;
  }
  return t;
}

export function parseJsonLoose(text: string): { data?: unknown; errors: string[] } {
  try {
    return { data: JSON.parse(stripFence(text)) as unknown, errors: [] };
  } catch (e) {
    return { errors: [(e as Error).message ?? String(e)] };
  }
}
