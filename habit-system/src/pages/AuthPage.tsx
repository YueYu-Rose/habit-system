import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useHabitToast } from "../context/HabitToastContext";
import { useLanguage } from "../context/LanguageContext";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { isSupabaseConfigured } from "../lib/supabase";

type TabMode = "login" | "register";

export function AuthPage() {
  const navigate = useNavigate();
  const { login, register, sendLoginOtp, completeLoginWithOtp } = useAuth();
  const { toast } = useHabitToast();
  const { t } = useLanguage();
  const [mode, setMode] = useState<TabMode>("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [useOtpLogin, setUseOtpLogin] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (codeCooldown <= 0) return;
    const id = window.setTimeout(() => {
      setCodeCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [codeCooldown]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isSupabaseConfigured() && mode === "login" && useOtpLogin) {
        const r = await completeLoginWithOtp(email, code);
        if (!r.ok) {
          toast({ title: r.error ?? t("auth.toast.fillLogin"), tone: "negative" });
          return;
        }
        toast({ title: t("auth.toast.loginOk"), tone: "positive" });
        navigate("/", { replace: true });
        return;
      }
      if (isSupabaseConfigured() && mode === "login" && !useOtpLogin) {
        const r = await login(email, password);
        if (!r.ok) {
          toast({ title: r.error ?? t("auth.toast.fillLogin"), tone: "negative" });
          return;
        }
        toast({ title: t("auth.toast.loginOk"), tone: "positive" });
        navigate("/", { replace: true });
        return;
      }
      if (isSupabaseConfigured() && mode === "register") {
        const r = await register(email, "", password);
        if (!r.ok) {
          toast({ title: r.error ?? t("auth.toast.fillRegister"), tone: "negative" });
          return;
        }
        toast({ title: t("auth.toast.registerOk"), tone: "positive" });
        navigate("/", { replace: true });
        return;
      }
      if (!isSupabaseConfigured() && mode === "login") {
        const r = await login(email, password);
        if (!r.ok) {
          toast({ title: t("auth.toast.fillLogin"), tone: "negative" });
          return;
        }
        toast({ title: t("auth.toast.loginOk"), tone: "positive" });
        navigate("/", { replace: true });
        return;
      }
      if (!isSupabaseConfigured() && mode === "register") {
        const r = await register(email, code, password);
        if (!r.ok) {
          toast({ title: t("auth.toast.fillRegister"), tone: "negative" });
          return;
        }
        toast({ title: t("auth.toast.registerOk"), tone: "positive" });
        navigate("/", { replace: true });
        return;
      }
    } finally {
      setBusy(false);
    }
  };

  const supa = isSupabaseConfigured();
  const registerEmailOnly = supa;

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
              setUseOtpLogin(false);
              setOtpSent(false);
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

        {mode === "register" && !registerEmailOnly ? (
          <>
            <label className="habit-form-label" htmlFor="auth-code">
              {t("auth.code")}
            </label>
            <div className="habit-auth-code-row">
              <div className="habit-auth-code-input-wrap">
                <input
                  id="auth-code"
                  className="habit-input-minimal habit-input-minimal--code-row"
                  type="text"
                  placeholder={t("auth.ph.code")}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                />
              </div>
              <button
                type="button"
                className="habit-btn habit-btn--secondary habit-auth-code-send"
                disabled={codeCooldown > 0}
                onClick={() => {
                  if (codeCooldown > 0) return;
                  setCodeCooldown(60);
                  toast({ title: t("auth.toast.codeSentEmail"), tone: "positive" });
                }}
              >
                {codeCooldown > 0 ? t("auth.sendCode.cooldown", { n: codeCooldown }) : t("auth.sendCode")}
              </button>
            </div>
          </>
        ) : null}

        {mode === "login" && supa ? (
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <button
              type="button"
              className="habit-btn habit-btn--secondary"
              style={{ width: "100%", fontSize: 13 }}
              onClick={() => {
                setUseOtpLogin((v) => !v);
                setOtpSent(false);
                setCode("");
              }}
            >
              {useOtpLogin ? "Use password instead" : "Sign in with email code"}
            </button>
            {useOtpLogin ? (
              <button
                type="button"
                className="habit-btn habit-btn--secondary"
                style={{ width: "100%", marginTop: 8, fontSize: 13 }}
                disabled={busy || !email.trim() || codeCooldown > 0}
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  try {
                    const r = await sendLoginOtp(email);
                    if (r.ok) {
                      setOtpSent(true);
                      setCodeCooldown(60);
                      toast({ title: t("auth.toast.codeSentEmail"), tone: "positive" });
                    } else {
                      toast({ title: r.error ?? "Failed to send", tone: "negative" });
                    }
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {codeCooldown > 0
                  ? t("auth.sendCode.cooldown", { n: codeCooldown })
                  : "Send one-time code to email"}
              </button>
            ) : null}
          </div>
        ) : null}

        {mode === "login" && (!supa || !useOtpLogin) ? (
          <>
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
              autoComplete="current-password"
            />
          </>
        ) : null}

        {mode === "login" && supa && useOtpLogin ? (
          <>
            <label className="habit-form-label" htmlFor="auth-otp">
              {t("auth.code")}
            </label>
            <input
              id="auth-otp"
              className="habit-input-minimal"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t("auth.ph.code")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {otpSent ? (
              <p className="habit-muted" style={{ fontSize: 12, marginTop: 6 }}>
                Check your email for the code.
              </p>
            ) : null}
          </>
        ) : null}

        {mode === "register" && supa ? (
          <>
            <label className="habit-form-label" htmlFor="reg-password">
              {t("auth.password")}
            </label>
            <input
              id="reg-password"
              className="habit-input-minimal"
              type="password"
              placeholder={t("auth.ph.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <p className="habit-muted" style={{ fontSize: 12, marginTop: 8 }}>
              We use Supabase Auth. If email confirmation is on in the dashboard, check your inbox.
            </p>
          </>
        ) : null}

        {mode === "register" && !supa ? (
          <>
            <label className="habit-form-label" htmlFor="reg-password-legacy">
              {t("auth.password")}
            </label>
            <input
              id="reg-password-legacy"
              className="habit-input-minimal"
              type="password"
              placeholder={t("auth.ph.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </>
        ) : null}

        <button
          type="button"
          className="habit-btn habit-btn--force-white"
          disabled={busy}
          onClick={() => void submit()}
        >
          {mode === "login" ? t("auth.submit") : t("auth.submitRegister")}
        </button>
      </div>
    </div>
  );
}
