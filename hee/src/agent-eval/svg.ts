// Requirement IDs: HEE-EVAL-01, HEE-EVAL-02, HEE-EVAL-03
// DP-W08 §3.7 deterministic trajectory chart.
export interface TrajectoryPoint {
  n: number;
  rate: number;
  kept: boolean;
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function renderTrajectorySvg(points: TrajectoryPoint[], controlRate: number | null): string {
  const yOf = (v: number): number => 270 - (v / 100) * 250;
  const xOf = (i: number): number => 60 + (points.length === 1 ? 280 : (i / (points.length - 1)) * 560);
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320" width="640" height="320" role="img" aria-label="Task success per iteration">`,
  );
  out.push(`<rect width="640" height="320" fill="#ffffff"/>`);
  for (const v of [0, 25, 50, 75, 100]) {
    const y = yOf(v);
    out.push(`<line x1="60" y1="${fmt(y)}" x2="620" y2="${fmt(y)}" stroke="#e5e7eb"/>`);
    out.push(`<text x="52" y="${fmt(y + 4)}" text-anchor="end" font-size="12" fill="#6b7280">${fmt(v)}</text>`);
  }
  if (controlRate !== null) {
    const cy = yOf(controlRate);
    out.push(
      `<line x1="60" y1="${fmt(cy)}" x2="620" y2="${fmt(cy)}" stroke="#dc2626" stroke-dasharray="6 4"/>`,
    );
    out.push(
      `<text x="618" y="${fmt(cy - 6)}" text-anchor="end" font-size="12" fill="#dc2626">without the surface ${fmt(controlRate)}%</text>`,
    );
  }
  if (points.length > 0) {
    const line = points.map((p, i) => `${fmt(xOf(i))},${fmt(yOf(p.rate))}`).join(" ");
    out.push(`<polyline fill="none" stroke="#2563eb" stroke-width="2" points="${line}"/>`);
    points.forEach((p, i) => {
      const x = xOf(i);
      const y = yOf(p.rate);
      if (p.kept) {
        out.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="5" fill="#2563eb"/>`);
      } else {
        out.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="5" fill="#ffffff" stroke="#2563eb" stroke-width="2"/>`);
      }
      out.push(`<text x="${fmt(x)}" y="300" text-anchor="middle" font-size="12" fill="#374151">${p.n}</text>`);
    });
  }
  out.push(`<text x="340" y="316" text-anchor="middle" font-size="12" fill="#374151">iteration</text>`);
  out.push(
    `<text x="14" y="145" text-anchor="middle" font-size="12" fill="#374151" transform="rotate(-90 14 145)">success %</text>`,
  );
  out.push(`</svg>`);
  return out.join("\n") + "\n";
}
