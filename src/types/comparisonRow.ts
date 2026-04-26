export type ComparisonRowKind = "matched" | "calendar_only" | "toggl_unplanned";

/** Prepared for future auto-matcher; manual linking sets manually_linked */
export type MatchStatus = "auto_matched" | "manually_linked" | "unmatched";

export type LinkedActualEntry = {
  togglEntryId: string;
  title: string;
  durationMinutes: number;
  projectName?: string;
};

export type PlannedTaskSource = "manual" | "google_calendar";

export type ComparisonRow = {
  rowId: string;
  /** When backed by SQLite task_match_groups (planned rows) */
  matchGroupId?: number;
  /** SQLite calendar_events.source — planned rows only */
  plannedSource?: PlannedTaskSource;
  kind: ComparisonRowKind;
  displayTitle: string;
  plannedMinutes: number | null;
  actualMinutes: number | null;
  /** Minutes: planned − total actual when planned exists */
  timeBillMinutes: number | null;
  googleEventId?: string;
  /** Legacy: first linked Toggl id when present */
  togglEntryId?: string;
  linkedEntries?: LinkedActualEntry[];
  matchStatus?: MatchStatus;
};
