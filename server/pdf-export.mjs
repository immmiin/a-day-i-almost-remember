import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = join(__dirname, "generated");
const PDF_DIR = join(GENERATED_DIR, "zines");

// Mirrors src/ui/util.ts's shortCaption(): the shared art-direction preamble
// has no period of its own, so the prompt's second "sentence" ("The scene
// includes: ...") is the real scene description, not the first.
function shortCaption(prompt) {
  const parts = (prompt ?? "").split(".");
  return parts[1]?.trim() || parts[0]?.trim() || prompt || "";
}

// A5 portrait in points (1pt = 1/72in; A5 = 148 x 210mm).
const PAGE_W = 419.53;
const PAGE_H = 595.28;
const MARGIN = 30; // ~10.6mm — inside the 10-12mm print-safe band asked for
const MIN_PRINT_DPI = 300;
const PAPER_TINT = rgb(0.965, 0.945, 0.925); // the site's paper tone, used behind any "fit" (non-cropped) image

function pxNeededFor(mmSize, dpi = MIN_PRINT_DPI) {
  return Math.round((mmSize / 25.4) * dpi);
}
const MIN_FULLBLEED_PX = { w: pxNeededFor(148), h: pxNeededFor(210) };

// Emulates CSS `object-fit: cover` + `object-position: focalX% focalY%`:
// scales the image to cover the page, then shifts it so the chosen focal
// point (0-100 on each axis, CSS convention — 0,0 is top-left) stays inside
// the crop window instead of always cropping symmetrically from center.
function drawFullBleedFocal(page, img, focalXPct = 50, focalYPct = 50) {
  const scale = Math.max(PAGE_W / img.width, PAGE_H / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const excessX = Math.max(0, drawW - PAGE_W);
  const excessY = Math.max(0, drawH - PAGE_H);
  const x = -(focalXPct / 100) * excessX;
  // pdf-lib's y axis runs bottom-up, CSS's runs top-down, hence the flip.
  const y = PAGE_H + (focalYPct / 100) * excessY - drawH;
  page.drawImage(img, { x, y, width: drawW, height: drawH });
}

// Emulates CSS `object-fit: contain`: the whole image is visible, never
// cropped, letterboxed on a paper-tint background instead of stretched.
function drawFitContained(page, img) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER_TINT });
  const scale = Math.min(PAGE_W / img.width, PAGE_H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, { x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2, width: w, height: h });
}

async function embedSceneImage(doc, run, sceneIndex) {
  const scene = sceneIndex != null ? run.scenes.find((s) => s.index === sceneIndex) : null;
  if (!scene) return null;
  const imgPath = join(GENERATED_DIR, scene.imageUrl.replace(/^\/images\//, ""));
  const bytes = await readFile(imgPath);
  return doc.embedPng(bytes);
}

// Greedy word-wrap capped at maxLines, with the last line ellipsized if
// text remains — so a long issue title becomes a short, intentional two
// lines instead of an automatic three-plus-line block.
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

// The front and back covers share one typographic lockup (masthead +
// metadata) at the same position/scale on every issue — that repetition,
// not any single cover's imagery, is what makes a stack of these read as
// one ongoing publication rather than unrelated one-off prints. Each text
// cluster sits on a content-sized chip, not a full-width wash, so the
// photograph stays the dominant element.
async function drawCoverFace(doc, run, issueNumber, fonts) {
  const { serifBold, serif, sans, sansItalic } = fonts;
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const cover = run.zine?.cover ?? {};
  const focalX = typeof cover.focalX === "number" ? cover.focalX : 50;
  const focalY = typeof cover.focalY === "number" ? cover.focalY : 38;
  const contrast = cover.contrast === "paper" ? "paper" : "ink";
  const showText = cover.showText !== false;
  const sceneIndex = cover.sceneIndex ?? run.zine?.pages?.[0]?.sceneIndex ?? run.scenes[0]?.index ?? null;

  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.14, 0.1, 0.15) });
  const img = await embedSceneImage(doc, run, sceneIndex);
  if (img) drawFullBleedFocal(page, img, focalX, focalY);
  if (!showText) return;

  const chipColor = contrast === "paper" ? rgb(0.945, 0.914, 0.863) : rgb(0.14, 0.1, 0.15);
  const textColor = contrast === "paper" ? rgb(0.14, 0.1, 0.15) : rgb(0.96, 0.93, 0.87);
  const mutedColor = contrast === "paper" ? rgb(0.35, 0.3, 0.32) : rgb(0.78, 0.74, 0.7);
  const chipPad = 6;
  const chip = (x, y, w, h) => page.drawRectangle({ x: x - chipPad, y: y - 4, width: w + chipPad * 2, height: h + 8, color: chipColor, opacity: 0.66 });

  // Masthead cluster (dominant) — top-left, own chip.
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

  // Title cluster (noticeably smaller than the masthead) — bottom-left, own chip.
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
}

