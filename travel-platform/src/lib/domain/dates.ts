/** Date helpers. All calendar math is done on ISO dates in UTC to avoid host-time-zone bugs. */

export function parseIso(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = parseIso(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const pa = parseIso(a);
  const pb = parseIso(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

export function isValidIsoDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const { y, m, d } = parseIso(date);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Offset (minutes) of an IANA zone from UTC at a given instant. */
export function tzOffsetMinutes(utcMs: number, tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of fmt.formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - utcMs) / 60_000);
}

/** Convert a wall-clock time in a zone to a UTC instant (handles DST). */
export function zonedToUtc(date: string, time: string, tz: string): number {
  const { y, m, d } = parseIso(date);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMinutes(guess, tz);
  let utc = guess - off1 * 60_000;
  const off2 = tzOffsetMinutes(utc, tz);
  if (off2 !== off1) utc = guess - off2 * 60_000;
  return utc;
}

/** UTC instant → local "YYYY-MM-DDTHH:MM" in a zone. */
export function utcToLocal(utcMs: number, tz: string): string {
  const off = tzOffsetMinutes(utcMs, tz);
  return new Date(utcMs + off * 60_000).toISOString().slice(0, 16);
}

export function localDate(local: string): string {
  return local.slice(0, 10);
}

export function localTime(local: string): string {
  return local.slice(11, 16);
}

export function minutesToHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${m.toString().padStart(2, "0")} min` : `${m} min`;
}

export function todayIso(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}
