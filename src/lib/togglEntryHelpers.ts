import type { LinkedActualEntry } from "../types/comparisonRow";
import type { TogglTimeEntry } from "../types/togglTrack";

export function togglToLinkedEntry(t: TogglTimeEntry): LinkedActualEntry {
  return {
    togglEntryId: t.togglEntryId,
    title: t.description,
    durationMinutes: t.durationMinutes,
    projectName: t.projectName,
  };
}

export function sumLinkedMinutes(entries: LinkedActualEntry[]): number {
  return entries.reduce((s, e) => s + e.durationMinutes, 0);
}
