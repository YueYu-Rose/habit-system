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
  sendEmailOtp: (email: string, shouldCreateUser: boolean) => Promise<SendOtpResult>;
  verifyEmailOtp: (email: string, token: string) => Promise<LoginResult>;
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

  const sendEmailOtp = useCallback(async (email: string, shouldCreateUser: boolean): Promise<SendOtpResult> => {
    const em = email.trim();
    if (!em) {
      return { ok: false, errorKey: "auth.error.missingEmail" };
    }
    if (!isSupabaseConfigured()) {
      return { ok: true };
    }
    const { error } = await getSupabase()!.auth.signInWithOtp({
      email: em,
      options: { shouldCreateUser },
    });
    if (error) {
      const { key, detail } = classifySupabaseAuthError(error);
      return { ok: false, errorKey: key, errorDetail: detail };
    }
    return { ok: true };
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, token: string): Promise<LoginResult> => {
    const em = email.trim();
    const raw = token.replace(/\D/g, "");
    if (!em) {
      return { ok: false, errorKey: "auth.error.missingEmail" };
    }
    if (!raw) {
      return { ok: false, errorKey: "auth.error.missingOtp" };
    }
    if (!/^\d{8}$/.test(raw)) {
      return { ok: false, errorKey: "auth.error.invalidOtp" };
    }
    if (!isSupabaseConfigured()) {
      const next = { loggedIn: true, email: em.toLowerCase(), token: mockToken() };
      saveAuthSession(next);
      setMockSession(next);
      initHabitThemeOnLoad(appConfig.mode);
      return { ok: true };
    }
    /** 邮箱数字验证码：GoTrue 使用 `type: 'email'`，与 signInWithOtp 的登录/注册场景均一致。 */
    const { error } = await getSupabase()!.auth.verifyOtp({ email: em, token: raw, type: "email" });
    if (error) {
      const { key, detail } = classifySupabaseAuthError(error);
      return { ok: false, errorKey: key, errorDetail: detail };
    }
    initHabitThemeOnLoad(appConfig.mode);
    return { ok: true };
  }, []);

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
      sendEmailOtp,
      verifyEmailOtp,
      logout,
    }),
    [resolving, isLoggedIn, email, user, token, sendEmailOtp, verifyEmailOtp, logout]
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
