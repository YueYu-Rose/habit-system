import type { Database } from "better-sqlite3";
import { calendarDateInTimeZone, resolveTogglCalendarTimeZone } from "../lib/calendarDate.js";
import { fetchTogglProjects, fetchTogglTimeEntries } from "./togglClient.js";

function minutesFromDuration(
  durationSec: number,
  stop: string | null,
  startIso: string
): number {
  if (durationSec > 0) return Math.round(durationSec / 60);
  if (!stop) {
    const start = new Date(startIso).getTime();
    return Math.max(0, Math.round((Date.now() - start) / 60000));
  }
  return 0;
}

const upsertProject = `
INSERT INTO toggl_projects (external_id, workspace_id, name, created_at, updated_at)
VALUES (@external_id, @workspace_id, @name, @now, @now)
ON CONFLICT(workspace_id, external_id) DO UPDATE SET
  name = excluded.name,
  updated_at = excluded.updated_at
`;

const upsertEntry = `
INSERT INTO toggl_entries (
  external_id, title, project_name, workspace_id, project_id,
  start_at, end_at, actual_minutes, entry_date, source, created_at, updated_at
) VALUES (
  @external_id, @title, @project_name, @workspace_id, @project_id,
  @start_at, @end_at, @actual_minutes, @entry_date, 'toggl', @created_at, @updated_at
)
ON CONFLICT(external_id) DO UPDATE SET
  title = excluded.title,
  project_name = excluded.project_name,
  workspace_id = excluded.workspace_id,
  project_id = excluded.project_id,
  start_at = excluded.start_at,
  end_at = excluded.end_at,
  actual_minutes = excluded.actual_minutes,
  entry_date = excluded.entry_date,
  updated_at = excluded.updated_at
`;

export type TogglSyncResult = {
  upserted: number;
  projectsUpserted: number;
  range: { start: string; end: string };
};

/** GET /api/v9/me/projects — upsert local toggl_projects for name resolution. */
export async function syncTogglProjects(db: Database, apiToken: string): Promise<number> {
  const projects = await fetchTogglProjects(apiToken);
  const now = new Date().toISOString();
  const stmt = db.prepare(upsertProject);
  const tx = db.transaction(() => {
    for (const p of projects) {
      stmt.run({
        external_id: String(p.id),
        workspace_id: p.workspace_id,
        name: (p.name ?? "").trim() || "(no name)",
        now,
      });
    }
  });
  tx();
  return projects.length;
}

export type TogglSyncOptions = {
  /** IANA zone from browser (Import button) so entry_date matches To Do "today". */
  clientTimeZone?: string | null;
};

export async function syncTogglRange(
  db: Database,
  apiToken: string,
  startDate: string,
  endDate: string,
  options?: TogglSyncOptions
): Promise<TogglSyncResult> {
  const calendarTz = resolveTogglCalendarTimeZone(options?.clientTimeZone);
  let projectsUpserted = 0;
  try {
    projectsUpserted = await syncTogglProjects(db, apiToken);
  } catch (e) {
    console.error("[sync/toggl] Projects import failed; time entries will still sync. Error:", e);
  }

  const entries = await fetchTogglTimeEntries(apiToken, startDate, endDate);
  const nowIso = new Date().toISOString();
  const localToday = calendarDateInTimeZone(nowIso, calendarTz);
  const runningEntries = entries.filter((e) => e.stop == null);
  const byLocalDate = new Map<string, number>();
  for (const e of entries) {
    const ed = calendarDateInTimeZone(e.start, calendarTz);
    byLocalDate.set(ed, (byLocalDate.get(ed) ?? 0) + 1);
  }
  const sortedDates = [...byLocalDate.keys()].sort();
  console.log(
    "[sync/toggl] imported calendar range (logical):",
    startDate,
    "→",
    endDate,
    "| calendar TZ:",
    calendarTz,
    "| local_today:",
    localToday,
    "| API rows:",
    entries.length,
    "| running (stop=null):",
    runningEntries.length
  );
  console.log("[sync/toggl] entry_date distribution (from start → local TZ):", Object.fromEntries(byLocalDate));
  if (sortedDates.length > 0) {
    console.log("[sync/toggl] distinct local entry_dates in this fetch:", sortedDates.join(", "));
  }

  const todayFromApi = entries.filter((e) => calendarDateInTimeZone(e.start, calendarTz) === localToday);
  if (todayFromApi.length > 0) {
    const s = todayFromApi[0];
    console.log(
      "[sync/toggl] sample TODAY (local) entry — id:",
      s.id,
      "start:",
      s.start,
      "stop:",
      s.stop ?? "null",
      "duration_sec:",
      s.duration,
      "mapped entry_date:",
      calendarDateInTimeZone(s.start, calendarTz),
      "running:",
      s.stop == null
    );
  } else {
    console.log(
      "[sync/toggl] no API rows with start mapped to local_today=",
      localToday,
      "(today's timers may be missing from API response, or map to another local date — see distribution)"
    );
  }

  let zeroActualWithStop = 0;
  for (const e of entries) {
    const mins = minutesFromDuration(e.duration, e.stop, e.start);
    if (mins === 0 && e.stop != null) zeroActualWithStop += 1;
  }
  if (zeroActualWithStop > 0) {
    console.log(
      "[sync/toggl] warning:",
      zeroActualWithStop,
      "entries have stop set but computed actual_minutes=0 (check duration)"
    );
  }

  const now = nowIso;
  const stmt = db.prepare(upsertEntry);
  const lookupName = db.prepare(
    `SELECT name FROM toggl_projects WHERE workspace_id = ? AND external_id = ?`
  );

  const tx = db.transaction(() => {
    for (const e of entries) {
      const external_id = String(e.id);
      const title = (e.description ?? "").trim() || "Unnamed Task";
      const start_at = e.start;
      const end_at = e.stop ?? e.start;
      const actual_minutes = minutesFromDuration(e.duration, e.stop, e.start);
      const entry_date = calendarDateInTimeZone(e.start, calendarTz);
      const workspace_id = e.workspace_id ?? null;
      const project_id = e.project_id ?? null;

      let project_name: string | null = null;
      if (workspace_id != null && project_id != null) {
        const row = lookupName.get(workspace_id, String(project_id)) as { name: string } | undefined;
        project_name = row?.name ?? null;
      }

      stmt.run({
        external_id,
        title,
        project_name,
        workspace_id,
        project_id,
        start_at,
        end_at,
        actual_minutes,
        entry_date,
        created_at: now,
        updated_at: now,
      });
    }
  });
  tx();

  const storedToday = db
    .prepare(`SELECT COUNT(*) AS c FROM toggl_entries WHERE entry_date = ?`)
    .get(localToday) as { c: number };
  console.log("[sync/toggl] toggl_entries_for_day after upsert —", localToday, "→ count:", storedToday.c);

  if (entries.length > 0) {
    const sample = entries.slice(0, 3).map((e) => ({
      id: e.id,
      start: e.start,
      entry_date: calendarDateInTimeZone(e.start, calendarTz),
    }));
    console.log("[sync/toggl] sample entry_date mapping (first 3 API rows):", JSON.stringify(sample));
  }

  return {
    upserted: entries.length,
    projectsUpserted,
    range: { start: startDate, end: endDate },
  };
}
