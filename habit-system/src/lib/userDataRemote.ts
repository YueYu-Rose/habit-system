import { getSupabase, isSupabaseConfigured } from "./supabase";
import {
  HABIT_CATALOG_STORAGE_KEY,
  loadHabitCatalog,
  mergeHabitCatalogOnPull,
  type HabitCatalogState,
} from "./habitListStorage";
import { loadRewardCatalog, REWARD_CATALOG_STORAGE_KEY, type RewardCatalogItem } from "./rewardCatalogStorage";
import {
  loadMainlineLoopState,
  MAINLINE_LOOP_STORAGE_KEY,
  mergeMainlineStateOnPull,
  type MainlineLoopState,
} from "./mainlineLoopStorage";
import {
  logRemoteRowKeysDev,
  REMOTE_HABIT_COLUMNS,
  REMOTE_MAINLINE_COLUMNS,
  REMOTE_REWARD_COLUMNS,
  REMOTE_TABLE,
} from "./supabaseRemoteTables";

export const REMOTE_DATA_EVENT = "user-remote-pulled";

let remoteUserId: string | null = null;
let pushHTimeout: ReturnType<typeof setTimeout> | null = null;
let pushRTimeout: ReturnType<typeof setTimeout> | null = null;
let pushMTimeout: ReturnType<typeof setTimeout> | null = null;

/** 由 Auth 在登入/登出时设置；用于在同步函数中判断是否应写库 */
export function setRemoteDataUserId(userId: string | null): void {
  remoteUserId = userId;
}

export function getRemoteDataUserId(): string | null {
  return remoteUserId;
}

export function isCloudDataSyncEnabled(): boolean {
  return isSupabaseConfigured() && remoteUserId != null;
}

function notifyPulled(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REMOTE_DATA_EVENT));
  window.dispatchEvent(new CustomEvent("habit-promo-data"));
}

/**
 * 登录后从 Supabase 拉取；若无行则把当前 Local 快照首次同步上去
 */
export async function pullAllUserDataForUser(userId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  console.log("2. Fetching remote rows (user_habit_data, user_reward_data, user_mainline_data)…");
  const habitSel = `${REMOTE_HABIT_COLUMNS.payload},${REMOTE_HABIT_COLUMNS.ts}` as const;
  const rewardSel = `${REMOTE_REWARD_COLUMNS.payload},${REMOTE_REWARD_COLUMNS.ts}` as const;
  const mainlineSel = `${REMOTE_MAINLINE_COLUMNS.payload},${REMOTE_MAINLINE_COLUMNS.ts}` as const;
  const [hRes, rRes, mRes] = await Promise.all([
    sb.from(REMOTE_TABLE.habit).select(habitSel).eq(REMOTE_HABIT_COLUMNS.pk, userId).maybeSingle(),
    sb.from(REMOTE_TABLE.reward).select(rewardSel).eq(REMOTE_REWARD_COLUMNS.pk, userId).maybeSingle(),
    sb.from(REMOTE_TABLE.mainline).select(mainlineSel).eq(REMOTE_MAINLINE_COLUMNS.pk, userId).maybeSingle(),
  ]);

  if (hRes.error) {
    console.error("🔥 Supabase Fetch Error:", hRes.error);
    throw hRes.error;
  }
  if (rRes.error) {
    console.error("🔥 Supabase Fetch Error:", rRes.error);
    throw rRes.error;
  }
  if (mRes.error) {
    console.error("🔥 Supabase Fetch Error:", mRes.error);
    throw mRes.error;
  }

  const hRow = hRes.data;
  const rRow = rRes.data;
  const mRow = mRes.data;
  logRemoteRowKeysDev(REMOTE_TABLE.habit, hRow);
  logRemoteRowKeysDev(REMOTE_TABLE.reward, rRow);
  logRemoteRowKeysDev(REMOTE_TABLE.mainline, mRow);
  const localH = loadHabitCatalog();
  const localR = loadRewardCatalog();
  const localM = loadMainlineLoopState();

  const hPayload = hRow ? (hRow as Record<string, unknown>)[REMOTE_HABIT_COLUMNS.payload] : undefined;
  if (hPayload && typeof hPayload === "object") {
    if (typeof localStorage !== "undefined") {
      const merged = mergeHabitCatalogOnPull(localH, hPayload);
      localStorage.setItem(HABIT_CATALOG_STORAGE_KEY, JSON.stringify(merged));
    }
  } else {
    await pushHabitCatalogToRemote(userId, localH);
  }

  const rPayload = rRow ? (rRow as Record<string, unknown>)[REMOTE_REWARD_COLUMNS.payload] : undefined;
  if (Array.isArray(rPayload)) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(REWARD_CATALOG_STORAGE_KEY, JSON.stringify(rPayload));
    }
  } else {
    await pushRewardDataToRemote(userId, localR);
  }

  const mPayload = mRow ? (mRow as Record<string, unknown>)[REMOTE_MAINLINE_COLUMNS.payload] : undefined;
  if (mPayload && typeof mPayload === "object") {
    if (typeof localStorage !== "undefined") {
      const merged = mergeMainlineStateOnPull(localM, mPayload);
      localStorage.setItem(MAINLINE_LOOP_STORAGE_KEY, JSON.stringify(merged));
    }
  } else {
    await pushMainlineDataToRemote(userId, localM);
  }

  notifyPulled();
}

