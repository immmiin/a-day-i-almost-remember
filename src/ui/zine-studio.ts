import { buildDreamNav } from "./dream-nav";
import { escapeHtml, shortCaption } from "./util";
import { getRun, saveZinePages, exportPdf, absoluteUrl, type RunDetail, type ZinePageEntry, type SavedScene } from "./dream-api";
import { renderCoverFace, resolveCoverConfig, type CoverConfig } from "./zine-cover";

const CONTENT_SLOTS = 14; // pages 2-15; page 1 and 16 are auto covers

export function renderZineStudio(root: HTMLElement): () => void {
  const query = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const runId = query.get("run");

  const section = document.createElement("section");
  section.className = "view zine-studio";
  section.setAttribute("aria-label", "Zine Studio");
  root.appendChild(buildDreamNav("zine"));
  root.appendChild(section);
  section.innerHTML = `<p class="zine-studio__loading">loading…</p>`;

  let run: RunDetail | null = null;
  let title = "A Day I Almost Remember";
  let pages: ZinePageEntry[] = [];
  let cover: CoverConfig = resolveCoverConfig(null);
  let focusIndex = 0;
  let dragFrom: number | null = null;
  let exportResult: { pdfUrl: string; lowResWarnings: string[] } | null = null;
  let exporting = false;
  let saveNote = "";
  // 1 = the page preview exactly fills its frame (the "Fit entire page by
  // default" requirement) — zoom is a separate, purely visual magnifier on
  // top of that, never the default state.
  let zoom = 1;

  function paintIntroState(kind: "no-run" | "not-found" | "no-scenes"): void {
    section.innerHTML = `
      <div class="zine-studio__intro">
        <div class="zine-studio__intro-texture" aria-hidden="true"></div>
        <div class="zine-studio__intro-card">
          ${
            kind === "no-scenes"
              ? `
            <h1 class="zine-studio__intro-title">This issue has no scenes yet.</h1>
            <p class="zine-studio__intro-body">Generate its first scene in the Dream Machine, then come back to lay it out here.</p>
            <div class="zine-studio__intro-actions">
              <a class="dream-archive__btn dream-archive__btn--primary" href="#/machine?resume=${encodeURIComponent(runId ?? "")}">Generate the first scene</a>
              <a class="dream-archive__btn" href="#/archive">Back to Dream Archive</a>
            </div>`
              : `
            <h1 class="zine-studio__intro-title">Your zine is waiting for a dream.</h1>
            <p class="zine-studio__intro-body">
              ${kind === "not-found" ? "That run couldn't be found — it may have been deleted. " : ""}
              Open a saved draft or completed issue to continue editing, or start something new.
            </p>
            <div class="zine-studio__intro-actions">
              <a class="dream-archive__btn dream-archive__btn--primary" href="#/archive">Open Dream Archive</a>
              <a class="dream-archive__btn" href="#/">Begin a new dream</a>
            </div>`
          }
        </div>
      </div>
    `;
  }

  async function init(): Promise<void> {
    if (!runId) {
      paintIntroState("no-run");
      return;
    }
    run = await getRun(runId);
    if (!run) {
      paintIntroState("not-found");
      return;
    }
    if (run.scenes.length === 0) {
      paintIntroState("no-scenes");
      return;
    }
    title = run.zine?.title || run.seedText || "A Day I Almost Remember";
    pages = run.zine?.pages ?? run.scenes.slice(0, CONTENT_SLOTS).map((s) => ({ sceneIndex: s.index, layout: "full" as const }));
    cover = resolveCoverConfig(run.zine?.cover);
    if (cover.sceneIndex == null) {
      cover = { ...cover, sceneIndex: pages[0]?.sceneIndex ?? run.scenes[0]?.index ?? null };
    }
    render();
  }

  function sceneFor(sceneIndex: number) {
    return run!.scenes.find((s) => s.index === sceneIndex) ?? null;
  }

  // Mirrors server/pdf-export.mjs's actual drawing math (margins as a % of
  // the A5 page, the caption band's 74pt height, text-led's capped image
  // box) so the editor preview and the exported PDF genuinely agree on
  // crop, text placement, and margins rather than approximating it twice.
  function renderPagePreview(focused: ZinePageEntry, focusedScene: SavedScene): string {
    const mode = focused.imageMode === "fit" ? "fit" : "fill";
    const fx = focused.focalX ?? 50;
    const fy = focused.focalY ?? 50;
    const isTextLed = focused.layout === "text-led";
    const isImageOnly = focused.layout === "full";
    const captionText = focused.caption ?? shortCaption(focusedScene.prompt);
    const imgUrl = absoluteUrl(focusedScene.imageUrl);

    const pageInner = isTextLed
      ? `
        <div class="zine-studio__page-textled-cap">${escapeHtml(captionText)}</div>
        <div class="zine-studio__page-textled-imgwrap"><img src="${imgUrl}" alt="" /></div>`
      : `
        <img class="zine-studio__page-img" src="${imgUrl}" alt=""
          style="object-fit:${mode === "fit" ? "contain" : "cover"};object-position:${fx}% ${fy}%;" />
        ${focused.layout === "image-caption" ? `<div class="zine-studio__page-caption-band"><p>${escapeHtml(captionText)}</p></div>` : ""}`;

    return `
      <div class="zine-studio__preview-toolbar">
        ${
          isTextLed
            ? `<span class="zine-studio__hint" style="padding:0;">Text-led always fits the image without cropping.</span>`
            : `<div class="zine-studio__segmented" role="group" aria-label="Image fit mode">
                <button type="button" class="zine-studio__tool zine-studio__tool--small${mode === "fill" ? " is-active" : ""}" data-image-mode="fill" aria-pressed="${mode === "fill"}">Fill / Crop</button>
                <button type="button" class="zine-studio__tool zine-studio__tool--small${mode === "fit" ? " is-active" : ""}" data-image-mode="fit" aria-pressed="${mode === "fit"}">Fit</button>
              </div>`
        }
        <div class="zine-studio__zoom" role="group" aria-label="Preview zoom">
          <button type="button" id="zoom-out" aria-label="Zoom out">−</button>
          <span class="zine-studio__zoom-value">${Math.round(zoom * 100)}%</span>
          <button type="button" id="zoom-in" aria-label="Zoom in">+</button>
          <button type="button" id="zoom-reset" class="zine-studio__tool zine-studio__tool--small">Fit</button>
        </div>
      </div>
      <div class="zine-studio__preview-frame">
        <div class="zine-studio__preview-page" style="transform:scale(${zoom});">
          ${pageInner}
        </div>
      </div>
      ${
        !isTextLed && mode === "fill"
          ? `<div class="zine-studio__crop-controls">
              <label>crop — horizontal <input type="range" id="page-focal-x" min="0" max="100" value="${fx}" /></label>
              <label>crop — vertical <input type="range" id="page-focal-y" min="0" max="100" value="${fy}" /></label>
            </div>`
          : ""
      }
      <label class="zine-studio__caption-edit">
        caption for page ${focusIndex + 2}
        ${isImageOnly ? `<span class="zine-studio__caption-hidden-note">saved, but hidden on the page — it's set to Image only</span>` : ""}
        <textarea id="caption-edit" rows="2">${escapeHtml(captionText ?? "")}</textarea>
      </label>
    `;
  }

  function render(): void {
    if (!run) return;
    const focused = pages[focusIndex];
    const focusedScene = focused ? sceneFor(focused.sceneIndex) : null;
    const coverScene = cover.sceneIndex != null ? sceneFor(cover.sceneIndex) : null;
    const lowResCount = run.scenes.filter((s) => s.settings && (s.settings.width < 1748 || s.settings.height < 2480)).length;

    section.innerHTML = `
      <header class="zine-studio__header">
        <div>
          <h1 class="zine-studio__title">Zine Studio</h1>
          <input class="zine-studio__issue-name" id="issue-title" value="${escapeHtml(title)}" aria-label="Issue title" />
        </div>
        <p class="zine-studio__meta">A5 · 16 pages · reading-order PDF on export</p>
      </header>

      <section class="zine-studio__pool">
        <h2 class="zine-studio__pool-title">Generated scenes — click to add a page</h2>
        <div class="zine-studio__pool-strip">
          ${run.scenes
            .map(
              (s) => `
            <button type="button" class="zine-studio__pool-item" data-add-scene="${s.index}" title="Scene ${s.index + 1} · ${escapeHtml(s.timeOfDay)}">
              <img src="${absoluteUrl(s.imageUrl)}" alt="" />
            </button>`,
            )
            .join("") || `<p class="zine-studio__empty">No scenes generated yet for this run.</p>`}
        </div>
      </section>

      <section class="zine-studio__cover-editor">
        <h2 class="zine-studio__pool-title">Cover — page 1 and 16 of the printed issue</h2>
        <div class="zine-studio__cover-layout">
          <div class="zine-studio__cover-preview">
            ${renderCoverFace({
              imageUrl: coverScene ? absoluteUrl(coverScene.imageUrl) : null,
              title: cover.title || title,
              issueNumber: run.issueNumber,
              date: new Date(run.createdAt).toLocaleDateString(),
              posterLine: cover.posterLine,
              contrast: cover.contrast,
              focalX: cover.focalX,
              focalY: cover.focalY,
              showText: cover.showText,
              size: "lg",
            })}
          </div>
          <div class="zine-studio__cover-controls">
            <div class="zine-studio__field-group">
              <span class="zine-studio__field-group-label">image</span>
              <div class="zine-studio__cover-picker" role="group" aria-label="Choose the cover image">
                ${
                  run.scenes
                    .map(
                      (s) => `
                  <button type="button" class="zine-studio__cover-pick${cover.sceneIndex === s.index ? " is-selected" : ""}" data-cover-scene="${s.index}" aria-pressed="${cover.sceneIndex === s.index}" aria-label="Use scene ${s.index + 1} as the cover image">
                    <img src="${absoluteUrl(s.imageUrl)}" alt="" />
                  </button>`,
                    )
                    .join("") || `<p class="zine-studio__empty">Generate a scene to choose a cover image.</p>`
                }
              </div>
              <div class="zine-studio__cover-sliders">
                <label>reposition — horizontal
                  <input type="range" id="cover-focal-x" min="0" max="100" value="${cover.focalX}" />
                </label>
                <label>reposition — vertical
                  <input type="range" id="cover-focal-y" min="0" max="100" value="${cover.focalY}" />
                </label>
              </div>
            </div>

            <div class="zine-studio__field-group">
              <span class="zine-studio__field-group-label">text</span>
              <label class="zine-studio__cover-field">
                cover title <span>(optional — falls back to the issue title above)</span>
                <input type="text" id="cover-title" maxlength="60" value="${escapeHtml(cover.title)}" placeholder="${escapeHtml(title)}" />
              </label>
              <label class="zine-studio__cover-field">
                poster line <span>(optional)</span>
                <input type="text" id="cover-poster-line" maxlength="80" value="${escapeHtml(cover.posterLine)}" placeholder="a fragment of the dream, printed small" />
              </label>
              <div class="zine-studio__cover-contrast" role="group" aria-label="Cover text contrast">
                <button type="button" class="zine-studio__tool${cover.contrast === "ink" ? " is-active" : ""}" data-cover-contrast="ink" aria-pressed="${cover.contrast === "ink"}">Dark overlay</button>
                <button type="button" class="zine-studio__tool${cover.contrast === "paper" ? " is-active" : ""}" data-cover-contrast="paper" aria-pressed="${cover.contrast === "paper"}">Light overlay</button>
              </div>
            </div>

            <div class="zine-studio__field-group">
              <span class="zine-studio__field-group-label">visibility</span>
              <label class="zine-studio__checkbox">
                <input type="checkbox" id="cover-show-text" ${cover.showText ? "checked" : ""} />
                Show title text on front cover
              </label>
              <label class="zine-studio__checkbox">
                <input type="checkbox" id="cover-back-show-text" ${cover.backShowText ? "checked" : ""} />
                Show text on back cover
              </label>
            </div>
          </div>
        </div>
      </section>

      <section class="zine-studio__editor">
        <div class="zine-studio__pages-col">
          <div class="zine-studio__pages-header">
            <span class="zine-studio__pool-title" style="margin:0;">Interior pages</span>
            <button type="button" class="zine-studio__tool zine-studio__tool--small" id="all-image-only" ${pages.length === 0 ? "disabled" : ""}>Set all interior pages to Image only</button>
          </div>
          <div class="zine-studio__pages-list" id="pages-list" aria-label="Zine pages, drag to reorder">
            <div class="zine-studio__page-row zine-studio__page-row--cover">1 · front cover (auto)</div>
            ${pages
              .map((p, i) => {
                const s = sceneFor(p.sceneIndex);
                return `
                <div class="zine-studio__page-row${i === focusIndex ? " is-focused" : ""}" draggable="true" data-page-index="${i}" data-focus="${i}">
                  <span class="zine-studio__page-num">${i + 2}</span>
                  ${s ? `<img src="${absoluteUrl(s.imageUrl)}" alt="" />` : ""}
                  <span class="zine-studio__page-scene">scene ${p.sceneIndex + 1}</span>
                  <select class="zine-studio__page-layout" data-layout-index="${i}">
                    <option value="full" ${p.layout === "full" ? "selected" : ""}>image only</option>
                    <option value="image-caption" ${p.layout === "image-caption" ? "selected" : ""}>image + caption</option>
                    <option value="text-led" ${p.layout === "text-led" ? "selected" : ""}>text-led</option>
                  </select>
                  <button type="button" class="zine-studio__page-remove" data-remove-index="${i}" aria-label="Remove page ${i + 2}">×</button>
                </div>`;
              })
              .join("")}
            ${pages.length >= CONTENT_SLOTS ? "" : `<p class="zine-studio__hint">${CONTENT_SLOTS - pages.length} page${CONTENT_SLOTS - pages.length === 1 ? "" : "s"} free — add scenes above.</p>`}
            <div class="zine-studio__page-row zine-studio__page-row--cover">16 · back cover (auto)</div>
          </div>
        </div>

        <div class="zine-studio__preview">
          ${
            focused && focusedScene
              ? renderPagePreview(focused, focusedScene)
              : `<div class="zine-studio__preview-placeholder">
                   <div class="zine-studio__preview-placeholder-mark" aria-hidden="true"></div>
                   <p>Select a page on the left — or add a generated scene above — to preview and caption it here.</p>
                 </div>`
          }
        </div>
      </section>

      <footer class="zine-studio__footer">
        <div>
          <span>${saveNote || "draft saved on this device"}</span>
          ${lowResCount ? `<p class="zine-studio__warning">${lowResCount} scene${lowResCount === 1 ? "" : "s"} below 300dpi print resolution at A5 — they'll still export, flagged in the result.</p>` : ""}
        </div>
        <div class="zine-studio__footer-actions">
          <a class="zine-studio__tool" href="#/machine?resume=${encodeURIComponent(run.id)}">Generate another scene →</a>
          <button type="button" class="zine-studio__tool" id="save-draft">Save draft</button>
          <button type="button" class="zine-studio__export" id="export-pdf" ${pages.length === 0 || exporting ? "disabled" : ""}>
            ${exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </footer>
      ${
        exportResult
          ? `<div class="zine-studio__result">
               <a href="${absoluteUrl(exportResult.pdfUrl)}" target="_blank" rel="noopener">Open exported PDF →</a>
               ${exportResult.lowResWarnings.length ? `<ul class="zine-studio__warning-list">${exportResult.lowResWarnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>` : ""}
             </div>`
          : ""
      }
      <p class="zine-studio__print-note">
        Print note: four A4 sheets, printed double-sided and folded, produce this 16-page A5 booklet.
        This export is reading order, not printer imposition — most copy-shop "booklet" print settings
        reorder pages for folding automatically from a reading-order PDF like this one. Leave standard
        printer margins; this layout isn't bled to the trim edge, so no separate trimming is needed for
        a basic home/copy-shop print.
      </p>
    `;

    wireEvents();
  }

  function wireEvents(): void {
    section.querySelector<HTMLInputElement>("#issue-title")!.addEventListener("change", (e) => {
      title = (e.target as HTMLInputElement).value;
    });

    section.querySelectorAll<HTMLButtonElement>("[data-add-scene]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (pages.length >= CONTENT_SLOTS) return;
        const sceneIndex = Number(btn.dataset.addScene);
        pages.push({ sceneIndex, layout: "full" });
        focusIndex = pages.length - 1;
        zoom = 1;
        render();
      });
    });

    section.querySelector<HTMLButtonElement>("#all-image-only")?.addEventListener("click", () => {
      pages = pages.map((p) => ({ ...p, layout: "full" }));
      render();
    });

    section.querySelectorAll<HTMLSelectElement>("[data-layout-index]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const i = Number(sel.dataset.layoutIndex);
        pages[i] = { ...pages[i], layout: sel.value as ZinePageEntry["layout"] };
        render();
      });
    });

    section.querySelectorAll<HTMLButtonElement>("[data-remove-index]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.removeIndex);
        pages.splice(i, 1);
        focusIndex = Math.min(focusIndex, pages.length - 1);
        render();
      });
    });

    section.querySelectorAll<HTMLElement>("[data-focus]").forEach((row) => {
      row.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest("select, button")) return;
        focusIndex = Number(row.dataset.focus);
        zoom = 1;
        render();
      });
      row.addEventListener("dragstart", () => {
        dragFrom = Number(row.dataset.pageIndex);
      });
      row.addEventListener("dragover", (e) => e.preventDefault());
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        const to = Number(row.dataset.pageIndex);
        if (dragFrom === null || dragFrom === to) return;
        const [moved] = pages.splice(dragFrom, 1);
        pages.splice(to, 0, moved);
        focusIndex = to;
        dragFrom = null;
        render();
      });
    });

    section.querySelectorAll<HTMLButtonElement>("[data-cover-scene]").forEach((btn) => {
      btn.addEventListener("click", () => {
        cover = { ...cover, sceneIndex: Number(btn.dataset.coverScene) };
        render();
      });
    });

    section.querySelector<HTMLInputElement>("#cover-title")?.addEventListener("change", (e) => {
      cover = { ...cover, title: (e.target as HTMLInputElement).value };
      render();
    });

    section.querySelector<HTMLInputElement>("#cover-poster-line")?.addEventListener("change", (e) => {
      cover = { ...cover, posterLine: (e.target as HTMLInputElement).value };
      render();
    });

    section.querySelector<HTMLInputElement>("#cover-show-text")?.addEventListener("change", (e) => {
      cover = { ...cover, showText: (e.target as HTMLInputElement).checked };
      render();
    });

    section.querySelector<HTMLInputElement>("#cover-back-show-text")?.addEventListener("change", (e) => {
      cover = { ...cover, backShowText: (e.target as HTMLInputElement).checked };
    });

    function applyFocalLive(): void {
      const img = section.querySelector<HTMLImageElement>(".zine-studio__cover-preview .zine-cover__img");
      if (img) img.style.objectPosition = `${cover.focalX}% ${cover.focalY}%`;
    }
    section.querySelector<HTMLInputElement>("#cover-focal-x")?.addEventListener("input", (e) => {
      cover = { ...cover, focalX: Number((e.target as HTMLInputElement).value) };
      applyFocalLive();
    });
    section.querySelector<HTMLInputElement>("#cover-focal-y")?.addEventListener("input", (e) => {
      cover = { ...cover, focalY: Number((e.target as HTMLInputElement).value) };
      applyFocalLive();
    });

    section.querySelectorAll<HTMLButtonElement>("[data-cover-contrast]").forEach((btn) => {
      btn.addEventListener("click", () => {
        cover = { ...cover, contrast: btn.dataset.coverContrast as CoverConfig["contrast"] };
        render();
      });
    });

    const captionEl = section.querySelector<HTMLTextAreaElement>("#caption-edit");
    captionEl?.addEventListener("change", () => {
      pages[focusIndex] = { ...pages[focusIndex], caption: captionEl.value };
    });

    section.querySelectorAll<HTMLButtonElement>("[data-image-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        pages[focusIndex] = { ...pages[focusIndex], imageMode: btn.dataset.imageMode as "fit" | "fill" };
        render();
      });
    });

    function applyPageFocalLive(): void {
      const img = section.querySelector<HTMLImageElement>(".zine-studio__page-img");
      const p = pages[focusIndex];
      if (img) img.style.objectPosition = `${p.focalX ?? 50}% ${p.focalY ?? 50}%`;
    }
    section.querySelector<HTMLInputElement>("#page-focal-x")?.addEventListener("input", (e) => {
      pages[focusIndex] = { ...pages[focusIndex], focalX: Number((e.target as HTMLInputElement).value) };
      applyPageFocalLive();
    });
    section.querySelector<HTMLInputElement>("#page-focal-y")?.addEventListener("input", (e) => {
      pages[focusIndex] = { ...pages[focusIndex], focalY: Number((e.target as HTMLInputElement).value) };
      applyPageFocalLive();
    });

    function applyZoomLive(): void {
      const el = section.querySelector<HTMLElement>(".zine-studio__preview-page");
      if (el) el.style.transform = `scale(${zoom})`;
      const label = section.querySelector<HTMLElement>(".zine-studio__zoom-value");
      if (label) label.textContent = `${Math.round(zoom * 100)}%`;
    }
    section.querySelector<HTMLButtonElement>("#zoom-in")?.addEventListener("click", () => {
      zoom = Math.min(1.6, Math.round((zoom + 0.1) * 10) / 10);
      applyZoomLive();
    });
    section.querySelector<HTMLButtonElement>("#zoom-out")?.addEventListener("click", () => {
      zoom = Math.max(0.6, Math.round((zoom - 0.1) * 10) / 10);
      applyZoomLive();
    });
    section.querySelector<HTMLButtonElement>("#zoom-reset")?.addEventListener("click", () => {
      zoom = 1;
      applyZoomLive();
    });

    section.querySelector<HTMLButtonElement>("#save-draft")!.addEventListener("click", async () => {
      await saveZinePages(run!.id, title, pages, cover);
      saveNote = "Draft saved ✓";
      render();
      window.setTimeout(() => {
        saveNote = "";
      }, 2000);
    });

    section.querySelector<HTMLButtonElement>("#export-pdf")!.addEventListener("click", async () => {
      exporting = true;
      render();
      await saveZinePages(run!.id, title, pages, cover);
      try {
        exportResult = await exportPdf(run!.id);
      } catch (err) {
        exportResult = { pdfUrl: "", lowResWarnings: [`Export failed: ${(err as Error).message}`] };
      }
      exporting = false;
      render();
    });
  }

  init();
  return () => {};
}
