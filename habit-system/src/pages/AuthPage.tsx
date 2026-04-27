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
  const { sendEmailOtp, verifyEmailOtp } = useAuth();
  const { toast } = useHabitToast();
  const { t } = useLanguage();
  const [mode, setMode] = useState<TabMode>("login");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cooldown === 0) return;
    const id = window.setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const setModeWithReset = (m: TabMode) => {
    setMode(m);
    setOtpSent(false);
    setOtp("");
    setCooldown(0);
  };

  const onSend = async () => {
    if (busy || cooldown > 0) return;
    const em = email.trim();
    if (!em) {
      toast({ title: t("auth.toast.fillLogin"), tone: "negative" });
      return;
    }
    setBusy(true);
    try {
      const shouldCreateUser = mode === "register";
      const r = await sendEmailOtp(email, shouldCreateUser);
      if (!r.ok) {
        toast({ title: formatAuthErrorForUi(r, t), tone: "negative" });
        return;
      }
      setOtpSent(true);
      setOtp("");
      setCooldown(OTP_COOLDOWN_SEC);
      toast({
        title: isSupabaseConfigured() ? t("auth.toast.codeSentEmail") : t("auth.toast.codeSent"),
        tone: "positive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await verifyEmailOtp(email, otp);
      if (!r.ok) {
        toast({ title: formatAuthErrorForUi(r, t), tone: "negative" });
        return;
      }
      toast({
        title: mode === "login" ? t("auth.toast.loginOk") : t("auth.toast.registerOkLoggedIn"),
        tone: "positive",
      });
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
        <p className="habit-auth-subtitle" style={{ marginBottom: 14 }}>
          {t("auth.otp.lead")}
        </p>

        <div className="habit-task-kind-row" style={{ marginBottom: 14 }}>
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

        <label className="habit-form-label" htmlFor="auth-email">
          {t("auth.email")}
        </label>
        <input
          id="auth-email"
          className="habit-input-minimal habit-input-minimal--auth-otp"
          type="email"
          placeholder={t("auth.ph.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
        />

        <div className="habit-auth-otp-actions">
          <button
            type="button"
            className="habit-auth-otp-btn habit-auth-otp-btn--send"
            disabled={busy || cooldown > 0}
            onClick={() => void onSend()}
          >
            {cooldown > 0 ? t("auth.sendCode.cooldown", { n: cooldown }) : t("auth.sendCode")}
          </button>
        </div>

        {otpSent ? (
          <>
            <label className="habit-form-label" htmlFor="auth-otp">
              {t("auth.code")}
            </label>
            <input
              id="auth-otp"
              className="habit-auth-otp-digits"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder={t("auth.ph.otp8")}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
              aria-describedby="auth-otp-hint"
            />
            <p id="auth-otp-hint" className="habit-auth-otp-micro">
              {t("auth.otp.hint")}
            </p>
            <button
              type="button"
              className="habit-auth-otp-btn habit-auth-otp-btn--primary"
              disabled={busy}
              onClick={() => void onVerify()}
            >
              {t("auth.submitVerify")}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
