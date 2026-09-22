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
const MARGIN = 28; // ~10mm safety margin for non-bleed text/caption content
const MIN_PRINT_DPI = 300;

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

async function embedSceneImage(doc, run, sceneIndex) {
  const scene = sceneIndex != null ? run.scenes.find((s) => s.index === sceneIndex) : null;
  if (!scene) return null;
  const imgPath = join(GENERATED_DIR, scene.imageUrl.replace(/^\/images\//, ""));
  const bytes = await readFile(imgPath);
  return doc.embedPng(bytes);
}

// The front and back covers share one typographic lockup (kicker + italic
// wordmark) at the same position/size on every issue — that repetition,
// not any single cover's imagery, is what makes a stack of these read as
// one ongoing publication rather than unrelated one-off prints.
async function drawCoverFace(doc, run, issueNumber, fonts) {
  const { titleFont, bodyFont } = fonts;
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const cover = run.zine?.cover ?? {};
  const focalX = typeof cover.focalX === "number" ? cover.focalX : 50;
  const focalY = typeof cover.focalY === "number" ? cover.focalY : 38;
  const contrast = cover.contrast === "paper" ? "paper" : "ink";
  const sceneIndex = cover.sceneIndex ?? run.zine?.pages?.[0]?.sceneIndex ?? run.scenes[0]?.index ?? null;

  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.14, 0.1, 0.15) });
  const img = await embedSceneImage(doc, run, sceneIndex);
  if (img) drawFullBleedFocal(page, img, focalX, focalY);

  const bandColor = contrast === "paper" ? rgb(0.945, 0.914, 0.863) : rgb(0.14, 0.1, 0.15);
  const textColor = contrast === "paper" ? rgb(0.14, 0.1, 0.15) : rgb(0.96, 0.93, 0.87);

  page.drawRectangle({ x: 0, y: PAGE_H - 92, width: PAGE_W, height: 92, color: bandColor, opacity: 0.62 });
  page.drawText(`ISSUE ${issueNumber} · ${new Date(run.createdAt).toLocaleDateString()}`, {
    x: MARGIN,
    y: PAGE_H - 34,
    size: 8,
    font: bodyFont,
    color: textColor,
  });
  page.drawText("A Day I Almost Remember", {
    x: MARGIN,
    y: PAGE_H - 62,
    size: 19,
    lineHeight: 22,
    font: titleFont,
    color: textColor,
    maxWidth: PAGE_W - MARGIN * 2,
  });

  const title = run.zine?.title || run.seedText || "Untitled issue";
  const posterLine = cover.posterLine || "";
  const bottomH = posterLine ? 96 : 74;
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: bottomH, color: bandColor, opacity: 0.62 });
  page.drawText(title, {
    x: MARGIN,
    y: posterLine ? 58 : 40,
    size: 17,
    lineHeight: 20,
    font: titleFont,
    color: textColor,
    maxWidth: PAGE_W - MARGIN * 2,
  });
  if (posterLine) {
    page.drawText(posterLine, {
      x: MARGIN,
      y: 30,
      size: 9,
      lineHeight: 12,
      font: bodyFont,
      color: textColor,
      maxWidth: PAGE_W - MARGIN * 2,
    });
  }
}

export async function exportRunToPdf(run, issueNumber = 1) {
  await mkdir(PDF_DIR, { recursive: true });
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaOblique);
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);

  const pages = run.zine?.pages ?? [];
  const lowResWarnings = [];

  // Page 1: front cover
  await drawCoverFace(doc, run, issueNumber, { titleFont: font, bodyFont });

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

    if (entry.layout === "text-led") {
      page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.965, 0.945, 0.925) });
      const caption = entry.caption || shortCaption(scene.prompt);
      page.drawText(caption, {
        x: MARGIN,
        y: PAGE_H - 100,
        size: 13,
        font,
        color: rgb(0.14, 0.1, 0.15),
        maxWidth: PAGE_W - MARGIN * 2,
        lineHeight: 18,
      });
      const imgW = PAGE_W - MARGIN * 2;
      const imgH = imgW * (img.height / img.width);
      page.drawImage(img, { x: MARGIN, y: MARGIN, width: imgW, height: Math.min(imgH, 260) });
    } else {
      // full-bleed or image-plus-caption: image fills the page, caption overlays near the bottom
      drawFullBleedFocal(page, img, 50, 50);
      if (entry.layout === "image-caption") {
        const caption = entry.caption || shortCaption(scene.prompt);
        page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 74, color: rgb(0, 0, 0), opacity: 0.5 });
        page.drawText(caption, {
          x: MARGIN,
          y: 48,
          size: 10,
          lineHeight: 13,
          font,
          color: rgb(1, 1, 1),
          maxWidth: PAGE_W - MARGIN * 2,
        });
      }
    }

    page.drawText(String(i + 2), {
      x: PAGE_W - MARGIN - 10,
      y: 12,
      size: 8,
      font: bodyFont,
      color: rgb(0.4, 0.35, 0.37),
    });
  }

  // Page 16: back cover — same masthead lockup as the front cover, smaller
  // and quieter, so the series reads as one publication front-to-back.
  {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.14, 0.1, 0.15) });
    page.drawText("A Day I Almost Remember", {
      x: MARGIN,
      y: PAGE_H / 2 + 30,
      size: 13,
      font,
      color: rgb(0.96, 0.93, 0.87),
    });
    page.drawText(`issue ${issueNumber} · a procedural memory`, {
      x: MARGIN,
      y: PAGE_H / 2 + 8,
      size: 8,
      font: bodyFont,
      color: rgb(0.8, 0.76, 0.72),
    });
    page.drawText(`${run.scenes.length} scenes generated locally, ${pages.length} selected for this issue.`, {
      x: MARGIN,
      y: PAGE_H / 2 - 16,
      size: 8,
      font: bodyFont,
      color: rgb(0.8, 0.76, 0.72),
      maxWidth: PAGE_W - MARGIN * 2,
    });
  }

  const pdfBytes = await doc.save();
  const filename = `${run.id}.pdf`;
  const filePath = join(PDF_DIR, filename);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, pdfBytes);

  return { pdfUrl: `/pdfs/${filename}`, pageCount: 16, lowResWarnings };
}
