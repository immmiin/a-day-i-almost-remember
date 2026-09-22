import type { TimeOfDay } from "../generation/types";

export interface SceneTheme {
  bg: string;
  ink: string;
  grain: number;
  accentRemember: string;
  accentForget: string;
  accentDistort: string;
  label: string;
}

// Darkened past their first pass so remember/forget chip text still clears
// 4.5:1 against the darkest light-mode background (afternoon, #cdbfa0).
const LIGHT_ACCENTS = { remember: "#5c3a10", forget: "#453f36", distort: "#7a2626" };
// Lightened so all three still clear 4.5:1 against dusk, the lightest of
// the three dark-ground backgrounds (evening and night have more headroom).
const DARK_ACCENTS = { remember: "#ffe6bd", forget: "#f2eee5", distort: "#ffe4e1" };

export const TIME_THEME: Record<TimeOfDay, SceneTheme> = {
  "early-morning": {
    bg: "#dde2e1",
    ink: "#1c1f22",
    grain: 0.04,
    ...toAccents(LIGHT_ACCENTS),
    label: "early morning",
  },
  morning: {
    bg: "#eee6d2",
    ink: "#2b2416",
    grain: 0.04,
    ...toAccents(LIGHT_ACCENTS),
    label: "morning",
  },
  midday: {
    bg: "#f6f1e4",
    ink: "#1e1a10",
    grain: 0.03,
    ...toAccents(LIGHT_ACCENTS),
    label: "midday",
  },
  afternoon: {
    bg: "#cdbfa0",
    ink: "#241f14",
    grain: 0.05,
    ...toAccents(LIGHT_ACCENTS),
    label: "afternoon",
  },
  dusk: {
    bg: "#8c5a4e",
    ink: "#f5ece2",
    grain: 0.06,
    ...toAccents(DARK_ACCENTS),
    label: "dusk",
  },
  evening: {
    bg: "#4b3a3c",
    ink: "#efe6d8",
    grain: 0.07,
    ...toAccents(DARK_ACCENTS),
    label: "evening",
  },
  night: {
    bg: "#141316",
    ink: "#ece7da",
    grain: 0.08,
    ...toAccents(DARK_ACCENTS),
    label: "night",
  },
  "late-night": {
    bg: "#0f1220",
    ink: "#e4e2ec",
    grain: 0.09,
    ...toAccents(DARK_ACCENTS),
    label: "late night",
  },
  midnight: {
    bg: "#0a0a14",
    ink: "#dedaea",
    grain: 0.1,
    ...toAccents(DARK_ACCENTS),
    label: "midnight",
  },
  "pre-dawn": {
    bg: "#232338",
    ink: "#e9e6f0",
    grain: 0.07,
    ...toAccents(DARK_ACCENTS),
    label: "pre-dawn",
  },
  "next-morning": {
    bg: "#dde2e1",
    ink: "#1c1f22",
    grain: 0.04,
    ...toAccents(LIGHT_ACCENTS),
    label: "the next morning",
  },
};

function toAccents(a: { remember: string; forget: string; distort: string }) {
  return { accentRemember: a.remember, accentForget: a.forget, accentDistort: a.distort };
}

export function applyTheme(el: HTMLElement, theme: SceneTheme): void {
  el.style.setProperty("--scene-bg", theme.bg);
  el.style.setProperty("--scene-ink", theme.ink);
  el.style.setProperty("--scene-grain", String(theme.grain));
  el.style.setProperty("--accent-remember", theme.accentRemember);
  el.style.setProperty("--accent-forget", theme.accentForget);
  el.style.setProperty("--accent-distort", theme.accentDistort);
}
