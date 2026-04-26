import type { Database } from "better-sqlite3";
import { replaceOrInsertLedger } from "./pointsService.js";

function assertDate(d: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("habitDate 须为 YYYY-MM-DD");
}

function normalizePoints5(n: number): number {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) throw new Error("分值无效");
  const r = Math.round(x / 5) * 5;
  if (r === 0) throw new Error("分值须为非零的 5 的倍数");
  return r;
}

export function completePhaseTask(db: Database, id: number, habitDate: string): { points: number } {
  assertDate(habitDate);
  const task = db.prepare(`SELECT id, name, points, status FROM phase_tasks WHERE id = ?`).get(id) as
    | { id: number; name: string; points: number; status: string }
    | undefined;
  if (!task) throw new Error("阶段任务不存在");
  if (task.status !== "active") throw new Error("任务已结束，无法重复完成");

  const pts = normalizePoints5(task.points);
  const sourceKey = `${habitDate}:phase:${id}:complete`;
  const dup = db.prepare(`SELECT 1 FROM point_ledger WHERE habit_date = ? AND source_key = ?`).get(habitDate, sourceKey);
  if (dup) throw new Error("该任务已在该日记过分");

  replaceOrInsertLedger(db, {
    habitDate,
    sourceKey,
    amount: pts,
    title: `阶段任务完成：${task.name}`,
    sourceType: "manual",
    meta: { phaseTaskId: id },
  });

  const now = new Date().toISOString();
  db.prepare(`UPDATE phase_tasks SET status = 'done', updated_at = ? WHERE id = ?`).run(now, id);
  return { points: pts };
}

export function penalizePhaseTask(db: Database, id: number, habitDate: string): { points: number } {
  assertDate(habitDate);
  const task = db
    .prepare(`SELECT id, name, penalty_if_incomplete, status FROM phase_tasks WHERE id = ?`)
    .get(id) as { id: number; name: string; penalty_if_incomplete: number; status: string } | undefined;
  if (!task) throw new Error("阶段任务不存在");
  if (task.status !== "active") throw new Error("仅能对进行中的任务扣分");

  let pen = Number(task.penalty_if_incomplete);
  if (!Number.isFinite(pen) || pen <= 0) throw new Error("未设置未完成扣分或扣分为 0");
  pen = normalizePoints5(pen);

  const sourceKey = `${habitDate}:phase:${id}:penalty`;
  const dup = db.prepare(`SELECT 1 FROM point_ledger WHERE habit_date = ? AND source_key = ?`).get(habitDate, sourceKey);
  if (dup) throw new Error("该任务已在该日扣过分");

  replaceOrInsertLedger(db, {
    habitDate,
    sourceKey,
    amount: -Math.abs(pen),
    title: `阶段任务未完成：${task.name}`,
    sourceType: "manual",
    meta: { phaseTaskId: id },
  });

  const now = new Date().toISOString();
  db.prepare(`UPDATE phase_tasks SET status = 'failed', updated_at = ? WHERE id = ?`).run(now, id);
  return { points: -Math.abs(pen) };
}

export function completeCustomTask(db: Database, id: number, habitDate: string): { points: number } {
  assertDate(habitDate);
  const task = db.prepare(`SELECT id, name, points, status FROM custom_tasks WHERE id = ?`).get(id) as
    | { id: number; name: string; points: number; status: string }
    | undefined;
  if (!task) throw new Error("自定义任务不存在");
  if (task.status !== "active") throw new Error("任务已结束");

  const pts = normalizePoints5(task.points);
  const sourceKey = `${habitDate}:custom:${id}:complete`;
  const dup = db.prepare(`SELECT 1 FROM point_ledger WHERE habit_date = ? AND source_key = ?`).get(habitDate, sourceKey);
  if (dup) throw new Error("该任务已在该日记过分");

  replaceOrInsertLedger(db, {
    habitDate,
    sourceKey,
    amount: pts,
    title: `自定义任务完成：${task.name}`,
    sourceType: "manual",
    meta: { customTaskId: id },
  });

  const now = new Date().toISOString();
  db.prepare(`UPDATE custom_tasks SET status = 'done', updated_at = ? WHERE id = ?`).run(now, id);
  return { points: pts };
}

export function penalizeCustomTask(db: Database, id: number, habitDate: string): { points: number } {
  assertDate(habitDate);
  const task = db
    .prepare(`SELECT id, name, penalty_if_incomplete, status FROM custom_tasks WHERE id = ?`)
    .get(id) as { id: number; name: string; penalty_if_incomplete: number; status: string } | undefined;
  if (!task) throw new Error("自定义任务不存在");
  if (task.status !== "active") throw new Error("仅能对进行中的任务扣分");

  let pen = Number(task.penalty_if_incomplete);
  if (!Number.isFinite(pen) || pen <= 0) throw new Error("未设置未完成扣分");
  pen = normalizePoints5(pen);

  const sourceKey = `${habitDate}:custom:${id}:penalty`;
  const dup = db.prepare(`SELECT 1 FROM point_ledger WHERE habit_date = ? AND source_key = ?`).get(habitDate, sourceKey);
  if (dup) throw new Error("该任务已在该日扣过分");

  replaceOrInsertLedger(db, {
    habitDate,
    sourceKey,
    amount: -Math.abs(pen),
    title: `自定义任务未完成：${task.name}`,
    sourceType: "manual",
    meta: { customTaskId: id },
  });

  const now = new Date().toISOString();
  db.prepare(`UPDATE custom_tasks SET status = 'failed', updated_at = ? WHERE id = ?`).run(now, id);
  return { points: -Math.abs(pen) };
}
