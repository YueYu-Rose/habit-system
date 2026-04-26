import type { ComparisonRow, LinkedActualEntry, MatchStatus } from "../types/comparisonRow";
import type { GoogleCalendarEvent } from "../types/googleCalendar";
import type { TogglTimeEntry } from "../types/togglTrack";
import { resolveMatchKey } from "./normalizeMatch";
import { sumLinkedMinutes, togglToLinkedEntry } from "./togglEntryHelpers";

/**
 * One row per calendar event; all Toggl rows sharing the same match key attach to that planned row.
 * Unmatched Toggl entries become unplanned rows.
 */
export function mergeCalendarAndToggl(
  calendar: GoogleCalendarEvent[],
  toggl: TogglTimeEntry[]
): ComparisonRow[] {
  const togglByKey = new Map<string, TogglTimeEntry[]>();
  for (const t of toggl) {
    const k = resolveMatchKey(t.matchKey, t.description);
    const list = togglByKey.get(k) ?? [];
    list.push(t);
    togglByKey.set(k, list);
  }

  const usedTogglIds = new Set<string>();
  const rows: ComparisonRow[] = [];

  for (const ev of calendar) {
    const key = resolveMatchKey(ev.matchKey, ev.title);
    const matches = togglByKey.get(key) ?? [];
    const linkedEntries: LinkedActualEntry[] = matches.map(togglToLinkedEntry);
    for (const m of matches) usedTogglIds.add(m.togglEntryId);

    const planned = ev.plannedDurationMinutes;
    const actualSum = sumLinkedMinutes(linkedEntries);
    const hasLinks = linkedEntries.length > 0;

    let matchStatus: MatchStatus;
    if (!hasLinks) matchStatus = "unmatched";
    else matchStatus = "auto_matched";

    rows.push({
      rowId: `planned-${ev.googleEventId}`,
      kind: hasLinks ? "matched" : "calendar_only",
      displayTitle: ev.title,
      plannedMinutes: planned,
      actualMinutes: hasLinks ? actualSum : null,
      timeBillMinutes: hasLinks ? planned - actualSum : null,
      googleEventId: ev.googleEventId,
      togglEntryId: matches[0]?.togglEntryId,
      linkedEntries: hasLinks ? linkedEntries : [],
      matchStatus,
    });
  }

  for (const t of toggl) {
    if (usedTogglIds.has(t.togglEntryId)) continue;
    rows.push({
      rowId: `toggl-${t.togglEntryId}`,
      kind: "toggl_unplanned",
      displayTitle: t.description,
      plannedMinutes: null,
      actualMinutes: t.durationMinutes,
      timeBillMinutes: null,
      togglEntryId: t.togglEntryId,
      matchStatus: "unmatched",
    });
  }

  return rows;
}
