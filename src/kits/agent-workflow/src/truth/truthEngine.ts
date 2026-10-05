// Requirement IDs: HEE-KIT-02
export interface Issue {
  id: string;
  severity: "error" | "warning";
  entityIds: string[];
  message: string;                       // human sentence WITH units
  fix?: { action: string; args: Record<string, unknown> };
}

export interface Rule<M> {
  id: string;
  description: string;
  check(model: M): Issue[];
}

export function createTruthEngine<M>(rules: Rule<M>[]): {
  check(model: M): Issue[];
  counts(issues: Issue[]): { errors: number; warnings: number };
} {
  return {
    check(model: M): Issue[] {
      const out: Issue[] = [];
      const used = new Map<string, number>();
      const push = (issue: Issue): void => {
        const n = (used.get(issue.id) ?? 0) + 1;
        used.set(issue.id, n);
        out.push(n === 1 ? issue : { ...issue, id: `${issue.id}~${n}` });
      };
      for (const rule of rules) {
        let found: Issue[];
        try {
          found = rule.check(model);
        } catch (e) {
          push({
            id: `${rule.id}!crashed`,
            severity: "error",
            entityIds: [],
            message: `rule ${rule.id} crashed: ${(e as Error).message ?? String(e)}`,
          });
          continue;
        }
        for (const issue of found) push(issue);
      }
      return out;
    },
    counts(issues: Issue[]): { errors: number; warnings: number } {
      let errors = 0;
      let warnings = 0;
      for (const issue of issues) {
        if (issue.severity === "error") errors++;
        else warnings++;
      }
      return { errors, warnings };
    },
  };
}
