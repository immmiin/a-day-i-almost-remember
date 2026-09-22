import type { Scene, Fragment, TimeOfDay, DayRun, DistortionRecord } from "./types";
import { DAY_SEQUENCE } from "./types";
import { FRAGMENT_POOLS, instantiate } from "./fragments";
import { distort, pickDistortionAxis } from "./transform";
import { assembleProse } from "./templates";
import { Rng, makeSeed } from "./rng";

export interface GenerateSceneInput {
  /**
   * Only the fragments the previous scene explicitly passed forward, plus
   * time metadata below. This is the REMEMBER/FORGET boundary enforced in
   * the type signature, not by convention: there is no parameter through
   * which the rest of the run could leak in.
   */
  passedFragments: Fragment[];
  sceneIndex: number;
  timeOfDay: TimeOfDay;
  rng: Rng;
}

function distortionChance(sceneIndex: number): number {
  return Math.min(0.15 + sceneIndex * 0.13, 0.95);
}

export function generateScene(input: GenerateSceneInput): Scene {
  const { passedFragments, sceneIndex, timeOfDay, rng } = input;

  // REMEMBER: the inherited set going into this scene.
  let inherited = passedFragments.map((f) => ({ ...f }));

  // DISTORT: at most one inherited fragment mutates, never scene 0 (nothing inherited yet).
  let distortedRecord: DistortionRecord | null = null;
  if (sceneIndex > 0 && inherited.length > 0 && rng.chance(distortionChance(sceneIndex))) {
    const target = rng.pick(inherited);
    const axis = pickDistortionAxis(rng);
    const { fragment: mutated, record } = distort(target, axis, rng);
    inherited = inherited.map((f) => (f.id === target.id ? mutated : f));
    distortedRecord = record;
  }

  // New material drawn from this hour's library.
  const pool = FRAGMENT_POOLS[timeOfDay];
  const introducedCount = rng.chance(0.5) ? 1 : 2;
  const seeds = rng.pickMany(pool, introducedCount);
  const introduced = seeds.map((s) => instantiate(s, sceneIndex));

  const prose = assembleProse({
    timeOfDay,
    inherited,
    distortedFragmentId: distortedRecord?.fragmentId ?? null,
    distortedAxis: distortedRecord?.axis ?? null,
    distortedBefore: distortedRecord?.before ?? null,
    distortedAfter: distortedRecord?.after ?? null,
    introduced,
    rng,
  });

  // PASS FORWARD: only 2-3 fragments survive into the next scene; the rest is forgotten here.
  const candidates = [...inherited, ...introduced];
  const passCount = Math.min(candidates.length, rng.chance(0.5) ? 2 : 3);
  const passedForward = rng.pickMany(candidates, passCount);
  const passedIds = new Set(passedForward.map((f) => f.id));
  const forgotten = candidates.filter((f) => !passedIds.has(f.id));

  return {
    index: sceneIndex,
    timeOfDay,
    inherited,
    distorted: distortedRecord,
    introduced,
    prose,
    passedForward,
    forgotten,
  };
}

/**
 * Stateful wrapper for the interactive UI: holds full run history so the
 * archive can display it, but every call into generateScene() still only
 * receives that scene's passed-forward fragments — the withholding rule is
 * enforced at the generateScene() boundary above, not here.
 */
export class DayGenerator {
  readonly seed: number;
  readonly id: string;
  readonly createdAt: string;
  private rng: Rng;
  private passed: Fragment[] = [];
  private scenes: Scene[] = [];

  constructor(seed: number = makeSeed(), id?: string, createdAt?: string) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.id = id ?? `run-${seed.toString(36)}-${Date.now().toString(36)}`;
    this.createdAt = createdAt ?? new Date().toISOString();
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

  next(): Scene | null {
    if (this.isComplete) return null;
    const index = this.scenes.length;
    const scene = generateScene({
      passedFragments: this.passed,
      sceneIndex: index,
      timeOfDay: DAY_SEQUENCE[index],
      rng: this.rng,
    });
    this.scenes.push(scene);
    this.passed = scene.passedForward;
    return scene;
  }

  toRun(): DayRun {
    return { id: this.id, createdAt: this.createdAt, scenes: this.scenes, seed: this.seed };
  }

  /**
   * Rebuilds a resumable generator from a previously saved (possibly
   * incomplete) run, so a refresh mid-day continues instead of restarting.
   * The rng seed used going forward is fresh — only the seed a run started
   * with is preserved as metadata, not strict replay determinism.
   */
  static fromRun(run: DayRun): DayGenerator {
    const generator = new DayGenerator(run.seed, run.id, run.createdAt);
    generator.scenes = [...run.scenes];
    const last = run.scenes[run.scenes.length - 1];
    generator.passed = last ? [...last.passedForward] : [];
    return generator;
  }
}
