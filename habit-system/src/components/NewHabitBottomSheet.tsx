import { useEffect, useState } from "react";
import { HabitBottomSheet } from "./HabitBottomSheet";
import { useLanguage } from "../context/LanguageContext";
import { normalizeSavedCompletePoints, type HabitDef, type HabitSchedule, type HabitTargetType } from "../lib/habitListStorage";
import type { TransKey } from "../locales/zh";

type PenaltyPreset = 0 | 5 | 10;

type Props = {
  open: boolean;
  onClose: () => void;
  /** 有 id 时为编辑 */
  onSave: (def: Omit<HabitDef, "id" | "systemKey" | "streak"> & { id?: string; streak?: number }) => void;
  /** 非空时预填为编辑 */
  editingHabit?: HabitDef | null;
};

export function NewHabitBottomSheet({ open, onClose, onSave, editingHabit = null }: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  /** 完成加分：支持空串（提交时按 10）与显式 0 */
  const [pointsInput, setPointsInput] = useState("10");
  const [pen, setPen] = useState<PenaltyPreset>(0);
  const [freq, setFreq] = useState<"daily" | "week">("daily");
  const [weekDays, setWeekDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [targetType, setTargetType] = useState<HabitTargetType>("boolean");
  const [targetTime, setTargetTime] = useState("07:00");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const h = editingHabit;
    if (h) {
      setName(h.name);
      const cp = h.completePoints;
      setPointsInput(cp === undefined || cp === null ? "10" : String(cp));
      setPen((h.penalty as PenaltyPreset) === 0 || h.penalty === 5 || h.penalty === 10 ? (h.penalty as PenaltyPreset) : 0);
      if (h.schedule?.type === "weekdays" && h.schedule.days?.length) {
        setFreq("week");
        setWeekDays([...h.schedule.days].sort((a, b) => a - b));
      } else {
        setFreq("daily");
        setWeekDays([1, 2, 3, 4, 5]);
      }
      setTargetType(h.targetType === "time" ? "time" : "boolean");
      setTargetTime(h.targetTime && /^\d{2}:\d{2}$/.test(h.targetTime) ? h.targetTime : "07:00");
    } else {
      setName("");
      setPointsInput("10");
      setPen(0);
      setFreq("daily");
      setWeekDays([1, 2, 3, 4, 5]);
      setTargetType("boolean");
      setTargetTime("07:00");
    }
  }, [open, editingHabit]);

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
    const payload: Omit<HabitDef, "id" | "systemKey" | "streak"> & { id?: string; streak?: number } = {
      name: name.trim(),
      completePoints: normalizeSavedCompletePoints(pointsInput),
      penalty: pen,
      schedule,
      targetType,
      targetTime: targetType === "time" && targetTime.trim() ? targetTime.trim() : undefined,
    };
    if (editingHabit?.id) payload.id = editingHabit.id;
    onSave(payload);
    setBusy(false);
    onClose();
  };

  const title = editingHabit ? t("habitNew.editTitle") : t("habitNew.title");

  return (
    <HabitBottomSheet
      title={title}
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

      <span className="habit-form-label">{t("habitNew.recordType")}</span>
      <div className="habit-task-kind-row" style={{ marginBottom: 8 }}>
        <button
          type="button"
          className={`habit-task-kind-pill${targetType === "boolean" ? " habit-task-kind-pill--active" : ""}`}
          onClick={() => setTargetType("boolean")}
        >
          {t("habitNew.type.boolean")}
        </button>
        <button
          type="button"
          className={`habit-task-kind-pill${targetType === "time" ? " habit-task-kind-pill--active" : ""}`}
          onClick={() => setTargetType("time")}
        >
          {t("habitNew.type.time")}
        </button>
      </div>
      {targetType === "time" ? (
        <>
          <label className="habit-form-label" htmlFor="new-habit-target-t">
            {t("habitNew.targetTime")}
          </label>
          <input
            id="new-habit-target-t"
            className="habit-input-minimal"
            type="time"
            value={targetTime}
            onChange={(e) => setTargetTime(e.target.value)}
            style={{ fontSize: 16, marginBottom: 12 }}
          />
        </>
      ) : null}

      <span className="habit-form-label">{t("habitNew.points")}</span>
      <p className="habit-muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
        {t("habitNew.pointsHint")}
      </p>
      <div className="habit-point-chips" style={{ marginBottom: 6 }}>
        {([5, 10, 15] as const).map((n) => (
          <button
            key={n}
            type="button"
            className={`habit-point-chip${String(n) === pointsInput.trim() ? " habit-point-chip--active" : ""}`}
            onClick={() => {
              setPointsInput(String(n));
            }}
            title={t("habitNew.pointsQuick", { n })}
          >
            +{n}
          </button>
        ))}
      </div>
      <label className="habit-form-label" htmlFor="new-habit-points" style={{ marginTop: 4 }}>
        {t("habitNew.pointsField")}
      </label>
      <input
        id="new-habit-points"
        className="habit-input-minimal"
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        placeholder="10"
        value={pointsInput}
        onChange={(e) => setPointsInput(e.target.value)}
        style={{ fontSize: 16, marginBottom: 6 }}
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
