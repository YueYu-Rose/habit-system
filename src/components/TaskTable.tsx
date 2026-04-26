import { Fragment } from "react";
import type { ComparisonRow } from "../types/comparisonRow";
import { displayTaskTitle } from "../lib/displayTaskTitle";
import { formatDurationMinutes, formatTimeBillMinutes } from "../lib/formatDuration";
import { formatMatchStatusLabel } from "../lib/matchStatusLabels";
import { EfficiencyFeeling } from "./EfficiencyFeeling";

type RowState = {
  checked: boolean;
  efficiencyPercent: number | null;
};

type Props = {
  rows: ComparisonRow[];
  rowState: Record<string, RowState>;
  expandedRowId: string | null;
  onToggleExpand: (rowId: string) => void;
  onToggleCheck: (rowId: string, checked: boolean) => void;
  onEfficiencyChange: (rowId: string, percent: number) => void;
  onOpenAddMatch: (rowId: string) => void;
  onUnlinkLinkedEntry: (rowId: string, togglEntryId: string) => void;
  /** When true, show standardized empty hints (hide while loading). */
  showContextEmptyHints?: boolean;
  /** Opens modal to add a manual planned task for the selected day. */
  onOpenAddManual?: () => void;
  /** Click planned task title to edit name + planned time (match group rows only). */
  onEditPlannedTask?: (row: ComparisonRow) => void;
};

function isExpandablePlannedRow(row: ComparisonRow): boolean {
  return row.kind !== "toggl_unplanned" && row.googleEventId != null;
}

function isPlannedEditableRow(row: ComparisonRow): boolean {
  return row.kind !== "toggl_unplanned" && row.matchGroupId != null;
}

