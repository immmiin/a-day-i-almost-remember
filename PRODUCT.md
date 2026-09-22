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

- **Generation mechanism: paid image-generation API, provider/budget not yet chosen.** The earlier "no paid APIs" constraint is lifted; the user is willing to connect a paid provider but has approved neither a specific one nor a spending amount. No paid API call happens without that confirmation. Secrets live server-side in environment variables, never in client code or chat.
- **A backend is now required** (this was previously a pure static client app) to hold the API key, proxy generation requests, and store generated image files — large image payloads must not go in `localStorage`; only small metadata/state does.
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
- No generated images or zine content exist yet; the current shipped build is the earlier text-only procedural version (see DESIGN.md), kept as a legacy artifact per the constraints above.

## Product Principles

1. Images are the product; text is caption and process documentation, not the primary reading experience.
2. The constraint is still the content — passing only 2–3 fragments (as isolated crops, not the whole prior image or story) forward is what produces recognizable-but-surreal drift; leaking more breaks the mechanic.
3. Building precedes publishing: the tool runs and generates real outputs before any zine page is laid out; the 16 published pages are curated from real generations, never prewritten and disguised as generated.
4. Money is spent deliberately: every paid generation is a user-initiated action with visible cost-relevant states (loading/fail/retry/cancel); nothing regenerates automatically, including during automated testing.
5. Storage claims are honest: "on this device" and "shared/cloud" are never conflated, and a flagged low-resolution image is never claimed print-ready.
