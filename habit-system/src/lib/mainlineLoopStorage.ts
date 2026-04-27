export const MAINLINE_LOOP_STORAGE_KEY = "habit_mainline_loop_v1";
const STORAGE_KEY = MAINLINE_LOOP_STORAGE_KEY;

export const MAX_MAINLINE_PROGRESS_ENTRIES = 200;

export type MainlineCurrent = {
  name: string;
  /** 本主线下已获得的累计分（与等级/经验无关的开放式累计） */
  cumulativePoints: number;
  createdAt: string;
};

export type MainlineArchived = {
  id: string;
  name: string;
  finalPoints: number;
  endedAt: string;
};

/** 经验累积：与主线正分注入一一对应，同步于 `user_mainline_data.state` JSON，无独立 DB 表 */
export type MainlineProgressEntry = {
  id: string;
  /** 事件发生时刻 ISO */
  at: string;
  amount: number;
  source: "quick" | "external";
  /** 当时的当前主线名快照 */
  mainlineName: string;
};

export type MainlineLoopState = {
  version: 1;
  /**
   * 由主线快捷加分、外部 To-Do 同步等产生的「本地可用分池」，
   * 在 UI 上与后端返回的 `available` 余额相加，形成展示上的「总可用」。
   * 后续接入后端时可将该池对账、合并为单一账簿。
   */
  spendableDelta: number;
  current: MainlineCurrent | null;
  archived: MainlineArchived[];
  /** 主线正分注入时间轴（新在前），与 `logs` 表无单独对应时由客户端写入本数组 */
  progressHistory?: MainlineProgressEntry[];
};

const emptyState = (): MainlineLoopState => ({
  version: 1,
  spendableDelta: 0,
  current: null,
  archived: [],
  progressHistory: [],
});

function isValidEntry(e: unknown): e is MainlineProgressEntry {
  if (!e || typeof e !== "object") return false;
  const o = e as MainlineProgressEntry;
  if (typeof o.id !== "string" || o.id.length === 0) return false;
  if (typeof o.at !== "string") return false;
  if (typeof o.amount !== "number" || !Number.isFinite(o.amount) || o.amount <= 0) return false;
  if (o.source !== "quick" && o.source !== "external") return false;
  if (typeof o.mainlineName !== "string") return false;
  return true;
}

function normalizeProgressHistory(raw: unknown): MainlineProgressEntry[] {
  if (!Array.isArray(raw)) return [];
  const list = raw.filter(isValidEntry);
  return list
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, MAX_MAINLINE_PROGRESS_ENTRIES);
}

function parse(raw: string | null): MainlineLoopState {
  if (!raw) return emptyState();
  try {
    const j = JSON.parse(raw) as MainlineLoopState;
    if (j.version !== 1 || typeof j.spendableDelta !== "number" || !Array.isArray(j.archived)) {
      return emptyState();
    }
    if (j.current != null) {
      if (typeof j.current.name !== "string" || typeof j.current.cumulativePoints !== "number") {
        return emptyState();
      }
    }
    const progressHistory = normalizeProgressHistory(j.progressHistory);
    return {
      version: 1,
      spendableDelta: Math.max(0, j.spendableDelta),
      current: j.current,
      archived: j.archived.filter(
        (a) => a && typeof a.id === "string" && typeof a.name === "string" && typeof a.finalPoints === "number"
      ),
      progressHistory,
    };
  } catch {
    return emptyState();
  }
}

export function mainlineStateFromJson(data: unknown): MainlineLoopState {
  if (data == null) return emptyState();
  try {
    if (typeof data === "string") return parse(data);
    return parse(JSON.stringify(data));
  } catch {
    return emptyState();
  }
}

function mergeProgressHistoryUnion(
  a: MainlineProgressEntry[] | undefined,
  b: MainlineProgressEntry[] | undefined
): MainlineProgressEntry[] {
  const byId = new Map<string, MainlineProgressEntry>();
  for (const e of normalizeProgressHistory(a)) {
    byId.set(e.id, e);
  }
  for (const e of normalizeProgressHistory(b)) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  return Array.from(byId.values())
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, MAX_MAINLINE_PROGRESS_ENTRIES);
}

/**
 * 拉取远端后合并：其它字段以远端为准，progressHistory 取并集（按 id 去重）
 */
export function mergeMainlineStateOnPull(local: MainlineLoopState, remoteData: unknown): MainlineLoopState {
  const remote = mainlineStateFromJson(remoteData);
  return {
    ...remote,
    progressHistory: mergeProgressHistoryUnion(local.progressHistory, remote.progressHistory),
  };
}

export function newMainlineProgressId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `mlp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function appendMainlineProgressEntry(
  state: MainlineLoopState,
  partial: Omit<MainlineProgressEntry, "id">
): MainlineLoopState {
  const entry: MainlineProgressEntry = { id: newMainlineProgressId(), ...partial };
  const next = [entry, ...(state.progressHistory ?? [])];
  return {
    ...state,
    progressHistory: normalizeProgressHistory(next),
  };
}

export function loadMainlineLoopState(): MainlineLoopState {
  if (typeof localStorage === "undefined") return emptyState();
  return parse(localStorage.getItem(STORAGE_KEY));
}

export function saveMainlineLoopState(next: MainlineLoopState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  queueMicrotask(() => void import("./userDataRemote").then((m) => m.schedulePushMainlineState(next)));
}

export function newArchivedId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `ml-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
