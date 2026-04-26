/**
 * 计分规则（本地时区墙钟时间，默认 Asia/Shanghai）
 */

const DEFAULT_TZ = process.env.HABIT_TIMEZONE?.trim() || "Asia/Shanghai";

export function getLocalHM(iso: string, timeZone = DEFAULT_TZ): { h: number; m: number; minutes: number } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { h: 0, m: 0, minutes: 0 };
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { h, m, minutes: h * 60 + m };
}

/** 早睡：点击「开始睡觉」的本地时刻 → 分值（12:00–24:00 为当晚；0:00–12:00 为次日凌晨） */
export function scoreEarlySleep(iso: string, tz = DEFAULT_TZ): number {
  const { h, minutes } = getLocalHM(iso, tz);
  if (h >= 12) {
    if (minutes <= 22 * 60 + 30) return 15;
    if (minutes <= 23 * 60) return 10;
    if (minutes <= 23 * 60 + 30) return 5;
    return -5;
  }
  if (minutes <= 0 * 60 + 30) return -5;
  if (minutes <= 1 * 60) return -10;
  return -15;
}

/** 早起：点击「起床了」的本地时刻 */
export function scoreEarlyWake(iso: string, tz = DEFAULT_TZ): number {
  const { minutes } = getLocalHM(iso, tz);
  const t = minutes;
  if (t < 6 * 60) return 15;
  if (t < 6 * 60 + 15) return 10;
  if (t < 6 * 60 + 30) return 5;
  if (t >= 8 * 60) return -15;
  if (t >= 7 * 60 + 30) return -10;
  if (t >= 7 * 60) return -5;
  return 0;
}

/** 睡眠时长（小时）→ 分值 */
export function scoreSleepDuration(hours: number): number {
  if (hours >= 7.5) return 10;
  if (hours >= 7) return 5;
  if (hours >= 6) return 0;
  return -5;
}

/** 11 点前洗澡 */
export function scoreShower(iso: string, tz = DEFAULT_TZ): number {
  const { minutes } = getLocalHM(iso, tz);
  if (minutes <= 11 * 60) return 5;
  return -5;
}

/** 运动（可选加分） */
export function scoreExercise(minutes: number): number {
  if (minutes >= 20 && minutes <= 30) return 10;
  if (minutes >= 10) return 5;
  return 0;
}

/** 外部 To-do 完成率 → 分（完成率 0–1） */
export function scoreExternalTodoRate(rate: number): number {
  if (rate >= 0.8) return 15;
  if (rate >= 0.6) return 10;
  if (rate >= 0.4) return 0;
  return -10;
}
