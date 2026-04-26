import { useEffect, useId, useRef, useState } from "react";
import {
  addDays,
  getMonthMatrixMondayFirst,
  isSameCalendarDay,
  startOfDay,
  formatDayShortLabel,
} from "../lib/dateHelpers";
import { useAppTheme } from "../theme/ThemeContext";

type QuickPreset = "today" | "yesterday";

type Props = {
  selectedDate: Date;
  onDateChange: (d: Date) => void;
};

const DOW_MON_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function TodoDateSelector({ selectedDate, onDateChange }: Props) {
  const [open, setOpen] = useState(false);
  const [panelMonth, setPanelMonth] = useState(
    () =>
      new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { theme, themeId } = useAppTheme();
  /** Pink/Purple: 8th gradient step. Blue: prior lighter mix (not raw step 8). */
  const selectedDayFill =
    themeId === "blue"
      ? "color-mix(in srgb, #7eb8e8 42%, #e3f2fa 58%)"
      : theme.efficiencySteps[7];
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);

  useEffect(() => {
    setPanelMonth(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    );
  }, [selectedDate]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = formatDayShortLabel(selectedDate);

  const goPrev = () => onDateChange(addDays(selectedDate, -1));
  const goNext = () => onDateChange(addDays(selectedDate, 1));

  const applyQuick = (p: QuickPreset) => {
    if (p === "today") onDateChange(today);
    else onDateChange(yesterday);
    setOpen(false);
  };

  const selectDay = (d: Date) => {
    onDateChange(d);
    setOpen(false);
  };

  const monthLabel = panelMonth.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const matrix = getMonthMatrixMondayFirst(panelMonth);

  return (
    <div className="todo-date-selector" ref={wrapRef}>
      <div className="todo-date-selector__compact">
        <button
          type="button"
          className="todo-date-selector__arrow"
          aria-label="Previous Day"
          onClick={goPrev}
        >
          ‹
        </button>
        <button
          type="button"
          className="todo-date-selector__trigger"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          {label}
        </button>
        <button
          type="button"
          className="todo-date-selector__arrow"
          aria-label="Next Day"
          onClick={goNext}
        >
          ›
        </button>
      </div>

      {open ? (
        <div
          className="todo-date-panel"
          id={menuId}
          role="dialog"
          aria-label="Date Picker"
        >
          <div className="todo-date-panel__quick">
            <button
              type="button"
              className={`todo-date-panel__chip${isSameCalendarDay(startOfDay(selectedDate), today) ? " todo-date-panel__chip--active" : ""}`}
              onClick={() => applyQuick("today")}
            >
              Today
            </button>
            <button
              type="button"
              className={`todo-date-panel__chip${isSameCalendarDay(startOfDay(selectedDate), yesterday) ? " todo-date-panel__chip--active" : ""}`}
              onClick={() => applyQuick("yesterday")}
            >
              Yesterday
            </button>
          </div>
          <div className="todo-date-panel__head">
            <button
              type="button"
              className="todo-date-panel__nav"
              aria-label="Previous Month"
              onClick={() =>
                setPanelMonth(
                  new Date(panelMonth.getFullYear(), panelMonth.getMonth() - 1, 1)
                )
              }
            >
              ‹
            </button>
            <span className="todo-date-panel__title">{monthLabel}</span>
            <button
              type="button"
              className="todo-date-panel__nav"
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
          <div className="todo-date-panel__dow">
            {DOW_MON_FIRST.map((d) => (
              <span key={d} className="todo-date-panel__dow-cell">
                {d}
              </span>
            ))}
          </div>
          <div className="todo-date-panel__grid">
            {matrix.map((row, ri) => (
              <div key={ri} className="todo-date-panel__grid-row">
                {row.map((cell, ci) =>
                  cell ? (
                    <button
                      key={ci}
                      type="button"
                      className={`todo-date-panel__day${isSameCalendarDay(cell, selectedDate) ? " todo-date-panel__day--selected" : ""}${isSameCalendarDay(cell, today) ? " todo-date-panel__day--today" : ""}`}
                      style={
                        isSameCalendarDay(cell, selectedDate)
                          ? { background: selectedDayFill }
                          : undefined
                      }
                      onClick={() => selectDay(cell)}
                    >
                      {cell.getDate()}
                    </button>
                  ) : (
                    <span
                      key={ci}
                      className="todo-date-panel__day todo-date-panel__day--empty"
                    />
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
