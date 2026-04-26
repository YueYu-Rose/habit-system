import { useState } from "react";
import { HabitBottomSheet } from "./HabitBottomSheet";
import { useLanguage } from "../context/LanguageContext";
import type { HabitDef, HabitSchedule } from "../lib/habitListStorage";
import type { TransKey } from "../locales/zh";

type AddPreset = 5 | 10 | 15;
type PenaltyPreset = 0 | 5 | 10;

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (def: Omit<HabitDef, "id" | "systemKey" | "streak"> & { streak?: number }) => void;
};

export function NewHabitBottomSheet({ open, onClose, onSave }: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [pts, setPts] = useState<AddPreset>(10);
  const [pen, setPen] = useState<PenaltyPreset>(0);
  const [freq, setFreq] = useState<"daily" | "week">("daily");
  const [weekDays, setWeekDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const canSave = name.trim().length > 0;
  const schedule: HabitSchedule =
    freq === "daily"
      ? { type: "daily" }
      : { type: "weekdays", days: weekDays.length > 0 ? [...weekDays].sort((a, b) => a - b) : [1, 2, 3, 4, 5] };

  const toggleDay = (d: number) => {
    setWeekDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  };

  const submit = () => {
    if (!canSave) return;
    setBusy(true);
    onSave({ name: name.trim(), completePoints: pts, penalty: pen, schedule });
    setName("");
    setPts(10);
    setPen(0);
    setFreq("daily");
    setWeekDays([1, 2, 3, 4, 5]);
    setBusy(false);
    onClose();
  };

  return (
    <HabitBottomSheet
      title={t("habitNew.title")}
      titleId="habit-new-habit-title"
      onClose={onClose}
      closeButton="iconOnly"
    >
      <label className="habit-form-label" htmlFor="new-habit-name">
        {t("habitNew.name")}
      </label>
      <input
        id="new-habit-name"
        className="habit-input-minimal"
        placeholder={t("habitNew.ph.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
      />

      <span className="habit-form-label">{t("habitNew.freq")}</span>
      <div className="habit-task-kind-row" style={{ marginBottom: 8 }}>
        <button
          type="button"
          className={`habit-task-kind-pill${freq === "daily" ? " habit-task-kind-pill--active" : ""}`}
          onClick={() => setFreq("daily")}
        >
          {t("habitNew.daily")}
        </button>
        <button
          type="button"
          className={`habit-task-kind-pill${freq === "week" ? " habit-task-kind-pill--active" : ""}`}
          onClick={() => setFreq("week")}
        >
          {t("habitNew.weekdays")}
        </button>
      </div>
      {freq === "week" ? (
        <div className="habit-weekday-pills" role="group" aria-label={t("habitNew.week.aria")}>
          {[0, 1, 2, 3, 4, 5, 6].map((idx) => {
            const k = `habitNew.week.${idx}` as TransKey;
            return (
              <button
                key={idx}
                type="button"
                className={`habit-weekday-pill${weekDays.includes(idx) ? " habit-weekday-pill--active" : ""}`}
                onClick={() => toggleDay(idx)}
              >
                {t("habitNew.weekPfx", { label: t(k) })}
              </button>
            );
          })}
        </div>
      ) : null}

      <span className="habit-form-label">{t("habitNew.points")}</span>
      <div className="habit-point-chips">
        {([5, 10, 15] as const).map((n) => (
          <button
            key={n}
            type="button"
            className={`habit-point-chip${pts === n ? " habit-point-chip--active" : ""}`}
            onClick={() => setPts(n)}
          >
            +{n}
          </button>
        ))}
      </div>

      <span className="habit-form-label">{t("habitNew.penalty")}</span>
      <div className="habit-point-chips">
        {([0, 5, 10] as const).map((n) => (
          <button
            key={n}
            type="button"
            className={`habit-point-chip${pen === n ? " habit-point-chip--active" : ""}`}
            onClick={() => setPen(n)}
          >
            {n === 0 ? t("habitNew.penaltyNone") : `−${n}`}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="habit-btn"
        style={{ marginTop: 8 }}
        disabled={!canSave || busy}
        onClick={submit}
      >
        {t("habitNew.save")}
      </button>
    </HabitBottomSheet>
  );
}