export function TaskTable({
  rows,
  rowState,
  expandedRowId,
  onToggleExpand,
  onToggleCheck,
  onEfficiencyChange,
  onOpenAddMatch,
  onUnlinkLinkedEntry,
  showContextEmptyHints = true,
  onOpenAddManual,
  onEditPlannedTask,
}: Props) {
  const showTable = rows.length > 0 || showContextEmptyHints;

  return (
    <div className="table-wrap">
      {showTable ? (
      <table className="task-table">
        <thead>
          <tr>
            <th className="task-table__th task-table__th--check" scope="col">
              <div className="task-table__check-head">
                {onOpenAddManual ? (
                  <button
                    type="button"
                    className="task-table__add-header-btn"
                    onClick={onOpenAddManual}
                    aria-label="Add planned task"
                    title="Add planned task"
                  >
                    +
                  </button>
                ) : null}
                <span className="visually-hidden">Done</span>
              </div>
            </th>
            <th className="task-table__th" scope="col">
              Task Name
            </th>
            <th className="task-table__th" scope="col">
              Planned Time
            </th>
            <th className="task-table__th task-table__th--actual" scope="col">
              Actual Time
            </th>
            <th className="task-table__th" scope="col">
              Time Bill
            </th>
            <th className="task-table__th task-table__th--eff" scope="col">
              Efficiency Feeling
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="task-table__row task-table__row--empty-day">
              <td colSpan={6} className="task-table__td task-table__td--empty-day-msg">
                Start Writing Your To Do
              </td>
            </tr>
          ) : null}
          {rows.map((row) => {
            const st = rowState[row.rowId] ?? {
              checked: false,
              efficiencyPercent: null,
            };
            const completed = st.checked;
            const expandable = isExpandablePlannedRow(row);
            const expanded = expandedRowId === row.rowId;
            const linked = row.linkedEntries ?? [];
            const titleEditable = isPlannedEditableRow(row) && onEditPlannedTask;

            return (
              <Fragment key={row.rowId}>
                <tr
                  className={`task-table__row${completed ? " task-table__row--completed" : ""}${expandable ? " task-table__row--expandable" : ""}`}
                >
                  <td className="task-table__td task-table__td--check">
                    <input
                      type="checkbox"
                      className="task-table__checkbox"
                      checked={st.checked}
                      onChange={(e) => onToggleCheck(row.rowId, e.target.checked)}
                      aria-label={`Mark ${row.displayTitle} done`}
                    />
                  </td>
                  <td className="task-table__td task-table__td--name">
                    <div className="task-table__name-cell">
                      {titleEditable ? (
                        <button
                          type="button"
                          className={`task-table__title task-table__title-btn${completed ? " task-table__title--completed" : ""}`}
                          onClick={() => onEditPlannedTask(row)}
                          title="Edit task name and planned time"
                        >
                          {displayTaskTitle(row.displayTitle)}
                        </button>
                      ) : (
                        <span
                          className={`task-table__title${completed ? " task-table__title--completed" : ""}`}
                        >
                          {displayTaskTitle(row.displayTitle)}
                        </span>
                      )}
                      {row.kind === "toggl_unplanned" ? (
                        <span className="task-table__badge">Unplanned Task</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="task-table__td">
                    {formatDurationMinutes(row.plannedMinutes)}
                  </td>
                  <td className="task-table__td task-table__td--actual">
                    <div className="task-table__actual-cell">
                      <span className="task-table__actual-text">
                        {formatDurationMinutes(row.actualMinutes)}
                      </span>
                      {expandable ? (
                        <button
                          type="button"
                          className={`task-table__expand-btn task-table__expand-btn--after-actual${expanded ? " task-table__expand-btn--expanded" : ""}`}
                          aria-expanded={expanded}
                          aria-controls={`task-detail-${row.rowId}`}
                          aria-label={expanded ? "Collapse task details" : "Expand task details"}
                          onClick={() => onToggleExpand(row.rowId)}
                        >
                          <span
                            className={`task-table__expand-icon${expanded ? " task-table__expand-icon--expanded" : " task-table__expand-icon--collapsed"}`}
                            aria-hidden
                          >
                            {expanded ? "▼" : "▶"}
                          </span>
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td
                    className={`task-table__td task-table__td--bill${row.timeBillMinutes !== null && row.timeBillMinutes > 0 ? " task-table__td--bill-pos" : ""}${row.timeBillMinutes !== null && row.timeBillMinutes < 0 ? " task-table__td--bill-neg" : ""}`}
                  >
                    {formatTimeBillMinutes(row.timeBillMinutes)}
                  </td>
                  <td className="task-table__td task-table__td--eff">
                    <EfficiencyFeeling
                      rowId={row.rowId}
                      valuePercent={st.efficiencyPercent}
                      onChange={(p) => onEfficiencyChange(row.rowId, p)}
                    />
                  </td>
                </tr>
                {expandable && expanded ? (
                  <tr className="task-table__row task-table__row--detail">
                    <td className="task-table__td task-table__detail-wrap" colSpan={6}>
                      <div
                        className="task-table__detail"
                        id={`task-detail-${row.rowId}`}
                        role="region"
                        aria-label={`Details for ${row.displayTitle}`}
                      >
                        <div className="task-table__detail-grid">
                          <section className="task-table__detail-block">
                            <h4 className="task-table__detail-heading">Linked Actual Entries</h4>
                            {linked.length === 0 ? (
                              <p className="task-table__detail-empty">No Linked Entries Yet</p>
                            ) : (
                              <ul className="task-table__linked-list">
                                {linked.map((e) => (
                                  <li key={e.togglEntryId} className="task-table__linked-item">
                                    <div className="task-table__linked-main">
                                      <span className="task-table__linked-title">
                                        {displayTaskTitle(e.title)}
                                      </span>
                                      {e.projectName ? (
                                        <span className="task-table__linked-project">
                                          {e.projectName}
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="task-table__linked-meta">
                                      <span className="task-table__linked-dur">
                                        {formatDurationMinutes(e.durationMinutes)}
                                      </span>
                                      <button
                                        type="button"
                                        className="task-table__linked-unlink"
                                        onClick={() =>
                                          onUnlinkLinkedEntry(row.rowId, e.togglEntryId)
                                        }
                                      >
                                        Unlink
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <button
                              type="button"
                              className="task-table__btn-add-match"
                              onClick={() => onOpenAddMatch(row.rowId)}
                            >
                              Add Match
                            </button>
                          </section>
                          <section className="task-table__detail-block task-table__detail-block--status">
                            <h4 className="task-table__detail-heading">Match Status</h4>
                            <span className="task-table__status-pill">
                              {formatMatchStatusLabel(row.matchStatus)}
                            </span>
                          </section>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      ) : null}
    </div>
  );
}
