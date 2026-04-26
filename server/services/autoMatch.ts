import type { Database } from "better-sqlite3";
import { normalizeMatchKey, resolveMatchKey } from "../lib/normalizeMatch.js";
import { persistMatchStatus } from "./matchStatus.js";

/** Conservative: normalized equality already handled; one full string contains the other (min length 3). */
function titlesMatchConservative(calTitle: string, togglTitle: string): boolean {
  const a = normalizeMatchKey(calTitle);
  const b = normalizeMatchKey(togglTitle);
  if (a.length < 3 || b.length < 3) return false;
  return a.includes(b) || b.includes(a);
}

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as < be && bs < ae;
}

/**
 * Conservative auto-match: same calendar day, normalized title equality, time range overlap.
 * Skips Toggl rows already linked to any match group.
 */
export function runAutoMatchForDate(db: Database, eventDate: string): number {
  const calendars = db
    .prepare(
      `
    SELECT ce.title, ce.start_at, ce.end_at, mg.id AS match_group_id
    FROM calendar_events ce
    INNER JOIN task_match_groups mg ON mg.calendar_event_id = ce.id
    WHERE ce.event_date = ?
  `
    )
    .all(eventDate) as {
    title: string;
    start_at: string;
    end_at: string;
    match_group_id: number;
  }[];

  const togglRows = db
    .prepare(
      `SELECT id, title, start_at, end_at FROM toggl_entries WHERE entry_date = ?`
    )
    .all(eventDate) as {
    id: number;
    title: string;
    start_at: string;
    end_at: string;
  }[];

  const linkedTogglInternalIds = new Set(
    (db.prepare(`SELECT toggl_entry_id FROM task_match_items`).all() as { toggl_entry_id: number }[]).map(
      (x) => x.toggl_entry_id
    )
  );

  let inserted = 0;
  const insert = db.prepare(`
    INSERT INTO task_match_items (match_group_id, toggl_entry_id, link_type, created_at)
    VALUES (?, ?, 'auto', ?)
  `);
  const now = new Date().toISOString();
  const affected = new Set<number>();

  for (const cal of calendars) {
    const keyCal = resolveMatchKey(undefined, cal.title);
    for (const te of togglRows) {
      if (linkedTogglInternalIds.has(te.id)) continue;
      const keyT = resolveMatchKey(undefined, te.title);
      const exact = keyCal === keyT;
      const similar = !exact && titlesMatchConservative(cal.title, te.title);
      if (!exact && !similar) continue;
      if (!overlaps(cal.start_at, cal.end_at, te.start_at, te.end_at)) continue;

      try {
        insert.run(cal.match_group_id, te.id, now);
        linkedTogglInternalIds.add(te.id);
        affected.add(cal.match_group_id);
        inserted += 1;
      } catch {
        /* UNIQUE */
      }
    }
  }

  for (const gid of affected) {
    persistMatchStatus(db, gid);
  }

  return inserted;
}

export function runAutoMatchForDateRange(
  db: Database,
  startDate: string,
  endDate: string
): number {
  let n = 0;
  const cur = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    n += runAutoMatchForDate(db, `${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}
