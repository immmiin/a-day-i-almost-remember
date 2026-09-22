import { buildDreamNav } from "./dream-nav";

/** Stage 2 stand-in. The real Dream Archive (issue covers + reader) is built
 * once generation and the zine editor exist; this just keeps the nav honest. */
export function renderDreamArchivePlaceholder(root: HTMLElement): () => void {
  const section = document.createElement("section");
  section.className = "view zine-studio";
  section.setAttribute("aria-label", "Dream Archive");
  root.appendChild(buildDreamNav("archive"));
  root.appendChild(section);

  section.innerHTML = `
    <header class="zine-studio__header">
      <div>
        <h1 class="zine-studio__title">Dream Archive</h1>
        <p class="zine-studio__meta" style="margin-top:.35rem;">Completed issue covers land here once the Zine Studio can export one.</p>
      </div>
    </header>
    <p style="max-width:46ch;font-size:.95rem;line-height:1.6;color:var(--dream-ink-soft);">
      Not built yet in this prototype pass. The finished version shows completed zine issues by
      their actual covers, opens into a page-turning reader with zoom and PDF download, and keeps
      unfinished runs — including the earlier text-only generator — in a separate Drafts area.
    </p>
  `;

  return () => {};
}
