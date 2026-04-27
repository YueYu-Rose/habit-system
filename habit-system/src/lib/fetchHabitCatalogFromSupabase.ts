import { getSupabase, isSupabaseConfigured } from "./supabase";
import { habitCatalogStateFromJson, type HabitCatalogState } from "./habitListStorage";

/**
 * 从 `user_habit_data` 拉取当前用户的 habit catalog（与 LocalStorage 结构一致；
 * 打卡与 dayTimes 等均存储在该 JSON 中，项目未使用单独的 `logs` 表）。
 */
export async function fetchHabitCatalogFromSupabase(userId: string): Promise<HabitCatalogState | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("user_habit_data").select("catalog").eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("[fetchHabitCatalogFromSupabase]", error);
    return null;
  }
  if (data?.catalog == null) return null;
  return habitCatalogStateFromJson(data.catalog);
}
