import { appConfig } from "../config/appConfig";
import {
  HABIT_THEME_ORDER,
  HABIT_THEME_META_TINT,
  type HabitThemeId,
} from "./habitThemes";
import type { AppMode } from "../config/appConfig";

export type { HabitThemeId };
export const HABIT_THEMES = HABIT_THEME_ORDER;

export const DEFAULT_HABIT_THEME: HabitThemeId = "pink";

/** 推广版首次访问（无本地偏好时）的默认主题 */
export const PROMOTION_DEFAULT_HABIT_THEME: HabitThemeId = "blue";

/** 个人版/通用：用户主题偏好（与历史键 `habit-theme` 兼容） */
export const USER_THEME_PREF_KEY = "user-theme-pref";

/**
 * 推广版专用：与 PERSONAL 的 `user-theme-pref` 隔离，避免同一域名下
 * 因旧数据（如 purple）或从个人版带过来的色值覆盖「推广版默认蓝」。
 */
export const USER_THEME_PREF_PROMO_KEY = "user-theme-pref-promo";

/** @deprecated 使用 {@link USER_THEME_PREF_KEY}；读取时仍兼容 */
export const LEGACY_HABIT_THEME_KEY = "habit-theme";

/** 向后兼容导出 */
export const HABIT_THEME_STORAGE_KEY = USER_THEME_PREF_KEY;

export function isHabitThemeId(v: string): v is HabitThemeId {
  return (HABIT_THEME_ORDER as readonly string[]).includes(v);
}

function getThemeFromKey(key: string): HabitThemeId | null {
  try {
    const v = localStorage.getItem(key);
    if (v && isHabitThemeId(v)) return v;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * 当前构建模式下的已存主题。推广版只读 `user-theme-pref-promo`，
 * 不读 `user-theme-pref`，这样首次进推广站必定走「默认蓝」。
 */
export function getStoredHabitTheme(): HabitThemeId | null {
  if (appConfig.mode === "PROMOTION") {
    return getThemeFromKey(USER_THEME_PREF_PROMO_KEY);
  }
  try {
    let raw = localStorage.getItem(USER_THEME_PREF_KEY);
    if (!raw) raw = localStorage.getItem(LEGACY_HABIT_THEME_KEY);
    if (raw && isHabitThemeId(raw)) {
      if (!localStorage.getItem(USER_THEME_PREF_KEY) && localStorage.getItem(LEGACY_HABIT_THEME_KEY)) {
        localStorage.setItem(USER_THEME_PREF_KEY, raw);
      }
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function applyHabitTheme(theme: HabitThemeId): void {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", HABIT_THEME_META_TINT[theme]);
  }
}

export function setHabitTheme(theme: HabitThemeId): void {
  const primaryKey =
    appConfig.mode === "PROMOTION" ? USER_THEME_PREF_PROMO_KEY : USER_THEME_PREF_KEY;
  try {
    localStorage.setItem(primaryKey, theme);
    if (appConfig.mode === "PERSONAL") {
      try {
        localStorage.setItem(LEGACY_HABIT_THEME_KEY, theme);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  applyHabitTheme(theme);
}

/**
 * 应用启动时解析主题：优先 LocalStorage；无记录时 PERSONAL → Pink，PROMOTION → Blue，并写入持久化。
 * 应在首屏 React 渲染前调用一次（见 main.tsx），也可在登录成功后再次调用以回显。
 */
export function initHabitThemeOnLoad(mode: AppMode): HabitThemeId {
  const stored = getStoredHabitTheme();
  if (stored) {
    applyHabitTheme(stored);
    return stored;
  }
  const initial: HabitThemeId = mode === "PROMOTION" ? PROMOTION_DEFAULT_HABIT_THEME : DEFAULT_HABIT_THEME;
  setHabitTheme(initial);
  return initial;
}

/** 登录/注册成功后从 LocalStorage 重新套用到 DOM，保证与主界面一致 */
export function reapplyStoredHabitTheme(): void {
  const s = getStoredHabitTheme();
  if (s) {
    applyHabitTheme(s);
  }
}
