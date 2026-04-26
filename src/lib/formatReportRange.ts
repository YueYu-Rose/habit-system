import { addDays, isSameCalendarDay, startOfDay, startOfIsoWeek } from "./dateHelpers";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** US-style MM/DD/YYYY for report header range. */
export function formatUsDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

/** Short format: 11 Feb – 15 Mar 2026 or 03/16/2026 – 03/22/2026 */
/** Label for compact selector: "This Week", "Last Week", or date range */
export function formatWeekShortLabel(weekStartMonday: Date): string {
  const today = startOfDay(new Date());
  const thisWeekMon = startOfIsoWeek(today);
  if (isSameCalendarDay(startOfDay(weekStartMonday), startOfDay(thisWeekMon))) {
    return "This Week";
  }
  if (isSameCalendarDay(startOfDay(weekStartMonday), startOfDay(addDays(thisWeekMon, -7)))) {
    return "Last Week";
  }
  return formatWeekRangeReport(weekStartMonday);
}

export function formatWeekRangeReport(weekStartMonday: Date): string {
  const start = new Date(weekStartMonday);
  const end = addDays(start, 6);
  const sy = start.getFullYear();
  const ey = end.getFullYear();
  const sm = MONTHS_SHORT[start.getMonth()];
  const em = MONTHS_SHORT[end.getMonth()];
  const sd = start.getDate();
  const ed = end.getDate();
  if (sy === ey) {
    if (start.getMonth() === end.getMonth()) {
      return `${sd} – ${ed} ${em} ${sy}`;
    }
    return `${sd} ${sm} – ${ed} ${em} ${sy}`;
  }
  return `${sd} ${sm} ${sy} – ${ed} ${em} ${ey}`;
}

export function formatWeekRangeUs(weekStartMonday: Date): string {
  const start = new Date(weekStartMonday);
  const end = addDays(start, 6);
  return `${formatUsDate(start)} – ${formatUsDate(end)}`;
}

export function parseIsoDateOnly(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
