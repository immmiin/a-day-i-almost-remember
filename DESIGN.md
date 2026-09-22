# Design

<!-- impeccable:design-schema 1 -->

## Visual World

Three influences, each assigned to one surface rather than blended everywhere:

1. **Experimental art-book typography and composition** — owns the entry screen. Oversized, asymmetrically staggered title over warm ivory and near-black ink, generous unclaimed space.
2. **Dreamlike cinematic atmosphere** — owns the generation experience. Background and ink shift across seven hand-tuned palettes from pale dawn to deep charcoal night as the day progresses; restrained SVG-noise grain; blur/scale entrance transitions.
3. **Tactile memory archive** — owns the Dream Archive. Index-card register: hairline rules, mono timestamps, italic editorial excerpts, expandable disclosure of what each scene inherited, distorted, forgot, and passed on.

Same typography and the same nav chrome anchor all three so the experience reads as one product, not three skins.

## Typography

Three faces, each carrying one role, chosen to avoid the training-data-default serif/grotesk pairings (Fraunces, Playfair, Instrument Serif, Space Grotesk, Inter-as-display, etc.):

- **Display — Antic Didone.** High-contrast Didone, used only for the entry title and the "day is over" heading. Self-hosted, `public/fonts/antic-didone-400.woff2`.
- **Body/UI — Schibsted Grotesk.** All prose, buttons, and archive card text. Self-hosted, `public/fonts/schibsted-grotesk-{normal,italic}.woff2`.
- **Mono/label — Fragment Mono.** Timestamps, scene counters, fragment chips, colophon lines, archive metadata — the "lab notebook" register. Self-hosted, `public/fonts/fragment-mono-{400,400-italic}.woff2`.

Defined as CSS custom properties `--font-display` / `--font-body` / `--font-mono` in `src/styles/tokens.css`.

## Color

Three independent palettes, not one theme stretched thin:

- **Entry (`--entry-*` in tokens.css):** fixed warm ivory `#f3eee2` ground, near-black `#17140f` ink — the art-book register, doesn't shift with time-of-day.
- **Generation (`src/ui/time-theme.ts`):** seven full bg/ink pairs, one per `TimeOfDay`, applied live via inline custom properties (`applyTheme()`). Light-ground hours (early-morning → afternoon) use dark ink; dusk onward flips to light ink on a dark ground. Every accent/background pairing is verified ≥4.5:1 (the two failure cases found during build — afternoon's accent chips and dusk's — were corrected in place; see the contrast note inline in `time-theme.ts`).
- **Archive (`--archive-*` in tokens.css):** fixed warm paper `#efe8d8` / card `#f8f4ea`, near-black ink, single terracotta accent `#7a3b2e` — doesn't shift with time-of-day either, since it's reviewing already-generated material, not living inside the day.

Semantic accents inside a generation scene — remember (amber), forget (muted, strikethrough), distort (rust/red) — are computed per theme (`LIGHT_ACCENTS` / `DARK_ACCENTS` in `time-theme.ts`), not fixed hex values, specifically so they clear contrast on both light and dark grounds.

## Motion

- Scene entrance: prose fades/rises/unblurs (640ms, `--ease-out`); mechanics chips stagger in via `gen-chip-in`.
- Forgotten fragments briefly dip in opacity then settle back to full opacity with strikethrough + muted color as the lasting signal — de-emphasis is carried by hue and strikethrough, never by leaving text under contrast at rest.
- Distortion's "after" value un-blurs in on a 200ms delay, the one moment given deliberate emphasis.
- Background/ink cross-fade over 900ms (`--ease-in-out`) as the hour changes.
- `skip transitions` (user toggle, defaults to checked under `prefers-reduced-motion: reduce`) sets `[data-motion="off"]`, which kills all entrance animation outright — independent of the OS-level reduced-motion handling in `base.css`.

## Components

- `.entry__cta` / `.gen__continue` / `.archive__btn` — one button language: 1px border in `currentColor`, invert fill on hover, `scale(0.97)` on `:active`. No filled buttons anywhere; the border-only treatment is the product's only button.
- `.gen__chip` — pill-shaped fragment tags, one modifier per mechanic (`--remember`, `--forget`, `--carry`).
- `.archive__card` — 3px top rule + 1px full border, mono metadata head, italic excerpt, native `<details>` disclosure for the mechanical breakdown (accessible for free, no custom JS toggle).

## Layout

- Entry: 12-column asymmetric grid, title top-left spanning ~10 columns, concept/CTA block bottom-right, collapses to a single stacked column under 720px.
- Generation: `auto auto 1fr auto` row grid (nav, header/progress, centered scene, footer) so the scene always centers in the remaining viewport regardless of chrome height.
- Archive: `auto-fill minmax(300px, 1fr)` card grid per run, one column on narrow viewports.

## Known constraints carried from PRODUCT.md

- No paid AI API — all prose is procedurally assembled from authored fragment libraries and transformation tables (`src/generation/`), never an LLM call.
- Generation logic never receives more than a scene's passed-forward fragments plus time-of-day metadata (enforced by `generateScene()`'s parameter shape, not convention) — the REMEMBER/FORGET boundary is structural.
