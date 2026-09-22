export type TimeOfDay =
  | "early-morning"
  | "morning"
  | "midday"
  | "afternoon"
  | "dusk"
  | "evening"
  | "night"
  | "late-night"
  | "midnight"
  | "pre-dawn"
  | "next-morning";

/** The first day, scene by scene — index 0 through 6. */
export const DAY_SEQUENCE: TimeOfDay[] = [
  "early-morning",
  "morning",
  "midday",
  "afternoon",
  "dusk",
  "evening",
  "night",
];

/** The first day plus its continuation into a second — index 0 through 10. */
export const EXTENDED_SEQUENCE: TimeOfDay[] = [
  ...DAY_SEQUENCE,
  "late-night",
  "midnight",
  "pre-dawn",
  "next-morning",
];

/**
 * A run no longer stops at a fixed scene count — the user decides how long
 * a dream runs. Once the named stages (index 0-10, the first day into a
 * second morning) are used up, time keeps cycling through "morning" onward
 * rather than looping back to "early-morning", since that label specifically
 * means the very first waking of the run.
 */
export function timeOfDayForIndex(index: number): TimeOfDay {
  if (index < EXTENDED_SEQUENCE.length) return EXTENDED_SEQUENCE[index];
  const cycle = EXTENDED_SEQUENCE.slice(1); // everything after "early-morning"
  return cycle[(index - EXTENDED_SEQUENCE.length) % cycle.length];
}

export type FragmentRole = "object" | "person" | "place" | "sensation" | "sound";

export type Material =
  | "glass" | "smoke" | "paper" | "water" | "stone" | "wax" | "cloth"
  | "metal" | "light" | "ash" | "bone" | "thread" | "ice" | "static";

export interface Fragment {
  /** stable id, survives distortion so the archive can trace lineage */
  id: string;
  /** the noun/phrase itself, e.g. "the kitchen clock" */
  label: string;
  role: FragmentRole;
  material: Material;
  /** relative size word, e.g. "small", "room-sized", "the size of a thumbnail" */
  scale: string;
  /** what the fragment means to the protagonist, one clause */
  meaning: string;
  /** which scene this fragment was first introduced in */
  originScene: number;
}

export type DistortionAxis = "role" | "scale" | "material" | "meaning";

export interface DistortionRecord {
  fragmentId: string;
  axis: DistortionAxis;
  before: string;
  after: string;
}

export interface Scene {
  index: number;
  timeOfDay: TimeOfDay;
  /** fragments carried in from the previous scene, unchanged except the one distorted */
  inherited: Fragment[];
  /** id of the inherited fragment that was distorted this scene, if any (scene 0 has none) */
  distorted: DistortionRecord | null;
  /** brand-new fragments introduced this scene, drawn from the library */
  introduced: Fragment[];
  /** the assembled prose for this scene */
  prose: string;
  /** the 2-3 fragments passed forward to the next scene (subset of inherited ∪ introduced) */
  passedForward: Fragment[];
  /** fragments that existed in the scene's material but were withheld from the next scene */
  forgotten: Fragment[];
}

export interface DayRun {
  id: string;
  createdAt: string;
  scenes: Scene[];
  seed: number;
}
