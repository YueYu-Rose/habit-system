import { useEffect, useId, useState } from "react";

type Props = {
  open: boolean;
  selectedDateLabel: string;
  onClose: () => void;
  onConfirm: (payload: { title: string; plannedMinutes: number }) => void | Promise<void>;
};

export function AddManualTodoModal({ open, selectedDateLabel, onClose, onConfirm }: Props) {
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(30);

  useEffect(() => {
    if (open) {
      setTitle("");
      setMinutes(30);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const t = title.trim();
    if (!t) return;
    const m = Math.round(Number(minutes));
    if (!Number.isFinite(m) || m < 1) return;
    try {
      await Promise.resolve(onConfirm({ title: t, plannedMinutes: Math.min(m, 1440) }));
      setTitle("");
      setMinutes(30);
      onClose();
    } catch {
      /* apiFetch / parent handles message */
    }
  };

  return (
    <div className="match-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="match-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="match-modal__panel">
        <h2 id={titleId} className="match-modal__title">
          Add Planned Task
        </h2>
        <p className="match-modal__hint">For {selectedDateLabel}</p>
        <label className="manual-todo-modal__field">
          <span className="manual-todo-modal__label">Task Name</span>
          <input
            type="text"
            className="manual-todo-modal__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you need to do?"
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
        <div className="match-modal__actions">
          <button type="button" className="match-modal__btn match-modal__btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="match-modal__btn match-modal__btn--primary"
            onClick={submit}
            disabled={!title.trim()}
          >
            Add Task
          </button>
        </div>
      </div>
    </div>
  );
}
