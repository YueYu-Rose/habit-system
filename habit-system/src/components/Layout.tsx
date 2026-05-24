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
  const { t } = useLanguage();
  const { mode } = useAppConfig();
  const nav = [
    { to: "/", label: t("nav.checkin") },
    { to: "/tasks", label: t("nav.mainline") },
    { to: "/rewards", label: t("nav.rewards") },
    { to: "/me", label: t("nav.report") },
  ] as const;

  return (
    <div className="habit-shell flex h-screen w-full bg-gray-50 overflow-hidden">
      <nav
        className="habit-bottom-nav fixed bottom-0 left-0 w-full flex justify-around border-t z-50 md:w-64 md:flex-col md:fixed md:left-0 md:top-0 md:h-screen md:border-r md:border-t-0 md:justify-start"
        aria-label={t("nav.mainNav")}
      >
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

      <main className="habit-main-content pb-20 md:ml-64 md:pb-0">
        <div className="habit-main-content__inner max-w-5xl mx-auto p-6">
          <header className={`habit-header${mode === "PROMOTION" ? " habit-header--promotion" : ""}`}>
            <div className="habit-header__top">
              <div className="habit-header__intro">
                <h1 className="habit-brand">{t("brand.title")}</h1>
              </div>
              <div className="habit-header__tools">
                <LanguageSwitcher />
                <HabitThemeSwitcher />
              </div>
            </div>
          </header>
          {children}
        </div>
      </main>
      <HabitToastHost />
      {/* 悬浮层挂载点：FAB / Modal 经 portal 渲染到这里，避开主内容滚动裁剪 */}
      <div id="habit-overlay-root" className="habit-overlay-root" />
    </div>
  );
}
