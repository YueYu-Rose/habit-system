export function todayIsoLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatCnDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

/** 按语言展示日期（打卡页顶栏等） */
export function formatLocaleDate(iso: string, lang: "zh" | "en"): string {
  if (lang === "zh") return formatCnDate(iso);
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
}

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * 本地「日历日 + HH:mm」→ ISO，用于习惯打卡时间（可补录某日某时刻）
 */
export function toLocalIsoFromYmdAndHm(ymd: string, hm: string): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const parts = (hm || "12:00").split(":");
  const hh = parseInt(parts[0] ?? "0", 10);
  const mm = parseInt(parts[1] ?? "0", 10);
  if (!y || !m || !d) return new Date().toISOString();
  const dt = new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
  return dt.toISOString();
}

export function nowLocalTimeHM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
