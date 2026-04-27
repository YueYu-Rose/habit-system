import { useCallback, useEffect, useState } from "react";
import { HabitBottomSheet } from "../components/HabitBottomSheet";
import { OverlayPortal } from "../components/OverlayPortal";
import { useHabitToast } from "../context/HabitToastContext";
import { useLanguage } from "../context/LanguageContext";
import { useMainlineLoop } from "../context/MainlineLoopContext";
import { useAppConfig } from "../config/appConfig";
import { loadRewardCatalog, nextRewardId, saveRewardCatalog, type RewardCatalogItem } from "../lib/rewardCatalogStorage";
import { REMOTE_DATA_EVENT } from "../lib/userDataRemote";

type Reward = RewardCatalogItem;

const COST_CHIPS = [20, 50, 100, 500] as const;
type CostPreset = (typeof COST_CHIPS)[number] | "custom";

const REWARD_TIERS: {
  id: "instant" | "restore" | "upgrade" | "mainline";
  titleKey: "rewards.tier.instant" | "rewards.tier.restore" | "rewards.tier.upgrade" | "rewards.tier.milestone";
  suggestKey: "rewards.tier.suggest.instant" | "rewards.tier.suggest.restore" | "rewards.tier.suggest.upgrade" | "rewards.tier.suggest.mainline";
  match: string;
  matchEn: string;
}[] = [
  {
    id: "instant",
    titleKey: "rewards.tier.instant",
    suggestKey: "rewards.tier.suggest.instant",
    match: "即时奖励",
    matchEn: "Instant",
  },
  {
    id: "restore",
    titleKey: "rewards.tier.restore",
    suggestKey: "rewards.tier.suggest.restore",
    match: "恢复配额",
    matchEn: "Restore",
  },
  {
    id: "upgrade",
    titleKey: "rewards.tier.upgrade",
    suggestKey: "rewards.tier.suggest.upgrade",
    match: "升级奖励",
    matchEn: "Upgrade",
  },
  {
    id: "mainline",
    titleKey: "rewards.tier.milestone",
    suggestKey: "rewards.tier.suggest.mainline",
    match: "主线兑现",
    matchEn: "Milestone",
  },
];

const SUGGEST_PTS: Record<(typeof REWARD_TIERS)[number]["id"], number> = {
  instant: 20,
  restore: 50,
  upgrade: 100,
  mainline: 500,
};

function rowInTier(r: Reward, tier: (typeof REWARD_TIERS)[number]): boolean {
  return r.tier === tier.match || r.tier === tier.matchEn;
}

function tierIdFromRow(r: Reward): (typeof REWARD_TIERS)[number]["id"] {
  const found = REWARD_TIERS.find((t) => rowInTier(r, t));
  return found?.id ?? "instant";
}

function tierStringForLang(tierId: (typeof REWARD_TIERS)[number]["id"], lang: "zh" | "en"): string {
  const def = REWARD_TIERS.find((t) => t.id === tierId);
  if (!def) return lang === "en" ? "Instant" : "即时奖励";
  return lang === "en" ? def.matchEn : def.match;
}

