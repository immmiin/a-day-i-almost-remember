/**
 * The REMEMBER/FORGET/DISTORT/PASS FORWARD boundary, enforced by this
 * function's own signature: it only ever receives the 2-3 fragment strings
 * a scene chose to pass forward, plus time-of-day and a distortion note.
 * It has no parameter through which a full prior image, prompt, or scene
 * history could arrive — the restriction lives in the type, not in a
 * promise to behave.
 *
 * Diagnosis (from inspecting real submitted prompts, not guessing): the
 * "ordinary building facade" failures traced back to two things, neither of
 * which was a missing adjective —
 *
 * 1. Roughly half the time the "impossible detail" fed to the model was an
 *    abstract, non-visual sentence (a distortion on the `role` or `meaning`
 *    axis, e.g. "its role used to be object, now it is person" — not a
 *    picture of anything). Fixed upstream in src/generation/dream-run.ts:
 *    those two axes no longer produce a distortionNote at all.
 * 2. The previous ~150-word style paragraph, even placed after the subject,
 *    still diluted a short concrete instruction across many more style
 *    tokens than content tokens. The style suffix below is deliberately
 *    short (~30 words) so the concrete contradiction — which is now always
 *    a full, self-contained, camera-ready scenario — carries the prompt.
 */

const STYLE_SUFFIX =
  "Soft pastel colors, tactile handmade materials like cotton, vinyl, lace and painted wood, gentle flash lighting, subtle film grain, a believable 35mm snapshot, quiet deadpan mood, the impossible detail treated as completely ordinary.";

const NEGATIVE_PROMPT =
  "normal ordinary photograph with nothing unusual, plain portrait, generic lifestyle photography, stock photography, dark horror, cyberpunk, high-contrast sci-fi, illustration, cartoon, 3d render, cgi, painting, watercolor, anime, text, watermark, logo, blurry, low quality";

/**
 * Each entry is a complete, self-contained visual scenario, not a mood
 * word: a named ordinary object, one concrete change to its scale,
 * material, function, gravity, or location, the everyday objects around it
 * that make the change legible, and an explicit framing clause so the
 * relationship between the ordinary and the impossible is actually visible
 * in the shot. Deliberately varied subjects — kitchen, bath, stairs,
 * dining, laundry, porch, garden, living room — so a run doesn't keep
 * landing on the same window/room/cloud by default.
 */
const CONCRETE_CONTRADICTIONS = [
  "A giant porcelain teacup protrudes through a normal-sized kitchen window, its handle taller than the door beside it, the whole cup, window, and door visible in one wide photograph.",
  "A claw-foot bathtub, still half full of water, hangs flush against the living room wall at the same height as the family photographs beside it, a reading lamp lit on the side table below.",
  "An ordinary carpeted staircase climbs three normal steps, then turns and continues sideways across the ceiling instead of up, a pair of shoes left neatly at the bottom as if nothing about it is strange.",
  "A wooden dining table stands on three ordinary legs and one tall lit candle instead of a fourth, wax pooling steadily onto the rug below while the table setting on top stays perfectly level.",
  "An ordinary kitchen refrigerator stands closed on the outside, but its open door reveals a narrow garden path lined with flowerpots instead of shelves, the kitchen tile floor visible on both sides of the doorway.",
  "A bicycle leans against the porch wall exactly where it's always kept, its two wheels replaced by full dinner plates complete with a fork and knife still resting on the rims.",
  "A clothesline strung across the backyard holds a row of ordinary wall clocks pinned up by their cords instead of laundry, each one still ticking, the wooden clothespins clearly visible.",
  "A bathroom mirror above the sink reflects a completely different, more cluttered room than the tidy one it's mounted in, the sink faucet and toothbrush cup identical in both, the mismatch plainly visible in the frame.",
  "A garden hose lies coiled on the front lawn exactly as it was left, a fine stream of white flour pouring steadily from its nozzle instead of water, dusting the grass beneath it.",
  "An upholstered armchair sits in the living room with its legs sunk a few inches into the hardwood floor as though the wood had briefly gone soft beneath it, the surrounding floorboards otherwise flat and undisturbed.",
];

function pickContradiction(key) {
  let hash = 0;
  for (const ch of String(key)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CONCRETE_CONTRADICTIONS[hash % CONCRETE_CONTRADICTIONS.length];
}

/**
 * @param {object} input
 * @param {string} input.timeOfDay
 * @param {string} [input.seedText] only meaningful for the opening scene
 * @param {string[]} input.rememberedFragments
 * @param {string} [input.distortionNote] already a concrete, camera-ready
 *   sentence when present (material/scale distortions only — see
 *   src/generation/dream-run.ts) — never an abstract one to render as-is
 * @param {number} [input.sceneIndex] cycles which stock contradiction a
 *   scene without its own distortionNote gets, so consecutive scenes in one
 *   run don't repeat the same subject
 */
export function buildPrompt({ timeOfDay, seedText, rememberedFragments, distortionNote, sceneIndex }) {
  // The concrete visual event always leads and is always a complete,
  // self-contained scenario — never a short "anomaly" tacked onto a
  // separately-described ordinary scene, which is what let the model
  // ignore it and fall back to rendering only the ordinary part.
  const contradiction = distortionNote || pickContradiction(`${seedText ?? "day"}-${sceneIndex ?? 0}`);

  // The fragments this scene actually remembered are folded in as the
  // ordinary surrounding objects, not as the subject — this is where the
  // run's own continuity still shows up in the image without competing
  // with the one clearly readable contradiction.
  const contextClause =
    rememberedFragments && rememberedFragments.length
      ? ` Nearby, among the ordinary objects in the room: ${rememberedFragments.join(", ")}.`
      : "";

  const prompt = `A dreamcore photograph, ${timeOfDay}. ${contradiction}${contextClause} ${STYLE_SUFFIX}`;

  return { prompt, negativePrompt: NEGATIVE_PROMPT };
}
