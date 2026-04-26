/**
 * Calendar YYYY-MM-DD for an instant in a specific IANA timezone.
 * Used for Toggl entry_date so it aligns with the user's "today" (same as browser local date).
 */

function isoLocalFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fallback when timezone is invalid: server local calendar date (legacy behavior). */
export function calendarDateFallback(isoUtc: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return "1970-01-01";
  return isoLocalFromDate(d);
}

/**
 * Calendar date of `isoUtc` in `ianaTimeZone` (e.g. "Asia/Shanghai").
 * Prefer this for Toggl `entry_date` so it matches the user's Import / To Do date.
 */
export function calendarDateInTimeZone(isoUtc: string, ianaTimeZone: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return "1970-01-01";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: ianaTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (y && m && day) return `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`;
    return calendarDateFallback(isoUtc);
  } catch {
    return calendarDateFallback(isoUtc);
  }
}

/** Timezone used when syncing Toggl: explicit client > LOCAL_DATE_TZ > Node default. */
export function resolveTogglCalendarTimeZone(clientTimeZone?: string | null): string {
  const fromEnv = process.env.LOCAL_DATE_TZ?.trim();
  if (clientTimeZone?.trim()) return clientTimeZone.trim();
  if (fromEnv) return fromEnv;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Add calendar days to a YYYY-MM-DD string (plain date math; avoids UTC/local midnight bugs for the day component).
 */
export function addDaysToIsoDate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  const dt = new Date(y, m - 1, d + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
