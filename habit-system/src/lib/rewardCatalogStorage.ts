const STORAGE_KEY = "habit_rewards_catalog_v1";

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

export function loadRewardCatalog(): RewardCatalogItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
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
