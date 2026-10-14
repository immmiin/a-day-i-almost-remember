import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { buildPrompt } from "./prompt-builder.mjs";
import { createRun, upsertScene, listRuns, getRun, saveZine, deleteRun, listAllImages } from "./store.mjs";
import { exportRunToPdf, exportRunToSpreadPdf } from "./pdf-export.mjs";
import { addGeneration, syncSceneToGallery, syncZineCaptionsToGallery, captionFor, GALLERY_URL_PREFIX, GALLERY_DIR } from "./gallery.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = join(__dirname, "generated");
const PDF_DIR = join(GENERATED_DIR, "zines");
// 127.0.0.1, not "localhost": Draw Things listens on IPv4 only, and
// "localhost" can resolve to ::1 first.
const DRAW_THINGS_URL = "http://127.0.0.1:7860";
const PORT = 8787;

await mkdir(GENERATED_DIR, { recursive: true });
await mkdir(PDF_DIR, { recursive: true });

// Only pages served from this machine may call the backend from a browser.
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && LOCAL_ORIGIN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function checkDrawThings() {
  try {
    const res = await fetch(`${DRAW_THINGS_URL}/sdapi/v1/options`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { connected: false };
    const data = await res.json();
    return { connected: true, model: data.model ?? null };
  } catch {
    return { connected: false };
  }
}

async function generateImage({ runId, timeOfDay, seedText, rememberedFragments, distortionNote, sceneIndex, seed, width, height, steps }) {
  const { prompt, negativePrompt } = buildPrompt({ timeOfDay, seedText, rememberedFragments, distortionNote, sceneIndex });
  const usedSeed = seed ?? Math.floor(Math.random() * 2 ** 31);

  const dtRes = await fetch(`${DRAW_THINGS_URL}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt: negativePrompt,
      width: width ?? 1024,
      height: height ?? 1024,
      steps: steps ?? 20,
      guidance_scale: 4.5,
      seed: usedSeed,
    }),
    signal: AbortSignal.timeout(720000),
  });

  if (!dtRes.ok) {
    throw new Error(`Draw Things returned ${dtRes.status}`);
  }
  const data = await dtRes.json();
  const b64 = data.images?.[0];
  if (!b64) throw new Error("Draw Things response had no image");

  // Saved permanently into public/generations/ (PNG + WebP + manifest
  // entry) so it ships with every build and shows without this backend.
  const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const entry = await addGeneration({
    id,
    png: Buffer.from(b64, "base64"),
    runId,
    sceneIndex,
    timeOfDay,
    caption: captionFor({ prompt, sceneIndex, seedText }),
    remembers: rememberedFragments,
  });

  return { imageUrl: `${GALLERY_URL_PREFIX}${entry.filename}`, prompt, seed: usedSeed };
}

const server = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (url.pathname === "/api/health" && req.method === "GET") {
    const status = await checkDrawThings();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(status));
    return;
  }

  if (url.pathname === "/api/generate" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const rememberedFragments = Array.isArray(body.rememberedFragments) ? body.rememberedFragments : [];
      const result = await generateImage({
        runId: typeof body.runId === "string" ? body.runId : undefined,
        timeOfDay: body.timeOfDay ?? "morning",
        seedText: body.seedText,
        rememberedFragments,
        distortionNote: body.distortionNote,
        sceneIndex: body.sceneIndex,
        seed: body.seed,
        width: body.width,
        height: body.height,
        steps: body.steps,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err?.message ?? err) }));
    }
    return;
  }

  if (url.pathname.startsWith("/images/") && req.method === "GET") {
    const filename = url.pathname.replace("/images/", "");
    const filePath = join(GENERATED_DIR, filename);
    if (!filename.match(/^[\w.-]+\.png$/) || !existsSync(filePath)) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const { createReadStream } = await import("node:fs");
    res.writeHead(200, { "Content-Type": "image/png" });
    createReadStream(filePath).pipe(res);
    return;
  }

  // Live view of public/generations/ — a served dist/ only has the images
  // that existed at build time, so the artist's own Dream Machine loads
  // fresh generations from here until the next build picks them up.
  if (url.pathname.startsWith(GALLERY_URL_PREFIX) && req.method === "GET") {
    const filename = url.pathname.slice(GALLERY_URL_PREFIX.length);
    const type = { png: "image/png", webp: "image/webp" }[filename.split(".").pop()];
    const filePath = join(GALLERY_DIR, filename);
    if (!type || !filename.match(/^[\w.-]+\.(png|webp)$/) || !existsSync(filePath)) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const { createReadStream } = await import("node:fs");
    res.writeHead(200, { "Content-Type": type });
    createReadStream(filePath).pipe(res);
    return;
  }

  if (url.pathname.startsWith("/pdfs/") && req.method === "GET") {
    const filename = url.pathname.replace("/pdfs/", "");
    const filePath = join(PDF_DIR, filename);
    if (!filename.match(/^[\w.-]+\.pdf$/) || !existsSync(filePath)) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const { createReadStream } = await import("node:fs");
    res.writeHead(200, { "Content-Type": "application/pdf" });
    createReadStream(filePath).pipe(res);
    return;
  }

  // Runs: create
  if (url.pathname === "/api/runs" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const run = await createRun({
        id: body.id,
        seedText: body.seedText ?? "",
        createdAt: body.createdAt ?? new Date().toISOString(),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(run));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err?.message ?? err) }));
    }
    return;
  }

  // Runs: list (for Dream Archive)
  if (url.pathname === "/api/runs" && req.method === "GET") {
    const runs = await listRuns();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(runs));
    return;
  }

  // Every generated image still on disk, across every saved run — the
  // landing page's real source pool (see src/ui/dream-files.ts), not
  // limited to the current run or publication covers.
  if (url.pathname === "/api/images" && req.method === "GET") {
    const images = await listAllImages();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(images));
    return;
  }

  const runMatch = url.pathname.match(/^\/api\/runs\/([\w-]+)$/);
  if (runMatch && req.method === "GET") {
    const run = await getRun(runMatch[1]);
    if (!run) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "run not found" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(run));
    return;
  }

  if (runMatch && req.method === "DELETE") {
    await deleteRun(runMatch[1]);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Runs: save a generated scene (persistence — survives reload)
  const scenesMatch = url.pathname.match(/^\/api\/runs\/([\w-]+)\/scenes$/);
  if (scenesMatch && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const run = await upsertScene(scenesMatch[1], body);
      await syncSceneToGallery(run, body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(run));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err?.message ?? err) }));
    }
    return;
  }

  // Zine: save page layout
  const zineMatch = url.pathname.match(/^\/api\/runs\/([\w-]+)\/zine$/);
  if (zineMatch && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const run = await saveZine(zineMatch[1], body);
      await syncZineCaptionsToGallery(run);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(run));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err?.message ?? err) }));
    }
    return;
  }

  // Zine: export the reading-order PDF
  const exportMatch = url.pathname.match(/^\/api\/runs\/([\w-]+)\/export-pdf$/);
  if (exportMatch && req.method === "POST") {
    try {
      const run = await getRun(exportMatch[1]);
      if (!run) throw new Error("run not found");
      const result = await exportRunToPdf(run, run.issueNumber);
      const updated = await saveZine(exportMatch[1], {
        pdfUrl: result.pdfUrl,
        pageCount: result.pageCount,
        exportedAt: new Date().toISOString(),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ...result, run: updated }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err?.message ?? err) }));
    }
    return;
  }

  // Zine: export the 9-canvas reading-spread PDF, for on-screen viewing
  const spreadExportMatch = url.pathname.match(/^\/api\/runs\/([\w-]+)\/export-spread-pdf$/);
  if (spreadExportMatch && req.method === "POST") {
    try {
      const run = await getRun(spreadExportMatch[1]);
      if (!run) throw new Error("run not found");
      const result = await exportRunToSpreadPdf(run, run.issueNumber);
      const updated = await saveZine(spreadExportMatch[1], {
        spreadPdfUrl: result.pdfUrl,
        spreadPageCount: result.pageCount,
        spreadExportedAt: new Date().toISOString(),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ...result, run: updated }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err?.message ?? err) }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

// Loopback only: the generation backend is never reachable from the network.
const HOST = "127.0.0.1";
server.listen(PORT, HOST, () => {
  console.log(`Dream generation backend listening on http://${HOST}:${PORT} (this machine only)`);
  console.log(`Proxying to Draw Things at ${DRAW_THINGS_URL}`);
});
