import { useEffect, useId, useRef, useState } from "react";
import type { QuickPreset, ViewMode } from "../data/mockExternal";
import {
  addDays,
  getMonthMatrix,
  isSameCalendarDay,
  startOfDay,
  startOfIsoWeek,
} from "../lib/dateHelpers";

type Props = {
  anchorDate: Date;
  onAnchorChange: (d: Date) => void;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  quickPreset: QuickPreset | null;
  onQuickPresetChange: (p: QuickPreset | null) => void;
  rangeLabel: string;
};

const PRESETS: { key: QuickPreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "last_week", label: "Last Week" },
];

export function DateNavigation({
  anchorDate,
  onAnchorChange,
  viewMode,
  onViewModeChange,
  quickPreset,
  onQuickPresetChange,
  rangeLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [panelMonth, setPanelMonth] = useState(() => new Date(anchorDate));
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    setPanelMonth(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1));
  }, [anchorDate]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const today = startOfDay(new Date());

  const goPrev = () => {
    onQuickPresetChange(null);
    if (viewMode === "week") {
      onAnchorChange(addDays(anchorDate, -7));
    } else {
      onAnchorChange(addDays(anchorDate, -1));
    }
  };

  const goNext = () => {
    onQuickPresetChange(null);
    if (viewMode === "week") {
      onAnchorChange(addDays(anchorDate, 7));
    } else {
      onAnchorChange(addDays(anchorDate, 1));
    }
  };

  const applyPreset = (p: QuickPreset) => {
    onQuickPresetChange(p);
    if (p === "today") {
      onViewModeChange("day");
      onAnchorChange(new Date());
    } else if (p === "yesterday") {
      onViewModeChange("day");
      onAnchorChange(addDays(today, -1));
    } else if (p === "this_week") {
      onViewModeChange("week");
      onAnchorChange(startOfIsoWeek(today));
    } else if (p === "last_week") {
      onViewModeChange("week");
      onAnchorChange(addDays(startOfIsoWeek(today), -7));
    }
  };

  const selectCalendarDay = (d: Date) => {
    onQuickPresetChange(null);
    onViewModeChange("day");
    onAnchorChange(d);
    setOpen(false);
  };

  const monthLabel = panelMonth.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const matrix = getMonthMatrix(panelMonth);

  return (
    <div className="date-nav" ref={wrapRef}>
      <div className="date-nav__card">
        <div className="date-nav__range-row">
          <button
            type="button"
            className="date-nav__chevron"
            aria-label="Previous Range"
            onClick={goPrev}
          >
            ‹
          </button>
          <div className="date-nav__range-main">
            <span className="date-nav__range-caption">Selected Range</span>
            <button
              type="button"
              className="date-nav__range-value"
              aria-expanded={open}
              aria-controls={menuId}
              onClick={() => setOpen((v) => !v)}
            >
              {rangeLabel}
            </button>
          </div>
          <button
            type="button"
            className="date-nav__chevron"
            aria-label="Next Range"
            onClick={goNext}
          >
            ›
          </button>
        </div>

        <div className="date-nav__quick-row" role="group" aria-label="Quick Date Range">
          {PRESETS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`date-nav__chip${quickPreset === key ? " date-nav__chip--active" : ""}`}
              onClick={() => applyPreset(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="date-nav__controls-row">
          <div className="date-nav__segment" role="group" aria-label="View Mode">
            <button
              type="button"
              className={`date-nav__segment-btn${viewMode === "day" ? " date-nav__segment-btn--active" : ""}`}
              onClick={() => {
                onQuickPresetChange(null);
                onViewModeChange("day");
              }}
            >
              Day View
            </button>
            <button
              type="button"
              className={`date-nav__segment-btn${viewMode === "week" ? " date-nav__segment-btn--active" : ""}`}
              onClick={() => {
                onQuickPresetChange(null);
                onViewModeChange("week");
                onAnchorChange(startOfIsoWeek(anchorDate));
              }}
            >
              Week View
            </button>
          </div>
          <button
            type="button"
            className="date-nav__calendar-btn"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="date-nav__calendar-icon" aria-hidden>
              ◫
            </span>
            Calendar
          </button>
        </div>
      </div>

      {open ? (
        <div className="date-nav__panel" id={menuId} role="dialog" aria-label="Calendar">
          <div className="date-nav__panel-head">
            <button
              type="button"
              className="date-nav__panel-arrow"
              aria-label="Previous Month"
              onClick={() =>
                setPanelMonth(
                  new Date(panelMonth.getFullYear(), panelMonth.getMonth() - 1, 1)
                )
              }
            >
              ‹
            </button>
            <span className="date-nav__panel-title">{monthLabel}</span>
            <button
              type="button"
              className="date-nav__panel-arrow"
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
          <div className="date-nav__dow">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span key={d} className="date-nav__dow-cell">
                {d}
              </span>
            ))}
          </div>
          <div className="date-nav__grid">
            {matrix.map((row, ri) => (
              <div key={ri} className="date-nav__grid-row">
                {row.map((cell, ci) =>
                  cell ? (
                    <button
                      key={ci}
                      type="button"
                      className={`date-nav__day${isSameCalendarDay(cell, anchorDate) ? " date-nav__day--selected" : ""}${isSameCalendarDay(cell, today) ? " date-nav__day--today" : ""}`}
                      onClick={() => selectCalendarDay(cell)}
                    >
                      {cell.getDate()}
                    </button>
                  ) : (
                    <span key={ci} className="date-nav__day date-nav__day--empty" />
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
