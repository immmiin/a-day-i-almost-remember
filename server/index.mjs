import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { buildPrompt } from "./prompt-builder.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = join(__dirname, "generated");
const DRAW_THINGS_URL = "http://localhost:7860";
const PORT = 8787;

await mkdir(GENERATED_DIR, { recursive: true });

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

async function generateImage({ timeOfDay, rememberedFragments, distortionNote, seed, width, height, steps }) {
  const { prompt, negativePrompt } = buildPrompt({ timeOfDay, rememberedFragments, distortionNote });
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

  const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const filename = `${id}.png`;
  await writeFile(join(GENERATED_DIR, filename), Buffer.from(b64, "base64"));

  return { imageUrl: `/images/${filename}`, prompt, seed: usedSeed };
}

const server = createServer(async (req, res) => {
  cors(res);
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
        timeOfDay: body.timeOfDay ?? "morning",
        rememberedFragments,
        distortionNote: body.distortionNote,
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

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, () => {
  console.log(`Dream generation backend listening on http://localhost:${PORT}`);
  console.log(`Proxying to Draw Things at ${DRAW_THINGS_URL}`);
});
