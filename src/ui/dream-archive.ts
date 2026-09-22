import { buildDreamNav } from "./dream-nav";
import { escapeHtml } from "./util";
import { listRuns, deleteRun, absoluteUrl, type RunSummary } from "./dream-api";
import { PLACEHOLDER_ASSETS } from "./placeholder-assets";
import { renderCoverFace, resolveCoverConfig } from "./zine-cover";

export function renderDreamArchive(root: HTMLElement): () => void {
  const section = document.createElement("section");
  section.className = "view dream-archive";
  section.setAttribute("aria-label", "Dream Archive");
  root.appendChild(buildDreamNav("archive"));
  root.appendChild(section);
  section.innerHTML = `<p class="dream-archive__loading">loading your dream archive…</p>`;

  async function paint(): Promise<void> {
    let runs: RunSummary[] = [];
    let backendReachable = true;
    try {
      runs = await listRuns();
    } catch {
      backendReachable = false;
    }

    const completed = runs.filter((r) => r.completed);
    const drafts = runs.filter((r) => !r.completed);

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

      <section class="dream-archive__section">
        <h2 class="dream-archive__section-title">Completed Issues</h2>
        ${
          completed.length
            ? `<div class="dream-archive__grid dream-archive__grid--shelf">${completed.map((r, i) => issueCard(r, i)).join("")}</div>`
            : `<p class="dream-archive__empty">No issue has been exported yet — finish a run in the Zine Studio to see it here.</p>`
        }
      </section>

      <section class="dream-archive__section">
        <h2 class="dream-archive__section-title">Drafts</h2>
        ${
          drafts.length
            ? `<div class="dream-archive__grid">${drafts.map(draftCard).join("")}</div>`
            : `<p class="dream-archive__empty">No drafts yet. <a href="#/">Begin a dream</a> to start one.</p>`
        }
      </section>

      <section class="dream-archive__section">
        <h2 class="dream-archive__section-title">Reference Materials</h2>
        <p class="dream-archive__meta">mood references only — never generated, never part of an exported issue</p>
        <div class="dream-archive__grid dream-archive__grid--refs">
          ${PLACEHOLDER_ASSETS.map(
            (a) => `
            <figure class="dream-archive__ref">
              <div class="dream-badge">reference / mood only</div>
              <img src="${a.src}" alt="${escapeHtml(a.title)}" />
              <figcaption>${escapeHtml(a.title)}</figcaption>
            </figure>`,
          ).join("")}
        </div>
      </section>
    `;

    section.querySelectorAll<HTMLButtonElement>("[data-delete-run]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.deleteRun!;
        if (confirm("Delete this draft permanently? This cannot be undone.")) {
          await deleteRun(id);
          paint();
        }
      });
    });
  }

  function issueCard(r: RunSummary, i: number): string {
    const cover = resolveCoverConfig(r.cover);
    const tilt = (i % 2 === 0 ? -1 : 1) * (0.4 + (i % 3) * 0.25);
    return `
      <article class="dream-archive__card dream-archive__card--issue" style="--tilt:${tilt}deg;">
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
        <div class="dream-archive__card-actions">
          <a class="dream-archive__btn dream-archive__btn--primary" href="${absoluteUrl("/pdfs/" + r.id + ".pdf")}" target="_blank" rel="noopener">Open issue</a>
          <a class="dream-archive__btn" href="#/zine?run=${encodeURIComponent(r.id)}">Edit in Zine Studio</a>
          ${r.sceneCount < 7 ? `<a class="dream-archive__btn" href="#/machine?resume=${encodeURIComponent(r.id)}">Continue generating</a>` : ""}
          <a class="dream-archive__btn" href="${absoluteUrl("/pdfs/" + r.id + ".pdf")}" download>Download PDF</a>
        </div>
      </article>`;
  }

  function draftCard(r: RunSummary): string {
    return `
      <article class="dream-archive__card">
        <div class="dream-archive__cover">
          ${r.coverImageUrl ? `<img src="${absoluteUrl(r.coverImageUrl)}" alt="" />` : `<div class="dream-archive__cover-empty"></div>`}
        </div>
        <h3 class="dream-archive__card-title">${escapeHtml(r.seedText || "Untitled dream")}</h3>
        <p class="dream-archive__card-meta">${new Date(r.createdAt).toLocaleDateString()} · ${r.sceneCount}/7 scenes generated</p>
        <div class="dream-archive__card-actions">
          <a class="dream-archive__btn" href="#/machine?resume=${encodeURIComponent(r.id)}">Continue generating</a>
          ${r.sceneCount ? `<a class="dream-archive__btn" href="#/zine?run=${encodeURIComponent(r.id)}">Edit in Zine Studio</a>` : ""}
          <button type="button" class="dream-archive__btn dream-archive__btn--danger" data-delete-run="${escapeHtml(r.id)}">Delete</button>
        </div>
      </article>`;
  }

  paint();
  return () => {};
}
