import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatAuthErrorForUi, useAuth } from "../context/AuthContext";
import { useHabitToast } from "../context/HabitToastContext";
import { useLanguage } from "../context/LanguageContext";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { isSupabaseConfigured } from "../lib/supabase";

const OTP_COOLDOWN_SEC = 60;

type TabMode = "login" | "register";

export function AuthPage() {
  const navigate = useNavigate();
  const { loginWithPassword, sendRegisterOtp, registerWithOtpAndPassword } = useAuth();
  const { toast } = useHabitToast();
  const { t } = useLanguage();
  const [mode, setMode] = useState<TabMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cooldown === 0) return;
    const id = window.setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const resetRegisterFlow = () => {
    setOtp("");
    setCodeSent(false);
    setCooldown(0);
  };

  const setModeWithReset = (m: TabMode) => {
    setMode(m);
    setPassword("");
    resetRegisterFlow();
  };

  const onSendRegisterCode = async () => {
    if (busy || cooldown > 0) return;
    const em = email.trim();
    if (!em) {
      toast({ title: t("auth.toast.fillRegister"), tone: "negative" });
      return;
    }
    setBusy(true);
    try {
      const r = await sendRegisterOtp(email);
      if (!r.ok) {
        toast({ title: formatAuthErrorForUi(r, t), tone: "negative" });
        return;
      }
      setCodeSent(true);
      setOtp("");
      setCooldown(OTP_COOLDOWN_SEC);
      const a = isSupabaseConfigured() ? t("auth.toast.codeSentEmail") : t("auth.toast.codeSent");
      const b = t("auth.codeSent.tip");
      toast({ title: `${a} ${b}`, tone: "positive" });
    } finally {
      setBusy(false);
    }
  };

  const onRegisterSubmit = async () => {
    if (busy) return;
    if (!codeSent) {
      toast({ title: t("auth.toast.sendCodeFirst"), tone: "negative" });
      return;
    }
    setBusy(true);
    try {
      const r = await registerWithOtpAndPassword(email, otp, password);
      if (!r.ok) {
        toast({ title: formatAuthErrorForUi(r, t), tone: "negative" });
        return;
      }
      toast({ title: t("auth.toast.registerOkLoggedIn"), tone: "positive" });
      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const onLoginSubmit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await loginWithPassword(email, password);
      if (!r.ok) {
        toast({ title: formatAuthErrorForUi(r, t), tone: "negative" });
        return;
      }
      toast({ title: t("auth.toast.loginOk"), tone: "positive" });
      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="habit-auth-page habit-auth-page--air">
      <div className="habit-auth-card habit-auth-card--air">
        <div className="habit-auth-header-row">
          <LanguageSwitcher />
        </div>
        <h1 className="habit-auth-title habit-auth-title--hero">
          {mode === "login" ? t("auth.title.login") : t("auth.title.register")}
        </h1>

        <div className="habit-auth-pill-row" role="tablist" aria-label={t("auth.title.login") + " / " + t("auth.title.register")}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={`habit-auth-pill${mode === "login" ? " habit-auth-pill--active" : ""}`}
            onClick={() => setModeWithReset("login")}
          >
            {t("auth.title.login")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={`habit-auth-pill${mode === "register" ? " habit-auth-pill--active" : ""}`}
            onClick={() => setModeWithReset("register")}
          >
            {t("auth.title.register")}
          </button>
        </div>

        {mode === "login" ? (
          <div className="habit-auth-stack habit-auth-stack--air">
            <label className="habit-auth-label" htmlFor="auth-email">
              {t("auth.email")}
            </label>
            <input
              id="auth-email"
              className="habit-auth-line"
              type="email"
              autoComplete="email"
              inputMode="email"
              enterKeyHint="next"
              placeholder={t("auth.ph.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="habit-auth-label" htmlFor="auth-password">
              {t("auth.password")}
            </label>
            <input
              id="auth-password"
              className="habit-auth-line"
              type="password"
              autoComplete="current-password"
              enterKeyHint="go"
              placeholder={t("auth.ph.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="button"
              className="habit-auth-primary"
              disabled={busy}
              onClick={() => void onLoginSubmit()}
            >
              {t("auth.submit")}
            </button>
          </div>
        ) : (
          <div className="habit-auth-stack habit-auth-stack--air">
            <label className="habit-auth-label" htmlFor="reg-email">
              {t("auth.email")}
            </label>
            <input
              id="reg-email"
              className="habit-auth-line"
              type="email"
              autoComplete="email"
              inputMode="email"
              enterKeyHint="next"
              placeholder={t("auth.ph.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="habit-auth-label" htmlFor="reg-otp">
              {t("auth.code")}
            </label>
            <div className="habit-auth-code-row habit-auth-code-row--air">
              <div className="habit-auth-code-input-wrap">
                <input
                  id="reg-otp"
                  className="habit-auth-line habit-auth-line--in-row"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  enterKeyHint="next"
                  placeholder={t("auth.ph.otp6")}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <button
                type="button"
                className="habit-auth-send-pill"
                disabled={busy || cooldown > 0}
                onClick={() => void onSendRegisterCode()}
              >
                {cooldown > 0 ? t("auth.sendCode.cooldown", { n: cooldown }) : t("auth.sendCode")}
              </button>
            </div>

            <label className="habit-auth-label" htmlFor="reg-password">
              {t("auth.password")}
            </label>
            <input
              id="reg-password"
              className="habit-auth-line"
              type="password"
              autoComplete="new-password"
              enterKeyHint="go"
              placeholder={t("auth.ph.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="button"
              className="habit-auth-primary"
              disabled={busy}
              onClick={() => void onRegisterSubmit()}
            >
              {t("auth.submitRegister")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
