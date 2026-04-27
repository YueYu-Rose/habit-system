export type AppMode = "PERSONAL" | "PROMOTION";

function resolveMode(): AppMode {
  const raw = String(import.meta.env.VITE_APP_MODE ?? "PERSONAL").toUpperCase();
  return raw === "PROMOTION" ? "PROMOTION" : "PERSONAL";
}

const mode = resolveMode();

export const appConfig = {
  mode,
  showAuth: mode === "PROMOTION",
  showAI: mode === "PERSONAL",
  showExternalIntegration: mode === "PERSONAL",
  /** 公网轻量变体可仅依赖本机存储；打卡/习惯/奖励走 LocalStorage，不强制接私有后端 */
  isPromotionOffline: mode === "PROMOTION",
} as const;

export function useAppConfig() {
  return appConfig;
}
