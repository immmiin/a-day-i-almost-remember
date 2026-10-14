import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { publicationCaption } from "./pdf-export.mjs";

/**
 * The permanent, public record of every generation: the original PNG, a
 * WebP copy the site actually displays, and one manifest entry each — all
 * inside public/generations/, so every build (and any static deploy) ships
 * them and the site can show them with no backend running. Nothing here
 * ever deletes a file or a manifest entry.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
export const GALLERY_DIR = join(__dirname, "..", "public", "generations");
const MANIFEST_FILE = join(GALLERY_DIR, "index.json");
const WEBP_QUALITY = 85;

/** Public URL prefix new generations are saved under (imageUrl in runs.json). */
export const GALLERY_URL_PREFIX = "/generations/";

async function readManifest() {
  if (!existsSync(MANIFEST_FILE)) return [];
  try {
    const parsed = JSON.parse(await readFile(MANIFEST_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A corrupt manifest must never be silently replaced by a near-empty one.
    throw new Error(`${MANIFEST_FILE} is not valid JSON — fix or restore it before generating`);
  }
}

// Write-then-rename, so a crash mid-write can never leave a truncated manifest.
async function writeManifest(entries) {
  entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const tmp = `${MANIFEST_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(entries, null, 2) + "\n", "utf8");
  await rename(tmp, MANIFEST_FILE);
}

// Serializes manifest read-modify-write cycles within this process.
let queue = Promise.resolve();
function withManifest(fn) {
  const next = queue.then(async () => {
    const entries = await readManifest();
    const result = await fn(entries);
    await writeManifest(entries);
    return result;
  });
  queue = next.catch(() => {});
  return next;
}

const labels = (fragments) => (Array.isArray(fragments) ? fragments.map((f) => (typeof f === "string" ? f : f?.label)).filter(Boolean) : []);

/** Caption for a gallery entry — never invented, may be blank. */
export function captionFor({ zineCaption, prompt, sceneIndex, seedText }) {
  return publicationCaption({ caption: zineCaption }, { prompt: prompt ?? "" }) || (sceneIndex === 0 ? (seedText ?? "").trim() : "");
}

/**
 * Saves a finished generation permanently: `<id>.png` (original bytes),
 * `<id>.webp`, and a manifest entry. Returns the entry.
 */
export async function addGeneration({ id, png, createdAt, runId, sceneIndex, timeOfDay, caption, remembers }) {
  await mkdir(GALLERY_DIR, { recursive: true });
  const filename = `${id}.png`;
  const webp = `${id}.webp`;
  await writeFile(join(GALLERY_DIR, filename), png);
  const info = await sharp(png).webp({ quality: WEBP_QUALITY }).toFile(join(GALLERY_DIR, webp));
  return withManifest((entries) => {
    const entry = {
      id,
      filename,
      webp,
      width: info.width,
      height: info.height,
      caption: caption ?? "",
      runId: runId ?? null,
      sceneNumber: typeof sceneIndex === "number" ? sceneIndex + 1 : null,
      timeOfDay: timeOfDay ?? null,
      remembers: labels(remembers),
      forgets: [],
      passesForward: [],
      createdAt: createdAt ?? new Date().toISOString(),
    };
    const i = entries.findIndex((e) => e.id === id);
    if (i >= 0) entries[i] = entry;
    else entries.push(entry);
    return entry;
  });
}

/**
 * Fills in the fragment detail a saved scene carries (only known once Dream
 * Machine saves it). No-op for images that aren't in the gallery.
 */
export async function syncSceneToGallery(run, scene) {
  if (!scene?.imageUrl) return;
  const id = basename(scene.imageUrl).replace(/\.png$/, "");
  await withManifest((entries) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    entry.runId = run.id;
    entry.sceneNumber = scene.index + 1;
    entry.timeOfDay = scene.timeOfDay ?? entry.timeOfDay;
    entry.remembers = labels(scene.remembered);
    entry.forgets = labels(scene.forgotten);
    entry.passesForward = labels(scene.passedForward);
    entry.caption = captionFor({ zineCaption: zineCaptionFor(run, scene.index), prompt: scene.prompt, sceneIndex: scene.index, seedText: run.seedText }) || entry.caption;
  });
}

/** Carries hand-written zine page captions over to the matching gallery entries. */
export async function syncZineCaptionsToGallery(run) {
  const pages = run?.zine?.pages;
  if (!Array.isArray(pages)) return;
  await withManifest((entries) => {
    for (const scene of run.scenes ?? []) {
      const zineCaption = zineCaptionFor(run, scene.index);
      if (!zineCaption) continue;
      const entry = entries.find((e) => e.id === basename(scene.imageUrl ?? "").replace(/\.png$/, ""));
      if (!entry) continue;
      entry.caption = captionFor({ zineCaption, prompt: scene.prompt, sceneIndex: scene.index, seedText: run.seedText }) || entry.caption;
    }
  });
}

function zineCaptionFor(run, sceneIndex) {
  const page = (run?.zine?.pages ?? []).find((p) => p && p.sceneIndex === sceneIndex && p.caption);
  return page?.caption;
}
