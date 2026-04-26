import { addDays, todayIsoLocal } from "./dateLocal";
import {
  getCustomDoneForDate,
  getWeekdayForIsoDate,
  isHabitDueOnWeekday,
  loadHabitCatalog,
} from "./habitListStorage";
import { loadMainlineLoopState } from "./mainlineLoopStorage";

export type HabitKeyStat = {
  id: string;
  name: string;
  systemKey?: string;
  dueDays: number;
  doneDays: number;
  rate: number; // 0..1, dueDays 为 0 时为 0
};

export type WeekHabitAnalysis = {
  rangeStart: string;
  rangeEnd: string;
  dayKeys: string[];
  /** 早起 = wake 已打卡日数；熬夜 = 应打卡但未就寝(sleep) 日数，仅作近似的「晚睡风险」 */
  earlyWakeCount: number;
  lateOrNoSleepLogCount: number;
  byHabit: HabitKeyStat[];
  customWalletTotal: number;
  mainlineNote: string;
  /** 中文一句话，与示例风格一致，便于人读 */
  zhNarrative: string;
  /** 给模型用的全英文+结构化块 */
  modelBlockEn: string;
};

/**
 * 过去 7 个本地自然日（含今天）：rangeEnd = today, rangeStart = today-6
 */
function last7DateKeys(): { dates: string[]; rangeStart: string; rangeEnd: string } {
  const rangeEnd = todayIsoLocal();
  const rangeStart = addDays(rangeEnd, -6);
  const dates: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    dates.push(addDays(rangeEnd, -i));
  }
  return { dates, rangeStart, rangeEnd };
}

/**
 * 从 LocalStorage 汇总过去一周打卡，生成中/英结构化说明（供 Report 与 AI 使用）
 */
export function analyzeWeekHabitsFromLocalStorage(): WeekHabitAnalysis {
  const { dates, rangeStart, rangeEnd } = last7DateKeys();
  const catalog = loadHabitCatalog();

  const wake = catalog.items.find((h) => h.systemKey === "wake");
  const sleep = catalog.items.find((h) => h.systemKey === "sleep");

  let earlyWakeCount = 0;
  let lateOrNoSleepLogCount = 0;
  let wakeDueInWeek = 0;
  let sleepDueInWeek = 0;

  for (const date of dates) {
    const wday = getWeekdayForIsoDate(date);
    if (wake && isHabitDueOnWeekday(wake, wday)) {
      wakeDueInWeek += 1;
      if (getCustomDoneForDate(catalog, date, wake.id)) earlyWakeCount += 1;
    }
    if (sleep && isHabitDueOnWeekday(sleep, wday)) {
      sleepDueInWeek += 1;
      if (!getCustomDoneForDate(catalog, date, sleep.id)) lateOrNoSleepLogCount += 1;
    }
  }

  const byHabit: HabitKeyStat[] = catalog.items.map((def) => {
    const { due, done } = (() => {
      let dDue = 0;
      let dDone = 0;
      for (const date of dates) {
        const wday = getWeekdayForIsoDate(date);
        if (!isHabitDueOnWeekday(def, wday)) continue;
        dDue += 1;
        if (getCustomDoneForDate(catalog, date, def.id)) dDone += 1;
      }
      return { due: dDue, done: dDone };
    })();
    const rate = due > 0 ? done / due : 0;
    return {
      id: def.id,
      name: def.name,
      systemKey: def.systemKey,
      dueDays: due,
      doneDays: done,
      rate,
    };
  });

  const ml = loadMainlineLoopState();
  const mainlineNote = ml.current
    ? `Active mainline: "${ml.current.name}" · cumulative quest points ${ml.current.cumulativePoints} · local spendable pool +${ml.spendableDelta}`
    : "No active mainline on this device.";

  const enLines = byHabit
    .filter((x) => x.dueDays > 0)
    .map(
      (x) =>
        `  - ${x.name} (${x.id}): ${x.doneDays}/${x.dueDays} days (${Math.round(x.rate * 100)}% on days due)`
    );

  const english = [
    `Reporting window: ${rangeStart} to ${rangeEnd} (7 local calendar days, inclusive).`,
    `Early rise (wake habit checked): ${earlyWakeCount}/${Math.max(1, wakeDueInWeek)} on days wake was due.`,
    `Days with sleep log missing (rough proxy for "late" risk; bedtime not ticked on due days): ${lateOrNoSleepLogCount}/${Math.max(1, sleepDueInWeek)} on days sleep was due.`,
    `Habit-level completion (local check-ins only):`,
    ...enLines,
    `Custom habit wallet (balance now, not weekly): ${catalog.customWallet ?? 0} pts.`,
    mainlineNote,
  ].join("\n");

  const zhNarrative = `本周（${rangeStart} 至 ${rangeEnd}）本地打卡：早起记录 ${earlyWakeCount} 次；未就寝（睡觉）打卡 ${lateOrNoSleepLogCount} 天；英语口语${
    byHabit.find((h) => h.systemKey === "english")
      ? ` 完成率约 ${Math.round((byHabit.find((h) => h.systemKey === "english")?.rate ?? 0) * 100)}%`
      : "（无此习惯项）"
  }。`;

  return {
    rangeStart,
    rangeEnd,
    dayKeys: dates,
    earlyWakeCount,
    lateOrNoSleepLogCount,
    byHabit,
    customWalletTotal: catalog.customWallet ?? 0,
    mainlineNote,
    zhNarrative,
    modelBlockEn: english,
  };
}

/**
 * 合并为单段文本，作为 Chat user message
 */
export function buildWeekHabitDataSummaryForModel(): string {
  const a = analyzeWeekHabitsFromLocalStorage();
  return [
    "=== Structured habit data (this device) ===",
    a.modelBlockEn,
    "=== One-line Chinese (for product context) ===",
    a.zhNarrative,
  ].join("\n");
}
