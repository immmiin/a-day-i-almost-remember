import type { Fragment, FragmentRole, Material, TimeOfDay } from "./types";

export interface FragmentSeed {
  label: string;
  role: FragmentRole;
  material: Material;
  scale: string;
  meaning: string;
}

let idCounter = 0;
export function instantiate(seed: FragmentSeed, originScene: number): Fragment {
  idCounter += 1;
  return {
    id: `f${originScene}-${idCounter}-${Math.random().toString(36).slice(2, 7)}`,
    label: seed.label,
    role: seed.role,
    material: seed.material,
    scale: seed.scale,
    meaning: seed.meaning,
    originScene,
  };
}

/**
 * Pools are organized by time of day. Each entry is a plausible, ordinary
 * fixture of that hour — the raw material REMEMBER draws from and DISTORT
 * later disfigures. Kept deliberately mundane; the surrealism is the engine's
 * job, not the library's.
 */
export const FRAGMENT_POOLS: Record<TimeOfDay, FragmentSeed[]> = {
  "early-morning": [
    { label: "the alarm clock", role: "object", material: "metal", scale: "fits in one hand", meaning: "the thing that decides when the day starts" },
    { label: "a glass of water by the bed", role: "object", material: "glass", scale: "palm-sized", meaning: "half-finished, left there out of habit" },
    { label: "the cold floor", role: "sensation", material: "stone", scale: "the whole room", meaning: "the first honest fact of the day" },
    { label: "my mother's voice from the kitchen", role: "sound", material: "static", scale: "fills the hallway", meaning: "calling a name that might be mine" },
    { label: "the curtain", role: "object", material: "cloth", scale: "window-sized", meaning: "keeping the grey light out a little longer" },
    { label: "a dream I was still holding", role: "sensation", material: "smoke", scale: "the size of a held breath", meaning: "already thinning" },
    { label: "the dog by the door", role: "person", material: "bone", scale: "knee-high", meaning: "waiting the way it always waits" },
    { label: "yesterday's clothes on the chair", role: "object", material: "cloth", scale: "a chair's worth", meaning: "proof that yesterday happened" },
    { label: "the smell of toast starting somewhere", role: "sensation", material: "smoke", scale: "drifts room to room", meaning: "somebody else is already awake" },
    { label: "my own reflection in the dark window", role: "person", material: "glass", scale: "life-sized", meaning: "not quite looking back the same way" },
  ],
  morning: [
    { label: "the kettle", role: "object", material: "metal", scale: "fits in one hand", meaning: "the first small task of the day" },
    { label: "the bus stop sign", role: "object", material: "metal", scale: "taller than me", meaning: "where the day officially begins" },
    { label: "a neighbor watering the plants", role: "person", material: "cloth", scale: "life-sized", meaning: "the same nod every morning" },
    { label: "the smell of wet pavement", role: "sensation", material: "water", scale: "the whole street", meaning: "it rained while I was asleep" },
    { label: "my badge on its lanyard", role: "object", material: "paper", scale: "fits in a pocket", meaning: "the thing that makes me someone at work" },
    { label: "the office door", role: "object", material: "glass", scale: "doorway-sized", meaning: "the boundary between home-me and work-me" },
    { label: "a coworker's coffee order", role: "sound", material: "static", scale: "a sentence long", meaning: "small talk that asks nothing of me" },
    { label: "the elevator mirror", role: "object", material: "metal", scale: "wall-sized", meaning: "a version of me going up" },
    { label: "the hum of the fluorescent light", role: "sound", material: "static", scale: "fills the ceiling", meaning: "the sound of being somewhere official" },
    { label: "a stack of unopened mail", role: "object", material: "paper", scale: "hand-sized", meaning: "things I'll deal with later, again" },
  ],
  midday: [
    { label: "the lunch tray", role: "object", material: "metal", scale: "tray-sized", meaning: "a pause built into the day" },
    { label: "the noise of the cafeteria", role: "sound", material: "static", scale: "fills the room", meaning: "everyone else's day happening at once" },
    { label: "a coworker's half-eaten sandwich", role: "object", material: "paper", scale: "hand-sized", meaning: "abandoned mid-thought" },
    { label: "the sun through the window", role: "sensation", material: "light", scale: "a bright rectangle on the table", meaning: "the day at its most awake" },
    { label: "my phone, face down", role: "object", material: "glass", scale: "palm-sized", meaning: "whatever is on it can wait" },
    { label: "the receipt in my pocket", role: "object", material: "paper", scale: "fits in two fingers", meaning: "evidence I bought something I don't remember choosing" },
    { label: "a stranger at the next table", role: "person", material: "cloth", scale: "life-sized", meaning: "close enough to overhear, easy to forget" },
    { label: "the vending machine's hum", role: "sound", material: "static", scale: "a corner of the room", meaning: "background I stopped noticing months ago" },
    { label: "the ice in my glass", role: "object", material: "ice", scale: "cube-sized", meaning: "melting a little faster than I expect" },
    { label: "the clock above the door", role: "object", material: "metal", scale: "wall-sized", meaning: "the thing that ends the pause" },
  ],
  afternoon: [
    { label: "the spreadsheet on my screen", role: "object", material: "light", scale: "screen-sized", meaning: "the shape of the afternoon's work" },
    { label: "a meeting invite", role: "object", material: "paper", scale: "fits on a screen", meaning: "the next hour, already spoken for" },
    { label: "the radiator ticking", role: "sound", material: "metal", scale: "a corner of the room", meaning: "the building settling into the day" },
    { label: "my tired hand on the desk", role: "sensation", material: "bone", scale: "hand-sized", meaning: "the day starting to cost something" },
    { label: "the long shadow of the window frame", role: "sensation", material: "light", scale: "stretches across the floor", meaning: "the sun starting its slow retreat" },
    { label: "a plant on the windowsill", role: "object", material: "cloth", scale: "knee-high", meaning: "someone's small attempt at care" },
    { label: "the printer jamming again", role: "sound", material: "static", scale: "fills the hallway", meaning: "the day's one small, forgivable failure" },
    { label: "a coworker leaving early", role: "person", material: "cloth", scale: "life-sized", meaning: "a version of freedom I don't have yet" },
    { label: "the last of the coffee, gone cold", role: "object", material: "water", scale: "cup-sized", meaning: "something I meant to finish and didn't" },
    { label: "my own handwriting in the margin", role: "object", material: "paper", scale: "line-sized", meaning: "a note from an earlier, more certain version of me" },
  ],
  dusk: [
    { label: "the walk to the train", role: "sensation", material: "stone", scale: "the length of a block", meaning: "the day changing hands" },
    { label: "the orange light on the buildings", role: "sensation", material: "light", scale: "the whole skyline", meaning: "the one hour the city looks kind" },
    { label: "a stranger's silhouette ahead", role: "person", material: "smoke", scale: "life-sized", meaning: "someone going somewhere I'll never know" },
    { label: "the train doors closing", role: "sound", material: "metal", scale: "a single loud moment", meaning: "the small relief of making it in time" },
    { label: "my reflection in the train window", role: "person", material: "glass", scale: "life-sized", meaning: "laid over the city passing behind it" },
    { label: "the smell of someone's dinner starting early", role: "sensation", material: "smoke", scale: "drifts from a window", meaning: "someone else's evening, already ahead of mine" },
    { label: "the streetlights coming on one by one", role: "object", material: "light", scale: "the length of the street", meaning: "the day being told, gently, that it's ending" },
    { label: "a dropped glove on the platform", role: "object", material: "cloth", scale: "hand-sized", meaning: "someone's small, unrecoverable loss" },
    { label: "the announcement I don't quite catch", role: "sound", material: "static", scale: "fills the platform", meaning: "information that isn't really for me" },
    { label: "my own tiredness, finally admitted", role: "sensation", material: "ash", scale: "the whole body", meaning: "the day's weight, arriving late" },
  ],
  evening: [
    { label: "the key in the door", role: "object", material: "metal", scale: "fits in one hand", meaning: "the sound of arriving somewhere mine" },
    { label: "the smell of dinner cooking", role: "sensation", material: "smoke", scale: "fills the apartment", meaning: "someone thought of me before I got home" },
    { label: "the television, half-watched", role: "sound", material: "static", scale: "fills the room", meaning: "company that doesn't ask anything of me" },
    { label: "a voicemail I haven't listened to", role: "sound", material: "static", scale: "a few seconds long", meaning: "something I'm choosing to postpone" },
    { label: "the warm plate in my hands", role: "sensation", material: "stone", scale: "plate-sized", meaning: "the day's one guaranteed comfort" },
    { label: "the window going dark", role: "object", material: "glass", scale: "window-sized", meaning: "the outside world quietly leaving" },
    { label: "a photograph on the shelf", role: "object", material: "paper", scale: "hand-sized", meaning: "a version of the day that already happened once" },
    { label: "the couch cushion, still warm from earlier", role: "sensation", material: "cloth", scale: "seat-sized", meaning: "proof someone else was just here" },
    { label: "the sound of a neighbor's door", role: "sound", material: "static", scale: "a single thud", meaning: "the building breathing around me" },
    { label: "my own tired face in the bathroom mirror", role: "person", material: "glass", scale: "life-sized", meaning: "the day, worn a little thin" },
  ],
  night: [
    { label: "the lamp by the bed", role: "object", material: "light", scale: "fits on a nightstand", meaning: "the last small choice of the day" },
    { label: "the ceiling, half-lit", role: "sensation", material: "static", scale: "the whole room", meaning: "the place my thoughts go before sleep" },
    { label: "the sound of the building settling", role: "sound", material: "metal", scale: "a distant tick", meaning: "the world continuing without me" },
    { label: "the blanket, pulled up", role: "object", material: "cloth", scale: "bed-sized", meaning: "the day formally ending" },
    { label: "a half-remembered conversation from earlier", role: "sound", material: "smoke", scale: "a few sentences", meaning: "something I'll get wrong by tomorrow" },
    { label: "the dark shape of the chair across the room", role: "object", material: "ash", scale: "chair-sized", meaning: "ordinary furniture wearing the dark differently" },
    { label: "my own breathing, slowing", role: "sensation", material: "static", scale: "the whole body", meaning: "the last thing I'm sure of" },
    { label: "the clock's green glow", role: "object", material: "light", scale: "fits in one glance", meaning: "the number that will judge tomorrow-me" },
    { label: "the space where someone usually is", role: "person", material: "smoke", scale: "person-shaped", meaning: "presence, or the memory of it" },
    { label: "the last thought before sleep, already dissolving", role: "sensation", material: "water", scale: "the size of a held breath", meaning: "whatever today was, going under with me" },
  ],
  "late-night": [
    { label: "the blue light of the phone screen", role: "object", material: "light", scale: "fits in one hand", meaning: "the last conversation I'm having with anyone tonight" },
    { label: "the refrigerator's hum through the wall", role: "sound", material: "static", scale: "a distant drone", meaning: "the only other thing still awake" },
    { label: "a half-finished glass on the nightstand", role: "object", material: "glass", scale: "palm-sized", meaning: "a decision I made hours ago and forgot" },
    { label: "the street outside, gone quiet", role: "sensation", material: "static", scale: "the whole block", meaning: "everyone else's day already over" },
    { label: "my own eyes, stinging from the screen", role: "sensation", material: "light", scale: "just my face", meaning: "proof I should have stopped an hour ago" },
    { label: "the ceiling fan's slow turn", role: "object", material: "metal", scale: "room-sized", meaning: "marking time I'm not supposed to still be awake for" },
  ],
  midnight: [
    { label: "the exact moment the date changes", role: "sensation", material: "static", scale: "no size at all, just a feeling", meaning: "one day quietly becoming another" },
    { label: "the house, fully asleep around me", role: "place", material: "wax", scale: "the whole building", meaning: "everyone else has stopped needing anything from me" },
    { label: "a car passing outside, far off", role: "sound", material: "metal", scale: "a few seconds long", meaning: "someone else's night, going somewhere" },
    { label: "the clock's two hands, stacked", role: "object", material: "metal", scale: "fits in one glance", meaning: "the middle of the night, officially" },
    { label: "my own shadow on the ceiling", role: "person", material: "ash", scale: "room-sized", meaning: "a version of me the lamp invented" },
    { label: "the silence with a shape to it", role: "sensation", material: "static", scale: "the whole room", meaning: "quiet enough to hear my own pulse" },
  ],
  "pre-dawn": [
    { label: "the sky, not yet decided on a color", role: "sensation", material: "light", scale: "the whole horizon", meaning: "the night giving up its grip a little" },
    { label: "the first bird, testing one note", role: "sound", material: "static", scale: "a single sound", meaning: "something deciding it's nearly morning" },
    { label: "the cold air through a cracked window", role: "sensation", material: "ice", scale: "just my face", meaning: "the last of the night, on its way out" },
    { label: "the streetlamp, still on out of habit", role: "object", material: "light", scale: "taller than me", meaning: "lighting a street nobody's using yet" },
    { label: "my own breath, visible for a moment", role: "sensation", material: "smoke", scale: "the size of a held breath", meaning: "proof it's colder than it looks" },
    { label: "the milk truck, or something like it, somewhere off", role: "sound", material: "metal", scale: "a distant rattle", meaning: "someone's day starting before mine does" },
  ],
  "next-morning": [
    { label: "the alarm, going off a second time in this dream", role: "object", material: "metal", scale: "fits in one hand", meaning: "the day insisting on starting again" },
    { label: "the same light through the same curtain", role: "sensation", material: "light", scale: "window-sized", meaning: "morning arriving as if for the first time" },
    { label: "yesterday's cup, still on the counter", role: "object", material: "glass", scale: "palm-sized", meaning: "a small unfinished thread from the day before" },
    { label: "the mirror, showing a face that slept or didn't", role: "person", material: "glass", scale: "life-sized", meaning: "not entirely sure which day this is" },
    { label: "the smell of coffee starting again", role: "sensation", material: "smoke", scale: "drifts room to room", meaning: "the ritual repeating whether I'm ready or not" },
    { label: "the door, waiting to be opened again", role: "object", material: "wax", scale: "doorway-sized", meaning: "another day on the other side of it" },
  ],
};

export const ALL_MATERIALS: Material[] = [
  "glass", "smoke", "paper", "water", "stone", "wax", "cloth",
  "metal", "light", "ash", "bone", "thread", "ice", "static",
];

/**
 * All entries are adjective/noun-phrase complements, so "is/was/isn't ___"
 * stays grammatical for every value — no verb-phrase forms like "fits in
 * one hand" here, which broke templates built around "it's ___".
 */
export const SCALE_POOL: string[] = [
  "the size of one hand", "palm-sized", "knee-high", "life-sized", "wall-sized",
  "the size of the whole room", "the size of a held breath", "hand-sized",
  "the length of a city block", "taller than me", "the size of a thumbnail",
  "the size of a doorway", "the size of the whole street", "cup-sized",
  "the size of the whole skyline", "pocket-sized", "the size of the building itself",
  "no size at all, just a feeling",
];

export const ROLE_POOL: FragmentRole[] = ["object", "person", "place", "sensation", "sound"];
