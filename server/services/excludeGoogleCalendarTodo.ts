import type { Database } from "better-sqlite3";

/**
 * Persist exclusion by Google event id, then delete local `calendar_events` row (CASCADE removes match groups).
 * Future `syncGoogleCalendarRange` skips these external_ids so the event does not reappear.
 */
export function excludeGoogleCalendarImportByExternalId(db: Database, externalId: string): void {
  const trimmed = externalId.trim();
  if (!trimmed) {
    throw new Error("externalId is required");
  }

  const row = db
    .prepare(`SELECT id FROM calendar_events WHERE external_id = ? AND source = 'google_calendar'`)
    .get(trimmed) as { id: number } | undefined;

  if (!row) {
    throw new Error("Google Calendar import not found for this external id");
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT OR REPLACE INTO google_calendar_todo_exclusions (external_id, created_at) VALUES (?, ?)`
    ).run(trimmed, now);
    const mg = db
      .prepare(`SELECT id FROM task_match_groups WHERE calendar_event_id = ?`)
      .get(row.id) as { id: number } | undefined;
    if (mg) {
      db.prepare(`DELETE FROM todo_completion WHERE match_group_id = ?`).run(mg.id);
    }
    db.prepare(`DELETE FROM calendar_events WHERE id = ?`).run(row.id);
  });
  tx();
}
