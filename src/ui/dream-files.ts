import { PLACEHOLDER_ASSETS } from "./placeholder-assets";
import { buildDreamNav } from "./dream-nav";
import { escapeHtml } from "./util";
import { DEFAULT_SEED_TEXT } from "../generation/dream-run";

/** Small deterministic per-item variety: fixed tilt, scale, and depth — not
 * randomized per render, so the composition doesn't jump between reloads. */
const ITEM_TILT = [-4, 3, -2, 5, -3, 2, -5, 4];
const ITEM_SCALE = [1.08, 0.92, 1.15, 0.96, 1.04, 0.88, 1.1, 0.98];

type CenterMode = "intro" | "seed";

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
        <div class="dream-files__ring" id="ring" role="list" aria-label="Dream files, mood references only. Hover or focus this area to reveal the entry point; rotate with arrow keys, drag, scroll, or the buttons beside the collection.">
          ${PLACEHOLDER_ASSETS.map(
            (a, i) => `
            <button type="button" class="dream-files__item" role="listitem" data-index="${i}" style="--tilt:${ITEM_TILT[i % ITEM_TILT.length]}deg;--scale:${ITEM_SCALE[i % ITEM_SCALE.length]}" aria-label="Mood reference: ${escapeHtml(a.title)}. Opens the begin-a-dream panel.">
              <img class="dream-files__item-img" src="${a.src}" alt="" loading="lazy" />
              <span class="dream-files__item-label">${escapeHtml(a.title)} · mood only</span>
            </button>`,
          ).join("")}
        </div>
        <button type="button" class="dream-files__rotate dream-files__rotate--prev" id="rotate-prev" aria-label="Rotate dream files backward">‹</button>
        <button type="button" class="dream-files__rotate dream-files__rotate--next" id="rotate-next" aria-label="Rotate dream files forward">›</button>
      </div>
      <div class="dream-files__center" id="center"></div>
    </div>
    <p class="dream-files__hint">move the pointer here, or press tab, to open the collection · scroll, drag, or the arrows to look around</p>
  `;

  root.appendChild(buildDreamNav("files"));
  root.appendChild(section);

  const stage = section.querySelector<HTMLElement>("#stage")!;
  const ringWrap = section.querySelector<HTMLElement>("#ring-wrap")!;
  const ring = section.querySelector<HTMLElement>("#ring")!;
  const center = section.querySelector<HTMLElement>("#center")!;
  const items = Array.from(section.querySelectorAll<HTMLButtonElement>(".dream-files__item"));

  const alwaysRevealed = reduceMotion || isTouch;

  let centerMode: CenterMode = "intro";

  function paintCenter(): void {
    if (centerMode === "intro") {
      center.innerHTML = `
        <h1 class="dream-files__title">A Day I Almost<br />Remember</h1>
        <button type="button" class="dream-files__cta" id="begin-dream">Begin a dream →</button>
      `;
      center.querySelector<HTMLButtonElement>("#begin-dream")!.addEventListener("click", () => {
        centerMode = "seed";
        paintCenter();
      });
      return;
    }
    center.innerHTML = `
      <form class="dream-files__seed-form" id="seed-form">
        <p class="dream-files__seed-prompt">What is one thing you almost remember from this day?</p>
        <textarea class="dream-files__seed-input" id="seed-input" rows="3" maxlength="200"
          placeholder="a half-open window, the smell of toast, a voice I couldn't place…" autofocus></textarea>
        <div class="dream-files__seed-actions">
          <button type="submit" class="dream-files__cta dream-files__cta--small" id="seed-submit">Generate my day →</button>
          <button type="button" class="dream-files__seed-skip" id="seed-skip">Skip and let the day begin</button>
        </div>
      </form>
    `;
    const form = center.querySelector<HTMLFormElement>("#seed-form")!;
    const input = center.querySelector<HTMLTextAreaElement>("#seed-input")!;
    input.focus();
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      beginFresh(input.value.trim() || DEFAULT_SEED_TEXT);
    });
    // A <textarea> doesn't submit its form on Enter by default (that's
    // input-only) — wire it explicitly so Enter submits and Shift+Enter
    // still inserts a line break as usual.
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    center.querySelector<HTMLButtonElement>("#seed-skip")!.addEventListener("click", () => {
      beginFresh(DEFAULT_SEED_TEXT);
    });
  }
  paintCenter();
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
    if (centerMode === "seed") return; // don't hide the form the user is typing into
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
    } else if (e.key === "Escape" && centerMode === "seed") {
      centerMode = "intro";
      paintCenter();
    }
  }
  ring.addEventListener("keydown", onKeydown);

  items.forEach((item) => {
    item.addEventListener("click", () => {
      reveal();
      centerMode = "seed";
      paintCenter();
    });
  });

  function beginFresh(seedText: string): void {
    if (reduceMotion) {
      window.location.hash = `#/machine?new=1&seed=${encodeURIComponent(seedText)}`;
      return;
    }
    cancelAnimationFrame(rafId);
    section.classList.add("is-launching");
    window.setTimeout(() => {
      window.location.hash = `#/machine?new=1&seed=${encodeURIComponent(seedText)}`;
    }, 560);
  }

  return () => {
    window.removeEventListener("resize", layout);
    cancelAnimationFrame(rafId);
  };
}
