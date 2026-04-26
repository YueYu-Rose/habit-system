/**
 * Redirect URI must match exactly in Google Cloud Console (OAuth client → Authorized redirect URIs)
 * and must be the same when refreshing tokens in googleCalendarSync.
 */
export function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (v == null || v === "") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

export function getGoogleOAuthRedirectUri(): string {
  return trimEnv("GOOGLE_OAUTH_REDIRECT_URI") ?? "http://localhost:3001/api/dev/google-oauth/callback";
}

/** Client id / secret / refresh token — trimmed to avoid stray whitespace in `.env`. */
export function getGoogleOAuthCredentials(): {
  clientId: string | undefined;
  clientSecret: string | undefined;
  refreshToken: string | undefined;
} {
  return {
    clientId: trimEnv("GOOGLE_CLIENT_ID"),
    clientSecret: trimEnv("GOOGLE_CLIENT_SECRET"),
    refreshToken: trimEnv("GOOGLE_REFRESH_TOKEN"),
  };
}

export const GOOGLE_CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"] as const;

/** Appended to API errors when Google returns invalid_grant (refresh token dead / client mismatch). */
export const GOOGLE_INVALID_GRANT_HINT =
  "invalid_grant usually means the refresh token is no longer valid, or GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_OAUTH_REDIRECT_URI do not match the OAuth client that issued the token. Regenerate GOOGLE_REFRESH_TOKEN via GET http://localhost:3001/api/dev/google-oauth (API must run on PORT=3001). See README.md → Google Calendar OAuth.";
