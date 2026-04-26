/**
 * 外部英文 To-do List 接入层（占位 + 未来扩展）
 *
 * 推荐联动方式（按优先级）：
 * 1. **共享只读 API**：英文站暴露 GET /api/todo/day?date=…（或专用 /api/export/day），本系统用 HABIT_TODO_API_BASE 拉取 rows + completedByRowId，计算完成率。
 * 2. **共享 SQLite 文件**：两进程读同一 app.db（需注意锁与路径），仅适合本机。
 * 3. **定时导出 JSON**：英文站 cron 写出文件，本系统读文件导入 external_todo_snapshots。
 *
 * V1：manual / placeholder 模式；可 POST 手动录入完成率用于联调。
 */

import type { Database } from "better-sqlite3";
import { replaceOrInsertLedger } from "./pointsService.js";
import { scoreExternalTodoRate } from "./scoring.js";

export type ExternalTodoConfig = {
  mode: "placeholder" | "manual" | "http";
  baseUrl: string | null;
};

export function getExternalTodoConfig(db: Database): ExternalTodoConfig {
  const row = db.prepare(`SELECT mode, base_url FROM external_todo_config WHERE id = 1`).get() as {
    mode: string;
    base_url: string | null;
  };
  return {
    mode: (row.mode as ExternalTodoConfig["mode"]) ?? "placeholder",
    baseUrl: row.base_url,
  };
}

/** 占位：返回 null；未来在此 fetch 英文站 API */
export async function fetchExternalTodoCompletionRate(_date: string): Promise<{
  total: number;
  completed: number;
  rate: number;
} | null> {
  return null;
}

/** 将快照写入 DB 并记一笔积分（同一天幂等 source_key） */
export function applySnapshotAndScore(
  db: Database,
  date: string,
  total: number,
  completed: number,
  raw?: Record<string, unknown>
): { rate: number; points: number } {
  if (total <= 0) {
    throw new Error("总任务数须大于 0");
  }
  const rate = completed / total;
  const points = scoreExternalTodoRate(rate);
  const key = `${date}:external_todo_rate`;

  db.prepare(
    `
    INSERT INTO external_todo_snapshots (date, total_tasks, completed_tasks, completion_rate, raw_json, fetched_at, points_ledger_key)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      total_tasks = excluded.total_tasks,
      completed_tasks = excluded.completed_tasks,
      completion_rate = excluded.completion_rate,
      raw_json = excluded.raw_json,
      fetched_at = excluded.fetched_at,
      points_ledger_key = excluded.points_ledger_key
  `
  ).run(
    date,
    total,
    completed,
    rate,
    raw ? JSON.stringify(raw) : null,
    new Date().toISOString(),
    key
  );

  replaceOrInsertLedger(db, {
    habitDate: date,
    sourceKey: key,
    amount: points,
    title: `外部 To-do 完成率 ${Math.round(rate * 100)}%`,
    sourceType: "external_todo",
    meta: { total, completed, rate },
  });

  return { rate, points };
}
