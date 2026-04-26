import type { Database } from "better-sqlite3";
import type {
  ComparisonRow,
  LinkedActualEntry,
  MatchStatus,
  PlannedTaskSource,
} from "../../src/types/comparisonRow.js";
import { recomputeMatchStatus } from "./matchStatus.js";

/** Ensures every calendar event on this day has a task_match_groups row (e.g. legacy imports). */
function ensureMatchGroupsForDate(db: Database, eventDate: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO task_match_groups (calendar_event_id, match_status, created_at, updated_at)
    SELECT ce.id, 'unmatched', ?, ?
    FROM calendar_events ce
    WHERE ce.event_date = ?
    AND NOT EXISTS (SELECT 1 FROM task_match_groups mg WHERE mg.calendar_event_id = ce.id)
  `
  ).run(now, now, eventDate);
}

/**
 * Builds To Do List rows for a calendar day from SQLite (planned + unplanned toggl).
 */
export function buildTodoRowsForDate(db: Database, eventDate: string): ComparisonRow[] {
  ensureMatchGroupsForDate(db, eventDate);

  const planned = db
    .prepare(
      `
    SELECT
      ce.id AS cal_id,
      ce.external_id AS cal_external_id,
      ce.title AS cal_title,
      ce.planned_minutes,
      ce.source AS cal_source,
      mg.id AS match_group_id
    FROM calendar_events ce
    INNER JOIN task_match_groups mg ON mg.calendar_event_id = ce.id
    WHERE ce.event_date = ?
    ORDER BY ce.start_at ASC
  `
    )
    .all(eventDate) as {
    cal_id: number;
    cal_external_id: string;
    cal_title: string;
    planned_minutes: number;
    match_group_id: number;
  }[];

  const rows: ComparisonRow[] = [];

  for (const p of planned) {
    const linkedRows = db
      .prepare(
        `
      SELECT te.external_id, te.title, te.actual_minutes AS duration_minutes, te.project_name
      FROM task_match_items tmi
      INNER JOIN toggl_entries te ON te.id = tmi.toggl_entry_id
      WHERE tmi.match_group_id = ?
      ORDER BY te.start_at ASC
    `
      )
      .all(p.match_group_id) as {
      external_id: string;
      title: string;
      duration_minutes: number;
      project_name: string | null;
    }[];

    const linkedEntries: LinkedActualEntry[] = linkedRows.map((r) => ({
      togglEntryId: r.external_id,
      title: r.title,
      durationMinutes: r.duration_minutes,
      projectName: r.project_name ?? undefined,
    }));

    const actualSum = linkedEntries.reduce((s, e) => s + e.durationMinutes, 0);
    const hasLinks = linkedEntries.length > 0;
    const status = recomputeMatchStatus(db, p.match_group_id);
    const mergedStatus: MatchStatus = hasLinks ? status : "unmatched";

    const plannedSource: PlannedTaskSource =
      p.cal_source === "manual" ? "manual" : "google_calendar";

    rows.push({
      rowId: `planned-${p.match_group_id}`,
      matchGroupId: p.match_group_id,
      plannedSource,
      kind: hasLinks ? "matched" : "calendar_only",
      displayTitle: p.cal_title,
      plannedMinutes: p.planned_minutes,
      actualMinutes: hasLinks ? actualSum : null,
      timeBillMinutes: p.planned_minutes - (hasLinks ? actualSum : 0),
      googleEventId: p.cal_external_id,
      togglEntryId: linkedEntries[0]?.togglEntryId,
      linkedEntries: hasLinks ? linkedEntries : [],
      matchStatus: mergedStatus,
    });
  }

  const linkedTogglIds = new Set(
    (
      db
        .prepare(
          `
      SELECT te.external_id
      FROM task_match_items tmi
      INNER JOIN toggl_entries te ON te.id = tmi.toggl_entry_id
    `
        )
        .all() as { external_id: string }[]
    ).map((x) => x.external_id)
  );

  const allToggl = db
    .prepare(
      `SELECT external_id, title, actual_minutes, project_name FROM toggl_entries WHERE entry_date = ? ORDER BY start_at ASC`
    )
    .all(eventDate) as {
    external_id: string;
    title: string;
    actual_minutes: number;
    project_name: string | null;
  }[];

  for (const t of allToggl) {
    if (linkedTogglIds.has(t.external_id)) continue;

    rows.push({
      rowId: `toggl-${t.external_id}`,
      kind: "toggl_unplanned",
      displayTitle: t.title,
      plannedMinutes: null,
      actualMinutes: t.actual_minutes,
      timeBillMinutes: null,
      togglEntryId: t.external_id,
      matchStatus: "unmatched",
    });
  }

  return rows;
}