async function pushHabitCatalogToRemote(userId: string, s: HabitCatalogState): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from(REMOTE_TABLE.habit).upsert(
    {
      [REMOTE_HABIT_COLUMNS.pk]: userId,
      [REMOTE_HABIT_COLUMNS.payload]: s,
      [REMOTE_HABIT_COLUMNS.ts]: new Date().toISOString(),
    },
    { onConflict: REMOTE_HABIT_COLUMNS.pk }
  );
  if (error) console.error("[userDataRemote] habit push", error);
}

async function pushRewardDataToRemote(userId: string, rows: RewardCatalogItem[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from(REMOTE_TABLE.reward).upsert(
    {
      [REMOTE_REWARD_COLUMNS.pk]: userId,
      [REMOTE_REWARD_COLUMNS.payload]: rows,
      [REMOTE_REWARD_COLUMNS.ts]: new Date().toISOString(),
    },
    { onConflict: REMOTE_REWARD_COLUMNS.pk }
  );
  if (error) console.error("[userDataRemote] reward push", error);
}

async function pushMainlineDataToRemote(userId: string, state: MainlineLoopState): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from(REMOTE_TABLE.mainline).upsert(
    {
      [REMOTE_MAINLINE_COLUMNS.pk]: userId,
      [REMOTE_MAINLINE_COLUMNS.payload]: state,
      [REMOTE_MAINLINE_COLUMNS.ts]: new Date().toISOString(),
    },
    { onConflict: REMOTE_MAINLINE_COLUMNS.pk }
  );
  if (error) console.error("[userDataRemote] mainline push", error);
}

export function schedulePushHabitCatalog(s: HabitCatalogState): void {
  if (!isCloudDataSyncEnabled()) return;
  const uid = remoteUserId;
  if (!uid) return;
  if (pushHTimeout) clearTimeout(pushHTimeout);
  pushHTimeout = setTimeout(() => {
    pushHTimeout = null;
    void pushHabitCatalogToRemote(uid, s);
  }, 500);
}

export function schedulePushRewardRows(rows: RewardCatalogItem[]): void {
  if (!isCloudDataSyncEnabled()) return;
  const uid = remoteUserId;
  if (!uid) return;
  if (pushRTimeout) clearTimeout(pushRTimeout);
  pushRTimeout = setTimeout(() => {
    pushRTimeout = null;
    void pushRewardDataToRemote(uid, rows);
  }, 500);
}

export function schedulePushMainlineState(state: MainlineLoopState): void {
  if (!isCloudDataSyncEnabled()) return;
  const uid = remoteUserId;
  if (!uid) return;
  if (pushMTimeout) clearTimeout(pushMTimeout);
  pushMTimeout = setTimeout(() => {
    pushMTimeout = null;
    void pushMainlineDataToRemote(uid, state);
  }, 500);
}
