import { useCallback, useEffect, useState } from "react";
import { habitFetch } from "../api/client";
import { HabitBottomSheet } from "../components/HabitBottomSheet";
import { OverlayPortal } from "../components/OverlayPortal";
import { useHabitToast } from "../context/HabitToastContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useMainlineLoop } from "../context/MainlineLoopContext";
import { useAppConfig } from "../config/appConfig";
import { loadRewardCatalog, nextRewardId, saveRewardCatalog, type RewardCatalogItem } from "../lib/rewardCatalogStorage";
import type { TransKey } from "../locales/zh";

type Reward = RewardCatalogItem;

type CostPreset = 10 | 20 | 50 | "custom";

const REWARD_TIERS: { id: "instant" | "restore" | "upgrade" | "mainline"; match: string }[] = [
  { id: "instant", match: "即时奖励" },
  { id: "restore", match: "恢复配额" },
  { id: "upgrade", match: "升级奖励" },
  { id: "mainline", match: "主线兑现" },
];

export function RewardsPage() {
  const { t } = useLanguage();
  const { toast } = useHabitToast();
  const { mode, showExternalIntegration } = useAppConfig();
  const { isLoggedIn } = useAuth();
  const canUseApi = mode === "PROMOTION" && isLoggedIn;
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
    if (!canUseApi) {
      setErr(null);
      setBal({ available: 0, lifetime: 0 });
      return;
    }
    habitFetch<{ rows: Reward[] }>("/api/habit/rewards")
      .then((x) => {
        persistRows(x.rows);
        setErr(null);
      })
      .catch((e) => setErr(String(e)));
    habitFetch<{ available: number; lifetime: number }>("/api/habit/balances")
      .then(setBal)
      .catch(() => {});
  }, [canUseApi, persistRows]);

  useEffect(() => {
    load();
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

  const redeem = async (id: number, cost: number) => {
    setErr(null);
    const api = bal?.available ?? 0;
    if (getEffectiveAvailable(api) < cost) return;
    if (canUseApi && api >= cost) {
      try {
        await habitFetch("/api/habit/redeem", { method: "POST", body: JSON.stringify({ rewardId: id }) });
        showRedeemToast(cost);
        load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
      return;
    }
    if (spendableDelta >= cost) {
      if (trySpendFromLocalPool(cost)) {
        showRedeemToast(cost);
        load();
      }
      return;
    }
    setErr(canUseApi ? t("rewards.err.mixed") : t("rewards.err.insufficient"));
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

  const saveReward = async (payload: { title: string; cost_points: number }) => {
    const title0 = payload.title.trim();
    const cost = Math.max(5, Math.round(payload.cost_points));
    if (!title0 || !cost) return;
    const editingNow = editing;

    if (editingNow) {
      const updated = rows.map((r) => (r.id === editingNow.id ? { ...r, title: title0, cost_points: cost } : r));
      persistRows(updated);
      closeSheet();
      toast({ title: t("rewards.toast.saved"), points: 0 });
      if (canUseApi) {
        try {
          await habitFetch(`/api/habit/rewards/${editingNow.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              title: title0,
              cost_points: cost,
              tier: editingNow.tier,
            }),
          });
          load();
        } catch (e) {
          setErr(e instanceof Error ? e.message : String(e));
        }
      }
      return;
    }

    const row: Reward = {
      id: nextRewardId(rows),
      title: title0,
      cost_points: cost,
      tier: "即时奖励",
    };
    const created = [row, ...rows];
    persistRows(created);
    closeSheet();
    toast({ title: t("rewards.toast.added"), points: 0 });
    if (canUseApi) {
      try {
        await habitFetch("/api/habit/rewards", {
          method: "POST",
          body: JSON.stringify({
            title: title0,
            cost_points: cost,
            tier: "即时奖励",
          }),
        });
        load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    }
  };

  const deleteReward = async () => {
    if (!editing) return;
    if (!window.confirm(t("rewards.confirm.delete"))) return;
    const target = editing;
    const next = rows.filter((r) => r.id !== target.id);
    persistRows(next);
    closeSheet();
    toast({ title: t("rewards.toast.deleted"), points: 0 });
    if (canUseApi) {
      try {
        await habitFetch(`/api/habit/rewards/${target.id}`, { method: "DELETE" });
        load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    }
  };

  const byTier = (tierMatch: string) => rows.filter((r) => r.tier === tierMatch);

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
          <h2 className="habit-section-title">{t(`rewards.tier.${tier.id}` as TransKey)}</h2>
          {byTier(tier.match).map((rw) => {
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
                  <span className="habit-reward-title" style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
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
  onClose,
  onSubmit,
  onDelete,
}: {
  initialData?: Reward | null;
  onClose: () => void;
  onSubmit: (payload: { title: string; cost_points: number }) => void;
  onDelete?: () => void;
}) {
  const { t } = useLanguage();
  const isEdit = Boolean(initialData);
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [costPreset, setCostPreset] = useState<CostPreset>(() => {
    const c = initialData?.cost_points;
    if (c === 10 || c === 20 || c === 50) return c;
    return "custom";
  });
  const [customCost, setCustomCost] = useState(
    initialData && ![10, 20, 50].includes(initialData.cost_points) ? initialData.cost_points : 15
  );

  const resolvedCost =
    costPreset === "custom" ? Math.max(5, Math.round((Number(customCost) || 0) / 5) * 5) : costPreset;

  const canSave = title.trim().length > 0 && resolvedCost > 0;

  const save = () => {
    if (!title.trim() || resolvedCost <= 0) return;
    onSubmit({ title: title.trim(), cost_points: resolvedCost });
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

      <span className="habit-form-label">{t("rewards.field.cost")}</span>
      <div className="habit-point-chips">
        {([10, 20, 50] as const).map((n) => (
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
