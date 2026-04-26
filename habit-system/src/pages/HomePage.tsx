import { useCallback, useEffect, useState } from "react";
import { ExerciseDurationModal } from "../components/ExerciseDurationModal";
import { NewHabitBottomSheet } from "../components/NewHabitBottomSheet";
import { OverlayPortal } from "../components/OverlayPortal";
import { useHabitToast } from "../context/HabitToastContext";
import { useLanguage } from "../context/LanguageContext";
import { useMainlineLoop } from "../context/MainlineLoopContext";
import { useAppConfig } from "../config/appConfig";
import { getDone, useHabitCatalog } from "../hooks/useHabitCatalog";
import { getWeekdayForIsoDate, isHabitDueOnWeekday, type HabitDef } from "../lib/habitListStorage";
import { todayIsoLocal, formatLocaleDate } from "../lib/dateLocal";
import type { TransKey } from "../locales/zh";

type HabitDaily = {
  sleep_started_at: string | null;
  wake_at: string | null;
  shower_at: string | null;
  english_done: number | null;
  cantonese_done: number | null;
  exercise_done: number | null;
  exercise_minutes: number | null;
} | null;

type Summary = {
  date: string;
  availablePoints: number;
  lifetimePoints: number;
  weekNetPoints: number;
  lastNightSleepHours: number | null;
  habitDaily: HabitDaily;
  deductionReminders: string[];
  mainline: { title: string; progress_percent: number; note: string | null } | null;
  externalTodo: { mode: string; completionRate: number | null };
};

type TFn = (key: TransKey, vars?: Record<string, string | number>) => string;

function fmtTime(iso: string | null | undefined, timeLocale: string): string {
  if (!iso) return "";
  const t0 = new Date(iso);
  if (Number.isNaN(t0.getTime())) return "";
  return t0.toLocaleString(timeLocale, { hour: "2-digit", minute: "2-digit" });
}

function buildMeta(
  def: HabitDef,
  done: boolean,
  daily: HabitDaily,
  t: TFn,
  timeLocale: string
): string {
  if (def.systemKey === "exercise") {
    if (done && daily) {
      const m = daily.exercise_minutes;
      if (m != null && m > 0) {
        return t("home.meta.ex.doneWithMins", { min: m });
      }
      return t("home.meta.ex.doneNoMins");
    }
    return t("home.meta.ex.undone");
  }
  if (def.systemKey === "sleep") {
    if (!done) return t("home.meta.sleep.undone");
    if (daily?.sleep_started_at) {
      return t("home.meta.sleep.done", { time: fmtTime(daily.sleep_started_at, timeLocale) });
    }
    return t("home.meta.default.done");
  }
  if (def.systemKey === "wake") {
    if (!done) return t("home.meta.wake.undone");
    if (daily?.wake_at) {
      return t("home.meta.wake.done", { time: fmtTime(daily.wake_at, timeLocale) });
    }
    return t("home.meta.default.done");
  }
  if (def.systemKey === "shower") {
    if (!done) return t("home.meta.shower.undone");
    if (daily?.shower_at) {
      return t("home.meta.shower.done", { time: fmtTime(daily.shower_at, timeLocale) });
    }
    return t("home.meta.default.done");
  }
  if (def.penalty > 0) {
    return done
      ? t("home.meta.penalty.done")
      : t("home.meta.penalty.undone", { pts: def.completePoints, pen: def.penalty });
  }
  return done
    ? t("home.meta.default.done")
    : t("home.meta.default.undone", { pts: def.completePoints });
}

function getPointsDisplay(def: HabitDef, done: boolean, t: TFn): { text: string; cls: string } {
  if (done) {
    return { text: t("home.points.recorded"), cls: "habit-checkin-points habit-checkin-points--recorded" };
  }
  if (def.systemKey === "exercise") {
    return { text: t("home.points.setDuration"), cls: "habit-checkin-points habit-checkin-points--pos" };
  }
  return { text: `+${def.completePoints}`, cls: "habit-checkin-points habit-checkin-points--pos" };
}

