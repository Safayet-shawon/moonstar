/** YYYY-MM-DD in the given IANA timezone (company default Asia/Dhaka). */
export function todayIn(tz: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}

export function fmtDate(d: string | Date | null | undefined, tz = "Asia/Dhaka"): string {
  if (!d) return "—";
  const dt = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00Z`) : new Date(d);
  return new Intl.DateTimeFormat("en-GB", { timeZone: typeof d === "string" && d.length === 10 ? "UTC" : tz, day: "2-digit", month: "short", year: "numeric" }).format(dt);
}

export function fmtDateTime(d: string | Date | null | undefined, tz = "Asia/Dhaka"): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}
