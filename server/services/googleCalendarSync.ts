import type { Database } from "better-sqlite3";
import {
  getGoogleOAuthRedirectUri,
  getGoogleOAuthCredentials,
  GOOGLE_INVALID_GRANT_HINT,
} from "../config/googleOAuth.js";

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function isGoogleInvalidGrant(err: unknown): boolean {
  if (err && typeof err === "object") {
    const g = err as { message?: string; response?: { data?: { error?: string } } };
    if (g.response?.data?.error === "invalid_grant") return true;
    if (typeof g.message === "string" && g.message.includes("invalid_grant")) return true;
  }
  return false;
}

const upsertCal = `
INSERT INTO calendar_events (
  external_id, title, start_at, end_at, planned_minutes, event_date, source, created_at, updated_at
) VALUES (
  @external_id, @title, @start_at, @end_at, @planned_minutes, @event_date, 'google_calendar', @created_at, @updated_at
)
ON CONFLICT(external_id) DO UPDATE SET
  title = excluded.title,
  start_at = excluded.start_at,
  end_at = excluded.end_at,
  planned_minutes = excluded.planned_minutes,
  event_date = excluded.event_date,
  updated_at = excluded.updated_at
`;

const insertGroup = `
INSERT INTO task_match_groups (calendar_event_id, match_status, created_at, updated_at)
SELECT @cal_id, 'unmatched', @now, @now
WHERE NOT EXISTS (SELECT 1 FROM task_match_groups WHERE calendar_event_id = @cal_id)
`;

export type GoogleSyncResult = {
  upserted: number;
  range: { start: string; end: string };
};

export async function syncGoogleCalendarRange(
  db: Database,
  timeMinIso: string,
  timeMaxIso: string
): Promise<GoogleSyncResult> {
  console.log("[sync/google-calendar] range", timeMinIso, "→", timeMaxIso);

  const { clientId, clientSecret, refreshToken } = getGoogleOAuthCredentials();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN in environment"
    );
  }

  const { google } = await import("googleapis");

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, getGoogleOAuthRedirectUri());
  oauth2.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  let res;
  try {
    res = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 2500,
  });
  } catch (e: unknown) {
    if (isGoogleInvalidGrant(e)) {
      throw new Error(`invalid_grant: ${GOOGLE_INVALID_GRANT_HINT}`);
    }
    throw e;
  }

  const items = res.data.items ?? [];
  const now = new Date().toISOString();
  const upsertStmt = db.prepare(upsertCal);
  const groupStmt = db.prepare(insertGroup);
  const excludedStmt = db.prepare(
    `SELECT 1 AS x FROM google_calendar_todo_exclusions WHERE external_id = ?`
  );

  let upserted = 0;

  const tx = db.transaction(() => {
    for (const ev of items) {
      if (!ev.id) continue;
      if (excludedStmt.get(ev.id)) {
        continue;
      }
      const start = ev.start?.dateTime ?? ev.start?.date;
      const end = ev.end?.dateTime ?? ev.end?.date;
      if (!start || !end) continue;

      // TODO: all-day events use `date` only; parsing can shift `event_date` vs local TZ — refine if needed.
      const startD = new Date(start);
      const endD = new Date(end);
      const planned_minutes = minutesBetween(startD, endD);
      const event_date = isoLocal(startD);
      const title = (ev.summary ?? "").trim() || "Unnamed Task";

      upsertStmt.run({
        external_id: ev.id,
        title,
        start_at: startD.toISOString(),
        end_at: endD.toISOString(),
        planned_minutes,
        event_date,
        created_at: now,
        updated_at: now,
      });

      const row = db
        .prepare(`SELECT id FROM calendar_events WHERE external_id = ?`)
        .get(ev.id) as { id: number } | undefined;
      if (row) {
        groupStmt.run({ cal_id: row.id, now });
        upserted += 1;
      }
    }
  });
  tx();

  console.log("[sync/google-calendar] imported", upserted, "events");
  return { upserted, range: { start: timeMinIso, end: timeMaxIso } };
}
