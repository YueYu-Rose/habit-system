PRAGMA foreign_keys = ON;

-- 单行积分状态
CREATE TABLE IF NOT EXISTS points_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  available_points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO points_state (id, available_points, lifetime_points, updated_at)
VALUES (1, 0, 0, datetime('now'));

-- 每日习惯原始记录（YYYY-MM-DD，本地日）
CREATE TABLE IF NOT EXISTS habit_daily (
  date TEXT PRIMARY KEY,
  sleep_started_at TEXT,
  wake_at TEXT,
  shower_at TEXT,
  left_home_at TEXT,
  poop_yes INTEGER,
  exercise_done INTEGER NOT NULL DEFAULT 0,
  exercise_minutes INTEGER NOT NULL DEFAULT 0,
  english_done INTEGER NOT NULL DEFAULT 0,
  cantonese_done INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- 积分流水：所有分值均为 5 的倍数
CREATE TABLE IF NOT EXISTS point_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  amount INTEGER NOT NULL,
  delta_available INTEGER NOT NULL,
  delta_lifetime INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  title TEXT NOT NULL,
  meta_json TEXT,
  UNIQUE (habit_date, source_key)
);

CREATE INDEX IF NOT EXISTS idx_ledger_date ON point_ledger(habit_date);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON point_ledger(created_at);

-- 每日结算汇总
CREATE TABLE IF NOT EXISTS daily_settlements (
  date TEXT PRIMARY KEY,
  total_gained INTEGER NOT NULL DEFAULT 0,
  total_lost INTEGER NOT NULL DEFAULT 0,
  net_points INTEGER NOT NULL DEFAULT 0,
  available_after INTEGER NOT NULL,
  lifetime_after INTEGER NOT NULL,
  settled_at TEXT NOT NULL
);

-- 奖励目录（种子数据由应用插入）
CREATE TABLE IF NOT EXISTS rewards_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tier TEXT NOT NULL,
  title TEXT NOT NULL,
  cost_points INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reward_id INTEGER NOT NULL REFERENCES rewards_catalog(id),
  cost_points INTEGER NOT NULL,
  redeemed_at TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS phase_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  due_date TEXT,
  points INTEGER NOT NULL,
  is_mandatory INTEGER NOT NULL DEFAULT 0,
  penalty_if_incomplete INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  points INTEGER NOT NULL,
  due_at TEXT,
  penalty_if_incomplete INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mainline_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- 外部 To-do 接入：快照 + 配置占位
CREATE TABLE IF NOT EXISTS external_todo_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mode TEXT NOT NULL DEFAULT 'placeholder',
  base_url TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO external_todo_config (id, mode, updated_at)
VALUES (1, 'placeholder', datetime('now'));

CREATE TABLE IF NOT EXISTS external_todo_snapshots (
  date TEXT PRIMARY KEY,
  total_tasks INTEGER NOT NULL,
  completed_tasks INTEGER NOT NULL,
  completion_rate REAL NOT NULL,
  raw_json TEXT,
  fetched_at TEXT NOT NULL,
  points_ledger_key TEXT
);
