/**
 * The REMEMBER/FORGET/DISTORT/PASS FORWARD boundary, enforced by this
 * function's own signature: it only ever receives the 2-3 fragment strings
 * a scene chose to pass forward, plus time-of-day and a distortion note.
 * It has no parameter through which a full prior image, prompt, or scene
 * history could arrive — the restriction lives in the type, not in a
 * promise to behave.
 *
 * Diagnosis history (from inspecting real submitted prompts each time, not
 * guessing):
 *
 * Round 1: roughly half the time the "impossible detail" fed to the model
 * was an abstract, non-visual sentence (a distortion on the `role` or
 * `meaning` axis — "its role used to be object, now it is person" is not a
 * picture of anything). Fixed by only letting `material` distortions
 * synthesize their own sentence; everything else falls through to a
 * curated library.
 *
 * Round 2: a real submitted prompt for a flagged "ordinary bedroom" scene
 * turned out to be a `scale` distortion — "the ceiling fan's slow turn, but
 * now life-sized instead of room-sized" — where the pool's before/after
 * values were too close together to read as a size contradiction at all
 * (a room-sized object becoming life-sized is barely a change for
 * furniture already roughly that scale). Fixed by removing scale-axis
 * sentence synthesis entirely — scale contradictions now only ever come
 * from the curated library below, where the size relationship is
 * hand-authored to be unmistakable.
 */

const NEGATIVE_PROMPT =
  "normal ordinary photograph with nothing unusual, plain portrait, generic lifestyle photography, stock photography, dark horror, cyberpunk, high-contrast sci-fi, illustration, cartoon, 3d render, cgi, painting, watercolor, anime, text, watermark, logo, blurry, low quality";

const NIGHT_STAGES = new Set(["evening", "night", "late-night", "midnight", "pre-dawn"]);

function lightingClause(timeOfDay) {
  return NIGHT_STAGES.has(timeOfDay)
    ? "Deep shadowed pastel tones lit by a single warm lamp or nightlight, soft contact shadows, tactile handmade materials, quiet deadpan mood, a believable 35mm snapshot, the impossible detail treated as completely ordinary."
    : "Soft pastel colors, gentle daylight or flash, soft contact shadows, tactile handmade materials, quiet deadpan mood, a believable 35mm snapshot, the impossible detail treated as completely ordinary.";
}

/**
 * Every entry names one dominant mechanism and stages it concretely — a
 * subject, a specific action or transformation, the ordinary objects that
 * establish scale or normalcy, and framing that keeps the relationship
 * visible. No entry mixes mechanisms or piles on unrelated decoration.
 * Mechanisms, each represented several times: an ordinary tool used on an
 * impossible subject; an object far larger than the furniture around it;
 * furniture in an impossible location; one material behaving like another;
 * a familiar object performing a different object's function.
 */
const CONCRETE_CONTRADICTIONS = [
  // Mechanism: an ordinary tool used on an impossible subject
  "A woman calmly folds a small cloud into a neat square on an ironing board beside the bed, pressing it flat with her hands the way she would a shirt.",
  "A man wipes down a floating puddle of moonlight on the kitchen counter with a folded dish towel, the light smearing wet under the cloth exactly like water.",
  "A woman waters a small candle flame on the windowsill with a tin watering can, the flame flickering but staying lit, an ordinary row of real houseplants beside it.",
  "A man sweeps a drift of fallen stars off the porch steps with a straw broom into a dustpan, the same unremarkable motion he'd use on autumn leaves.",

  // Mechanism: an object far larger than the furniture around it
  "A room-sized porcelain teacup occupies the bed frame instead of a mattress, its handle reaching the ceiling fan above; a normal-sized nightstand and half-full wine glass beside it clearly establish the scale.",
  "A single wine glass the height of the bedroom door stands beside the nightstand, half full, dwarfing the ordinary lamp and alarm clock next to it.",
  "An ordinary house key lies on the kitchen counter grown to the size of the refrigerator beside it, leaning against the wall, the rest of the kitchen completely untouched and normal.",

  // Mechanism: furniture occupying an impossible location
  "An ordinary carpeted staircase climbs three normal steps, then turns and continues sideways across the ceiling instead of up, a pair of shoes left neatly at the bottom as if nothing about it is strange.",
  "A claw-foot bathtub, still half full of water, hangs flush against the bedroom wall at the same height as the framed photographs beside it, a reading lamp lit on the nightstand below.",
  "A full dining table, chairs and place settings included, stands calmly in the middle of a shallow backyard pond, the water reaching halfway up the table legs.",

  // Mechanism: one material behaving like another
  "The bedspread ripples gently like the surface of shallow water, fully liquid from edge to edge, yet the pillow and nightstand beside it stay completely dry.",
  "A wooden dining chair has gone soft and pillowy like stuffed fabric, visibly dented where someone recently sat, the table and the other ordinary chairs around it unchanged.",
  "A garden hose lies coiled on the front lawn exactly as it was left, a fine stream of white flour pouring steadily from its nozzle instead of water, dusting the grass beneath it.",

  // Mechanism: a familiar object performing a different object's function
  "A row of ordinary wall clocks hangs pinned to a clothesline by wooden clothespins in the backyard, each one still ticking, hung exactly where laundry would normally dry.",
  "The bedroom ceiling fan's three blades are each a single slice of toast, slowly turning, faint crumbs drifting down onto the neatly made bed below.",
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
 *   sentence when present (material distortions only — see
 *   src/generation/dream-run.ts) — never an abstract or weak one rendered
 *   as-is
 * @param {number} [input.sceneIndex] cycles which stock contradiction a
 *   scene without its own distortionNote gets, so consecutive scenes in one
 *   run don't repeat the same subject or mechanism
 */
export function buildPrompt({ timeOfDay, seedText, rememberedFragments, distortionNote, sceneIndex }) {
  // The concrete event leads, is always a complete self-contained scenario
  // with exactly one mechanism, and is followed by framing/setting context
  // and then the shared art direction last — never the other way around.
  const contradiction = distortionNote || pickContradiction(`${seedText ?? "day"}-${sceneIndex ?? 0}`);

  // The fragments this scene actually remembered are folded in as the
  // ordinary surrounding objects, not as the subject — this is where the
  // run's own continuity still shows up in the image without competing
  // with the one legible contradiction.
  const contextClause =
    rememberedFragments && rememberedFragments.length
      ? ` Nearby, among the ordinary objects in the room: ${rememberedFragments.join(", ")}.`
      : "";

  const prompt = `A dreamcore photograph, ${timeOfDay}. ${contradiction}${contextClause} ${lightingClause(timeOfDay)}`;

  return { prompt, negativePrompt: NEGATIVE_PROMPT };
}
