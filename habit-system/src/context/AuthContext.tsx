import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  /** 无 Supabase 时：本机会话 token（仍走同一套登录态 UI） */
  token: string;
  /** Session 引导失败（可重试） */
  authBootstrapError: string | null;
  /** 超过 5s 仍未完成引导 */
  authBootstrapTimedOut: boolean;
  /** 登录后拉取习惯/奖励/主线失败（不阻塞进入应用） */
  remoteDataPullError: string | null;
  retryAuthBootstrap: () => void;
  clearRemoteDataPullError: () => void;
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
  const [authBootstrapError, setAuthBootstrapError] = useState<string | null>(null);
  const [authBootstrapTimedOut, setAuthBootstrapTimedOut] = useState(false);
  const [remoteDataPullError, setRemoteDataPullError] = useState<string | null>(null);
  const [sessionBootKey, setSessionBootKey] = useState(0);
  const [mockSession, setMockSession] = useState<AuthSession>(() => {
    if (isSupabaseConfigured()) {
      return { loggedIn: false, email: "", token: "" };
    }
    return loadAuthSession();
  });
  const bootstrapCompleteRef = useRef(false);

  const clearRemoteDataPullError = useCallback(() => setRemoteDataPullError(null), []);

  const retryAuthBootstrap = useCallback(() => {
    if (!isSupabaseConfigured()) return;
    setAuthBootstrapError(null);
    setAuthBootstrapTimedOut(false);
    setRemoteDataPullError(null);
    setResolving(true);
    setSessionBootKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setResolving(false);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    bootstrapCompleteRef.current = false;

    const finishBootstrap = () => {
      if (!cancelled) {
        bootstrapCompleteRef.current = true;
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        setResolving(false);
      }
    };

    timeoutId = setTimeout(() => {
      if (!bootstrapCompleteRef.current && !cancelled) {
        console.warn("[auth] bootstrap timeout 5s — unblocking UI");
        setResolving(false);
        setAuthBootstrapTimedOut(true);
      }
    }, 5000);

    const run = async () => {
      console.log("1. Fetching session...");
      try {
        const sb = getSupabase()!;
        const {
          data: { session },
          error: sessionError,
        } = await sb.auth.getSession();

        if (cancelled) return;

        if (sessionError) {
          console.error("🔥 Supabase Fetch Error:", sessionError);
          setAuthBootstrapError(sessionError.message || "getSession error");
          return;
        }

        const u = session?.user ?? null;
        setUser(u);
        setRemoteDataUserId(u?.id ?? null);
        setAuthBootstrapTimedOut(false);

        if (u) {
          // 不阻塞首屏：会话就绪后立即结束 boot；云端拉取在后台静默进行（乐观 + 与本地优先）
          console.log("2. Fetching habits (pullAllUserData) in background…");
          void (async () => {
            try {
              await pullAllUserDataForUser(u.id);
              setRemoteDataPullError(null);
              setAuthBootstrapError(null);
            } catch (e) {
              console.error("🔥 Supabase Fetch Error:", e);
              const msg = e instanceof Error ? e.message : String(e);
              setRemoteDataPullError(msg);
            }
          })();
        }
      } catch (e) {
        console.error("🔥 Supabase Fetch Error:", e);
        const msg = e instanceof Error ? e.message : String(e);
        setAuthBootstrapError(msg);
      } finally {
        finishBootstrap();
      }
    };

    void run();

    const sb = getSupabase()!;
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setRemoteDataUserId(u?.id ?? null);
      if (event === "SIGNED_IN" && u) {
        console.log("2. Fetching habits (onAuthStateChange SIGNED_IN) in background…");
        void (async () => {
          try {
            await pullAllUserDataForUser(u.id);
            setRemoteDataPullError(null);
          } catch (e) {
            console.error("🔥 Supabase Fetch Error:", e);
            const msg = e instanceof Error ? e.message : String(e);
            setRemoteDataPullError(msg);
          }
        })();
      }
    });

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [sessionBootKey]);

  /* PROMOTION 未登录时写入本机默认习惯/奖励模板，保证首屏可用 */
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
    setAuthBootstrapError(null);
    setAuthBootstrapTimedOut(false);
    setRemoteDataPullError(null);
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
      authBootstrapError,
      authBootstrapTimedOut,
      remoteDataPullError,
      retryAuthBootstrap,
      clearRemoteDataPullError,
      loginWithPassword,
      sendRegisterOtp,
      registerWithOtpAndPassword,
      logout,
    }),
    [
      resolving,
      isLoggedIn,
      email,
      user,
      token,
      authBootstrapError,
      authBootstrapTimedOut,
      remoteDataPullError,
      retryAuthBootstrap,
      clearRemoteDataPullError,
      loginWithPassword,
      sendRegisterOtp,
      registerWithOtpAndPassword,
      logout,
    ]
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
