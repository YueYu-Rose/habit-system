const AUTH_SESSION_KEY = "habit_auth_session_v1";

export type AuthSession = {
  loggedIn: boolean;
  email: string;
  /** Mock 演示用 token（推广版无真实后端时写入 localStorage） */
  token: string;
};

const empty: AuthSession = {
  loggedIn: false,
  email: "",
  token: "",
};

export function loadAuthSession(): AuthSession {
  if (typeof localStorage === "undefined") return empty;
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    return {
      loggedIn: Boolean(parsed.loggedIn),
      email: typeof parsed.email === "string" ? parsed.email : "",
      token: typeof (parsed as { token?: string }).token === "string" ? (parsed as { token: string }).token : "",
    };
  } catch {
    return empty;
  }
}

export function saveAuthSession(next: AuthSession): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(next));
}

export function clearAuthSession(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(AUTH_SESSION_KEY);
}
