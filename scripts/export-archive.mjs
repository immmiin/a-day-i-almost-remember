/**
 * Freezes the Dream Archive into static files for the public deploy.
 *
 * The local backend keeps runs in server/data/runs.json and their images and
 * PDFs in server/generated/ — both gitignored, and neither reachable from a
 * static site. This copies what the archive needs to show each issue into
 * public/archive/ (summaries, cover images, issue PDFs) so the deployed site
 * can browse the magazine collection without a backend.
 *
 * Run `npm run snapshot` after making new issues, then commit public/archive/.
 */
import { mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { listRuns, getRun } from "../server/store.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "public", "archive");
const GENERATED = join(root, "server", "generated");

await rm(OUT, { recursive: true, force: true });
await mkdir(join(OUT, "images"), { recursive: true });
await mkdir(join(OUT, "pdfs"), { recursive: true });

const summaries = (await listRuns()).filter((r) => r.sceneCount > 0);
const out = [];
for (const s of summaries) {
  if (s.coverImageUrl?.startsWith("/images/")) {
    const file = basename(s.coverImageUrl);
    const src = join(GENERATED, file);
    if (!existsSync(src)) continue;
    await copyFile(src, join(OUT, "images", file));
  }
  const run = await getRun(s.id);
  for (const url of [run?.zine?.pdfUrl, run?.zine?.spreadPdfUrl]) {
    if (!url) continue;
    const src = join(GENERATED, "zines", basename(url));
    if (existsSync(src)) await copyFile(src, join(OUT, "pdfs", basename(url)));
  }
  out.push({
    ...s,
    completed: Boolean(run?.zine?.pdfUrl && existsSync(join(GENERATED, "zines", basename(run.zine.pdfUrl)))),
    hasSpreadPdf: Boolean(run?.zine?.spreadPdfUrl && existsSync(join(GENERATED, "zines", basename(run.zine.spreadPdfUrl)))),
  });
}
await writeFile(join(OUT, "runs.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`archive snapshot: ${out.length} issues → public/archive/`);
