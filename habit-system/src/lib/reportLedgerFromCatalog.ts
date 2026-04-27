import { addDays } from "./dateLocal";
import {
  getCustomDoneForDate,
  getPointsForHabitComplete,
  getRecordedTimeIso,
  getWeekdayForIsoDate,
  isHabitDueOnWeekday,
  type HabitCatalogState,
  type HabitDef,
} from "./habitListStorage";

const LEDGER_MAX = 500;

/** 与复盘页列表展示一致；无后端 SQLite 时由习惯目录推导 */
export type CatalogLedgerRow = {
  id: number;
  habit_date: string;
  created_at: string;
  amount: number;
  source_type: string;
  title: string;
};

const SOURCE: Record<"zh" | "en", string> = { zh: "打卡", en: "Check-in" };

function fallbackNoonIso(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return new Date().toISOString();
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

function resolveCheckinCreatedAt(state: HabitCatalogState, def: HabitDef, date: string): string {
  if (def.systemKey === "sleep") {
    const prev = addDays(date, -1);
    return state.dayTimes?.[prev]?.sleepIso ?? state.dayTimes?.[date]?.sleepIso ?? fallbackNoonIso(date);
  }
  if (def.systemKey === "wake") {
    return state.dayTimes?.[date]?.wakeIso ?? fallbackNoonIso(date);
  }
  const rec = getRecordedTimeIso(state, def.id, date);
  if (rec) return rec;
  return fallbackNoonIso(date);
}

/**
 * 从 LocalStorage/云端拉取的习惯目录推导「积分流水」：近 start～end 内每次完成习惯一条正分记录。
 * 兑换扣款、外部 API 分池等若未写入该结构则不会出现在此列表中。
 */
export function buildHabitLedgerRowsFromCatalog(
  state: HabitCatalogState,
  startIso: string,
  endIso: string,
  lang: "zh" | "en"
): CatalogLedgerRow[] {
  const source_type = SOURCE[lang] ?? SOURCE.zh;
  const rows: CatalogLedgerRow[] = [];
  for (let cur = startIso; cur <= endIso; cur = addDays(cur, 1)) {
    const w = getWeekdayForIsoDate(cur);
    for (const def of state.items) {
      if (!isHabitDueOnWeekday(def, w)) continue;
      if (!getCustomDoneForDate(state, cur, def.id)) continue;
      const amount = getPointsForHabitComplete(def);
      if (amount === 0) continue;
      rows.push({
        id: 0,
        habit_date: cur,
        created_at: resolveCheckinCreatedAt(state, def, cur),
        amount,
        source_type,
        title: def.name,
      });
    }
  }
  rows.sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (tb !== ta) return tb - ta;
    if (a.habit_date !== b.habit_date) return b.habit_date.localeCompare(a.habit_date);
    return a.title.localeCompare(b.title, lang === "en" ? "en" : "zh");
  });
  const capped = rows.slice(0, LEDGER_MAX);
  capped.forEach((r, i) => {
    r.id = i + 1;
  });
  return capped;
}
