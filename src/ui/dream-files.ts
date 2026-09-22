import { PLACEHOLDER_ASSETS } from "./placeholder-assets";
import { buildDreamNav } from "./dream-nav";
import { escapeHtml } from "./util";

/** Small deterministic per-item variety: fixed tilt, scale, and depth — not
 * randomized per render, so the composition doesn't jump between reloads. */
const ITEM_TILT = [-4, 3, -2, 5, -3, 2, -5, 4];
const ITEM_SCALE = [1.08, 0.92, 1.15, 0.96, 1.04, 0.88, 1.1, 0.98];

export function renderDreamFiles(root: HTMLElement): () => void {
  const section = document.createElement("section");
  section.className = "view dream-files";
  section.setAttribute("aria-label", "Dream Files");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none)").matches;

  section.innerHTML = `
    <div class="dream-files__bloom" aria-hidden="true"></div>
    <div class="dream-files__stage" id="stage" tabindex="-1">
      <div class="dream-files__ring-wrap" id="ring-wrap">
        <div class="dream-files__ring" id="ring" role="list" aria-label="Dream files. Hover or focus this area to reveal the entry point; rotate with arrow keys, drag, scroll, or the buttons beside the collection.">
          ${PLACEHOLDER_ASSETS.map(
            (a, i) => `
            <button type="button" class="dream-files__item" role="listitem" data-index="${i}" data-file-id="${a.id}" style="--tilt:${ITEM_TILT[i % ITEM_TILT.length]}deg;--scale:${ITEM_SCALE[i % ITEM_SCALE.length]}" aria-label="Open dream file preview: ${escapeHtml(a.title)}">
              <img class="dream-files__item-img" src="${a.src}" alt="" loading="lazy" />
              <span class="dream-files__item-label">${escapeHtml(a.title)} · preview</span>
            </button>`,
          ).join("")}
        </div>
        <button type="button" class="dream-files__rotate dream-files__rotate--prev" id="rotate-prev" aria-label="Rotate dream files backward">‹</button>
        <button type="button" class="dream-files__rotate dream-files__rotate--next" id="rotate-next" aria-label="Rotate dream files forward">›</button>
      </div>
      <div class="dream-files__center" id="center">
        <h1 class="dream-files__title">A Day I Almost<br />Remember</h1>
        <button type="button" class="dream-files__cta" id="begin-dream">Begin a dream →</button>
      </div>
    </div>
    <p class="dream-files__hint">move the pointer here, or press tab, to open the collection · scroll, drag, or the arrows to look around</p>
  `;

  root.appendChild(buildDreamNav("files"));
  root.appendChild(section);

  const stage = section.querySelector<HTMLElement>("#stage")!;
  const ringWrap = section.querySelector<HTMLElement>("#ring-wrap")!;
  const ring = section.querySelector<HTMLElement>("#ring")!;
  const items = Array.from(section.querySelectorAll<HTMLButtonElement>(".dream-files__item"));

  const alwaysRevealed = reduceMotion || isTouch;
  if (alwaysRevealed) stage.classList.add("is-revealed");

  const step = 360 / items.length;
  // Offset the start so no item sits dead-center-top, overlapping the
  // title/button column that reveals there (matters most for reduced
  // motion and touch, which never rotate away from this start angle).
  let rotation = step / 2;
  let orbitRx = 0;
  let orbitRy = 0;

  const AUTO_SPEED = 3.2; // deg/sec, normal ambient orbit
  const SLOW_SPEED = 0.7; // deg/sec, while revealed
  let currentSpeed = AUTO_SPEED;
  let targetSpeed = AUTO_SPEED;

  function placeItems(): void {
    items.forEach((item, i) => {
      const angle = i * step + rotation;
      const rad = (angle * Math.PI) / 180;
      const x = Math.sin(rad) * orbitRx;
      const y = -Math.cos(rad) * orbitRy;
      item.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${ITEM_TILT[i % ITEM_TILT.length]}deg) scale(${ITEM_SCALE[i % ITEM_SCALE.length]})`;
    });
  }

  function layout(): void {
    const w = ringWrap.clientWidth;
    const h = ringWrap.clientHeight;
    orbitRx = w * 0.5 - 100;
    orbitRy = h * 0.5 - 110;
    placeItems();
  }

  function rotateBy(delta: number): void {
    rotation += delta;
    placeItems();
  }

  layout();
  window.addEventListener("resize", layout);

  let rafId = 0;
  let lastT = performance.now();
  function tick(t: number): void {
    const dt = (t - lastT) / 1000;
    lastT = t;
    currentSpeed += (targetSpeed - currentSpeed) * Math.min(1, dt * 3);
    rotation += currentSpeed * dt;
    placeItems();
    rafId = requestAnimationFrame(tick);
  }
  if (!reduceMotion) {
    rafId = requestAnimationFrame(tick);
  }

  function reveal(): void {
    if (alwaysRevealed) return;
    stage.classList.add("is-revealed");
    targetSpeed = SLOW_SPEED;
  }
  function unreveal(): void {
    if (alwaysRevealed) return;
    stage.classList.remove("is-revealed");
    targetSpeed = AUTO_SPEED;
  }

  stage.addEventListener("pointerenter", reveal);
  stage.addEventListener("pointerleave", unreveal);
  stage.addEventListener("focusin", reveal);
  stage.addEventListener("focusout", (e) => {
    if (!stage.contains(e.relatedTarget as Node)) unreveal();
  });

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
    rotation = dragStartRotation + (e.clientX - dragStartX) * 0.4;
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

  function openExisting(fileId: string): void {
    if (reduceMotion) {
      window.location.hash = `#/machine?seed=${encodeURIComponent(fileId)}`;
      return;
    }
    cancelAnimationFrame(rafId);
    section.classList.add("is-leaving");
    window.setTimeout(() => {
      window.location.hash = `#/machine?seed=${encodeURIComponent(fileId)}`;
    }, 620);
  }

  function beginFresh(): void {
    if (reduceMotion) {
      window.location.hash = "#/machine?new=1";
      return;
    }
    cancelAnimationFrame(rafId);
    section.classList.add("is-launching");
    window.setTimeout(() => {
      window.location.hash = "#/machine?new=1";
    }, 560);
  }

  items.forEach((item) => {
    item.addEventListener("click", () => openExisting(item.dataset.fileId ?? ""));
  });

  section.querySelector<HTMLButtonElement>("#begin-dream")!.addEventListener("click", beginFresh);

  return () => {
    window.removeEventListener("resize", layout);
    cancelAnimationFrame(rafId);
  };
}
