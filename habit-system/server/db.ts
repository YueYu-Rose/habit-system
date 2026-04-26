import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getHabitDbPath(): string {
  const fromEnv = process.env.HABIT_SQLITE_PATH;
  const root = path.resolve(__dirname, "..");
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.join(root, fromEnv);
  return path.join(root, "data", "habit.db");
}

export function openHabitDatabase(): Database.Database {
  const dbPath = getHabitDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function runHabitMigrations(db: Database.Database): void {
  const m1 = path.join(__dirname, "migrations", "001_habit_init.sql");
  if (!fs.existsSync(m1)) throw new Error(`Missing migration: ${m1}`);
  db.exec(fs.readFileSync(m1, "utf8"));
  seedRewards(db);
  seedMainlinePlaceholder(db);
}

function seedRewards(db: Database.Database): void {
  const n = db.prepare(`SELECT COUNT(*) AS c FROM rewards_catalog`).get() as { c: number };
  if (n.c > 0) return;

  const rows: { tier: string; title: string; cost: number; sort: number }[] = [
    { tier: "即时奖励", title: "一杯喜欢的饮料", cost: 20, sort: 1 },
    { tier: "即时奖励", title: "一份小零食", cost: 20, sort: 2 },
    { tier: "即时奖励", title: "看一集轻松内容", cost: 20, sort: 3 },
    { tier: "即时奖励", title: "30 分钟无负担休息", cost: 20, sort: 4 },
    { tier: "即时奖励", title: "一次小甜品", cost: 20, sort: 5 },
    { tier: "即时奖励", title: "一顿普通但喜欢的小吃", cost: 20, sort: 6 },
    { tier: "恢复配额", title: "一顿喜欢的饭", cost: 50, sort: 10 },
    { tier: "恢复配额", title: "一次比较放松的娱乐活动", cost: 50, sort: 11 },
    { tier: "恢复配额", title: "购买心愿单上低于 200 RMB 的东西", cost: 50, sort: 12 },
    { tier: "升级奖励", title: "购买心愿单上低于 500 RMB 的东西", cost: 100, sort: 20 },
    { tier: "升级奖励", title: "一次专门出去放松 / 逛街", cost: 100, sort: 21 },
    { tier: "升级奖励", title: "吃一顿更满意的饭", cost: 100, sort: 22 },
    { tier: "主线兑现", title: "愿望清单中的一项正式兑现", cost: 500, sort: 30 },
    { tier: "主线兑现", title: "某次旅行基金的一部分", cost: 500, sort: 31 },
    { tier: "主线兑现", title: "某个长期想买的物品预算", cost: 500, sort: 32 },
    { tier: "主线兑现", title: "一个有仪式感的重要奖励", cost: 500, sort: 33 },
  ];

  const ins = db.prepare(
    `INSERT INTO rewards_catalog (tier, title, cost_points, sort_order) VALUES (?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    for (const r of rows) ins.run(r.tier, r.title, r.cost, r.sort);
  });
  tx();
}

function seedMainlinePlaceholder(db: Database.Database): void {
  const n = db.prepare(`SELECT COUNT(*) AS c FROM mainline_goals`).get() as { c: number };
  if (n.c > 0) return;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO mainline_goals (title, progress_percent, note, sort_order, updated_at) VALUES (?,?,?,?,?)`
  ).run("（V1 占位）长期主线目标", 0, "在后续版本细化里程碑", 0, now);
}

let singleton: Database.Database | null = null;

export function getHabitDb(): Database.Database {
  if (!singleton) {
    const dbPath = getHabitDbPath();
    console.log("[habit-db] Opening:", dbPath);
    singleton = openHabitDatabase();
    runHabitMigrations(singleton);
  }
  return singleton;
}
