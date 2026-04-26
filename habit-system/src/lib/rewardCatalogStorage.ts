import { readPromotionUiLang } from "./promotionUiLang";

const STORAGE_KEY = "habit_rewards_catalog_v1";

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

/** 推广版各 tier 示范（与 RewardsPage 的 match / matchEn 一致；中英不同文案） */
export const defaultPromoRewardRowsZh: RewardCatalogItem[] = [
  { id: 1, tier: "即时奖励", title: "一杯喜欢的饮料", cost_points: 20 },
  { id: 2, tier: "即时奖励", title: "看一集轻松内容", cost_points: 15 },
  { id: 3, tier: "即时奖励", title: "出门散步", cost_points: 10 },
  { id: 4, tier: "恢复配额", title: "补签一次", cost_points: 30 },
  { id: 5, tier: "恢复配额", title: "增加今日目标额度", cost_points: 25 },
  { id: 6, tier: "升级奖励", title: "开启下一个习惯位", cost_points: 50 },
  { id: 7, tier: "主线兑现", title: "主线完成·大餐一顿", cost_points: 200 },
];

export const defaultPromoRewardRowsEn: RewardCatalogItem[] = [
  { id: 1, tier: "Instant", title: "A favorite drink", cost_points: 20 },
  { id: 2, tier: "Instant", title: "Watch a relaxing episode", cost_points: 15 },
  { id: 3, tier: "Instant", title: "Take a walk", cost_points: 10 },
  { id: 4, tier: "Restore", title: "One extra check-in", cost_points: 30 },
  { id: 5, tier: "Restore", title: "Refill today’s quota", cost_points: 25 },
  { id: 6, tier: "Upgrade", title: "Unlock another habit slot", cost_points: 50 },
  { id: 7, tier: "Milestone", title: "Milestone treat dinner", cost_points: 200 },
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.map(normalizeRow)));
}

export function nextRewardId(rows: RewardCatalogItem[]): number {
  const maxId = rows.reduce((acc, r) => (r.id > acc ? r.id : acc), 0);
  const base = Number.isFinite(maxId) ? maxId : 0;
  return base + 1;
}
