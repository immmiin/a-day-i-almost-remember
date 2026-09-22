/**
 * Drives the real pipeline exactly the way the website will: two POSTs to
 * this project's own backend (not Draw Things directly), where the second
 * call receives only text fragments the first response allowed forward —
 * never the first image, never the first scene's full prompt.
 */
const BACKEND = "http://localhost:8787";

async function generate(body) {
  const res = await fetch(`${BACKEND}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`generate failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Modest size/steps for this validation run — proves the pipeline; full
// 1024x1024/20-step quality is the default once this is confirmed working.
const FAST = { width: 512, height: 512, steps: 6 };

console.log("Scene 1: morning, no inherited fragments (first scene of the day)...");
const t0 = Date.now();
const scene1 = await generate({
  timeOfDay: "morning",
  rememberedFragments: [],
  seed: 12345,
  ...FAST,
});
console.log(`(took ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
console.log("Scene 1 done:", scene1);

// REMEMBER: only these 2-3 fragments (as text) survive into scene 2 — the
// rest of scene 1's prompt and its image are deliberately not passed here.
const passedForward = ["a floral armchair", "a brass table lamp"];

console.log("\nScene 2: midday, inherits only:", passedForward);
console.log("(scene 1's full prompt/image is intentionally not sent)");
const t1 = Date.now();
const scene2 = await generate({
  timeOfDay: "midday",
  rememberedFragments: passedForward,
  // DISTORT: one inherited fragment changes materially, stated as prose,
  // not by handing the model scene 1's pixels.
  distortionNote: "The brass table lamp has changed: it is no longer brass, it is made of ice, and it is quietly melting.",
  seed: 67890,
  ...FAST,
});
console.log(`(took ${((Date.now() - t1) / 1000).toFixed(1)}s)`);
console.log("Scene 2 done:", scene2);

console.log("\nBoth scenes saved. Scene 2's prompt only:");
console.log(scene2.prompt);
