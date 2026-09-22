import { PLACEHOLDER_ASSETS } from "./placeholder-assets";
import { buildDreamNav } from "./dream-nav";
import { escapeHtml } from "./util";

const TOTAL_PAGES = 16;
const CURRENT_SPREAD_LEFT = 4; // pages 4-5 shown as the representative spread

export function renderZineSpread(root: HTMLElement): () => void {
  const section = document.createElement("section");
  section.className = "view zine-studio";
  section.setAttribute("aria-label", "Zine Studio");
  root.appendChild(buildDreamNav("zine"));
  root.appendChild(section);

  const leftAsset = PLACEHOLDER_ASSETS[3];
  const rightAsset = PLACEHOLDER_ASSETS[4];

  const pageThumbs = Array.from({ length: TOTAL_PAGES }, (_, i) => {
    const page = i + 1;
    const isCover = page === 1 || page === TOTAL_PAGES;
    const isCurrent = page === CURRENT_SPREAD_LEFT || page === CURRENT_SPREAD_LEFT + 1;
    const filled = [1, 4, 5, TOTAL_PAGES].includes(page);
    const asset = filled ? PLACEHOLDER_ASSETS[(page * 3) % PLACEHOLDER_ASSETS.length] : null;
    return `
      <button type="button" class="zine-studio__page-thumb" data-current="${isCurrent}" data-cover="${isCover}" title="Page ${page}${isCover ? " (cover)" : ""}" aria-label="Go to page ${page}">
        ${asset ? `<img src="${asset.src}" alt="" />` : `<span>${page}</span>`}
      </button>`;
  }).join("");

  section.innerHTML = `
    <header class="zine-studio__header">
      <div>
        <h1 class="zine-studio__title">Zine Studio</h1>
        <input class="zine-studio__issue-name" value="A Day I Almost Remember — Issue No. 1" aria-label="Issue title" />
      </div>
      <p class="zine-studio__meta">A5 · 16 pages · reading-order PDF on export</p>
    </header>

    <div class="zine-studio__pages" aria-label="Page overview, 16 pages including covers">
      ${pageThumbs}
    </div>

    <div class="zine-studio__toolbar" aria-label="Page editing tools (prototype — not yet functional)">
      <button type="button" class="zine-studio__tool">crop</button>
      <button type="button" class="zine-studio__tool">reposition</button>
      <button type="button" class="zine-studio__tool">swap image</button>
      <button type="button" class="zine-studio__tool">edit caption</button>
      <button type="button" class="zine-studio__tool">layout: image + detail</button>
    </div>

    <div class="zine-studio__spread" role="group" aria-label="Spread preview, pages ${CURRENT_SPREAD_LEFT}–${CURRENT_SPREAD_LEFT + 1}">
      <div class="zine-studio__page zine-studio__page--left">
        <div class="dream-badge">reference photo — placeholder, not generated</div>
        <img src="${leftAsset.src}" alt="Placeholder reference photo standing in for this page's generated image" />
        <p class="zine-studio__page-caption-overlay">${escapeHtml(leftAsset.title)}.</p>
        <span class="zine-studio__page-number">${CURRENT_SPREAD_LEFT}</span>
      </div>
      <div class="zine-studio__page zine-studio__page--right">
        <span class="zine-studio__page-eyebrow">scene · ${escapeHtml(rightAsset.timeOfDay)}</span>
        <h2 class="zine-studio__page-heading">${escapeHtml(rightAsset.title)}</h2>
        <p class="zine-studio__page-body">
          Remembered from the page before: the floral wallpaper, the green cabinetry. One of them
          has already stopped being what it was.
        </p>
        <div class="zine-studio__page-detail">
          <div class="dream-badge" style="top:0.4rem;left:0.4rem;">reference — placeholder</div>
          <img src="${rightAsset.src}" alt="Placeholder detail crop standing in for a generated detail image" />
        </div>
        <span class="zine-studio__page-number">${CURRENT_SPREAD_LEFT + 1}</span>
      </div>
    </div>

    <footer class="zine-studio__footer">
      <span>draft saved on this device</span>
      <button type="button" class="zine-studio__export" disabled title="Export unlocks once the full editor is built">Export PDF</button>
    </footer>
  `;

  return () => {};
}
