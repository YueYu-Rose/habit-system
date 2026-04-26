/** Human-readable duration for table cells (neutral, no sign). */
export function formatDurationMinutes(minutes: number | null): string {
  if (minutes === null || Number.isNaN(minutes)) return "—";
  const m = Math.round(minutes);
  if (m <= 0) return "0m";
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  if (rest === 0) return `${h}h`;
  return `${h}h ${rest}m`;
}

/** Time Bill with explicit + / - prefix per spec. */
export function formatTimeBillMinutes(minutes: number | null): string {
  if (minutes === null || Number.isNaN(minutes)) return "—";
  const m = Math.round(minutes);
  if (m === 0) return "0m";
  const abs = formatDurationMinutes(Math.abs(m)).replace(/^—$/, "0m");
  return m > 0 ? `+${abs}` : `-${abs}`;
}
