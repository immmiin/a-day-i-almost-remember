export interface StageTheme {
  bg: string;
  ink: string;
  label: string;
}

export const STAGE_THEME: Record<string, StageTheme> = {
  "early-morning": { bg: "#dcd6e3", ink: "#241a26", label: "early morning" },
  morning: { bg: "#e7e1ea", ink: "#241a26", label: "morning" },
  midday: { bg: "#ecdca0", ink: "#241a26", label: "midday" },
  afternoon: { bg: "#d9a3a8", ink: "#241a26", label: "afternoon" },
  dusk: { bg: "#755064", ink: "#f4ecdf", label: "dusk" },
  evening: { bg: "#3a2340", ink: "#f4ecdf", label: "evening" },
  night: { bg: "#1c2a20", ink: "#f4ecdf", label: "night" },
  "late-night": { bg: "#171e30", ink: "#e4e2ec", label: "late night" },
  midnight: { bg: "#0f1024", ink: "#dedaea", label: "midnight" },
  "pre-dawn": { bg: "#2c2f4a", ink: "#e9e6f0", label: "pre-dawn" },
  "next-morning": { bg: "#dcd6e3", ink: "#241a26", label: "the next morning" },
};

export function applyStageTheme(el: HTMLElement, theme: StageTheme): void {
  el.style.setProperty("--stage-bg", theme.bg);
  el.style.setProperty("--stage-ink", theme.ink);
}
