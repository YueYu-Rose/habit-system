import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useHabitToast } from "../context/HabitToastContext";
import { useLanguage } from "../context/LanguageContext";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

type TabMode = "login" | "register";

export function AuthPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { toast } = useHabitToast();
  const { t } = useLanguage();
  const [mode, setMode] = useState<TabMode>("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);

  useEffect(() => {
    if (codeCooldown <= 0) return;
    const id = window.setTimeout(() => {
      setCodeCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearTimeout(id);
  }, [codeCooldown]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok =
        mode === "login"
          ? await login(email, password)
          : await register(email, code, password);
      if (!ok) {
        toast({
          title: mode === "login" ? t("auth.toast.fillLogin") : t("auth.toast.fillRegister"),
          tone: "negative",
        });
        return;
      }
      toast({ title: mode === "login" ? t("auth.toast.loginOk") : t("auth.toast.registerOk"), tone: "positive" });
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
            onClick={() => setMode("login")}
          >
            {t("auth.title.login")}
          </button>
          <button
            type="button"
            className={`habit-task-kind-pill${mode === "register" ? " habit-task-kind-pill--active" : ""}`}
            onClick={() => setMode("register")}
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

        {mode === "register" ? (
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

        <button type="button" className="habit-btn habit-btn--force-white" disabled={busy} onClick={() => void submit()}>
          {mode === "login" ? t("auth.submit") : t("auth.submitRegister")}
        </button>
      </div>
    </div>
  );
}
