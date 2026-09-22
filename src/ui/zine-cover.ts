import { escapeHtml } from "./util";

export interface CoverConfig {
  sceneIndex: number | null;
  posterLine: string;
  focalX: number;
  focalY: number;
  contrast: "paper" | "ink";
}

export const DEFAULT_COVER: CoverConfig = {
  sceneIndex: null,
  posterLine: "",
  focalX: 50,
  focalY: 38,
  contrast: "ink",
};

export function resolveCoverConfig(cover: Partial<CoverConfig> | null | undefined): CoverConfig {
  return { ...DEFAULT_COVER, ...(cover ?? {}) };
}

export interface CoverFaceOptions {
  imageUrl: string | null;
  title: string;
  issueNumber: number;
  date: string;
  posterLine?: string;
  contrast: "paper" | "ink";
  focalX: number;
  focalY: number;
  /** larger type for the Zine Studio editor's own preview panel */
  size?: "grid" | "lg";
}

/**
 * One poster face, shared verbatim between the Zine Studio cover editor's
 * live preview and the Dream Archive's shelf of finished issues — the
 * masthead lockup only reads as a series if every cover renders it from
 * the same markup, not two hand-tuned copies that quietly drift apart.
 */
export function renderCoverFace(opts: CoverFaceOptions): string {
  const { imageUrl, title, issueNumber, date, posterLine, contrast, focalX, focalY, size = "grid" } = opts;
  return `
    <div class="zine-cover zine-cover--${contrast} zine-cover--${size}">
      ${
        imageUrl
          ? `<img class="zine-cover__img" src="${imageUrl}" alt="" style="object-position:${focalX}% ${focalY}%;" />`
          : `<div class="zine-cover__img zine-cover__img--empty" aria-hidden="true"></div>`
      }
      <div class="zine-cover__masthead">
        <span class="zine-cover__kicker">issue ${issueNumber} &middot; ${escapeHtml(date)}</span>
        <span class="zine-cover__wordmark">
          <span class="zine-cover__wordmark-top">a day i</span>
          <span class="zine-cover__wordmark-main" data-echo="almost remember">almost remember</span>
        </span>
      </div>
      <div class="zine-cover__foot">
        <p class="zine-cover__title">${escapeHtml(title)}</p>
        ${posterLine ? `<p class="zine-cover__poster-line">${escapeHtml(posterLine)}</p>` : ""}
      </div>
    </div>
  `;
}
