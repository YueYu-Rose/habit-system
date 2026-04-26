-- Local-only exclusions: Google Calendar event IDs never shown again in To Do after user removes them.
-- Does not delete events in Google Calendar; sync skips these external_ids on future imports.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS google_calendar_todo_exclusions (
  external_id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL
);
