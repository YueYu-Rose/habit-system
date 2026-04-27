import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../context/LanguageContext";
import { nowLocalTimeHM, toLocalIsoFromYmdAndHm } from "../lib/dateLocal";
import type { HabitDef } from "../lib/habitListStorage";

type Props = {
  open: boolean;
  habit: HabitDef | null;
  /** 归属打卡日 YYYY-MM-DD（与页面所选日一致，可切到昨日补录） */
  dayYmd: string;
  onClose: () => void;
  /** ISO 时刻 */
  onConfirm: (iso: string) => void;
};

/**
 * 时间类习惯：选择本次记录的具体时刻（默认当前时间，可微调）
 */
export function HabitTimeCheckinModal({ open, habit, dayYmd, onClose, onConfirm }: Props) {
  const { t } = useLanguage();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [hm, setHm] = useState(nowLocalTimeHM);

  useEffect(() => {
    setHost(document.getElementById("habit-overlay-root"));
  }, []);

  useEffect(() => {
    if (open) setHm(nowLocalTimeHM());
  }, [open, habit?.id]);

  if (!open || !habit) return null;

  const body = (
    <div
      className="habit-modal-backdrop"
      style={{ zIndex: 240 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="habit-time-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="habit-ex-dur-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="habit-time-modal-title" className="habit-ex-dur-title">
          {habit.name}
        </h2>
        <p className="habit-ex-dur-hint">{t("timeCheckin.hint")}</p>
        <label className="habit-stat-label" style={{ display: "block", marginTop: 12 }} htmlFor="habit-time-input">
          {t("timeCheckin.label")}
        </label>
        <input
          id="habit-time-input"
          className="habit-input"
          type="time"
          step={60}
          value={hm}
          onChange={(e) => setHm(e.target.value)}
          style={{ fontSize: 18, minHeight: 48 }}
        />
        <div className="habit-ex-dur-actions" style={{ marginTop: 16 }}>
          <button type="button" className="habit-btn habit-btn--secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="habit-btn habit-btn--force-white"
            onClick={() => {
              onConfirm(toLocalIsoFromYmdAndHm(dayYmd, hm));
              onClose();
            }}
          >
            {t("timeCheckin.confirm")}
          </button>
        </div>
      </div>
    </div>
  );

  if (host) {
    return createPortal(body, host);
  }
  return createPortal(body, document.body);
}
