import { useState } from "react";
import { useAppConfig } from "../config/appConfig";
import { useLanguage } from "../context/LanguageContext";
import { useMainlineLoop } from "../context/MainlineLoopContext";
import { MainlineCelebrateModal } from "./MainlineCelebrateModal";

export function MainlineTaskCard() {
  const { t } = useLanguage();
  const { mode } = useAppConfig();
  const isPromo = mode === "PROMOTION";
  const { state, addQuickPoints, setCurrentName, startNewMainline, archiveAndClearCurrent } = useMainlineLoop();
  const [draftName, setDraftName] = useState("");
  const [celebrate, setCelebrate] = useState<null | { name: string; points: number }>(null);
  const cur = state.current;

  const openCelebrate = () => {
    if (!cur) return;
    setCelebrate({ name: cur.name, points: cur.cumulativePoints });
  };

  const onCelebrateConfirm = () => {
    if (!celebrate) return;
    archiveAndClearCurrent(celebrate.name, celebrate.points);
    setCelebrate(null);
  };

  const canStartMainline = draftName.trim().length > 0;

  if (!cur) {
    return (
      <div className="habit-row-card habit-mainline-card" style={{ padding: 16, marginBottom: 12 }}>
        <h2 className="habit-section-title" style={{ marginTop: 0, marginBottom: 10, fontSize: "1.02rem" }}>
          {t("mainline.cardTitle")}
        </h2>
        <p className="habit-muted" style={{ margin: "0 0 10px" }}>
          {t("mainline.emptyHint")}
        </p>
        <div className="habit-grid-2" style={{ alignItems: "center", gap: 8 }}>
          <input
            className="habit-input"
            placeholder={t("mainline.ph.name")}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canStartMainline) {
                e.preventDefault();
                startNewMainline(draftName);
                setDraftName("");
              }
            }}
            autoComplete="off"
          />
          <button
            type="button"
            className="habit-btn"
            disabled={!canStartMainline}
            onClick={() => {
              if (!canStartMainline) return;
              startNewMainline(draftName);
              setDraftName("");
            }}
          >
            {t("mainline.start")}
          </button>
        </div>
      </div>
    );
  }

  const name = cur.name.trim() || t("mainline.fallbackName");
  const total = cur.cumulativePoints;

  return (
    <div className="habit-row-card habit-mainline-card" style={{ padding: 16, marginBottom: 12 }}>
      <div className="habit-mainline-head">
        <h2 className="habit-mainline-dual-title" style={{ margin: 0, fontSize: "1.02rem" }}>
          <span className="habit-mainline-dual-name">{name}</span>
          <span className="habit-mainline-dual-sep"> · </span>
          <span className="habit-mainline-dual-pts">{t("mainline.cumulative")}</span>
        </h2>
        <div className="habit-mainline-total-pts">{total}</div>
        {!isPromo ? (
          <p className="habit-muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
            {t("mainline.multiReward")}
          </p>
        ) : null}
      </div>

      <label className="habit-stat-label" htmlFor="habit-ml-rename" style={{ marginTop: 10 }}>
        {t("mainline.rename")}
      </label>
      <input
        id="habit-ml-rename"
        className="habit-input"
        value={cur.name}
        onChange={(e) => setCurrentName(e.target.value)}
        autoComplete="off"
      />

      <p className="habit-stat-label" style={{ marginTop: 10 }}>
        {t("mainline.quick")}
      </p>
      <div className="habit-ml-chips" role="group" aria-label={t("mainline.quick")}>
        <button type="button" className="habit-point-chip" onClick={() => addQuickPoints(10)}>
          +10
        </button>
        <button type="button" className="habit-point-chip" onClick={() => addQuickPoints(20)}>
          +20
        </button>
      </div>

      <button type="button" className="habit-btn habit-btn--force-white" style={{ width: "100%", marginTop: 12 }} onClick={openCelebrate}>
        {t("mainline.achieve")}
      </button>

      <MainlineCelebrateModal
        open={celebrate != null}
        mainlineName={celebrate?.name ?? ""}
        finalPoints={celebrate?.points ?? 0}
        onConfirm={onCelebrateConfirm}
      />
    </div>
  );
}
