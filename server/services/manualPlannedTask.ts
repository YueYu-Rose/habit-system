import { randomUUID } from "node:crypto";
import type { Database } from "better-sqlite3";

export function insertManualPlannedTask(
  db: Database,
  params: { date: string; title: string; plannedMinutes: number }
): { calendarEventId: number; matchGroupId: number } {
  const title = params.title.trim();
  if (!title) {
    throw new Error("Task name is required");
  }
  const pm = Math.round(Number(params.plannedMinutes));
  if (!Number.isFinite(pm) || pm < 1 || pm > 24 * 60) {
    throw new Error("Planned time must be between 1 and 1440 minutes");
  }

  const external_id = `manual_${randomUUID()}`;
  const now = new Date().toISOString();
  const [y, m, d] = params.date.split("-").map(Number);
  const start = new Date(y, m - 1, d, 9, 0, 0, 0);
  const end = new Date(start.getTime() + pm * 60000);

  const insertCal = db.prepare(`
    INSERT INTO calendar_events (
      external_id, title, start_at, end_at, planned_minutes, event_date, source, created_at, updated_at
    ) VALUES (
      @external_id, @title, @start_at, @end_at, @planned_minutes, @event_date, 'manual', @created_at, @updated_at
    )
  `);
  insertCal.run({
    external_id,
    title,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    planned_minutes: pm,
    event_date: params.date,
    created_at: now,
    updated_at: now,
  });

  const cal = db.prepare(`SELECT id FROM calendar_events WHERE external_id = ?`).get(external_id) as {
    id: number;
  };

  db.prepare(
    `INSERT INTO task_match_groups (calendar_event_id, match_status, created_at, updated_at) VALUES (?, 'unmatched', ?, ?)`
  ).run(cal.id, now, now);

  const mg = db.prepare(`SELECT id FROM task_match_groups WHERE calendar_event_id = ?`).get(cal.id) as {
    id: number;
  };

  return { calendarEventId: cal.id, matchGroupId: mg.id };
}