export function RewardsPage() {
  const { t, lang } = useLanguage();
  const { toast } = useHabitToast();
  const { showExternalIntegration } = useAppConfig();
  const { getEffectiveAvailable, spendableDelta, trySpendFromLocalPool, addToLocalPool } = useMainlineLoop();
  const [rows, setRows] = useState<Reward[]>(() => loadRewardCatalog());
  const [bal, setBal] = useState<{ available: number; lifetime: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);

  const persistRows = useCallback((next: Reward[]) => {
    setRows(next);
    saveRewardCatalog(next);
  }, []);

  const load = useCallback(() => {
    setErr(null);
    setBal({ available: 0, lifetime: 0 });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const h = () => {
      setRows(loadRewardCatalog());
      load();
    };
    window.addEventListener("habit-promo-data", h);
    window.addEventListener(REMOTE_DATA_EVENT, h);
    return () => {
      window.removeEventListener("habit-promo-data", h);
      window.removeEventListener(REMOTE_DATA_EVENT, h);
    };
  }, [load]);

  const showRedeemToast = useCallback(
    (cost: number) => {
      toast({
        title: t("rewards.toast.redeemOk"),
        points: -cost,
        tone: "default",
        durationMs: 4200,
        actionLabel: t("rewards.toast.undo"),
        onAction: () => {
          addToLocalPool(cost);
          toast({ title: t("rewards.toast.undone"), points: cost, tone: "positive" });
        },
      });
    },
    [addToLocalPool, t, toast]
  );

  const redeem = async (_id: number, cost: number) => {
    setErr(null);
    const api = bal?.available ?? 0;
    if (getEffectiveAvailable(api) < cost) return;
    if (spendableDelta >= cost) {
      if (trySpendFromLocalPool(cost)) {
        showRedeemToast(cost);
        load();
      }
      return;
    }
    setErr(t("rewards.err.insufficient"));
  };

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (r: Reward) => {
    setEditing(r);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditing(null);
  };

  const saveReward = async (payload: { title: string; cost_points: number; tier: string }) => {
    const title0 = payload.title.trim();
    const cost = Math.max(5, Math.round(payload.cost_points));
    const tier0 = payload.tier.trim();
    if (!title0 || !cost || !tier0) return;
    const editingNow = editing;

    if (editingNow) {
      const updated = rows.map((r) =>
        r.id === editingNow.id ? { ...r, title: title0, cost_points: cost, tier: tier0 } : r
      );
      persistRows(updated);
      closeSheet();
      toast({ title: t("rewards.toast.saved"), points: 0 });
      return;
    }

    const row: Reward = {
      id: nextRewardId(rows),
      title: title0,
      cost_points: cost,
      tier: tier0,
    };
    const created = [row, ...rows];
    persistRows(created);
    closeSheet();
    toast({ title: t("rewards.toast.added"), points: 0 });
  };

  const deleteReward = async () => {
    if (!editing) return;
    if (!window.confirm(t("rewards.confirm.delete"))) return;
    const target = editing;
    const next = rows.filter((r) => r.id !== target.id);
    persistRows(next);
    closeSheet();
    toast({ title: t("rewards.toast.deleted"), points: 0 });
  };

  const byTier = (tier: (typeof REWARD_TIERS)[number]) => rows.filter((r) => rowInTier(r, tier));

  return (
    <>
      <p className="habit-muted">{t("rewards.lead")}</p>
      {bal ? (
        <div className="habit-row-card" style={{ padding: "14px 16px", marginBottom: 14 }}>
          <div className="habit-stat-row">
            <span className="habit-stat-label">{t("rewards.currentAvail")}</span>
            <span className="habit-stat-value">{getEffectiveAvailable(bal.available)}</span>
          </div>
          {showExternalIntegration && spendableDelta > 0 ? (
            <p className="habit-muted" style={{ margin: "8px 0 0", fontSize: 12 }}>
              {t("rewards.accountBreakdown", { api: bal.available, local: spendableDelta })}
            </p>
          ) : null}
        </div>
      ) : null}

      {REWARD_TIERS.map((tier) => (
        <div key={tier.match}>
          <h2 className="habit-section-title">{t(tier.titleKey)}</h2>
          {byTier(tier).map((rw) => {
            const api = bal?.available ?? 0;
            const canRedeem = Boolean(
              bal &&
                getEffectiveAvailable(api) >= rw.cost_points &&
                (api >= rw.cost_points || spendableDelta >= rw.cost_points)
            );
            return (
              <div
                key={rw.id}
                className="habit-row-card"
                style={{ padding: 16, marginBottom: 10 }}
              >
                <div className="habit-reward-row-head">
                  <span className="habit-reward-title" style={{ paddingRight: 8 }}>
                    {rw.title}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span className="habit-pill">
                      {rw.cost_points} {t("common.points")}
                    </span>
                    <button
                      type="button"
                      className="habit-reward-edit"
                      aria-label={t("rewards.edit", { title: rw.title })}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(rw);
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="habit-btn habit-btn--force-white"
                  style={{ marginTop: 12 }}
                  disabled={!canRedeem}
                  onClick={() => {
                    if (!canRedeem) return;
                    void redeem(rw.id, rw.cost_points);
                  }}
                >
                  {t("rewards.redeem")}
                </button>
              </div>
            );
          })}
          {byTier(tier).length === 0 ? (
            <p className="habit-muted" style={{ marginTop: 6, marginBottom: 10 }}>
              {t("rewards.tier.empty")}
            </p>
          ) : null}
        </div>
      ))}

      {err ? <p className="habit-error">{err}</p> : null}

      <OverlayPortal>
        {!sheetOpen ? (
          <button type="button" className="habit-fab" aria-label={t("rewards.fab")} onClick={openCreate}>
            +
          </button>
        ) : null}
        {sheetOpen ? (
          <RewardBottomSheet
            key={editing ? `e-${editing.id}` : "create"}
            initialData={editing}
            lang={lang}
            onClose={closeSheet}
            onSubmit={saveReward}
            onDelete={editing ? deleteReward : undefined}
          />
        ) : null}
      </OverlayPortal>
    </>
  );
}

