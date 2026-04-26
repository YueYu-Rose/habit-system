import { useEffect, useId, useState } from "react";
import type { PlannedTaskSource } from "../types/comparisonRow";

type Props = {
  open: boolean;
  initialTitle: string;
  initialPlannedMinutes: number;
  plannedSource?: PlannedTaskSource;
  onClose: () => void;
  onSave: (payload: { title: string; plannedMinutes: number }) => void | Promise<void>;
  onMoveToNextDay?: (payload: { title: string; plannedMinutes: number }) => void | Promise<void>;
  /** Google Calendar imports only: remove from this app locally; does not delete the calendar event. */
  onRemoveFromTodoList?: () => void | Promise<void>;
};

export function EditPlannedTaskModal({
  open,
  initialTitle,
  initialPlannedMinutes,
  plannedSource,
  onClose,
  onSave,
  onMoveToNextDay,
  onRemoveFromTodoList,
}: Props) {
  const titleId = useId();
  const [title, setTitle] = useState(initialTitle);
  const [minutes, setMinutes] = useState(initialPlannedMinutes);
  const [moveBusy, setMoveBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setMinutes(initialPlannedMinutes);
      setMoveBusy(false);
      setRemoveBusy(false);
    }
  }, [open, initialTitle, initialPlannedMinutes]);

  if (!open) return null;

  const submit = async () => {
    const t = title.trim();
    if (!t) return;
    const m = Math.round(Number(minutes));
    if (!Number.isFinite(m) || m < 1) return;
    try {
      await Promise.resolve(onSave({ title: t, plannedMinutes: Math.min(m, 1440) }));
      onClose();
    } catch {
      /* apiFetch */
    }
  };

  const moveToNextDay = async () => {
    if (!onMoveToNextDay) return;
    const t = title.trim();
    if (!t) return;
    const m = Math.round(Number(minutes));
    if (!Number.isFinite(m) || m < 1) return;
    setMoveBusy(true);
    try {
      await Promise.resolve(
        onMoveToNextDay({ title: t, plannedMinutes: Math.min(m, 1440) })
      );
      onClose();
    } catch {
      /* apiFetch */
    } finally {
      setMoveBusy(false);
    }
  };

  const removeFromTodoList = async () => {
    if (!onRemoveFromTodoList) return;
    if (
      !window.confirm(
        "Remove this task from the To Do List? The event will stay in Google Calendar. This cannot be undone from the UI."
      )
    ) {
      return;
    }
    setRemoveBusy(true);
    try {
      await Promise.resolve(onRemoveFromTodoList());
      onClose();
    } catch {
      /* apiFetch */
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <div className="match-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="match-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="match-modal__panel">
        <div className="match-modal__head">
          <div className="match-modal__title-wrap">
            <h2 id={titleId} className="match-modal__title">
              Edit Planned Task
            </h2>
          </div>
          {onMoveToNextDay ? (
            <button
              type="button"
              className="match-modal__move-next"
              onClick={() => void moveToNextDay()}
              disabled={moveBusy || !title.trim()}
              title="Create this task on the next calendar day"
            >
              {moveBusy ? "Moving…" : "Move to next day"}
            </button>
          ) : null}
        </div>
        <p className="match-modal__hint">Update name and planned time for this row.</p>
        {plannedSource === "google_calendar" ? (
          <p className="match-modal__hint match-modal__hint--sub">
            Google import: the calendar row for this day is unchanged; a local manual copy is added for
            tomorrow.
          </p>
        ) : null}
        <label className="manual-todo-modal__field">
          <span className="manual-todo-modal__label">Task Name</span>
          <input
            type="text"
            className="manual-todo-modal__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </label>
        <label className="manual-todo-modal__field">
          <span className="manual-todo-modal__label">Planned Time (minutes)</span>
          <input
            type="number"
            className="manual-todo-modal__input"
            min={1}
            max={1440}
            step={1}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
        {plannedSource === "google_calendar" && onRemoveFromTodoList ? (
          <div className="match-modal__remove-section">
            <p className="match-modal__remove-hint">
              Remove from this site only. Your Google Calendar event is not changed. Future imports will
              keep this event hidden here.
            </p>
            <button
              type="button"
              className="match-modal__btn match-modal__btn--danger"
              onClick={() => void removeFromTodoList()}
              disabled={moveBusy || removeBusy}
            >
              {removeBusy ? "Removing…" : "Remove from To Do List"}
            </button>
          </div>
        ) : null}
        <div className="match-modal__actions">
          <button
            type="button"
            className="match-modal__btn match-modal__btn--ghost"
            onClick={onClose}
            disabled={moveBusy || removeBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="match-modal__btn match-modal__btn--primary"
            onClick={submit}
            disabled={!title.trim() || moveBusy || removeBusy}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
