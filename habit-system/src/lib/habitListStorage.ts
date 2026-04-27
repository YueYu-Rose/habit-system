import { todayIsoLocal } from "./dateLocal";
import { readPromotionUiLang } from "./promotionUiLang";

export const HABIT_CATALOG_STORAGE_KEY = "habit_checkin_catalog_v1";
const KEY = HABIT_CATALOG_STORAGE_KEY;

function isPromotionBuild(): boolean {
  return String(import.meta.env.VITE_APP_MODE ?? "PERSONAL").toUpperCase() === "PROMOTION";
}

export type HabitSystemKey = "sleep" | "wake" | "shower" | "english" | "cantonese" | "exercise";

/** 出现频次：每天 或 指定星期（0=周日 … 6=周六，与 Date#getDay 一致） */
export type HabitSchedule =
  | { type: "daily" }
  | { type: "weekdays"; days: number[] };

/** 与 Supabase 设计对齐：boolean=对勾打卡，time=记录具体时刻并可设目标时间 */
export type HabitTargetType = "boolean" | "time";

export type HabitDef = {
  id: string;
  name: string;
  completePoints: number;
  penalty: number;
  /** MVP 连胜：仅按点击增减，不做跨天断签计算 */
  streak: number;
  systemKey?: HabitSystemKey;
  /** 无则视为每天（向后兼容） */
  schedule?: HabitSchedule;
  /** 无或 boolean：仅对勾；time：打卡时记录时刻（存于 recordedTimes） */
  targetType?: HabitTargetType;
  /** 目标时刻，如 07:00（展示用） */
  targetTime?: string;
};

export type HabitDayTimes = { sleepIso?: string; wakeIso?: string };

export type HabitCatalogState = {
  v: 1;
  items: HabitDef[];
  customDone: Record<string, Record<string, boolean>>;
  customWallet: number;
  /** 按打卡日 YYYY-MM-DD 记录入睡/起床的 ISO 时间，供复盘与睡眠区间（跨午夜：睡在前一天、起在当天） */
  dayTimes?: Record<string, HabitDayTimes>;
  /**
   * 时间类自定义习惯：habitId → 打卡日 → 该次打卡的 ISO 时刻（对应「logs.recorded_time」语义，存于 catalog JSON）
   */
  recordedTimes?: Record<string, Record<string, string>>;
};

export const defaultHabitItemsZh: HabitDef[] = [
  {
    id: "def-sleep",
    name: "开始睡觉",
    completePoints: 15,
    penalty: 0,
    streak: 0,
    systemKey: "sleep",
    schedule: { type: "daily" },
    targetType: "time",
    targetTime: "23:00",
  },
  {
    id: "def-wake",
    name: "起床",
    completePoints: 15,
    penalty: 0,
    streak: 0,
    systemKey: "wake",
    schedule: { type: "daily" },
    targetType: "time",
    targetTime: "07:00",
  },
  { id: "def-shower", name: "已洗澡", completePoints: 5, penalty: 0, streak: 0, systemKey: "shower", schedule: { type: "daily" } },
  { id: "def-english", name: "英语口语", completePoints: 10, penalty: 10, streak: 0, systemKey: "english", schedule: { type: "daily" } },
  { id: "def-cantonese", name: "粤语 / 多邻国", completePoints: 10, penalty: 10, streak: 0, systemKey: "cantonese", schedule: { type: "daily" } },
  { id: "def-exercise", name: "运动", completePoints: 0, penalty: 0, streak: 0, systemKey: "exercise", schedule: { type: "daily" } },
];

/** 与 defaultHabitItemsZh 同 id、按语言分开展示名（推广 / 自测用） */
export const defaultHabitItemsEn: HabitDef[] = [
  {
    id: "def-sleep",
    name: "Bedtime",
    completePoints: 15,
    penalty: 0,
    streak: 0,
    systemKey: "sleep",
    schedule: { type: "daily" },
    targetType: "time",
    targetTime: "23:00",
  },
  {
    id: "def-wake",
    name: "Wake up",
    completePoints: 15,
    penalty: 0,
    streak: 0,
    systemKey: "wake",
    schedule: { type: "daily" },
    targetType: "time",
    targetTime: "07:00",
  },
  { id: "def-shower", name: "Shower done", completePoints: 5, penalty: 0, streak: 0, systemKey: "shower", schedule: { type: "daily" } },
  { id: "def-english", name: "Speaking English", completePoints: 10, penalty: 10, streak: 0, systemKey: "english", schedule: { type: "daily" } },
  { id: "def-cantonese", name: "Cantonese / Duolingo", completePoints: 10, penalty: 10, streak: 0, systemKey: "cantonese", schedule: { type: "daily" } },
  { id: "def-exercise", name: "Exercise", completePoints: 0, penalty: 0, streak: 0, systemKey: "exercise", schedule: { type: "daily" } },
];

