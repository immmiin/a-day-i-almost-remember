import type { DayRun, Scene } from "../generation/types";
import {
  listRuns,
  deleteRun,
  isSelected,
  toggleSelection,
  getSelectedScenes,
  exportRunAsJson,
  exportRunAsText,
  exportSelectionAsJson,
  exportSelectionAsText,
  downloadTextFile,
} from "../archive/archive";
import { buildNav } from "./nav";
import { escapeHtml } from "./util";

export function renderArchive(root: HTMLElement): () => void {
  const section = document.createElement("section");
  section.className = "view archive";
  section.setAttribute("aria-label", "Dream Archive");
  root.appendChild(section);

  function paint(): void {
    const runs = listRuns();
    const selectedCount = getSelectedScenes().length;

    section.innerHTML = "";
    section.appendChild(buildNav("archive"));

    const header = document.createElement("div");
    header.className = "archive__header";
    header.innerHTML = `
      <div>
        <h1 class="archive__title">Dream Archive</h1>
        <p class="archive__meta">${runs.length} run${runs.length === 1 ? "" : "s"} saved on this device</p>
      </div>
    `;
    section.appendChild(header);

    const toolbar = document.createElement("div");
    toolbar.className = "archive__toolbar";
    toolbar.innerHTML = `
      <span>${selectedCount} scene${selectedCount === 1 ? "" : "s"} selected for the zine</span>
      <div class="archive__toolbar-actions">
        <button type="button" class="archive__btn" id="export-selection-text" ${selectedCount ? "" : "disabled"}>export selection · text</button>
        <button type="button" class="archive__btn" id="export-selection-json" ${selectedCount ? "" : "disabled"}>export selection · json</button>
      </div>
    `;
    section.appendChild(toolbar);
    toolbar.querySelector("#export-selection-text")?.addEventListener("click", () => {
      downloadTextFile("dream-archive-selection.txt", exportSelectionAsText());
    });
    toolbar.querySelector("#export-selection-json")?.addEventListener("click", () => {
      downloadTextFile("dream-archive-selection.json", exportSelectionAsJson(), "application/json");
    });

    if (runs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "archive__empty";
      empty.innerHTML = `Nothing generated yet. <a href="#/generate?new=1">Begin a day</a> and its scenes will collect here as you go.`;
      section.appendChild(empty);
      return;
    }

    for (const run of runs) {
      section.appendChild(buildRunBlock(run, paint));
    }
  }

  paint();
  return () => {};
}

function buildRunBlock(run: DayRun, onChange: () => void): HTMLElement {
  const complete = run.scenes.length >= 7;
  const wrap = document.createElement("div");
  wrap.className = "archive__run";

  const header = document.createElement("div");
  header.className = "archive__run-header";
  header.innerHTML = `
    <span class="archive__run-id">${escapeHtml(run.id.slice(0, 16))}</span>
    <span>${new Date(run.createdAt).toLocaleString()}</span>
    <span class="archive__status ${complete ? "" : "archive__status--progress"}">${complete ? "complete" : `in progress · ${run.scenes.length}/7`}</span>
    ${!complete ? `<a class="archive__resume" href="#/generate?resume=${encodeURIComponent(run.id)}">resume →</a>` : ""}
    <span class="archive__run-actions">
      <button type="button" class="archive__btn" data-action="export-text">export text</button>
      <button type="button" class="archive__btn" data-action="export-json">export json</button>
      <button type="button" class="archive__btn" data-action="delete">delete</button>
    </span>
  `;
  wrap.appendChild(header);

  header.querySelector('[data-action="export-text"]')?.addEventListener("click", () => {
    downloadTextFile(`${run.id}.txt`, exportRunAsText(run));
  });
  header.querySelector('[data-action="export-json"]')?.addEventListener("click", () => {
    downloadTextFile(`${run.id}.json`, exportRunAsJson(run), "application/json");
  });
  header.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
    if (confirm(`Delete this run permanently? This cannot be undone.`)) {
      deleteRun(run.id);
      onChange();
    }
  });

  const grid = document.createElement("div");
  grid.className = "archive__scenes";
  for (const scene of run.scenes) {
    grid.appendChild(buildSceneCard(run, scene, onChange));
  }
  wrap.appendChild(grid);

  return wrap;
}

function buildSceneCard(run: DayRun, scene: Scene, onChange: () => void): HTMLElement {
  const card = document.createElement("article");
  card.className = "archive__card";
  const selected = isSelected({ runId: run.id, sceneIndex: scene.index });

  const detailRows: string[] = [];
  if (scene.inherited.length) {
    detailRows.push(detailRow("remembered", scene.inherited.map((f) => f.label).join(", ")));
  }
  if (scene.distorted) {
    const target = scene.inherited.find((f) => f.id === scene.distorted!.fragmentId);
    detailRows.push(
      detailRow(
        "distorted",
        `${target ? target.label : scene.distorted.fragmentId} — ${scene.distorted.axis}: ${scene.distorted.before} → ${scene.distorted.after}`,
      ),
    );
  }
  if (scene.introduced.length) {
    detailRows.push(detailRow("introduced", scene.introduced.map((f) => f.label).join(", ")));
  }
  if (scene.forgotten.length) {
    detailRows.push(detailRow("forgotten", scene.forgotten.map((f) => f.label).join(", ")));
  }
  if (scene.passedForward.length) {
    detailRows.push(detailRow("passed on", scene.passedForward.map((f) => f.label).join(", ")));
  }

  card.innerHTML = `
    <div class="archive__card-head">
      <span>scene ${scene.index + 1} · ${scene.timeOfDay.replace("-", " ")}</span>
      <label class="archive__select">
        <input type="checkbox" ${selected ? "checked" : ""} />
        zine
      </label>
    </div>
    <p class="archive__card-excerpt">${escapeHtml(scene.prose)}</p>
    <details class="archive__disclosure">
      <summary>what changed</summary>
      <div class="archive__detail-rows">${detailRows.join("")}</div>
    </details>
  `;

  card.querySelector('input[type="checkbox"]')?.addEventListener("change", () => {
    toggleSelection({ runId: run.id, sceneIndex: scene.index });
    onChange();
  });

  return card;
}

function detailRow(label: string, value: string): string {
  return `<div class="archive__detail-row">
    <span class="archive__detail-label">${escapeHtml(label)}</span>
    <span class="archive__detail-value">${escapeHtml(value)}</span>
  </div>`;
}
