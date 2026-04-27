import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** 全局用户积分（可与后端/同步对齐） */
export type HabitUser = {
  availablePoints: number;
  totalPoints: number;
};

const defaultUser: HabitUser = {
  availablePoints: 120,
  totalPoints: 3500,
};

type HabitUserContextValue = {
  user: HabitUser;
  setUser: (patch: Partial<HabitUser>) => void;
};

const HabitUserContext = createContext<HabitUserContextValue | null>(null);

export function HabitUserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<HabitUser>(defaultUser);
  const setUser = (patch: Partial<HabitUser>) =>
    setUserState((prev) => ({ ...prev, ...patch }));
  const value = useMemo(() => ({ user, setUser }), [user]);
  return (
    <HabitUserContext.Provider value={value}>{children}</HabitUserContext.Provider>
  );
}

export function useHabitUser(): HabitUserContextValue {
  const c = useContext(HabitUserContext);
  if (!c) {
    throw new Error("useHabitUser 必须在 HabitUserProvider 内使用");
  }
  return c;
}
