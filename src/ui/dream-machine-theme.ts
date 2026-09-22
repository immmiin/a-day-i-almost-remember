export interface StageTheme {
  bg: string;
  ink: string;
  label: string;
}

export const STAGE_THEME: Record<string, StageTheme> = {
  morning: { bg: "#e7e1ea", ink: "#241a26", label: "morning" },
  midday: { bg: "#ecdca0", ink: "#241a26", label: "midday" },
  afternoon: { bg: "#d9a3a8", ink: "#241a26", label: "afternoon" },
  dusk: { bg: "#755064", ink: "#f4ecdf", label: "dusk" },
  evening: { bg: "#3a2340", ink: "#f4ecdf", label: "evening" },
  night: { bg: "#1c2a20", ink: "#f4ecdf", label: "night" },
};

export function applyStageTheme(el: HTMLElement, theme: StageTheme): void {
  el.style.setProperty("--stage-bg", theme.bg);
  el.style.setProperty("--stage-ink", theme.ink);
}
