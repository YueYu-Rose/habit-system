import { todayIsoLocal } from "./dateLocal";

const KEY = "habit_checkin_catalog_v1";

function isPromotionBuild(): boolean {
  return String(import.meta.env.VITE_APP_MODE ?? "PERSONAL").toUpperCase() === "PROMOTION";
}

export type HabitSystemKey = "sleep" | "wake" | "shower" | "english" | "cantonese" | "exercise";

/** 出现频次：每天 或 指定星期（0=周日 … 6=周六，与 Date#getDay 一致） */
export type HabitSchedule =
  | { type: "daily" }
  | { type: "weekdays"; days: number[] };

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
};

export type HabitCatalogState = {
  v: 1;
  items: HabitDef[];
  customDone: Record<string, Record<string, boolean>>;
  customWallet: number;
};

export const defaultHabitItemsZh: HabitDef[] = [
  { id: "def-sleep", name: "开始睡觉", completePoints: 15, penalty: 0, streak: 0, systemKey: "sleep", schedule: { type: "daily" } },
  { id: "def-wake", name: "起床了", completePoints: 15, penalty: 0, streak: 0, systemKey: "wake", schedule: { type: "daily" } },
  { id: "def-shower", name: "已洗澡", completePoints: 5, penalty: 0, streak: 0, systemKey: "shower", schedule: { type: "daily" } },
  { id: "def-english", name: "英语口语", completePoints: 10, penalty: 10, streak: 0, systemKey: "english", schedule: { type: "daily" } },
  { id: "def-cantonese", name: "粤语 / 多邻国", completePoints: 10, penalty: 10, streak: 0, systemKey: "cantonese", schedule: { type: "daily" } },
  { id: "def-exercise", name: "运动", completePoints: 0, penalty: 0, streak: 0, systemKey: "exercise", schedule: { type: "daily" } },
];

/** 推广版 / PROMOTION 构建下的默认习惯名称（与中文条目 id / systemKey 一一对应） */
export const defaultHabitItemsEn: HabitDef[] = [
  { id: "def-sleep", name: "Bedtime", completePoints: 15, penalty: 0, streak: 0, systemKey: "sleep", schedule: { type: "daily" } },
  { id: "def-wake", name: "Wake up", completePoints: 15, penalty: 0, streak: 0, systemKey: "wake", schedule: { type: "daily" } },
  { id: "def-shower", name: "Shower done", completePoints: 5, penalty: 0, streak: 0, systemKey: "shower", schedule: { type: "daily" } },
  { id: "def-english", name: "Speaking English", completePoints: 10, penalty: 10, streak: 0, systemKey: "english", schedule: { type: "daily" } },
  { id: "def-cantonese", name: "Cantonese / Duolingo", completePoints: 10, penalty: 10, streak: 0, systemKey: "cantonese", schedule: { type: "daily" } },
  { id: "def-exercise", name: "Exercise", completePoints: 0, penalty: 0, streak: 0, systemKey: "exercise", schedule: { type: "daily" } },
];

export function getDefaultHabitItems(): HabitDef[] {
  return (isPromotionBuild() ? defaultHabitItemsEn : defaultHabitItemsZh).map((h) => ({ ...h }));
}

const empty = (): HabitCatalogState => ({
  v: 1,
  items: getDefaultHabitItems(),
  customDone: {},
  customWallet: 0,
});

function normalizeItem(it: HabitDef): HabitDef {
  const schedule: HabitSchedule = it.schedule ?? { type: "daily" };
  const streak = Number.isFinite(it.streak) ? Math.max(0, Math.round(it.streak)) : 0;
  if (schedule.type === "weekdays" && (!Array.isArray(schedule.days) || schedule.days.length === 0)) {
    return { ...it, streak, schedule: { type: "daily" } };
  }
  return { ...it, streak, schedule };
}

function parse(raw: string | null): HabitCatalogState {
  if (!raw) return empty();
  try {
    const j = JSON.parse(raw) as HabitCatalogState;
    if (j.v !== 1 || !Array.isArray(j.items)) return empty();
    if (typeof j.customDone !== "object" || j.customDone == null) j.customDone = {};
    if (typeof j.customWallet !== "number" || !Number.isFinite(j.customWallet)) j.customWallet = 0;
    if (j.items.length === 0) j.items = getDefaultHabitItems();
    j.items = j.items.map((x) => normalizeItem(x));
    return j;
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
}

export function newHabitId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `h-${crypto.randomUUID()}`;
  return `h-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getCustomDoneForDate(state: HabitCatalogState, date: string, habitId: string): boolean {
  return Boolean(state.customDone[date]?.[habitId]);
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
  nowDone: boolean
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
  return {
    ...state,
    items,
    customDone: { ...state.customDone, [date]: day },
    customWallet: w,
  };
}

export function today() {
  return todayIsoLocal();
}
