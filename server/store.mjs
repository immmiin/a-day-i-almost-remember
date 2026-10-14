import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const RUNS_FILE = join(DATA_DIR, "runs.json");
const GENERATED_DIR = join(__dirname, "generated");

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

// A run's issue number is its 1-based rank by creation order among every
// run ever started (draft or completed) — stable enough for this scale
// without a separate counter, and the same number a completed run's PDF
// cover was stamped with at export time.
function issueNumberOf(runs, runId) {
  const sorted = [...runs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const idx = sorted.findIndex((r) => r.id === runId);
  return idx === -1 ? 1 : idx + 1;
}

export async function listRuns() {
  const runs = await readRuns();
  return runs.map((r) => {
    const chosenIndex = r.zine?.cover?.sceneIndex;
    const chosenScene = chosenIndex != null ? r.scenes.find((s) => s.index === chosenIndex) : null;
    return {
      id: r.id,
      seedText: r.seedText,
      createdAt: r.createdAt,
      sceneCount: r.scenes.length,
      coverImageUrl: chosenScene?.imageUrl ?? r.scenes[0]?.imageUrl ?? null,
      completed: Boolean(r.zine?.pdfUrl),
      zineTitle: r.zine?.title ?? null,
      cover: r.zine?.cover ?? null,
      issueNumber: issueNumberOf(runs, r.id),
      filledPageCount: (r.zine?.pages ?? []).filter(Boolean).length,
      hasSpreadPdf: Boolean(r.zine?.spreadPdfUrl),
    };
  });
}

export async function getRun(runId) {
  const runs = await readRuns();
  const run = runs.find((r) => r.id === runId) ?? null;
  if (!run) return null;
  return { ...run, issueNumber: issueNumberOf(runs, runId) };
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

/**
 * Every successfully generated, still-on-disk image across every saved run
 * — drafts and completed issues alike, whether or not it's currently
 * assigned to a publication page — with enough provenance to trace it back
 * to its run and scene. This is the landing page's real source pool (see
 * src/ui/dream-files.ts), not just the current run or cover images.
 *
 * A scene only ever gets an entry in `run.scenes` once generation actually
 * succeeded and the file was written (server/index.mjs's generateImage()),
 * so there's no separate "failed" or "temporary" state to filter out here
 * — the one honest check left is that the file is still actually on disk
 * (it could have been removed by hand outside the app), which also
 * incidentally de-duplicates: two scenes can never legitimately share a
 * generated filename, but this guards against a corrupted record anyway.
 */
export async function listAllImages() {
  const runs = await readRuns();
  const seen = new Set();
  const images = [];
  for (const r of runs) {
    for (const s of r.scenes ?? []) {
      if (!s.imageUrl || seen.has(s.imageUrl)) continue;
      const filePath = s.imageUrl.startsWith("/generations/")
        ? join(__dirname, "..", "public", s.imageUrl)
        : join(GENERATED_DIR, s.imageUrl.replace(/^\/images\//, ""));
      if (!existsSync(filePath)) continue;
      seen.add(s.imageUrl);
      images.push({
        url: s.imageUrl,
        runId: r.id,
        sceneIndex: s.index,
        timeOfDay: s.timeOfDay ?? null,
        createdAt: s.createdAt ?? r.createdAt,
      });
    }
  }
  return images;
}
