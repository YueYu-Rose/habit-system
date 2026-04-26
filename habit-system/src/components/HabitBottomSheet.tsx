import { useEffect, type ReactNode } from "react";

type HabitBottomSheetProps = {
  title: string;
  titleId: string;
  onClose: () => void;
  onBackdropClick?: () => void;
  children: ReactNode;
  /** 可选：在滚动区下方固定一条（如双按钮时不要把删除滚没） */
  footer?: ReactNode;
  /**
   * default：显示「取消」+「×」
   * iconOnly：仅显示灰色 X 形图标（用于新建任务等）
   */
  closeButton?: "default" | "iconOnly";
};

/**
 * 底部抽屉：85vh 上限 + 主体内独立滚动、隐藏滚动条、顶部可关闭
 */
export function HabitBottomSheet({
  title,
  titleId,
  onClose,
  onBackdropClick,
  children,
  footer,
  closeButton = "default",
}: HabitBottomSheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="habit-sheet-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) (onBackdropClick ?? onClose)();
      }}
    >
      <div
        className="habit-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="habit-sheet-handle-wrap" aria-hidden>
          <div className="habit-sheet-handle" />
        </div>

        <div className="habit-sheet-head">
          <h3 id={titleId} className="habit-sheet-title habit-sheet-title--left">
            {title}
          </h3>
          <div className="habit-sheet-head__actions">
            {closeButton === "iconOnly" ? (
              <button type="button" className="habit-sheet-close-x" onClick={onClose} aria-label="关闭">
                <svg
                  className="habit-sheet-close-icon-svg"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            ) : (
              <>
                <button type="button" className="habit-sheet-close-text" onClick={onClose}>
                  取消
                </button>
                <button type="button" className="habit-sheet-close-x" onClick={onClose} aria-label="关闭">
                  ×
                </button>
              </>
            )}
          </div>
        </div>

        <div className="habit-sheet-scroll">
          {children}
        </div>
        {footer != null ? <div className="habit-sheet-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
