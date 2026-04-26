export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** 含 date 所在周的周一 */
export function mondayOfWeekContaining(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = dt.getDay();
  const delta = wd === 0 ? -6 : 1 - wd;
  const s = new Date(y, m - 1, d + delta);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
}

export function sundayOfWeekContaining(dateStr: string): string {
  return addDaysIso(mondayOfWeekContaining(dateStr), 6);
}
