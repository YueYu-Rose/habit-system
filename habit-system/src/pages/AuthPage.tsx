import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatAuthErrorForUi, useAuth } from "../context/AuthContext";
import { useHabitToast } from "../context/HabitToastContext";
import { useLanguage } from "../context/LanguageContext";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { isSupabaseConfigured } from "../lib/supabase";

type TabMode = "login" | "register";

export function AuthPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { toast } = useHabitToast();
  const { t } = useLanguage();
  const [mode, setMode] = useState<TabMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [registerVerifyBanner, setRegisterVerifyBanner] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "login") {
        const r = await login(email, password);
        if (!r.ok) {
          toast({ title: formatAuthErrorForUi(r, t), tone: "negative" });
          return;
        }
        toast({ title: t("auth.toast.loginOk"), tone: "positive" });
        navigate("/", { replace: true });
        return;
      }

      const r = await register(email, password);
      if (!r.ok) {
        toast({ title: formatAuthErrorForUi(r, t), tone: "negative" });
        return;
      }
      if (r.needsEmailVerification) {
        setRegisterVerifyBanner(true);
        setPassword("");
        return;
      }
      toast({ title: t("auth.toast.registerOkLoggedIn"), tone: "positive" });
      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="habit-auth-page">
      <div className="habit-auth-card">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <LanguageSwitcher />
        </div>
        <h1 className="habit-auth-title">{mode === "login" ? t("auth.title.login") : t("auth.title.register")}</h1>

        <div className="habit-task-kind-row" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={`habit-task-kind-pill${mode === "login" ? " habit-task-kind-pill--active" : ""}`}
            onClick={() => {
              setMode("login");
              setRegisterVerifyBanner(false);
            }}
          >
            {t("auth.title.login")}
          </button>
          <button
            type="button"
            className={`habit-task-kind-pill${mode === "register" ? " habit-task-kind-pill--active" : ""}`}
            onClick={() => {
              setMode("register");
            }}
          >
            {t("auth.title.register")}
          </button>
        </div>

        {registerVerifyBanner && mode === "register" && isSupabaseConfigured() ? (
          <div
            className="habit-auth-verify-banner"
            role="status"
            aria-live="polite"
            style={{
              marginBottom: 16,
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid color-mix(in srgb, var(--color-primary) 40%, #e5e7eb)",
              background: "color-mix(in srgb, var(--theme-primary-soft) 55%, #ffffff)",
            }}
          >
            <p style={{ margin: 0, fontWeight: 700, fontSize: "1.02rem", color: "var(--habit-text)" }}>
              {t("auth.register.verifyTitle")}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--habit-text)" }}>
              {t("auth.register.verifyBody")}
            </p>
            <button
              type="button"
              className="habit-btn habit-btn--secondary"
              style={{ marginTop: 12, width: "100%" }}
              onClick={() => {
                setRegisterVerifyBanner(false);
                setMode("login");
              }}
            >
              {t("auth.register.verifyCta")}
            </button>
          </div>
        ) : null}

        {!registerVerifyBanner || mode === "login" ? (
          <>
            <label className="habit-form-label" htmlFor="auth-email">
              {t("auth.email")}
            </label>
            <input
              id="auth-email"
              className="habit-input-minimal"
              type="email"
              placeholder={t("auth.ph.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <label className="habit-form-label" htmlFor="auth-password">
              {t("auth.password")}
            </label>
            <input
              id="auth-password"
              className="habit-input-minimal"
              type="password"
              placeholder={t("auth.ph.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

          </>
        ) : null}

        {mode === "register" && registerVerifyBanner ? null : (
          <button
            type="button"
            className="habit-btn habit-btn--force-white"
            style={{ marginTop: 4 }}
            disabled={busy}
            onClick={() => void submit()}
          >
            {mode === "login" ? t("auth.submit") : t("auth.submitRegister")}
          </button>
        )}
      </div>
    </div>
  );
}
