import { readPromotionUiLang } from "./promotionUiLang";

export const REWARD_CATALOG_STORAGE_KEY = "habit_rewards_catalog_v1";
const STORAGE_KEY = REWARD_CATALOG_STORAGE_KEY;

function isPromotionBuild(): boolean {
  return String(import.meta.env.VITE_APP_MODE ?? "PERSONAL").toUpperCase() === "PROMOTION";
}

export type RewardCatalogItem = {
  id: number;
  tier: string;
  title: string;
  cost_points: number;
};

function normalizeRow(row: RewardCatalogItem): RewardCatalogItem {
  return {
    id: Number.isFinite(row.id) ? Math.round(row.id) : Date.now(),
    tier: typeof row.tier === "string" && row.tier.trim() ? row.tier.trim() : "即时奖励",
    title: typeof row.title === "string" ? row.title.trim() : "",
    cost_points: Number.isFinite(row.cost_points) ? Math.max(0, Math.round(row.cost_points)) : 0,
  };
}

/**
 * 推广版奖励模板：与您设计的分档/积分一致（与 RewardsPage 的 match / matchEn 一致）
 * 即时 20pt · 恢复 50pt · 升级 100pt · 主线 500pt
 */
export const defaultPromoRewardRowsZh: RewardCatalogItem[] = [
  { id: 1, tier: "即时奖励", title: "一杯喜欢的饮料", cost_points: 20 },
  { id: 2, tier: "即时奖励", title: "一份小零食", cost_points: 20 },
  { id: 3, tier: "即时奖励", title: "看一集轻松内容", cost_points: 20 },
  { id: 4, tier: "即时奖励", title: "30 分钟无负担休息", cost_points: 20 },
  { id: 5, tier: "即时奖励", title: "一次小甜品", cost_points: 20 },
  { id: 6, tier: "即时奖励", title: "一顿普通但喜欢的小吃", cost_points: 20 },
  { id: 7, tier: "恢复配额", title: "一顿喜欢的饭", cost_points: 50 },
  { id: 8, tier: "恢复配额", title: "一次比较放松的娱乐活动", cost_points: 50 },
  { id: 9, tier: "恢复配额", title: "购买心愿单上低于 200 RMB 的东西", cost_points: 50 },
  { id: 10, tier: "升级奖励", title: "购买心愿单上低于 500 RMB 的东西", cost_points: 100 },
  { id: 11, tier: "升级奖励", title: "一次专门出去放松 / 逛街", cost_points: 100 },
  { id: 12, tier: "升级奖励", title: "吃一顿更满意的饭", cost_points: 100 },
  { id: 13, tier: "主线兑现", title: "愿望清单中的一项正式兑现", cost_points: 500 },
  { id: 14, tier: "主线兑现", title: "某次旅行基金的一部分", cost_points: 500 },
  { id: 15, tier: "主线兑现", title: "某个长期想买的物品预算", cost_points: 500 },
  { id: 16, tier: "主线兑现", title: "一个有仪式感的重要奖励", cost_points: 500 },
];

export const defaultPromoRewardRowsEn: RewardCatalogItem[] = [
  { id: 1, tier: "Instant", title: "A favorite drink", cost_points: 20 },
  { id: 2, tier: "Instant", title: "A small snack", cost_points: 20 },
  { id: 3, tier: "Instant", title: "Watch a relaxing episode", cost_points: 20 },
  { id: 4, tier: "Instant", title: "30 minutes of guilt-free rest", cost_points: 20 },
  { id: 5, tier: "Instant", title: "A little dessert", cost_points: 20 },
  { id: 6, tier: "Instant", title: "A simple meal you really enjoy", cost_points: 20 },
  { id: 7, tier: "Restore", title: "A meal you love", cost_points: 50 },
  { id: 8, tier: "Restore", title: "A more relaxing bit of fun", cost_points: 50 },
  { id: 9, tier: "Restore", title: "Something on your wish list under 200 CNY", cost_points: 50 },
  { id: 10, tier: "Upgrade", title: "Something on your wish list under 500 CNY", cost_points: 100 },
  { id: 11, tier: "Upgrade", title: "A proper relax / shopping outing", cost_points: 100 },
  { id: 12, tier: "Upgrade", title: "A more satisfying meal", cost_points: 100 },
  { id: 13, tier: "Milestone", title: "One wish-list item, fully", cost_points: 500 },
  { id: 14, tier: "Milestone", title: "Part of a travel fund", cost_points: 500 },
  { id: 15, tier: "Milestone", title: "Budget for something you’ve wanted a long time", cost_points: 500 },
  { id: 16, tier: "Milestone", title: "A special, meaningful reward", cost_points: 500 },
];

/** @deprecated 使用 getDefaultPromoRewardRowsForLang */
export const defaultPromoRewardRows: RewardCatalogItem[] = defaultPromoRewardRowsZh.map((r) => ({ ...r }));

export function getDefaultPromoRewardRowsForLang(lang: "zh" | "en"): RewardCatalogItem[] {
  return (lang === "en" ? defaultPromoRewardRowsEn : defaultPromoRewardRowsZh).map((r) => ({ ...r }));
}

export function loadRewardCatalog(): RewardCatalogItem[] {
  if (typeof localStorage === "undefined") {
    return isPromotionBuild() ? getDefaultPromoRewardRowsForLang(readPromotionUiLang()) : [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return isPromotionBuild() ? getDefaultPromoRewardRowsForLang(readPromotionUiLang()) : [];
    }
    const parsed = JSON.parse(raw) as RewardCatalogItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeRow).filter((x) => x.title.length > 0 && x.cost_points > 0);
  } catch {
    return [];
  }
}

export function saveRewardCatalog(rows: RewardCatalogItem[]): void {
  if (typeof localStorage === "undefined") return;
  const normalized = rows.map(normalizeRow);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  queueMicrotask(() => void import("./userDataRemote").then((m) => m.schedulePushRewardRows(normalized)));
}

export function nextRewardId(rows: RewardCatalogItem[]): number {
  const maxId = rows.reduce((acc, r) => (r.id > acc ? r.id : acc), 0);
  const base = Number.isFinite(maxId) ? maxId : 0;
  return base + 1;
}
