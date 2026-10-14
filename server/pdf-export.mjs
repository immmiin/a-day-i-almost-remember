import { PDFDocument, rgb, StandardFonts, rectangle, clip, endPath, pushGraphicsState, popGraphicsState } from "pdf-lib";
import { readFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = join(__dirname, "generated");
const PDF_DIR = join(GENERATED_DIR, "zines");
const GALLERY_DIR = join(__dirname, "..", "public", "generations");

// Newer scenes live in public/generations/ (see gallery.mjs); older ones
// are still served from server/generated/ under /images/.
function sceneImagePath(imageUrl) {
  if (imageUrl.startsWith("/generations/")) return join(GALLERY_DIR, imageUrl.replace(/^\/generations\//, ""));
  return join(GENERATED_DIR, imageUrl.replace(/^\/images\//, ""));
}

// Mirrors src/ui/util.ts's shortCaption(): the shared art-direction preamble
// has no period of its own, so the prompt's second "sentence" ("The scene
// includes: ...") is the real scene description, not the first.
function shortCaption(prompt) {
  const parts = (prompt ?? "").split(".");
  return parts[1]?.trim() || parts[0]?.trim() || prompt || "";
}

// Phrases that only ever appear inside an internal generation prompt, never
// in something a person would write as a caption. Earlier app versions
// (and the derive-from-prompt fallback below) could let this kind of text
// reach a printed page — this is a print-time filter, not a data edit, so
// it never touches what's actually stored for a saved page.
const GENERATION_TEXT_MARKERS = [
  "one unmistakable impossible detail",
  "a dreamcore photograph",
  "nearby, among the ordinary objects",
  "soft pastel colors, tactile",
  "deep shadowed pastel tones",
  "the impossible detail treated as completely ordinary",
];

function looksLikeGenerationText(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return GENERATION_TEXT_MARKERS.some((m) => lower.includes(m));
}

/**
 * Mirrors src/ui/util.ts's publicationCaption(): a caption a person actually
 * typed always wins, unless it's detectably internal generation text that
 * reached the field from an earlier version of this app rather than being
 * hand-written. Otherwise falls back to a short derived line from the
 * prompt, itself rejected if it still reads as generation text. A blank
 * result is fine and expected — nothing here invents a caption.
 */
export function publicationCaption(entry, scene) {
  const stored = (entry.caption ?? "").trim();
  if (stored && !looksLikeGenerationText(stored)) return stored;
  const derived = shortCaption(scene.prompt);
  return looksLikeGenerationText(derived) ? "" : derived;
}

// A5 portrait in points (1pt = 1/72in; A5 = 148 x 210mm). A spread canvas is
// simply two of these placed side by side (296 x 210mm) — every content-page
// drawing routine below takes an `xOffset` so the exact same code draws a
// standalone A5 page (offset 0 on a PAGE_W-wide canvas) or either half of a
// spread (offset 0 or PAGE_W on a PAGE_W*2-wide canvas). That's what
// guarantees the two export formats agree on crop, text, and margins —
// there is only one drawing implementation, not two kept in sync by hand.
const PAGE_W = 419.53;
const PAGE_H = 595.28;
const MARGIN = 30; // ~10.6mm — inside the 10-12mm print-safe band asked for
const MIN_PRINT_DPI = 300;
const PAPER_TINT = rgb(0.965, 0.945, 0.925); // the site's paper tone, used behind any "fit" (non-cropped) image

function pxNeededFor(mmSize, dpi = MIN_PRINT_DPI) {
  return Math.round((mmSize / 25.4) * dpi);
}
const MIN_FULLBLEED_PX = { w: pxNeededFor(148), h: pxNeededFor(210) };

// Explicit safety boundary, not just careful math: nothing drawn between
// clipToPage()/unclip() can render outside this exact page's own
// [xOffset, xOffset+PAGE_W] x [0, PAGE_H] rectangle, regardless of any
// image size, wrapped-text length, or coordinate mistake below. Requested
// directly — "use explicit page clipping as a safety boundary."
function clipToPage(page, xOffset) {
  page.pushOperators(pushGraphicsState(), rectangle(xOffset, 0, PAGE_W, PAGE_H), clip(), endPath());
}
function unclip(page) {
  page.pushOperators(popGraphicsState());
}

// Emulates CSS `object-fit: cover` + `object-position: focalX% focalY%`,
// drawn into a PAGE_W-wide slot starting at xOffset on whatever canvas the
// page actually is.
function drawFullBleedFocalAt(page, xOffset, img, focalXPct = 50, focalYPct = 50) {
  const scale = Math.max(PAGE_W / img.width, PAGE_H / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const excessX = Math.max(0, drawW - PAGE_W);
  const excessY = Math.max(0, drawH - PAGE_H);
  const x = xOffset - (focalXPct / 100) * excessX;
  // pdf-lib's y axis runs bottom-up, CSS's runs top-down, hence the flip.
  const y = PAGE_H + (focalYPct / 100) * excessY - drawH;
  page.drawImage(img, { x, y, width: drawW, height: drawH });
}

// Emulates CSS `object-fit: contain`: the whole image is visible, never
// cropped or stretched, letterboxed on a paper-tint background.
function drawFitContainedAt(page, xOffset, img) {
  page.drawRectangle({ x: xOffset, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER_TINT });
  const scale = Math.min(PAGE_W / img.width, PAGE_H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, { x: xOffset + (PAGE_W - w) / 2, y: (PAGE_H - h) / 2, width: w, height: h });
}

async function embedSceneImage(doc, run, sceneIndex) {
  const scene = sceneIndex != null ? run.scenes.find((s) => s.index === sceneIndex) : null;
  if (!scene) return null;
  const imgPath = sceneImagePath(scene.imageUrl);
  const bytes = await readFile(imgPath);
  return doc.embedPng(bytes);
}

// Greedy word-wrap capped at maxLines, with the last line ellipsized if
// text remains — so a long caption or title becomes a short, intentional
// block instead of running past the space actually reserved for it.
function wrapLines(font, text, size, maxWidth, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  let consumed = 0;
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && font.widthOfTextAtSize(test, size) > maxWidth) {
      lines.push(cur);
      consumed += cur.split(/\s+/).length;
      cur = w;
      if (lines.length === maxLines) break;
    } else {
      cur = test;
    }
  }
  if (lines.length < maxLines && cur) {
    lines.push(cur);
    consumed += cur.split(/\s+/).length;
  }
  if (lines.length === maxLines && consumed < words.length) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && font.widthOfTextAtSize(`${last}…`, size) > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

const CAPTION_SIZE = 10;
const CAPTION_LINE_H = 13;
const CAPTION_PAD_Y = 13;
const CAPTION_MAX_LINES = 3;

/**
 * Draws the bottom caption scrim sized to exactly the wrapped text it
 * contains (capped at 3 lines, ellipsized beyond that) instead of a fixed
 * height guessed to fit a short line — a long caption used to overflow the
 * old fixed 74pt band and collide with the page number below it. Returns
 * the band's actual height so the caller can keep the page number clear of
 * it, or 0 if there's no caption to show (a blank caption prints nothing,
 * not an empty scrim).
 */
function drawCaptionBand(page, xOffset, caption, font) {
  if (!caption) return 0;
  const lines = wrapLines(font, caption, CAPTION_SIZE, PAGE_W - MARGIN * 2, CAPTION_MAX_LINES);
  const bandH = CAPTION_PAD_Y * 2 + lines.length * CAPTION_LINE_H;
  page.drawRectangle({ x: xOffset, y: 0, width: PAGE_W, height: bandH, color: rgb(0, 0, 0), opacity: 0.5 });
  let ty = bandH - CAPTION_PAD_Y - CAPTION_SIZE + 2;
  for (const line of lines) {
    page.drawText(line, { x: xOffset + MARGIN, y: ty, size: CAPTION_SIZE, font, color: rgb(1, 1, 1) });
    ty -= CAPTION_LINE_H;
  }
  return bandH;
}

/**
 * Draws one content page's full logic — image fit/fill/crop, caption or
 * text-led layout, page number — onto `page` starting at `xOffset`. Used
 * identically by both the single-page export (xOffset always 0, one page
 * per canvas) and the spread export (xOffset 0 or PAGE_W, two pages per
 * canvas), so "image only" pages, crops, and margins can't drift apart
 * between the two formats. Every draw call here happens inside an explicit
 * clip to this exact page's own bounds (see clipToPage/unclip) — a
 * mistake in this function can make content missing, never make it bleed
 * into the facing page.
 */
async function drawContentPage(doc, page, xOffset, entry, run, fonts, pageNumber) {
  const { sans, sansItalic } = fonts;
  clipToPage(page, xOffset);
  try {
    if (!entry) {
      page.drawRectangle({ x: xOffset, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(1, 1, 1) });
      return null;
    }
    const scene = run.scenes.find((s) => s.index === entry.sceneIndex);
    if (!scene) return null;

    const imgPath = sceneImagePath(scene.imageUrl);
    const bytes = await readFile(imgPath);
    const img = await doc.embedPng(bytes);

    let lowResWarning = null;
    if (img.width < MIN_FULLBLEED_PX.w || img.height < MIN_FULLBLEED_PX.h) {
      lowResWarning = `Page ${pageNumber}: source image is ${img.width}x${img.height}px, below the ~${MIN_FULLBLEED_PX.w}x${MIN_FULLBLEED_PX.h}px a true full-bleed A5 print wants at 300dpi.`;
    }

    // "Image only" means exactly that — no caption, no page number, no
    // metadata of any kind gets drawn on this page. Checked first so
    // nothing below can accidentally add text to it, in either format.
    const imageOnly = entry.layout === "full";
    let bandH = 0;

    if (entry.layout === "text-led") {
      page.drawRectangle({ x: xOffset, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER_TINT });
      const caption = publicationCaption(entry, scene);
      if (caption) {
        const lines = wrapLines(sansItalic, caption, 13, PAGE_W - MARGIN * 2, 3);
        let ty = PAGE_H - 100;
        for (const line of lines) {
          page.drawText(line, { x: xOffset + MARGIN, y: ty, size: 13, font: sansItalic, color: rgb(0.14, 0.1, 0.15) });
          ty -= 18;
        }
      }
      const imgW = PAGE_W - MARGIN * 2;
      const imgH = imgW * (img.height / img.width);
      page.drawImage(img, { x: xOffset + MARGIN, y: MARGIN, width: imgW, height: Math.min(imgH, 260) });
    } else {
      if (entry.imageMode === "fit") {
        drawFitContainedAt(page, xOffset, img);
      } else {
        const fx = typeof entry.focalX === "number" ? entry.focalX : 50;
        const fy = typeof entry.focalY === "number" ? entry.focalY : 50;
        drawFullBleedFocalAt(page, xOffset, img, fx, fy);
      }
      if (entry.layout === "image-caption") {
        bandH = drawCaptionBand(page, xOffset, publicationCaption(entry, scene), sansItalic);
      }
    }

    if (!imageOnly) {
      page.drawText(String(pageNumber), {
        x: xOffset + PAGE_W - MARGIN - 10,
        y: bandH ? bandH + 10 : 12, // stays clear of the caption band, whatever height it ended up
        size: 8,
        font: sans,
        color: rgb(0.4, 0.35, 0.37),
      });
    }
    return lowResWarning;
  } finally {
    unclip(page);
  }
}

// The front and back covers share one typographic lockup (masthead +
// metadata) at the same position/scale on every issue — that repetition,
// not any single cover's imagery, is what makes a stack of these read as
// one ongoing publication rather than unrelated one-off prints. Each text
// cluster sits on a content-sized chip, not a full-width wash, so the
// photograph stays the dominant element. Covers are always drawn on their
// own single A5 canvas in both export formats — never paired into a spread.
async function drawCoverFace(doc, run, issueNumber, fonts) {
  const { serifBold, serif, sans, sansItalic } = fonts;
  const page = doc.addPage([PAGE_W, PAGE_H]);
  clipToPage(page, 0);
  try {
    const cover = run.zine?.cover ?? {};
    const focalX = typeof cover.focalX === "number" ? cover.focalX : 50;
    const focalY = typeof cover.focalY === "number" ? cover.focalY : 38;
    const contrast = cover.contrast === "paper" ? "paper" : "ink";
    const showText = cover.showText !== false;
    const sceneIndex = cover.sceneIndex ?? run.zine?.pages?.find((p) => p)?.sceneIndex ?? run.scenes[0]?.index ?? null;

    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.14, 0.1, 0.15) });
    const img = await embedSceneImage(doc, run, sceneIndex);
    if (img) drawFullBleedFocalAt(page, 0, img, focalX, focalY);
    if (!showText) return;

    const chipColor = contrast === "paper" ? rgb(0.945, 0.914, 0.863) : rgb(0.14, 0.1, 0.15);
    const textColor = contrast === "paper" ? rgb(0.14, 0.1, 0.15) : rgb(0.96, 0.93, 0.87);
    const mutedColor = contrast === "paper" ? rgb(0.35, 0.3, 0.32) : rgb(0.78, 0.74, 0.7);
    const chipPad = 6;
    const chip = (x, y, w, h) => page.drawRectangle({ x: x - chipPad, y: y - 4, width: w + chipPad * 2, height: h + 8, color: chipColor, opacity: 0.66 });

    const masthead = "A Day I Almost Remember";
    const mastSize = 22;
    const metaSize = 7.5;
    const meta = `ISSUE ${issueNumber} · ${new Date(run.createdAt).toLocaleDateString()}`;
    const mastW = Math.min(serifBold.widthOfTextAtSize(masthead, mastSize), PAGE_W - MARGIN * 2);
    const metaW = sans.widthOfTextAtSize(meta, metaSize);
    const mastTop = PAGE_H - MARGIN;
    chip(MARGIN, mastTop - mastSize - metaSize - 14, Math.max(mastW, metaW), mastSize + metaSize + 10);
    page.drawText(masthead, { x: MARGIN, y: mastTop - mastSize, size: mastSize, font: serifBold, color: textColor, maxWidth: PAGE_W - MARGIN * 2 });
    page.drawText(meta, { x: MARGIN, y: mastTop - mastSize - metaSize - 8, size: metaSize, font: sans, color: mutedColor });

    const titleSize = 13.5;
    const title = (cover.title || run.zine?.title || run.seedText || "Untitled issue").trim();
    const titleLines = wrapLines(serif, title, titleSize, PAGE_W - MARGIN * 2 - chipPad * 2, 2);
    const posterLine = (cover.posterLine || "").trim();
    const lineH = titleSize + 5;
    let blockH = titleLines.length * lineH;
    if (posterLine) blockH += 13;
    const blockW = Math.max(
      ...titleLines.map((l) => serif.widthOfTextAtSize(l, titleSize)),
      posterLine ? sansItalic.widthOfTextAtSize(posterLine, 9) : 0,
    );
    chip(MARGIN, MARGIN, Math.min(blockW, PAGE_W - MARGIN * 2 - chipPad * 2), blockH);
    let ty = MARGIN + blockH - titleSize + 2;
    for (const line of titleLines) {
      page.drawText(line, { x: MARGIN, y: ty, size: titleSize, font: serif, color: textColor });
      ty -= lineH;
    }
    if (posterLine) {
      page.drawText(posterLine, { x: MARGIN, y: ty + 4, size: 9, font: sansItalic, color: mutedColor, maxWidth: PAGE_W - MARGIN * 2 });
    }
  } finally {
    unclip(page);
  }
}

function drawBackCoverFace(doc, run, issueNumber, fonts, pages) {
  const { serifBold, sans } = fonts;
  const page = doc.addPage([PAGE_W, PAGE_H]);
  clipToPage(page, 0);
  try {
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.14, 0.1, 0.15) });
    const backShowText = (run.zine?.cover?.backShowText ?? true) !== false;
    if (backShowText) {
      page.drawText("A Day I Almost Remember", {
        x: MARGIN,
        y: PAGE_H / 2 + 30,
        size: 13,
        font: serifBold,
        color: rgb(0.96, 0.93, 0.87),
      });
      page.drawText(`issue ${issueNumber} · a procedural memory`, {
        x: MARGIN,
        y: PAGE_H / 2 + 8,
        size: 8,
        font: sans,
        color: rgb(0.8, 0.76, 0.72),
      });
      page.drawText(`${run.scenes.length} scenes generated locally, ${pages.filter(Boolean).length} selected for this issue.`, {
        x: MARGIN,
        y: PAGE_H / 2 - 16,
        size: 8,
        font: sans,
        color: rgb(0.8, 0.76, 0.72),
        maxWidth: PAGE_W - MARGIN * 2,
      });
    }
  } finally {
    unclip(page);
  }
}

