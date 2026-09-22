# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated, revised for Stage 1: Vite + TypeScript frontend (kept, no UI framework) plus a minimal Node backend, newly required to hold the image-generation API key server-side, proxy generation calls, and serve/store generated image files from local disk — none of which can live in a static client app anymore. Exact backend shape (a small Express/Fastify server vs. Vite's own dev middleware for local dev) is a Stage 2 implementation detail, not re-litigated here. Publication/metadata state moves off `localStorage` (images are too large) to local files; `localStorage` at most keeps small UI state.

## Users

1. **The designer/author (primary):** runs image generations, curates results, edits them into a real 16-page printed zine for a design assignment, and uses the finished site as a portfolio piece.
2. **Site visitors:** generate their own dream days as an image-led interactive experience and browse completed zine issues in the Dream Archive.

## Product Purpose

An Exquisite Corpse–based **image-led** dream-generation and publishing tool. The full journey: enter the Dream Files collection → generate a surreal day as a sequence of AI-generated photographic images → edit the actual outputs into a 16-page zine in a real publication editor → save the finished issue in the Dream Archive. Images are the primary content; text is captions, process notes, and an expandable "Memory trace" of what each scene inherited/distorted/forgot — not the product itself.

## Positioning

Two mechanisms combine, and neither is optional:

1. **The memory-relay rule:** each new scene's generation request receives only 2–3 fragments (as crops/isolated visual fragments, not the whole prior image) from the immediately preceding scene, plus minimal time/progression metadata and a consistent art-direction instruction — never the full story or archive. Exactly one inherited fragment is meaningfully transformed while staying recognizable. The protagonist/scene accepts every change as everyday reality.
2. **The publishing constraint:** the tool must actually be built and run before any zine content exists — the assignment is to edit real generated outputs into a printed issue, not to design a zine and backfill fake "generated" images into it. Generated-scene count and the 16 published pages are explicitly different numbers; images may recur, be cropped, or span pages in the final edit.

## Operating Context

- The author runs image generations (now via a paid API, budget to be confirmed), builds a Dream Archive of raw runs, then moves into a dedicated Zine Studio editor to lay out, crop, and caption a real 16-page issue, and exports a print PDF.
- The same build runs live for public visitors as a self-serve generator + finished-issue reader; visitor-triggered generation costs real money per image, so retries and regeneration are user-controlled, never automatic.
- Print target: proposed A5 (148×210mm) saddle-stitched booklet, 4 sheets of A4 — see Stage 1 plan for the reasoning; not yet confirmed with the user.
- No deploy target or timeline confirmed yet.

## Capabilities and Constraints

- **Generation mechanism: local, on-device image generation — no paid API. Working, confirmed end to end.** Draw Things (native Mac app, installed directly from static.drawthings.ai, not the App Store) runs FLUX.1 Kontext [dev] (Q8) locally, API server on `localhost:7860`. A small Node backend at `server/index.mjs` (`localhost:8787`) proxies requests, saves PNGs to `server/generated/`, and serves them back. Verified with a real two-scene run: scene 2's request carried only 2 named text fragments plus a distortion note — never scene 1's image or full prompt — and the resulting images were visibly connected (a floral armchair recurs) yet materially distinct (the inherited lamp is now dripping ice), proving the REMEMBER/FORGET/DISTORT restriction holds through a real generation, not just the procedural text engine. Default interactive size is 768×768 at 12 steps (~2–3 min/image on the user's M3 Max once Draw Things is warm); first-request-after-idle cold starts and any request queued behind an abandoned one can take much longer — the frontend timeout is set to 6 minutes to accommodate this honestly rather than erroring prematurely.
- **A backend is required and now exists** (`server/index.mjs`) — queues requests to Draw Things, saves generated image files to disk, serves them back. No API key to protect since generation is local, but still no large image payloads in `localStorage`, only small metadata/state.
- **Generation provider stays modular:** the backend's generation interface should not assume "local" forever — swapping in a hosted provider later must not require rebuilding the frontend.
- **Storage honesty:** the UI must clearly distinguish "saved on this device" from any shared/cloud archive, and must never imply cloud storage or public access unless actually implemented.
- **No silent failure:** every generation call has visible loading, failure, retry, and cancellation states. A failed or placeholder generation is never presented as a successful one, and unrelated stock/fallback images never silently substitute for a failed generation.
- **Full provenance still required:** every generated scene and the fragments passed between scenes are stored for editing and for an expandable "Memory trace" process view, kept separate from the restricted input the next generation call actually receives.
- **The 16-page zine is a real, exportable publication:** a page-overview + two-page-spread editor, real image selection/crop/position/caption controls, draft save/resume, and a genuine print-ready PDF export (correct page count, dimensions, margins, resolution) — reading-order PDF and any printer-imposed/booklet layout are distinct, separately labeled outputs. Low-resolution source images are flagged at export time rather than passed off as print-ready.
- **Legacy data:** the existing text-only procedural runs (pre-image-pipeline) are preserved as read-only legacy drafts, not presented as completed magazines.

## Evidence on Hand

- 14 reference images in `references/` (screenshots of Instagram posts, themselves AI-generated fashion/surreal photography) establishing the "photographed dreams" register: vintage floral-upholstered interiors, direct-flash-lit portraiture mixed with soft daylight, calm acceptance of impossible objects (a clock-face worn as a headpiece, an iron pressing a snowman on a floral tablecloth, dark swans swimming through a flooded forest of bare trunks, a heart-windowed inflatable cottage in a garden). These are mood/direction references, not compositions to reproduce.
- Two directly-inspected live interaction references (see Stage 1 plan for what was actually observed via Playwright vs. only described by hoverstat.es):
  - **essesi.com:** opening a project collapses every other grid thumbnail into a small marker that forms a faint background texture behind the opened content, rather than navigating away from the grid.
  - **annaley.de:** portfolio thumbnails sit in a circular ring; scrolling spins the whole ring (title included) around a center point, each thumbnail also rotating individually, looping continuously.
- A handful of real locally-generated test images exist in `server/generated/` (gitignored, not committed) proving the pipeline; no curated Dream Archive or zine content exists yet — that's the next stage. The shipped, routed build is the new image-led four-screen direction; the earlier text-only procedural engine (see DESIGN.md) is preserved on disk as the future Drafts source, unrouted.

## Product Principles

1. Images are the product; text is caption and process documentation, not the primary reading experience.
2. The constraint is still the content — passing only 2–3 fragments (as isolated crops, not the whole prior image or story) forward is what produces recognizable-but-surreal drift; leaking more breaks the mechanic.
3. Building precedes publishing: the tool runs and generates real outputs before any zine page is laid out; the 16 published pages are curated from real generations, never prewritten and disguised as generated.
4. Money is spent deliberately: every paid generation is a user-initiated action with visible cost-relevant states (loading/fail/retry/cancel); nothing regenerates automatically, including during automated testing.
5. Storage claims are honest: "on this device" and "shared/cloud" are never conflated, and a flagged low-resolution image is never claimed print-ready.
