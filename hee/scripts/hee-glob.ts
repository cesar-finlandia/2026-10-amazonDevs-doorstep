// Requirement IDs: HEE-INFRA-01, HEE-INFRA-02, HEE-INFRA-03, HEE-INFRA-04
export function globToRegExp(glob: string): RegExp {
  const normalized = glob.replace(/\\/g, "/");
  let re = "^";
  let i = 0;
  while (i < normalized.length) {
    const c = normalized[i];
    if (c === "*") {
      if (normalized[i + 1] === "*") {
        if (normalized[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 3;
        } else {
          re += ".*";
          i += 2;
        }
      } else {
        re += "[^/]*";
        i += 1;
      }
    } else if (c === "?") {
      re += "[^/]";
      i += 1;
    } else {
      re += escapeRegExpChar(c as string);
      i += 1;
    }
  }
  re += "$";
  return new RegExp(re);
}

function escapeRegExpChar(c: string): string {
  return /[.+^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
}
