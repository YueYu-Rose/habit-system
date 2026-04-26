-- toggl_projects table (entry columns added programmatically in db.ts — SQLite cannot IF NOT EXISTS for ADD COLUMN)

CREATE TABLE IF NOT EXISTS toggl_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL,
  workspace_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_toggl_projects_workspace ON toggl_projects(workspace_id);
