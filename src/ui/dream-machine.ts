import type { Scene } from "../generation/types";
import { DAY_SEQUENCE } from "../generation/types";
import { DreamRunClient, fragmentsForGeneration, DEFAULT_SEED_TEXT } from "../generation/dream-run";
import { STAGE_THEME, applyStageTheme } from "./dream-machine-theme";
import { buildDreamNav } from "./dream-nav";
import { escapeHtml } from "./util";
import { requestGeneration } from "./generation-client";
import { createRun, saveScene, getRun, absoluteUrl, type SavedScene } from "./dream-api";

type SceneState = "idle" | "generating" | "generated" | "error";

export function renderDreamMachine(root: HTMLElement): () => void {
  const query = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const resumeId = query.get("resume");
  const seedParam = query.get("seed");

  const section = document.createElement("section");
  section.className = "view dream-machine";
  section.setAttribute("aria-label", "Dream Machine");
  root.appendChild(buildDreamNav("machine"));
  root.appendChild(section);
  section.innerHTML = `<div class="dream-machine__meta"><span>loading…</span></div>`;

  let client: DreamRunClient;
  const saved = new Map<number, SavedScene>();
  let index = 0;
  // sceneState is a real state machine now: render() only ever displays it,
  // never recomputes it — it used to be re-derived from saved.has(index) on
  // every render() call, which clobbered "generating"/"error" back to
  // "idle" the instant they were set. It's set explicitly at every
  // transition: on navigating to a scene, and inside startGeneration().
  let sceneState: SceneState = "idle";
  let lastErrorReason: "not-connected" | "failed" | null = null;
  let saveNote = "";
  let abortController: AbortController | null = null;
  let ready = false;
  let generationInFlight = false;

  async function init(): Promise<void> {
    if (resumeId) {
      const run = await getRun(resumeId);
      if (run) {
        for (const s of run.scenes) saved.set(s.index, s);
        const sceneObjects: Scene[] = run.scenes.map((s) => {
          // `remembered` is deliberately saved without the distorted fragment
          // (the UI shows it in its own row) — restore it here from wherever
          // it ended up (passedForward or forgotten) so DISTORTS still has a
          // label to show. Its `.label` never changes across any distortion
          // axis, so any copy of it is equally correct.
          const distortedFragment = s.distorted
            ? [...s.passedForward, ...s.forgotten].find((f) => f.id === s.distorted!.fragmentId)
            : undefined;
          return {
            index: s.index,
            timeOfDay: s.timeOfDay as Scene["timeOfDay"],
            inherited: distortedFragment ? [...s.remembered, distortedFragment] : s.remembered,
            distorted: s.distorted,
            introduced: [], // already folded into `remembered` for display/regeneration purposes
            prose: "",
            passedForward: s.passedForward,
            forgotten: s.forgotten,
          };
        });
        client = DreamRunClient.fromSavedScenes(run.seedText, sceneObjects, { id: run.id, createdAt: run.createdAt });
        index = Math.max(0, run.scenes.length - 1);
      } else {
        client = new DreamRunClient(DEFAULT_SEED_TEXT);
      }
    } else {
      const seedText = seedParam ? decodeURIComponent(seedParam) : DEFAULT_SEED_TEXT;
      client = new DreamRunClient(seedText);
      await createRun(client.id, seedText, client.createdAt);
    }
    sceneState = stateForIndex(index);
    ready = true;
    render();
  }

  function ensureFragmentScene(idx: number): Scene {
    while (client.sceneCount <= idx) {
      client.nextFragmentScene();
    }
    return client.allScenes[idx];
  }

  function stateForIndex(idx: number): SceneState {
    return saved.has(idx) ? "generated" : "idle";
  }

  function stageOverlay(): string {
    if (sceneState === "generating") {
      return `
        <div class="dream-machine__overlay">
          <div class="dream-machine__overlay-card">
            <div class="dream-machine__overlay-spinner" aria-hidden="true"></div>
            <p class="dream-machine__overlay-text">Generating locally…</p>
            <p class="dream-machine__overlay-note">The dream is taking shape — usually one to a few minutes on this Mac.</p>
            <button type="button" class="dream-machine__btn" id="dm-cancel"><span class="dream-machine__btn-label">Cancel</span></button>
          </div>
        </div>`;
    }
    if (sceneState === "error") {
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
    if (sceneState === "idle") {
      return `
        <div class="dream-machine__idle">
          <p class="dream-machine__idle-text">This scene hasn't taken shape yet.</p>
          <button type="button" class="dream-machine__btn dream-machine__btn--primary" id="dm-generate">
            <span class="dream-machine__btn-label">Generate this scene</span>
          </button>
        </div>`;
    }
    return `<div class="dream-badge" style="background:rgba(30,60,40,.8);">generated locally · draw things</div>`;
  }

  function render(): void {
    if (!ready) return;
    const fragScene = ensureFragmentScene(index);
    const savedScene = saved.get(index);
    const theme = STAGE_THEME[fragScene.timeOfDay] ?? STAGE_THEME.morning;
    applyStageTheme(section, theme);

    const remembered = fragScene.inherited.filter((f) => f.id !== fragScene.distorted?.fragmentId);
    const isLast = index === DAY_SEQUENCE.length - 1;
    const caption = savedScene
      ? savedScene.prompt.split(".")[1]?.trim() || savedScene.prompt.split(".")[0]
      : index === 0
        ? client.seedText
        : "Not yet generated.";

    const statusMessage =
      sceneState === "generating"
        ? "The dream is taking shape."
        : sceneState === "generated"
          ? "Scene generated."
          : sceneState === "error"
            ? "Generation failed."
            : "";

    section.innerHTML = `
      <div class="dream-machine__meta">
        <span>scene ${index + 1} / ${DAY_SEQUENCE.length} · local generation</span>
        <span>${escapeHtml(fragScene.timeOfDay)}</span>
      </div>
      <p class="visually-hidden" role="status" aria-live="polite">${escapeHtml(statusMessage)}</p>
      <div class="dream-machine__body">
        <div class="dream-machine__main" data-busy="${sceneState !== "generated"}" aria-busy="${sceneState === "generating"}">
          ${
            savedScene
              ? `<img class="dream-machine__main-img" src="${absoluteUrl(savedScene.imageUrl)}" alt="Locally generated scene image" />`
              : `<div class="dream-machine__main-empty" aria-hidden="true"></div>`
          }
          <div class="dream-machine__scene-badge">scene ${index + 1} · ${escapeHtml(fragScene.timeOfDay)}</div>
          ${stageOverlay()}
        </div>
        <div class="dream-machine__side">
          <div class="dream-machine__side-block">
            <span class="dream-machine__side-label">caption</span>
            <p class="dream-machine__caption">${escapeHtml(caption)}</p>
          </div>
          <div class="dream-machine__side-block">
            <span class="dream-machine__side-label">remembers</span>
            <div class="dream-machine__remember">
              ${
                remembered.length
                  ? remembered.map((f) => `<span class="dream-machine__chip">${escapeHtml(f.label)}</span>`).join("")
                  : `<span class="dream-machine__chip dream-machine__chip--muted">nothing before this — it's the first scene</span>`
              }
            </div>
          </div>
          ${
            fragScene.distorted
              ? `<div class="dream-machine__side-block">
                   <span class="dream-machine__side-label">distorts</span>
                   <div class="dream-machine__distort-line">
                     ${escapeHtml(fragScene.inherited.find((f) => f.id === fragScene.distorted!.fragmentId)?.label ?? "")}
                     — ${escapeHtml(fragScene.distorted.axis)}: ${escapeHtml(fragScene.distorted.before)} → ${escapeHtml(fragScene.distorted.after)}
                   </div>
                 </div>`
              : ""
          }
          <div class="dream-machine__side-block">
            <span class="dream-machine__side-label">forgets</span>
            <div class="dream-machine__remember">
              ${fragScene.forgotten.map((f) => `<span class="dream-machine__chip dream-machine__chip--forget">${escapeHtml(f.label)}</span>`).join("") || `<span class="dream-machine__chip dream-machine__chip--muted">nothing let go of yet</span>`}
            </div>
          </div>
          <div class="dream-machine__side-block">
            <span class="dream-machine__side-label">passes forward</span>
            <div class="dream-machine__remember">
              ${fragScene.passedForward.map((f) => `<span class="dream-machine__chip dream-machine__chip--carry">${escapeHtml(f.label)}</span>`).join("")}
            </div>
          </div>
          <details class="dream-machine__trace">
            <summary>memory trace</summary>
            <div class="dream-machine__trace-body">
              ${
                savedScene
                  ? `<div class="dream-machine__trace-row"><b>seed</b>${savedScene.genSeed}</div>
                     <div class="dream-machine__trace-row"><b>settings</b>${savedScene.settings.width}×${savedScene.settings.height}, ${savedScene.settings.steps} steps</div>
                     <div class="dream-machine__trace-row"><b>full prompt sent</b>${escapeHtml(savedScene.prompt)}</div>`
                  : `<p style="margin:0;opacity:.75;font-style:italic;">Generate this scene to see its real prompt and seed here.</p>`
              }
            </div>
          </details>
          <div class="dream-machine__controls">
            <button type="button" class="dream-machine__btn dream-machine__btn--primary" id="dm-generate-main" ${sceneState === "generating" ? "disabled aria-disabled=\"true\"" : ""} aria-busy="${sceneState === "generating"}">
              <span class="dream-machine__btn-label">${
                sceneState === "generating"
                  ? "Generating locally…"
                  : sceneState === "error"
                    ? "Generation failed — Retry"
                    : savedScene
                      ? "Regenerate this scene"
                      : "Generate this scene"
              }</span>
            </button>
            <div class="dream-machine__row">
              <button type="button" class="dream-machine__btn" id="dm-save" ${savedScene ? "" : "disabled"}><span class="dream-machine__btn-label">${saveNote || "Save this one"}</span></button>
              <button type="button" class="dream-machine__btn" id="dm-continue" ${savedScene ? "" : "disabled"}>
                <span class="dream-machine__btn-label">${isLast ? "Open Dream Archive" : "Add another scene →"}</span>
              </button>
            </div>
            ${saved.size > 0 ? `<a class="dream-machine__btn" href="#/zine?run=${encodeURIComponent(client.id)}">Back to Zine Studio</a>` : ""}
          </div>
          <p class="dream-machine__setup-note">
            Runs locally through Draw Things (FLUX.1 Kontext dev) — no cloud, no per-image cost. This
            scene only ever receives the fragments shown above, never a prior image.
          </p>
        </div>
      </div>
    `;

    section.querySelector<HTMLButtonElement>("#dm-generate")?.addEventListener("click", startGeneration);
    section.querySelector<HTMLButtonElement>("#dm-generate-main")?.addEventListener("click", startGeneration);
    section.querySelector<HTMLButtonElement>("#dm-retry")?.addEventListener("click", startGeneration);
    section.querySelector<HTMLButtonElement>("#dm-cancel")?.addEventListener("click", () => abortController?.abort());
    section.querySelector<HTMLButtonElement>("#dm-save")?.addEventListener("click", async () => {
      const s = saved.get(index);
      if (!s) return;
      await saveScene(client.id, s);
      saveNote = "Saved ✓";
      render();
      window.setTimeout(() => {
        saveNote = "";
      }, 2000);
    });
    section.querySelector<HTMLButtonElement>("#dm-continue")!.addEventListener("click", () => {
      if (isLast) {
        window.location.hash = "#/archive";
        return;
      }
      index += 1;
      sceneState = stateForIndex(index);
      render();
    });
  }

  async function startGeneration(): Promise<void> {
    // In-flight lock: belt-and-suspenders alongside the disabled button
    // attribute, so a rapid double-click (which can land before the
    // synchronous render() below has actually disabled the DOM button)
    // can never fire two requests for the same scene.
    if (generationInFlight) return;
    generationInFlight = true;
    const fragScene = ensureFragmentScene(index);
    const { rememberedFragments, distortionNote } = fragmentsForGeneration(fragScene);
    sceneState = "generating";
    render();
    abortController = new AbortController();
    const result = await requestGeneration(
      {
        timeOfDay: fragScene.timeOfDay,
        sceneIndex: index,
        seedText: index === 0 ? client.seedText : undefined,
        rememberedFragments,
        distortionNote,
      },
      abortController.signal,
    );
    if (result.ok) {
      const record: SavedScene = {
        index,
        timeOfDay: fragScene.timeOfDay,
        imageUrl: result.imageUrl,
        prompt: result.prompt,
        genSeed: result.seed,
        remembered: fragScene.inherited.filter((f) => f.id !== fragScene.distorted?.fragmentId),
        forgotten: fragScene.forgotten,
        distorted: fragScene.distorted,
        passedForward: fragScene.passedForward,
        settings: { width: 768, height: 768, steps: 12 },
        createdAt: new Date().toISOString(),
      };
      saved.set(index, record);
      await saveScene(client.id, record);
      sceneState = "generated";
    } else if (result.reason !== "cancelled") {
      lastErrorReason = result.reason;
      sceneState = "error";
    } else {
      sceneState = saved.has(index) ? "generated" : "idle";
    }
    generationInFlight = false;
    render();
  }

  init();

  return () => {
    abortController?.abort();
  };
}
