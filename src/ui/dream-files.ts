import { PLACEHOLDER_ASSETS } from "./placeholder-assets";
import { buildDreamNav } from "./dream-nav";
import { escapeHtml } from "./util";

export function renderDreamFiles(root: HTMLElement): () => void {
  const section = document.createElement("section");
  section.className = "view dream-files";
  section.setAttribute("aria-label", "Dream Files");

  const itemSize = 132; // matches the CSS clamp's upper bound closely enough for radius math

  section.innerHTML = `
    <div class="dream-files__bloom" aria-hidden="true"></div>
    <div class="dream-files__frame">
      <div class="dream-files__center">
        <h1 class="dream-files__title">A Day I Almost<br />Remember</h1>
        <p class="dream-files__concept">
          A collection of dream files. Open one, or begin a new one — either way, the day starts
          ordinary and drifts, scene by scene, into something it shouldn't be able to be.
        </p>
        <button type="button" class="dream-files__cta" id="begin-dream">Begin a dream →</button>
      </div>
      <div class="dream-files__ring-wrap" id="ring-wrap">
        <button type="button" class="dream-files__rotate dream-files__rotate--prev" id="rotate-prev" aria-label="Rotate dream files backward">‹</button>
        <div class="dream-files__ring" id="ring" role="list" aria-label="Saved dream files, rotate with arrow keys or the buttons beside this collection">
          ${PLACEHOLDER_ASSETS.map(
            (a, i) => `
            <button type="button" class="dream-files__item" role="listitem" data-index="${i}" data-file-id="${a.id}" aria-label="Open dream file: ${escapeHtml(a.title)}">
              <img class="dream-files__item-img" src="${a.src}" alt="" loading="lazy" />
              <span class="dream-files__item-label">${escapeHtml(a.title)}</span>
            </button>`,
          ).join("")}
        </div>
        <button type="button" class="dream-files__rotate dream-files__rotate--next" id="rotate-next" aria-label="Rotate dream files forward">›</button>
      </div>
      <p class="dream-files__hint">scroll, drag, or use the arrows to look around · click a file to open it</p>
    </div>
  `;

  root.appendChild(buildDreamNav("files"));
  root.appendChild(section);

  const ringWrap = section.querySelector<HTMLElement>("#ring-wrap")!;
  const ring = section.querySelector<HTMLElement>("#ring")!;
  const items = Array.from(section.querySelectorAll<HTMLButtonElement>(".dream-files__item"));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let rotation = 0; // degrees
  let orbitRadius = 0; // px, recomputed on resize
  const step = 360 / items.length;

  function placeItems(): void {
    items.forEach((item, i) => {
      const angle = i * step + rotation;
      item.style.transform = `rotate(${angle}deg) translateY(${-orbitRadius}px) rotate(${-angle}deg)`;
    });
  }

  function layout(): void {
    const wrapRadius = ringWrap.clientWidth / 2;
    orbitRadius = wrapRadius - itemSize * 0.55;
    placeItems();
  }

  function rotateBy(delta: number): void {
    rotation += delta;
    placeItems();
  }

  layout();
  window.addEventListener("resize", layout);

  section.querySelector<HTMLButtonElement>("#rotate-prev")!.addEventListener("click", () => rotateBy(-step));
  section.querySelector<HTMLButtonElement>("#rotate-next")!.addEventListener("click", () => rotateBy(step));

  let dragging = false;
  let dragStartX = 0;
  let dragStartRotation = 0;

  ringWrap.addEventListener("wheel", (e) => {
    e.preventDefault();
    rotateBy(e.deltaY * 0.15);
  }, { passive: false });

  ringWrap.addEventListener("pointerdown", (e) => {
    dragging = true;
    dragStartX = e.clientX;
    dragStartRotation = rotation;
    ringWrap.setPointerCapture(e.pointerId);
  });
  ringWrap.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const delta = (e.clientX - dragStartX) * 0.4;
    rotation = dragStartRotation + delta;
    placeItems();
  });
  ringWrap.addEventListener("pointerup", () => {
    dragging = false;
  });
  ringWrap.addEventListener("pointercancel", () => {
    dragging = false;
  });

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "ArrowLeft") {
      rotateBy(-step);
    } else if (e.key === "ArrowRight") {
      rotateBy(step);
    }
  }
  ring.addEventListener("keydown", onKeydown);

  function openFile(fileId: string): void {
    if (reduceMotion) {
      window.location.hash = `#/machine?seed=${encodeURIComponent(fileId)}`;
      return;
    }
    section.classList.add("is-leaving");
    window.setTimeout(() => {
      window.location.hash = `#/machine?seed=${encodeURIComponent(fileId)}`;
    }, 620);
  }

  items.forEach((item) => {
    item.addEventListener("click", () => openFile(item.dataset.fileId ?? ""));
  });

  section.querySelector<HTMLButtonElement>("#begin-dream")!.addEventListener("click", () => openFile(""));

  return () => {
    window.removeEventListener("resize", layout);
  };
}
