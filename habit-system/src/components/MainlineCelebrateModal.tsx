import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../context/LanguageContext";

type Props = {
  open: boolean;
  mainlineName: string;
  finalPoints: number;
  onConfirm: () => void;
};

/**
 * 达成主线：纯庆祝 + 单按钮确认，不当作二次确认用。
 */
export function MainlineCelebrateModal({ open, mainlineName, finalPoints, onConfirm }: Props) {
  const { t } = useLanguage();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.getElementById("habit-overlay-root"));
  }, []);

  if (!open) return null;
  const node = (
    <div
      className="habit-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mainline-celebrate-title"
    >
      <div className="habit-modal-card habit-modal-card--celebrate" onClick={(e) => e.stopPropagation()}>
        <h2 id="mainline-celebrate-title" className="habit-modal-title">
          {t("celebrate.title")}
        </h2>
        <p className="habit-modal-body">
          {t("celebrate.part1")}
          <strong>{mainlineName}</strong>
          {t("celebrate.part2")}
          <strong className="habit-amount-pos">{finalPoints}</strong>
          {t("celebrate.part3")}
        </p>
        <button type="button" className="habit-btn" style={{ width: "100%", marginTop: 8 }} onClick={onConfirm}>
          {t("celebrate.btn")}
        </button>
      </div>
    </div>
  );
  if (host) {
    return createPortal(node, host);
  }
  return createPortal(node, document.body);
}
