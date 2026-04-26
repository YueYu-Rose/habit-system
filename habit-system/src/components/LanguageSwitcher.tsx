import { useLanguage } from "../context/LanguageContext";

/** 紧凑语言切换：中 / EN */
export function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();
  return (
    <div className="habit-lang-switch" role="group" aria-label={t("lang.switcherAria")}>
      <button
        type="button"
        className={`habit-lang-switch__btn${lang === "zh" ? " habit-lang-switch__btn--on" : ""}`}
        onClick={() => setLang("zh")}
        aria-pressed={lang === "zh"}
      >
        {t("lang.zh")}
      </button>
      <button
        type="button"
        className={`habit-lang-switch__btn${lang === "en" ? " habit-lang-switch__btn--on" : ""}`}
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
      >
        {t("lang.en")}
      </button>
    </div>
  );
}
