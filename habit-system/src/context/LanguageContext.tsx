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
import { readPromotionUiLang } from "../lib/promotionUiLang";

const STORAGE_PERSONAL = "habit.ui.lang.v1.personal";
const STORAGE_PROMOTION = "habit.ui.lang.v1.promotion";

function isPromotionBuild(): boolean {
  return String(import.meta.env.VITE_APP_MODE ?? "PERSONAL").toUpperCase() === "PROMOTION";
}

function storageKeyForBuild(): string {
  return isPromotionBuild() ? STORAGE_PROMOTION : STORAGE_PERSONAL;
}

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
    if (isPromotionBuild()) {
      return readPromotionUiLang();
    }
    const p = localStorage.getItem(STORAGE_PERSONAL);
    if (p === "en" || p === "zh") return p;
  } catch {
    /* ignore */
  }
  // 个人版仅读独立 key，不回退到旧全局键，避免之前存的 en 把个人版变全英；默认中文
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
      localStorage.setItem(storageKeyForBuild(), lang);
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
