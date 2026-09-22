import { escapeHtml } from "./util";

export interface CoverConfig {
  sceneIndex: number | null;
  /** short cover-only title, independent of the zine's general issue title / the original seed text */
  title: string;
  posterLine: string;
  focalX: number;
  focalY: number;
  contrast: "paper" | "ink";
  /** front-cover typography on/off — lets an issue ship with an image-only front cover */
  showText: boolean;
  /** back-cover (page 16) typography on/off, independent of the front cover */
  backShowText: boolean;
}

export const DEFAULT_COVER: CoverConfig = {
  sceneIndex: null,
  title: "",
  posterLine: "",
  focalX: 50,
  focalY: 38,
  contrast: "ink",
  showText: true,
  backShowText: true,
};

export function resolveCoverConfig(cover: Partial<CoverConfig> | null | undefined): CoverConfig {
  return { ...DEFAULT_COVER, ...(cover ?? {}) };
}

export interface CoverFaceOptions {
  imageUrl: string | null;
  /** already resolved: cover.title, or the issue title, or the seed text — caller decides the fallback chain */
  title: string;
  issueNumber: number;
  date: string;
  posterLine?: string;
  contrast: "paper" | "ink";
  focalX: number;
  focalY: number;
  showText?: boolean;
  /** larger type for the Zine Studio editor's own preview panel */
  size?: "grid" | "lg";
}

/**
 * One poster face, shared verbatim between the Zine Studio cover editor's
 * live preview and the Dream Archive's shelf of finished issues.
 *
 * Typographic hierarchy is deliberately conventional and un-competing:
 * the masthead is the one dominant text element, the issue title is
 * noticeably smaller, issue-number/date are quiet metadata, and the
 * poster line is smallest and simply absent when empty. Each text
 * cluster sits on its own small, content-sized chip rather than a
 * full-width band, so the photograph carries the cover rather than
 * being washed out by an overlay.
 */
export function renderCoverFace(opts: CoverFaceOptions): string {
  const { imageUrl, title, issueNumber, date, posterLine, contrast, focalX, focalY, showText = true, size = "grid" } = opts;
  return `
    <div class="zine-cover zine-cover--${contrast} zine-cover--${size}">
      ${
        imageUrl
          ? `<img class="zine-cover__img" src="${imageUrl}" alt="" style="object-position:${focalX}% ${focalY}%;" />`
          : `<div class="zine-cover__img zine-cover__img--empty" aria-hidden="true"></div>`
      }
      ${
        showText
          ? `
      <div class="zine-cover__masthead">
        <span class="zine-cover__wordmark">A Day I Almost Remember</span>
        <span class="zine-cover__kicker">issue ${issueNumber} &middot; ${escapeHtml(date)}</span>
      </div>
      <div class="zine-cover__foot">
        <p class="zine-cover__title">${escapeHtml(title)}</p>
        ${posterLine ? `<p class="zine-cover__poster-line">${escapeHtml(posterLine)}</p>` : ""}
      </div>`
          : ""
      }
    </div>
  `;
}
