import type { GoogleCalendarEvent } from "../types/googleCalendar";
import type { TogglTimeEntry } from "../types/togglTrack";
import {
  addDays,
  endOfIsoWeek,
  formatDayHeader,
  formatWeekRange,
  startOfDay,
  startOfIsoWeek,
} from "../lib/dateHelpers";
import { resolveMatchKey } from "../lib/normalizeMatch";

export type QuickPreset = "today" | "yesterday" | "this_week" | "last_week";

export type ViewMode = "day" | "week";

function iso(d: Date, h: number, m: number): string {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
}

/** Rich demo: matched, calendar-only (Chinese title), Toggl-only unplanned */
function mockTodayPair(anchor: Date): {
  calendar: GoogleCalendarEvent[];
  toggl: TogglTimeEntry[];
} {
  const d = startOfDay(anchor);
  const calendar: GoogleCalendarEvent[] = [
    {
      googleEventId: "gcal-1",
      title: "Deep Work Block",
      plannedDurationMinutes: 120,
      startDateTime: iso(d, 9, 0),
      endDateTime: iso(d, 11, 0),
      matchKey: "deep work",
    },
    {
      googleEventId: "gcal-2",
      title: "Email & Admin",
      plannedDurationMinutes: 45,
      startDateTime: iso(d, 11, 30),
      endDateTime: iso(d, 12, 15),
      matchKey: "email admin",
    },
    {
      googleEventId: "gcal-3",
      title: "产品评审会议",
      plannedDurationMinutes: 60,
      startDateTime: iso(d, 14, 0),
      endDateTime: iso(d, 15, 0),
    },
    {
      googleEventId: "gcal-4",
      title: "Evening Reading",
      plannedDurationMinutes: 30,
      startDateTime: iso(d, 20, 0),
      endDateTime: iso(d, 20, 30),
    },
    {
      googleEventId: "gcal-5",
      title: "Write Tutorial",
      plannedDurationMinutes: 60,
      startDateTime: iso(d, 13, 0),
      endDateTime: iso(d, 14, 0),
    },
  ];

  const toggl: TogglTimeEntry[] = [
    {
      togglEntryId: "tog-1",
      description: "Deep Work",
      durationMinutes: 100,
      startDateTime: iso(d, 9, 5),
      matchKey: "deep work",
      projectName: "Focus",
    },
    {
      togglEntryId: "tog-2",
      description: "Email Admin",
      durationMinutes: 50,
      startDateTime: iso(d, 11, 35),
      matchKey: "email admin",
      projectName: "Admin",
    },
    {
      togglEntryId: "tog-3",
      description: "Impromptu Client Call",
      durationMinutes: 25,
      startDateTime: iso(d, 16, 0),
      projectName: "Clients",
    },
    {
      togglEntryId: "tog-4",
      description: "Write Tutorial + corrected 3 mistakes",
      durationMinutes: 45,
      startDateTime: iso(d, 13, 10),
      projectName: "Writing",
    },
    {
      togglEntryId: "tog-5",
      description: "Research Notes",
      durationMinutes: 30,
      startDateTime: iso(d, 15, 0),
      projectName: "Research",
    },
  ];

  return { calendar, toggl };
}

function mockYesterday(anchor: Date): {
  calendar: GoogleCalendarEvent[];
  toggl: TogglTimeEntry[];
} {
  const d = startOfDay(anchor);
  return {
    calendar: [
      {
        googleEventId: "gcal-y1",
        title: "Planning Session",
        plannedDurationMinutes: 90,
        startDateTime: iso(d, 10, 0),
        endDateTime: iso(d, 11, 30),
        matchKey: "planning",
      },
    ],
    toggl: [
      {
        togglEntryId: "tog-y1",
        description: "Planning",
        durationMinutes: 75,
        startDateTime: iso(d, 10, 10),
        matchKey: "planning",
      },
    ],
  };
}

function expandWeek(
  weekStart: Date
): { calendar: GoogleCalendarEvent[]; toggl: TogglTimeEntry[] } {
  const calendar: GoogleCalendarEvent[] = [];
  const toggl: TogglTimeEntry[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const { calendar: c, toggl: t } = mockTodayPair(day);
    const dayTag = `::d${i}`;
    calendar.push(
      ...c.map((e) => ({
        ...e,
        googleEventId: `${e.googleEventId}-w${i}`,
        matchKey: resolveMatchKey(e.matchKey, e.title) + dayTag,
      }))
    );
    toggl.push(
      ...t.map((e) => ({
        ...e,
        togglEntryId: `${e.togglEntryId}-w${i}`,
        matchKey: resolveMatchKey(e.matchKey, e.description) + dayTag,
      }))
    );
  }
  return { calendar, toggl };
}

/**
 * Swap with API calls later: pass OAuth token + timeMin/timeMax for Calendar,
 * and workspace + start/end for Toggl. Keep return type.
 */
export function getMockExternalData(input: {
  anchorDate: Date;
  viewMode: ViewMode;
  quickPreset: QuickPreset | null;
}): { calendar: GoogleCalendarEvent[]; toggl: TogglTimeEntry[] } {
  const { anchorDate, viewMode, quickPreset } = input;

  if (viewMode === "week") {
    const ws = startOfIsoWeek(anchorDate);
    if (quickPreset === "last_week") {
      return expandWeek(addDays(ws, -7));
    }
    return expandWeek(ws);
  }

  if (quickPreset === "yesterday") {
    return mockYesterday(anchorDate);
  }

  return mockTodayPair(anchorDate);
}

export function describeRangeLabel(
  anchorDate: Date,
  viewMode: ViewMode,
  quickPreset: QuickPreset | null
): string {
  if (viewMode === "week") {
    const ws = startOfIsoWeek(anchorDate);
    const we = endOfIsoWeek(anchorDate);
    return formatWeekRange(ws, we);
  }
  if (quickPreset === "this_week" || quickPreset === "last_week") {
    const ws = startOfIsoWeek(anchorDate);
    const we = endOfIsoWeek(anchorDate);
    return formatWeekRange(ws, we);
  }
  return formatDayHeader(anchorDate);
}
