/**
 * 全屏首屏加载骨架（避免长时间仅显示一句 Loading）
 */
export function AppLoadingSkeleton() {
  return (
    <div
      className="habit-app-skeleton"
      style={{
        minHeight: "70vh",
        maxWidth: 520,
        margin: "0 auto",
        padding: "24px 20px 120px",
        boxSizing: "border-box",
      }}
      aria-busy
      aria-label="Loading"
    >
      <div
        className="habit-skeleton-pulse"
        style={{ height: 22, width: "40%", borderRadius: 8, marginBottom: 20, background: "var(--habit-skeleton, #e8e4ea)" }}
      />
      <div
        className="habit-skeleton-pulse"
        style={{ height: 14, width: "55%", borderRadius: 6, marginBottom: 24, background: "var(--habit-skeleton, #e8e4ea)" }}
      />
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div className="habit-skeleton-pulse" style={{ flex: 1, height: 72, borderRadius: 14, background: "var(--habit-skeleton, #e8e4ea)" }} />
        <div className="habit-skeleton-pulse" style={{ flex: 1, height: 72, borderRadius: 14, background: "var(--habit-skeleton, #e8e4ea)" }} />
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="habit-skeleton-pulse"
          style={{ height: 64, borderRadius: 14, marginBottom: 10, background: "var(--habit-skeleton, #e8e4ea)" }}
        />
      ))}
      <style>{`
        @keyframes habit-skeleton-shimmer {
          0% { opacity: 0.55; }
          50% { opacity: 0.9; }
          100% { opacity: 0.55; }
        }
        .habit-skeleton-pulse { animation: habit-skeleton-shimmer 1.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
