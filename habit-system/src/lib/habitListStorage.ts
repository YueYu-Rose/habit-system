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

/**
 * 保存/解析习惯时的「完成加分」：未填、非法值 → 10；显式 0 保留 0。
 * 用于表单提交与 JSON 回读，避免 time 型习惯在序列化中丢字段变成 undefined→0。
 */
export function normalizeSavedCompletePoints(value: unknown): number {
  if (value === null || value === undefined || value === "") return 10;
  if (typeof value === "string" && value.trim() === "") return 10;
  const n = typeof value === "string" ? parseInt(value.trim(), 10) : Number(value);
  if (n === 0) return 0;
  if (!Number.isFinite(n) || n < 0) return 10;
  return Math.round(n);
}

/** 结算用：对勾/计分用；0 分表示该习惯不加分（与显式设 0 一致） */
export function habitRewardPoints(def: HabitDef): number {
  const n = Number(def.completePoints);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

/** 打卡一次实际进 customWallet 的分：历史模板将运动标为 0 分时仍按 15 分计 */
const EXERCISE_DEFAULT_POINTS = 15;

export function getPointsForHabitComplete(def: HabitDef): number {
  const w = habitRewardPoints(def);
  if (w > 0) return w;
  if (def.systemKey === "exercise") return EXERCISE_DEFAULT_POINTS;
  return 0;
}

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
  { id: "def-exercise", name: "运动", completePoints: 15, penalty: 0, streak: 0, systemKey: "exercise", schedule: { type: "daily" } },
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
  { id: "def-exercise", name: "Exercise", completePoints: 15, penalty: 0, streak: 0, systemKey: "exercise", schedule: { type: "daily" } },
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
  let completePoints = normalizeSavedCompletePoints(it.completePoints);
  if (it.systemKey === "exercise" && completePoints === 0) completePoints = EXERCISE_DEFAULT_POINTS;
  const penaltyRaw = it.penalty;
  const penalty =
    penaltyRaw == null || penaltyRaw === "" || (typeof penaltyRaw === "string" && penaltyRaw.trim() === "")
      ? 0
      : (() => {
          const p = Number(penaltyRaw);
          return Number.isFinite(p) && p >= 0 ? Math.round(p) : 0;
        })();
  let targetTime: string | undefined;
  if (it.targetTime && /^\d{1,2}:\d{2}$/.test(it.targetTime.trim())) {
    const [hh, mm] = it.targetTime.split(":");
    targetTime = `${String(Math.min(23, Math.max(0, parseInt(hh, 10) || 0))).padStart(2, "0")}:${String(Math.min(59, Math.max(0, parseInt(mm, 10) || 0))).padStart(2, "0")}`;
  }
  if (schedule.type === "weekdays" && (!Array.isArray(schedule.days) || schedule.days.length === 0)) {
    return { ...it, streak, completePoints, penalty, schedule: { type: "daily" }, targetType, targetTime };
  }
  return { ...it, streak, completePoints, penalty, schedule, targetType, targetTime };
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

/**
 * 拉取远端后合并：customWallet 取 max(本地, 远端)，避免未推送到服务器的本地加分被旧快照整表覆盖
 */
export function mergeHabitCatalogOnPull(local: HabitCatalogState, remoteData: unknown): HabitCatalogState {
  const remote = habitCatalogStateFromJson(remoteData);
  const wLocal = Math.max(0, Number.isFinite(local.customWallet) ? local.customWallet : 0);
  const wRemote = Math.max(0, Number.isFinite(remote.customWallet) ? remote.customWallet : 0);
  return { ...remote, customWallet: Math.max(wLocal, wRemote) };
}

export function loadHabitCatalog(): HabitCatalogState {
  if (typeof localStorage === "undefined") return empty();
  return parse(localStorage.getItem(KEY));
}

export function saveHabitCatalog(s: HabitCatalogState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HABIT_CATALOG_SAVED_EVENT));
  }
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

/**
 * 无服务端 habitDaily 时，仅根据目录判断是否完成（与 useHabitCatalog.getDone 在 daily===null 时一致）
 */
