import { useCallback, useEffect, useState } from "react";
import { REMOTE_DATA_EVENT } from "../lib/userDataRemote";
import {
  type HabitCatalogState,
  type HabitDef,
  applyLocalToggle,
  getCustomDoneForDate,
  loadHabitCatalog,
  newHabitId,
  saveHabitCatalog,
  type HabitSystemKey,
} from "../lib/habitListStorage";

type HabitDaily = {
  sleep_started_at: string | null;
  wake_at: string | null;
  shower_at: string | null;
  english_done: number | null;
  cantonese_done: number | null;
  exercise_done: number | null;
  exercise_minutes: number | null;
} | null;

export function isSystemKeyDone(daily: HabitDaily, key: HabitSystemKey): boolean {
  if (!daily) return false;
  switch (key) {
    case "sleep":
      return Boolean(daily.sleep_started_at);
    case "wake":
      return Boolean(daily.wake_at);
    case "shower":
      return Boolean(daily.shower_at);
    case "english":
      return (daily.english_done ?? 0) !== 0;
    case "cantonese":
      return (daily.cantonese_done ?? 0) !== 0;
    case "exercise":
      return Boolean(daily.exercise_done);
    default:
      return false;
  }
}

export function useHabitCatalog() {
  const [catalog, setCatalog] = useState<HabitCatalogState>(() => loadHabitCatalog());

  const persist = useCallback((next: HabitCatalogState) => {
    saveHabitCatalog(next);
    setCatalog(next);
  }, []);

  const setItems = useCallback(
    (items: HabitDef[]) => {
      persist({ ...catalog, items });
    },
    [catalog, persist]
  );

  const removeHabit = useCallback(
    (id: string) => {
      setCatalog((s) => {
        const n = { ...s, items: s.items.filter((x) => x.id !== id) };
        saveHabitCatalog(n);
        return n;
      });
    },
    []
  );

  const addHabit = useCallback(
    (def: Omit<HabitDef, "id" | "streak"> & { id?: string; streak?: number }) => {
      const id = def.id ?? newHabitId();
      setCatalog((s) => {
        const row: HabitDef = {
          id,
          name: def.name,
          completePoints: def.completePoints,
          penalty: def.penalty,
          streak: Number.isFinite(def.streak) ? Math.max(0, Math.round(def.streak as number)) : 0,
          systemKey: def.systemKey,
          schedule: def.schedule ?? { type: "daily" },
          targetType: def.targetType,
          targetTime: def.targetTime,
        };
        const n = { ...s, items: [...s.items, row] };
        saveHabitCatalog(n);
        return n;
      });
    },
    []
  );

  const updateHabit = useCallback(
    (id: string, patch: Partial<Pick<HabitDef, "name" | "completePoints" | "penalty" | "schedule" | "targetType" | "targetTime">>) => {
      setCatalog((s) => {
        const items = s.items.map((it) => (it.id === id ? ({ ...it, ...patch } as HabitDef) : it));
        const n = { ...s, items };
        saveHabitCatalog(n);
        return n;
      });
    },
    []
  );

  const toggleLocalHabit = useCallback(
    (date: string, def: HabitDef, wasDone: boolean, nowDone: boolean, clockIso?: string | null) => {
      setCatalog((s) => {
        const n = applyLocalToggle(s, date, def.id, def, wasDone, nowDone, clockIso);
        saveHabitCatalog(n);
        return n;
      });
    },
    []
  );

  const bumpHabitStreak = useCallback((habitId: string, delta: number) => {
    if (!delta) return;
    setCatalog((s) => {
      let touched = false;
      const items = s.items.map((it) => {
        if (it.id !== habitId) return it;
        touched = true;
        return { ...it, streak: Math.max(0, (it.streak ?? 0) + delta) };
      });
      if (!touched) return s;
      const n = { ...s, items };
      saveHabitCatalog(n);
      return n;
    });
  }, []);

  const reload = useCallback(() => {
    setCatalog(loadHabitCatalog());
  }, []);

  useEffect(() => {
    const h = () => reload();
    window.addEventListener(REMOTE_DATA_EVENT, h);
    return () => window.removeEventListener(REMOTE_DATA_EVENT, h);
  }, [reload]);

  return {
    catalog,
    persist,
    setItems,
    removeHabit,
    addHabit,
    updateHabit,
    toggleLocalHabit,
    bumpHabitStreak,
    reload,
  };
}

export function getDone(def: HabitDef, daily: HabitDaily, state: HabitCatalogState, date: string): boolean {
  const localDone = getCustomDoneForDate(state, date, def.id);
  if (def.systemKey) {
    if (localDone) return true;
    return isSystemKeyDone(daily, def.systemKey);
  }
  return localDone;
}
