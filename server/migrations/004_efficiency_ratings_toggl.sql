-- Subjective efficiency for unplanned Toggl rows (no calendar / match group)

CREATE TABLE IF NOT EXISTS efficiency_ratings_toggl (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  toggl_entry_id INTEGER NOT NULL UNIQUE REFERENCES toggl_entries(id) ON DELETE CASCADE,
  rating_percent INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_efficiency_ratings_toggl_entry ON efficiency_ratings_toggl(toggl_entry_id);
