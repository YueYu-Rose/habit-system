import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../context/LanguageContext";

type Preset = 15 | 20 | 30;

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (minutes: number) => void;
  /** 已填默认分钟（自定义输入） */
  defaultCustom?: number;
};

/**
 * 运动：选择时长后完成打卡（不直接打勾，先选再提交）
 */
export function ExerciseDurationModal({ open, onClose, onConfirm, defaultCustom = 25 }: Props) {
  const { t } = useLanguage();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [tab, setTab] = useState<Preset | "custom">(20);
  const [custom, setCustom] = useState(defaultCustom);

  useEffect(() => {
    setHost(document.getElementById("habit-overlay-root"));
  }, []);

  if (!open) return null;

  const presets: Preset[] = [15, 20, 30];
  const minutes = tab === "custom" ? Math.max(0, Math.round(custom)) : tab;

  const body = (
    <div
      className="habit-modal-backdrop"
      style={{ zIndex: 230 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ex-dur-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="habit-ex-dur-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="ex-dur-title" className="habit-ex-dur-title">
          {t("ex.title")}
        </h2>
        <p className="habit-ex-dur-hint">{t("ex.hint")}</p>
        <div className="habit-ex-dur-pills" role="group">
          {presets.map((m) => (
            <button
              key={m}
              type="button"
              className={`habit-ex-dur-pill${tab === m ? " habit-ex-dur-pill--on" : ""}`}
              onClick={() => setTab(m)}
            >
              {t("ex.minLabel", { m })}
            </button>
          ))}
          <button
            type="button"
            className={`habit-ex-dur-pill${tab === "custom" ? " habit-ex-dur-pill--on" : ""}`}
            onClick={() => setTab("custom")}
          >
            {t("ex.custom")}
          </button>
        </div>
        {tab === "custom" ? (
          <label className="habit-stat-label" style={{ display: "block", marginTop: 10 }} htmlFor="ex-dur-custom">
            {t("ex.minutes")}
          </label>
        ) : null}
        {tab === "custom" ? (
          <input
            id="ex-dur-custom"
            className="habit-input"
            type="number"
            min={0}
            inputMode="numeric"
            value={custom}
            onChange={(e) => setCustom(Number(e.target.value))}
            style={{ marginTop: 6 }}
          />
        ) : null}
        <div className="habit-ex-dur-actions">
          <button type="button" className="habit-btn habit-btn--ghost" onClick={onClose}>
            {t("ex.cancel")}
          </button>
          <button
            type="button"
            className="habit-btn"
            disabled={tab === "custom" && minutes <= 0}
            onClick={() => {
              if (tab === "custom" && minutes <= 0) return;
              onConfirm(minutes);
              onClose();
            }}
          >
            {t("ex.confirm")}
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