export const DEFAULT_HABIT_TEMPLATE_IDS: readonly string[] = defaultHabitItemsZh.map((h) => h.id);

export function getDefaultHabitItemsForLang(lang: "zh" | "en"): HabitDef[] {
  return (lang === "en" ? defaultHabitItemsEn : defaultHabitItemsZh).map((h) => ({ ...h }));
}

export function getDefaultHabitItems(): HabitDef[] {
  if (isPromotionBuild()) {
    return getDefaultHabitItemsForLang(readPromotionUiLang()).map((h) => ({ ...h }));
  }
  return defaultHabitItemsZh.map((h) => ({ ...h }));
}

const empty = (): HabitCatalogState => ({
  v: 1,
  items: getDefaultHabitItems(),
  customDone: {},
  customWallet: 0,
  dayTimes: {},
  recordedTimes: {},
});

function normalizeItem(it: HabitDef): HabitDef {
  const schedule: HabitSchedule = it.schedule ?? { type: "daily" };
  const streak = Number.isFinite(it.streak) ? Math.max(0, Math.round(it.streak)) : 0;
  const targetType: HabitTargetType = it.targetType === "time" ? "time" : "boolean";
  let targetTime: string | undefined;
  if (it.targetTime && /^\d{1,2}:\d{2}$/.test(it.targetTime.trim())) {
    const [hh, mm] = it.targetTime.split(":");
    targetTime = `${String(Math.min(23, Math.max(0, parseInt(hh, 10) || 0))).padStart(2, "0")}:${String(Math.min(59, Math.max(0, parseInt(mm, 10) || 0))).padStart(2, "0")}`;
  }
  if (schedule.type === "weekdays" && (!Array.isArray(schedule.days) || schedule.days.length === 0)) {
    return { ...it, streak, schedule: { type: "daily" }, targetType, targetTime };
  }
  return { ...it, streak, schedule, targetType, targetTime };
}

function parse(raw: string | null): HabitCatalogState {
  if (!raw) return empty();
  try {
    const j = JSON.parse(raw) as HabitCatalogState;
    if (j.v !== 1 || !Array.isArray(j.items)) return empty();
    if (typeof j.customDone !== "object" || j.customDone == null) j.customDone = {};
    if (typeof j.customWallet !== "number" || !Number.isFinite(j.customWallet)) j.customWallet = 0;
    if (typeof j.dayTimes !== "object" || j.dayTimes == null) j.dayTimes = {};
    if (typeof j.recordedTimes !== "object" || j.recordedTimes == null) j.recordedTimes = {};
    if (j.items.length === 0) j.items = getDefaultHabitItems();
    j.items = j.items.map((x) => normalizeItem(x));
    return j;
  } catch {
    return empty();
  }
}

/** 将远程 / Supabase `catalog` JSON 解析为与本地一致的结构 */
export function habitCatalogStateFromJson(data: unknown): HabitCatalogState {
  if (data == null) return empty();
  try {
    if (typeof data === "string") return parse(data);
    return parse(JSON.stringify(data));
  } catch {
    return empty();
  }
}

export function loadHabitCatalog(): HabitCatalogState {
  if (typeof localStorage === "undefined") return empty();
  return parse(localStorage.getItem(KEY));
}

export function saveHabitCatalog(s: HabitCatalogState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  queueMicrotask(() => void import("./userDataRemote").then((m) => m.schedulePushHabitCatalog(s)));
}

