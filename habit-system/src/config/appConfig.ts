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
  /** 推广版无后端，打卡/习惯/奖励全部走 LocalStorage，禁止 habitFetch */
  isPromotionOffline: mode === "PROMOTION",
} as const;

export function useAppConfig() {
  return appConfig;
}
