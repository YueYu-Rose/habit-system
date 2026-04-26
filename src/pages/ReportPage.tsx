import { useMemo, useState, useEffect, useCallback } from "react";
import { startOfIsoWeek } from "../lib/dateHelpers";
import { toIsoDateLocal } from "../lib/dateHelpers";
import { buildReportViewModel } from "../report/buildReportViewModel";
import { ReportWeekSelector } from "../components/report/ReportWeekSelector";
import { ReportSummaryCards } from "../components/report/ReportSummaryCards";
import { DurationByDayChart } from "../components/report/DurationByDayChart";
import { ProjectDistributionChart } from "../components/report/ProjectDistributionChart";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { LastSyncMeta, type SyncMeta } from "../components/LastSyncMeta";
import { apiFetch } from "../api/client";
import type { WeeklyReportSlice } from "../types/weeklyReport";

export default function ReportPage() {
  const [weekStartMonday, setWeekStartMonday] = useState(() =>
    startOfIsoWeek(new Date())
  );
  const [currentWeek, setCurrentWeek] = useState<WeeklyReportSlice | null>(null);
  const [previousWeek, setPreviousWeek] = useState<WeeklyReportSlice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);

  const weekStartIso = useMemo(
    () => toIsoDateLocal(weekStartMonday),
    [weekStartMonday]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{
        currentWeek: WeeklyReportSlice;
        previousWeek: WeeklyReportSlice;
        syncMeta?: SyncMeta;
      }>(`/api/report/week?weekStart=${encodeURIComponent(weekStartIso)}`);
      setCurrentWeek(data.currentWeek);
      setPreviousWeek(data.previousWeek);
      setSyncMeta(data.syncMeta ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCurrentWeek(null);
      setPreviousWeek(null);
      setSyncMeta(null);
    } finally {
      setLoading(false);
    }
  }, [weekStartIso]);

  useEffect(() => {
    void load();
  }, [load]);

  const viewModel = useMemo(() => {
    if (!currentWeek || !previousWeek) return null;
    return buildReportViewModel(currentWeek, previousWeek);
  }, [currentWeek, previousWeek]);

  return (
    <>
      <header className="page__header">
        <div className="page__header-row page__header-row--report">
          <div className="page__header-left">
            <h1 className="page__title">Report</h1>
            <ReportWeekSelector
              weekStartMonday={weekStartMonday}
              onWeekChange={setWeekStartMonday}
            />
          </div>
          <ThemeSwitcher />
        </div>
        <p className="page__subtitle">
          Weekly Review: Compare This Week With Last Week
        </p>
        {!error && !loading ? <LastSyncMeta syncMeta={syncMeta} /> : null}
      </header>

      {error ? (
        <p className="page__subtitle" role="alert">
          Could not load report: {error}. Import Toggl data for the selected weeks and ensure the
          API is running.
        </p>
      ) : null}
      {loading ? <p className="page__subtitle">Loading…</p> : null}
      {!loading && !error && viewModel ? (
        <>
          <ReportSummaryCards
            totalHoursLabel={viewModel.totalHoursFormatted}
            totalHoursComparison={viewModel.totalHoursComparison}
            timeBillLabel={viewModel.timeBillFormatted}
            timeBillComparison={viewModel.timeBillComparison}
            avgDailyLabel={viewModel.avgDailyFormatted}
            avgDailyComparison={viewModel.avgDailyComparison}
          />

          <div className="report-grid">
            <DurationByDayChart days={viewModel.hoursByDay} />
            <ProjectDistributionChart
              slices={viewModel.projects}
              totalHours={viewModel.donutTotalHours}
            />
          </div>
        </>
      ) : null}
    </>
  );
}
