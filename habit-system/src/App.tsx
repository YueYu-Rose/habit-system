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

function GuardedRoute({ allow, element }: { allow: boolean; element: JSX.Element }) {
  if (!allow) return <Navigate to="/auth" replace />;
  return element;
}

export default function App() {
  const { showAuth, isPromotionOffline } = useAppConfig();
  const { isLoggedIn, isAuthResolving } = useAuth();

  if (showAuth && isAuthResolving) {
    return (
      <div className="habit-auth-page" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <p className="habit-muted" style={{ fontSize: 14 }}>
          Loading…
        </p>
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
