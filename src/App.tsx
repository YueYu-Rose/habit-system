import { useState } from "react";
import { MainNav } from "./components/MainNav";
import TodoListPage from "./pages/TodoListPage";
import ReportPage from "./pages/ReportPage";

export type AppPage = "todo" | "report";

export default function App() {
  const [page, setPage] = useState<AppPage>("todo");

  return (
    <div className="page" data-app-page={page}>
      <MainNav active={page} onNavigate={setPage} />
      {page === "todo" ? <TodoListPage /> : <ReportPage />}
    </div>
  );
}
