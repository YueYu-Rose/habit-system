import type { Database } from "better-sqlite3";
import { addDaysToIsoDate } from "../lib/calendarDate.js";
import { insertManualPlannedTask } from "./manualPlannedTask.js";

export type MovePlannedToNextDayResult = {
  nextDate: string;
  removedFromCurrentDay: boolean;
};

/**
 * Moves a planned To Do to the next calendar day as a new manual `calendar_events` row.
 * - `manual`: deletes the current calendar row (CASCADE clears match group, links, efficiency).
 * - `google_calendar`: does not delete the imported row; only inserts a manual copy on the next day.
 */
export function movePlannedToNextDay(
  db: Database,
  matchGroupId: number,
  params: { title: string; plannedMinutes: number }
): MovePlannedToNextDayResult {
  const row = db
    .prepare(
      `
    SELECT ce.id AS ce_id, ce.event_date, ce.source
    FROM task_match_groups mg
    INNER JOIN calendar_events ce ON ce.id = mg.calendar_event_id
    WHERE mg.id = ?
  `
    )
    .get(matchGroupId) as { ce_id: number; event_date: string; source: string } | undefined;

  if (!row) {
    throw new Error("Task not found");
  }

  const title = params.title.trim();
  const pm = Math.round(Number(params.plannedMinutes));
  if (!title) {
    throw new Error("Task name is required");
  }
  if (!Number.isFinite(pm) || pm < 1 || pm > 24 * 60) {
    throw new Error("Planned time must be between 1 and 1440 minutes");
  }

  const nextDate = addDaysToIsoDate(row.event_date, 1);
  const isManual = row.source === "manual";

  const tx = db.transaction(() => {
    if (isManual) {
      db.prepare(`DELETE FROM calendar_events WHERE id = ?`).run(row.ce_id);
    }
    insertManualPlannedTask(db, { date: nextDate, title, plannedMinutes: pm });
  });
  tx();

  return { nextDate, removedFromCurrentDay: isManual };
}
