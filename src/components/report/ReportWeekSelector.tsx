import { useEffect, useId, useRef, useState } from "react";
import {
  addDays,
  getMonthMatrixMondayFirst,
  isDateInWeek,
  isSameCalendarDay,
  startOfDay,
  startOfIsoWeek,
} from "../../lib/dateHelpers";
import { formatWeekShortLabel } from "../../lib/formatReportRange";
import { useAppTheme } from "../../theme/ThemeContext";

type QuickPreset = "this_week" | "last_week";

type Props = {
  weekStartMonday: Date;
  onWeekChange: (monday: Date) => void;
};

const DOW_MON_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function ReportWeekSelector({ weekStartMonday, onWeekChange }: Props) {
  const [open, setOpen] = useState(false);
  const [panelMonth, setPanelMonth] = useState(
    () => new Date(weekStartMonday.getFullYear(), weekStartMonday.getMonth(), 1)
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { theme } = useAppTheme();
  const today = startOfDay(new Date());
  const thisWeekMon = startOfIsoWeek(today);

  useEffect(() => {
    setPanelMonth(
      new Date(weekStartMonday.getFullYear(), weekStartMonday.getMonth(), 1)
    );
  }, [weekStartMonday]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = formatWeekShortLabel(weekStartMonday);

  const goPrev = () => {
    onWeekChange(addDays(weekStartMonday, -7));
  };

  const goNext = () => {
    onWeekChange(addDays(weekStartMonday, 7));
  };

  const applyQuick = (p: QuickPreset) => {
    if (p === "this_week") onWeekChange(thisWeekMon);
    else onWeekChange(addDays(thisWeekMon, -7));
    setOpen(false);
  };

  const selectDayInCalendar = (d: Date) => {
    onWeekChange(startOfIsoWeek(d));
    setOpen(false);
  };

  const monthLabel = panelMonth.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const matrix = getMonthMatrixMondayFirst(panelMonth);

  const getDayIndexInWeek = (d: Date): number => {
    const wStart = startOfDay(weekStartMonday);
    const diff = Math.round((startOfDay(d).getTime() - wStart.getTime()) / 86400000);
    return diff >= 0 && diff <= 6 ? diff : -1;
  };

  const weekColors = theme.efficiencySteps.slice(0, 7);
  const weekColorsSoft = weekColors.map(
    (c) => `color-mix(in srgb, ${c} 62%, #ffffff)`
  );

  return (
    <div className="report-week-selector" ref={wrapRef}>
      <div className="report-week-selector__compact">
        <button
          type="button"
          className="report-week-selector__arrow"
          aria-label="Previous Week"
          onClick={goPrev}
        >
          ‹
        </button>
        <button
          type="button"
          className="report-week-selector__trigger"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          {label}
        </button>
        <button
          type="button"
          className="report-week-selector__arrow"
          aria-label="Next Week"
          onClick={goNext}
        >
          ›
        </button>
      </div>

      {open ? (
        <div
          className="report-week-panel"
          id={menuId}
          role="dialog"
          aria-label="Week Picker"
        >
          <div className="report-week-panel__quick">
            <button
              type="button"
              className={`report-week-panel__chip${isSameCalendarDay(startOfDay(weekStartMonday), startOfDay(thisWeekMon)) ? " report-week-panel__chip--active" : ""}`}
              onClick={() => applyQuick("this_week")}
            >
              This Week
            </button>
            <button
              type="button"
              className={`report-week-panel__chip${isSameCalendarDay(startOfDay(weekStartMonday), startOfDay(addDays(thisWeekMon, -7))) ? " report-week-panel__chip--active" : ""}`}
              onClick={() => applyQuick("last_week")}
            >
              Last Week
            </button>
          </div>
          <p className="report-week-panel__hint">Select A Day To Choose Its Week</p>
          <div className="report-week-panel__head">
            <button
              type="button"
              className="report-week-panel__nav"
              aria-label="Previous Month"
              onClick={() =>
                setPanelMonth(
                  new Date(panelMonth.getFullYear(), panelMonth.getMonth() - 1, 1)
                )
              }
            >
              ‹
            </button>
            <span className="report-week-panel__title">{monthLabel}</span>
            <button
              type="button"
              className="report-week-panel__nav"
              aria-label="Next Month"
              onClick={() =>
                setPanelMonth(
                  new Date(panelMonth.getFullYear(), panelMonth.getMonth() + 1, 1)
                )
              }
            >
              ›
            </button>
          </div>
          <div className="report-week-panel__dow">
            {DOW_MON_FIRST.map((d) => (
              <span key={d} className="report-week-panel__dow-cell">
                {d}
              </span>
            ))}
          </div>
          <div className="report-week-panel__grid">
            {matrix.map((row, ri) => (
              <div key={ri} className="report-week-panel__grid-row">
                {row.map((cell, ci) =>
                  cell ? (
                    <button
                      key={ci}
                      type="button"
                      className={`report-week-panel__day${isDateInWeek(cell, weekStartMonday) ? " report-week-panel__day--in-selected-week" : ""}${isSameCalendarDay(cell, today) ? " report-week-panel__day--today" : ""}`}
                      style={
                        isDateInWeek(cell, weekStartMonday)
                          ? {
                              background:
                                weekColorsSoft[getDayIndexInWeek(cell)],
                              borderColor:
                                weekColorsSoft[getDayIndexInWeek(cell)],
                            }
                          : undefined
                      }
                      onClick={() => selectDayInCalendar(cell)}
                    >
                      {cell.getDate()}
                    </button>
                  ) : (
                    <span key={ci} className="report-week-panel__day report-week-panel__day--empty" />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
