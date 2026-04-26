import {
  getDefaultHabitItems,
  getDefaultHabitItemsForLang,
  loadHabitCatalog,
  type HabitCatalogState,
  saveHabitCatalog,
} from "./habitListStorage";
import {
  getDefaultPromoRewardRowsForLang,
  loadRewardCatalog,
  type RewardCatalogItem,
  saveRewardCatalog,
} from "./rewardCatalogStorage";
import { readPromotionUiLang } from "./promotionUiLang";

const HABIT_KEY = "habit_checkin_catalog_v1";
const REWARD_KEY = "habit_rewards_catalog_v1";
const SEED_FLAG = "habit_promo_mock_seeded_v1";
const SEED_LANG_KEY = "habit_promo_seed_lang_v1";

function isPromotionBuild(): boolean {
  return String(import.meta.env.VITE_APP_MODE ?? "PERSONAL").toUpperCase() === "PROMOTION";
}

function isHabitsPristineForLang(s: HabitCatalogState, lang: "zh" | "en"): boolean {
  const def = getDefaultHabitItemsForLang(lang);
  if (s.items.length !== def.length) return false;
  const byId = new Map(s.items.map((i) => [i.id, i]));
  for (const d of def) {
    const it = byId.get(d.id);
    if (!it) return false;
    if (it.name !== d.name) return false;
  }
  for (const it of s.items) {
    if (!def.find((d) => d.id === it.id)) return false;
  }
  return true;
}

function isRewardsPristineForLang(rows: RewardCatalogItem[], lang: "zh" | "en"): boolean {
  const def = getDefaultPromoRewardRowsForLang(lang);
  if (rows.length !== def.length) return false;
  const a = [...rows].sort((x, y) => x.id - y.id);
  const b = [...def].sort((x, y) => x.id - y.id);
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
    if (a[i].title !== b[i].title) return false;
    if (a[i].cost_points !== b[i].cost_points) return false;
    if (a[i].tier !== b[i].tier) return false;
  }
  return true;
}

export function notifyPromotionDataChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("habit-promo-data"));
}

/**
 * 推广版无后端：首次进入时在 LocalStorage 中写入习惯 / 奖励模板，保证可见可点、可落盘。
 * 在应用入口（main.tsx）同步调用一次即可。
 */
export function ensureMockSeedForPromotion(): void {
  if (typeof localStorage === "undefined" || !isPromotionBuild()) return;

  if (localStorage.getItem(SEED_FLAG)) {
    try {
      if (!localStorage.getItem(SEED_LANG_KEY)) {
        localStorage.setItem(SEED_LANG_KEY, readPromotionUiLang());
      }
    } catch {
      /* ignore */
    }
    return;
  }

  if (!localStorage.getItem(HABIT_KEY)) {
    const s: HabitCatalogState = {
      v: 1,
      items: getDefaultHabitItems(),
      customDone: {},
      customWallet: 0,
    };
    saveHabitCatalog(s);
  }

  if (!localStorage.getItem(REWARD_KEY)) {
    saveRewardCatalog(getDefaultPromoRewardRowsForLang(readPromotionUiLang()).map((r) => ({ ...r })));
  }

  try {
    localStorage.setItem(SEED_FLAG, "1");
    localStorage.setItem(SEED_LANG_KEY, readPromotionUiLang());
  } catch {
    /* ignore */
  }
}

export type SyncPromotionLocaleResult = "noop" | "synced" | "skipped_touched";

/**
 * 在推广版、语言与种子语言不一致时：若数据仍为模板，则将习惯名与奖励条目标题改为新语言；否则只更新元数据键。
 */
export function syncPromotionLocaleOnLangChange(newLang: "zh" | "en"): SyncPromotionLocaleResult {
  if (typeof localStorage === "undefined" || !isPromotionBuild()) return "noop";
  let stored: string | null;
  try {
    stored = localStorage.getItem(SEED_LANG_KEY);
  } catch {
    return "noop";
  }
  if (stored !== "en" && stored !== "zh") {
    try {
      localStorage.setItem(SEED_LANG_KEY, newLang);
    } catch {
      /* ignore */
    }
    return "noop";
  }
  if (stored === newLang) return "noop";
  const oldLang = stored;

  const cat = loadHabitCatalog();
  const rows = loadRewardCatalog();
  const habitsOk = isHabitsPristineForLang(cat, oldLang);
  const rewardsOk = isRewardsPristineForLang(rows, oldLang);
  if (!habitsOk || !rewardsOk) {
    try {
      localStorage.setItem(SEED_LANG_KEY, newLang);
    } catch {
      /* ignore */
    }
    return "skipped_touched";
  }

  const newDefs = getDefaultHabitItemsForLang(newLang);
  const newItems = newDefs.map((d) => {
    const was = cat.items.find((x) => x.id === d.id);
    return { ...d, streak: was?.streak ?? 0 };
  });
  saveHabitCatalog({ ...cat, items: newItems });
  saveRewardCatalog(getDefaultPromoRewardRowsForLang(newLang).map((r) => ({ ...r })));
  try {
    localStorage.setItem(SEED_LANG_KEY, newLang);
  } catch {
    /* ignore */
  }
  notifyPromotionDataChanged();
  return "synced";
}

/**
 * 清空本机推广演示数据并按指定语言（默认当前 UI 语言）重新注入模板。便于中/EN 自测。
 */
export function resetPromotionMockData(targetLang?: "zh" | "en"): void {
  if (typeof localStorage === "undefined" || !isPromotionBuild()) return;
  const l = targetLang ?? readPromotionUiLang();
  try {
    localStorage.setItem("habit.ui.lang.v1.promotion", l);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(HABIT_KEY);
    localStorage.removeItem(REWARD_KEY);
    localStorage.removeItem(SEED_FLAG);
    localStorage.removeItem(SEED_LANG_KEY);
  } catch {
    /* ignore */
  }
  ensureMockSeedForPromotion();
  notifyPromotionDataChanged();
}
