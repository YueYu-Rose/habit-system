import { useCallback, useState } from "react";
import { HabitMarkdownLite } from "./HabitMarkdownLite";
import { useLanguage } from "../context/LanguageContext";
import { useAppConfig } from "../config/appConfig";
import { AiCoachError, requestHabitCoachAnalysis } from "../services/aiService";
import { analyzeWeekHabitsFromLocalStorage } from "../lib/weekHabitAnalysis";

/**
 * 复盘页：AI 习惯教练，本地一周数据 + OpenAI-兼容 API / 推广无 Key 时深度 Mock
 */
export function AiCoachBlock() {
  const { t } = useLanguage();
  const { isPromotionOffline: promo } = useAppConfig();
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [summary] = useState(() => {
    try {
      return analyzeWeekHabitsFromLocalStorage();
    } catch {
      return null;
    }
  });

  const run = useCallback(async () => {
    setErr(null);
    setLoading(true);
    setText(null);
    try {
      const out = await requestHabitCoachAnalysis();
      setText(out);
    } catch (e) {
      if (e instanceof AiCoachError && e.code === "NO_KEY") {
        setErr(t("report.coachNoKey"));
      } else {
        setErr((e as Error).message || String(e));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  return (
    <section className="habit-coach-block" aria-label="AI Habit Coach">
      {summary ? (
        <p className="habit-coach-block__narrative habit-muted" style={{ fontSize: 13, marginBottom: 10, lineHeight: 1.55 }}>
          {summary.zhNarrative}
        </p>
      ) : null}
      <p className="habit-coach-block__lead">{t("report.coachLead")}</p>
      <div className="habit-coach-block__row">
        <button
          type="button"
          className="habit-btn habit-coach-block__btn"
          disabled={loading}
          onClick={() => void run()}
        >
          <span className="habit-coach-wand" aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 4l5 5M9 19l-4 4" strokeLinecap="round" />
              <path d="M3 21L14 10l-4-4-7 7v4h4z" fill="color-mix(in srgb, currentColor 12%, transparent)" />
              <path d="M9 4l1 1" strokeLinecap="round" />
              <path d="M4 9h2M6 4v2" strokeLinecap="round" />
            </svg>
          </span>
          {t("report.coachButton")}
        </button>
        {promo ? <span className="habit-muted habit-coach-block__tag">{t("report.coachPromoTag")}</span> : null}
      </div>

      {loading ? (
        <div className="habit-coach-block__loading" role="status" aria-live="polite">
          <div className="habit-coach-orbit" aria-hidden />
          <p className="habit-coach-block__loading-text">{t("report.coachLoading")}</p>
        </div>
      ) : null}

      {err ? <p className="habit-error habit-coach-block__err">{err}</p> : null}
      {text && !loading ? (
        <div className="habit-coach-block__out">
          <HabitMarkdownLite source={text} />
        </div>
      ) : null}
    </section>
  );
}