export function isHabitDoneInCatalogOnly(state: HabitCatalogState, def: HabitDef, date: string): boolean {
  if (getCustomDoneForDate(state, date, def.id)) return true;
  if (def.systemKey) {
    return false;
  }
  if (def.targetType === "time") {
    return Boolean(getRecordedTimeIso(state, def.id, date));
  }
  return false;
}

function mergeCustomDoneUnion(
  a: HabitCatalogState["customDone"],
  b: HabitCatalogState["customDone"]
): HabitCatalogState["customDone"] {
  const dates = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: HabitCatalogState["customDone"] = {};
  for (const d of dates) {
    const ma = a[d] ?? {};
    const mb = b[d] ?? {};
    const ids = new Set([...Object.keys(ma), ...Object.keys(mb)]);
    const day: Record<string, boolean> = {};
    for (const id of ids) {
      if (ma[id] || mb[id]) day[id] = true;
    }
    if (Object.keys(day).length) out[d] = day;
  }
  return out;
}

function mergeRecordedTimesUnion(
  a: HabitCatalogState["recordedTimes"],
  b: HabitCatalogState["recordedTimes"]
): HabitCatalogState["recordedTimes"] | undefined {
  if (!a && !b) return undefined;
  const out: NonNullable<typeof a> = {} as NonNullable<typeof a>;
  const hids = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const hid of hids) {
    const mA = a?.[hid] ?? {};
    const mB = b?.[hid] ?? {};
    const days = new Set([...Object.keys(mA), ...Object.keys(mB)]);
    const row: Record<string, string> = {};
    for (const d of days) {
      const s = mA[d] || mB[d];
      if (s) row[d] = s;
    }
    if (Object.keys(row).length) out[hid] = row;
  }
  return Object.keys(out).length ? out : undefined;
}

function mergeDayTimesUnion(
  a: HabitCatalogState["dayTimes"],
  b: HabitCatalogState["dayTimes"]
): HabitCatalogState["dayTimes"] | undefined {
  if (!a && !b) return undefined;
  const dates = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  const out: NonNullable<typeof a> = {} as NonNullable<typeof a>;
  for (const d of dates) {
    const da = a?.[d];
    const db = b?.[d];
    if (!da && !db) continue;
    out[d] = {
      sleepIso: da?.sleepIso ?? db?.sleepIso,
      wakeIso: da?.wakeIso ?? db?.wakeIso,
    };
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * 将本地与当前 state 的打卡数据做并集，避免仅 Supabase 的 state 缺 customDone/recorded 时流水与首页不一致
 */
export function mergeHabitCatalogCheckInOverlay(
  primary: HabitCatalogState,
  fromDisk: HabitCatalogState
): HabitCatalogState {
  return {
    ...primary,
    customDone: mergeCustomDoneUnion(primary.customDone, fromDisk.customDone),
    recordedTimes: mergeRecordedTimesUnion(primary.recordedTimes, fromDisk.recordedTimes),
    dayTimes: mergeDayTimesUnion(primary.dayTimes, fromDisk.dayTimes),
  };
}

/** 习惯目录写入 localStorage 后派发，复盘页可据此与磁盘对齐 */
export const HABIT_CATALOG_SAVED_EVENT = "habit-catalog-saved";

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
  const pts = getPointsForHabitComplete(def);
  const pen = def.penalty > 0 ? Math.round(def.penalty) : 0;
  let w = state.customWallet || 0;
  if (!wasDone && nowDone) {
    w += pts;
  } else if (wasDone && !nowDone) {
    w -= pts;
    if (pen > 0) w -= pen;
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
  const pts = getPointsForHabitComplete(def);
  const pen = def.penalty > 0 ? Math.round(def.penalty) : 0;
  let w = state.customWallet || 0;
  if (!wasDone && nowDone) {
    w += pts;
  } else if (wasDone && !nowDone) {
    w -= pts;
    if (pen > 0) w -= pen;
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
