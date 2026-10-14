/**
 * The artist's local studio: the generation backend (:8787) and the built
 * site (dist/ on :3000), started together and stopped together (Ctrl+C).
 * Run through `npm run studio`, which builds first. Draw Things must
 * already be open with its HTTP API server on port 7860.
 */
import { spawn } from "node:child_process";

const procs = [
  ["backend", process.execPath, ["server/index.mjs"]],
  ["site", process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--port", "3000", "--strictPort"]],
].map(([name, cmd, args]) => {
  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
  const prefix = (chunk) =>
    chunk
      .toString()
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => `[${name}] ${line}`)
      .join("\n") + "\n";
  child.stdout.on("data", (c) => process.stdout.write(prefix(c)));
  child.stderr.on("data", (c) => process.stderr.write(prefix(c)));
  child.on("exit", (code) => {
    if (stopping) return;
    if (name === "backend") {
      // The site keeps serving; it falls back to viewer mode on the next reload.
      console.error(`[backend] exited (${code ?? "signal"}) — the site keeps running in viewer mode. Restart the studio to generate again.`);
      return;
    }
    console.error(`[${name}] exited (${code ?? "signal"}) — stopping the studio`);
    shutdown(code ?? 1);
  });
  return child;
});

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const p of procs) if (p.exitCode === null) p.kill();
  process.exitCode = code;
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// Tell the artist up front whether Draw Things is reachable.
setTimeout(async () => {
  try {
    const res = await fetch("http://127.0.0.1:7860/sdapi/v1/options", { signal: AbortSignal.timeout(3000) });
    console.log(res.ok ? "[studio] Draw Things reachable on 127.0.0.1:7860" : `[studio] Draw Things answered ${res.status}`);
  } catch {
    console.log("[studio] Draw Things NOT reachable on 127.0.0.1:7860 — open it and turn on its HTTP API server (port 7860). The site stays in viewer mode until then (reload after).");
  }
  console.log("[studio] open http://localhost:3000");
}, 1500);
