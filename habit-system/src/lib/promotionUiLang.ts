/**
 * 推广版 UI 语言（与 LanguageContext 使用同一 localStorage 键，避免入口种子与首屏不同步）
 */
const STORAGE_PROMOTION = "habit.ui.lang.v1.promotion";
/** 与旧版 LanguageContext 一致，首访可回退 */
const STORAGE_LEGACY = "habit.ui.lang";

export function readPromotionUiLang(): "zh" | "en" {
  try {
    if (typeof localStorage === "undefined") return "en";
    const r = localStorage.getItem(STORAGE_PROMOTION) ?? localStorage.getItem(STORAGE_LEGACY);
    if (r === "en" || r === "zh") return r;
  } catch {
    /* ignore */
  }
  return "en";
}
