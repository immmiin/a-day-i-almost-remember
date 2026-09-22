import { PLACEHOLDER_ASSETS } from "./placeholder-assets";
import { STAGE_THEME, applyStageTheme } from "./dream-machine-theme";
import { buildDreamNav } from "./dream-nav";
import { escapeHtml } from "./util";
import { requestGeneration } from "./generation-client";

const DEMO_REMEMBERED = ["the floral wallpaper", "the green cabinetry"];
const DEMO_TRACE = {
  distorted: { fragment: "the iron", axis: "purpose", before: "presses fabric", after: "presses snow" },
  forgotten: ["the sink", "the countertop", "the window light"],
  passedForward: ["the floral wallpaper", "the iron, now pressing snow"],
};

type StageState = "preview" | "loading" | "error" | "generated";

interface GeneratedResult {
  imageUrl: string;
  prompt: string;
  seed: number;
}

export function renderDreamMachine(root: HTMLElement): () => void {
  const query = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const seedId = query.get("seed");
  const startIndex = Math.max(0, PLACEHOLDER_ASSETS.findIndex((a) => a.id === seedId));
  let index = seedId ? startIndex : 0;
  let state: StageState = "preview";
  let abortController: AbortController | null = null;
  let lastErrorReason: "not-connected" | "failed" | null = null;
  const generatedByScene = new Map<number, GeneratedResult>();

  const section = document.createElement("section");
  section.className = "view dream-machine";
  section.setAttribute("aria-label", "Dream Machine");
  root.appendChild(buildDreamNav("machine"));
  root.appendChild(section);

  function stateOverlay(): string {
    if (state === "loading") {
      return `
        <div class="dream-machine__overlay">
          <div class="dream-machine__overlay-card">
            <div class="dream-machine__overlay-spinner" aria-hidden="true"></div>
            <p class="dream-machine__overlay-text">Generating locally…</p>
            <p class="dream-machine__overlay-note">Real inference on this Mac — usually one to a few minutes.</p>
            <button type="button" class="dream-machine__btn" id="dm-cancel"><span class="dream-machine__btn-label">Cancel</span></button>
          </div>
        </div>`;
    }
    if (state === "error") {
      const note =
        lastErrorReason === "not-connected"
          ? "Draw Things isn't reachable at localhost:7860, or the backend at localhost:8787 isn't running."
          : "Draw Things responded with an error — it may still be busy with a previous request. Check its window, then retry.";
      return `
        <div class="dream-machine__overlay">
          <div class="dream-machine__overlay-card">
            <p class="dream-machine__overlay-text">Generation didn't complete.</p>
            <p class="dream-machine__overlay-note">${escapeHtml(note)}</p>
            <button type="button" class="dream-machine__btn dream-machine__btn--primary" id="dm-retry"><span class="dream-machine__btn-label">Retry</span></button>
          </div>
        </div>`;
    }
    if (state === "generated") {
      return `<div class="dream-badge" style="background:rgba(30,60,40,.75);">generated locally · Draw Things</div>`;
    }
    return `<div class="dream-badge">reference photo — placeholder, not generated</div>`;
  }

  function currentImageSrc(asset: (typeof PLACEHOLDER_ASSETS)[number]): string {
    const generated = generatedByScene.get(index);
    if (state === "generated" && generated) return generated.imageUrl;
    return asset.src;
  }

  function render(): void {
    const asset = PLACEHOLDER_ASSETS[index];
    applyStageTheme(section, STAGE_THEME[asset.timeOfDay] ?? STAGE_THEME.morning);
    const generated = generatedByScene.get(index);
    const caption = state === "generated" && generated ? generated.prompt.split(".")[0] : `${asset.title}.`;

    section.innerHTML = `
      <div class="dream-machine__meta">
        <span>scene ${index + 1} / ${PLACEHOLDER_ASSETS.length} · local generation</span>
        <span>${escapeHtml(asset.timeOfDay)}</span>
      </div>
      <div class="dream-machine__body">
        <div class="dream-machine__main" data-orientation="portrait" data-busy="${state === "loading" || state === "error"}">
          <img class="dream-machine__main-img" src="${currentImageSrc(asset)}" alt="${state === "generated" ? "Locally generated scene image" : "Reference photo standing in for this scene's generated image"}" />
          ${stateOverlay()}
        </div>
        <div class="dream-machine__time-mark" aria-hidden="true">scene ${index + 1} · ${escapeHtml(asset.timeOfDay)}</div>
        <div class="dream-machine__side">
          <div class="dream-machine__side-block">
            <span class="dream-machine__side-label">caption</span>
            <p class="dream-machine__caption">${escapeHtml(caption)}.</p>
          </div>
          <div class="dream-machine__side-block">
            <span class="dream-machine__side-label">remembers</span>
            <div class="dream-machine__remember">
              ${DEMO_REMEMBERED.map((f) => `<span class="dream-machine__chip">${escapeHtml(f)}</span>`).join("")}
            </div>
          </div>
          <details class="dream-machine__trace">
            <summary>memory trace</summary>
            <div class="dream-machine__trace-body">
              ${
                state === "generated" && generated
                  ? `<div class="dream-machine__trace-row"><b>seed</b>${generated.seed}</div>
                     <div class="dream-machine__trace-row"><b>full prompt sent</b>${escapeHtml(generated.prompt)}</div>`
                  : `<p style="margin:0 0 0.4rem;opacity:.75;font-style:italic;">Example trace shown to preview this panel — generate this scene to see its real prompt.</p>
                     <div class="dream-machine__trace-row"><b>distorts</b>${escapeHtml(DEMO_TRACE.distorted.fragment)} — ${escapeHtml(DEMO_TRACE.distorted.axis)}: ${escapeHtml(DEMO_TRACE.distorted.before)} → ${escapeHtml(DEMO_TRACE.distorted.after)}</div>
                     <div class="dream-machine__trace-row"><b>forgets</b>${DEMO_TRACE.forgotten.map(escapeHtml).join(", ")}</div>
                     <div class="dream-machine__trace-row"><b>passes forward</b>${DEMO_TRACE.passedForward.map(escapeHtml).join(", ")}</div>`
              }
            </div>
          </details>
          <div class="dream-machine__controls">
            <button type="button" class="dream-machine__btn dream-machine__btn--primary" id="dm-generate" ${state === "loading" ? "disabled" : ""}>
              <span class="dream-machine__btn-label">${state === "generated" ? "Regenerate this scene" : state === "error" ? "Retry generation" : "Generate this scene"}</span>
            </button>
            <div class="dream-machine__row">
              <button type="button" class="dream-machine__btn" id="dm-save"><span class="dream-machine__btn-label">Save this one</span></button>
              <button type="button" class="dream-machine__btn" id="dm-continue"><span class="dream-machine__btn-label">Continue →</span></button>
            </div>
          </div>
          <p class="dream-machine__setup-note">
            Runs locally through Draw Things on this Mac (FLUX.1 Kontext dev) — no cloud, no per-image
            cost. Each scene only ever receives the 2-3 fragments shown above, never a prior image.
          </p>
        </div>
      </div>
    `;

    section.querySelector<HTMLButtonElement>("#dm-generate")?.addEventListener("click", startGeneration);
    section.querySelector<HTMLButtonElement>("#dm-retry")?.addEventListener("click", startGeneration);
    section.querySelector<HTMLButtonElement>("#dm-cancel")?.addEventListener("click", cancelGeneration);
    section.querySelector<HTMLButtonElement>("#dm-continue")!.addEventListener("click", () => {
      index = (index + 1) % PLACEHOLDER_ASSETS.length;
      state = generatedByScene.has(index) ? "generated" : "preview";
      render();
    });
    section.querySelector<HTMLButtonElement>("#dm-save")!.addEventListener("click", () => {
      window.location.hash = "#/zine";
    });
  }

  async function startGeneration(): Promise<void> {
    const asset = PLACEHOLDER_ASSETS[index];
    state = "loading";
    render();
    abortController = new AbortController();
    const result = await requestGeneration(
      {
        timeOfDay: asset.timeOfDay,
        sceneIndex: index,
        rememberedFragments: DEMO_REMEMBERED,
      },
      abortController.signal,
    );
    if (result.ok) {
      generatedByScene.set(index, { imageUrl: result.imageUrl, prompt: result.prompt, seed: result.seed });
      state = "generated";
    } else if (result.reason === "cancelled") {
      state = generatedByScene.has(index) ? "generated" : "preview";
    } else {
      lastErrorReason = result.reason;
      state = "error";
    }
    render();
  }

  function cancelGeneration(): void {
    abortController?.abort();
  }

  render();

  return () => {
    abortController?.abort();
  };
}
