export function escapeHtml(input: string): string {
  const div = document.createElement("div");
  div.textContent = input;
  return div.innerHTML;
}

/**
 * The shared art-direction preamble has no period of its own, so a prompt's
 * first "sentence" is that whole preamble plus the time-of-day clause —
 * the second sentence ("The scene includes: ...") is the actual scene
 * description and makes a far better short caption.
 */
export function shortCaption(prompt: string): string {
  const parts = prompt.split(".");
  return parts[1]?.trim() || parts[0]?.trim() || prompt;
}

// Phrases that only ever appear inside an internal generation prompt, never
// in something a person would write as a caption. Mirrored exactly in
// server/pdf-export.mjs so the editor preview and the exported PDF agree on
// which captions are real and which are leftover internal text.
const GENERATION_TEXT_MARKERS = [
  "one unmistakable impossible detail",
  "a dreamcore photograph",
  "nearby, among the ordinary objects",
  "soft pastel colors, tactile",
  "deep shadowed pastel tones",
  "the impossible detail treated as completely ordinary",
];

function looksLikeGenerationText(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return GENERATION_TEXT_MARKERS.some((m) => lower.includes(m));
}

/**
 * The publication caption for a page: a caption a person actually typed
 * always wins, unless it's detectably internal generation text that
 * reached the field from an earlier version of this app rather than being
 * hand-written. Otherwise falls back to a short derived line from the
 * prompt, itself rejected if it still reads as generation text. A blank
 * result is expected and fine — this never invents a caption.
 */
export function publicationCaption(storedCaption: string | undefined, prompt: string): string {
  const stored = (storedCaption ?? "").trim();
  if (stored && !looksLikeGenerationText(stored)) return stored;
  const derived = shortCaption(prompt);
  return looksLikeGenerationText(derived) ? "" : derived;
}
