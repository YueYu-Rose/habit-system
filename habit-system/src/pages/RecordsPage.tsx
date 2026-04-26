import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";

export function RecordsPage() {
  const { lang, t } = useLanguage();
  const [redemptions, setRedemptions] = useState<{ title: string; cost_points: number; redeemed_at: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const locale = lang === "en" ? "en-GB" : "zh-CN";

  useEffect(() => {
    setRedemptions([]);
    setErr(null);
  }, []);

  return (
    <>
      <p className="habit-muted habit-page-lead">{t("records.lead")}</p>

      <h2 className="habit-section-title">{t("records.redemptions")}</h2>
      <div className="habit-wallet-sheet">
        <ul className="habit-wallet-list">
          {redemptions.map((r, i) => (
            <li key={i} className="habit-wallet-row">
              <div className="habit-wallet-row__main">
                <span className="habit-wallet-row__title">{r.title}</span>
                <span className="habit-wallet-row__subtitle">
                  {new Date(r.redeemed_at).toLocaleString(locale, {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <span className="habit-wallet-row__amt habit-wallet-row__amt--neg">
                −{r.cost_points}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <h2 className="habit-section-title">{t("records.daily")}</h2>
      <div className="habit-card">
        <p className="habit-muted">{t("records.dailyDesc")}</p>
        <button
          type="button"
          className="habit-btn habit-btn--secondary"
          onClick={() => setErr(null)}
        >
          {t("records.settle")}
        </button>
      </div>

      {err ? <p className="habit-error">{err}</p> : null}
    </>
  );
}
