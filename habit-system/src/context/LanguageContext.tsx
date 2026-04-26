import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { EN } from "../locales/en";
import { ZH, type TransKey } from "../locales/zh";

const STORAGE_KEY = "habit.ui.lang";

export type Lang = "zh" | "en";

const dict: Record<Lang, Record<TransKey, string>> = {
  zh: ZH,
  en: EN,
};

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    k in vars ? String(vars[k as keyof typeof vars]) : `{{${k}}}`
  );
}

function readLang(): Lang {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r === "en" || r === "zh") return r;
  } catch {
    /* ignore */
  }
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("en")) {
    return "en";
  }
  return "zh";
}

export type LanguageContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TransKey, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readLang());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang === "en" ? "en-GB" : "zh-CN";
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const t = useCallback(
    (key: TransKey, vars?: Record<string, string | number>) => {
      const raw = dict[lang][key] ?? dict.zh[key] ?? String(key);
      return interpolate(raw, vars);
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const c = useContext(LanguageContext);
  if (!c) throw new Error("useLanguage 必须在 LanguageProvider 内使用");
  return c;
}
