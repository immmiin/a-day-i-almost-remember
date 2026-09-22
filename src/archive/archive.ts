import type { DayRun, Scene } from "../generation/types";

const STORAGE_KEY = "day-almost-remember:archive:v1";

export interface SelectionKey {
  runId: string;
  sceneIndex: number;
}

interface StoredArchive {
  runs: DayRun[];
  /** scenes flagged for the zine, as "runId:sceneIndex" strings */
  selected: string[];
}

function selectionKey(k: SelectionKey): string {
  return `${k.runId}:${k.sceneIndex}`;
}

function readStore(): StoredArchive {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { runs: [], selected: [] };
    const parsed = JSON.parse(raw) as StoredArchive;
    if (!Array.isArray(parsed.runs)) return { runs: [], selected: [] };
    return { runs: parsed.runs, selected: parsed.selected ?? [] };
  } catch {
    return { runs: [], selected: [] };
  }
}

function writeStore(store: StoredArchive): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function saveRun(run: DayRun): boolean {
  const store = readStore();
  const existingIndex = store.runs.findIndex((r) => r.id === run.id);
  if (existingIndex >= 0) {
    store.runs[existingIndex] = run;
  } else {
    store.runs.unshift(run);
  }
  return writeStore(store);
}

export function listRuns(): DayRun[] {
  return readStore().runs;
}

export function getRun(runId: string): DayRun | undefined {
  return readStore().runs.find((r) => r.id === runId);
}

export function deleteRun(runId: string): void {
  const store = readStore();
  store.runs = store.runs.filter((r) => r.id !== runId);
  store.selected = store.selected.filter((s) => !s.startsWith(`${runId}:`));
  writeStore(store);
}

export function isSelected(key: SelectionKey): boolean {
  return readStore().selected.includes(selectionKey(key));
}

export function toggleSelection(key: SelectionKey): boolean {
  const store = readStore();
  const k = selectionKey(key);
  const idx = store.selected.indexOf(k);
  let nowSelected: boolean;
  if (idx >= 0) {
    store.selected.splice(idx, 1);
    nowSelected = false;
  } else {
    store.selected.push(k);
    nowSelected = true;
  }
  writeStore(store);
  return nowSelected;
}

export function getSelectedScenes(): Array<{ run: DayRun; scene: Scene }> {
  const store = readStore();
  const out: Array<{ run: DayRun; scene: Scene }> = [];
  for (const key of store.selected) {
    const [runId, sceneIndexStr] = key.split(":");
    const run = store.runs.find((r) => r.id === runId);
    if (!run) continue;
    const scene = run.scenes.find((s) => s.index === Number(sceneIndexStr));
    if (scene) out.push({ run, scene });
  }
  return out;
}

export function exportRunAsJson(run: DayRun): string {
  return JSON.stringify(run, null, 2);
}

export function exportRunAsText(run: DayRun): string {
  const lines: string[] = [];
  lines.push(`A DAY I ALMOST REMEMBER`);
  lines.push(`run ${run.id} — generated ${new Date(run.createdAt).toLocaleString()}`);
  lines.push("");
  for (const scene of run.scenes) {
    lines.push(`— scene ${scene.index + 1} · ${scene.timeOfDay.replace("-", " ")} —`);
    lines.push(scene.prose);
    if (scene.distorted) {
      lines.push(`[distorted: ${scene.distorted.axis} — "${scene.distorted.before}" → "${scene.distorted.after}"]`);
    }
    lines.push(`[passed forward: ${scene.passedForward.map((f) => f.label).join("; ")}]`);
    lines.push("");
  }
  return lines.join("\n");
}

export function exportSelectionAsText(): string {
  const selected = getSelectedScenes();
  const lines: string[] = [];
  lines.push(`A DAY I ALMOST REMEMBER — selected for the zine`);
  lines.push("");
  for (const { run, scene } of selected) {
    lines.push(`— run ${run.id.slice(0, 12)} · scene ${scene.index + 1} · ${scene.timeOfDay.replace("-", " ")} —`);
    lines.push(scene.prose);
    lines.push("");
  }
  return lines.join("\n");
}

export function exportSelectionAsJson(): string {
  return JSON.stringify(getSelectedScenes(), null, 2);
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
