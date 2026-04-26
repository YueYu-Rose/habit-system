import type { Database } from "better-sqlite3";

const KEY_TOGGL = "sync.toggl.last_at";
const KEY_GOOGLE = "sync.google_calendar.last_at";

export type SyncMetadataDto = {
  lastTogglSyncAt: string | null;
  lastGoogleCalendarSyncAt: string | null;
};

export function getSyncMetadata(db: Database): SyncMetadataDto {
  const toggl = db.prepare(`SELECT value FROM app_kv WHERE key = ?`).get(KEY_TOGGL) as
    | { value: string }
    | undefined;
  const google = db.prepare(`SELECT value FROM app_kv WHERE key = ?`).get(KEY_GOOGLE) as
    | { value: string }
    | undefined;
  return {
    lastTogglSyncAt: toggl?.value ?? null,
    lastGoogleCalendarSyncAt: google?.value ?? null,
  };
}

export function recordTogglSyncSuccess(db: Database): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO app_kv (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(KEY_TOGGL, now);
}

export function recordGoogleCalendarSyncSuccess(db: Database): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO app_kv (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(KEY_GOOGLE, now);
}
