import type { ReactNode } from "react";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function boldLine(line: string): ReactNode {
  const parts = line.split(/\*\*/);
  if (parts.length === 1) return esc(line);
  return parts.map((p, j) =>
    j % 2 === 1 ? (
      <strong key={j}>{esc(p)}</strong>
    ) : (
      <span key={j}>{esc(p)}</span>
    )
  );
}

/**
 * 仅处理 ##、---、*列表、**粗体**、*斜体*，避免依赖额外包
 */
export function HabitMarkdownLite({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.trim() === "" || line.trim() === "*") {
      out.push(<div key={i} className="habit-coach-md-sp" />);
      continue;
    }
    if (line.trim() === "---" || line.trim() === "***") {
      out.push(<hr key={i} className="habit-coach-md-hr" />);
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(
        <h3 key={i} className="habit-coach-md-h3">
          {boldLine(line.slice(3))}
        </h3>
      );
      continue;
    }
    if (line.trimStart().startsWith("- ") || line.trimStart().startsWith("* ")) {
      const body = line.replace(/^\s*[-*]\s+/, "");
      out.push(
        <div key={i} className="habit-coach-md-li">
          <span className="habit-coach-md-bull" aria-hidden>
            ·
          </span>
          <span className="habit-coach-md-li__body">{boldLine(body)}</span>
        </div>
      );
      continue;
    }
    out.push(
      <p key={i} className="habit-coach-md-p">
        {boldLine(line)}
      </p>
    );
  }
  return <div className="habit-coach-md-root">{out}</div>;
}
