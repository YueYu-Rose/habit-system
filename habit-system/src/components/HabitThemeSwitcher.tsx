import { useEffect, useState } from "react";
import { HABIT_THEME_DEFINITIONS, HABIT_THEME_ORDER } from "../theme/habitThemes";
import { useAppConfig } from "../config/appConfig";
import {
  DEFAULT_HABIT_THEME,
  getStoredHabitTheme,
  PROMOTION_DEFAULT_HABIT_THEME,
  setHabitTheme,
  type HabitThemeId,
} from "../theme/habitTheme";
import { useLanguage } from "../context/LanguageContext";

export function HabitThemeSwitcher() {
  const { t } = useLanguage();
  const { mode } = useAppConfig();
  const [id, setId] = useState<HabitThemeId>(() => {
    return (
      getStoredHabitTheme() ?? (mode === "PROMOTION" ? PROMOTION_DEFAULT_HABIT_THEME : DEFAULT_HABIT_THEME)
    );
  });

  useEffect(() => {
    setId(getStoredHabitTheme() ?? (mode === "PROMOTION" ? PROMOTION_DEFAULT_HABIT_THEME : DEFAULT_HABIT_THEME));
  }, [mode]);

  return (
    <div className="habit-theme-switcher" role="group" aria-label={t("theme.aria")}>
      {HABIT_THEME_ORDER.map((t) => (
        <button
          key={t}
          type="button"
          className={`habit-theme-switcher__btn${id === t ? " habit-theme-switcher__btn--active" : ""}`}
          onClick={() => {
            setHabitTheme(t);
            setId(t);
          }}
          aria-pressed={id === t}
        >
          <span
            className="habit-theme-switcher__dot"
            style={{ background: HABIT_THEME_DEFINITIONS[t].primary }}
            aria-hidden
          />
          {HABIT_THEME_DEFINITIONS[t].label}
        </button>
      ))}
    </div>
  );
}
