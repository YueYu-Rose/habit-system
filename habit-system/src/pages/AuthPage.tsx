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
    if (!password) {
      toast({ title: t("auth.toast.registerNeedPassword"), tone: "negative" });
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

  const lead = mode === "login" ? t("auth.login.lead") : t("auth.register.lead");

  return (
    <div className="habit-auth-page">
      <div className="habit-auth-card habit-auth-card--pro">
        <div className="habit-auth-header-row">
          <LanguageSwitcher />
        </div>
        <h1 className="habit-auth-title">{mode === "login" ? t("auth.title.login") : t("auth.title.register")}</h1>
        <p className="habit-auth-subtitle habit-auth-subtitle--pro">{lead}</p>

        <div className="habit-task-kind-row habit-auth-tabs">
          <button
            type="button"
            className={`habit-task-kind-pill${mode === "login" ? " habit-task-kind-pill--active" : ""}`}
            onClick={() => setModeWithReset("login")}
          >
            {t("auth.title.login")}
          </button>
          <button
            type="button"
            className={`habit-task-kind-pill${mode === "register" ? " habit-task-kind-pill--active" : ""}`}
            onClick={() => setModeWithReset("register")}
          >
            {t("auth.title.register")}
          </button>
        </div>

        {mode === "login" ? (
          <div className="habit-auth-stack">
            <label className="habit-form-label" htmlFor="auth-email">
              {t("auth.email")}
            </label>
            <input
              id="auth-email"
              className="habit-auth-field"
              type="email"
              autoComplete="email"
              inputMode="email"
              enterKeyHint="next"
              placeholder={t("auth.ph.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="habit-form-label" htmlFor="auth-password">
              {t("auth.password")}
            </label>
            <input
              id="auth-password"
              className="habit-auth-field"
              type="password"
              autoComplete="current-password"
              enterKeyHint="go"
              placeholder={t("auth.ph.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="button"
              className="habit-btn habit-btn--force-white habit-auth-submit"
              disabled={busy}
              onClick={() => void onLoginSubmit()}
            >
              {t("auth.submit")}
            </button>
          </div>
        ) : (
          <div className="habit-auth-stack">
            <label className="habit-form-label" htmlFor="reg-email">
              {t("auth.email")}
            </label>
            <input
              id="reg-email"
              className="habit-auth-field"
              type="email"
              autoComplete="email"
              inputMode="email"
              enterKeyHint="next"
              placeholder={t("auth.ph.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="habit-form-label" htmlFor="reg-password">
              {t("auth.password")}
            </label>
            <input
              id="reg-password"
              className="habit-auth-field"
              type="password"
              autoComplete="new-password"
              enterKeyHint="next"
              placeholder={t("auth.ph.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="button"
              className="habit-btn habit-btn--force-white habit-auth-submit habit-auth-btn-send"
              disabled={busy || cooldown > 0}
              onClick={() => void onSendRegisterCode()}
            >
              {cooldown > 0 ? t("auth.sendCode.cooldown", { n: cooldown }) : t("auth.sendCode")}
            </button>

            <label className="habit-form-label" htmlFor="reg-otp">
              {t("auth.code")}
            </label>
            <input
              id="reg-otp"
              className="habit-auth-field habit-auth-field--code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              enterKeyHint="go"
              placeholder={t("auth.ph.otp8")}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
              aria-describedby="reg-otp-hint"
            />
            <p id="reg-otp-hint" className="habit-auth-hint">
              {t("auth.otp.hint")}
            </p>

            <button
              type="button"
              className="habit-btn habit-btn--force-white habit-auth-submit"
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
