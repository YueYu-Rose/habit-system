import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAppConfig } from "../config/appConfig";
import { useLanguage } from "../context/LanguageContext";
import { HabitThemeSwitcher } from "./HabitThemeSwitcher";
import { HabitToastHost } from "./HabitToastHost";
import { LanguageSwitcher } from "./LanguageSwitcher";

function navActive(pathname: string, to: string): boolean {
  if (to === "/me") return pathname === "/me" || pathname.startsWith("/me/");
  return pathname === to;
}

export function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const { mode } = useAppConfig();
  const { t } = useLanguage();
  const showLanguageSwitcher = mode === "PROMOTION";
  const nav = [
    { to: "/", label: t("nav.checkin") },
    { to: "/tasks", label: t("nav.mainline") },
    { to: "/rewards", label: t("nav.rewards") },
    { to: "/me", label: t("nav.report") },
  ] as const;

  return (
    <div className="habit-device-stage">
      <div className="habit-device-frame">
        <div className="habit-device-island" aria-hidden />
        <div className="habit-device-screen">
          <div className="habit-app">
            <main className="habit-main">
              <header className="habit-header">
                <div className="habit-header__top">
                  <div>
                    <h1 className="habit-brand">{t("brand.title")}</h1>
                    <p className="habit-header__subtitle habit-muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
                      {t("brand.subtitle")}
                    </p>
                    <p className="habit-tagline">{t("brand.tagline")}</p>
                  </div>
                  <div className="habit-header__tools">
                    {showLanguageSwitcher ? <LanguageSwitcher /> : null}
                    <HabitThemeSwitcher />
                  </div>
                </div>
              </header>
              {children}
            </main>
            <nav className="habit-bottom-nav" aria-label={t("nav.mainNav")}>
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`habit-nav-link${navActive(loc.pathname, item.to) ? " habit-nav-link--active" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <HabitToastHost />
            {/* 悬浮层挂载点：FAB / Modal 经 portal 渲染到这里，避开 .habit-main 的 overflow 裁剪 */}
            <div id="habit-overlay-root" className="habit-overlay-root" />
          </div>
        </div>
      </div>
    </div>
  );
}
