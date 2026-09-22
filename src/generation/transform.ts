import type { DistortionAxis, DistortionRecord, Fragment, Material } from "./types";
import { ALL_MATERIALS, SCALE_POOL, ROLE_POOL } from "./fragments";
import type { Rng } from "./rng";

const MATERIAL_CONSEQUENCE: Record<Material, string> = {
  glass: "cold and faintly see-through at the edges",
  smoke: "loose at the edges, like it might drift if I let go",
  paper: "thin enough now that light comes through it",
  water: "holding its shape only for as long as I watch it",
  stone: "heavier in my hand than it has any right to be",
  wax: "soft at the corners, slowly losing its shape",
  cloth: "frayed in a way that feels older than the day itself",
  metal: "cold to the touch, and colder the longer I hold it",
  light: "hard to look at directly, though it doesn't hurt",
  ash: "leaving a faint grey mark on everything it touches",
  bone: "dry, and quieter than it used to be",
  thread: "unraveling slowly from one visible end",
  ice: "melting slower than it should, given the room",
  static: "humming faintly, just under where I can properly hear it",
};

const MEANING_MUTATIONS: Array<(oldMeaning: string) => string> = [
  (m) => `${m} — except now it also seems to know my name`,
  (m) => `still ${m.toLowerCase()}, but it has started watching me back`,
  (m) => `${m}, though it's been here far longer than today, I'm suddenly sure`,
  (m) => `${m} — and I accept, without needing to ask why, that it was always this way`,
  (m) => `no longer just ${m.toLowerCase()}; it feels like it's waiting for something`,
  (m) => `${m}, the way it always has, if I'm honest about it now`,
  (m) => `${m} — the thought arrives that it might outlast the day itself`,
];

export function pickDistortionAxis(rng: Rng): DistortionAxis {
  const axes: DistortionAxis[] = ["role", "scale", "material", "meaning"];
  return rng.pick(axes);
}

export function distort(fragment: Fragment, axis: DistortionAxis, rng: Rng): { fragment: Fragment; record: DistortionRecord } {
  switch (axis) {
    case "role": {
      const options = ROLE_POOL.filter((r) => r !== fragment.role);
      const newRole = rng.pick(options);
      const before = fragment.role;
      return {
        fragment: { ...fragment, role: newRole },
        record: { fragmentId: fragment.id, axis, before, after: newRole },
      };
    }
    case "scale": {
      const options = SCALE_POOL.filter((s) => s !== fragment.scale);
      const newScale = rng.pick(options);
      return {
        fragment: { ...fragment, scale: newScale },
        record: { fragmentId: fragment.id, axis, before: fragment.scale, after: newScale },
      };
    }
    case "material": {
      const options = ALL_MATERIALS.filter((m) => m !== fragment.material);
      const newMaterial = rng.pick(options);
      const consequence = MATERIAL_CONSEQUENCE[newMaterial];
      return {
        fragment: { ...fragment, material: newMaterial, meaning: `${fragment.meaning} — ${consequence}` },
        record: { fragmentId: fragment.id, axis, before: fragment.material, after: newMaterial },
      };
    }
    case "meaning": {
      const mutate = rng.pick(MEANING_MUTATIONS);
      const newMeaning = mutate(fragment.meaning);
      return {
        fragment: { ...fragment, meaning: newMeaning },
        record: { fragmentId: fragment.id, axis, before: fragment.meaning, after: newMeaning },
      };
    }
  }
}
