import { useCallback, useEffect, useMemo, useState } from "react";
import { ExerciseDurationModal } from "../components/ExerciseDurationModal";
import { HabitTimeCheckinModal } from "../components/HabitTimeCheckinModal";
import { NewHabitBottomSheet } from "../components/NewHabitBottomSheet";
import { OverlayPortal } from "../components/OverlayPortal";
import { useHabitToast } from "../context/HabitToastContext";
import { useLanguage } from "../context/LanguageContext";
import { useMainlineLoop } from "../context/MainlineLoopContext";
import { useAppConfig } from "../config/appConfig";
import { getDone, useHabitCatalog } from "../hooks/useHabitCatalog";
import {
  getHeartbeatForDate,
  getRecordedTimeIso,
  getWeekdayForIsoDate,
  isHabitDueOnWeekday,
  type HabitCatalogState,
  type HabitDef,
  type HeartbeatMood,
  getPointsForHabitComplete,
} from "../lib/habitListStorage";
import { todayIsoLocal, addDays } from "../lib/dateLocal";
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
  lastNightSleepHours: number | null;
  habitDaily: HabitDaily;
  deductionReminders: string[];
  mainline: { title: string; progress_percent: number; note: string | null } | null;
  externalTodo: { mode: string; completionRate: number | null };
};

function makeSummary(date: string, extRate: number | null): Summary {
  return {
    date,
    availablePoints: 0,
    lifetimePoints: 0,
    lastNightSleepHours: null,
    habitDaily: null,
    deductionReminders: [],
    mainline: null,
    externalTodo: { mode: "local", completionRate: extRate },
  };
}

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
  catalog: HabitCatalogState,
  dayStr: string,
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
    const iso = daily?.sleep_started_at ?? catalog.dayTimes?.[dayStr]?.sleepIso;
    if (iso) {
      const show = fmtTime(iso, timeLocale);
      return t("home.meta.time.done", { name: def.name, time: show });
    }
    return t("home.meta.default.done");
  }
  if (def.systemKey === "wake") {
    if (!done) return t("home.meta.wake.undone");
    const iso = daily?.wake_at ?? catalog.dayTimes?.[dayStr]?.wakeIso;
    if (iso) {
      const show = fmtTime(iso, timeLocale);
      return t("home.meta.time.done", { name: def.name, time: show });
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
  if (!def.systemKey && def.targetType === "time") {
    if (!done) {
      return t("home.meta.time.undone", { time: def.targetTime && def.targetTime.length > 0 ? def.targetTime : "—" });
    }
    const iso = getRecordedTimeIso(catalog, def.id, dayStr);
    if (iso) {
      return t("home.meta.time.done", { name: def.name, time: fmtTime(iso, timeLocale) });
    }
    return t("home.meta.default.done");
  }
  if (def.penalty > 0) {
    return done ? t("home.meta.penalty.done") : t("home.meta.default.undone", { pts: def.completePoints });
  }
  return done
    ? t("home.meta.default.done")
    : t("home.meta.default.undone", { pts: def.completePoints });
}

function daysBetweenIso(today: string, target: string): number {
  const [ty, tm, td] = today.split("-").map(Number);
  const [dy, dm, dd] = target.split("-").map(Number);
  const a = new Date(ty, tm - 1, td).getTime();
  const b = new Date(dy, dm - 1, dd).getTime();
  return Math.round((a - b) / 86400000);
}

function formatShortDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
}

function decayForBackfill(daysBack: number): number {
  if (daysBack <= 0) return 1;
  if (daysBack === 1) return 0.7;
  if (daysBack === 2) return 0.4;
  return 0;
}

function getPointsDisplay(
  def: HabitDef,
  done: boolean,
  t: TFn,
  effectivePoints: number,
  backfillDays: number
): { text: string; cls: string } {
  if (done) {
    return { text: t("home.points.recorded"), cls: "habit-checkin-points habit-checkin-points--recorded" };
  }
  if (def.systemKey === "exercise") {
    return { text: t("home.points.setDuration"), cls: "habit-checkin-points habit-checkin-points--pos" };
  }
  if (backfillDays > 0) {
    return { text: `+${effectivePoints}`, cls: "habit-checkin-points habit-checkin-points--soft" };
  }
  return { text: `+${effectivePoints}`, cls: "habit-checkin-points habit-checkin-points--pos" };
}

function needsTimeModal(def: HabitDef): boolean {
  return def.systemKey === "sleep" || def.systemKey === "wake" || (!def.systemKey && def.targetType === "time");
}

