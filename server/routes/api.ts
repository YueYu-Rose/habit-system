/**
 * API routes: no static import of Google Calendar / googleapis — those load only inside
 * POST /api/sync/google-calendar via dynamic import().
 */
import express from "express";
import { getDb, getDbPath, verifySchema, tableExists } from "../db.js";
import { syncTogglRange } from "../services/togglSync.js";
import { buildTodoRowsForDate } from "../services/todoRows.js";
import { getWeeklyReportPairFromDb } from "../services/reportWeek.js";
import { runAutoMatchForDateRange } from "../services/autoMatch.js";
import { persistMatchStatus } from "../services/matchStatus.js";
import { calendarDateInTimeZone, resolveTogglCalendarTimeZone } from "../lib/calendarDate.js";
import {
  getSyncMetadata,
  recordGoogleCalendarSyncSuccess,
  recordTogglSyncSuccess,
} from "../services/syncMetadata.js";
import { insertManualPlannedTask } from "../services/manualPlannedTask.js";
import { updatePlannedTaskByMatchGroup } from "../services/updatePlannedTask.js";
import { movePlannedToNextDay } from "../services/movePlannedToNextDay.js";
import { getCompletedByRowId, setTodoCompletion } from "../services/todoCompletion.js";
import { excludeGoogleCalendarImportByExternalId } from "../services/excludeGoogleCalendarTodo.js";

type TogglCatalogDto = {
  togglEntryId: string;
  description: string;
  durationMinutes: number;
  startDateTime: string;
  projectName?: string;
};

