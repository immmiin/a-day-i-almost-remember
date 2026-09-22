import type { Fragment, Scene, TimeOfDay } from "./types";
import { DAY_SEQUENCE } from "./types";
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
  const timeOfDay: TimeOfDay = DAY_SEQUENCE[0];
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

  get isComplete(): boolean {
    return this.scenes.length >= DAY_SEQUENCE.length;
  }

  get totalScenes(): number {
    return DAY_SEQUENCE.length;
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

  /** Decides the next scene's fragments without generating its image yet. */
  nextFragmentScene(): Scene | null {
    if (this.isComplete) return null;
    const index = this.scenes.length;
    const scene =
      index === 0
        ? seedScene(this.seedText, this.rng)
        : generateScene({
            passedFragments: this.scenes[index - 1].passedForward,
            sceneIndex: index,
            timeOfDay: DAY_SEQUENCE[index],
            rng: this.rng,
          });
    this.scenes.push(scene);
    return scene;
  }
}

/** What a scene actually sends the local generator — the restriction boundary in data form. */
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
  const distortionNote =
    distorted && changedFragment
      ? `${changedFragment.label} has changed: its ${distorted.axis} used to be ${distorted.before}, now it is ${distorted.after}. Otherwise it is the same object.`
      : undefined;
  return { rememberedFragments, distortionNote };
}
