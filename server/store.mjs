import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const RUNS_FILE = join(DATA_DIR, "runs.json");

async function ensureStore() {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(RUNS_FILE)) {
    await writeFile(RUNS_FILE, "[]", "utf8");
  }
}

async function readRuns() {
  await ensureStore();
  const raw = await readFile(RUNS_FILE, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeRuns(runs) {
  await ensureStore();
  await writeFile(RUNS_FILE, JSON.stringify(runs, null, 2), "utf8");
}

export async function createRun({ id, seedText, createdAt }) {
  const runs = await readRuns();
  const existing = runs.find((r) => r.id === id);
  if (existing) return existing;
  const run = { id, seedText, createdAt, scenes: [], zine: null };
  runs.unshift(run);
  await writeRuns(runs);
  return run;
}

export async function upsertScene(runId, scene) {
  const runs = await readRuns();
  const run = runs.find((r) => r.id === runId);
  if (!run) throw new Error(`run ${runId} not found`);
  const idx = run.scenes.findIndex((s) => s.index === scene.index);
  if (idx >= 0) run.scenes[idx] = scene;
  else run.scenes.push(scene);
  run.scenes.sort((a, b) => a.index - b.index);
  await writeRuns(runs);
  return run;
}

export async function listRuns() {
  const runs = await readRuns();
  return runs.map((r) => ({
    id: r.id,
    seedText: r.seedText,
    createdAt: r.createdAt,
    sceneCount: r.scenes.length,
    coverImageUrl: r.scenes[0]?.imageUrl ?? null,
    completed: Boolean(r.zine?.pdfUrl),
    zineTitle: r.zine?.title ?? null,
  }));
}

export async function getRun(runId) {
  const runs = await readRuns();
  return runs.find((r) => r.id === runId) ?? null;
}

export async function saveZine(runId, zine) {
  const runs = await readRuns();
  const run = runs.find((r) => r.id === runId);
  if (!run) throw new Error(`run ${runId} not found`);
  run.zine = { ...(run.zine ?? {}), ...zine };
  await writeRuns(runs);
  return run;
}

export async function deleteRun(runId) {
  const runs = await readRuns();
  const next = runs.filter((r) => r.id !== runId);
  await writeRuns(next);
}
