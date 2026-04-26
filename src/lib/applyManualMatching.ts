import type { ComparisonRow, LinkedActualEntry, MatchStatus } from "../types/comparisonRow";
import type { TogglTimeEntry } from "../types/togglTrack";
import { sumLinkedMinutes, togglToLinkedEntry } from "./togglEntryHelpers";

function dedupeByTogglId(entries: LinkedActualEntry[]): LinkedActualEntry[] {
  const seen = new Set<string>();
  const out: LinkedActualEntry[] = [];
  for (const e of entries) {
    if (seen.has(e.togglEntryId)) continue;
    seen.add(e.togglEntryId);
    out.push(e);
  }
  return out;
}

function resolveMatchStatus(
  linked: LinkedActualEntry[],
  extraIds: string[],
  removedIds: string[]
): MatchStatus {
  if (linked.length === 0) return "unmatched";
  const userTouchedRow = extraIds.length > 0 || removedIds.length > 0;
  if (userTouchedRow) return "manually_linked";
  return "auto_matched";
}

/**
 * Merges manually linked Toggl entries into planned rows, applies removals, and drops linked ids from unplanned rows.
 */
export function applyManualMatching(
  baseRows: ComparisonRow[],
  togglCatalog: TogglTimeEntry[],
  extraLinksByRowId: Record<string, string[]>,
  removedEntryIdsByRowId: Record<string, string[]>
): ComparisonRow[] {
  const togglById = new Map(togglCatalog.map((t) => [t.togglEntryId, t]));

  const plannedRows = baseRows.filter((r) => r.kind !== "toggl_unplanned");
  const unplannedBase = baseRows.filter((r) => r.kind === "toggl_unplanned");

  const updatedPlanned: ComparisonRow[] = plannedRows.map((row) => {
    const baseLinked = row.linkedEntries ?? [];
    const extraIds = extraLinksByRowId[row.rowId] ?? [];
    const removedIds = removedEntryIdsByRowId[row.rowId] ?? [];
    const removedSet = new Set(removedIds);

    const extras: LinkedActualEntry[] = [];
    for (const id of extraIds) {
      const t = togglById.get(id);
      if (t) extras.push(togglToLinkedEntry(t));
    }

    const merged = dedupeByTogglId([...baseLinked, ...extras]).filter(
      (e) => !removedSet.has(e.togglEntryId)
    );

    const planned = row.plannedMinutes;
    const actualSum = sumLinkedMinutes(merged);
    const hasLinks = merged.length > 0;

    return {
      ...row,
      kind: hasLinks ? "matched" : "calendar_only",
      linkedEntries: merged,
      actualMinutes: hasLinks ? actualSum : null,
      timeBillMinutes: planned !== null && hasLinks ? planned - actualSum : null,
      matchStatus: resolveMatchStatus(merged, extraIds, removedIds),
      togglEntryId: merged[0]?.togglEntryId,
    };
  });

  const linkedIds = new Set<string>();
  for (const r of updatedPlanned) {
    for (const e of r.linkedEntries ?? []) linkedIds.add(e.togglEntryId);
  }

  /** Hide unplanned rows for Toggl ids now linked to a planned task (no duplicate linked vs unplanned). */
  const updatedUnplanned = unplannedBase.filter((r) => {
    const id = r.togglEntryId;
    if (!id) return true;
    return !linkedIds.has(id);
  });

  return [...updatedPlanned, ...updatedUnplanned];
}
