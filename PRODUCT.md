# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vite + TypeScript, no UI framework. The generation engine (fragment libraries, transformation tables, scene assembly) benefits from typed data structures; the site has few distinct views (generator flow, Dream Archive) so a heavy framework isn't earning its cost. Ships as a static site — no backend needed since generation is entirely client-side and the archive can persist via `localStorage` plus an export path for zine curation.

## Users

Two audiences:

1. **The designer/author (primary, near-term):** runs generations, builds up the Dream Archive, and selects/edits outputs into a printed 16-page zine for a design assignment.
2. **Site visitors:** trigger their own REMEMBER→FORGET→DISTORT→PASS FORWARD generation runs and explore the archive, experiencing the site as an immersive, visually polished portfolio piece — not just a viewer of the author's curated output.

## Product Purpose

An Exquisite Corpse–based generative art tool. It procedurally generates an ordinary day, morning to night, that gradually becomes surreal through incomplete memory relay between scenes. It serves two purposes at once: a generative source for a printed zine, and a standalone interactive portfolio experience.

## Positioning

The specific mechanism is the differentiator, not "a surreal text generator" in general: each new scene inherits only 2–3 fragments from the immediately preceding scene, plus minimal time-of-day information — the rest of the prior scene is deliberately withheld. Exactly one inherited fragment mutates in role, scale, material, or meaning. The protagonist accepts every change as everyday reality. There is no story written in advance; the story is discovered by running the tool.

## Operating Context

- The author runs the tool to generate many scenes/days, then selects and edits a subset into a printed 16-page zine for a design assignment.
- The same build also runs live for public site visitors as a self-serve generator + archive browser.
- No deploy target or timeline confirmed yet.

## Capabilities and Constraints

- **Generation mechanism: procedural / rule-based, not live AI.** Authored fragment libraries (objects, settings, sensations, grouped by time-of-day and role) plus transformation tables that mutate one inherited fragment's role/scale/material/meaning; scenes assemble from templates. Runs entirely client-side.
- **Explicit budget constraint:** no paid AI API. Budget covers Claude Pro only, which does not include API credits. Live AI generation (an LLM call at runtime, requiring a paid API key and a backend to hold it) is out of scope for now.
- Architecture should stay modular enough that a live-AI generation mode could be added later if API budget becomes available — noted as a possible future path, not a current requirement.
- No fixed pre-written story or content exists or should be fabricated; the tool must be built and run to discover the story.
- Each generation run's scenes and the fragments passed between them must be saved to a **Dream Archive** with full provenance, since zine curation happens after the fact from archived runs.
- Visitors generate their own runs live on the site, in addition to whatever archive exists.

## Evidence on Hand

None. Starting from nothing — no existing text, images, fragment content, or prior generated scenes. All fragment libraries, transformation tables, and visual design are to be created.

## Product Principles

1. The constraint is the content — inheriting only 2–3 fragments (not the full prior scene) is what produces surreal drift; leaking more information through breaks the mechanic.
2. Distortion is gradual and singular per scene, not random noise: one fragment mutates at a time, and the protagonist's calm acceptance is what sells the ordinary-to-surreal slide.
3. The generation engine is infrastructure first — visual polish, the archive, and zine curation are downstream of a working, replayable generator.
4. No paid runtime dependencies — every generation must run free and client-side.
5. Every run is archive-worthy: the Dream Archive must capture full provenance (each scene plus the exact fragments passed forward), since curation for the zine happens after the fact.
