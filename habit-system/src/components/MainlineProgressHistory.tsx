import { useLanguage } from "../context/LanguageContext";
import type { MainlineProgressEntry } from "../lib/mainlineLoopStorage";

function formatTraceLine(iso: string, lang: "zh" | "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (lang === "zh") {
    return d.toLocaleString("zh-CN", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return d.toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

type Props = {
  entries: MainlineProgressEntry[] | undefined;
};

export function MainlineProgressHistory({ entries }: Props) {
  const { lang, t } = useLanguage();
  const list = (entries ?? []).slice();
  return (
    <section className="habit-ml-trace" aria-labelledby="habit-ml-trace-title">
      <h2 id="habit-ml-trace-title" className="habit-section-title" style={{ marginTop: 0, marginBottom: 6, fontSize: "1.02rem" }}>
        {t("mainline.trace.title")}
      </h2>
      <p className="habit-muted" style={{ fontSize: 12, margin: "0 0 12px", lineHeight: 1.5 }}>
        {t("mainline.trace.desc")}
      </p>
      {list.length === 0 ? (
        <p className="habit-ml-trace__empty" role="status">
          {t("mainline.trace.empty")}
        </p>
      ) : (
        <ul className="habit-ml-trace__list">
          {list.map((e) => {
            const action =
              e.source === "quick"
                ? t("mainline.trace.quick", { name: e.mainlineName })
                : t("mainline.trace.external", { name: e.mainlineName });
            return (
              <li key={e.id} className="habit-ml-trace__row">
                <div className="habit-ml-trace__dot" aria-hidden />
                <div className="habit-ml-trace__body">
                  <div className="habit-ml-trace__time">{formatTraceLine(e.at, lang as "zh" | "en")}</div>
                  <div className="habit-ml-trace__action">{action}</div>
                </div>
                <div className="habit-ml-trace__amt">+{e.amount}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
