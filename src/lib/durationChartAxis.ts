/**
 * Y-axis max for Duration By Day: ceil(max daily hours) + 0.5h, minimum 1h.
 */
export function durationYAxisMax(dailyHours: number[]): number {
  const maxDay = dailyHours.length > 0 ? Math.max(...dailyHours) : 0;
  const computed = Math.ceil(maxDay) + 0.5;
  return Math.max(computed, 1);
}

/** Bar-top label: decimal hours → h:mm:ss (e.g. 7.699h → 7:41:57). */
export function formatHoursAsHms(hours: number): string {
  const totalSec = Math.max(0, Math.round(hours * 3600));
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