async function embedFonts(doc) {
  // One display serif (masthead/titles) + one supporting sans (metadata/
  // captions) — an earlier version used Helvetica-Oblique as its "serif",
  // which is actually sans-serif italic and not a serif at all.
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
  return { serifBold, serif, sans, sansItalic };
}

async function savePdf(doc, run, suffix) {
  await mkdir(PDF_DIR, { recursive: true });
  const pdfBytes = await doc.save();
  const filename = `${run.id}${suffix}.pdf`;
  const filePath = join(PDF_DIR, filename);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, pdfBytes);
  return `/pdfs/${filename}`;
}

/** The 16-page single-A5-page-per-canvas export, for printing. */
export async function exportRunToPdf(run, issueNumber = 1) {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  const pages = run.zine?.pages ?? [];
  const lowResWarnings = [];

  await drawCoverFace(doc, run, issueNumber, fonts);

  for (let i = 0; i < 14; i++) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const warning = await drawContentPage(doc, page, 0, pages[i], run, fonts, i + 2);
    if (warning) lowResWarnings.push(warning);
  }

  drawBackCoverFace(doc, run, issueNumber, fonts, pages);

  const pdfUrl = await savePdf(doc, run, "");
  return { pdfUrl, pageCount: 16, lowResWarnings };
}

