import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useHabitToast } from "../context/HabitToastContext";
import { useLanguage } from "../context/LanguageContext";
import { todayIsoLocal } from "../lib/dateLocal";
import { loadHabitCatalog } from "../lib/habitListStorage";
import { buildHabitLedgerRowsFromCatalog } from "../lib/reportLedgerFromCatalog";
import {
  loadDailyCloseRows,
  loadRewardRedemptions,
  upsertDailyCloseRow,
  type DailyCloseRow,
  type RewardRedemptionRow,
} from "../lib/rewardHistoryStorage";

export function RecordsPage() {
  const { lang, t } = useLanguage();
  const { toast } = useHabitToast();
  const [redemptions, setRedemptions] = useState<RewardRedemptionRow[]>([]);
  const [dailyCloseRows, setDailyCloseRows] = useState<DailyCloseRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const locale = lang === "en" ? "en-GB" : "zh-CN";
  const today = todayIsoLocal();

  const todayNet = useMemo(() => {
    const catalog = loadHabitCatalog();
    const todayRows = buildHabitLedgerRowsFromCatalog(catalog, today, today, lang);
    return todayRows.reduce((sum, row) => sum + row.amount, 0);
  }, [lang, today]);

  useEffect(() => {
    setRedemptions(loadRewardRedemptions());
    setDailyCloseRows(loadDailyCloseRows());
    setErr(null);
  }, []);

  const settleToday = () => {
    setErr(null);
    try {
      const row = upsertDailyCloseRow(today, todayNet);
      setDailyCloseRows(loadDailyCloseRows());
      toast({ title: t("records.toast.settleOk"), points: row.net_points, tone: row.net_points >= 0 ? "positive" : "negative" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <p className="habit-muted habit-page-lead">{t("records.lead")}</p>
      <div className="habit-records-overview">
        <div className="habit-row-card habit-records-overview__card">
          <span className="habit-records-overview__label">{t("records.summary.redemptions")}</span>
          <strong className="habit-records-overview__value">{redemptions.length}</strong>
        </div>
        <div className="habit-row-card habit-records-overview__card">
          <span className="habit-records-overview__label">{t("records.summary.daily")}</span>
          <strong className="habit-records-overview__value">{dailyCloseRows.length}</strong>
        </div>
      </div>

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
        {redemptions.length === 0 ? (
          <div style={{ padding: "0 12px 12px" }}>
            <p className="habit-muted">{t("records.redemptions.empty")}</p>
            <Link to="/rewards" className="habit-link-btn habit-btn habit-btn--secondary">
              {t("records.redemptions.cta")}
            </Link>
          </div>
        ) : null}
      </div>

      <h2 className="habit-section-title">{t("records.daily")}</h2>
      <div className="habit-card">
        <p className="habit-muted">{t("records.dailyDesc", { net: todayNet })}</p>
        <button
          type="button"
          className="habit-btn habit-btn--secondary"
          onClick={settleToday}
        >
          {t("records.settle")}
        </button>
      </div>
      <div className="habit-wallet-sheet">
        <ul className="habit-wallet-list">
          {dailyCloseRows.map((r) => (
            <li key={r.id} className="habit-wallet-row">
              <div className="habit-wallet-row__main">
                <span className="habit-wallet-row__title">{r.date}</span>
                <span className="habit-wallet-row__subtitle">
                  {new Date(r.closed_at).toLocaleString(locale, {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <span className={`habit-wallet-row__amt ${r.net_points >= 0 ? "habit-wallet-row__amt--pos" : "habit-wallet-row__amt--neg"}`}>
                {r.net_points >= 0 ? `+${r.net_points}` : `−${Math.abs(r.net_points)}`}
              </span>
            </li>
          ))}
        </ul>
        {dailyCloseRows.length === 0 ? (
          <div style={{ padding: "0 12px 12px" }}>
            <p className="habit-muted">{t("records.daily.empty")}</p>
            <Link to="/" className="habit-link-btn habit-btn habit-btn--secondary">
              {t("records.daily.cta")}
            </Link>
          </div>
        ) : null}
      </div>

      {err ? <p className="habit-error">{err}</p> : null}
    </>
  );
}