export function newHabitId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `h-${crypto.randomUUID()}`;
  return `h-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getCustomDoneForDate(state: HabitCatalogState, date: string, habitId: string): boolean {
  return Boolean(state.customDone[date]?.[habitId]);
}

export function getRecordedTimeIso(
  state: HabitCatalogState,
  habitId: string,
  date: string
): string | undefined {
  return state.recordedTimes?.[habitId]?.[date];
}

/** 无 systemKey 且 targetType=time 的自定义习惯：打卡时刻写入 recordedTimes */
function applyTimeHabitCheckIn(
  state: HabitCatalogState,
  date: string,
  habitId: string,
  def: HabitDef,
  wasDone: boolean,
  nowDone: boolean,
  clockIso?: string | null
): HabitCatalogState {
  const day = { ...(state.customDone[date] ?? {}) } as Record<string, boolean>;
  if (nowDone) {
    day[habitId] = true;
  } else {
    delete day[habitId];
  }
  let w = state.customWallet || 0;
  if (!wasDone && nowDone) {
    w += def.completePoints;
  } else if (wasDone && !nowDone) {
    w -= def.completePoints;
    if (def.penalty > 0) w -= def.penalty;
  }
  const streakDelta = !wasDone && nowDone ? 1 : wasDone && !nowDone ? -1 : 0;
  const items =
    streakDelta === 0
      ? state.items
      : state.items.map((it) =>
          it.id === habitId ? { ...it, streak: Math.max(0, (it.streak ?? 0) + streakDelta) } : it
        );
  const byHabit = { ...(state.recordedTimes?.[habitId] ?? {}) } as Record<string, string>;
  if (nowDone) {
    const iso = (clockIso && clockIso.length > 0 ? clockIso : new Date().toISOString());
    byHabit[date] = iso;
  } else {
    delete byHabit[date];
  }
  const recordedTimes = { ...(state.recordedTimes ?? {}) } as Record<string, Record<string, string>>;
  if (Object.keys(byHabit).length) recordedTimes[habitId] = byHabit;
  else delete recordedTimes[habitId];
  return {
    ...state,
    items,
    customDone: { ...state.customDone, [date]: day },
    customWallet: w,
    recordedTimes: Object.keys(recordedTimes).length ? recordedTimes : undefined,
  };
}

export function isHabitDueOnWeekday(def: HabitDef, day: number): boolean {
  const s = def.schedule ?? { type: "daily" as const };
  if (s.type === "daily") return true;
  return s.days.includes(day);
}

/**
 * 从 YYYY-MM-DD 解析本地日期的 getDay()（0–6）
 */
export function getWeekdayForIsoDate(iso: string): number {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return new Date().getDay();
  return new Date(y, m - 1, d).getDay();
}

export function applyLocalToggle(
  state: HabitCatalogState,
  date: string,
  habitId: string,
  def: HabitDef,
  wasDone: boolean,
  nowDone: boolean,
  clockIso?: string | null
): HabitCatalogState {
  if (!def.systemKey && def.targetType === "time") {
    return applyTimeHabitCheckIn(state, date, habitId, def, wasDone, nowDone, clockIso);
  }

  const day = { ...(state.customDone[date] ?? {}) } as Record<string, boolean>;
  if (nowDone) {
    day[habitId] = true;
  } else {
    delete day[habitId];
  }
  let w = state.customWallet || 0;
  if (!wasDone && nowDone) {
    w += def.completePoints;
  } else if (wasDone && !nowDone) {
    w -= def.completePoints;
    if (def.penalty > 0) w -= def.penalty;
  }
  const streakDelta = !wasDone && nowDone ? 1 : wasDone && !nowDone ? -1 : 0;
  const items =
    streakDelta === 0
      ? state.items
      : state.items.map((it) =>
          it.id === habitId ? { ...it, streak: Math.max(0, (it.streak ?? 0) + streakDelta) } : it
        );
  const dayTimes = { ...(state.dayTimes ?? {}) } as Record<string, HabitDayTimes>;
  const ts = nowDone ? (clockIso && clockIso.length > 0 ? clockIso : new Date().toISOString()) : null;
  if (def.systemKey === "sleep") {
    if (nowDone && ts) {
      dayTimes[date] = { ...dayTimes[date], sleepIso: ts };
    } else {
      const cur = { ...dayTimes[date] } as HabitDayTimes;
      delete cur.sleepIso;
      if (cur.wakeIso) dayTimes[date] = cur;
      else delete dayTimes[date];
    }
  }
  if (def.systemKey === "wake") {
    if (nowDone && ts) {
      dayTimes[date] = { ...dayTimes[date], wakeIso: ts };
    } else {
      const cur = { ...dayTimes[date] } as HabitDayTimes;
      delete cur.wakeIso;
      if (cur.sleepIso) dayTimes[date] = cur;
      else delete dayTimes[date];
    }
  }

  return {
    ...state,
    items,
    customDone: { ...state.customDone, [date]: day },
    customWallet: w,
    dayTimes: Object.keys(dayTimes).length > 0 ? dayTimes : undefined,
  };
}

export function today() {
  return todayIsoLocal();
}
