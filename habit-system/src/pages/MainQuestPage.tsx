import { useLanguage } from "../context/LanguageContext";
import { useMainlineLoop } from "../context/MainlineLoopContext";
import { MainlineTaskCard } from "../components/MainlineTaskCard";

/**
 * 主线：活跃目标 + 荣誉墙（已归档，读同一 LocalStorage 上下文，归档后立即刷新）
 */
export function MainQuestPage() {
  const { t } = useLanguage();
  const { state } = useMainlineLoop();

  return (
    <>
      <p className="habit-muted habit-page-lead">{t("main.lead")}</p>
      <MainlineTaskCard />

      <section className="habit-mainquest-honor" aria-label="archived mainlines">
        <h2 className="habit-mainquest-honor__title">{t("main.honor.title")}</h2>
        <p className="habit-mainquest-honor__lead">{t("main.honor.lead")}</p>
        <ul className="habit-milestone-wall" style={{ marginBottom: 0 }}>
          {state.archived.length === 0 ? (
            <li className="habit-milestone-empty habit-milestone-empty--center">
              {t("main.honor.empty")}
            </li>
          ) : (
            state.archived.map((a) => (
              <li key={a.id} className="habit-milestone-card">
                <div className="habit-milestone-card__name">{a.name}</div>
                <div className="habit-milestone-card__sub">
                  {t("main.honor.final")}{" "}
                  <span className="habit-milestone-card__pts">{a.finalPoints}</span> {t("main.honor.ptsUnit")}
                </div>
                <div className="habit-milestone-card__date">{a.endedAt}</div>
              </li>
            ))
          )}
        </ul>
      </section>
    </>
  );
}