/**
 * The 9-canvas reading-spread export, for on-screen viewing: the front and
 * back covers stand alone at A5, and each pair of facing interior pages
 * (2-3, 4-5, ... 14-15) is drawn onto one 296x210mm canvas — two physical
 * A5 pages placed side by side, not just a PDF viewer's two-page display
 * hint. Reuses drawContentPage() exactly, so crop, text visibility, and
 * margins can never drift from the single-page export.
 */
export async function exportRunToSpreadPdf(run, issueNumber = 1) {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  const pages = run.zine?.pages ?? [];
  const lowResWarnings = [];

  await drawCoverFace(doc, run, issueNumber, fonts);

  for (let pairStart = 0; pairStart < 14; pairStart += 2) {
    const page = doc.addPage([PAGE_W * 2, PAGE_H]);
    const wLeft = await drawContentPage(doc, page, 0, pages[pairStart], run, fonts, pairStart + 2);
    const wRight = await drawContentPage(doc, page, PAGE_W, pages[pairStart + 1], run, fonts, pairStart + 3);
    if (wLeft) lowResWarnings.push(wLeft);
    if (wRight) lowResWarnings.push(wRight);
  }

  drawBackCoverFace(doc, run, issueNumber, fonts, pages);

  const pdfUrl = await savePdf(doc, run, "-spreads");
  return { pdfUrl, pageCount: 9, lowResWarnings };
}
