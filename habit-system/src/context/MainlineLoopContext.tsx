import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useHabitToast } from "./HabitToastContext";
import { useLanguage } from "./LanguageContext";
import {
  loadMainlineLoopState,
  newArchivedId,
  saveMainlineLoopState,
  type MainlineArchived,
  type MainlineCurrent,
  type MainlineLoopState,
} from "../lib/mainlineLoopStorage";
import { setExternalTaskCompleteHandler, type ExternalTaskCompletePayload } from "../lib/externalTaskBridge";

type MainlineLoopContextValue = {
  state: MainlineLoopState;
  getEffectiveAvailable: (apiAvailable: number) => number;
  spendableDelta: number;
  addQuickPoints: (amount: 10 | 20) => void;
  setCurrentName: (name: string) => void;
  startNewMainline: (name: string) => void;
  archiveAndClearCurrent: (name: string, finalPoints: number) => void;
  trySpendFromLocalPool: (amount: number) => boolean;
  addToLocalPool: (amount: number) => void;
};

const MainlineLoopContext = createContext<MainlineLoopContextValue | null>(null);

export function MainlineLoopProvider({ children }: { children: ReactNode }) {
  const { toast } = useHabitToast();
  const { t } = useLanguage();
  const [state, setState] = useState<MainlineLoopState>(() => loadMainlineLoopState());

  useEffect(() => {
    setState(loadMainlineLoopState());
  }, []);

  const getEffectiveAvailable = useCallback(
    (apiAvailable: number) => Math.max(0, apiAvailable) + (state.spendableDelta || 0),
    [state.spendableDelta]
  );

  const addQuickPoints = useCallback(
    (amount: 10 | 20) => {
      setState((s) => {
        if (!s.current) {
          queueMicrotask(() => toast({ title: t("mainline.toast.noMainline"), tone: "negative" }));
          return s;
        }
        const name = s.current.name.trim() || t("mainline.fallbackName");
        const a = amount;
        const next: MainlineLoopState = {
          ...s,
          spendableDelta: s.spendableDelta + a,
          current: {
            ...s.current,
            cumulativePoints: s.current.cumulativePoints + a,
          },
        };
        saveMainlineLoopState(next);
        queueMicrotask(() => {
          toast({ title: t("mainline.toast.push", { name, a }), points: a, tone: "positive" });
        });
        return next;
      });
    },
    [t, toast]
  );

  const setCurrentName = useCallback((name: string) => {
    setState((s) => {
      if (!s.current) return s;
      const next: MainlineLoopState = {
        ...s,
        current: { ...s.current, name: name.trim() },
      };
      saveMainlineLoopState(next);
      return next;
    });
  }, []);

  const startNewMainline = useCallback((name: string) => {
    const n = name.trim();
    if (!n) return;
    setState((s) => {
      const cur: MainlineCurrent = {
        name: n,
        cumulativePoints: 0,
        createdAt: new Date().toISOString(),
      };
      const next: MainlineLoopState = { ...s, current: cur };
      saveMainlineLoopState(next);
      return next;
    });
  }, []);

  const archiveAndClearCurrent = useCallback((name: string, finalPoints: number) => {
    const row: MainlineArchived = {
      id: newArchivedId(),
      name: name.trim(),
      finalPoints: Math.max(0, Math.round(finalPoints)),
      endedAt: new Date().toISOString().slice(0, 10),
    };
    setState((s) => {
      const next: MainlineLoopState = {
        ...s,
        current: null,
        archived: [row, ...s.archived],
      };
      saveMainlineLoopState(next);
      return next;
    });
  }, []);

  const trySpendFromLocalPool = useCallback((amount: number) => {
    const need = Math.max(0, Math.round(amount));
    if (need <= 0) return true;
    const cur = loadMainlineLoopState();
    if (cur.spendableDelta < need) return false;
    const next: MainlineLoopState = { ...cur, spendableDelta: cur.spendableDelta - need };
    saveMainlineLoopState(next);
    setState(next);
    return true;
  }, []);

  const addToLocalPool = useCallback((amount: number) => {
    const inc = Math.max(0, Math.round(amount));
    if (inc <= 0) return;
    setState((s) => {
      const next: MainlineLoopState = { ...s, spendableDelta: s.spendableDelta + inc };
      saveMainlineLoopState(next);
      return next;
    });
  }, []);

  const onExternal = useCallback(
    (p: ExternalTaskCompletePayload) => {
      if (!p.relatedToMainline) return;
      setState((s) => {
        if (!s.current) {
          if (import.meta.env.DEV) console.warn("[mainline] 外部完成：无进行中的主线，忽略");
          return s;
        }
        const pts = p.pointsOverride != null && p.pointsOverride > 0 ? Math.round(p.pointsOverride) : 10;
        const cur = s.current;
        const name = cur.name.trim() || t("mainline.externalPush");
        const next: MainlineLoopState = {
          ...s,
          spendableDelta: s.spendableDelta + pts,
          current: { ...cur, cumulativePoints: cur.cumulativePoints + pts },
        };
        saveMainlineLoopState(next);
        queueMicrotask(() => {
          toast({
            title: t("mainline.toast.syncTodo", { name, pts }),
            points: pts,
            tone: "positive",
          });
        });
        return next;
      });
    },
    [t, toast]
  );

  useEffect(() => {
    setExternalTaskCompleteHandler(onExternal);
    return () => setExternalTaskCompleteHandler(null);
  }, [onExternal]);

  const value = useMemo(
    () => ({
      state,
      getEffectiveAvailable,
      spendableDelta: state.spendableDelta,
      addQuickPoints,
      setCurrentName,
      startNewMainline,
      archiveAndClearCurrent,
      trySpendFromLocalPool,
      addToLocalPool,
    }),
    [state, getEffectiveAvailable, addQuickPoints, setCurrentName, startNewMainline, archiveAndClearCurrent, trySpendFromLocalPool, addToLocalPool]
  );

  return <MainlineLoopContext.Provider value={value}>{children}</MainlineLoopContext.Provider>;
}

export function useMainlineLoop(): MainlineLoopContextValue {
  const c = useContext(MainlineLoopContext);
  if (!c) {
    throw new Error("useMainlineLoop 必须在 MainlineLoopProvider 内");
  }
  return c;
}

export function useMainlineLoopOptional(): MainlineLoopContextValue | null {
  return useContext(MainlineLoopContext);
}
