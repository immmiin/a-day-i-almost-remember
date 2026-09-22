import { PLACEHOLDER_ASSETS } from "./placeholder-assets";
import { STAGE_THEME, applyStageTheme } from "./dream-machine-theme";
import { buildDreamNav } from "./dream-nav";
import { escapeHtml } from "./util";

const DEMO_REMEMBERED = ["the floral wallpaper", "the green cabinetry"];
const DEMO_TRACE = {
  distorted: { fragment: "the iron", axis: "purpose", before: "presses fabric", after: "presses snow" },
  forgotten: ["the sink", "the countertop", "the window light"],
  passedForward: ["the floral wallpaper", "the iron, now pressing snow"],
};

export function renderDreamMachine(root: HTMLElement): () => void {
  const query = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const seedId = query.get("seed");
  const startIndex = Math.max(0, PLACEHOLDER_ASSETS.findIndex((a) => a.id === seedId));
  let index = seedId ? startIndex : 0;

  const section = document.createElement("section");
  section.className = "view dream-machine";
  section.setAttribute("aria-label", "Dream Machine");
  root.appendChild(buildDreamNav("machine"));
  root.appendChild(section);

  function render(): void {
    const asset = PLACEHOLDER_ASSETS[index];
    applyStageTheme(section, STAGE_THEME[asset.timeOfDay] ?? STAGE_THEME.morning);

    section.innerHTML = `
      <div class="dream-machine__meta">
        <span>scene ${index + 1} / ${PLACEHOLDER_ASSETS.length} · prototype</span>
        <span>${escapeHtml(asset.timeOfDay)}</span>
      </div>
      <div class="dream-machine__stage">
        <div class="dream-machine__frame">
          <div class="dream-badge">reference photo — placeholder, not generated</div>
          <img class="dream-machine__frame-img" src="${asset.src}" alt="Placeholder reference photo standing in for this scene's generated image" />
        </div>
      </div>
      <div class="dream-machine__lower">
        <p class="dream-machine__caption">${escapeHtml(asset.title)}.</p>
        <div class="dream-machine__remember" aria-label="Fragments remembered from the previous scene">
          ${DEMO_REMEMBERED.map((f) => `<span class="dream-machine__chip">${escapeHtml(f)}</span>`).join("")}
        </div>
        <details class="dream-machine__trace">
          <summary>memory trace</summary>
          <div class="dream-machine__trace-body">
            <p style="margin:0 0 0.4rem;opacity:.75;font-style:italic;">Example trace shown to preview this panel — real traces begin once generation is connected in a later stage.</p>
            <div class="dream-machine__trace-row"><b>distorts</b>${escapeHtml(DEMO_TRACE.distorted.fragment)} — ${escapeHtml(DEMO_TRACE.distorted.axis)}: ${escapeHtml(DEMO_TRACE.distorted.before)} → ${escapeHtml(DEMO_TRACE.distorted.after)}</div>
            <div class="dream-machine__trace-row"><b>forgets</b>${DEMO_TRACE.forgotten.map(escapeHtml).join(", ")}</div>
            <div class="dream-machine__trace-row"><b>passes forward</b>${DEMO_TRACE.passedForward.map(escapeHtml).join(", ")}</div>
          </div>
        </details>
        <div class="dream-machine__controls">
          <button type="button" class="dream-machine__btn" id="dm-retry"><span class="dream-machine__btn-label">Retry</span></button>
          <button type="button" class="dream-machine__btn" id="dm-save"><span class="dream-machine__btn-label">Save this one</span></button>
          <button type="button" class="dream-machine__btn dream-machine__btn--primary" id="dm-continue"><span class="dream-machine__btn-label">Continue →</span></button>
        </div>
        <p style="text-align:center;font-family:var(--font-mono);font-size:.66rem;opacity:.7;margin:0;">
          prototype stage — layout and motion only; no image is generated yet
        </p>
      </div>
    `;

    section.querySelector<HTMLButtonElement>("#dm-retry")!.addEventListener("click", () => {
      index = (index + 1) % PLACEHOLDER_ASSETS.length;
      render();
    });
    section.querySelector<HTMLButtonElement>("#dm-continue")!.addEventListener("click", () => {
      index = (index + 1) % PLACEHOLDER_ASSETS.length;
      render();
    });
    section.querySelector<HTMLButtonElement>("#dm-save")!.addEventListener("click", () => {
      window.location.hash = "#/zine";
    });
  }

  render();

  return () => {};
}
