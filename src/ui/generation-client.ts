/**
 * Real client for the local generation backend at server/index.mjs, which
 * proxies to Draw Things running FLUX.1 Kontext dev on localhost:7860. No
 * simulated success path exists here — every call is a genuine attempt,
 * and a failure reports honestly rather than substituting a placeholder.
 */

const GENERATION_ENDPOINT = "http://localhost:8787/api/generate";
const HEALTH_ENDPOINT = "http://localhost:8787/api/health";
// Local generation genuinely takes 1-3+ minutes depending on size/steps;
// this is a ceiling against a truly stuck request, not an expected wait.
const REQUEST_TIMEOUT_MS = 6 * 60 * 1000;

export interface GenerationRequest {
  timeOfDay: string;
  sceneIndex: number;
  rememberedFragments: string[];
  distortionNote?: string;
  /** defaults chosen for a reasonable interactive wait, not final zine quality */
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
}

export type GenerationResult =
  | { ok: true; imageUrl: string; prompt: string; seed: number }
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
      body: JSON.stringify({ width: 768, height: 768, steps: 12, ...req }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: "failed" };
    const data = (await res.json()) as { imageUrl?: string; prompt?: string; seed?: number };
    if (!data.imageUrl) return { ok: false, reason: "failed" };
    // imageUrl stays relative (e.g. "/images/x.png") here — it's what gets
    // persisted, and the server's own PDF export reads it as a relative
    // path. Callers that render it in the browser use absoluteUrl().
    return { ok: true, imageUrl: data.imageUrl, prompt: data.prompt ?? "", seed: data.seed ?? 0 };
  } catch (err) {
    if (signal?.aborted) return { ok: false, reason: "cancelled" };
    return { ok: false, reason: "not-connected" };
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function checkBackend(): Promise<{ connected: boolean; model?: string }> {
  try {
    const res = await fetch(HEALTH_ENDPOINT, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { connected: false };
    return (await res.json()) as { connected: boolean; model?: string };
  } catch {
    return { connected: false };
  }
}
