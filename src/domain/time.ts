// Requirement IDs: FR-02, FR-04
export const MIN_MS = 60_000;
export const DAY_MS = 86_400_000;

/** Minutes after local midnight (0..1439) for a UTC instant. */
export function localMinutes(tsMs: number, utcOffsetMin: number): number {
  const shifted = tsMs + utcOffsetMin * 60_000;
  const mod = ((shifted % DAY_MS) + DAY_MS) % DAY_MS;
  return Math.floor(mod / 60_000);
}

/** Whole days since the Unix epoch in local time (floor((tsMs + offset·60000) / DAY_MS)). */
export function localDayNumber(tsMs: number, utcOffsetMin: number): number {
  return Math.floor((tsMs + utcOffsetMin * 60_000) / DAY_MS);
}

/** Weekday 0 = Monday … 6 = Sunday, local. */
export function localWeekday(tsMs: number, utcOffsetMin: number): number {
  return (((localDayNumber(tsMs, utcOffsetMin) + 3) % 7) + 7) % 7;
}

/** "HH:MM" (24-hour, zero padded), local. */
export function fmtClock(tsMs: number, utcOffsetMin: number): string {
  const m = localMinutes(tsMs, utcOffsetMin);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "Tue 13 Oct", local, English short names. */
export function fmtDay(tsMs: number, utcOffsetMin: number): string {
  const shifted = new Date(tsMs + utcOffsetMin * 60_000);
  const day = SHORT_DAYS[localWeekday(tsMs, utcOffsetMin)] as string;
  const mon = SHORT_MONTHS[shifted.getUTCMonth()] as string;
  return `${day} ${shifted.getUTCDate()} ${mon}`;
}

/** "22 min" | "1 h 5 min" | "45 s": the product's duration phrase. */
export function fmtDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  let h = Math.floor(ms / 3_600_000);
  let m = Math.round((ms - h * 3_600_000) / 60_000);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** True when minute m lies in [fromMin, toMin) allowing the window to wrap midnight (fromMin > toMin). */
export function inWindow(m: number, fromMin: number, toMin: number): boolean {
  return fromMin <= toMin ? m >= fromMin && m < toMin : m >= fromMin || m < toMin;
}
