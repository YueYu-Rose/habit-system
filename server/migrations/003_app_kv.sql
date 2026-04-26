-- Key-value store for app metadata (e.g. last successful sync timestamps)

CREATE TABLE IF NOT EXISTS app_kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