function moodLabel(t: TFn, mood: HeartbeatMood): string {
  if (mood === "tired") return t("home.heartbeat.mood.tired");
  if (mood === "energized") return t("home.heartbeat.mood.energized");
  return t("home.heartbeat.mood.neutral");
}

function relativeDayLabel(t: TFn, today: string, selected: string): string {
  const offset = daysBetweenIso(today, selected);
  if (offset === 0) return t("home.date.today");
  if (offset === 1) return t("home.date.yesterday");
  if (offset === 2) return t("home.date.beforeYesterday");
  return formatShortDateLabel(selected);
}

export function HomePage() {
  const today = todayIsoLocal();
  const minBackfillDate = addDays(today, -2);
  const [ext, setExt] = useState<{ total: number; completed: number; rate: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [d, setD] = useState<Summary>(() => makeSummary(today, null));
  const day = d.date;
  const weekday = getWeekdayForIsoDate(day);
  const { mode, showExternalIntegration } = useAppConfig();
  const { t, lang } = useLanguage();
  const timeLocale = lang === "en" ? "en-GB" : "zh-CN";
  const { toast } = useHabitToast();
  const { getEffectiveAvailable, spendableDelta } = useMainlineLoop();
  const { catalog, removeHabit, addHabit, updateHabit, toggleLocalHabit, markHeartbeat, reload: reloadCatalog } =
    useHabitCatalog();

  const [busy] = useState<string | null>(null);
  const [extErr, setExtErr] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newSheet, setNewSheet] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitDef | null>(null);
  const [exModal, setExModal] = useState(false);
  const [timeModalDef, setTimeModalDef] = useState<HabitDef | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [showOverdue, setShowOverdue] = useState(false);
  const [heartbeatPickerOpen, setHeartbeatPickerOpen] = useState(false);

  const buildLocalSummary = useCallback((): Summary => {
    return makeSummary(selectedDate, ext?.rate ?? null);
  }, [selectedDate, ext?.rate]);

  const reload = useCallback(() => {
    setD(buildLocalSummary());
  }, [buildLocalSummary]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const sync = () => {
      const t = todayIsoLocal();
      if (selectedDate > t || selectedDate < addDays(t, -2)) {
        const safe = selectedDate > t ? t : addDays(t, -2);
        setSelectedDate(safe);
        setD({ ...makeSummary(safe, ext?.rate ?? null) });
      }
    };
    const id = window.setInterval(sync, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ext?.rate, selectedDate]);

  useEffect(() => {
    const h = () => reloadCatalog();
    window.addEventListener("habit-promo-data", h);
    return () => window.removeEventListener("habit-promo-data", h);
  }, [reloadCatalog]);

  const daily = d?.habitDaily ?? null;
  const allDueHabits = catalog.items.filter((h) => isHabitDueOnWeekday(h, weekday));
  const backfillDays = daysBetweenIso(today, day);
  const decayRate = decayForBackfill(backfillDays);

  const heartbeat = getHeartbeatForDate(catalog, day);
  const hasHeartbeat = Boolean(heartbeat);

  const overdueHiddenIds = useMemo(() => {
    if (day !== today) return new Set<string>();
    const now = new Date();
    const hmNow = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return new Set(
      allDueHabits
        .filter((h) => h.targetType === "time" && h.targetTime && h.targetTime < hmNow)
        .filter((h) => !getDone(h, daily, catalog, day))
        .map((h) => h.id)
    );
  }, [allDueHabits, catalog, daily, day, today]);

  const visibleHabits = useMemo(() => {
    const base = showOverdue ? allDueHabits : allDueHabits.filter((h) => !overdueHiddenIds.has(h.id));
    return [...base].sort((a, b) => getPointsForHabitComplete(b) - getPointsForHabitComplete(a));
  }, [allDueHabits, overdueHiddenIds, showOverdue]);

  const pinnedHabits = useMemo(() => visibleHabits.filter((h) => h.isPinned === true), [visibleHabits]);
  const normalHabits = useMemo(() => visibleHabits.filter((h) => h.isPinned !== true), [visibleHabits]);
  const topHabits = pinnedHabits;
  const extraHabits = normalHabits;

  const localToggle = useCallback(
    (def: HabitDef, clockIso?: string | null) => {
      if (isEditing) return;
      const was = getDone(def, daily, catalog, day);
      const now = !was;
      const effectivePts = Math.round(getPointsForHabitComplete(def) * decayRate);
      const doneMeta = now
        ? {
            backfillDays: Math.min(2, Math.max(0, backfillDays)) as 0 | 1 | 2,
            decayRate: decayRate as 1 | 0.7 | 0.4,
            awardedPoints: effectivePts,
            recordedAtIso: new Date().toISOString(),
          }
        : undefined;
      toggleLocalHabit(day, def, was, now, clockIso, effectivePts, doneMeta);
      const pts = effectivePts;
      const pen = def.penalty > 0 ? Math.round(def.penalty) : 0;
      const after =
        was && !now ? -pts - pen : !was && now ? pts : 0;
      toast({
        title: now ? def.name : `${def.name}${t("home.undo.suffix")}`,
        points: after,
        tone: after < 0 ? "negative" : backfillDays > 0 ? "default" : "default",
      });
    },
    [catalog, daily, day, t, toast, toggleLocalHabit, isEditing, decayRate, backfillDays]
  );

  const runSystemToggle = useCallback(
    (def: HabitDef) => {
      if (!def.systemKey || isEditing) return;
      if (def.systemKey === "sleep" || def.systemKey === "wake") return;
      localToggle(def);
    },
    [isEditing, localToggle]
  );

  const runExerciseFlow = useCallback(
    (def: HabitDef) => {
      if (isEditing) return;
      const done0 = getDone(def, daily, catalog, day);
      if (done0) {
        localToggle(def);
      } else {
        setExModal(true);
      }
    },
    [catalog, daily, day, isEditing, localToggle]
  );

  const confirmExerciseMinutes = useCallback(
    (_minutes: number) => {
      const ex = catalog.items.find((x) => x.systemKey === "exercise");
      if (ex && !getDone(ex, daily, catalog, day)) {
        localToggle(ex);
      }
    },
    [catalog, catalog.items, daily, day, localToggle]
  );

  const runLocalToggle = useCallback(
    (def: HabitDef) => {
      if (isEditing) return;
      localToggle(def);
    },
    [isEditing, localToggle]
  );

  const onRowToggle = (def: HabitDef) => {
    if (isEditing) return;
    if (def.systemKey === "exercise") {
      runExerciseFlow(def);
    } else if (needsTimeModal(def)) {
      const done0 = getDone(def, daily, catalog, day);
      if (done0) {
        localToggle(def);
      } else {
        setTimeModalDef(def);
      }
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

  const onTogglePinned = (def: HabitDef) => {
    updateHabit(def.id, { isPinned: def.isPinned !== true });
  };

  const availableDisplay = getEffectiveAvailable(d.availablePoints) + (catalog.customWallet || 0);

  const systemStreak = useMemo(() => {
    let streak = 0;
    for (let i = 0; i < 365; i += 1) {
      const dIso = addDays(today, -i);
      const hasHb = Boolean(getHeartbeatForDate(catalog, dIso));
      if (!hasHb) break;
      streak += 1;
    }
    return streak;
  }, [catalog, today]);

  const extModeLabel =
    d.externalTodo.mode === "local" ? t("home.external.modeLocal") : d.externalTodo.mode;
  const selectorLabel = relativeDayLabel(t, today, selectedDate);

  const openHeartbeatPicker = () => {
    if (hasHeartbeat) return;
    setHeartbeatPickerOpen(true);
  };

  const chooseHeartbeatMood = (mood: HeartbeatMood) => {
    const awarded = markHeartbeat(day, mood);
    setHeartbeatPickerOpen(false);
    toast({
      title: t("home.heartbeat.recorded", { mood: moodLabel(t, mood) }),
      points: awarded,
      tone: awarded > 0 ? "positive" : "default",
    });
  };

  return (
    <>
      <section className="habit-checkin-page" aria-label={t("nav.checkin")}>
      <div className="habit-day-nav">
        <button
          type="button"
          className="habit-day-nav__btn"
          aria-label={t("home.date.prev")}
          onClick={() => setSelectedDate((v) => addDays(v, -1))}
          disabled={selectedDate <= minBackfillDate}
        >
          ‹
        </button>
        <button
          type="button"
          className="habit-day-nav__date-pill"
          aria-label={t("home.aria.date")}
          onClick={() => setSelectedDate(today)}
          title={selectedDate !== today ? t("home.date.jumpToday") : undefined}
        >
          {selectorLabel}
        </button>
        <button
          type="button"
          className="habit-day-nav__btn"
          aria-label={t("home.date.next")}
          disabled={selectedDate >= today}
          onClick={() => setSelectedDate((v) => (v >= today ? v : addDays(v, 1)))}
        >
          ›
        </button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div className="habit-hero-points habit-hero-points--promo" style={{ marginBottom: 0 }}>
          <div className="habit-hero-points__label">{t("home.available")}</div>
          <div className="habit-hero-points__value">{availableDisplay}</div>
        </div>
        <p className="habit-muted" style={{ margin: "6px 2px 0", fontSize: 12 }}>
          {t("home.systemStreak", { n: systemStreak })}
        </p>
        {mode === "PERSONAL" &&
        showExternalIntegration &&
        (spendableDelta > 0 || (catalog.customWallet || 0) > 0) ? (
          <p className="habit-muted" style={{ margin: "4px 0 0", fontSize: 12, textAlign: "center" }}>
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

      <div className="habit-row-card habit-heartbeat-card">
        <div className="habit-heartbeat-card__copy">
          <strong>{t("home.heartbeat.title")}</strong>
          <span className="habit-checkin-meta">
            {hasHeartbeat
              ? t("home.heartbeat.done", { mood: moodLabel(t, heartbeat?.mood ?? "neutral") })
              : t("home.heartbeat.hint")}
          </span>
        </div>
        <button
          type="button"
          className={`habit-btn habit-btn--heartbeat ${hasHeartbeat ? "habit-btn--heartbeat-done" : ""}`}
          onClick={openHeartbeatPicker}
          disabled={hasHeartbeat}
        >
          {hasHeartbeat ? t("home.heartbeat.doneShort") : t("home.heartbeat.cta")}
        </button>
      </div>

      {overdueHiddenIds.size > 0 && !showOverdue ? (
        <button
          type="button"
          className="habit-btn habit-btn--ghost"
          style={{ marginBottom: 10 }}
          onClick={() => setShowOverdue(true)}
        >
          {t("home.overdue.expand", { n: overdueHiddenIds.size })}
        </button>
      ) : null}

      {topHabits.length === 0 ? (
        <p className="habit-muted" style={{ margin: "6px 0 10px" }}>
          {t("home.pin.emptyHint")}
        </p>
      ) : null}

      <ul className="habit-checkin-stack">
        {topHabits.map((def) => {
          const done0 = getDone(def, daily, catalog, day);
          const effectivePts = Math.round(getPointsForHabitComplete(def) * decayRate);
          const { text, cls } = getPointsDisplay(def, done0, t, effectivePts, backfillDays);
          const bKey = def.systemKey ?? def.id;

          return (
            <li key={def.id} className="habit-dailylog-wrap">
              <CheckinRow
                title={def.name}
                streak={def.streak ?? 0}
                meta={
                  done0 || backfillDays <= 0
                    ? buildMeta(def, done0, daily, catalog, day, t, timeLocale)
                    : t("home.backfill.softHint")
                }
                done={done0}
                pointsText={text}
                pointsClassName={cls}
                busy={def.systemKey ? busy === bKey : false}
                isEditing={isEditing}
                onToggle={() => onRowToggle(def)}
                onEdit={isEditing && !def.systemKey ? () => { setEditingHabit(def); setNewSheet(true); } : undefined}
                onDelete={() => onDeleteHabit(def)}
                onTogglePin={() => onTogglePinned(def)}
                isPinned={def.isPinned === true}
                checkAria={t("home.aria.check", {
                  title: def.name,
                  state: done0 ? t("home.aria.state.done") : t("home.aria.state.undone"),
                })}
                deleteAria={t("home.aria.delete", { title: def.name })}
                editAria={!def.systemKey ? t("home.aria.editHabit", { title: def.name }) : undefined}
                pinAria={
                  def.isPinned === true
                    ? t("home.aria.unpin", { title: def.name })
                    : t("home.aria.pin", { title: def.name })
                }
              />
            </li>
          );
        })}
      </ul>

      {extraHabits.length > 0 ? (
        <div className="habit-more-wrap">
          <button
            type="button"
            className="habit-btn habit-btn--ghost"
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? t("home.more.collapse") : t("home.more.expand", { n: extraHabits.length })}
          </button>
          {showMore ? (
            <ul className="habit-checkin-stack" style={{ marginTop: 10 }}>
              {extraHabits.map((def) => {
                const done0 = getDone(def, daily, catalog, day);
                const effectivePts = Math.round(getPointsForHabitComplete(def) * decayRate);
                const { text, cls } = getPointsDisplay(def, done0, t, effectivePts, backfillDays);
                const bKey = def.systemKey ?? def.id;
                return (
                  <li key={def.id} className="habit-dailylog-wrap">
                    <CheckinRow
                      title={def.name}
                      streak={def.streak ?? 0}
                      meta={
                        done0 || backfillDays <= 0
                          ? buildMeta(def, done0, daily, catalog, day, t, timeLocale)
                          : t("home.backfill.softHint")
                      }
                      done={done0}
                      pointsText={text}
                      pointsClassName={cls}
                      busy={def.systemKey ? busy === bKey : false}
                      isEditing={isEditing}
                      onToggle={() => onRowToggle(def)}
                      onEdit={isEditing && !def.systemKey ? () => { setEditingHabit(def); setNewSheet(true); } : undefined}
                      onDelete={() => onDeleteHabit(def)}
                      onTogglePin={() => onTogglePinned(def)}
                      isPinned={def.isPinned === true}
                      checkAria={t("home.aria.check", {
                        title: def.name,
                        state: done0 ? t("home.aria.state.done") : t("home.aria.state.undone"),
                      })}
                      deleteAria={t("home.aria.delete", { title: def.name })}
                      editAria={!def.systemKey ? t("home.aria.editHabit", { title: def.name }) : undefined}
                      pinAria={
                        def.isPinned === true
                          ? t("home.aria.unpin", { title: def.name })
                          : t("home.aria.pin", { title: def.name })
                      }
                    />
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className="habit-btn habit-btn--force-white habit-dailylog-add"
        onClick={() => setNewSheet(true)}
      >
        {t("home.addHabit")}
      </button>

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
      </section>

      <OverlayPortal>
        <NewHabitBottomSheet
          open={newSheet}
          editingHabit={editingHabit}
          onClose={() => {
            setNewSheet(false);
            setEditingHabit(null);
          }}
          onSave={(h) => {
            if (h.id) {
              updateHabit(h.id, {
                name: h.name,
                completePoints: h.completePoints,
                penalty: h.penalty,
                schedule: h.schedule,
                targetType: h.targetType,
                targetTime: h.targetType === "time" ? h.targetTime : undefined,
              });
            } else {
              addHabit(h);
            }
            setEditingHabit(null);
          }}
        />
      </OverlayPortal>

      <HabitTimeCheckinModal
        open={timeModalDef != null}
        habit={timeModalDef}
        dayYmd={day}
        onClose={() => setTimeModalDef(null)}
        onConfirm={(iso) => {
          if (!timeModalDef || isEditing) return;
          if (getDone(timeModalDef, daily, catalog, day)) return;
          localToggle(timeModalDef, iso);
        }}
      />

      <ExerciseDurationModal
        open={exModal}
        onClose={() => setExModal(false)}
        defaultCustom={25}
        onConfirm={(m) => {
          confirmExerciseMinutes(m);
        }}
      />

      {heartbeatPickerOpen ? (
        <div className="habit-modal-backdrop" onClick={() => setHeartbeatPickerOpen(false)}>
          <div className="habit-modal-card--celebrate" onClick={(e) => e.stopPropagation()}>
            <h3 className="habit-modal-title">{t("home.heartbeat.pickerTitle")}</h3>
            <p className="habit-modal-body">{t("home.heartbeat.pickerLead")}</p>
            <div className="habit-duration-pills" style={{ justifyContent: "center", marginTop: 12 }}>
              <button type="button" className="habit-duration-pill" onClick={() => chooseHeartbeatMood("tired")}>
                😴 {t("home.heartbeat.mood.tired")}
              </button>
              <button type="button" className="habit-duration-pill" onClick={() => chooseHeartbeatMood("neutral")}>
                😐 {t("home.heartbeat.mood.neutral")}
              </button>
              <button type="button" className="habit-duration-pill" onClick={() => chooseHeartbeatMood("energized")}>
                ⚡ {t("home.heartbeat.mood.energized")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
  onEdit,
  onDelete,
  onTogglePin,
  isPinned,
  checkAria,
  deleteAria,
  editAria,
  pinAria,
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
  onEdit?: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  isPinned: boolean;
  checkAria: string;
  deleteAria: string;
  editAria?: string;
  pinAria: string;
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
        <div className="habit-checkin-edit-actions" role="group" aria-label={onEdit ? editAria : deleteAria}>
          {onEdit ? (
            <button
              type="button"
              className="habit-checkin-edit-pencil"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              aria-label={editAria}
            >
              ✎
            </button>
          ) : null}
          <button
            type="button"
            className={`habit-checkin-edit-pin${isPinned ? " habit-checkin-edit-pin--on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            aria-label={pinAria}
            title={pinAria}
          >
            {isPinned ? "★" : "☆"}
          </button>
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
        </div>
      ) : null}
    </div>
  );
}
