import { DayGenerator } from "../generation/engine";
import type { Scene } from "../generation/types";
import { saveRun, getRun } from "../archive/archive";
import { applyTheme, TIME_THEME } from "./time-theme";
import { buildNav } from "./nav";
import { escapeHtml } from "./util";

const ACTIVE_RUN_KEY = "day-almost-remember:active-run";

function resolveGenerator(): DayGenerator {
  const query = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const resumeId = query.get("resume");
  const wantsNew = query.get("new") === "1";

  if (resumeId) {
    const run = getRun(resumeId);
    if (run && run.scenes.length < 7) {
      localStorage.setItem(ACTIVE_RUN_KEY, run.id);
      return DayGenerator.fromRun(run);
    }
  }

  if (!wantsNew) {
    const activeId = localStorage.getItem(ACTIVE_RUN_KEY);
    if (activeId) {
      const run = getRun(activeId);
      if (run && run.scenes.length < 7) {
        return DayGenerator.fromRun(run);
      }
    }
  }

  const generator = new DayGenerator();
  localStorage.setItem(ACTIVE_RUN_KEY, generator.id);
  return generator;
}

export function renderGeneration(root: HTMLElement): () => void {
  const generator = resolveGenerator();

  const section = document.createElement("section");
  section.className = "view gen";
  section.setAttribute("aria-label", "Generating a day");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  section.dataset.motion = reducedMotion ? "off" : "on";

  section.innerHTML = `
    <div class="gen__grain" aria-hidden="true"></div>
    <div class="gen__top">
      <div class="gen__header">
        <span class="gen__scene-count" id="gen-scene-count"></span>
        <span class="gen__time-label" id="gen-time-label"></span>
      </div>
      <div class="gen__progress" id="gen-progress" role="img"></div>
    </div>
    <div class="gen__main">
      <div class="gen__scene" id="gen-scene"></div>
    </div>
    <div class="gen__footer" id="gen-footer"></div>
  `;

  const navEl = buildNav("generate");
  section.insertBefore(navEl, section.firstChild);

  root.appendChild(section);

  const sceneCountEl = section.querySelector<HTMLElement>("#gen-scene-count")!;
  const timeLabelEl = section.querySelector<HTMLElement>("#gen-time-label")!;
  const progressEl = section.querySelector<HTMLElement>("#gen-progress")!;
  const sceneEl = section.querySelector<HTMLElement>("#gen-scene")!;
  const footerEl = section.querySelector<HTMLElement>("#gen-footer")!;

  for (let i = 0; i < generator.totalScenes; i++) {
    const tick = document.createElement("span");
    tick.className = "gen__progress-tick";
    tick.dataset.filled = "false";
    progressEl.appendChild(tick);
  }
  progressEl.setAttribute("aria-label", `Day progress`);

  function persist(): void {
    saveRun(generator.toRun());
  }

  function renderProgress(scene: Scene): void {
    const ticks = progressEl.querySelectorAll<HTMLElement>(".gen__progress-tick");
    ticks.forEach((tick, i) => {
      tick.dataset.filled = i <= scene.index ? "true" : "false";
    });
  }

  function renderScene(scene: Scene): void {
    applyTheme(section, TIME_THEME[scene.timeOfDay]);
    sceneCountEl.textContent = `scene ${scene.index + 1} / ${generator.totalScenes}`;
    timeLabelEl.textContent = TIME_THEME[scene.timeOfDay].label;
    renderProgress(scene);

    const remembered = scene.inherited.filter((f) => f.id !== scene.distorted?.fragmentId);

    const rememberRow = remembered.length
      ? `<div class="gen__row">
           <span class="gen__row-label">remembers</span>
           <div class="gen__chips">${remembered.map((f) => `<span class="gen__chip gen__chip--remember">${escapeHtml(f.label)}</span>`).join("")}</div>
         </div>`
      : "";

    const distortedFragment = scene.distorted
      ? scene.inherited.find((f) => f.id === scene.distorted!.fragmentId)
      : null;
    const distortRow =
      scene.distorted && distortedFragment
        ? `<div class="gen__row">
             <span class="gen__row-label">distorts</span>
             <div class="gen__distort">
               <span>${escapeHtml(distortedFragment.label)}</span>
               <span class="gen__distort-arrow">— ${escapeHtml(scene.distorted.axis)}:</span>
               <span class="gen__distort-before">${escapeHtml(scene.distorted.before)}</span>
               <span class="gen__distort-arrow">→</span>
               <span class="gen__distort-after">${escapeHtml(scene.distorted.after)}</span>
             </div>
           </div>`
        : "";

    const forgetRow = scene.forgotten.length
      ? `<div class="gen__row">
           <span class="gen__row-label">forgets</span>
           <div class="gen__chips">${scene.forgotten.map((f) => `<span class="gen__chip gen__chip--forget">${escapeHtml(f.label)}</span>`).join("")}</div>
         </div>`
      : "";

    const passRow = scene.passedForward.length
      ? `<div class="gen__row">
           <div class="gen__tray">
             <span class="gen__row-label">passes forward</span>
             ${scene.passedForward.map((f) => `<span class="gen__chip gen__chip--carry">${escapeHtml(f.label)}</span>`).join("")}
           </div>
         </div>`
      : "";

    sceneEl.innerHTML = `
      <p class="gen__prose">${escapeHtml(scene.prose)}</p>
      <div class="gen__mechanics">
        ${rememberRow}
        ${distortRow}
        ${forgetRow}
        ${passRow}
      </div>
    `;
  }

  function renderFooter(): void {
    if (generator.isComplete) {
      footerEl.innerHTML = "";
      const done = document.createElement("div");
      done.className = "gen__done";
      done.innerHTML = `
        <h2>The day is over.</h2>
        <p>Every scene and everything passed between them has been kept in the Dream Archive.</p>
        <div class="gen__done-actions">
          <a href="#/archive" class="gen__continue">Open the Dream Archive</a>
          <button type="button" class="gen__continue" id="gen-new-day">Begin another day</button>
        </div>
      `;
      footerEl.appendChild(done);
      // Assigning the same hash the page is already on fires no hashchange
      // event, so a plain link back to this exact URL would do nothing here;
      // dispatch the event manually to drive the same router path.
      done.querySelector<HTMLButtonElement>("#gen-new-day")!.addEventListener("click", () => {
        localStorage.removeItem(ACTIVE_RUN_KEY);
        const target = "#/generate?new=1";
        if (window.location.hash === target) {
          window.dispatchEvent(new Event("hashchange"));
        } else {
          window.location.hash = target;
        }
      });
      return;
    }

    footerEl.innerHTML = `
      <label class="gen__skip">
        <input type="checkbox" id="gen-skip-motion" ${section.dataset.motion === "off" ? "checked" : ""} />
        skip transitions
      </label>
      <button type="button" class="gen__continue" id="gen-continue">Continue</button>
    `;

    const skipInput = footerEl.querySelector<HTMLInputElement>("#gen-skip-motion")!;
    skipInput.addEventListener("change", () => {
      section.dataset.motion = skipInput.checked ? "off" : "on";
    });

    const continueBtn = footerEl.querySelector<HTMLButtonElement>("#gen-continue")!;
    continueBtn.addEventListener("click", advance);
  }

  function advance(): void {
    const scene = generator.next();
    if (!scene) return;
    persist();
    renderScene(scene);
    renderFooter();
    if (generator.isComplete) {
      localStorage.setItem(ACTIVE_RUN_KEY, generator.id);
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (generator.isComplete) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "BUTTON" || active.tagName === "A")) {
        return; // let native activation handle it, avoid double-advance
      }
      e.preventDefault();
      advance();
    }
  }
  document.addEventListener("keydown", onKeydown);

  if (generator.sceneCount === 0) {
    advance();
  } else {
    const last = generator.allScenes[generator.allScenes.length - 1];
    renderScene(last);
    renderFooter();
  }

  return () => {
    document.removeEventListener("keydown", onKeydown);
  };
}
