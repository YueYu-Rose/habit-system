import type { ComparisonRow } from "../types/comparisonRow";

export type SummaryTotals = {
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  totalTimeBillMinutes: number;
};

/**
 * Summary for the selected day: planned rows only (excludes unplanned Toggl-only rows).
 * Total Time Bill = Total Planned − Total Actual (linked actual on planned rows).
 */
export function computeSummaryTotals(rows: ComparisonRow[]): SummaryTotals {
  let totalPlannedMinutes = 0;
  let totalActualMinutes = 0;

  for (const r of rows) {
    if (r.kind === "toggl_unplanned") continue;
    if (r.plannedMinutes !== null) totalPlannedMinutes += r.plannedMinutes;
    if (r.actualMinutes !== null) totalActualMinutes += r.actualMinutes;
  }

  const totalTimeBillMinutes = totalPlannedMinutes - totalActualMinutes;

  return { totalPlannedMinutes, totalActualMinutes, totalTimeBillMinutes };
}
