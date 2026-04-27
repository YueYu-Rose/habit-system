import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

function getHabitOverlayRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("habit-overlay-root");
}

/** 挂到 #habit-overlay-root，限制在手机壳内。首屏同步解析挂载点，避免 FAB/抽屉晚一帧才出现 */
export function OverlayPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(() => getHabitOverlayRoot());
  useLayoutEffect(() => {
    setTarget(getHabitOverlayRoot() ?? null);
  }, []);
  if (!target) return null;
  return createPortal(children, target);
}
