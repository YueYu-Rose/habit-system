import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME_ID,
  THEMES,
  type ThemeDefinition,
  type ThemeId,
} from "./themes";

const STORAGE_KEY = "todo-list-theme";

type ThemeContextValue = {
  themeId: ThemeId;
  theme: ThemeDefinition;
  setThemeId: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "purple" || raw === "blue" || raw === "pink") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME_ID;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => readStoredTheme());

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const theme = THEMES[themeId];

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-pink", "theme-blue", "theme-purple");
    root.classList.add(`theme-${themeId}`);
  }, [themeId]);

  const value = useMemo(
    () => ({ themeId, theme, setThemeId }),
    [themeId, theme, setThemeId]
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className="theme-root">{children}</div>
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within ThemeProvider");
  return ctx;
}
