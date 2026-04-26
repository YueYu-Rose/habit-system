/**
 * Shape aligned with future Toggl Track API mapping.
 * Replace mock with Time Entries from Toggl API v9.
 */
export type TogglTimeEntry = {
  /** Stable id from Toggl */
  togglEntryId: string;
  /** Entry description — used to match calendar titles */
  description: string;
  /** Duration in minutes (API returns seconds; convert when integrating) */
  durationMinutes: number;
  /** ISO start for future range filters */
  startDateTime: string;
  /** Optional explicit match key */
  matchKey?: string;
  /** Optional project / client label for UI */
  projectName?: string;
};
