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
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  type AuthSession,
} from "../lib/authSessionStorage";
import { ensureMockSeedForPromotion } from "../lib/mockStorage";
import { pullAllUserDataForUser, setRemoteDataUserId } from "../lib/userDataRemote";

export type AuthResult = { ok: boolean; error?: string };

type AuthContextValue = {
  isAuthResolving: boolean;
  isLoggedIn: boolean;
  email: string;
  user: User | null;
  /** 无 Supabase 时沿用本地 mock 会话 token */
  token: string;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, code: string, password: string) => Promise<AuthResult>;
  sendLoginOtp: (email: string) => Promise<AuthResult>;
  completeLoginWithOtp: (email: string, token: string) => Promise<AuthResult>;
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
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
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

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const em = email.trim();
    const pw = password.trim();
    if (!em || !pw) return { ok: false, error: "Missing email or password" };
    if (!isSupabaseConfigured()) {
      const next = { loggedIn: true, email: em.toLowerCase(), token: mockToken() };
      saveAuthSession(next);
      setMockSession(next);
      initHabitThemeOnLoad(appConfig.mode);
      return { ok: true };
    }
    const { data, error } = await getSupabase()!.auth.signInWithPassword({ email: em, password: pw });
    if (error) return { ok: false, error: error.message };
    void data;
    initHabitThemeOnLoad(appConfig.mode);
    return { ok: true };
  }, []);

  const register = useCallback(async (email: string, code: string, password: string): Promise<AuthResult> => {
    const em = email.trim();
    const pw = password.trim();
    if (!isSupabaseConfigured()) {
      if (!em || !code.trim() || !pw) return { ok: false, error: "Please fill in all fields" };
      const next = { loggedIn: true, email: em.toLowerCase(), token: mockToken() };
      saveAuthSession(next);
      setMockSession(next);
      initHabitThemeOnLoad(appConfig.mode);
      return { ok: true };
    }
    if (!em || !pw) return { ok: false, error: "Please fill in email and password" };
    const { error } = await getSupabase()!.auth.signUp({ email: em, password: pw });
    if (error) return { ok: false, error: error.message };
    initHabitThemeOnLoad(appConfig.mode);
    return { ok: true };
  }, []);

  const sendLoginOtp = useCallback(async (email: string): Promise<AuthResult> => {
    const em = email.trim();
    if (!em) return { ok: false, error: "Email required" };
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "OTP login requires Supabase" };
    }
    const { error } = await getSupabase()!.auth.signInWithOtp({
      email: em,
      options: { shouldCreateUser: true },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  const completeLoginWithOtp = useCallback(async (email: string, token: string): Promise<AuthResult> => {
    const em = email.trim();
    const t = token.trim();
    if (!em || !t) return { ok: false, error: "Email and code required" };
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "OTP login requires Supabase" };
    }
    const { error } = await getSupabase()!.auth.verifyOtp({
      email: em,
      token: t,
      type: "email",
    });
    if (error) return { ok: false, error: error.message };
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
      login,
      register,
      sendLoginOtp,
      completeLoginWithOtp,
      logout,
    }),
    [
      resolving,
      isLoggedIn,
      email,
      user,
      token,
      login,
      register,
      sendLoginOtp,
      completeLoginWithOtp,
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
