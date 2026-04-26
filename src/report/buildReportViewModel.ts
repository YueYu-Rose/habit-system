import { addDays } from "../lib/dateHelpers";
import {
  formatWeekRangeReport,
  parseIsoDateOnly,
} from "../lib/formatReportRange";
import {
  averageDailyHours,
  formatPercentSigned,
  percentChange,
  type TrendDirection,
} from "../lib/reportMath";
import type { WeeklyReportSlice } from "../types/weeklyReport";

export type ComparisonChip = {
  direction: TrendDirection;
  percentLabel: string;
  /** When previous week was zero baseline for % */
  isNeutralBaseline: boolean;
};

export type ReportViewModel = {
  rangeLabel: string;
  weekStartMonday: Date;
  totalHours: number;
  totalHoursFormatted: string;
  totalHoursComparison: ComparisonChip;
  timeBillHours: number;
  timeBillFormatted: string;
  timeBillComparison: ComparisonChip;
  avgDailyHours: number;
  avgDailyFormatted: string;
  avgDailyComparison: ComparisonChip;
  hoursByDay: {
    date: Date;
    weekdayShort: string;
    dayMonth: string;
    hours: number;
    hoursLabel: string;
  }[];
  projects: {
    projectId: string;
    name: string;
    hours: number;
    color: string;
    percent: number;
  }[];
  donutTotalHours: number;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function formatHours(h: number): string {
  const rounded = Math.round(h * 100) / 100;
  return `${rounded}h`;
}

function buildComparison(prevVal: number, currVal: number): ComparisonChip {
  const isSame = currVal === prevVal;
  const pct = percentChange(prevVal, currVal);
  const isNeutralBaseline = prevVal === 0 && currVal !== 0;

  let direction: TrendDirection = "same";
  if (!isSame) {
    direction = currVal > prevVal ? "up" : "down";
  }

  return {
    direction,
    percentLabel: isSame ? "0%" : formatPercentSigned(pct),
    isNeutralBaseline,
  };
}

/**
 * Pure view-model from current + previous weekly slices.
 * Later: pass slices from API layer instead of mock.
 */
export function buildReportViewModel(
  current: WeeklyReportSlice,
  previous: WeeklyReportSlice
): ReportViewModel {
  const weekStartMonday = parseIsoDateOnly(current.weekStart);
  const rangeLabel = formatWeekRangeReport(weekStartMonday);

  const totalHours = current.totalTrackedHours;
  const prevTotal = previous.totalTrackedHours;

  const avgCurr = averageDailyHours(totalHours);
  const avgPrev = averageDailyHours(prevTotal);

  const billCurr = current.totalTimeBillHours;
  const billPrev = previous.totalTimeBillHours;

  const projSum = current.projects.reduce((s, p) => s + p.hours, 0) || 1;
  const projects = current.projects.map((p) => ({
    ...p,
    percent: Math.round((p.hours / projSum) * 1000) / 10,
  }));

  const hoursByDay = current.hoursByDay.map((d, i) => {
    const date = parseIsoDateOnly(d.date);
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return {
      date,
      weekdayShort: WEEKDAYS[i] ?? WEEKDAYS[date.getDay() === 0 ? 6 : date.getDay() - 1],
      dayMonth: `${m}/${day}`,
      hours: d.hours,
      hoursLabel: formatHours(d.hours),
    };
  });

  return {
    rangeLabel,
    weekStartMonday,
    totalHours,
    totalHoursFormatted: formatHours(totalHours),
    totalHoursComparison: buildComparison(prevTotal, totalHours),
    timeBillHours: billCurr,
    timeBillFormatted: formatSignedHours(billCurr),
    timeBillComparison: buildComparison(billPrev, billCurr),
    avgDailyHours: avgCurr,
    avgDailyFormatted: formatHours(avgCurr),
    avgDailyComparison: buildComparison(avgPrev, avgCurr),
    hoursByDay,
    projects,
    donutTotalHours: totalHours,
  };
}

function formatSignedHours(h: number): string {
  const abs = Math.abs(Math.round(h * 100) / 100);
  const core = `${abs}h`;
  if (h > 0) return `+${core}`;
  if (h < 0) return `-${core}`;
  return `${abs}h`;
}

/** Export for tests: week bounds */
export function weekEndExclusive(monday: Date): Date {
  return addDays(monday, 7);
}
