import {
  getDefaultHabitItems,
  type HabitCatalogState,
  saveHabitCatalog,
} from "./habitListStorage";
import { defaultPromoRewardRows, saveRewardCatalog } from "./rewardCatalogStorage";

const HABIT_KEY = "habit_checkin_catalog_v1";
const REWARD_KEY = "habit_rewards_catalog_v1";
const SEED_FLAG = "habit_promo_mock_seeded_v1";

function isPromotionBuild(): boolean {
  return String(import.meta.env.VITE_APP_MODE ?? "PERSONAL").toUpperCase() === "PROMOTION";
}

/**
 * 推广版无后端：首次进入时在 LocalStorage 中写入习惯 / 奖励模板，保证可见可点、可落盘。
 * 在应用入口（main.tsx）同步调用一次即可。
 */
export function ensureMockSeedForPromotion(): void {
  if (typeof localStorage === "undefined" || !isPromotionBuild()) return;
  if (localStorage.getItem(SEED_FLAG)) return;

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
    saveRewardCatalog(defaultPromoRewardRows.map((r) => ({ ...r })));
  }

  try {
    localStorage.setItem(SEED_FLAG, "1");
  } catch {
    /* ignore */
  }
}
