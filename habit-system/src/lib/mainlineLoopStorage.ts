export const MAINLINE_LOOP_STORAGE_KEY = "habit_mainline_loop_v1";
const STORAGE_KEY = MAINLINE_LOOP_STORAGE_KEY;

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
};

const emptyState = (): MainlineLoopState => ({
  version: 1,
  spendableDelta: 0,
  current: null,
  archived: [],
});

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
    return {
      version: 1,
      spendableDelta: Math.max(0, j.spendableDelta),
      current: j.current,
      archived: j.archived.filter(
        (a) => a && typeof a.id === "string" && typeof a.name === "string" && typeof a.finalPoints === "number"
      ),
    };
  } catch {
    return emptyState();
  }
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
