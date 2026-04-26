-- Persistent To Do checkbox completion (planned rows + unplanned Toggl rows)

CREATE TABLE IF NOT EXISTS todo_completion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_group_id INTEGER REFERENCES task_match_groups(id) ON DELETE CASCADE,
  toggl_entry_id INTEGER REFERENCES toggl_entries(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL,
  CHECK (
    (match_group_id IS NOT NULL AND toggl_entry_id IS NULL) OR
    (match_group_id IS NULL AND toggl_entry_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_todo_completion_match_group
  ON todo_completion(match_group_id) WHERE match_group_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_todo_completion_toggl_entry
  ON todo_completion(toggl_entry_id) WHERE toggl_entry_id IS NOT NULL;
