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
} as const;

export function useAppConfig() {
  return appConfig;
}
