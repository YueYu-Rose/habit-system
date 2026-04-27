import { Routes, Route, Navigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { PromotionLocaleSync } from "./components/PromotionLocaleSync";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { MainQuestPage } from "./pages/MainQuestPage";
import { RewardsPage } from "./pages/RewardsPage";
import { RecordsPage } from "./pages/RecordsPage";
import { ReportPage } from "./pages/ReportPage";
import { AuthPage } from "./pages/AuthPage";
import { useAppConfig } from "./config/appConfig";
import { useAuth } from "./context/AuthContext";
import { useLanguage } from "./context/LanguageContext";

function GuardedRoute({ allow, element }: { allow: boolean; element: JSX.Element }) {
  if (!allow) return <Navigate to="/auth" replace />;
  return element;
}

export default function App() {
  const { showAuth, isPromotionOffline } = useAppConfig();
  const { t } = useLanguage();
  const {
    isLoggedIn,
    isAuthResolving,
    authBootstrapError,
    authBootstrapTimedOut,
    remoteDataPullError,
    retryAuthBootstrap,
    clearRemoteDataPullError,
  } = useAuth();

  if (showAuth && isAuthResolving) {
    return (
      <div className="habit-auth-page" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <p className="habit-muted" style={{ fontSize: 14 }}>
          {t("common.loading")}
        </p>
      </div>
    );
  }

  if (showAuth && !isLoggedIn && (authBootstrapError != null || authBootstrapTimedOut)) {
    return (
      <div className="habit-auth-page habit-auth-page--air" style={{ display: "grid", placeItems: "center", minHeight: "70vh", padding: 16 }}>
        <div
          className="habit-auth-card--air"
          style={{ maxWidth: 400, textAlign: "center", border: "1px solid #fecaca", background: "#fff", padding: 20 }}
        >
          <p className="habit-muted" style={{ fontSize: 15, lineHeight: 1.5, color: "#b91c1c" }}>
            {authBootstrapTimedOut ? t("app.load.timeout") : authBootstrapError}
          </p>
          <button type="button" className="habit-btn" style={{ marginTop: 16, width: "100%" }} onClick={() => retryAuthBootstrap()}>
            {t("app.load.retry")}
          </button>
        </div>
        <Analytics />
      </div>
    );
  }

  if (showAuth && !isLoggedIn) {
    return (
      <>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
        <Analytics />
      </>
    );
  }

  return (
    <Layout>
      {isLoggedIn && showAuth && remoteDataPullError ? (
        <div
          role="alert"
          className="habit-card"
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            fontSize: 13,
            border: "1px solid #fecaca",
            background: "#fff7ed",
            color: "#9a3412",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span>
            {t("app.load.syncFailed")} {remoteDataPullError}
          </span>
          <button
            type="button"
            className="habit-dailylog-edit"
            style={{ flexShrink: 0, border: "none" }}
            onClick={() => clearRemoteDataPullError()}
            aria-label={t("app.load.dismiss")}
          >
            ×
          </button>
        </div>
      ) : null}
      {isPromotionOffline ? <PromotionLocaleSync /> : null}
      <Routes>
        {/* 首页 = 打卡页 */}
        <Route path="/" element={<GuardedRoute allow={!showAuth || isLoggedIn} element={<HomePage />} />} />
        <Route path="/tasks" element={<GuardedRoute allow={!showAuth || isLoggedIn} element={<MainQuestPage />} />} />
        <Route path="/rewards" element={<GuardedRoute allow={!showAuth || isLoggedIn} element={<RewardsPage />} />} />
        <Route path="/me" element={<GuardedRoute allow={!showAuth || isLoggedIn} element={<ReportPage />} />} />
        <Route path="/me/history" element={<GuardedRoute allow={!showAuth || isLoggedIn} element={<RecordsPage />} />} />
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="/me/mainline" element={<Navigate to="/tasks" replace />} />
        {/* 旧路径统一收敛：/record 已删除 */}
        <Route path="/record" element={<Navigate to="/" replace />} />
        <Route path="/daily" element={<Navigate to="/" replace />} />
        <Route path="/records" element={<Navigate to="/me/history" replace />} />
        <Route path="/mainline" element={<Navigate to="/me/mainline" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Analytics />
    </Layout>
  );
}
