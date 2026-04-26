-- Productivity app local SQLite schema

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  planned_minutes INTEGER NOT NULL,
  event_date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'google_calendar',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);

CREATE TABLE IF NOT EXISTS toggl_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  project_name TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  actual_minutes INTEGER NOT NULL,
  entry_date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'toggl',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_toggl_entries_date ON toggl_entries(entry_date);

CREATE TABLE IF NOT EXISTS task_match_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calendar_event_id INTEGER UNIQUE REFERENCES calendar_events(id) ON DELETE CASCADE,
  match_status TEXT NOT NULL DEFAULT 'unmatched',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_match_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_group_id INTEGER NOT NULL REFERENCES task_match_groups(id) ON DELETE CASCADE,
  toggl_entry_id INTEGER NOT NULL REFERENCES toggl_entries(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  UNIQUE(match_group_id, toggl_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_task_match_items_toggl ON task_match_items(toggl_entry_id);

CREATE TABLE IF NOT EXISTS efficiency_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_group_id INTEGER NOT NULL UNIQUE REFERENCES task_match_groups(id) ON DELETE CASCADE,
  rating_percent INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
