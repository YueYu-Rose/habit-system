import { useEffect, useId, useState } from "react";
import type { TogglTimeEntry } from "../types/togglTrack";
import { displayTaskTitle } from "../lib/displayTaskTitle";
import { formatDurationMinutes } from "../lib/formatDuration";

type Props = {
  open: boolean;
  title: string;
  /** Only unlinked entries (not attached to any planned task); parent must filter. */
  candidates: TogglTimeEntry[];
  onClose: () => void;
  onConfirm: (selectedTogglIds: string[]) => void;
};

export function AddMatchModal({
  open,
  title,
  candidates,
  onClose,
  onConfirm,
}: Props) {
  const titleId = useId();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm([...selected]);
    setSelected(new Set());
    onClose();
  };

  const handleClose = () => {
    setSelected(new Set());
    onClose();
  };

  return (
    <div className="match-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        className="match-modal__backdrop"
        aria-label="Close"
        onClick={handleClose}
      />
      <div className="match-modal__panel">
        <h2 id={titleId} className="match-modal__title">
          {title}
        </h2>
        <p className="match-modal__hint">
          Select One Or More Unlinked Toggl Entries To Link To This Task
        </p>
        {candidates.length === 0 ? (
          <p className="match-modal__empty">No Unlinked Entries Yet</p>
        ) : (
          <ul className="match-modal__list" role="listbox" aria-multiselectable>
            {candidates.map((t) => (
              <li key={t.togglEntryId} className="match-modal__item">
                <label className="match-modal__label">
                  <input
                    type="checkbox"
                    className="match-modal__checkbox"
                    checked={selected.has(t.togglEntryId)}
                    onChange={() => toggle(t.togglEntryId)}
                  />
                  <span className="match-modal__entry-main">
                    <span className="match-modal__entry-title">{displayTaskTitle(t.description)}</span>
                    {t.projectName ? (
                      <span className="match-modal__project">{t.projectName}</span>
                    ) : null}
                  </span>
                  <span className="match-modal__dur">
                    {formatDurationMinutes(t.durationMinutes)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="match-modal__actions">
          <button type="button" className="match-modal__btn match-modal__btn--ghost" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="button"
            className="match-modal__btn match-modal__btn--primary"
            onClick={handleConfirm}
            disabled={selected.size === 0 || candidates.length === 0}
          >
            Confirm Match
          </button>
        </div>
      </div>
    </div>
  );
}
