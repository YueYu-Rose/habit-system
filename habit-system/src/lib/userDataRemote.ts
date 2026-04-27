import { getSupabase, isSupabaseConfigured } from "./supabase";
import {
  HABIT_CATALOG_STORAGE_KEY,
  loadHabitCatalog,
  type HabitCatalogState,
} from "./habitListStorage";
import { loadRewardCatalog, REWARD_CATALOG_STORAGE_KEY, type RewardCatalogItem } from "./rewardCatalogStorage";
import { loadMainlineLoopState, MAINLINE_LOOP_STORAGE_KEY, type MainlineLoopState } from "./mainlineLoopStorage";

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
  const [hRes, rRes, mRes] = await Promise.all([
    sb.from("user_habit_data").select("catalog,updated_at").eq("user_id", userId).maybeSingle(),
    sb.from("user_reward_data").select("rows,updated_at").eq("user_id", userId).maybeSingle(),
    sb.from("user_mainline_data").select("state,updated_at").eq("user_id", userId).maybeSingle(),
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
  const localH = loadHabitCatalog();
  const localR = loadRewardCatalog();
  const localM = loadMainlineLoopState();

  if (hRow?.catalog && typeof hRow.catalog === "object") {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(HABIT_CATALOG_STORAGE_KEY, JSON.stringify(hRow.catalog));
    }
  } else {
    await pushHabitCatalogToRemote(userId, localH);
  }

  if (rRow?.rows && Array.isArray(rRow.rows)) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(REWARD_CATALOG_STORAGE_KEY, JSON.stringify(rRow.rows));
    }
  } else {
    await pushRewardDataToRemote(userId, localR);
  }

  if (mRow?.state && typeof mRow.state === "object") {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(MAINLINE_LOOP_STORAGE_KEY, JSON.stringify(mRow.state));
    }
  } else {
    await pushMainlineDataToRemote(userId, localM);
  }

  notifyPulled();
}

async function pushHabitCatalogToRemote(userId: string, s: HabitCatalogState): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("user_habit_data").upsert(
    { user_id: userId, catalog: s, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) console.error("[userDataRemote] habit push", error);
}

async function pushRewardDataToRemote(userId: string, rows: RewardCatalogItem[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("user_reward_data").upsert(
    { user_id: userId, rows, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) console.error("[userDataRemote] reward push", error);
}

async function pushMainlineDataToRemote(userId: string, state: MainlineLoopState): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("user_mainline_data").upsert(
    { user_id: userId, state, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
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
