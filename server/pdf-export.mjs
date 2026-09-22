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

export async function exportRunToPdf(run) {
  await mkdir(PDF_DIR, { recursive: true });
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaOblique);
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);

  const pages = run.zine?.pages ?? [];
  const lowResWarnings = [];

  // Page 1: front cover
  {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.945, 0.914, 0.863) });
    const title = run.zine?.title || "A Day I Almost Remember";
    page.drawText(title, {
      x: MARGIN,
      y: PAGE_H / 2 + 60,
      size: 22,
      lineHeight: 26,
      font,
      color: rgb(0.14, 0.1, 0.15),
      maxWidth: PAGE_W - MARGIN * 2,
    });
    page.drawText(new Date(run.createdAt).toLocaleDateString(), {
      x: MARGIN,
      y: PAGE_H / 2 - 60,
      size: 10,
      font: bodyFont,
      color: rgb(0.35, 0.3, 0.32),
    });
  }

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
      const scale = Math.max(PAGE_W / img.width, PAGE_H / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      page.drawImage(img, { x: (PAGE_W - drawW) / 2, y: (PAGE_H - drawH) / 2, width: drawW, height: drawH });
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

  // Page 16: back cover / colophon
  {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.14, 0.1, 0.15) });
    page.drawText("a procedural memory", {
      x: MARGIN,
      y: PAGE_H / 2,
      size: 12,
      font,
      color: rgb(0.96, 0.93, 0.87),
    });
    page.drawText(`${run.scenes.length} scenes generated locally, ${pages.length} selected for this issue.`, {
      x: MARGIN,
      y: PAGE_H / 2 - 20,
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
