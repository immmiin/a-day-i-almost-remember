/**
 * The public, static record of every saved generation —
 * public/generations/index.json, written only by the local backend
 * (server/gallery.mjs) and shipped with every build. Reading it needs no
 * backend, so Home and Dream Archive work on a static deploy.
 */

export interface GalleryEntry {
  id: string;
  /** original PNG, kept for print/PDF */
  filename: string;
  /** display copy the site loads */
  webp: string;
  width: number;
  height: number;
  caption: string;
  runId: string | null;
  sceneNumber: number | null;
  timeOfDay: string | null;
  remembers: string[];
  forgets: string[];
  passesForward: string[];
  createdAt: string;
}

const GALLERY_BASE = `${import.meta.env.BASE_URL}generations/`;

/**
 * Newest first. Resolves to [] when the manifest is genuinely empty, and to
 * null (with a console error saying why) when it can't be loaded or read —
 * callers must not mistake a failure for "no generations yet". Never rejects.
 */
export async function loadGallery(): Promise<GalleryEntry[] | null> {
  const url = `${GALLERY_BASE}index.json`;
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) {
      console.error(`[gallery] ${url} returned ${res.status}`);
      return null;
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      console.error(`[gallery] ${url} is not a JSON array`);
      return null;
    }
    return (data as GalleryEntry[])
      .filter((e) => e && typeof e.webp === "string")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  } catch (err) {
    console.error(`[gallery] couldn't load ${url} — is the site server running?`, err);
    return null;
  }
}

export function galleryImageUrl(entry: GalleryEntry): string {
  return `${GALLERY_BASE}${encodeURIComponent(entry.webp)}`;
}
