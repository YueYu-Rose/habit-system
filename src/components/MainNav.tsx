import type { AppPage } from "../App";

type Props = {
  active: AppPage;
  onNavigate: (page: AppPage) => void;
};

export function MainNav({ active, onNavigate }: Props) {
  return (
    <nav className="main-nav" aria-label="Main">
      <button
        type="button"
        className={`main-nav__link${active === "todo" ? " main-nav__link--active" : ""}`}
        onClick={() => onNavigate("todo")}
        aria-current={active === "todo" ? "page" : undefined}
      >
        To Do List
      </button>
      <button
        type="button"
        className={`main-nav__link${active === "report" ? " main-nav__link--active" : ""}`}
        onClick={() => onNavigate("report")}
        aria-current={active === "report" ? "page" : undefined}
      >
        Report
      </button>
    </nav>
  );
}
