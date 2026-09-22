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
