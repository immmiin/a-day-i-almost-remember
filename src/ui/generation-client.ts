/**
 * Real client for the local generation backend — not built yet, so every
 * call genuinely fails until a backend exists at this endpoint. This is
 * intentional: the Dream Machine's loading/error/retry states are wired to
 * a real attempt, never a simulated success, per the project's own rule
 * that a simulated generation must never be presented as real.
 */

const GENERATION_ENDPOINT = "http://localhost:8787/api/generate";
const REQUEST_TIMEOUT_MS = 4000;

export interface GenerationRequest {
  timeOfDay: string;
  sceneIndex: number;
  rememberedFragments: string[];
  artDirection: string;
}

export type GenerationResult =
  | { ok: true; imageUrl: string }
  | { ok: false; reason: "not-connected" | "failed" | "cancelled" };

export async function requestGeneration(
  req: GenerationRequest,
  signal?: AbortSignal,
): Promise<GenerationResult> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(GENERATION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: "failed" };
    const data = (await res.json()) as { imageUrl?: string };
    if (!data.imageUrl) return { ok: false, reason: "failed" };
    return { ok: true, imageUrl: data.imageUrl };
  } catch (err) {
    if (signal?.aborted) return { ok: false, reason: "cancelled" };
    return { ok: false, reason: "not-connected" };
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}
