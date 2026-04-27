import type { AuthError } from "@supabase/supabase-js";
import type { TransKey } from "../locales/zh";

/** 与 locales 中 auth.error.* 键一致，供 t() 使用 */
export type AuthErrorTransKey = Extract<
  TransKey,
  | "auth.error.emailTaken"
  | "auth.error.weakPassword"
  | "auth.error.invalidCredentials"
  | "auth.error.invalidEmail"
  | "auth.error.invalidOtp"
  | "auth.error.missingEmail"
  | "auth.error.missingPassword"
  | "auth.error.missingOtp"
  | "auth.error.rateLimit"
  | "auth.error.network"
  | "auth.error.missingFields"
  | "auth.error.generic"
>;

type RawAuth = Pick<AuthError, "message"> & { code?: string; status?: number };

/**
 * 将 Supabase / GoTrue 错误映射为 i18n 键，便于中英展示
 */
export function classifySupabaseAuthError(err: RawAuth | null | undefined): {
  key: AuthErrorTransKey;
  /** 用于 auth.error.generic 的 {{detail}} */
  detail?: string;
} {
  if (!err?.message) {
    return { key: "auth.error.generic", detail: "" };
  }
  const m = err.message;
  const lower = m.toLowerCase();
  const code = String((err as AuthError).code ?? "").toLowerCase();

  if (code === "user_already_exists" || /already registered|already been registered|user already exists/i.test(m)) {
    return { key: "auth.error.emailTaken" };
  }
  if (
    code === "weak_password" ||
    /password should be at least|at least \d+ character|password is too short|password.*weak|too short/i.test(lower)
  ) {
    return { key: "auth.error.weakPassword" };
  }
  if (code === "invalid_credentials" || /invalid login credentials|invalid email or password|wrong password/i.test(lower)) {
    return { key: "auth.error.invalidCredentials" };
  }
  if (
    code === "otp_expired" ||
    /invalid token|invalid otp|token has expired|otp|verification code|wrong code/i.test(lower)
  ) {
    return { key: "auth.error.invalidOtp" };
  }
  if (code === "email_address_invalid" || /invalid email|email format|email address is invalid/i.test(lower)) {
    return { key: "auth.error.invalidEmail" };
  }
  if (code === "over_email_send_rate_limit" || /rate limit|too many requests|too many email/i.test(lower)) {
    return { key: "auth.error.rateLimit" };
  }
  if (/network|fetch|failed to fetch|connection/i.test(lower)) {
    return { key: "auth.error.network" };
  }

  return { key: "auth.error.generic", detail: m };
}
