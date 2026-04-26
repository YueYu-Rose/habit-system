export type TrendDirection = "up" | "down" | "same";

/**
 * Percent change from previous to current.
 * Returns null when undefined (e.g. previous === 0 and current !== 0).
 */
export function percentChange(previous: number, current: number): number | null {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function averageDailyHours(totalWeekHours: number, daysInWeek = 7): number {
  if (daysInWeek <= 0) return 0;
  return totalWeekHours / daysInWeek;
}

/** Percentage without redundant sign (arrow indicates direction). */
export function formatPercentSigned(pct: number | null, fractionDigits = 1): string {
  if (pct === null) return "—";
  if (pct === 0) return "0%";
  return `${Math.abs(pct).toFixed(fractionDigits)}%`;
}
