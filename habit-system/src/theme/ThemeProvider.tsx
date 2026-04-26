import { useEffect, type ReactNode } from "react";
import { appConfig } from "../config/appConfig";
import { initHabitThemeOnLoad } from "./habitTheme";

/**
 * 与 main.tsx 中的同步初始化配合：处理 StrictMode / 热更新等场景下再次对齐主题。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initHabitThemeOnLoad(appConfig.mode);
  }, []);
  return <>{children}</>;
}
