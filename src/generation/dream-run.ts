import type { Fragment, Scene, TimeOfDay } from "./types";
import { EXTENDED_SEQUENCE, timeOfDayForIndex } from "./types";
import { generateScene } from "./engine";
import { instantiate, FRAGMENT_POOLS } from "./fragments";
import { Rng, makeSeed } from "./rng";

export const DEFAULT_SEED_TEXT = "The smell of coffee before I opened my eyes.";

/**
 * Scene 0 never inherits anything (nothing came before it), so it can't go
 * through generateScene()'s normal REMEMBER step. Instead the user's own
 * sentence becomes the day's first fragment, paired with one ordinary
 * morning fragment for texture — everything downstream (FORGET, DISTORT,
 * PASS FORWARD for scene 1 onward) runs through the same generateScene()
 * used before, unchanged.
 */
function seedScene(userText: string, rng: Rng): Scene {
  const timeOfDay: TimeOfDay = EXTENDED_SEQUENCE[0];
  const seedFragment = instantiate(
    {
      label: userText.trim() || DEFAULT_SEED_TEXT,
      role: "sensation",
      material: "smoke",
      scale: "no size at all, just a feeling",
      meaning: "the one thing that started the day",
    },
    0,
  );
  const extraSeed = rng.pick(FRAGMENT_POOLS[timeOfDay]);
  const extra = instantiate(extraSeed, 0);
  const introduced = [seedFragment, extra];

  const passCount = Math.min(introduced.length, 2);
  const passedForward = rng.pickMany(introduced, passCount);
  const passedIds = new Set(passedForward.map((f) => f.id));
  const forgotten = introduced.filter((f) => !passedIds.has(f.id));

  return {
    index: 0,
    timeOfDay,
    inherited: [],
    distorted: null,
    introduced,
    prose: "",
    passedForward,
    forgotten,
  };
}

/**
 * Fragment-only orchestrator: decides REMEMBER/FORGET/DISTORT/PASS FORWARD
 * for each scene using the same engine as before. It never calls the image
 * backend itself — the caller reads a scene's fragments, asks the backend
 * to generate from them, then calls recordScene() with the result before
 * advancing. That split keeps "what fragments exist" (deterministic, fast,
 * client-side) separate from "what image comes back" (slow, real, remote).
 */
export class DreamRunClient {
  readonly id: string;
  readonly seedText: string;
  readonly createdAt: string;
  private rng: Rng;
  private scenes: Scene[] = [];

  constructor(seedText: string, opts?: { id?: string; createdAt?: string; rngSeed?: number }) {
    this.seedText = seedText;
    this.id = opts?.id ?? `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    this.createdAt = opts?.createdAt ?? new Date().toISOString();
    this.rng = new Rng(opts?.rngSeed ?? makeSeed());
  }

  get sceneCount(): number {
    return this.scenes.length;
  }

  get allScenes(): readonly Scene[] {
    return this.scenes;
  }

  /**
   * Rebuilds in-memory scene/fragment state from persisted records (full
   * Fragment objects, not just labels) so a reloaded page can keep
   * generating forward — the rng continues fresh from here, matching how
   * the earlier text-only engine's resume worked.
   */
  static fromSavedScenes(
    seedText: string,
    savedScenes: Scene[],
    opts?: { id?: string; createdAt?: string },
  ): DreamRunClient {
    const client = new DreamRunClient(seedText, opts);
    client.scenes = [...savedScenes];
    return client;
  }

  /**
   * Decides the next scene's fragments without generating its image yet.
   * There is no cap here — a run continues for as long as the user chooses
   * to click "Generate"; this only ever runs once per explicit call, never
   * in a loop, so it can't auto-generate a sequence on its own.
   */
  nextFragmentScene(): Scene {
    const index = this.scenes.length;
    const scene =
      index === 0
        ? seedScene(this.seedText, this.rng)
        : generateScene({
            passedFragments: this.scenes[index - 1].passedForward,
            sceneIndex: index,
            timeOfDay: timeOfDayForIndex(index),
            rng: this.rng,
          });
    this.scenes.push(scene);
    return scene;
  }
}

/**
 * What a scene actually sends the local generator — the restriction boundary
 * in data form.
 *
 * Only `material` distortions synthesize their own prompt sentence here.
 * `role` and `meaning` describe abstract, non-visual changes — "its role
 * used to be object, now it is person" or a narrative clause like "it has
 * started watching me back" — and feeding those straight into an image
 * prompt as "the impossible detail" asks the model to render something
 * that isn't a picture of anything, so it quietly falls back to the
 * ordinary base scene (confirmed empirically). `scale` distortions turned
 * out to have the same problem for a different reason: the scale pool's
 * before/after values are sometimes too close together for a given object
 * to read as a size contradiction at all — a real submitted prompt once
 * asked for a ceiling fan to go from "room-sized" to "life-sized", which
 * is barely a change for furniture already roughly that scale, and the
 * result came back as an ordinary, undistorted room. For both of those
 * axes, distortionNote is left undefined so the prompt builder substitutes
 * one of its own hand-authored, unmistakably legible scenarios instead of
 * trying to visualize a combination it can't quality-control.
 */
export function fragmentsForGeneration(scene: Scene): {
  rememberedFragments: string[];
  distortionNote: string | undefined;
} {
  const rememberedFragments = [
    ...scene.inherited.filter((f) => f.id !== scene.distorted?.fragmentId).map((f: Fragment) => f.label),
    ...scene.introduced.map((f: Fragment) => f.label),
  ];
  const distorted = scene.distorted;
  const changedFragment = distorted ? scene.inherited.find((f) => f.id === distorted.fragmentId) : null;

  let distortionNote: string | undefined;
  if (distorted && changedFragment) {
    if (distorted.axis === "material") {
      distortionNote = `${changedFragment.label} has become entirely ${distorted.after} instead of ${distorted.before}, its new texture and the way light catches it clearly visible, sitting exactly where it always does among the ordinary furniture around it.`;
    }
  }
  return { rememberedFragments, distortionNote };
}
