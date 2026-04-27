import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { appConfig } from "../config/appConfig";
import { initHabitThemeOnLoad } from "../theme/habitTheme";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import { classifySupabaseAuthError, type AuthErrorTransKey } from "../lib/authErrorI18n";
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  type AuthSession,
} from "../lib/authSessionStorage";
import { ensureMockSeedForPromotion } from "../lib/mockStorage";
import { pullAllUserDataForUser, setRemoteDataUserId } from "../lib/userDataRemote";

export type LoginResult = { ok: true } | { ok: false; errorKey: AuthErrorTransKey; errorDetail?: string };

export type SendOtpResult = { ok: true } | { ok: false; errorKey: AuthErrorTransKey; errorDetail?: string };

type AuthContextValue = {
  isAuthResolving: boolean;
  isLoggedIn: boolean;
  email: string;
  user: User | null;
  /** 无 Supabase 时沿用本地 mock 会话 token */
  token: string;
  loginWithPassword: (email: string, password: string) => Promise<LoginResult>;
  /** 注册：向邮箱发送验证码（新用户应创建） */
  sendRegisterOtp: (email: string) => Promise<SendOtpResult>;
  /** 注册：校验邮箱 OTP 后设置密码以完成账户 */
  registerWithOtpAndPassword: (email: string, otp: string, password: string) => Promise<LoginResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const mockToken = () => `habit_mwt_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [resolving, setResolving] = useState(!!isSupabaseConfigured());
  const [mockSession, setMockSession] = useState<AuthSession>(() => {
    if (isSupabaseConfigured()) {
      return { loggedIn: false, email: "", token: "" };
    }
    return loadAuthSession();
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setResolving(false);
      return;
    }
    const sb = getSupabase()!;
    void sb.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setRemoteDataUserId(u?.id ?? null);
      if (u) {
        void pullAllUserDataForUser(u.id);
      }
      setResolving(false);
    });
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setRemoteDataUserId(u?.id ?? null);
      if (event === "SIGNED_IN" && u) {
        try {
          await pullAllUserDataForUser(u.id);
        } catch (e) {
          console.error("[auth] pull user data", e);
        }
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /* 推广未登录时保留 LocalStorage Mock 种子 */
  useEffect(() => {
    if (resolving) return;
    if (appConfig.mode !== "PROMOTION") return;
    const loggedIn = isSupabaseConfigured() ? Boolean(user) : mockSession.loggedIn;
    if (loggedIn) return;
    ensureMockSeedForPromotion();
  }, [resolving, user, mockSession.loggedIn]);

  const loginWithPassword = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const em = email.trim();
    if (!em) {
      return { ok: false, errorKey: "auth.error.missingEmail" };
    }
    if (!password) {
      return { ok: false, errorKey: "auth.error.missingPassword" };
    }
    if (!isSupabaseConfigured()) {
      const next = { loggedIn: true, email: em.toLowerCase(), token: mockToken() };
      saveAuthSession(next);
      setMockSession(next);
      initHabitThemeOnLoad(appConfig.mode);
      return { ok: true };
    }
    const { error } = await getSupabase()!.auth.signInWithPassword({ email: em, password });
    if (error) {
      const { key, detail } = classifySupabaseAuthError(error);
      return { ok: false, errorKey: key, errorDetail: detail };
    }
    initHabitThemeOnLoad(appConfig.mode);
    return { ok: true };
  }, []);

  const sendRegisterOtp = useCallback(async (email: string): Promise<SendOtpResult> => {
    const em = email.trim();
    if (!em) {
      return { ok: false, errorKey: "auth.error.missingEmail" };
    }
    if (!isSupabaseConfigured()) {
      return { ok: true };
    }
    const { error } = await getSupabase()!.auth.signInWithOtp({
      email: em,
      options: { shouldCreateUser: true },
    });
    if (error) {
      const { key, detail } = classifySupabaseAuthError(error);
      return { ok: false, errorKey: key, errorDetail: detail };
    }
    return { ok: true };
  }, []);

  const registerWithOtpAndPassword = useCallback(
    async (email: string, token: string, password: string): Promise<LoginResult> => {
      const em = email.trim();
      const raw = token.replace(/\D/g, "");
      if (!em) {
        return { ok: false, errorKey: "auth.error.missingEmail" };
      }
      if (!raw) {
        return { ok: false, errorKey: "auth.error.missingOtp" };
      }
      if (!/^\d{6}$/.test(raw)) {
        return { ok: false, errorKey: "auth.error.invalidOtp" };
      }
      if (!password || password.length < 6) {
        return { ok: false, errorKey: "auth.error.weakPassword" };
      }
      if (!isSupabaseConfigured()) {
        const next = { loggedIn: true, email: em.toLowerCase(), token: mockToken() };
        saveAuthSession(next);
        setMockSession(next);
        initHabitThemeOnLoad(appConfig.mode);
        return { ok: true };
      }
      const sb = getSupabase()!;
      const { error: vErr } = await sb.auth.verifyOtp({ email: em, token: raw, type: "email" });
      if (vErr) {
        const { key, detail } = classifySupabaseAuthError(vErr);
        return { ok: false, errorKey: key, errorDetail: detail };
      }
      const { error: pErr } = await sb.auth.updateUser({ password });
      if (pErr) {
        const { key, detail } = classifySupabaseAuthError(pErr);
        void sb.auth.signOut();
        return { ok: false, errorKey: key, errorDetail: detail };
      }
      initHabitThemeOnLoad(appConfig.mode);
      return { ok: true };
    },
    []
  );

  const logout = useCallback(() => {
    if (isSupabaseConfigured()) {
      void getSupabase()!.auth.signOut();
      setUser(null);
      setRemoteDataUserId(null);
    }
    clearAuthSession();
    setMockSession({ loggedIn: false, email: "", token: "" });
  }, []);

  const isLoggedIn = isSupabaseConfigured() ? Boolean(user) : mockSession.loggedIn;
  const email = (isSupabaseConfigured() ? user?.email : mockSession.email) ?? "";
  const token = mockSession.token;

  const value = useMemo(
    () => ({
      isAuthResolving: resolving,
      isLoggedIn,
      email,
      user: isSupabaseConfigured() ? user : null,
      token,
      loginWithPassword,
      sendRegisterOtp,
      registerWithOtpAndPassword,
      logout,
    }),
    [resolving, isLoggedIn, email, user, token, loginWithPassword, sendRegisterOtp, registerWithOtpAndPassword, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return ctx;
}

/** 将登录/注册错误结果转为可展示的文案（含 i18n 与 {{detail}}） */
export function formatAuthErrorForUi(
  r: { ok: false; errorKey: AuthErrorTransKey; errorDetail?: string },
  t: (key: import("../locales/zh").TransKey, vars?: Record<string, string | number>) => string
): string {
  if (r.errorKey === "auth.error.generic") {
    const d = r.errorDetail?.trim();
    return t("auth.error.generic", { detail: d && d.length > 0 ? d : "—" });
  }
  return t(r.errorKey);
}
