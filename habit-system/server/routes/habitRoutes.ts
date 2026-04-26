import express from "express";
import type { Database } from "better-sqlite3";
import { getHabitDb } from "../db.js";
import { addDaysIso, mondayOfWeekContaining, sundayOfWeekContaining } from "../lib/dateIso.js";
import { getBalances, replaceOrInsertLedger, deleteLedgerByKey } from "../services/pointsService.js";
import {
  scoreEarlySleep,
  scoreEarlyWake,
  scoreSleepDuration,
  scoreShower,
  scoreExercise,
} from "../services/scoring.js";
import {
  applySnapshotAndScore,
  getExternalTodoConfig,
  fetchExternalTodoCompletionRate,
} from "../services/externalTodoAdapter.js";
import {
  completePhaseTask,
  penalizePhaseTask,
  completeCustomTask,
  penalizeCustomTask,
} from "../services/taskCompletion.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function db(): Database {
  return getHabitDb();
}

function ensureDaily(d: Database, date: string): void {
  const now = new Date().toISOString();
  d.prepare(
    `
    INSERT INTO habit_daily (date, updated_at) VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET updated_at = excluded.updated_at
  `
  ).run(date, now);
}

export function createHabitRouter(): express.Router {
  const r = express.Router();

  r.get("/summary", (req, res) => {
    const date = String(req.query.date ?? "");
    if (!DATE_RE.test(date)) {
      res.status(400).json({ error: "需要 date=YYYY-MM-DD" });
      return;
    }
    try {
      const database = db();
      const bal = getBalances(database);
      const w0 = mondayOfWeekContaining(date);
      const w1 = sundayOfWeekContaining(date);
      const weekNet = (
        database
          .prepare(
            `SELECT COALESCE(SUM(amount), 0) AS s FROM point_ledger WHERE habit_date >= ? AND habit_date <= ?`
          )
          .get(w0, w1) as { s: number }
      ).s;

      const yesterday = addDaysIso(date, -1);
      const yRow = database
        .prepare(`SELECT sleep_started_at FROM habit_daily WHERE date = ?`)
        .get(yesterday) as { sleep_started_at: string | null } | undefined;
      const tRow = database
        .prepare(`SELECT wake_at, sleep_started_at FROM habit_daily WHERE date = ?`)
        .get(date) as { wake_at: string | null; sleep_started_at: string | null } | undefined;

      let sleepHours: number | null = null;
      if (yRow?.sleep_started_at && tRow?.wake_at) {
        sleepHours =
          (new Date(tRow.wake_at).getTime() - new Date(yRow.sleep_started_at).getTime()) / 3600000;
      }

      const daily = database
        .prepare(`SELECT * FROM habit_daily WHERE date = ?`)
        .get(date) as Record<string, unknown> | undefined;

      const reminders: string[] = [];
      const neg = database
        .prepare(
          `SELECT title, amount FROM point_ledger WHERE habit_date = ? AND amount < 0 ORDER BY id DESC`
        )
        .all(date) as { title: string; amount: number }[];
      for (const x of neg) reminders.push(`${x.title}（${x.amount}）`);

      const mainline = database
        .prepare(`SELECT id, title, progress_percent, note FROM mainline_goals ORDER BY sort_order LIMIT 1`)
        .get() as { id: number; title: string; progress_percent: number; note: string | null } | undefined;

      const ext = getExternalTodoConfig(database);
      const snap = database
        .prepare(`SELECT completion_rate FROM external_todo_snapshots WHERE date = ?`)
        .get(date) as { completion_rate: number } | undefined;

      res.json({
        date,
        availablePoints: bal.available,
        lifetimePoints: bal.lifetime,
        weekNetPoints: weekNet,
        lastNightSleepAt: yRow?.sleep_started_at ?? null,
        todayWakeAt: tRow?.wake_at ?? null,
        lastNightSleepHours: sleepHours,
        habitDaily: daily ?? null,
        deductionReminders: reminders,
        mainline: mainline ?? null,
        externalTodo: {
          mode: ext.mode,
          completionRate: snap?.completion_rate ?? null,
        },
      });
    } catch (e) {
      console.error("[habit/summary]", e);
      res.status(500).json({ error: String(e) });
    }
  });

  r.get("/balances", (_req, res) => {
    res.json(getBalances(db()));
  });

  r.get("/ledger", (req, res) => {
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      res.status(400).json({ error: "from / to 需要 YYYY-MM-DD" });
      return;
    }
    const rows = db()
      .prepare(
        `SELECT * FROM point_ledger WHERE habit_date >= ? AND habit_date <= ? ORDER BY created_at DESC LIMIT 500`
      )
      .all(from, to);
    res.json({ rows });
  });

  r.get("/redemptions", (_req, res) => {
    const rows = db()
      .prepare(
        `
      SELECT rr.id, rr.cost_points, rr.redeemed_at, rr.note, rc.title, rc.tier
      FROM reward_redemptions rr
      INNER JOIN rewards_catalog rc ON rc.id = rr.reward_id
      ORDER BY rr.redeemed_at DESC
      LIMIT 200
    `
      )
      .all();
    res.json({ rows });
  });

  r.get("/rewards", (_req, res) => {
    const rows = db()
      .prepare(`SELECT id, tier, title, cost_points FROM rewards_catalog ORDER BY sort_order, id`)
      .all();
    res.json({ rows });
  });

  r.post("/rewards", (req, res) => {
    const b = req.body as { title?: unknown; cost_points?: unknown; tier?: unknown; sort_order?: unknown };
    const title = String(b.title ?? "").trim();
    const cost = Number(b.cost_points);
    const tier = String(b.tier ?? "即时奖励").trim() || "即时奖励";
    if (!title) {
      res.status(400).json({ error: "需要 title" });
      return;
    }
    if (!Number.isFinite(cost) || cost <= 0 || cost % 5 !== 0) {
      res.status(400).json({ error: "消耗积分需为 5 的正整数倍" });
      return;
    }
    try {
      const database = db();
      const m = database.prepare(`SELECT MAX(sort_order) as x FROM rewards_catalog`).get() as { x: number | null } | undefined;
      const nextOrder = (m?.x ?? 0) + 1;
      const r2 = database
        .prepare(`INSERT INTO rewards_catalog (tier, title, cost_points, sort_order) VALUES (?, ?, ?, ?)`)
        .run(tier, title, cost, b.sort_order != null ? Number(b.sort_order) : nextOrder);
      res.json({ ok: true, id: Number(r2.lastInsertRowid) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  r.patch("/rewards/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "id 无效" });
      return;
    }
    const b = req.body as { title?: unknown; cost_points?: unknown; tier?: unknown; sort_order?: unknown };
    try {
      const database = db();
      const row = database.prepare(`SELECT * FROM rewards_catalog WHERE id = ?`).get(id) as
        | { id: number; tier: string; title: string; cost_points: number; sort_order: number }
        | undefined;
      if (!row) {
        res.status(404).json({ error: "奖励不存在" });
        return;
      }
      const nextTitle = b.title != null ? String(b.title).trim() : row.title;
      if (!nextTitle) {
        res.status(400).json({ error: "title 不能为空" });
        return;
      }
      const nextCost = b.cost_points != null ? Number(b.cost_points) : row.cost_points;
      if (!Number.isFinite(nextCost) || nextCost <= 0 || nextCost % 5 !== 0) {
        res.status(400).json({ error: "消耗积分需为 5 的正整数倍" });
        return;
      }
      const nextTier = b.tier != null ? String(b.tier).trim() : row.tier;
      const nextSo = b.sort_order != null ? Number(b.sort_order) : row.sort_order;
      database
        .prepare(`UPDATE rewards_catalog SET tier = ?, title = ?, cost_points = ?, sort_order = ? WHERE id = ?`)
        .run(nextTier || "即时奖励", nextTitle, nextCost, nextSo, id);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  r.delete("/rewards/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "id 无效" });
      return;
    }
    try {
      const database = db();
      const ex = database.prepare(`SELECT id FROM rewards_catalog WHERE id = ?`).get(id) as { id: number } | undefined;
      if (!ex) {
        res.status(404).json({ error: "奖励不存在" });
        return;
      }
      database.prepare(`DELETE FROM reward_redemptions WHERE reward_id = ?`).run(id);
      database.prepare(`DELETE FROM rewards_catalog WHERE id = ?`).run(id);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  r.post("/redeem", (req, res) => {
    const { rewardId } = req.body as { rewardId?: unknown };
    const rid = Number(rewardId);
    if (!Number.isInteger(rid)) {
      res.status(400).json({ error: "rewardId 无效" });
      return;
    }
    try {
      const database = db();
      const rw = database.prepare(`SELECT id, title, cost_points FROM rewards_catalog WHERE id = ?`).get(rid) as
        | { id: number; title: string; cost_points: number }
        | undefined;
      if (!rw) {
        res.status(404).json({ error: "奖励不存在" });
        return;
      }
      const bal = getBalances(database);
      if (bal.available < rw.cost_points) {
        res.status(400).json({ error: "可用积分不足" });
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      const key = `${date}:redeem:${rid}:${Date.now()}`;
      replaceOrInsertLedger(database, {
        habitDate: date,
        sourceKey: key,
        amount: -rw.cost_points,
        title: `兑换：${rw.title}`,
        sourceType: "redeem",
        redeemOnly: true,
      });
      database
        .prepare(`INSERT INTO reward_redemptions (reward_id, cost_points, redeemed_at) VALUES (?, ?, ?)`)
        .run(rid, rw.cost_points, new Date().toISOString());
      res.json({ ok: true, balances: getBalances(database) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  /** 开始睡觉 */
  r.post("/daily/:date/sleep-start", (req, res) => {
    const { date } = req.params;
    const { at } = req.body as { at?: string };
    if (!DATE_RE.test(date) || !at) {
      res.status(400).json({ error: "需要合法 date 与 at(ISO)" });
      return;
    }
    try {
      const database = db();
      ensureDaily(database, date);
      database.prepare(`UPDATE habit_daily SET sleep_started_at = ?, updated_at = ? WHERE date = ?`).run(
        at,
        new Date().toISOString(),
        date
      );
      const pts = scoreEarlySleep(at);
      replaceOrInsertLedger(database, {
        habitDate: date,
        sourceKey: `${date}:early_sleep`,
        amount: pts,
        title: `早睡打卡`,
        sourceType: "auto",
        meta: { at, points: pts },
      });
      res.json({ ok: true, points: pts, balances: getBalances(database) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  /** 起床 */
  r.post("/daily/:date/wake", (req, res) => {
    const { date } = req.params;
    const { at } = req.body as { at?: string };
    if (!DATE_RE.test(date) || !at) {
      res.status(400).json({ error: "需要合法 date 与 at(ISO)" });
      return;
    }
    try {
      const database = db();
      ensureDaily(database, date);
      database.prepare(`UPDATE habit_daily SET wake_at = ?, updated_at = ? WHERE date = ?`).run(
        at,
        new Date().toISOString(),
        date
      );
      const pts = scoreEarlyWake(at);
      replaceOrInsertLedger(database, {
        habitDate: date,
        sourceKey: `${date}:early_wake`,
        amount: pts,
        title: `早起打卡`,
        sourceType: "auto",
        meta: { at, points: pts },
      });

      const y = addDaysIso(date, -1);
      const sRow = database.prepare(`SELECT sleep_started_at FROM habit_daily WHERE date = ?`).get(y) as
        | { sleep_started_at: string | null }
        | undefined;
      if (sRow?.sleep_started_at) {
        const hrs = (new Date(at).getTime() - new Date(sRow.sleep_started_at).getTime()) / 3600000;
        const dpts = scoreSleepDuration(hrs);
        replaceOrInsertLedger(database, {
          habitDate: date,
          sourceKey: `${date}:sleep_duration`,
          amount: dpts,
          title: `睡眠时长（约 ${hrs.toFixed(1)} 小时）`,
          sourceType: "auto",
          meta: { hours: hrs, points: dpts },
        });
      }

      res.json({ ok: true, points: pts, balances: getBalances(database) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  /** 洗澡 */
  r.post("/daily/:date/shower", (req, res) => {
    const { date } = req.params;
    const { at } = req.body as { at?: string };
    const when = at ?? new Date().toISOString();
    if (!DATE_RE.test(date)) {
      res.status(400).json({ error: "date 无效" });
      return;
    }
    try {
      const database = db();
      ensureDaily(database, date);
      database.prepare(`UPDATE habit_daily SET shower_at = ?, updated_at = ? WHERE date = ?`).run(
        when,
        new Date().toISOString(),
        date
      );
      const pts = scoreShower(when);
      replaceOrInsertLedger(database, {
        habitDate: date,
        sourceKey: `${date}:shower`,
        amount: pts,
        title: `洗澡打卡`,
        sourceType: "auto",
        meta: { at: when, points: pts },
      });
      res.json({ ok: true, points: pts, balances: getBalances(database) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  r.post("/daily/:date/english", (req, res) => {
    const { date } = req.params;
    const { done } = req.body as { done?: boolean };
    if (!DATE_RE.test(date) || typeof done !== "boolean") {
      res.status(400).json({ error: "需要 done: boolean" });
      return;
    }
    try {
      const database = db();
      ensureDaily(database, date);
      database.prepare(`UPDATE habit_daily SET english_done = ?, updated_at = ? WHERE date = ?`).run(
        done ? 1 : 0,
        new Date().toISOString(),
        date
      );
      const pts = done ? 10 : -10;
      replaceOrInsertLedger(database, {
        habitDate: date,
        sourceKey: `${date}:english`,
        amount: pts,
        title: done ? `英语口语（完成）` : `英语口语（未完成）`,
        sourceType: "manual",
      });
      res.json({ ok: true, points: pts, balances: getBalances(database) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  r.post("/daily/:date/cantonese", (req, res) => {
    const { date } = req.params;
    const { done } = req.body as { done?: boolean };
    if (!DATE_RE.test(date) || typeof done !== "boolean") {
      res.status(400).json({ error: "需要 done: boolean" });
      return;
    }
    try {
      const database = db();
      ensureDaily(database, date);
      database.prepare(`UPDATE habit_daily SET cantonese_done = ?, updated_at = ? WHERE date = ?`).run(
        done ? 1 : 0,
        new Date().toISOString(),
        date
      );
      const pts = done ? 10 : -10;
      replaceOrInsertLedger(database, {
        habitDate: date,
        sourceKey: `${date}:cantonese`,
        amount: pts,
        title: done ? `粤语 / 多邻国（完成）` : `粤语 / 多邻国（未完成）`,
        sourceType: "manual",
      });
      res.json({ ok: true, points: pts, balances: getBalances(database) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  r.post("/daily/:date/exercise", (req, res) => {
    const { date } = req.params;
    const { minutes, done } = req.body as { minutes?: unknown; done?: unknown };
    if (!DATE_RE.test(date)) {
      res.status(400).json({ error: "date 无效" });
      return;
    }
    const m = Math.max(0, Number(minutes) || 0);
    const d = Boolean(done);
    try {
      const database = db();
      ensureDaily(database, date);
      database
        .prepare(`UPDATE habit_daily SET exercise_done = ?, exercise_minutes = ?, updated_at = ? WHERE date = ?`)
        .run(d ? 1 : 0, m, new Date().toISOString(), date);
      if (!d || m <= 0) {
        deleteLedgerByKey(database, date, `${date}:exercise`);
        res.json({ ok: true, points: 0, balances: getBalances(database) });
        return;
      }
      const pts = scoreExercise(m);
      if (pts === 0) {
        deleteLedgerByKey(database, date, `${date}:exercise`);
        res.json({ ok: true, points: 0, balances: getBalances(database) });
        return;
      }
      replaceOrInsertLedger(database, {
        habitDate: date,
        sourceKey: `${date}:exercise`,
        amount: pts,
        title: `运动 ${m} 分钟`,
        sourceType: "manual",
        meta: { minutes: m },
      });
      res.json({ ok: true, points: pts, balances: getBalances(database) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  r.post("/daily/:date/leave", (req, res) => {
    const { date } = req.params;
    const { at } = req.body as { at?: string };
    if (!DATE_RE.test(date)) {
      res.status(400).json({ error: "date 无效" });
      return;
    }
    const when = at ?? new Date().toISOString();
    const database = db();
    ensureDaily(database, date);
    database.prepare(`UPDATE habit_daily SET left_home_at = ?, updated_at = ? WHERE date = ?`).run(
      when,
      new Date().toISOString(),
      date
    );
    res.json({ ok: true });
  });

  r.post("/daily/:date/poop", (req, res) => {
    const { date } = req.params;
    const { yes } = req.body as { yes?: boolean };
    if (!DATE_RE.test(date) || typeof yes !== "boolean") {
      res.status(400).json({ error: "需要 yes: boolean" });
      return;
    }
    const database = db();
    ensureDaily(database, date);
    database.prepare(`UPDATE habit_daily SET poop_yes = ?, updated_at = ? WHERE date = ?`).run(
      yes ? 1 : 0,
      new Date().toISOString(),
      date
    );
    res.json({ ok: true });
  });

  /** 每日结算：汇总流水并写入 daily_settlements；口语/粤语若当日未手动记过分则可在此补扣（V1 简化：仅写汇总） */
  r.post("/settle/:date", (req, res) => {
    const { date } = req.params;
    if (!DATE_RE.test(date)) {
      res.status(400).json({ error: "date 无效" });
      return;
    }
    try {
      const database = db();
      const gained = (
        database
          .prepare(`SELECT COALESCE(SUM(amount), 0) AS s FROM point_ledger WHERE habit_date = ? AND amount > 0`)
          .get(date) as { s: number }
      ).s;
      const lost = (
        database
          .prepare(`SELECT COALESCE(SUM(amount), 0) AS s FROM point_ledger WHERE habit_date = ? AND amount < 0`)
          .get(date) as { s: number }
      ).s;
      const net = gained + lost;
      const bal = getBalances(database);
      const now = new Date().toISOString();
      database
        .prepare(
          `
        INSERT INTO daily_settlements (date, total_gained, total_lost, net_points, available_after, lifetime_after, settled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          total_gained = excluded.total_gained,
          total_lost = excluded.total_lost,
          net_points = excluded.net_points,
          available_after = excluded.available_after,
          lifetime_after = excluded.lifetime_after,
          settled_at = excluded.settled_at
      `
        )
        .run(date, gained, lost, net, bal.available, bal.lifetime, now);
      res.json({
        ok: true,
        settlement: { date, total_gained: gained, total_lost: lost, net_points: net, available_after: bal.available, lifetime_after: bal.lifetime },
      });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  /** 外部 To-do：手动录入完成率（占位联调用） */
  r.post("/external-todo/snapshot", (req, res) => {
    const { date, total, completed } = req.body as { date?: string; total?: unknown; completed?: unknown };
    if (!date || !DATE_RE.test(date)) {
      res.status(400).json({ error: "需要 date" });
      return;
    }
    const t = Number(total);
    const c = Number(completed);
    if (!Number.isFinite(t) || !Number.isFinite(c)) {
      res.status(400).json({ error: "需要 total, completed" });
      return;
    }
    try {
      const out = applySnapshotAndScore(db(), date, t, c);
      res.json({ ok: true, ...out, balances: getBalances(db()) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  r.get("/external-todo/status", (_req, res) => {
    res.json({ ...getExternalTodoConfig(db()), hint: fetchExternalTodoCompletionRate.name + " 为未来 HTTP 拉取预留" });
  });

  /** 阶段任务 */
  r.get("/phase-tasks", (_req, res) => {
    res.json({ rows: db().prepare(`SELECT * FROM phase_tasks ORDER BY (due_date IS NULL), due_date, id`).all() });
  });

  r.post("/phase-tasks", (req, res) => {
    const b = req.body as Record<string, unknown>;
    const now = new Date().toISOString();
    try {
      const r2 = db()
        .prepare(
          `
        INSERT INTO phase_tasks (name, domain, due_date, points, is_mandatory, penalty_if_incomplete, note, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `
        )
        .run(
          String(b.name ?? ""),
          String(b.domain ?? ""),
          b.due_date ? String(b.due_date) : null,
          Number(b.points) || 0,
          b.is_mandatory ? 1 : 0,
          Number(b.penalty_if_incomplete) || 0,
          b.note ? String(b.note) : null,
          now,
          now
        );
      res.json({ ok: true, id: Number(r2.lastInsertRowid) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  /** 自定义任务 */
  r.get("/custom-tasks", (_req, res) => {
    res.json({ rows: db().prepare(`SELECT * FROM custom_tasks ORDER BY id DESC`).all() });
  });

  r.post("/custom-tasks", (req, res) => {
    const b = req.body as Record<string, unknown>;
    const now = new Date().toISOString();
    try {
      const r2 = db()
        .prepare(
          `
        INSERT INTO custom_tasks (name, task_type, points, due_at, penalty_if_incomplete, note, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `
        )
        .run(
          String(b.name ?? ""),
          String(b.task_type ?? "bonus"),
          Number(b.points) || 0,
          b.due_at ? String(b.due_at) : null,
          Number(b.penalty_if_incomplete) || 0,
          b.note ? String(b.note) : null,
          now,
          now
        );
      res.json({ ok: true, id: Number(r2.lastInsertRowid) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  r.post("/phase-tasks/:id/complete", (req, res) => {
    const id = Number(req.params.id);
    const habitDate = String((req.body as { habitDate?: string })?.habitDate ?? "");
    if (!Number.isInteger(id) || !DATE_RE.test(habitDate)) {
      res.status(400).json({ error: "需要合法 id 与 body.habitDate=YYYY-MM-DD" });
      return;
    }
    try {
      const out = completePhaseTask(db(), id, habitDate);
      res.json({ ok: true, points: out.points, balances: getBalances(db()) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  r.post("/phase-tasks/:id/penalty", (req, res) => {
    const id = Number(req.params.id);
    const habitDate = String((req.body as { habitDate?: string })?.habitDate ?? "");
    if (!Number.isInteger(id) || !DATE_RE.test(habitDate)) {
      res.status(400).json({ error: "需要合法 id 与 body.habitDate=YYYY-MM-DD" });
      return;
    }
    try {
      const out = penalizePhaseTask(db(), id, habitDate);
      res.json({ ok: true, points: out.points, balances: getBalances(db()) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  r.post("/custom-tasks/:id/complete", (req, res) => {
    const id = Number(req.params.id);
    const habitDate = String((req.body as { habitDate?: string })?.habitDate ?? "");
    if (!Number.isInteger(id) || !DATE_RE.test(habitDate)) {
      res.status(400).json({ error: "需要合法 id 与 body.habitDate=YYYY-MM-DD" });
      return;
    }
    try {
      const out = completeCustomTask(db(), id, habitDate);
      res.json({ ok: true, points: out.points, balances: getBalances(db()) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  r.post("/custom-tasks/:id/penalty", (req, res) => {
    const id = Number(req.params.id);
    const habitDate = String((req.body as { habitDate?: string })?.habitDate ?? "");
    if (!Number.isInteger(id) || !DATE_RE.test(habitDate)) {
      res.status(400).json({ error: "需要合法 id 与 body.habitDate=YYYY-MM-DD" });
      return;
    }
    try {
      const out = penalizeCustomTask(db(), id, habitDate);
      res.json({ ok: true, points: out.points, balances: getBalances(db()) });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  r.patch("/mainline/:id", (req, res) => {
    const id = Number(req.params.id);
    const { progress_percent, note, title } = req.body as Record<string, unknown>;
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "id 无效" });
      return;
    }
    const now = new Date().toISOString();
    db().prepare(`UPDATE mainline_goals SET progress_percent = COALESCE(?, progress_percent), note = COALESCE(?, note), title = COALESCE(?, title), updated_at = ? WHERE id = ?`).run(
      progress_percent != null ? Number(progress_percent) : null,
      note != null ? String(note) : null,
      title != null ? String(title) : null,
      now,
      id
    );
    res.json({ ok: true });
  });

  return r;
}
