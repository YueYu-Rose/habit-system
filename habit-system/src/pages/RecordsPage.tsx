import { useEffect, useState } from "react";
import { habitFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useAppConfig } from "../config/appConfig";
import { todayIsoLocal } from "../lib/dateLocal";

export function RecordsPage() {
  const { lang, t } = useLanguage();
  const { mode } = useAppConfig();
  const { isLoggedIn } = useAuth();
  const canUseApi = mode === "PROMOTION" && isLoggedIn;
  const [redemptions, setRedemptions] = useState<{ title: string; cost_points: number; redeemed_at: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const locale = lang === "en" ? "en-GB" : "zh-CN";

  useEffect(() => {
    if (!canUseApi) {
      setRedemptions([]);
      setErr(null);
      return;
    }
    habitFetch<{ rows: { title: string; cost_points: number; redeemed_at: string }[] }>("/api/habit/redemptions")
      .then((x) => setRedemptions(x.rows))
      .catch((e) => setErr(String(e)));
  }, [canUseApi]);

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
          onClick={async () => {
            if (!canUseApi) {
              setErr(null);
              return;
            }
            try {
              await habitFetch(`/api/habit/settle/${todayIsoLocal()}`, { method: "POST" });
              setErr(null);
            } catch (e) {
              setErr(String(e));
            }
          }}
        >
          {t("records.settle")}
        </button>
      </div>

      {err ? <p className="habit-error">{err}</p> : null}
    </>
  );
}
