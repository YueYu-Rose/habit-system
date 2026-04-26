export type ThemeId = "purple" | "blue" | "pink";

export type ThemeDefinition = {
  id: ThemeId;
  /** Title Case label for the theme switcher */
  label: string;
  /** Primary accent — summary numbers, title, controls, checkbox */
  primary: string;
  /** Text/icon color on solid primary backgrounds (segment, pills) */
  onPrimary: string;
  /** Ten colors for Efficiency Feeling blocks 1–10 (filled state) */
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
    string
  ];
};

/** 与 `theme-tokens.css` 一致：渐变整体「淡 2 度」后的色值。 */
export const THEMES: Record<ThemeId, ThemeDefinition> = {
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
};

/** Visible order in theme switcher: Pink, Blue, Purple */
export const THEME_IDS: ThemeId[] = ["pink", "blue", "purple"];

/** 默认加载顺序首项：Pink */
export const DEFAULT_THEME_ID: ThemeId = "pink";
