import { useHabitToast } from "../context/HabitToastContext";

/** 扣分/撤销：浅色底 + 酒红字，保证对比度；加分仍用深色胶囊 + 绿字 */
export function HabitToastHost() {
  const { current, dismiss } = useHabitToast();
  if (!current) {
    return <div className="habit-toast-layer" aria-live="polite" aria-atomic="true" />;
  }

  const { title, points, tone, id, actionLabel, onAction, position, variant } = current;
  const sign = typeof points === "number" && points >= 0 ? "+" : "";
  const pointsText = typeof points === "number" ? `${sign}${points}` : null;
  const isNeg = tone === "negative";
  const isAi = variant === "ai";
  const aiText = isAi && title.startsWith("✨") ? title.replace(/^✨\s*/, "") : title;

  return (
    <div className={`habit-toast-layer${position === "top" ? " habit-toast-layer--top" : ""}`} aria-live="polite" aria-atomic="true">
      <div
        key={id}
        className={`habit-toast-pill habit-toast-pill--${tone}${isNeg ? " habit-toast-pill--negative-light" : ""}${isAi ? " habit-toast-pill--ai" : ""}`}
        role="status"
      >
        {isAi ? (
          <span className="habit-toast-title habit-toast-title--ai">
            <span className="habit-toast-title__spark" aria-hidden>
              ✨
            </span>
            <span>{aiText}</span>
          </span>
        ) : (
          <span className={`habit-toast-title${isNeg ? " habit-toast-title--neg-light" : ""}`}>{title}</span>
        )}
        {pointsText != null ? (
          <span
            className={`habit-toast-points habit-toast-points--${tone}${isNeg ? " habit-toast-points--neg-light" : ""}`}
            aria-label={`积分 ${pointsText}`}
          >
            {pointsText}
          </span>
        ) : null}
        {actionLabel && onAction ? (
          <button
            type="button"
            className={`habit-toast-action${isNeg ? " habit-toast-action--neg-light" : ""}`}
            onClick={() => {
              dismiss();
              onAction();
            }}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
