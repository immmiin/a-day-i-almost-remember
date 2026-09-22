/**
 * The REMEMBER/FORGET/DISTORT/PASS FORWARD boundary, enforced by this
 * function's own signature: it only ever receives the 2-3 fragment strings
 * a scene chose to pass forward, plus time-of-day and a distortion note.
 * It has no parameter through which a full prior image, prompt, or scene
 * history could arrive — the restriction lives in the type, not in a
 * promise to behave.
 *
 * Separately: every prompt is built to guarantee the dreamcore register
 * (ordinary setting + one impossible transformation + tactile pastel
 * materials + deadpan photographic staging) rather than hoping the model
 * gets there — required clauses are asserted, not merely suggested, and
 * validated against the finished string before it's sent.
 */

const ART_DIRECTION =
  "photographic surrealism, dreamcore: an ordinary familiar setting containing " +
  "one large, unmistakably impossible transformation, staged with handmade " +
  "tactile pastel materials — cotton, vinyl, lace, wallpaper, floral fabric, " +
  "painted wood, glass, soft foam — like a theatrical installation, photographed " +
  "quietly and deadpan as a believable 35mm or medium-format snapshot. Faded " +
  "pastel palette: powder blue, dusty pink, pale lilac, mint green, butter " +
  "yellow, cloudy white, muted grass green. Gentle flash or hazy daylight, " +
  "washed highlights, soft shadows, subtle film grain, slight chromatic " +
  "aberration, nostalgic low-resolution snapshot quality. The impossible event " +
  "is treated as unremarkable, everyday reality — awkward, quiet, deadpan.";

const NEGATIVE_PROMPT =
  "normal ordinary photograph, plain portrait, generic lifestyle photography, " +
  "stock photography, polished commercial fashion photography, ordinary " +
  "cinematic scenery, dark horror, cyberpunk, high-contrast sci-fi, " +
  "illustration, cartoon, 3d render, cgi, painting, watercolor, anime, text, " +
  "watermark, logo, blurry, low quality";

// A scene's own distortion note already names its one impossible change; a
// fresh scene (typically scene 0, nothing inherited yet) has none, so it
// needs one injected here instead — chosen deterministically from the seed
// text so the same seed always proposes the same anomaly.
const FALLBACK_ANOMALIES = [
  "the ceiling has quietly become a shallow indoor sky, with small cotton clouds drifting between the light fixtures",
  "a house-sized creature of woven pastel yarn is calmly sitting where the furniture should be",
  "the room is filling, ankle-deep, with pale blue water that no one reacts to",
  "an ordinary object nearby has become vastly oversized, handmade from soft foam and felt",
  "a wall has been quietly replaced by a floral meadow, indoors, at true scale",
  "a flock of small paper birds is circling the room in a slow, unbroken loop",
  "the light fixtures have become clusters of oversized cloudy-white balloons that glow faintly",
  "an everyday object on the table is alive, breathing gently, and no one finds it strange",
];

function pickAnomaly(seedText) {
  let hash = 0;
  for (const ch of seedText) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_ANOMALIES[hash % FALLBACK_ANOMALIES.length];
}

const REQUIRED_CONCEPTS = ["photographic surrealism", "dreamcore", "impossible"];

function assertRequiredConcepts(prompt) {
  const lower = prompt.toLowerCase();
  const missing = REQUIRED_CONCEPTS.filter((c) => !lower.includes(c));
  if (missing.length === 0) return prompt;
  // Shouldn't happen since ART_DIRECTION always carries all three — this is
  // a safety net if that constant is ever edited to drop one, not a normal
  // code path. Re-append whatever's missing rather than silently shipping
  // a prompt that lost the guarantee.
  return `${prompt} ${missing.join(", ")}.`;
}

export function buildPrompt({ timeOfDay, seedText, rememberedFragments, distortionNote }) {
  const sceneNoun = rememberedFragments.length
    ? rememberedFragments.join(", ")
    : seedText || "an ordinary morning at home";

  // Every scene gets one concrete impossible detail — the fragment engine's
  // own distortion only fires probabilistically (and never on the opening
  // scene, which has nothing to distort yet), so a scene it skipped this
  // round still needs an anomaly injected here rather than falling back to
  // a vague, non-visual placeholder that would just render as an ordinary
  // photo with nothing impossible in it.
  const anomaly = distortionNote || pickAnomaly(seedText ?? sceneNoun);

  // Concrete subject + anomaly lead the prompt; style/palette direction
  // follows. FLUX's text encoders weight earlier tokens more heavily on
  // long prompts — a stylistic paragraph placed first was observed (in
  // testing) to pull results toward generic pastel portraiture and lose
  // the actual scene content, so the specific, concrete clause goes first
  // and the shared register comes after it, not instead of it.
  const subjectClause =
    `A dreamcore photograph, ${timeOfDay}: ${sceneNoun}. ` +
    `One unmistakable impossible detail: ${anomaly}. ` +
    `The person in the scene treats it as completely ordinary, no surprise or alarm.`;

  const prompt = assertRequiredConcepts(`${subjectClause} ${ART_DIRECTION}`);

  return { prompt, negativePrompt: NEGATIVE_PROMPT };
}
