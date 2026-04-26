/**
 * Shapes aligned with future Toggl Track weekly aggregates + Time Bill pipeline.
 * Wire API: map Toggl summary reports → hoursByDay, projects; map your bill logic → totalTimeBillHours.
 */
export type ProjectHoursSlice = {
  /** Toggl project id */
  projectId: string;
  /** Display name (may include Chinese) */
  name: string;
  hours: number;
  /** Hex color for charts (from Toggl or your mapping) */
  color: string;
};

export type DayHoursSlice = {
  /** Calendar date (local), ISO YYYY-MM-DD */
  date: string;
  /** Tracked hours that day */
  hours: number;
};

export type WeeklyReportSlice = {
  /** Monday 00:00 local, ISO YYYY-MM-DD */
  weekStart: string;
  /** Sum of tracked time entries for the week (hours) */
  totalTrackedHours: number;
  /** Sum of Time Bill for the week (hours); sign preserved */
  totalTimeBillHours: number;
  hoursByDay: DayHoursSlice[];
  projects: ProjectHoursSlice[];
};
