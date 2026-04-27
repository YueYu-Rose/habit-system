import { getSupabase, isSupabaseConfigured } from "./supabase";
import { habitCatalogStateFromJson, type HabitCatalogState } from "./habitListStorage";
import { REMOTE_HABIT_COLUMNS, REMOTE_TABLE, logRemoteRowKeysDev } from "./supabaseRemoteTables";

/**
 * 从 `user_habit_data` 拉取当前用户的 habit catalog（与 LocalStorage 结构一致；
 * 打卡与 dayTimes 等均存储在该 JSON 中，项目未使用单独的 `logs` 表）。
 * 列名 `catalog` 须与 `supabase/schema.sql` 中 public.user_habit_data 一致。
 */
export async function fetchHabitCatalogFromSupabase(userId: string): Promise<HabitCatalogState | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from(REMOTE_TABLE.habit)
    .select(REMOTE_HABIT_COLUMNS.payload)
    .eq(REMOTE_HABIT_COLUMNS.pk, userId)
    .maybeSingle();
  if (error) {
    console.error("[fetchHabitCatalogFromSupabase]", error);
    return null;
  }
  logRemoteRowKeysDev(`${REMOTE_TABLE.habit} (fetchHabitCatalog)`, data);
  const raw = data ? (data as Record<string, unknown>)[REMOTE_HABIT_COLUMNS.payload] : undefined;
  if (raw == null) return null;
  return habitCatalogStateFromJson(raw);
}
