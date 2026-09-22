/**
 * Stage 2 visual-prototype stand-ins only. These are the user's reference
 * photographs (already cropped to remove Instagram chrome), never real
 * generation output — every place one of these renders, it carries a
 * visible "reference photo" badge, and none of this list is ever wired
 * into a saved run, an export, or the Dream Archive.
 */
export interface PlaceholderAsset {
  id: string;
  src: string;
  /** in-fiction dream-file title, not the source post's caption */
  title: string;
  timeOfDay: string;
}

export const PLACEHOLDER_ASSETS: PlaceholderAsset[] = [
  { id: "cleaning-clouds", src: "/dream-files/ref-cleaning-clouds.jpg", title: "The clouds needed wiping down", timeOfDay: "morning" },
  { id: "cloud-living-room", src: "/dream-files/ref-cloud-living-room.jpg", title: "A cloud had let itself in", timeOfDay: "midday" },
  { id: "balloon-dining-room", src: "/dream-files/ref-balloon-dining-room.jpg", title: "Tea was ready, so were the balloons", timeOfDay: "afternoon" },
  { id: "iron-snowman", src: "/dream-files/ref-iron-snowman.jpg", title: "Pressing the wrinkles out of winter", timeOfDay: "afternoon" },
  { id: "clock-face", src: "/dream-files/ref-clock-face.jpg", title: "She wore the hour on her face", timeOfDay: "dusk" },
  { id: "swans-forest", src: "/dream-files/ref-swans-forest.jpg", title: "The lake remembered being a forest", timeOfDay: "evening" },
  { id: "cat-seawater", src: "/dream-files/ref-cat-seawater.jpg", title: "The cat minded the tide instead", timeOfDay: "evening" },
  { id: "heart-cottage", src: "/dream-files/ref-heart-cottage.jpg", title: "A house that breathed when it was happy", timeOfDay: "night" },
];
