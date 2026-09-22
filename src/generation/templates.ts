import type { DistortionAxis, Fragment, TimeOfDay } from "./types";
import type { Rng } from "./rng";

const TIME_OPENERS: Record<TimeOfDay, string[]> = {
  "early-morning": [
    "The day starts before I'm ready for it.",
    "It's early enough that the light hasn't decided what color to be yet.",
    "I wake into the day the way I always do, without much ceremony.",
  ],
  morning: [
    "By the time I'm properly awake, the morning is already underway.",
    "The morning moves the way it always moves — one small task after another.",
    "It's morning, and everything is doing its ordinary morning work.",
  ],
  midday: [
    "The day reaches its middle without announcing it.",
    "Midday arrives the way it always does, flat and bright.",
    "By noon the day has settled into its own rhythm.",
  ],
  afternoon: [
    "The afternoon is long, the way afternoons are.",
    "Somewhere past midday, the light starts to lean.",
    "The afternoon goes on, unremarkable, the way it's supposed to.",
  ],
  dusk: [
    "The light starts to change, the way it does every evening.",
    "Dusk arrives the way it always does — gradually, then all at once.",
    "The day begins handing itself over to the evening.",
  ],
  evening: [
    "By evening the day has mostly finished asking things of me.",
    "The evening settles in the familiar way.",
    "It's evening, and the day is winding down the way it should.",
  ],
  night: [
    "Night comes the way it always comes.",
    "By now the day is nearly done with me.",
    "It's late, and the day is finally letting go.",
  ],
  "late-night": [
    "The day should have ended by now, but it hasn't quite.",
    "It's later than I meant it to be.",
    "I'm still up, for no reason I could explain.",
  ],
  midnight: [
    "It's midnight, the exact hinge between one day and the next.",
    "The date changes without anyone noticing but me.",
    "The house is asleep. I'm not, yet.",
  ],
  "pre-dawn": [
    "It's too early to call it morning and too late to call it night.",
    "The sky hasn't decided what it's doing yet.",
    "The dark is thinning, a little, at the edges.",
  ],
  "next-morning": [
    "The day starts again, the way it does.",
    "Somehow it's morning again already.",
    "The same light comes back, as if nothing happened in between.",
  ],
};

const CARRY_TEMPLATES: Array<(f: Fragment) => string> = [
  (f) => `${capitalize(f.label)} is still here, ${lower(f.meaning)}.`,
  (f) => `I notice ${lower(f.label)} again — ${lower(f.meaning)}.`,
  (f) => `${capitalize(f.label)} hasn't gone anywhere; still ${f.scale}, same as before.`,
  (f) => `There's ${lower(f.label)}, exactly where I left it.`,
];

const INTRODUCE_TEMPLATES: Array<(f: Fragment) => string> = [
  (f) => `There's ${lower(f.label)}, ${lower(f.meaning)}.`,
  (f) => `${capitalize(f.label)} shows up, ${f.scale}, the way it does.`,
  (f) => `I notice ${lower(f.label)} for the first time today.`,
];

/**
 * Role and material values are closed, single-word vocabularies, so they're
 * safe to drop straight into a predicate ("isn't glass anymore"). Scale
 * values are free-authored phrases mixing adjectives ("palm-sized") and verb
 * phrases ("fills the hallway") that don't share a common predicate shape,
 * so scale and meaning distortions stay generic rather than risk a broken
 * sentence — the exact before/after values still surface verbatim in the
 * mechanics panel and archive.
 */
const DISTORT_NARRATORS: Record<DistortionAxis, (f: Fragment, before: string, after: string) => string> = {
  role: (f, before, after) =>
    `${capitalize(f.label)} isn't ${article(before)} anymore. It's ${article(after)} now, and I don't think to question it.`,
  material: (f, before, after) =>
    `${capitalize(f.label)} isn't ${before} anymore. Now it's ${after}, and somehow that seems fine.`,
  scale: (f) =>
    `Something about the size of ${lower(f.label)} has stopped adding up, though I let it go.`,
  meaning: (f) => `Something about ${lower(f.label)} feels different now, though I can't say exactly what.`,
};

function article(word: string): string {
  return (/^[aeiou]/i.test(word) ? "an " : "a ") + word;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** Lowercases only the leading character, so embedded pronouns like "I" stay intact. */
function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export interface SceneProseInput {
  timeOfDay: TimeOfDay;
  inherited: Fragment[];
  distortedFragmentId: string | null;
  distortedAxis: DistortionAxis | null;
  distortedBefore: string | null;
  distortedAfter: string | null;
  introduced: Fragment[];
  rng: Rng;
}

export function assembleProse(input: SceneProseInput): string {
  const { timeOfDay, inherited, distortedFragmentId, distortedAxis, distortedBefore, distortedAfter, introduced, rng } = input;
  const sentences: string[] = [];

  sentences.push(rng.pick(TIME_OPENERS[timeOfDay]));

  for (const frag of inherited) {
    if (frag.id === distortedFragmentId && distortedAxis && distortedBefore !== null && distortedAfter !== null) {
      sentences.push(DISTORT_NARRATORS[distortedAxis](frag, distortedBefore, distortedAfter));
    } else {
      sentences.push(rng.pick(CARRY_TEMPLATES)(frag));
    }
  }

  for (const frag of introduced) {
    sentences.push(rng.pick(INTRODUCE_TEMPLATES)(frag));
  }

  return sentences.join(" ");
}