export function createApiRouter(): express.Router {
  const router = express.Router();

  const isDev = process.env.NODE_ENV !== "production";

  router.get("/health", (_req, res) => {
    try {
      const db = getDb();
      const v = verifySchema(db);
      const togglEntriesTable = tableExists(db, "toggl_entries");
      const togglProjectsTable = tableExists(db, "toggl_projects");
      const calendarEventsTable = tableExists(db, "calendar_events");
      res.json({
        ok: true,
        dbPath: getDbPath(),
        schemaOk: v.ok,
        missingTables: v.missing.length ? v.missing : undefined,
        toggl_entries: togglEntriesTable,
        toggl_projects: togglProjectsTable,
        calendar_events: calendarEventsTable,
      });
    } catch (e) {
      console.error("[health] DB init failed:", e);
      if (e instanceof Error && e.stack) console.error(e.stack);
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        ...(isDev && { detail: String(e) }),
      });
    }
  });

  router.get("/report/week", (req, res) => {
    const weekStart = req.query.weekStart as string;
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      res.status(400).json({ error: "Invalid weekStart (YYYY-MM-DD)" });
      return;
    }
    try {
      const db = getDb();
      const pair = getWeeklyReportPairFromDb(db, weekStart);
      const syncMeta = getSyncMetadata(db);
      res.json({ ...pair, syncMeta });
    } catch (e) {
      console.error("[report/week] failed:", e);
      if (e instanceof Error && e.stack) console.error(e.stack);
      res.status(500).json({
        error: "Report query failed",
        message: e instanceof Error ? e.message : String(e),
        ...(isDev && { stack: e instanceof Error ? e.stack : undefined }),
      });
    }
  });

  router.get("/todo/day", (req, res) => {
    const date = req.query.date as string;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "Invalid date (YYYY-MM-DD)" });
      return;
    }
    try {
      const db = getDb();
      const rows = buildTodoRowsForDate(db, date);
      const efficiencyByRowId: Record<string, number> = {};
      for (const r of rows) {
        if (r.matchGroupId != null) {
          const row = db
            .prepare(`SELECT rating_percent FROM efficiency_ratings WHERE match_group_id = ?`)
            .get(r.matchGroupId) as { rating_percent: number } | undefined;
          if (row) efficiencyByRowId[r.rowId] = row.rating_percent;
        } else if (r.kind === "toggl_unplanned" && r.togglEntryId) {
          const row = db
            .prepare(
              `
            SELECT er.rating_percent
            FROM efficiency_ratings_toggl er
            INNER JOIN toggl_entries te ON te.id = er.toggl_entry_id
            WHERE te.external_id = ?
          `
            )
            .get(r.togglEntryId) as { rating_percent: number } | undefined;
          if (row) efficiencyByRowId[r.rowId] = row.rating_percent;
        }
      }

      const togglRows = db
        .prepare(
          `SELECT external_id, title, actual_minutes, start_at, project_name FROM toggl_entries WHERE entry_date = ? ORDER BY start_at ASC`
        )
        .all(date) as {
        external_id: string;
        title: string;
        actual_minutes: number;
        start_at: string;
        project_name: string | null;
      }[];

      const togglCatalog: TogglCatalogDto[] = togglRows.map((t) => ({
        togglEntryId: t.external_id,
        description: t.title,
        durationMinutes: t.actual_minutes,
        startDateTime: t.start_at,
        projectName: t.project_name ?? undefined,
      }));

      const syncMeta = getSyncMetadata(db);

      const togglCountRow = db
        .prepare(`SELECT COUNT(*) AS c FROM toggl_entries WHERE entry_date = ?`)
        .get(date) as { c: number };
      const plannedCount = rows.filter((r) => r.kind !== "toggl_unplanned").length;
      const unplannedCount = rows.filter((r) => r.kind === "toggl_unplanned").length;
      const clientTzHeader = String(req.headers["x-client-timezone"] ?? "").trim();
      const serverTz = resolveTogglCalendarTimeZone(null);
      const serverToday = calendarDateInTimeZone(new Date().toISOString(), serverTz);
      const clientToday = clientTzHeader
        ? calendarDateInTimeZone(new Date().toISOString(), clientTzHeader)
        : "";
      const countForClientToday =
        clientTzHeader.length > 0
          ? (
              db
                .prepare(`SELECT COUNT(*) AS c FROM toggl_entries WHERE entry_date = ?`)
                .get(clientToday) as { c: number }
            ).c
          : null;
      const dateVsClientToday =
        clientToday && date !== clientToday
          ? ` MISMATCH: selected=${date} vs client_calendar_today=${clientToday}`
          : "";
      console.log(
        `[todo/day] selectedDate=${date} toggl_entries_for_day=${togglCountRow.c} planned_rows=${plannedCount} unplanned_rows=${unplannedCount} X-Client-Timezone=${clientTzHeader || "n/a"} serverTz=${serverTz} serverToday=${serverToday}` +
          (clientToday ? ` clientToday=${clientToday}` : "") +
          (countForClientToday != null ? ` toggl_entries_for_client_today=${countForClientToday}` : "") +
          dateVsClientToday
      );
      if (togglCountRow.c === 0) {
        const recent = db
          .prepare(
            `SELECT DISTINCT entry_date FROM toggl_entries ORDER BY entry_date DESC LIMIT 8`
          )
          .all() as { entry_date: string }[];
        if (recent.length > 0) {
          console.log(
            "[todo/day] no entries for selected date; recent entry_dates in DB:",
            recent.map((r) => r.entry_date).join(", ")
          );
        } else {
          console.log("[todo/day] toggl_entries is empty — run Import Toggl (last 8 days)");
        }
        if (clientToday && date === clientToday) {
          const latest = db
            .prepare(
              `SELECT external_id, entry_date, start_at, actual_minutes FROM toggl_entries ORDER BY updated_at DESC LIMIT 1`
            )
            .get() as
            | {
                external_id: string;
                entry_date: string;
                start_at: string;
                actual_minutes: number;
              }
            | undefined;
          if (latest) {
            console.log(
              "[todo/day] latest toggl row in DB (any date):",
              `entry_date=${latest.entry_date}`,
              `start_at=${latest.start_at}`,
              `actual_minutes=${latest.actual_minutes}`,
              `external_id=${latest.external_id}`
            );
          }
        }
      }

      const completedByRowId = getCompletedByRowId(db, rows);
      const completedKeys = Object.keys(completedByRowId);
      console.log(
        "[todo/day] completedByRowId",
        completedKeys.length ? completedKeys.join(",") : "(none)",
        "map:",
        JSON.stringify(completedByRowId)
      );

      res.json({ date, rows, efficiencyByRowId, completedByRowId, togglCatalog, syncMeta });
    } catch (e) {
      console.error("[todo/day] failed:", e);
      if (e instanceof Error && e.stack) console.error(e.stack);
      res.status(500).json({
        error: "To Do day query failed",
        message: e instanceof Error ? e.message : String(e),
        ...(isDev && { stack: e instanceof Error ? e.stack : undefined }),
      });
    }
  });

  router.put("/todo/completion", (req, res) => {
    const { matchGroupId, togglExternalId, completed } = req.body as {
      matchGroupId?: unknown;
      togglExternalId?: unknown;
      completed?: unknown;
    };
    if (typeof completed !== "boolean") {
      res.status(400).json({ error: "completed (boolean) required" });
      return;
    }
    const mgNum = matchGroupId != null ? Number(matchGroupId) : NaN;
    const hasMg = Number.isFinite(mgNum) && Number.isInteger(mgNum);
    const extRaw = togglExternalId != null ? String(togglExternalId).trim() : "";
    const hasToggl = extRaw.length > 0;
    if (hasMg === hasToggl) {
      res.status(400).json({ error: "Exactly one of matchGroupId or togglExternalId is required" });
      return;
    }
    try {
      const db = getDb();
      console.log(
        "[todo/completion] PUT",
        hasMg ? `matchGroupId=${mgNum}` : `togglExternalId=${extRaw}`,
        `completed=${completed}`
      );
      if (hasMg) {
        setTodoCompletion(db, { matchGroupId: mgNum, completed });
      } else {
        setTodoCompletion(db, { togglExternalId: extRaw, completed });
      }
      const verify = hasMg
        ? (db.prepare(`SELECT match_group_id, completed_at FROM todo_completion WHERE match_group_id = ?`).get(mgNum) as
            | { match_group_id: number; completed_at: string }
            | undefined)
        : (() => {
            const te = db.prepare(`SELECT id FROM toggl_entries WHERE external_id = ?`).get(extRaw) as
              | { id: number }
              | undefined;
            if (!te) return undefined;
            return db
              .prepare(`SELECT toggl_entry_id, completed_at FROM todo_completion WHERE toggl_entry_id = ?`)
              .get(te.id) as { toggl_entry_id: number; completed_at: string } | undefined;
          })();
      console.log(
        "[todo/completion] DB row after write:",
        completed ? (verify ? JSON.stringify(verify) : "MISSING (expected row for completed=true)") : "cleared"
      );
      res.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[todo/completion] failed:", msg);
      res.status(400).json({ error: msg });
    }
  });

  router.put("/todo/efficiency", (req, res) => {
    const { matchGroupId, togglExternalId, ratingPercent } = req.body as {
      matchGroupId?: number;
      togglExternalId?: string;
      ratingPercent?: number;
    };
    if (ratingPercent == null) {
      res.status(400).json({ error: "ratingPercent required" });
      return;
    }
    const hasGroup = matchGroupId != null;
    const hasToggl = togglExternalId != null && String(togglExternalId).length > 0;
    if (hasGroup === hasToggl) {
      res.status(400).json({ error: "Exactly one of matchGroupId or togglExternalId is required" });
      return;
    }

    const db = getDb();
    const now = new Date().toISOString();

    if (hasGroup) {
      const existing = db
        .prepare(`SELECT id FROM efficiency_ratings WHERE match_group_id = ?`)
        .get(matchGroupId) as { id: number } | undefined;
      if (existing) {
        db.prepare(`UPDATE efficiency_ratings SET rating_percent = ?, updated_at = ? WHERE match_group_id = ?`).run(
          ratingPercent,
          now,
          matchGroupId
        );
      } else {
        db.prepare(
          `INSERT INTO efficiency_ratings (match_group_id, rating_percent, created_at, updated_at) VALUES (?,?,?,?)`
        ).run(matchGroupId, ratingPercent, now, now);
      }
    } else {
      const te = db.prepare(`SELECT id FROM toggl_entries WHERE external_id = ?`).get(String(togglExternalId)) as
        | { id: number }
        | undefined;
      if (!te) {
        res.status(404).json({ error: "Toggl entry not found" });
        return;
      }
      const existing = db
        .prepare(`SELECT id FROM efficiency_ratings_toggl WHERE toggl_entry_id = ?`)
        .get(te.id) as { id: number } | undefined;
      if (existing) {
        db.prepare(`UPDATE efficiency_ratings_toggl SET rating_percent = ?, updated_at = ? WHERE toggl_entry_id = ?`).run(
          ratingPercent,
          now,
          te.id
        );
      } else {
        db.prepare(
          `INSERT INTO efficiency_ratings_toggl (toggl_entry_id, rating_percent, created_at, updated_at) VALUES (?,?,?,?)`
        ).run(te.id, ratingPercent, now, now);
      }
    }

    res.json({ ok: true });
  });

  router.post("/todo/link", (req, res) => {
    const { matchGroupId, togglExternalIds } = req.body as {
      matchGroupId?: number;
      togglExternalIds?: string[];
    };
    if (matchGroupId == null || !Array.isArray(togglExternalIds)) {
      res.status(400).json({ error: "matchGroupId and togglExternalIds required" });
      return;
    }
    const db = getDb();
    const now = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO task_match_items (match_group_id, toggl_entry_id, link_type, created_at)
      VALUES (?, ?, 'manual', ?)
    `);

    try {
      const run = db.transaction(() => {
        for (const ext of togglExternalIds) {
          const te = db.prepare(`SELECT id FROM toggl_entries WHERE external_id = ?`).get(ext) as
            | { id: number }
            | undefined;
          if (!te) continue;
          const other = db
            .prepare(`SELECT match_group_id FROM task_match_items WHERE toggl_entry_id = ?`)
            .get(te.id) as { match_group_id: number } | undefined;
          if (other && other.match_group_id !== matchGroupId) {
            const err = new Error(`Conflict: "${ext}" is already linked to another task`);
            (err as Error & { code?: string }).code = "LINK_CONFLICT";
            throw err;
          }
          if (other && other.match_group_id === matchGroupId) continue;
          insert.run(matchGroupId, te.id, now);
        }
        persistMatchStatus(db, matchGroupId);
      });
      run();
      res.json({ ok: true });
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "LINK_CONFLICT") {
        res.status(409).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/todo/unlink", (req, res) => {
    const { matchGroupId, togglExternalId } = req.body as {
      matchGroupId?: number;
      togglExternalId?: string;
    };
    if (matchGroupId == null || !togglExternalId) {
      res.status(400).json({ error: "matchGroupId and togglExternalId required" });
      return;
    }
    const db = getDb();
    const te = db.prepare(`SELECT id FROM toggl_entries WHERE external_id = ?`).get(togglExternalId) as
      | { id: number }
      | undefined;
    if (!te) {
      res.status(404).json({ error: "Toggl entry not found" });
      return;
    }
    db.prepare(
      `DELETE FROM task_match_items WHERE match_group_id = ? AND toggl_entry_id = ?`
    ).run(matchGroupId, te.id);
    persistMatchStatus(db, matchGroupId);
    res.json({ ok: true });
  });

  /** Manual planned task for selected day — stored as calendar_events + task_match_groups (source=manual). */
  router.post("/todo/manual-planned", (req, res) => {
    const { date, title, plannedMinutes } = req.body as {
      date?: string;
      title?: string;
      plannedMinutes?: unknown;
    };
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "Invalid date (YYYY-MM-DD)" });
      return;
    }
    const pm = Number(plannedMinutes);
    try {
      const db = getDb();
      const created = insertManualPlannedTask(db, {
        date,
        title: title ?? "",
        plannedMinutes: pm,
      });
      res.json({ ok: true, ...created });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: msg });
    }
  });

  /** Move planned task to next calendar day (new manual row); see movePlannedToNextDay. */
  router.post("/todo/planned-task/move-next-day", (req, res) => {
    const { matchGroupId, title, plannedMinutes } = req.body as {
      matchGroupId?: unknown;
      title?: string;
      plannedMinutes?: unknown;
    };
    const mgId = Number(matchGroupId);
    if (!Number.isFinite(mgId) || !Number.isInteger(mgId)) {
      res.status(400).json({ error: "matchGroupId required" });
      return;
    }
    try {
      const db = getDb();
      const result = movePlannedToNextDay(db, mgId, {
        title: title ?? "",
        plannedMinutes: Number(plannedMinutes),
      });
      res.json({ ok: true, ...result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: msg });
    }
  });

  /** Edit planned task (calendar row) by match group — local override for manual + Google-imported. */
  router.put("/todo/planned-task", (req, res) => {
    const { matchGroupId, title, plannedMinutes } = req.body as {
      matchGroupId?: unknown;
      title?: string;
      plannedMinutes?: unknown;
    };
    const mgId = Number(matchGroupId);
    if (!Number.isFinite(mgId) || !Number.isInteger(mgId)) {
      res.status(400).json({ error: "matchGroupId required" });
      return;
    }
    try {
      const db = getDb();
      updatePlannedTaskByMatchGroup(db, mgId, {
        title: title ?? "",
        plannedMinutes: Number(plannedMinutes),
      });
      res.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: msg });
    }
  });

  /**
   * Remove a Google-imported planned row from the To Do List only (local DB).
   * Does not delete the event in Google Calendar. Persists via `google_calendar_todo_exclusions`
   * and skips that event on future Calendar syncs.
   */
  router.post("/todo/google-calendar-exclude", (req, res) => {
    const { externalId } = req.body as { externalId?: unknown };
    const ext = typeof externalId === "string" ? externalId.trim() : "";
    if (!ext) {
      res.status(400).json({ error: "externalId required (Google event id)" });
      return;
    }
    try {
      const db = getDb();
      excludeGoogleCalendarImportByExternalId(db, ext);
      res.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: msg });
    }
  });

  router.post("/sync/toggl", async (req, res) => {
    const token = process.env.TOGGL_API_TOKEN;
    if (!token) {
      console.error("[sync/toggl] Missing TOGGL_API_TOKEN in .env");
      res.status(400).json({
        error: "Missing TOGGL_API_TOKEN",
        hint: "Add your Toggl API token to .env and restart the API server.",
      });
      return;
    }
    const { startDate, endDate, runAutoMatch, clientTimeZone } = req.body as {
      startDate?: string;
      endDate?: string;
      runAutoMatch?: boolean;
      clientTimeZone?: string | null;
    };
    if (!startDate || !endDate) {
      res.status(400).json({ error: "startDate and endDate (YYYY-MM-DD) required" });
      return;
    }
    const db = getDb();
    try {
      console.log(
        "[sync/toggl] range",
        startDate,
        "→",
        endDate,
        "clientTimeZone:",
        clientTimeZone?.trim() || "(use LOCAL_DATE_TZ or server default)"
      );
      const sync = await syncTogglRange(db, token, startDate, endDate, { clientTimeZone });
      recordTogglSyncSuccess(db);
      let autoMatchInserted = 0;
      if (runAutoMatch) {
        autoMatchInserted = runAutoMatchForDateRange(db, startDate, endDate);
      }
      res.json({ ...sync, autoMatchInserted });
    } catch (e) {
      console.error("[sync/toggl] failed:", e);
      if (e instanceof Error && e.stack) console.error(e.stack);
      res.status(500).json({
        error: "Toggl sync failed",
        message: e instanceof Error ? e.message : String(e),
        ...(isDev && { stack: e instanceof Error ? e.stack : undefined }),
      });
    }
  });

  /** Google Calendar sync only — loaded on demand so Report/Toggl routes do not require googleapis at startup. */
  router.post("/sync/google-calendar", async (req, res) => {
    const { startDate, endDate, runAutoMatch } = req.body as {
      startDate?: string;
      endDate?: string;
      runAutoMatch?: boolean;
    };
    if (!startDate || !endDate) {
      res.status(400).json({ error: "startDate and endDate required" });
      return;
    }
    const timeMin = `${startDate}T00:00:00.000Z`;
    const timeMax = `${endDate}T23:59:59.999Z`;
    const db = getDb();
    try {
      console.log("[sync/google-calendar] range", startDate, "→", endDate);
      const { syncGoogleCalendarRange } = await import("../services/googleCalendarSync.js");
      const sync = await syncGoogleCalendarRange(db, timeMin, timeMax);
      recordGoogleCalendarSyncSuccess(db);
      let autoMatchInserted = 0;
      if (runAutoMatch) {
        autoMatchInserted = runAutoMatchForDateRange(db, startDate, endDate);
      }
      res.json({ ...sync, autoMatchInserted });
    } catch (e) {
      console.error("[sync/google-calendar] failed:", e);
      if (e instanceof Error && e.stack) console.error(e.stack);
      res.status(500).json({
        error: "Google Calendar sync failed",
        message: e instanceof Error ? e.message : String(e),
        ...(isDev && { stack: e instanceof Error ? e.stack : undefined }),
      });
    }
  });

  return router;
}
