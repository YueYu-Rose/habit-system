import { THEME_IDS, THEMES } from "../theme/themes";
import { useAppTheme } from "../theme/ThemeContext";

export function ThemeSwitcher() {
  const { themeId, setThemeId } = useAppTheme();

  return (
    <div className="theme-switcher" role="group" aria-label="Color Theme">
      <span className="theme-switcher__label">Theme</span>
      <div className="theme-switcher__pills">
        {THEME_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`theme-switcher__pill${themeId === id ? " theme-switcher__pill--active" : ""}`}
            onClick={() => setThemeId(id)}
            aria-pressed={themeId === id}
          >
            <span
              className="theme-switcher__swatch"
              style={{ background: THEMES[id].primary }}
              aria-hidden
            />
            {THEMES[id].label}
          </button>
        ))}
      </div>
    </div>
  );
}
