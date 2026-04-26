import type { Database } from "better-sqlite3";
import type { MatchStatus } from "../../src/types/comparisonRow.js";

export function recomputeMatchStatus(db: Database, matchGroupId: number): MatchStatus {
  const items = db
    .prepare(`SELECT link_type FROM task_match_items WHERE match_group_id = ?`)
    .all(matchGroupId) as { link_type: string }[];

  if (items.length === 0) return "unmatched";
  const allAuto = items.every((i) => i.link_type === "auto");
  return allAuto ? "auto_matched" : "manually_linked";
}

export function persistMatchStatus(db: Database, matchGroupId: number): void {
  const status = recomputeMatchStatus(db, matchGroupId);
  const now = new Date().toISOString();
  db.prepare(`UPDATE task_match_groups SET match_status = ?, updated_at = ? WHERE id = ?`).run(
    status,
    now,
    matchGroupId
  );
}