export async function exportRunToPdf(run, issueNumber = 1) {
  await mkdir(PDF_DIR, { recursive: true });
  const doc = await PDFDocument.create();
  // One display serif (masthead/titles) + one supporting sans (metadata/
  // captions) — the earlier version used Helvetica-Oblique as its "serif",
  // which is actually sans-serif italic and not a serif at all.
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fonts = { serifBold, serif, sans, sansItalic };

  const pages = run.zine?.pages ?? [];
  const lowResWarnings = [];

  // Page 1: front cover
  await drawCoverFace(doc, run, issueNumber, fonts);

  // Pages 2-15: up to 14 content pages, in the order the user arranged them
  for (let i = 0; i < 14; i++) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const entry = pages[i];
    if (!entry) {
      page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(1, 1, 1) });
      continue;
    }
    const scene = run.scenes.find((s) => s.index === entry.sceneIndex);
    if (!scene) continue;

    const imgPath = join(GENERATED_DIR, scene.imageUrl.replace(/^\/images\//, ""));
    const bytes = await readFile(imgPath);
    const img = await doc.embedPng(bytes);

    if (img.width < MIN_FULLBLEED_PX.w || img.height < MIN_FULLBLEED_PX.h) {
      lowResWarnings.push(
        `Page ${i + 2}: source image is ${img.width}x${img.height}px, below the ~${MIN_FULLBLEED_PX.w}x${MIN_FULLBLEED_PX.h}px a true full-bleed A5 print wants at 300dpi.`,
      );
    }

    // "Image only" means exactly that — no caption, no page number, no
    // metadata of any kind gets drawn on this page. Checked first so
    // nothing below can accidentally add text to it.
    const imageOnly = entry.layout === "full";

    if (entry.layout === "text-led") {
      page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER_TINT });
      const caption = entry.caption || shortCaption(scene.prompt);
      page.drawText(caption, {
        x: MARGIN,
        y: PAGE_H - 100,
        size: 13,
        font: sansItalic,
        color: rgb(0.14, 0.1, 0.15),
        maxWidth: PAGE_W - MARGIN * 2,
        lineHeight: 18,
      });
      const imgW = PAGE_W - MARGIN * 2;
      const imgH = imgW * (img.height / img.width);
      page.drawImage(img, { x: MARGIN, y: MARGIN, width: imgW, height: Math.min(imgH, 260) });
    } else if (entry.imageMode === "fit") {
      drawFitContained(page, img);
      if (entry.layout === "image-caption") {
        const caption = entry.caption || shortCaption(scene.prompt);
        page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 74, color: rgb(0, 0, 0), opacity: 0.5 });
        page.drawText(caption, {
          x: MARGIN,
          y: 48,
          size: 10,
          lineHeight: 13,
          font: sansItalic,
          color: rgb(1, 1, 1),
          maxWidth: PAGE_W - MARGIN * 2,
        });
      }
    } else {
      // full-bleed cover-crop: image fills the page, caption (if any) overlays near the bottom
      const fx = typeof entry.focalX === "number" ? entry.focalX : 50;
      const fy = typeof entry.focalY === "number" ? entry.focalY : 50;
      drawFullBleedFocal(page, img, fx, fy);
      if (entry.layout === "image-caption") {
        const caption = entry.caption || shortCaption(scene.prompt);
        page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 74, color: rgb(0, 0, 0), opacity: 0.5 });
        page.drawText(caption, {
          x: MARGIN,
          y: 48,
          size: 10,
          lineHeight: 13,
          font: sansItalic,
          color: rgb(1, 1, 1),
          maxWidth: PAGE_W - MARGIN * 2,
        });
      }
    }

    if (!imageOnly) {
      page.drawText(String(i + 2), {
        x: PAGE_W - MARGIN - 10,
        y: 12,
        size: 8,
        font: sans,
        color: rgb(0.4, 0.35, 0.37),
      });
    }
  }

  // Page 16: back cover — same masthead lockup as the front cover, smaller
  // and quieter, so the series reads as one publication front-to-back.
  // Independently toggleable: an issue can ship with a textless back cover.
  {
    const page = doc.addPage([PAGE_W, PAGE_H]);
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
      page.drawText(`${run.scenes.length} scenes generated locally, ${pages.length} selected for this issue.`, {
        x: MARGIN,
        y: PAGE_H / 2 - 16,
        size: 8,
        font: sans,
        color: rgb(0.8, 0.76, 0.72),
        maxWidth: PAGE_W - MARGIN * 2,
      });
    }
  }

  const pdfBytes = await doc.save();
  const filename = `${run.id}.pdf`;
  const filePath = join(PDF_DIR, filename);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, pdfBytes);

  return { pdfUrl: `/pdfs/${filename}`, pageCount: 16, lowResWarnings };
}
