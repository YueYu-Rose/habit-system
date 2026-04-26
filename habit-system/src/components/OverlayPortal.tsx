import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** 挂到 #habit-overlay-root，限制在手机壳内 */
export function OverlayPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.getElementById("habit-overlay-root"));
  }, []);
  if (!target) return null;
  return createPortal(children, target);
}
