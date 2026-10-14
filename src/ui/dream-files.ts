import { PLACEHOLDER_ASSETS } from "./placeholder-assets";
import { buildDreamNav } from "./dream-nav";
import { DEFAULT_SEED_TEXT } from "../generation/dream-run";
import { loadGallery, galleryImageUrl } from "./gallery";

type CenterMode = "intro" | "seed";
type Layer = "fore" | "mid" | "back";

interface PoolItem {
  key: string;
  src: string;
  title: string;
  kind: "reference" | "generated";
  runId?: string;
}

/** Stable per-slot geometry, built once per slot and never reassigned —
 * only the image occupying a slot changes over time (see performRotation()).
 * That split is what keeps the composition from visibly "jumping": the
 * orbit math only ever reads these, so swapping a slot's picture doesn't
 * touch its path, size, tilt, or drift. */
interface SlotGeom {
  angleOffset: number;
  radiusFactor: number;
  layer: Layer;
  tilt: number;
  scale: number;
  driftPhase: number;
  driftAmp: number;
  driftSpeed: number;
}

interface Slot {
  el: HTMLButtonElement;
  imgEl: HTMLImageElement;
  labelEl: HTMLElement;
  geom: SlotGeom;
  item: PoolItem | null;
  hovered: boolean;
  focused: boolean;
}

function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function targetVisibleCount(width: number): number {
  if (width >= 1200) return 18; // large desktop: 16-20
  if (width >= 768) return 12; // tablet: 10-14
  return 9; // mobile: 8-10
}

function labelFor(item: PoolItem): string {
  return item.kind === "generated" ? "from a saved dream" : `${item.title} · mood only`;
}

function ariaLabelFor(item: PoolItem): string {
  return item.kind === "generated"
    ? "A scene from one of your saved dreams. Opens the begin-a-dream panel."
    : `Mood reference: ${item.title}. Opens the begin-a-dream panel.`;
}

function buildSlotGeom(index: number, count: number): SlotGeom {
  const step = 360 / count;
  const roll = Math.random();
  const layer: Layer = roll < 0.22 ? "fore" : roll < 0.78 ? "mid" : "back";
  return {
    // A little jitter within each slot's own slice of the circle —
    // "subtly varied elliptical paths," not one perfectly even ring.
    angleOffset: index * step + (Math.random() * step * 0.6 - step * 0.3),
    radiusFactor: 0.7 + Math.random() * 0.35,
    layer,
    tilt: Math.random() * 10 - 5,
    scale: layer === "fore" ? 1.15 + Math.random() * 0.15 : layer === "mid" ? 0.95 + Math.random() * 0.15 : 0.68 + Math.random() * 0.12,
    driftPhase: Math.random() * Math.PI * 2,
    driftAmp: 8 + Math.random() * 14,
    driftSpeed: 0.15 + Math.random() * 0.15,
  };
}

