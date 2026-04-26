import type { Database } from "better-sqlite3";
import type { ComparisonRow } from "../../src/types/comparisonRow.js";

export function getCompletedByRowId(db: Database, rows: ComparisonRow[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const mgStmt = db.prepare(`SELECT 1 AS x FROM todo_completion WHERE match_group_id = ?`);
  const tgStmt = db.prepare(`
    SELECT 1 AS x FROM todo_completion tc
    INNER JOIN toggl_entries te ON te.id = tc.toggl_entry_id
    WHERE te.external_id = ?
  `);
  for (const r of rows) {
    if (r.matchGroupId != null) {
      if (mgStmt.get(r.matchGroupId)) out[r.rowId] = true;
    } else if (r.kind === "toggl_unplanned" && r.togglEntryId) {
      if (tgStmt.get(r.togglEntryId)) out[r.rowId] = true;
    }
  }
  return out;
}

export function setTodoCompletion(
  db: Database,
  params: { completed: boolean } & (
    | { matchGroupId: number; togglExternalId?: undefined }
    | { togglExternalId: string; matchGroupId?: undefined }
  )
): void {
  const now = new Date().toISOString();
  if ("matchGroupId" in params && params.matchGroupId != null) {
    const mgId = params.matchGroupId;
    const del = db.prepare(`DELETE FROM todo_completion WHERE match_group_id = ?`).run(mgId);
    if (params.completed) {
      const ins = db.prepare(
        `INSERT INTO todo_completion (match_group_id, toggl_entry_id, completed_at) VALUES (?, NULL, ?)`
      ).run(mgId, now);
      console.log("[todo_completion] planned match_group_id=", mgId, "insert changes=", ins.changes);
    } else {
      console.log("[todo_completion] planned match_group_id=", mgId, "delete changes=", del.changes);
    }
    return;
  }
  const ext = String(params.togglExternalId ?? "").trim();
  if (!ext) {
    throw new Error("togglExternalId required");
  }
  const te = db.prepare(`SELECT id FROM toggl_entries WHERE external_id = ?`).get(ext) as
    | { id: number }
    | undefined;
  if (!te) {
    throw new Error("Toggl entry not found");
  }
  const del = db.prepare(`DELETE FROM todo_completion WHERE toggl_entry_id = ?`).run(te.id);
  if (params.completed) {
    const ins = db.prepare(
      `INSERT INTO todo_completion (match_group_id, toggl_entry_id, completed_at) VALUES (NULL, ?, ?)`
    ).run(te.id, now);
    console.log(
      "[todo_completion] toggl external_id=",
      ext,
      "internal_id=",
      te.id,
      "insert changes=",
      ins.changes
    );
  } else {
    console.log("[todo_completion] toggl external_id=", ext, "internal_id=", te.id, "delete changes=", del.changes);
  }
}
