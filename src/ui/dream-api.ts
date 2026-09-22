import type { Scene } from "../generation/types";
import type { CoverConfig } from "./zine-cover";

const BACKEND = "http://localhost:8787";

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
    pages?: ZinePageEntry[];
    cover?: Partial<CoverConfig>;
    pdfUrl?: string;
    pageCount?: number;
    exportedAt?: string;
  } | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${BACKEND}${path}`;
}

export async function createRun(id: string, seedText: string, createdAt: string): Promise<RunDetail> {
  return json(
    await fetch(`${BACKEND}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, seedText, createdAt }),
    }),
  );
}

export async function saveScene(runId: string, scene: SavedScene): Promise<RunDetail> {
  return json(
    await fetch(`${BACKEND}/api/runs/${runId}/scenes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scene),
    }),
  );
}

export async function listRuns(): Promise<RunSummary[]> {
  return json(await fetch(`${BACKEND}/api/runs`));
}

export async function getRun(id: string): Promise<RunDetail | null> {
  const res = await fetch(`${BACKEND}/api/runs/${id}`);
  if (res.status === 404) return null;
  return json(res);
}

export async function deleteRun(id: string): Promise<void> {
  await fetch(`${BACKEND}/api/runs/${id}`, { method: "DELETE" });
}

export async function saveZinePages(
  runId: string,
  title: string,
  pages: ZinePageEntry[],
  cover?: CoverConfig,
): Promise<RunDetail> {
  return json(
    await fetch(`${BACKEND}/api/runs/${runId}/zine`, {
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
    await fetch(`${BACKEND}/api/runs/${runId}/export-pdf`, { method: "POST" }),
  );
}
