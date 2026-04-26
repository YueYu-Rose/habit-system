import { addDays, startOfIsoWeek } from "../lib/dateHelpers";
import type { WeeklyReportSlice } from "../types/weeklyReport";

const PROJECT_PALETTE = [
  "#249BEB",
  "#AF99FF",
  "#E27396",
  "#2d6a4f",
  "#b45309",
  "#5578B0",
  "#9b2226",
] as const;

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Simple deterministic pseudo-random 0..1 from string */
function hash01(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 10000) / 10000;
}

/**
 * Replace with `fetchWeeklyReport(weekStart, token)` that calls Toggl + your bill calculator.
 */
export function getMockWeeklyReport(anchorInWeek: Date): {
  currentWeek: WeeklyReportSlice;
  previousWeek: WeeklyReportSlice;
} {
  const weekStart = startOfIsoWeek(anchorInWeek);
  const prevStart = addDays(weekStart, -7);

  return {
    currentWeek: buildSlice(weekStart),
    previousWeek: buildSlice(prevStart),
  };
}

function buildSlice(monday: Date): WeeklyReportSlice {
  const key = isoDate(monday);
  const h = hash01(key);

  const dayHours: number[] = [];
  for (let i = 0; i < 7; i++) {
    const dayKey = `${key}-d${i}`;
    const base = 4 + hash01(dayKey) * 5 + (i === 2 || i === 3 ? 1.2 : 0);
    dayHours.push(Math.round(base * 10) / 10);
  }

  const totalTracked = Math.round(dayHours.reduce((a, b) => a + b, 0) * 10) / 10;

  const projectsSeed = [
    { projectId: "p1", name: "Deep Work", color: PROJECT_PALETTE[0] },
    { projectId: "p2", name: "客户沟通", color: PROJECT_PALETTE[1] },
    { projectId: "p3", name: "Admin", color: PROJECT_PALETTE[2] },
    { projectId: "p4", name: "Learning", color: PROJECT_PALETTE[3] },
  ];

  const weights = projectsSeed.map((_, i) => 0.15 + hash01(`${key}-w${i}`) * 0.35);
  const wSum = weights.reduce((a, b) => a + b, 0);
  const projects = projectsSeed.map((p, i) => ({
    ...p,
    hours: Math.round(((weights[i] / wSum) * totalTracked + h * 0.3) * 10) / 10,
  }));

  const projSum = projects.reduce((a, p) => a + p.hours, 0);
  if (Math.abs(projSum - totalTracked) > 0.05) {
    projects[0] = {
      ...projects[0],
      hours: Math.round((projects[0].hours + (totalTracked - projSum)) * 10) / 10,
    };
  }

  const plannedBias = 0.92 + hash01(`${key}-bill`) * 0.12;
  const totalTimeBill = Math.round((totalTracked * plannedBias - totalTracked) * 10) / 10;

  const hoursByDay = dayHours.map((hours, i) => ({
    date: isoDate(addDays(monday, i)),
    hours,
  }));

  return {
    weekStart: key,
    totalTrackedHours: totalTracked,
    totalTimeBillHours: totalTimeBill,
    hoursByDay,
    projects,
  };
}
