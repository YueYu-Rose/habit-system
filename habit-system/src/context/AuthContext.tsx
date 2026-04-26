import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { appConfig } from "../config/appConfig";
import { initHabitThemeOnLoad } from "../theme/habitTheme";
import { clearAuthSession, loadAuthSession, saveAuthSession } from "../lib/authSessionStorage";

type AuthContextValue = {
  isLoggedIn: boolean;
  email: string;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, code: string, password: string) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(() => loadAuthSession());

  const login = useCallback(async (email: string, password: string) => {
    if (!email.trim() || !password.trim()) return false;
    const next = { loggedIn: true, email: email.trim().toLowerCase() };
    saveAuthSession(next);
    setSession(next);
    initHabitThemeOnLoad(appConfig.mode);
    return true;
  }, []);

  const register = useCallback(async (email: string, code: string, password: string) => {
    if (!email.trim() || !code.trim() || !password.trim()) return false;
    const next = { loggedIn: true, email: email.trim().toLowerCase() };
    saveAuthSession(next);
    setSession(next);
    initHabitThemeOnLoad(appConfig.mode);
    return true;
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setSession({ loggedIn: false, email: "" });
  }, []);

  const value = useMemo(
    () => ({
      isLoggedIn: session.loggedIn,
      email: session.email,
      login,
      register,
      logout,
    }),
    [session.loggedIn, session.email, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return ctx;
}
