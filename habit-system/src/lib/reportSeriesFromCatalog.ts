import { addDays, todayIsoLocal } from "./dateLocal";
import {
  getCustomDoneForDate,
  getWeekdayForIsoDate,
  isHabitDueOnWeekday,
  type HabitCatalogState,
} from "./habitListStorage";

type Lang = "zh" | "en";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatMMDD(d: Date) {
  return `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

function weekLabelFor(d: Date, lang: Lang) {
  if (lang === "zh") {
    const map = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return map[d.getDay()] ?? "";
  }
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

/** 将「当天时刻」映到扩展分钟轴：凌晨时段视为次日延续（与复盘页 Y 轴一致） */
function toExtendedMinutesFromClockMins(min: number): number {
  return min < 12 * 60 ? min + 24 * 60 : min;
}

function isoToExtendedMinutes(iso: string): number | null {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  const min = dt.getHours() * 60 + dt.getMinutes();
  return toExtendedMinutesFromClockMins(min);
}

/**
 * 一日净积分：当日应打卡的项中，完成加 completePoints，未完成且带 penalty 则扣 penalty
 */
function netPointsForDate(state: HabitCatalogState, date: string): number {
  const w = getWeekdayForIsoDate(date);
  let net = 0;
  for (const def of state.items) {
    if (!isHabitDueOnWeekday(def, w)) continue;
    const done = getCustomDoneForDate(state, date, def.id);
    if (done) net += def.completePoints;
    else if (def.penalty > 0) net -= def.penalty;
  }
  return net;
}

function hasCustomActivityOnDate(state: HabitCatalogState, date: string): boolean {
  const day = state.customDone[date];
  if (!day) return false;
  return Object.values(day).some(Boolean);
}

/**
 * 以「起床日」为横轴日 d：用前一日入睡 d-1 与当日起床 d 的 dayTimes 计算主睡眠段（与旧版 SQLite 服务逻辑一致）
 */
function sleepWakeForWakeDay(
  state: HabitCatalogState,
  d: string
): { sleepExt: number; wakeExt: number; range: [number, number] } | null {
  const prev = addDays(d, -1);
  const sIso = state.dayTimes?.[prev]?.sleepIso;
  const wIso = state.dayTimes?.[d]?.wakeIso;
  if (sIso && wIso) {
    const s = isoToExtendedMinutes(sIso);
    const w = isoToExtendedMinutes(wIso);
    if (s == null || w == null) return null;
    return { sleepExt: s, wakeExt: w, range: [Math.min(s, w), Math.max(s, w)] as [number, number] };
  }
  /* 同日补记：只适用于同一天内既有睡又有起 */
  const s0 = state.dayTimes?.[d]?.sleepIso;
  const w0 = state.dayTimes?.[d]?.wakeIso;
  if (s0 && w0) {
    const s = isoToExtendedMinutes(s0);
    const w = isoToExtendedMinutes(w0);
    if (s == null || w == null) return null;
    return { sleepExt: s, wakeExt: w, range: [Math.min(s, w), Math.max(s, w)] as [number, number] };
  }
  return null;
}

export type ReportSleepPoint = {
  key: string;
  dateLabel: string;
  weekLabel: string;
  sleepExt: number | null;
  wakeExt: number | null;
  range: [number, number] | null;
  /** 实际主睡眠小时数，仅用于 tooltip，可为 null */
  sleepHours: number | null;
};

export type ReportPointsPoint = {
  key: string;
  dateLabel: string;
  weekLabel: string;
  net: number;
};

export type ReportSeries7D = {
  sleepSeries: ReportSleepPoint[];
  pointsSeries: ReportPointsPoint[];
  /** 近 7 天是否有任一日存在打卡 */
  hasAnyActivity: boolean;
  /** 近 7 天是否至少有一晚可算出入睡/起床（用于睡图表是否有线） */
  hasAnySleepSegment: boolean;
};

export function buildReportSeries7Days(state: HabitCatalogState, lang: Lang): ReportSeries7D {
  const end = todayIsoLocal();
  const days: { iso: string; date: Date }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const iso = addDays(end, -i);
    const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
    days.push({ iso, date: new Date(y, m - 1, d) });
  }

  /** 仅统计「真实打卡」customDone，不把「未打卡导致的罚分」当成有数据，否则会出现全 -20 平直假线 */
  let hasAnyActivity = false;
  for (const { iso } of days) {
    if (hasCustomActivityOnDate(state, iso)) {
      hasAnyActivity = true;
      break;
    }
  }

  const pointsSeries: ReportPointsPoint[] = days.map(({ iso, date }) => ({
    key: iso,
    dateLabel: formatMMDD(date),
    weekLabel: weekLabelFor(date, lang),
    net: netPointsForDate(state, iso),
  }));

  const sleepSeries: ReportSleepPoint[] = days.map(({ iso, date }) => {
    const sw = sleepWakeForWakeDay(state, iso);
    if (sw) {
      const diffMin = sw.wakeExt - sw.sleepExt;
      const hours = Number.isFinite(diffMin) ? Math.max(0, diffMin) / 60 : null;
      return {
        key: iso,
        dateLabel: formatMMDD(date),
        weekLabel: weekLabelFor(date, lang),
        sleepExt: sw.sleepExt,
        wakeExt: sw.wakeExt,
        range: sw.range,
        sleepHours: hours,
      };
    }
    return {
      key: iso,
      dateLabel: formatMMDD(date),
      weekLabel: weekLabelFor(date, lang),
      sleepExt: null,
      wakeExt: null,
      range: null,
      sleepHours: null,
    };
  });

  const hasAnySleepSegment = sleepSeries.some((p) => p.sleepExt != null && p.wakeExt != null);

  return { sleepSeries, pointsSeries, hasAnyActivity, hasAnySleepSegment };
}
