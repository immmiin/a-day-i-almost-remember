import type { Scene } from "../generation/types";
import type { CoverConfig } from "./zine-cover";

// Loopback IPv4 only — server/index.mjs binds 127.0.0.1, never a public interface.
const BACKEND = "http://127.0.0.1:8787";

/**
 * The generation backend only ever runs on the artist's own machine. A copy
 * of the site served from anywhere else (a static deploy) never contacts
 * localhost at all — no failed requests, and no browser prompt asking a
 * visitor for local-network access.
 */
export const BACKEND_POSSIBLE = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(window.location.hostname);

export function backendFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!BACKEND_POSSIBLE) return Promise.reject(new Error("generation backend only runs on the artist's machine"));
  return fetch(input, init);
}
// Loading a view shouldn't wait on a backend that's down or unresponsive
// (it never exists on the static deploy) — fail fast so callers can fall back.
const LOAD_TIMEOUT_MS = 5000;

export interface RunSummary {
  id: string;
  seedText: string;
  createdAt: string;
  sceneCount: number;
  coverImageUrl: string | null;
  completed: boolean;
  zineTitle: string | null;
  cover: Partial<CoverConfig> | null;
  issueNumber: number;
  filledPageCount: number;
  hasSpreadPdf: boolean;
}

export interface GeneratedImage {
  url: string;
  runId: string;
  sceneIndex: number;
  timeOfDay: string | null;
  createdAt: string;
}

export interface SavedScene {
  index: number;
  timeOfDay: string;
  imageUrl: string;
  prompt: string;
  genSeed: number;
  /** full fragment objects, not just labels, so a resumed run can keep distorting them */
  remembered: Scene["inherited"];
  forgotten: Scene["forgotten"];
  distorted: Scene["distorted"];
  passedForward: Scene["passedForward"];
  settings: { width: number; height: number; steps: number };
  createdAt: string;
}

export interface ZinePageEntry {
  sceneIndex: number;
  caption?: string;
  layout: "full" | "image-caption" | "text-led";
  /** how the image fills its frame — only meaningful for "full"/"image-caption"; "text-led" always fits without cropping */
  imageMode?: "fit" | "fill";
  /** crop anchor 0-100 (CSS object-position convention), only used when imageMode is "fill" */
  focalX?: number;
  focalY?: number;
}

export interface RunDetail {
  id: string;
  seedText: string;
  createdAt: string;
  issueNumber: number;
  scenes: SavedScene[];
  zine: {
    title?: string;
    /** fixed-length page grid; a `null` slot is an empty page, not "no pages after this point" */
    pages?: (ZinePageEntry | null)[];
    cover?: Partial<CoverConfig>;
    pdfUrl?: string;
    pageCount?: number;
    exportedAt?: string;
    spreadPdfUrl?: string;
    spreadPageCount?: number;
    spreadExportedAt?: string;
  } | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  // Saved generations ship with the site as static files, but a build only
  // holds the ones that existed when it was made — on the artist's machine
  // the backend serves them live, so a fresh generation shows immediately.
  if (path.startsWith("/generations/") && !BACKEND_POSSIBLE) return `${import.meta.env.BASE_URL}${path.slice(1)}`;
  // On the static deploy, issue covers and PDFs come from the snapshot that
  // scripts/export-archive.mjs writes to public/archive/.
  if (!BACKEND_POSSIBLE && (path.startsWith("/images/") || path.startsWith("/pdfs/"))) {
    return `${import.meta.env.BASE_URL}archive${path}`;
  }
  return `${BACKEND}${path}`;
}

export async function createRun(id: string, seedText: string, createdAt: string): Promise<RunDetail> {
  return json(
    await backendFetch(`${BACKEND}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, seedText, createdAt }),
      signal: AbortSignal.timeout(LOAD_TIMEOUT_MS),
    }),
  );
}

export async function saveScene(runId: string, scene: SavedScene): Promise<RunDetail> {
  return json(
    await backendFetch(`${BACKEND}/api/runs/${runId}/scenes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scene),
    }),
  );
}

export async function listRuns(): Promise<RunSummary[]> {
  if (!BACKEND_POSSIBLE) {
    return json(await fetch(`${import.meta.env.BASE_URL}archive/runs.json`, { cache: "no-cache" }));
  }
  return json(await backendFetch(`${BACKEND}/api/runs`));
}

export async function getRun(id: string): Promise<RunDetail | null> {
  const res = await backendFetch(`${BACKEND}/api/runs/${id}`, { signal: AbortSignal.timeout(LOAD_TIMEOUT_MS) });
  if (res.status === 404) return null;
  return json(res);
}

export async function deleteRun(id: string): Promise<void> {
  await backendFetch(`${BACKEND}/api/runs/${id}`, { method: "DELETE" });
}

export async function saveZinePages(
  runId: string,
  title: string,
  pages: (ZinePageEntry | null)[],
  cover?: CoverConfig,
): Promise<RunDetail> {
  return json(
    await backendFetch(`${BACKEND}/api/runs/${runId}/zine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, pages, cover }),
    }),
  );
}

export async function exportPdf(
  runId: string,
): Promise<{ pdfUrl: string; pageCount: number; lowResWarnings: string[] }> {
  return json(
    await backendFetch(`${BACKEND}/api/runs/${runId}/export-pdf`, { method: "POST" }),
  );
}

export async function exportSpreadPdf(
  runId: string,
): Promise<{ pdfUrl: string; pageCount: number; lowResWarnings: string[] }> {
  return json(
    await backendFetch(`${BACKEND}/api/runs/${runId}/export-spread-pdf`, { method: "POST" }),
  );
}

export async function listAllImages(): Promise<GeneratedImage[]> {
  return json(await backendFetch(`${BACKEND}/api/images`));
}
