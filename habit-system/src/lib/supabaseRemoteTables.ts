/**
 * Supabase Postgres 公网表名与列名 — 须与 `habit-system/supabase/schema.sql` 及你 Dashboard 里实际表结构一致。
 * 勿与本地演示 API 的 SQLite 表（如 `rewards_catalog`）混淆。
 *
 * 若出现 PostgREST 列不存在或写入失败，请到 Supabase → Table Editor 核对列名，并同步修改：
 * - 本文件 REMOTE_HABIT_COLUMNS 等
 * - `userDataRemote.ts` / `fetchHabitCatalogFromSupabase.ts` 中的 select/upsert 字段列表
 */

export const REMOTE_TABLE = {
  habit: "user_habit_data",
  reward: "user_reward_data",
  mainline: "user_mainline_data",
} as const;

/** select / upsert 时使用的列（与 schema.sql 中 create table 一致） */
export const REMOTE_HABIT_COLUMNS = {
  pk: "user_id" as const,
  payload: "catalog" as const,
  ts: "updated_at" as const,
};

export const REMOTE_REWARD_COLUMNS = {
  pk: "user_id" as const,
  payload: "rows" as const,
  ts: "updated_at" as const,
};

export const REMOTE_MAINLINE_COLUMNS = {
  pk: "user_id" as const,
  payload: "state" as const,
  ts: "updated_at" as const,
};

/** 开发态：拉取到一行后打印实际返回的 key，用于与 Dashboard 列名对齐 */
export function logRemoteRowKeysDev(context: string, row: object | null | undefined): void {
  if (!import.meta.env.DEV || row == null) return;
  const keys = Object.keys(row);
  console.log(`[supabase] ${context} row keys:`, keys);
}
