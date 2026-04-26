import type { ComparisonRow } from "../types/comparisonRow";
import type { TogglTimeEntry } from "../types/togglTrack";

/**
 * Toggl ids currently attached to any planned task row (not unplanned rows).
 * Each id may appear on at most one planned task — enforced by only offering unlinked entries in Add Match.
 */
export function collectLinkedTogglIdsFromPlannedRows(rows: ComparisonRow[]): Set<string> {
  const s = new Set<string>();
  for (const r of rows) {
    if (r.kind === "toggl_unplanned") continue;
    for (const e of r.linkedEntries ?? []) s.add(e.togglEntryId);
  }
  return s;
}

/** Entries not linked to any planned task — safe to show in Add Match (no duplicate linking). */
export function filterUnlinkedTogglEntries(
  catalog: TogglTimeEntry[],
  rows: ComparisonRow[]
): TogglTimeEntry[] {
  const linked = collectLinkedTogglIdsFromPlannedRows(rows);
  return catalog.filter((t) => !linked.has(t.togglEntryId));
}
