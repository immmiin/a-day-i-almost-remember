import { buildDreamNav } from "./dream-nav";
import { escapeHtml } from "./util";
import { listRuns, deleteRun, exportSpreadPdf, absoluteUrl, type RunSummary } from "./dream-api";
import { renderCoverFace, resolveCoverConfig } from "./zine-cover";
import { PLACEHOLDER_ASSETS } from "./placeholder-assets";

type Filter = "all" | "completed" | "drafts";
type ViewMode = "collection" | "index";

const VISIBLE_RADIUS = 2; // offsets -2..2 around the selected magazine are rendered
const DRAG_THRESHOLD_PX = 40;

export function renderDreamArchive(root: HTMLElement): () => void {
  const section = document.createElement("section");
  section.className = "view dream-archive";
  section.setAttribute("aria-label", "Dream Archive");
  root.appendChild(buildDreamNav("archive"));
  root.appendChild(section);
  section.innerHTML = `<p class="dream-archive__loading">loading your dream archive…</p>`;

  let runs: RunSummary[] = [];
  let backendReachable = true;
  let filter: Filter = "all";
  let viewMode: ViewMode = "collection";
  let selectedId: string | null = null;
  let spreadExporting: string | null = null;

  function filtered(): RunSummary[] {
    if (filter === "completed") return runs.filter((r) => r.completed);
    if (filter === "drafts") return runs.filter((r) => !r.completed);
    return runs;
  }

  function ensureSelection(): void {
    const list = filtered();
    if (!list.some((r) => r.id === selectedId)) {
      selectedId = list[0]?.id ?? null;
    }
  }

  async function load(): Promise<void> {
    try {
      runs = await listRuns();
      backendReachable = true;
    } catch {
      backendReachable = false;
    }
    ensureSelection();
    paint();
  }

  function selectByOffset(delta: number): void {
    const list = filtered();
    if (list.length === 0) return;
    const i = Math.max(0, list.findIndex((r) => r.id === selectedId));
    const next = Math.min(list.length - 1, Math.max(0, i + delta));
    selectedId = list[next]?.id ?? selectedId;
    paint();
  }

  function paint(): void {
    const list = filtered();
    const selectedIndex = Math.max(0, list.findIndex((r) => r.id === selectedId));
    const selected = list[selectedIndex] ?? null;

    section.innerHTML = `
      <header class="dream-archive__header">
        <h1 class="dream-archive__title">Dream Archive</h1>
        <p class="dream-archive__meta">saved on this device only — nothing here is shared or uploaded anywhere</p>
      </header>

      ${
        !backendReachable
          ? `<p class="dream-archive__empty">The local backend isn't reachable right now, so saved runs can't be listed. Start it with <code>npm run server</code>.</p>`
          : ""
      }

      <div class="dream-archive__toolbar">
        <div class="zine-studio__segmented" role="group" aria-label="Browsing mode">
          <button type="button" class="zine-studio__tool zine-studio__tool--small${viewMode === "collection" ? " is-active" : ""}" data-view-mode="collection" aria-pressed="${viewMode === "collection"}">Collection</button>
          <button type="button" class="zine-studio__tool zine-studio__tool--small${viewMode === "index" ? " is-active" : ""}" data-view-mode="index" aria-pressed="${viewMode === "index"}">Index</button>
        </div>
        <div class="zine-studio__segmented" role="group" aria-label="Filter issues">
          <button type="button" class="zine-studio__tool zine-studio__tool--small${filter === "all" ? " is-active" : ""}" data-filter="all" aria-pressed="${filter === "all"}">All</button>
          <button type="button" class="zine-studio__tool zine-studio__tool--small${filter === "completed" ? " is-active" : ""}" data-filter="completed" aria-pressed="${filter === "completed"}">Completed</button>
          <button type="button" class="zine-studio__tool zine-studio__tool--small${filter === "drafts" ? " is-active" : ""}" data-filter="drafts" aria-pressed="${filter === "drafts"}">Drafts</button>
        </div>
      </div>

      ${
        list.length === 0
          ? paintEmptyState()
          : viewMode === "collection"
            ? paintCollection(list, selectedIndex, selected)
            : paintIndex(list)
      }

      <section class="dream-archive__section dream-archive__refs">
        <h2 class="dream-archive__section-title">Reference Materials</h2>
        <p class="dream-archive__meta">mood references only — never generated, never part of an exported issue</p>
        <div class="dream-archive__grid dream-archive__grid--refs">
          ${PLACEHOLDER_ASSETS.map(
            (a) => `
            <figure class="dream-archive__ref">
              <div class="dream-badge">reference / mood only</div>
              <img src="${a.src}" alt="${escapeHtml(a.title)}" loading="lazy" />
              <figcaption>${escapeHtml(a.title)}</figcaption>
            </figure>`,
          ).join("")}
        </div>
      </section>
    `;

    wireEvents(list, selectedIndex);
  }

  function paintEmptyState(): string {
    const label = filter === "completed" ? "completed issues" : filter === "drafts" ? "drafts" : "dreams";
    return `
      <div class="dream-archive__intro">
        <div class="dream-archive__intro-texture" aria-hidden="true"></div>
        <div class="dream-archive__intro-card">
          <h2 class="dream-archive__intro-title">No ${label} yet.</h2>
          <p class="dream-archive__intro-body">Begin a dream, generate a few scenes, and lay them out as a publication — it'll show up here.</p>
          <a class="dream-archive__btn dream-archive__btn--primary" href="#/">Begin a dream →</a>
        </div>
      </div>
    `;
  }

  function statusLabel(r: RunSummary): string {
    return r.completed ? "Completed" : "Draft";
  }

  function infoPanel(r: RunSummary): string {
    const cover = resolveCoverConfig(r.cover);
    const title = cover.title || r.zineTitle || r.seedText || "Untitled dream";
    const intro = r.seedText || "";
    return `
      <div class="dream-archive__info-kicker">
        <span>${r.completed ? `Issue ${r.issueNumber}` : "Draft"}</span>
        <span class="dream-archive__info-status dream-archive__info-status--${r.completed ? "done" : "draft"}">${statusLabel(r)}</span>
      </div>
      <h2 class="dream-archive__info-title">${escapeHtml(title)}</h2>
      ${intro ? `<p class="dream-archive__info-intro">${escapeHtml(intro)}</p>` : ""}
      <div class="dream-archive__info-divider"></div>
      <dl class="dream-archive__info-facts">
        <div><dt>Date</dt><dd>${new Date(r.createdAt).toLocaleDateString()}</dd></div>
        <div><dt>Pages</dt><dd>${r.filledPageCount} of 14 interior pages set · 16-page A5</dd></div>
        <div><dt>Scenes</dt><dd>${r.sceneCount} generated</dd></div>
      </dl>
      <div class="dream-archive__info-divider"></div>
      <div class="dream-archive__info-actions">
        ${
          r.completed
            ? `<a class="dream-archive__btn dream-archive__btn--primary" href="${absoluteUrl("/pdfs/" + r.id + "-spreads.pdf")}" target="_blank" rel="noopener" data-open-reader="${escapeHtml(r.id)}">Read issue</a>
               <a class="dream-archive__btn" href="#/zine?run=${encodeURIComponent(r.id)}">Edit in Zine Studio</a>
               <a class="dream-archive__btn" href="#/machine?resume=${encodeURIComponent(r.id)}">Continue dreaming</a>
               <a class="dream-archive__btn" href="${absoluteUrl("/pdfs/" + r.id + ".pdf")}" download>Download pages</a>
               <button type="button" class="dream-archive__btn" data-download-spreads="${escapeHtml(r.id)}" ${spreadExporting === r.id ? "disabled" : ""}>${spreadExporting === r.id ? "Preparing…" : "Download spreads"}</button>`
            : `<a class="dream-archive__btn dream-archive__btn--primary" href="#/zine?run=${encodeURIComponent(r.id)}">Continue editing</a>
               <a class="dream-archive__btn" href="#/machine?resume=${encodeURIComponent(r.id)}">Continue dreaming</a>
               <button type="button" class="dream-archive__btn dream-archive__btn--danger" data-delete-run="${escapeHtml(r.id)}">Delete</button>`
        }
      </div>
    `;
  }

  function magazineCard(r: RunSummary, offset: number): string {
    const cover = resolveCoverConfig(r.cover);
    return `
      <button type="button" class="dream-archive__mag" data-offset="${offset}" data-mag-id="${escapeHtml(r.id)}" aria-label="${offset === 0 ? `Open ${escapeHtml(r.zineTitle || r.seedText || "issue")}` : `Select ${escapeHtml(r.zineTitle || r.seedText || "issue")}`}">
        <span class="dream-archive__mag-spine" aria-hidden="true"></span>
        ${renderCoverFace({
          imageUrl: r.coverImageUrl ? absoluteUrl(r.coverImageUrl) : null,
          title: cover.title || r.zineTitle || r.seedText || "Untitled issue",
          issueNumber: r.issueNumber,
          date: new Date(r.createdAt).toLocaleDateString(),
          posterLine: cover.posterLine,
          contrast: cover.contrast,
          focalX: cover.focalX,
          focalY: cover.focalY,
          showText: cover.showText,
          size: "lg",
        })}
        ${!r.completed ? `<span class="dream-archive__mag-draft-flag">DRAFT</span>` : ""}
      </button>
    `;
  }

  function paintCollection(list: RunSummary[], selectedIndex: number, selected: RunSummary | null): string {
    const cards: string[] = [];
    for (let offset = -VISIBLE_RADIUS; offset <= VISIBLE_RADIUS; offset++) {
      const i = selectedIndex + offset;
      if (i < 0 || i >= list.length) continue;
      cards.push(magazineCard(list[i], offset));
    }
    const pos = `${String(selectedIndex + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`;
    return `
      <div class="dream-archive__layout">
        <aside class="dream-archive__info">
          ${selected ? infoPanel(selected) : ""}
        </aside>
        <div class="dream-archive__stage-col">
          <div class="dream-archive__stage" id="mag-stage" tabindex="0" role="region" aria-label="Dream Archive magazine collection — arrow keys to browse, enter to open">
            <button type="button" class="dream-archive__nav-btn dream-archive__nav-btn--prev" id="mag-prev" aria-label="Previous issue" ${selectedIndex <= 0 ? "disabled" : ""}>‹</button>
            <div class="dream-archive__track" id="mag-track">
              ${cards.join("")}
            </div>
            <button type="button" class="dream-archive__nav-btn dream-archive__nav-btn--next" id="mag-next" aria-label="Next issue" ${selectedIndex >= list.length - 1 ? "disabled" : ""}>›</button>
          </div>
          <p class="dream-archive__position">${pos}</p>
        </div>
      </div>
    `;
  }

  function paintIndex(list: RunSummary[]): string {
    return `
      <div class="dream-archive__index-grid">
        ${list
          .map((r) => {
            const cover = resolveCoverConfig(r.cover);
            return `
            <article class="dream-archive__index-card">
              <button type="button" class="dream-archive__index-cover" data-select-and-view="${escapeHtml(r.id)}" aria-label="View ${escapeHtml(r.zineTitle || r.seedText || "issue")} in Collection">
                ${renderCoverFace({
                  imageUrl: r.coverImageUrl ? absoluteUrl(r.coverImageUrl) : null,
                  title: cover.title || r.zineTitle || r.seedText || "Untitled issue",
                  issueNumber: r.issueNumber,
                  date: new Date(r.createdAt).toLocaleDateString(),
                  posterLine: cover.posterLine,
                  contrast: cover.contrast,
                  focalX: cover.focalX,
                  focalY: cover.focalY,
                  showText: cover.showText,
                })}
              </button>
              <p class="dream-archive__index-meta">${r.completed ? `Issue ${r.issueNumber}` : "Draft"} · ${new Date(r.createdAt).toLocaleDateString()}</p>
              <div class="dream-archive__index-actions">
                ${
                  r.completed
                    ? `<a class="dream-archive__btn dream-archive__btn--primary" href="${absoluteUrl("/pdfs/" + r.id + "-spreads.pdf")}" target="_blank" rel="noopener">Read issue</a>
                       <a class="dream-archive__btn" href="#/zine?run=${encodeURIComponent(r.id)}">Edit in Zine Studio</a>`
                    : `<a class="dream-archive__btn dream-archive__btn--primary" href="#/zine?run=${encodeURIComponent(r.id)}">Continue editing</a>
                       <a class="dream-archive__btn" href="#/machine?resume=${encodeURIComponent(r.id)}">Continue dreaming</a>`
                }
              </div>
            </article>`;
          })
          .join("")}
      </div>
    `;
  }

  function wireEvents(list: RunSummary[], selectedIndex: number): void {
    section.querySelectorAll<HTMLButtonElement>("[data-view-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        viewMode = btn.dataset.viewMode as ViewMode;
        paint();
      });
    });

    section.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filter = btn.dataset.filter as Filter;
        ensureSelection();
        paint();
      });
    });

    section.querySelector<HTMLButtonElement>("#mag-prev")?.addEventListener("click", () => selectByOffset(-1));
    section.querySelector<HTMLButtonElement>("#mag-next")?.addEventListener("click", () => selectByOffset(1));

    const stage = section.querySelector<HTMLElement>("#mag-stage");
    stage?.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        selectByOffset(-1);
        // paint() just replaced this whole element — every render fully
        // re-renders the DOM, which drops focus, so without this a second
        // arrow-key press in a row would land on nothing.
        section.querySelector<HTMLElement>("#mag-stage")?.focus();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        selectByOffset(1);
        section.querySelector<HTMLElement>("#mag-stage")?.focus();
      } else if (e.key === "Enter" || e.key === " ") {
        const current = list[selectedIndex];
        if (current?.completed) {
          e.preventDefault();
          window.open(absoluteUrl(`/pdfs/${current.id}-spreads.pdf`), "_blank", "noopener");
        }
      }
    });

    // Click vs. drag: a pointerdown/up pair that moved less than the
    // threshold is a click (select a neighbor, or open the centered one);
    // past the threshold it's a swipe and never opens anything, so a drag
    // can't accidentally trigger the reader.
    let dragStartX: number | null = null;
    let dragMoved = false;
    const track = section.querySelector<HTMLElement>("#mag-track");
    track?.addEventListener("pointerdown", (e) => {
      dragStartX = e.clientX;
      dragMoved = false;
    });
    track?.addEventListener("pointermove", (e) => {
      if (dragStartX === null) return;
      if (Math.abs(e.clientX - dragStartX) > 8) dragMoved = true;
    });
    track?.addEventListener("pointerup", (e) => {
      if (dragStartX === null) return;
      const dx = e.clientX - dragStartX;
      dragStartX = null;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) {
        dragMoved = true;
        selectByOffset(dx < 0 ? 1 : -1);
      }
    });

    section.querySelectorAll<HTMLButtonElement>(".dream-archive__mag").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (dragMoved) {
          dragMoved = false;
          return;
        }
        const offset = Number(btn.dataset.offset);
        const id = btn.dataset.magId;
        if (offset === 0 && id) {
          const r = list.find((x) => x.id === id);
          if (r?.completed) {
            window.open(absoluteUrl(`/pdfs/${id}-spreads.pdf`), "_blank", "noopener");
          }
          // Drafts have no reader yet — the centered card's own info panel
          // already offers "Continue editing" / "Continue dreaming".
        } else if (id) {
          selectedId = id;
          paint();
        }
      });
    });

    section.querySelectorAll<HTMLButtonElement>("[data-select-and-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedId = btn.dataset.selectAndView ?? null;
        viewMode = "collection";
        paint();
      });
    });

    section.querySelectorAll<HTMLButtonElement>("[data-download-spreads]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.downloadSpreads!;
        spreadExporting = id;
        paint();
        try {
          const result = await exportSpreadPdf(id);
          window.open(absoluteUrl(result.pdfUrl), "_blank", "noopener");
        } finally {
          spreadExporting = null;
          paint();
        }
      });
    });

    section.querySelectorAll<HTMLButtonElement>("[data-delete-run]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.deleteRun!;
        if (confirm("Delete this draft permanently? This cannot be undone.")) {
          await deleteRun(id);
          await load();
        }
      });
    });
  }

  load();
  return () => {};
}
