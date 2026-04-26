import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type HabitToastTone = "default" | "positive" | "negative";

/**
 * Toast 入参（结构化）：
 * - title：事项名（扣分时用酒红色高亮）
 * - points：变动分数（正→清新绿；负→酒红）
 * - tone：显式指定色调；未指定时由 points 推断
 */
export type HabitToastPayload = {
  title: string;
  points?: number;
  tone?: HabitToastTone;
  durationMs?: number;
  position?: "bottom" | "top";
  variant?: "default" | "ai";
  actionLabel?: string;
  onAction?: () => void;
};

type ToastItem = HabitToastPayload & {
  id: number;
  tone: HabitToastTone;
};

type HabitToastContextValue = {
  /** 简便调用；支持 `toast("文本")` 或 `toast({ title, points, tone })` */
  toast: (payload: string | HabitToastPayload, tone?: HabitToastTone) => void;
  dismiss: () => void;
  current: ToastItem | null;
};

const HabitToastContext = createContext<HabitToastContextValue | null>(null);

/** 自动消失时长（ms）：进入 ~220ms + 停留 1780ms */
const DISPLAY_MS = 2000;

function inferTone(points: number | undefined, explicit: HabitToastTone | undefined): HabitToastTone {
  if (explicit) return explicit;
  if (typeof points === "number") {
    if (points > 0) return "positive";
    if (points < 0) return "negative";
  }
  return "default";
}

export function HabitToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setCurrent(null);
  }, []);

  const toast = useCallback(
    (payload: string | HabitToastPayload, toneArg?: HabitToastTone) => {
      const p: HabitToastPayload =
        typeof payload === "string" ? { title: payload, tone: toneArg } : payload;
      if (!p.title && p.points == null) return;
      seqRef.current += 1;
      const next: ToastItem = {
        ...p,
        id: seqRef.current,
        tone: inferTone(p.points, p.tone),
      };
      setCurrent(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCurrent((prev) => (prev && prev.id === next.id ? null : prev));
        timerRef.current = null;
      }, p.durationMs ?? DISPLAY_MS);
    },
    []
  );

  const value = useMemo(() => ({ toast, dismiss, current }), [toast, dismiss, current]);

  return (
    <HabitToastContext.Provider value={value}>{children}</HabitToastContext.Provider>
  );
}

export function useHabitToast(): HabitToastContextValue {
  const ctx = useContext(HabitToastContext);
  if (!ctx) {
    throw new Error("useHabitToast 必须在 HabitToastProvider 内使用");
  }
  return ctx;
}
