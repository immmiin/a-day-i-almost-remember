import { buildDreamNav } from "./dream-nav";
import { escapeHtml, shortCaption } from "./util";
import { getRun, saveZinePages, exportPdf, absoluteUrl, type RunDetail, type ZinePageEntry } from "./dream-api";

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
  let focusIndex = 0;
  let dragFrom: number | null = null;
  let exportResult: { pdfUrl: string; lowResWarnings: string[] } | null = null;
  let exporting = false;
  let saveNote = "";

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
    render();
  }

  function sceneFor(sceneIndex: number) {
    return run!.scenes.find((s) => s.index === sceneIndex) ?? null;
  }

  function render(): void {
    if (!run) return;
    const focused = pages[focusIndex];
    const focusedScene = focused ? sceneFor(focused.sceneIndex) : null;
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

      <section class="zine-studio__editor">
        <div class="zine-studio__pages-list" id="pages-list" aria-label="Zine pages, drag to reorder">
          <div class="zine-studio__page-row zine-studio__page-row--cover">1 · front cover (auto)</div>
          ${pages
            .map((p, i) => {
              const s = sceneFor(p.sceneIndex);
              return `
              <div class="zine-studio__page-row" draggable="true" data-page-index="${i}" data-focus="${i}" style="${i === focusIndex ? "outline:2px solid var(--dream-lilac-deep);" : ""}">
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

        <div class="zine-studio__preview">
          ${
            focused && focusedScene
              ? `
            <div class="zine-studio__preview-page">
              <img src="${absoluteUrl(focusedScene.imageUrl)}" alt="" />
              ${focused.layout !== "full" ? `<div class="zine-studio__preview-caption">${escapeHtml(focused.caption ?? shortCaption(focusedScene.prompt))}</div>` : ""}
            </div>
            <label class="zine-studio__caption-edit">
              caption for page ${focusIndex + 2}
              <textarea id="caption-edit" rows="2">${escapeHtml(focused.caption ?? shortCaption(focusedScene.prompt) ?? "")}</textarea>
            </label>`
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
        render();
      });
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

    const captionEl = section.querySelector<HTMLTextAreaElement>("#caption-edit");
    captionEl?.addEventListener("change", () => {
      pages[focusIndex] = { ...pages[focusIndex], caption: captionEl.value };
    });

    section.querySelector<HTMLButtonElement>("#save-draft")!.addEventListener("click", async () => {
      await saveZinePages(run!.id, title, pages);
      saveNote = "Draft saved ✓";
      render();
      window.setTimeout(() => {
        saveNote = "";
      }, 2000);
    });

    section.querySelector<HTMLButtonElement>("#export-pdf")!.addEventListener("click", async () => {
      exporting = true;
      render();
      await saveZinePages(run!.id, title, pages);
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