export function HomePage() {
  const date = todayIsoLocal();
  const weekday = getWeekdayForIsoDate(date);
  const { mode, showExternalIntegration } = useAppConfig();
  const isPersonal = mode === "PERSONAL";
  const { t, lang } = useLanguage();
  const timeLocale = lang === "en" ? "en-GB" : "zh-CN";
  const { toast } = useHabitToast();
  const { getEffectiveAvailable, spendableDelta } = useMainlineLoop();
  const { catalog, removeHabit, addHabit, toggleLocalHabit, bumpHabitStreak } = useHabitCatalog();

  const [d, setD] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ext, setExt] = useState<{ total: number; completed: number; rate: number } | null>(null);
  const [extErr, setExtErr] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newSheet, setNewSheet] = useState(false);
  const [exModal, setExModal] = useState(false);

  const buildLocalSummary = useCallback((): Summary => {
    return {
      date,
      availablePoints: 0,
      lifetimePoints: 0,
      weekNetPoints: 0,
      lastNightSleepHours: null,
      habitDaily: null,
      deductionReminders: [],
      mainline: null,
      externalTodo: { mode: "local", completionRate: ext?.rate ?? null },
    };
  }, [date, ext?.rate]);

  const reload = useCallback(async () => {
    setD(buildLocalSummary());
  }, [buildLocalSummary]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const daily = d?.habitDaily ?? null;
  const visibleHabits = catalog.items.filter((h) => isHabitDueOnWeekday(h, weekday));

  const localToggle = useCallback(
    (def: HabitDef) => {
      const was = getDone(def, daily, catalog, date);
      const now = !was;
      toggleLocalHabit(date, def, was, now);
      bumpHabitStreak(def.id, now ? 1 : -1);
      const after =
        was && !now
          ? -def.completePoints - (def.penalty > 0 ? def.penalty : 0)
          : !was && now
            ? def.completePoints
            : 0;
      toast({
        title: now ? def.name : `${def.name}${t("home.undo.suffix")}`,
        points: after,
        tone: after < 0 ? "negative" : "default",
      });
    },
    [bumpHabitStreak, catalog, daily, date, t, toast, toggleLocalHabit]
  );

  const runSystemToggle = useCallback(
    (def: HabitDef) => {
      if (!def.systemKey || isEditing) return;
      localToggle(def);
    },
    [isEditing, localToggle]
  );

  const runExerciseFlow = useCallback(
    (def: HabitDef) => {
      if (isEditing) return;
      const done0 = getDone(def, daily, catalog, date);
      if (done0) {
        localToggle(def);
      } else {
        setExModal(true);
      }
    },
    [catalog, daily, date, isEditing, localToggle]
  );

  const confirmExerciseMinutes = useCallback(
    (_minutes: number) => {
      const ex = catalog.items.find((x) => x.systemKey === "exercise");
      if (ex && !getDone(ex, daily, catalog, date)) {
        localToggle(ex);
      }
    },
    [catalog, catalog.items, daily, date, localToggle]
  );

  const runLocalToggle = useCallback(
    (def: HabitDef) => {
      if (isEditing) return;
      localToggle(def);
    },
    [isEditing, localToggle]
  );

  const onRowToggle = (def: HabitDef) => {
    if (def.systemKey === "exercise") {
      runExerciseFlow(def);
    } else if (def.systemKey) {
      runSystemToggle(def);
    } else {
      runLocalToggle(def);
    }
  };

  const onDeleteHabit = (def: HabitDef) => {
    if (!window.confirm(t("home.confirm.deleteHabit", { name: def.name }))) return;
    removeHabit(def.id);
  };

  const availableDisplay = getEffectiveAvailable(d?.availablePoints ?? 0) + (catalog.customWallet || 0);
  if (!d) return <p className="habit-muted">{t("common.loading")}</p>;

  const extModeLabel =
    d.externalTodo.mode === "local" ? t("home.external.modeLocal") : d.externalTodo.mode;

  return (
    <>
      <p className="habit-muted habit-page-lead">{formatLocaleDate(d.date, lang)}</p>

      <div style={{ marginBottom: 14 }}>
        {isPersonal ? (
        <div className="habit-hero-points" style={{ marginBottom: 0 }}>
          <div>
            <div className="habit-hero-points__label">{t("home.available")}</div>
            <div className="habit-hero-points__value">{availableDisplay}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="habit-hero-points__label">{t("home.weekNet")}</div>
            <div
              className={`habit-hero-points__value ${d.weekNetPoints >= 0 ? "habit-amount-pos" : "habit-amount-neg"}`}
            >
              {d.weekNetPoints > 0 ? "+" : ""}
              {d.weekNetPoints}
            </div>
          </div>
        </div>
        ) : (
          <div className="habit-hero-points habit-hero-points--promo" style={{ marginBottom: 0 }}>
            <div>
              <div className="habit-hero-points__label">{t("home.available")}</div>
              <div className="habit-hero-points__value">{availableDisplay}</div>
            </div>
          </div>
        )}
        {mode === "PERSONAL" &&
        showExternalIntegration &&
        (spendableDelta > 0 || (catalog.customWallet || 0) > 0) ? (
          <p className="habit-muted" style={{ margin: "4px 2px 0", fontSize: 12, textAlign: "center" }}>
            {t("home.localPoolNote", { d1: spendableDelta, d2: catalog.customWallet || 0 })}
          </p>
        ) : null}
      </div>

      <div className="habit-dailylog-head">
        <h2 className="habit-section-title" style={{ margin: 0 }}>
          {t("home.section.today")}
        </h2>
        <button
          type="button"
          className="habit-dailylog-edit"
          onClick={() => setIsEditing((e) => !e)}
          aria-pressed={isEditing}
        >
          {isEditing ? t("home.manageDone") : t("home.manage")}
        </button>
      </div>

      <ul className="habit-checkin-stack">
        {visibleHabits.map((def) => {
          const done0 = getDone(def, daily, catalog, date);
          const { text, cls } = getPointsDisplay(def, done0, t);
          const bKey = def.systemKey ?? def.id;

          return (
            <li key={def.id} className="habit-dailylog-wrap">
              <CheckinRow
                title={def.name}
                streak={def.streak ?? 0}
                meta={buildMeta(def, done0, daily, t, timeLocale)}
                done={done0}
                pointsText={text}
                pointsClassName={cls}
                busy={def.systemKey ? busy === bKey : false}
                isEditing={isEditing}
                onToggle={() => onRowToggle(def)}
                onDelete={() => onDeleteHabit(def)}
                checkAria={t("home.aria.check", {
                  title: def.name,
                  state: done0 ? t("home.aria.state.done") : t("home.aria.state.undone"),
                })}
                deleteAria={t("home.aria.delete", { title: def.name })}
              />
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="habit-btn habit-btn--force-white habit-dailylog-add"
        onClick={() => setNewSheet(true)}
      >
        {t("home.addHabit")}
      </button>

      {d.deductionReminders.length > 0 ? (
        <>
          <h2 className="habit-section-title">{t("home.deduction")}</h2>
          <div className="habit-card">
            <ul className="habit-list">
              {d.deductionReminders.map((line, i) => (
                <li key={i} className="habit-amount-neg" style={{ fontWeight: 600 }}>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {showExternalIntegration ? (
        <>
          <h2 className="habit-section-title">{t("home.external.title")}</h2>
          <div className="habit-card">
            <p className="habit-muted habit-card-lead">
              {t("home.external.lead", { mode: extModeLabel })}
              {d.externalTodo.completionRate != null
                ? t("home.external.leadRate", { pct: Math.round(d.externalTodo.completionRate * 100) })
                : ""}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setExtErr(null);
                const form = new FormData(e.currentTarget);
                const total = Number(form.get("total"));
                const completed = Number(form.get("completed"));
                const rate = total > 0 ? Math.max(0, Math.min(1, completed / total)) : 0;
                setExt({ total, completed, rate });
                toast({ title: t("home.toast.rateLocal"), points: Math.round(rate * 10), tone: "positive" });
                setD((prev) => (prev ? { ...prev, externalTodo: { mode: "local", completionRate: rate } } : prev));
              }}
            >
              <input name="date" className="habit-input" type="date" defaultValue={todayIsoLocal()} />
              <input name="total" className="habit-input" type="number" placeholder={t("home.ph.total")} min={1} defaultValue={5} />
              <input name="completed" className="habit-input" type="number" placeholder={t("home.ph.completed")} min={0} defaultValue={4} />
              <button type="submit" className="habit-btn habit-btn--force-white">
                {t("home.btn.writeRate")}
              </button>
            </form>
            {ext ? (
              <p className="habit-muted" style={{ marginTop: 10 }}>
                {t("home.ext.saved", { pct: Math.round(ext.rate * 100) })}
              </p>
            ) : null}
            {extErr ? <p className="habit-error" style={{ marginTop: 8 }}>{extErr}</p> : null}
          </div>
        </>
      ) : null}

      <OverlayPortal>
        <NewHabitBottomSheet
          open={newSheet}
          onClose={() => setNewSheet(false)}
          onSave={(h) => {
            addHabit(h);
          }}
        />
      </OverlayPortal>

      <ExerciseDurationModal
        open={exModal}
        onClose={() => setExModal(false)}
        defaultCustom={25}
        onConfirm={(m) => {
          confirmExerciseMinutes(m);
        }}
      />
    </>
  );
}

function CheckinRow({
  title,
  streak,
  meta,
  done,
  pointsText,
  pointsClassName,
  busy,
  isEditing,
  onToggle,
  onDelete,
  checkAria,
  deleteAria,
}: {
  title: string;
  streak: number;
  meta: string;
  done: boolean;
  pointsText: string;
  pointsClassName: string;
  busy?: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onDelete: () => void;
  checkAria: string;
  deleteAria: string;
}) {
  const fireToggle = () => {
    if (busy || isEditing) return;
    onToggle();
  };
  const fireDelete = () => {
    if (!isEditing || busy) return;
    onDelete();
  };

  return (
    <div
      className={`habit-checkin-card habit-row-card${done ? " habit-checkin-card--done" : ""}${
        isEditing ? " habit-checkin-card--editing" : ""
      }`}
    >
      <button
        type="button"
        className={`habit-checkin-box${done ? " habit-checkin-box--done" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          fireToggle();
        }}
        disabled={busy || isEditing}
        aria-label={checkAria}
        aria-disabled={isEditing}
      >
        {done ? "✓" : ""}
      </button>
      <div
        className="habit-checkin-copy"
        role="button"
        tabIndex={busy || isEditing ? -1 : 0}
        aria-disabled={busy || isEditing}
        onClick={(e) => {
          e.stopPropagation();
          fireToggle();
        }}
        onKeyDown={(e) => {
          if (busy || isEditing) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fireToggle();
          }
        }}
      >
        <span className="habit-checkin-title-wrap">
          <span className="habit-checkin-title">{title}</span>
          {streak > 0 ? <span className="habit-checkin-streak">🔥 {streak}</span> : null}
        </span>
        <span className="habit-checkin-meta">{meta}</span>
      </div>
      <span className={pointsClassName}>{pointsText}</span>
      {isEditing ? (
        <button
          type="button"
          className="habit-checkin-edit-overlay"
          onClick={(e) => {
            e.stopPropagation();
            fireDelete();
          }}
          aria-label={deleteAria}
        >
          <span className="habit-checkin-edit-overlay__icon" aria-hidden>
            🗑
          </span>
        </button>
      ) : null}
    </div>
  );
}
