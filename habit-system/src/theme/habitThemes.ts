/**
 * 与仓库根目录英文 To-do `src/theme/themes.ts` 使用同一套 exact hex。
 * Theme 顺序：Pink → Blue → Purple；默认 Pink。
 */

/** 与 To-do `THEME_IDS` 一致 */
export const HABIT_THEME_ORDER = ["pink", "blue", "purple"] as const;
export type HabitThemeId = (typeof HABIT_THEME_ORDER)[number];

export type HabitThemeDefinition = {
  id: HabitThemeId;
  label: string;
  /** 主色 — exact primary */
  primary: string;
  /** 实心主按钮上的文字/图标色 — 与 To-do `onPrimary` 一致 */
  onPrimary: string;
  /** Efficiency Feeling 1–10 — exact gradient */
  efficiencySteps: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
};

export const HABIT_THEME_DEFINITIONS: Record<HabitThemeId, HabitThemeDefinition> = {
  pink: {
    id: "pink",
    label: "Pink",
    primary: "#eb94ad",
    onPrimary: "#ffffff",
    efficiencySteps: [
      "#ffeff2",
      "#fff6f7",
      "#fedadf",
      "#fcd4d9",
      "#fbcdd3",
      "#f9c6cd",
      "#f7c0c7",
      "#f5b9c1",
      "#f4b2bb",
      "#f2abb5",
    ],
  },
  blue: {
    id: "blue",
    label: "Blue",
    primary: "#a3ccfb",
    onPrimary: "#143c9c",
    efficiencySteps: [
      "#e9f7fe",
      "#f3fafe",
      "#cbebfc",
      "#c4e4fc",
      "#bcdcf4",
      "#a3ccfb",
      "#84bcfc",
      "#2fc3fb",
      "#22a9d1",
      "#3172b4",
    ],
  },
  purple: {
    id: "purple",
    label: "Purple",
    primary: "#c7b1ff",
    onPrimary: "#1c1428",
    efficiencySteps: [
      "#fdf4ff",
      "#fef9ff",
      "#fbe4ff",
      "#f2daff",
      "#e9cfff",
      "#e3c7ff",
      "#dcbfff",
      "#d7b8ff",
      "#d1b1ff",
      "#c5a3ff",
    ],
  },
};

/** 浏览器 meta theme-color：取各主题 gradient 第 1 档 */
export const HABIT_THEME_META_TINT: Record<HabitThemeId, string> = {
  pink: HABIT_THEME_DEFINITIONS.pink.efficiencySteps[0],
  blue: HABIT_THEME_DEFINITIONS.blue.efficiencySteps[0],
  purple: HABIT_THEME_DEFINITIONS.purple.efficiencySteps[0],
};
