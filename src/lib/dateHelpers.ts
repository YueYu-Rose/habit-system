export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Monday = 1 ... Sunday = 7 (ISO weekday) */
export function isoWeekday(d: Date): number {
  const w = d.getDay();
  return w === 0 ? 7 : w;
}

export function startOfIsoWeek(d: Date): Date {
  const sod = startOfDay(d);
  const wd = isoWeekday(sod);
  return addDays(sod, 1 - wd);
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** True if date d falls within the ISO week that starts on weekStartMonday */
export function isDateInWeek(d: Date, weekStartMonday: Date): boolean {
  const sod = startOfDay(d);
  const wStart = startOfDay(weekStartMonday);
  const wEnd = addDays(wStart, 6);
  return sod >= wStart && sod <= wEnd;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function formatDayHeader(d: Date): string {
  const w = WEEKDAYS_SHORT[d.getDay()];
  const mon = MONTHS[d.getMonth()];
  const day = d.getDate();
  const y = d.getFullYear();
  return `${w}, ${mon} ${day}, ${y}`;
}

/** Short label for compact selector: "Today", "Yesterday", or "Wed, Mar 21" */
export function formatDayShortLabel(d: Date): string {
  const sod = startOfDay(d);
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);
  if (isSameCalendarDay(sod, today)) return "Today";
  if (isSameCalendarDay(sod, yesterday)) return "Yesterday";
  const w = WEEKDAYS_SHORT[d.getDay()];
  const mon = MONTHS[d.getMonth()];
  const day = d.getDate();
  return `${w}, ${mon} ${day}`;
}

export function formatWeekRange(start: Date, end: Date): string {
  const sy = start.getFullYear();
  const ey = end.getFullYear();
  const sm = MONTHS[start.getMonth()];
  const em = MONTHS[end.getMonth()];
  const sd = start.getDate();
  const ed = end.getDate();
  if (sy === ey) {
    if (start.getMonth() === end.getMonth()) {
      return `${sm} ${sd} – ${ed}, ${sy}`;
    }
    return `${sm} ${sd} – ${em} ${ed}, ${sy}`;
  }
  return `${sm} ${sd}, ${sy} – ${em} ${ed}, ${ey}`;
}

export function endOfIsoWeek(start: Date): Date {
  return addDays(startOfIsoWeek(start), 6);
}

/** Sunday-first (0=Sun, 1=Mon, ...) - used by To Do List calendar */
export function getMonthMatrix(visibleMonth: Date): (Date | null)[][] {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

/** Monday-first columns: Mon, Tue, Wed, Thu, Fri, Sat, Sun */
export function getMonthMatrixMondayFirst(visibleMonth: Date): (Date | null)[][] {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const first = new Date(year, month, 1);
  const iso = isoWeekday(first);
  const startPad = iso - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}
