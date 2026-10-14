/**
 * One-time (safe to re-run) backfill: copies every image referenced by a
 * saved scene in server/data/runs.json from server/generated/ into
 * public/generations/ (PNG + WebP) with a manifest entry. Only reads
 * runs.json and server/generated/ — never modifies or deletes either.
 * Images no saved scene references are left out on purpose.
 *
 *   node server/backfill-gallery.mjs
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { addGeneration, syncSceneToGallery, GALLERY_DIR } from "./gallery.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const runs = JSON.parse(await readFile(join(__dirname, "data", "runs.json"), "utf8"));

let added = 0;
let skipped = 0;
const seen = new Set();
for (const run of runs) {
  for (const scene of run.scenes ?? []) {
    if (!scene.imageUrl?.startsWith("/images/")) continue;
    const id = basename(scene.imageUrl).replace(/\.png$/, "");
    if (seen.has(id)) continue;
    seen.add(id);
    const src = join(__dirname, "generated", `${id}.png`);
    if (!existsSync(src)) {
      console.warn(`missing source, skipped: ${src}`);
      continue;
    }
    if (existsSync(join(GALLERY_DIR, `${id}.png`)) && existsSync(join(GALLERY_DIR, `${id}.webp`))) {
      skipped++;
    } else {
      await addGeneration({
        id,
        png: await readFile(src),
        createdAt: scene.createdAt ?? run.createdAt,
        runId: run.id,
        sceneIndex: scene.index,
        timeOfDay: scene.timeOfDay,
      });
      added++;
    }
    await syncSceneToGallery(run, scene);
  }
}
console.log(`backfill done: ${added} added, ${skipped} already present`);
