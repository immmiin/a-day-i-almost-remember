/**
 * The REMEMBER/FORGET/DISTORT/PASS FORWARD boundary, enforced by this
 * function's own signature: it only ever receives the 2-3 fragment strings
 * a scene chose to pass forward, plus time-of-day and the shared art
 * direction. It has no parameter through which a full prior image, prompt,
 * or scene history could arrive — the restriction lives in the type, not
 * in a promise to behave.
 */

const ART_DIRECTION =
  "photographed dream: believable photographic texture, lighting and shadow, " +
  "vintage domestic interior, floral upholstery, tactile fabrics, softly faded " +
  "pastels, an ordinary action performed on an impossible subject, treated as " +
  "everyday reality, 35mm film photograph, not illustration, not 3d render";

const NEGATIVE_PROMPT =
  "blurry, low quality, cartoon, illustration, 3d render, cgi, painting, " +
  "watercolor, anime, text, watermark, glossy plastic, neon gradient";

export function buildPrompt({ timeOfDay, rememberedFragments, distortionNote }) {
  const fragments = rememberedFragments.length
    ? `The scene includes: ${rememberedFragments.join("; ")}.`
    : "An ordinary, unremarkable domestic scene to begin the day.";
  const distortion = distortionNote ? ` ${distortionNote}` : "";
  const prompt = [
    ART_DIRECTION,
    `Time of day: ${timeOfDay}.`,
    fragments,
    distortion,
    "The person in the scene accepts everything as ordinary, no surprise or alarm.",
  ]
    .filter(Boolean)
    .join(" ");
  return { prompt, negativePrompt: NEGATIVE_PROMPT };
}
