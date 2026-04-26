import type { Database } from "better-sqlite3";
import type { WeeklyReportSlice } from "../../src/types/weeklyReport.js";

const PROJECT_PALETTE = [
  "#249BEB",
  "#AF99FF",
  "#E27396",
  "#2d6a4f",
  "#b45309",
  "#5578B0",
  "#9b2226",
] as const;

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hash01(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 10000) / 10000;
}

function weekDaysFromMonday(weekStart: string): string[] {
  const base = new Date(weekStart + "T12:00:00");
  const out: string[] = [];
  for (let i = 0; i < 7; i++) out.push(isoDate(addDays(base, i)));
  return out;
}

/** Sum of (planned − linked actual) per calendar row in the week, in hours. */
function totalTimeBillHoursForWeek(db: Database, days: string[]): number {
  let billMinutes = 0;
  for (const day of days) {
    const rows = db
      .prepare(
        `
      SELECT ce.planned_minutes AS planned, mg.id AS mg_id
      FROM calendar_events ce
      INNER JOIN task_match_groups mg ON mg.calendar_event_id = ce.id
      WHERE ce.event_date = ?
    `
      )
      .all(day) as { planned: number; mg_id: number }[];

    for (const r of rows) {
      const actual = db
        .prepare(
          `
        SELECT COALESCE(SUM(te.actual_minutes), 0) AS m
        FROM task_match_items tmi
        INNER JOIN toggl_entries te ON te.id = tmi.toggl_entry_id
        WHERE tmi.match_group_id = ?
      `
        )
        .get(r.mg_id) as { m: number };
      billMinutes += r.planned - actual.m;
    }
  }
  return Math.round((billMinutes / 60) * 100) / 100;
}

function buildSlice(db: Database, weekStartIso: string): WeeklyReportSlice {
  const days = weekDaysFromMonday(weekStartIso);
  const placeholders = days.map(() => "?").join(",");

  const byDay = db
    .prepare(
      `
    SELECT entry_date AS d, SUM(actual_minutes) AS m
    FROM toggl_entries
    WHERE entry_date IN (${placeholders})
    GROUP BY entry_date
  `
    )
    .all(...days) as { d: string; m: number }[];

  const dayMap = new Map(byDay.map((r) => [r.d, r.m / 60]));

  const hoursByDay = days.map((d) => ({
    date: d,
    hours: Math.round(((dayMap.get(d) ?? 0) + Number.EPSILON) * 100) / 100,
  }));

  const totalRow = db
    .prepare(
      `
    SELECT COALESCE(SUM(actual_minutes), 0) AS t
    FROM toggl_entries
    WHERE entry_date IN (${placeholders})
  `
    )
    .get(...days) as { t: number } | undefined;
  const totalMinutes = totalRow?.t ?? 0;

  const totalTrackedHours = Math.round((totalMinutes / 60) * 100) / 100;

  /** Resolve display name via toggl_projects (Track project id + workspace); fallback "(no project)". */
  const projRows = db
    .prepare(
      `
    SELECT
      COALESCE(tp.name, '(no project)') AS pname,
      SUM(te.actual_minutes) AS m
    FROM toggl_entries te
    LEFT JOIN toggl_projects tp
      ON te.workspace_id IS NOT NULL
      AND te.project_id IS NOT NULL
      AND tp.workspace_id = te.workspace_id
      AND tp.external_id = CAST(te.project_id AS TEXT)
    WHERE te.entry_date IN (${placeholders})
    GROUP BY COALESCE(tp.name, '(no project)')
    ORDER BY m DESC
  `
    )
    .all(...days) as { pname: string; m: number }[];

  const projects = projRows.map((p, i) => ({
    projectId: `p-${hash01(p.pname).toFixed(4)}`,
    name: p.pname,
    hours: Math.round((p.m / 60) * 100) / 100,
    color: PROJECT_PALETTE[i % PROJECT_PALETTE.length],
  }));

  const projSum = projects.reduce((a, p) => a + p.hours, 0);
  if (projSum > 0 && Math.abs(projSum - totalTrackedHours) > 0.05 && projects[0]) {
    projects[0] = {
      ...projects[0],
      hours: Math.round((projects[0].hours + (totalTrackedHours - projSum)) * 100) / 100,
    };
  }

  const totalTimeBillHours = totalTimeBillHoursForWeek(db, days);

  return {
    weekStart: weekStartIso,
    totalTrackedHours,
    totalTimeBillHours,
    hoursByDay,
    projects,
  };
}

export function getWeeklyReportPairFromDb(
  db: Database,
  anchorWeekStartMonday: string
): { currentWeek: WeeklyReportSlice; previousWeek: WeeklyReportSlice } {
  const anchor = new Date(anchorWeekStartMonday + "T12:00:00");
  const prevMonday = addDays(anchor, -7);
  const prevIso = isoDate(prevMonday);

  return {
    currentWeek: buildSlice(db, anchorWeekStartMonday),
    previousWeek: buildSlice(db, prevIso),
  };
}
