/**
 * Shape aligned with future Google Calendar API mapping.
 * Replace mock fetch with Calendar API events (duration from start/end or extended properties).
 */
export type GoogleCalendarEvent = {
  /** Stable id from Google Calendar */
  googleEventId: string;
  /** Event summary / title */
  title: string;
  /** Planned duration in minutes (derive from start/end when wiring API) */
  plannedDurationMinutes: number;
  /** ISO 8601 start — for future filtering by date range */
  startDateTime: string;
  /** ISO 8601 end */
  endDateTime: string;
  /** Optional: explicit key for matching Toggl descriptions */
  matchKey?: string;
};
