import type { Database } from "better-sqlite3";

/**
 * Updates `calendar_events` for a planned row (manual or Google-imported).
 * Local To Do override — next Google sync may overwrite imported rows by `external_id` upsert.
 */
export function updatePlannedTaskByMatchGroup(
  db: Database,
  matchGroupId: number,
  params: { title: string; plannedMinutes: number }
): void {
  const title = params.title.trim();
  if (!title) {
    throw new Error("Task name is required");
  }
  const pm = Math.round(Number(params.plannedMinutes));
  if (!Number.isFinite(pm) || pm < 1 || pm > 24 * 60) {
    throw new Error("Planned time must be between 1 and 1440 minutes");
  }

  const row = db
    .prepare(
      `
    SELECT mg.calendar_event_id AS ce_id, ce.event_date
    FROM task_match_groups mg
    INNER JOIN calendar_events ce ON ce.id = mg.calendar_event_id
    WHERE mg.id = ?
  `
    )
    .get(matchGroupId) as { ce_id: number; event_date: string } | undefined;

  if (!row) {
    throw new Error("Task not found");
  }

  const [y, mo, d] = row.event_date.split("-").map(Number);
  const start = new Date(y, mo - 1, d, 9, 0, 0, 0);
  const end = new Date(start.getTime() + pm * 60000);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE calendar_events SET title = ?, planned_minutes = ?, start_at = ?, end_at = ?, updated_at = ? WHERE id = ?`
  ).run(title, pm, start.toISOString(), end.toISOString(), now, row.ce_id);
}
