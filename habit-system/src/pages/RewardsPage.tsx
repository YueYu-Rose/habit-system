import { useCallback, useEffect, useState } from "react";
import { habitFetch } from "../api/client";
import { HabitBottomSheet } from "../components/HabitBottomSheet";
import { OverlayPortal } from "../components/OverlayPortal";
import { useHabitToast } from "../context/HabitToastContext";
import { useLanguage } from "../context/LanguageContext";
import { useMainlineLoop } from "../context/MainlineLoopContext";
import { useAppConfig } from "../config/appConfig";
import { loadRewardCatalog, nextRewardId, saveRewardCatalog, type RewardCatalogItem } from "../lib/rewardCatalogStorage";
import { REMOTE_DATA_EVENT } from "../lib/userDataRemote";

type Reward = RewardCatalogItem;
type Q2Band = "under_20" | "20_50" | "over_50";
type GeneratedReward = { tier: string; title: string; points: number; reason: string };

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

const Q2_OPTIONS: Array<{ value: Q2Band; labelZh: string; labelEn: string }> = [
  { value: "under_20", labelZh: "20分以下", labelEn: "Below 20" },
  { value: "20_50", labelZh: "20-50分", labelEn: "20-50" },
  { value: "over_50", labelZh: "50分以上", labelEn: "Above 50" },
];

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
  const [createSelectionOpen, setCreateSelectionOpen] = useState(false);
  const [aiPlannerOpen, setAiPlannerOpen] = useState(false);

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
    setSheetOpen(false);
    setAiPlannerOpen(false);
    setCreateSelectionOpen(true);
  };

  const openEdit = (r: Reward) => {
    setCreateSelectionOpen(false);
    setAiPlannerOpen(false);
    setEditing(r);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditing(null);
  };

  const closeCreateLayers = () => {
    setCreateSelectionOpen(false);
    setAiPlannerOpen(false);
    setSheetOpen(false);
    setEditing(null);
  };

  const openManualCreate = () => {
    setCreateSelectionOpen(false);
    setAiPlannerOpen(false);
    setEditing(null);
    setSheetOpen(true);
  };

  const openAiPlanner = () => {
    setCreateSelectionOpen(false);
    setSheetOpen(false);
    setEditing(null);
    setAiPlannerOpen(true);
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

  const importAiRewards = (items: GeneratedReward[]) => {
    const clean = items
      .map((it) => ({
        tier: String(it.tier ?? "").trim(),
        title: String(it.title ?? "").trim(),
        cost_points: Math.max(5, Math.round(Number(it.points ?? 0) / 5) * 5),
      }))
      .filter((it) => it.tier && it.title && Number.isFinite(it.cost_points) && it.cost_points > 0);
    if (clean.length === 0) return;

    const startId = nextRewardId(rows);
    const added: Reward[] = clean.map((it, idx) => ({
      id: startId + idx,
      tier: it.tier,
      title: it.title,
      cost_points: it.cost_points,
    }));
    persistRows([...added, ...rows]);
    closeCreateLayers();
    toast({ title: `已导入 ${added.length} 个奖励`, points: 0 });
  };

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
            const effective = getEffectiveAvailable(api);
            const missing = Math.max(0, rw.cost_points - effective);
            const progress = rw.cost_points > 0 ? Math.min(100, Math.round((effective / rw.cost_points) * 100)) : 0;
            const encouragementKey =
              progress <= 0 ? null : progress < 60 ? "rewards.encourage.onRoad" : "rewards.encourage.keepGoing";
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
                  className={`habit-btn habit-btn--force-white${canRedeem ? "" : " habit-btn--piggy"}`}
                  style={{ marginTop: 12 }}
                  disabled={!canRedeem}
                  onClick={() => {
                    if (!canRedeem) return;
                    void redeem(rw.id, rw.cost_points);
                  }}
                >
                  {canRedeem ? t("rewards.redeem") : t("rewards.keepSaving")}
                </button>
                {!canRedeem ? (
                  <>
                    <div className="habit-piggy-progress__summary">
                      <span>{t("rewards.savedToGoal", { current: Math.max(0, effective), goal: rw.cost_points })}</span>
                      {encouragementKey ? (
                        <span className="habit-piggy-progress__tag">{t(encouragementKey)}</span>
                      ) : null}
                    </div>
                    <div className="habit-piggy-progress" aria-label={t("rewards.progressAria", { pct: progress, n: missing })}>
                      <div className="habit-piggy-progress__track">
                        <div className="habit-piggy-progress__fill" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="habit-piggy-progress__text">{t("rewards.progressText", { pct: progress })}</span>
                    </div>
                  </>
                ) : null}
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
        {!sheetOpen && !createSelectionOpen && !aiPlannerOpen ? (
          <button type="button" className="habit-fab" aria-label={t("rewards.fab")} onClick={openCreate}>
            +
          </button>
        ) : null}
        {createSelectionOpen ? (
          <CreateModeSheet
            lang={lang}
            onClose={closeCreateLayers}
            onSelectAi={openAiPlanner}
            onSelectManual={openManualCreate}
          />
        ) : null}
        {aiPlannerOpen ? (
          <AiRewardPlannerSheet lang={lang} onClose={closeCreateLayers} onImport={importAiRewards} />
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

function CreateModeSheet({
  lang,
  onClose,
  onSelectAi,
  onSelectManual,
}: {
  lang: "zh" | "en";
  onClose: () => void;
  onSelectAi: () => void;
  onSelectManual: () => void;
}) {
  const copy = {
    title: lang === "en" ? "Create Reward" : "创建奖励",
    badge: lang === "en" ? "Recommended" : "推荐",
    aiTitle: lang === "en" ? "✨ Ask AI to suggest" : "✨ 让 AI 帮我想",
    aiDesc:
      lang === "en"
        ? "Answer two questions and generate a 4-tier reward ladder for quick import."
        : "回答两个问题，生成四档阶梯奖励并一键导入。",
    manualTitle: lang === "en" ? "✏️ Create manually" : "✏️ 自己新建",
    manualDesc:
      lang === "en"
        ? "Use the existing manual form to customize title, tier, and points."
        : "继续使用原有手动新建表单，自定义标题、档位和积分。",
  };
  return (
    <HabitBottomSheet
      title={copy.title}
      titleId="habit-reward-create-mode-title"
      onClose={onClose}
      closeButton="iconOnly"
    >
      <div className="habit-ai-choice-grid">
        <button type="button" className="habit-ai-choice-card habit-ai-choice-card--primary" onClick={onSelectAi}>
          <span className="habit-ai-choice-card__badge">{copy.badge}</span>
          <p className="habit-ai-choice-card__title">{copy.aiTitle}</p>
          <p className="habit-ai-choice-card__desc">{copy.aiDesc}</p>
        </button>
        <button type="button" className="habit-ai-choice-card" onClick={onSelectManual}>
          <p className="habit-ai-choice-card__title">{copy.manualTitle}</p>
          <p className="habit-ai-choice-card__desc">{copy.manualDesc}</p>
        </button>
      </div>
    </HabitBottomSheet>
  );
}

function AiRewardPlannerSheet({
  lang,
  onClose,
  onImport,
}: {
  lang: "zh" | "en";
  onClose: () => void;
  onImport: (items: GeneratedReward[]) => void;
}) {
  const [step, setStep] = useState<"form" | "loading" | "result">("form");
  const [q1, setQ1] = useState("");
  const [q2Band, setQ2Band] = useState<Q2Band>("20_50");
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<GeneratedReward[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [manageMode, setManageMode] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPoints, setEditPoints] = useState("");

  const copy = {
    title: lang === "en" ? "✨ AI Reward Planner" : "✨ AI 奖励规划师",
    q1: lang === "en" ? "What's the best way to treat yourself lately?" : "你最近最想犒劳自己的事是什么？",
    q1Placeholder:
      lang === "en"
        ? "For example: bubble tea, 2-hour gaming, buy new clothes"
        : "比如喝杯奶茶、打两小时游戏、买件新衣服",
    q2: lang === "en" ? "How many points do you earn daily?" : "你现在每天大概能赚多少积分？",
    generate: lang === "en" ? "Generate Reward List" : "生成奖励清单",
    loading: lang === "en" ? "Customizing your reward list..." : "正在为你定制专属奖励清单…",
    pickHint: lang === "en" ? "Pick rewards to import (all selected by default)" : "勾选你想导入的奖励（默认全选）",
    regenerate: lang === "en" ? "Regenerate" : "重新生成",
    importSelected: lang === "en" ? "Import Selected" : "一键导入选中项",
    manage: lang === "en" ? "Manage" : "管理",
    done: lang === "en" ? "Done" : "完成",
    edit: lang === "en" ? "Edit" : "编辑",
    saveEdit: lang === "en" ? "Save" : "保存",
    cancelEdit: lang === "en" ? "Cancel" : "取消",
    titlePlaceholder: lang === "en" ? "Reward title" : "奖励名称",
    q1Required:
      lang === "en"
        ? "Please tell me how you'd like to treat yourself first."
        : "请先填写你最想犒劳自己的事",
    pickRequired: lang === "en" ? "Please select at least one reward." : "请至少勾选一项奖励",
    editInvalid:
      lang === "en"
        ? "Title is required and points must be a positive number."
        : "奖励名称不能为空，积分必须是正数",
  };

  const runGenerate = async () => {
    if (!q1.trim()) {
      setErr(copy.q1Required);
      return;
    }
    setErr(null);
    setStep("loading");
    try {
      const data = await habitFetch<{ rewards: GeneratedReward[] }>("/api/generate-rewards", {
        method: "POST",
        body: JSON.stringify({ q1: q1.trim(), q2Band, language: lang }),
      });
      const list = Array.isArray(data.rewards) ? data.rewards : [];
      setRows(list);
      setSelected(new Set(list.map((_, i) => i)));
      setManageMode(false);
      setEditingIndex(null);
      setStep("result");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setStep("form");
    }
  };

  const toggleRow = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const importSelected = () => {
    const picked = rows.filter((_, i) => selected.has(i));
    if (picked.length === 0) {
      setErr(copy.pickRequired);
      return;
    }
    onImport(picked);
  };

  const beginEdit = (idx: number) => {
    const row = rows[idx];
    if (!row) return;
    setEditingIndex(idx);
    setEditTitle(row.title);
    setEditPoints(String(row.points));
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditTitle("");
    setEditPoints("");
  };

  const saveEdit = () => {
    if (editingIndex == null) return;
    const title = editTitle.trim();
    const points = Math.max(1, Math.round(Number(editPoints)));
    if (!title || !Number.isFinite(points)) {
      setErr(copy.editInvalid);
      return;
    }
    setRows((prev) =>
      prev.map((row, idx) => (idx === editingIndex ? { ...row, title, points } : row))
    );
    setErr(null);
    cancelEdit();
  };

  return (
    <HabitBottomSheet
      title={copy.title}
      titleId="habit-ai-reward-planner-title"
      onClose={onClose}
      closeButton="iconOnly"
    >
      {step === "form" ? (
        <>
          <label className="habit-form-label" htmlFor="habit-ai-reward-q1">
            {copy.q1}
          </label>
          <input
            id="habit-ai-reward-q1"
            className="habit-input-minimal"
            placeholder={copy.q1Placeholder}
            value={q1}
            onChange={(e) => setQ1(e.target.value)}
            autoComplete="off"
          />

          <span className="habit-form-label" style={{ marginTop: 12, display: "inline-block" }}>
            {copy.q2}
          </span>
          <div className="habit-ai-q2-list">
            {Q2_OPTIONS.map((opt) => (
              <label key={opt.value} className="habit-ai-q2-option">
                <input
                  type="radio"
                  name="habit-ai-q2-band"
                  checked={q2Band === opt.value}
                  onChange={() => setQ2Band(opt.value)}
                  style={{ accentColor: "var(--habit-emerald)" }}
                />
                <span>{lang === "en" ? opt.labelEn : opt.labelZh}</span>
              </label>
            ))}
          </div>

          {err ? <p className="habit-error">{err}</p> : null}

          <button type="button" className="habit-btn" onClick={() => void runGenerate()}>
            {copy.generate}
          </button>
        </>
      ) : null}

      {step === "loading" ? (
        <div className="habit-ai-loading-wrap" aria-live="polite">
          <div className="habit-ai-spinner" aria-hidden />
          <p className="habit-muted" style={{ marginTop: 10 }}>
            {copy.loading}
          </p>
          <div className="habit-ai-skeleton-list">
            {[1, 2, 3, 4, 5, 6].map((x) => (
              <div key={x} className="habit-ai-skeleton-item" />
            ))}
          </div>
        </div>
      ) : null}

      {step === "result" ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <p className="habit-muted" style={{ marginTop: 0, marginBottom: 0 }}>
              {copy.pickHint}
            </p>
            <button
              type="button"
              className="habit-dailylog-edit"
              style={{ minWidth: 84, justifyContent: "center", textAlign: "center" }}
              aria-pressed={manageMode}
              onClick={() => {
                setManageMode((v) => !v);
                if (manageMode) cancelEdit();
              }}
            >
              {manageMode ? copy.done : copy.manage}
            </button>
          </div>
          <div className="habit-ai-result-list">
            {rows.map((item, idx) => (
              <label key={`${item.tier}-${idx}-${item.title}`} className="habit-ai-result-item">
                <input
                  type="checkbox"
                  checked={selected.has(idx)}
                  onChange={() => toggleRow(idx)}
                  style={{ accentColor: "var(--habit-emerald)" }}
                />
                <span>
                  {editingIndex === idx ? (
                    <div style={{ display: "grid", gap: 8, width: "100%" }}>
                      <input
                        className="habit-input-minimal habit-input-minimal--lightbg"
                        placeholder={copy.titlePlaceholder}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <strong style={{ fontSize: 13 }}>{item.tier}</strong>
                        <input
                          className="habit-input-minimal habit-input-minimal--lightbg"
                          type="number"
                          min={1}
                          step={5}
                          style={{ maxWidth: 120 }}
                          value={editPoints}
                          onChange={(e) => setEditPoints(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="habit-btn" onClick={saveEdit}>
                          {copy.saveEdit}
                        </button>
                        <button type="button" className="habit-btn--ghost" onClick={cancelEdit}>
                          {copy.cancelEdit}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <strong>{item.tier}</strong> {item.title}（{item.points}分）
                    </>
                  )}
                </span>
                {manageMode && editingIndex !== idx ? (
                  <button
                    type="button"
                    className="habit-reward-edit"
                    style={{ marginLeft: 8, marginTop: 2 }}
                    aria-label={`${copy.edit} ${item.title}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      beginEdit(idx);
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </button>
                ) : null}
              </label>
            ))}
          </div>
          {err ? <p className="habit-error">{err}</p> : null}
          <div className="habit-ai-result-actions">
            <button type="button" className="habit-btn habit-btn--force-white" onClick={() => void runGenerate()}>
              {copy.regenerate}
            </button>
            <button type="button" className="habit-btn" onClick={importSelected}>
              {copy.importSelected}
            </button>
          </div>
        </>
      ) : null}
    </HabitBottomSheet>
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