function RewardBottomSheet({
  initialData,
  lang,
  onClose,
  onSubmit,
  onDelete,
}: {
  initialData?: Reward | null;
  lang: "zh" | "en";
  onClose: () => void;
  onSubmit: (payload: { title: string; cost_points: number; tier: string }) => void;
  onDelete?: () => void;
}) {
  const { t } = useLanguage();
  const isEdit = Boolean(initialData);
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [tierId, setTierId] = useState<(typeof REWARD_TIERS)[number]["id"]>(() =>
    initialData ? tierIdFromRow(initialData) : "instant"
  );

  const [costPreset, setCostPreset] = useState<CostPreset>(() => {
    const c = initialData?.cost_points;
    if (c != null && (COST_CHIPS as readonly number[]).includes(c)) {
      return c as CostPreset;
    }
    return "custom";
  });
  const [customCost, setCustomCost] = useState(
    () =>
      initialData && !(COST_CHIPS as readonly number[]).includes(initialData.cost_points)
        ? initialData.cost_points
        : 20
  );

  const resolvedCost =
    costPreset === "custom" ? Math.max(5, Math.round((Number(customCost) || 0) / 5) * 5) : costPreset;

  const canSave = title.trim().length > 0 && resolvedCost > 0;

  useEffect(() => {
    if (!initialData) return;
    setTitle(initialData.title ?? "");
    setTierId(tierIdFromRow(initialData));
    const c = initialData.cost_points;
    if (c != null && (COST_CHIPS as readonly number[]).includes(c)) {
      setCostPreset(c as CostPreset);
    } else {
      setCostPreset("custom");
      setCustomCost(c ?? 20);
    }
  }, [initialData]);

  useEffect(() => {
    if (isEdit) return;
    const s = SUGGEST_PTS[tierId];
    if ((COST_CHIPS as readonly number[]).includes(s)) {
      setCostPreset(s as CostPreset);
    } else {
      setCostPreset("custom");
      setCustomCost(s);
    }
  }, [tierId, isEdit]);

  const save = () => {
    if (!title.trim() || resolvedCost <= 0) return;
    const tier = tierStringForLang(tierId, lang);
    onSubmit({ title: title.trim(), cost_points: resolvedCost, tier });
  };

  return (
    <HabitBottomSheet
      title={isEdit ? t("rewards.sheet.edit") : t("rewards.sheet.create")}
      titleId="habit-reward-sheet-title"
      onClose={onClose}
      closeButton="iconOnly"
    >
      <label className="habit-form-label" htmlFor="habit-reward-name">
        {t("rewards.field.name")}
      </label>
      <input
        id="habit-reward-name"
        className="habit-input-minimal"
        placeholder={t("rewards.ph.name")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoComplete="off"
      />

      <fieldset className="habit-reward-tier-fieldset">
        <legend className="habit-form-label habit-reward-tier-legend">
          {t("rewards.field.category")}
        </legend>
        <div className="habit-reward-tier-list" role="radiogroup" aria-label={t("rewards.field.category")}>
          {REWARD_TIERS.map((tier) => {
            const selected = tierId === tier.id;
            return (
              <label
                key={tier.id}
                className={`habit-reward-tier-row${selected ? " habit-reward-tier-row--selected" : ""}`}
              >
                <input
                  className="habit-reward-tier-radio"
                  type="radio"
                  name="habit-reward-tier"
                  value={tier.id}
                  checked={selected}
                  onChange={() => setTierId(tier.id)}
                />
                <span className="habit-reward-tier-row__text">
                  <span className="habit-reward-tier-row__title">{t(tier.titleKey)}</span>
                  <span className="habit-reward-tier-row__hint">
                    {t(tier.suggestKey)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <span className="habit-form-label">{t("rewards.field.cost")}</span>
      <div className="habit-point-chips">
        {COST_CHIPS.map((n) => (
          <button
            key={n}
            type="button"
            className={`habit-point-chip${costPreset === n ? " habit-point-chip--active" : ""}`}
            onClick={() => setCostPreset(n)}
          >
            {n} {t("common.points")}
          </button>
        ))}
        <button
          type="button"
          className={`habit-point-chip${costPreset === "custom" ? " habit-point-chip--active" : ""}`}
          onClick={() => setCostPreset("custom")}
        >
          {t("rewards.cost.custom")}
        </button>
      </div>
      {costPreset === "custom" ? (
        <input
          className="habit-input-minimal habit-input-minimal--lightbg"
          type="number"
          inputMode="numeric"
          min={5}
          step={5}
          placeholder={t("rewards.ph.cost")}
          value={customCost}
          onChange={(e) => setCustomCost(Number(e.target.value))}
        />
      ) : null}

      <button
        type="button"
        className="habit-btn"
        style={{ marginTop: 8 }}
        disabled={!canSave}
        onClick={save}
      >
        {isEdit ? t("rewards.btn.saveEdit") : t("rewards.btn.saveNew")}
      </button>

      {isEdit && onDelete ? (
        <button
          type="button"
          className="habit-btn--danger-soft"
          onClick={onDelete}
        >
          {t("rewards.btn.delete")}
        </button>
      ) : null}
    </HabitBottomSheet>
  );
}
