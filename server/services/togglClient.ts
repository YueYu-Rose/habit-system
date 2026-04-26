/**
 * Toggl Track API v9 (NOT Toggl Focus).
 * Docs: https://developers.track.toggl.com/docs/api/time_entries
 * Base: https://api.track.toggl.com/api/v9
 * Auth: HTTP Basic — username = API token, password = literal "api_token"
 * (see https://developers.track.toggl.com/docs/authentication)
 */

import { addDaysToIsoDate } from "../lib/calendarDate.js";

export type TogglTimeEntryApi = {
  id: number;
  workspace_id: number;
  project_id: number | null;
  description: string | null;
  duration: number;
  start: string;
  stop: string | null;
  /** May be absent; prefer toggl_projects after sync */
  project_name?: string | null;
};

/** GET /api/v9/me/projects — Track API */
export type TogglProjectApi = {
  id: number;
  workspace_id: number;
  name: string;
  active?: boolean;
};

function basicAuthHeader(apiToken: string): string {
  const raw = `${apiToken}:api_token`;
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}

/** Docs show `items`; some responses may be a raw array — accept both. */
function parseTimeEntriesPayload(data: unknown): TogglTimeEntryApi[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) return items as TogglTimeEntryApi[];
  }
  return [];
}

/**
 * Fetches time entries for [startDate, endDate] inclusive on the calendar.
 * `endDate` is sent to Toggl as **the day after** (`endDate + 1`) because the Track API
 * treats `end_date` as an exclusive upper bound in practice — without this, entries whose
 * `start` falls on the last day of the range (especially "today" in UTC) are often missing.
 */
export async function fetchTogglTimeEntries(
  apiToken: string,
  startDate: string,
  endDate: string
): Promise<TogglTimeEntryApi[]> {
  const url = new URL("https://api.track.toggl.com/api/v9/me/time_entries");
  url.searchParams.set("start_date", startDate);
  const endExclusive = addDaysToIsoDate(endDate, 1);
  url.searchParams.set("end_date", endExclusive);

  console.log(
    "[toggl/api] GET time_entries",
    `start_date=${startDate}`,
    `end_date=${endExclusive}`,
    `(inclusive calendar end was ${endDate}, +1 day for API exclusive end)`
  );

  // GET with no body: do not send Content-Type: application/json (Track docs require JSON
  // for bodies on POST/PATCH; a bare GET should not pretend to send JSON).
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: basicAuthHeader(apiToken),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Toggl API ${res.status}: ${text.slice(0, 400)}`);
  }

  const raw = (await res.json()) as unknown;
  const entries = parseTimeEntriesPayload(raw);
  const shape =
    Array.isArray(raw) ? "array" : raw && typeof raw === "object" && "items" in raw ? "items" : typeof raw;
  console.log(
    "[toggl/api] response:",
    `shape=${shape}`,
    `parsed_rows=${entries.length}`
  );
  return entries;
}

/**
 * All projects visible to the user (names for distribution charts).
 * https://api.track.toggl.com/api/v9/me/projects
 */
export async function fetchTogglProjects(apiToken: string): Promise<TogglProjectApi[]> {
  const url = new URL("https://api.track.toggl.com/api/v9/me/projects");
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: basicAuthHeader(apiToken),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Toggl projects API ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as unknown;
  if (Array.isArray(data)) return data as TogglProjectApi[];
  const wrapped = data as { items?: TogglProjectApi[] };
  return Array.isArray(wrapped.items) ? wrapped.items : [];
}