export function renderDreamFiles(root: HTMLElement): () => void {
  const section = document.createElement("section");
  section.className = "view dream-files";
  section.setAttribute("aria-label", "Dream Files");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none)").matches;
  const alwaysRevealed = reduceMotion || isTouch;

  const initialCount = targetVisibleCount(window.innerWidth);

  section.innerHTML = `
    <div class="dream-files__bloom" aria-hidden="true"></div>
    <div class="dream-files__stage" id="stage" tabindex="-1">
      <div class="dream-files__ring-wrap" id="ring-wrap">
        <div class="dream-files__ring" id="ring" role="list" aria-label="Fragments from saved dreams and mood references. Hover or focus this area to reveal the entry point; rotate with arrow keys, drag, scroll, or the buttons beside the collection.">
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

  // One pool: every saved generation from the static manifest, or — only
  // while the manifest is empty — the mood references. The queue is a fresh
  // shuffle per visit, refilled (and reshuffled) once drained, so a full
  // pool is always worked through before anything repeats; with fewer
  // images than cards, cards simply repeat.
  const referencePool: PoolItem[] = PLACEHOLDER_ASSETS.map((a) => ({ key: a.id, src: a.src, title: a.title, kind: "reference" }));
  let pool: PoolItem[] = referencePool;
  let queue: PoolItem[] = [];
  const failedKeys = new Set<string>();
  let poolReady = false;

  function nextPoolItem(excludeKey: string | null): PoolItem | null {
    const drawFrom = (): PoolItem | null => {
      queue = queue.filter((p) => !failedKeys.has(p.key));
      if (queue.length === 0) queue = shuffled(pool.filter((p) => !failedKeys.has(p.key)));
      return queue.pop() ?? null;
    };
    let item = drawFrom();
    if (item && item.key === excludeKey) item = drawFrom();
    return item;
  }

  const slots: Slot[] = [];

  function paintSlotContent(slot: Slot, item: PoolItem): void {
    slot.item = item;
    slot.el.classList.remove("is-empty");
    slot.imgEl.src = item.src;
    slot.labelEl.textContent = labelFor(item);
    slot.el.setAttribute("aria-label", ariaLabelFor(item));
  }

  function createSlot(index: number, count: number, item: PoolItem): Slot {
    const geom = buildSlotGeom(index, count);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dream-files__item";
    button.setAttribute("role", "listitem");
    button.dataset.layer = geom.layer;
    const img = document.createElement("img");
    img.className = "dream-files__item-img";
    img.alt = "";
    img.loading = "lazy";
    // Never a broken-image icon: a card whose file can't load becomes a
    // soft empty card until rotation gives it something else.
    const labelEl = document.createElement("span");
    labelEl.className = "dream-files__item-label";
    button.appendChild(img);
    button.appendChild(labelEl);
    ring.appendChild(button);

    const slot: Slot = { el: button, imgEl: img, labelEl, geom, item: null, hovered: false, focused: false };
    // A card whose image fails is logged (never silently hidden), that
    // image leaves the pool, and the card moves on to another one. Only
    // when nothing loadable is left does it become a soft empty card.
    img.addEventListener("error", () => {
      const failed = slot.item;
      console.warn(`[dream-files] image failed to load: ${failed?.src ?? img.src}`);
      if (failed) failedKeys.add(failed.key);
      const next = nextPoolItem(failed?.key ?? null);
      if (next) {
        paintSlotContent(slot, next);
      } else {
        button.classList.add("is-empty");
        img.removeAttribute("src");
      }
    });
    paintSlotContent(slot, item);

    button.addEventListener("pointerenter", () => {
      slot.hovered = true;
    });
    button.addEventListener("pointerleave", () => {
      slot.hovered = false;
    });
    button.addEventListener("focus", () => {
      slot.focused = true;
    });
    button.addEventListener("blur", () => {
      slot.focused = false;
    });
    button.addEventListener("click", () => {
      reveal();
      centerMode = "seed";
      paintCenter();
    });

    return slot;
  }

  function growSlots(count: number): void {
    if (!poolReady) return;
    while (slots.length < count) {
      const item = nextPoolItem(null);
      if (!item) return; // nothing left to show yet (pool still loading)
      slots.push(createSlot(slots.length, count, item));
    }
  }

  // The manifest is a small static file, so the ring waits for it rather
  // than showing references first and swapping them out moments later.
  const imagesController = new AbortController();
  loadGallery().then((entries) => {
    if (imagesController.signal.aborted) return;
    if (entries === null) {
      // Unreadable is not the same as empty: say so, and don't pretend the
      // collection is empty by swapping in the mood references.
      pool = [];
    } else if (entries.length > 0) {
      pool = entries.map((e) => ({
        key: e.id,
        src: galleryImageUrl(e),
        title: e.caption || "a saved dream",
        kind: "generated" as const,
        runId: e.runId ?? undefined,
      }));
    }
    poolReady = true;
    growSlots(Math.max(initialCount, targetVisibleCount(window.innerWidth)));
  });

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

  let orbitRx = 0;
  let orbitRy = 0;
  // Shared slow sweep every slot's own angleOffset rides on top of — one
  // ambient rotation, not eighteen independent ones, so the whole
  // composition still reads as one collection drifting together.
  let rotation = 0;

  const AUTO_SPEED = 3.2; // deg/sec, normal ambient orbit
  const SLOW_SPEED = 0.55; // deg/sec, while revealed or typing
  let currentSpeed = AUTO_SPEED;
  let targetSpeed = AUTO_SPEED;

  // Declared before the initial layout() call below (which reads lastT
  // via placeItems) — DOM/slots/geometry exist first, then this, then
  // layout() runs, then the rAF loop starts.
  let rafId = 0;
  let lastT = performance.now();

  function placeItems(tSec: number): void {
    for (const slot of slots) {
      const g = slot.geom;
      const angle = g.angleOffset + rotation;
      const rad = (angle * Math.PI) / 180;
      const x = Math.sin(rad) * orbitRx * g.radiusFactor;
      const yBase = -Math.cos(rad) * orbitRy * g.radiusFactor;
      const drift = reduceMotion ? 0 : Math.sin(tSec * g.driftSpeed + g.driftPhase) * g.driftAmp;
      const y = yBase + drift;
      slot.el.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${g.tilt}deg) scale(${g.scale})`;
    }
  }

  function layout(): void {
    const w = ringWrap.clientWidth;
    const h = ringWrap.clientHeight;
    // Keeps the title/input panel's own footprint clear — the floor this
    // inset creates is why per-slot radiusFactor is allowed to dip to
    // 0.7 rather than closer to 0, without any image reaching center.
    orbitRx = w * 0.5 - 90;
    orbitRy = h * 0.5 - 100;
    const wanted = targetVisibleCount(window.innerWidth);
    if (wanted > slots.length) growSlots(wanted); // only grows on resize — shrinking would risk removing a slot mid-interaction
    placeItems(lastT / 1000);
  }

  function currentStep(): number {
    return 360 / Math.max(1, slots.length);
  }
  function rotateBy(delta: number): void {
    rotation += delta;
    placeItems(lastT / 1000);
  }

  layout();
  window.addEventListener("resize", layout);

  function tick(t: number): void {
    const dt = (t - lastT) / 1000;
    lastT = t;
    currentSpeed += (targetSpeed - currentSpeed) * Math.min(1, dt * 3);
    rotation += currentSpeed * dt;
    placeItems(t / 1000);
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

  section.querySelector<HTMLButtonElement>("#rotate-prev")!.addEventListener("click", () => rotateBy(-currentStep()));
  section.querySelector<HTMLButtonElement>("#rotate-next")!.addEventListener("click", () => rotateBy(currentStep()));

  let dragging = false;
  let dragStartX = 0;
  let dragStartRotation = 0;

  ringWrap.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      rotateBy(e.deltaY * 0.15);
    },
    { passive: false },
  );

  ringWrap.addEventListener("pointerdown", (e) => {
    dragging = true;
    dragStartX = e.clientX;
    dragStartRotation = rotation;
    ringWrap.setPointerCapture(e.pointerId);
  });
  ringWrap.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    rotation = dragStartRotation + (e.clientX - dragStartX) * 0.4;
    placeItems(lastT / 1000);
  });
  ringWrap.addEventListener("pointerup", () => {
    dragging = false;
  });
  ringWrap.addEventListener("pointercancel", () => {
    dragging = false;
  });

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "ArrowLeft") {
      rotateBy(-currentStep());
    } else if (e.key === "ArrowRight") {
      rotateBy(currentStep());
    } else if (e.key === "Escape" && centerMode === "seed") {
      centerMode = "intro";
      paintCenter();
    }
  }
  ring.addEventListener("keydown", onKeydown);

  // ---- gradual background rotation ----
  // Replaces at most one slot at a time, always a slot nobody's currently
  // hovering or focusing, always preloaded before it's shown, always
  // crossfaded rather than swapped instantly.
  let rotationTimer = 0;
  function pickRotationCandidate(): Slot | null {
    const eligible = slots.filter((s) => !s.hovered && !s.focused);
    if (eligible.length === 0) return null;
    const background = eligible.filter((s) => s.geom.layer === "back");
    const pool = background.length ? background : eligible;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function performRotation(): void {
    if (document.hidden || centerMode === "seed") return; // paused while backgrounded or while the user is typing
    const slot = pickRotationCandidate();
    if (!slot) return;
    const next = nextPoolItem(slot.item?.key ?? null);
    if (!next || next.key === slot.item?.key) return;
    const preload = new Image();
    preload.onload = () => {
      slot.imgEl.classList.add("is-fading");
      window.setTimeout(() => {
        paintSlotContent(slot, next);
        requestAnimationFrame(() => slot.imgEl.classList.remove("is-fading"));
      }, 280);
    };
    preload.onerror = () => {
      console.warn(`[dream-files] image failed to load: ${next.src}`);
      failedKeys.add(next.key);
    };
    preload.src = next.src;
  }
  function scheduleRotation(): void {
    if (reduceMotion) return;
    const delay = 6500 + Math.random() * 5000;
    rotationTimer = window.setTimeout(() => {
      performRotation();
      scheduleRotation();
    }, delay);
  }
  scheduleRotation();

  function onVisibilityChange(): void {
    if (document.hidden) {
      targetSpeed = 0;
    } else if (stage.classList.contains("is-revealed")) {
      targetSpeed = SLOW_SPEED;
    } else {
      targetSpeed = AUTO_SPEED;
    }
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

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
    document.removeEventListener("visibilitychange", onVisibilityChange);
    cancelAnimationFrame(rafId);
    window.clearTimeout(rotationTimer);
    imagesController.abort();
  };
}
