export const REWARD_REDEMPTIONS_STORAGE_KEY = "habit_reward_redemptions_v1";
export const DAILY_CLOSE_STORAGE_KEY = "habit_daily_close_v1";

const MAX_REDEMPTION_ROWS = 300;
const MAX_DAILY_CLOSE_ROWS = 180;

export type RewardRedemptionRow = {
  id: string;
  title: string;
  cost_points: number;
  redeemed_at: string;
};

export type DailyCloseRow = {
  id: string;
  date: string;
  net_points: number;
  closed_at: string;
};

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeRedemptionRow(row: RewardRedemptionRow): RewardRedemptionRow | null {
  if (!row || typeof row !== "object") return null;
  const title = String(row.title ?? "").trim();
  const cost = Math.max(0, Math.round(Number(row.cost_points ?? 0)));
  const at = String(row.redeemed_at ?? "").trim();
  if (!title || !cost || !at) return null;
  return {
    id: String(row.id ?? newId("redeem")),
    title,
    cost_points: cost,
    redeemed_at: at,
  };
}

function normalizeDailyCloseRow(row: DailyCloseRow): DailyCloseRow | null {
  if (!row || typeof row !== "object") return null;
  const date = String(row.date ?? "").trim();
  const net = Math.round(Number(row.net_points ?? 0));
  const at = String(row.closed_at ?? "").trim();
  if (!date || !at || !Number.isFinite(net)) return null;
  return {
    id: String(row.id ?? newId("close")),
    date,
    net_points: net,
    closed_at: at,
  };
}

export function loadRewardRedemptions(): RewardRedemptionRow[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(REWARD_REDEMPTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RewardRedemptionRow[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeRedemptionRow)
      .filter((x): x is RewardRedemptionRow => x != null)
      .sort((a, b) => b.redeemed_at.localeCompare(a.redeemed_at))
      .slice(0, MAX_REDEMPTION_ROWS);
  } catch {
    return [];
  }
}

export function saveRewardRedemptions(rows: RewardRedemptionRow[]): void {
  if (typeof localStorage === "undefined") return;
  const normalized = rows
    .map(normalizeRedemptionRow)
    .filter((x): x is RewardRedemptionRow => x != null)
    .sort((a, b) => b.redeemed_at.localeCompare(a.redeemed_at))
    .slice(0, MAX_REDEMPTION_ROWS);
  localStorage.setItem(REWARD_REDEMPTIONS_STORAGE_KEY, JSON.stringify(normalized));
}

export function appendRewardRedemption(title: string, cost_points: number): RewardRedemptionRow {
  const row: RewardRedemptionRow = {
    id: newId("redeem"),
    title: String(title).trim(),
    cost_points: Math.max(0, Math.round(cost_points)),
    redeemed_at: new Date().toISOString(),
  };
  const next = [row, ...loadRewardRedemptions()];
  saveRewardRedemptions(next);
  return row;
}

export function removeRewardRedemptionById(id: string): void {
  const next = loadRewardRedemptions().filter((x) => x.id !== id);
  saveRewardRedemptions(next);
}

export function loadDailyCloseRows(): DailyCloseRow[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(DAILY_CLOSE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyCloseRow[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeDailyCloseRow)
      .filter((x): x is DailyCloseRow => x != null)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_DAILY_CLOSE_ROWS);
  } catch {
    return [];
  }
}

export function saveDailyCloseRows(rows: DailyCloseRow[]): void {
  if (typeof localStorage === "undefined") return;
  const normalized = rows
    .map(normalizeDailyCloseRow)
    .filter((x): x is DailyCloseRow => x != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_DAILY_CLOSE_ROWS);
  localStorage.setItem(DAILY_CLOSE_STORAGE_KEY, JSON.stringify(normalized));
}

export function upsertDailyCloseRow(date: string, net_points: number): DailyCloseRow {
  const row: DailyCloseRow = {
    id: newId("close"),
    date,
    net_points: Math.round(net_points),
    closed_at: new Date().toISOString(),
  };
  const prev = loadDailyCloseRows();
  const filtered = prev.filter((x) => x.date !== date);
  const next = [row, ...filtered];
  saveDailyCloseRows(next);
  return row;
}
