/**
 * Development-only: obtain GOOGLE_REFRESH_TOKEN via browser OAuth.
 * Mount at /api/dev/google-oauth — see README.md (Google Calendar OAuth).
 */
import { Router } from "express";
import {
  getGoogleOAuthRedirectUri,
  getGoogleOAuthCredentials,
  GOOGLE_CALENDAR_SCOPES,
} from "../config/googleOAuth.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createGoogleOAuthDevRouter(): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const { clientId, clientSecret } = getGoogleOAuthCredentials();
    if (!clientId || !clientSecret) {
      res
        .status(400)
        .type("html")
        .send(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Google OAuth</title></head><body>
            <p>Set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in <code>.env</code>, then reload.</p>
            <p>See <strong>README.md</strong> → Google Calendar OAuth.</p>
          </body></html>`
        );
      return;
    }

    void (async () => {
      try {
        const { google } = await import("googleapis");
        const redirectUri = getGoogleOAuthRedirectUri();
        const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        const url = oauth2.generateAuthUrl({
          access_type: "offline",
          prompt: "consent",
          scope: [...GOOGLE_CALENDAR_SCOPES],
        });
        res.redirect(url);
      } catch (e) {
        console.error("[dev/google-oauth] failed to build auth URL:", e);
        res.status(500).type("text").send(e instanceof Error ? e.message : String(e));
      }
    })();
  });

  router.get("/callback", (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const err = typeof req.query.error === "string" ? req.query.error : undefined;
    const errDesc = typeof req.query.error_description === "string" ? req.query.error_description : undefined;

    if (err) {
      res.status(400).type("html").send(
        `<!DOCTYPE html><html><body><p>Authorization failed: ${escapeHtml(err)}</p>${
          errDesc ? `<p>${escapeHtml(errDesc)}</p>` : ""
        }</body></html>`
      );
      return;
    }
    if (!code) {
      res.status(400).type("html").send("<!DOCTYPE html><html><body><p>Missing <code>code</code> query parameter.</p></body></html>");
      return;
    }

    const { clientId, clientSecret } = getGoogleOAuthCredentials();
    if (!clientId || !clientSecret) {
      res.status(500).type("text").send("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing");
      return;
    }

    void (async () => {
      try {
        const { google } = await import("googleapis");
        const redirectUri = getGoogleOAuthRedirectUri();
        const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        const { tokens } = await oauth2.getToken(code);
        const refresh = tokens.refresh_token;
        const envLine = refresh ? `GOOGLE_REFRESH_TOKEN=${refresh}` : "";

        const debugTokens = {
          scope: tokens.scope,
          token_type: tokens.token_type,
          expiry_date: tokens.expiry_date,
          refresh_token: refresh ? "(present — copy line above)" : "(missing)",
          access_token: tokens.access_token ? "(present)" : "(missing)",
        };

        res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Google OAuth — copy refresh token</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 52rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    code, pre { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 4px; word-break: break-all; }
    pre { padding: 1rem; overflow: auto; }
    .warn { color: #a60; }
  </style>
</head>
<body>
  <h1>Google Calendar — local development</h1>
  <p>Redirect URI for this flow: <code>${escapeHtml(getGoogleOAuthRedirectUri())}</code> — must match <strong>Authorized redirect URIs</strong> for this OAuth client in Google Cloud Console.</p>
  <p>Add this to your <code>.env</code> (restart the API server after saving):</p>
  <pre>${refresh ? escapeHtml(envLine) : "(no refresh token — see below)"}</pre>
  ${
    !refresh
      ? `<p class="warn">No <strong>refresh_token</strong> in the response. Revoke this app at
      <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">Google Account → Third-party access</a>,
      then run this flow again.</p>`
      : ""
  }
  <p>Token fields (sanitized):</p>
  <pre>${escapeHtml(JSON.stringify(debugTokens, null, 2))}</pre>
  <p><a href="/api/dev/google-oauth">Run authorization again</a></p>
</body>
</html>`);
      } catch (e) {
        console.error("[dev/google-oauth] token exchange failed:", e);
        if (e instanceof Error && e.stack) console.error(e.stack);
        res.status(500).type("html").send(
          `<!DOCTYPE html><html><body><p>Token exchange failed.</p><pre>${escapeHtml(
            e instanceof Error ? e.message : String(e)
          )}</pre></body></html>`
        );
      }
    })();
  });

  return router;
}
