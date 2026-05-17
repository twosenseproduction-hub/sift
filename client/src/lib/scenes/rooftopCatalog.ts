/**
 * Rooftop scene catalog — loads `public/scenes/rooftop/catalog.json`.
 * Sky = CSS linear-gradient (small, easy to tune). Horizon = optional SVG/PNG silhouette.
 */

export type SkyGradientStop = { pos: number; color: string };

export type SkyGradient = {
  angleDeg: number;
  stops: SkyGradientStop[];
};

export type RooftopVariantAssets = {
  silhouette?: string;
  thumb?: string;
};

export type RooftopSkylineVariant = {
  id: string;
  displayName: string;
  aliases: string[];
  skyGradient: SkyGradient;
  assets: RooftopVariantAssets;
};

export type RooftopCatalog = {
  scene: "rooftop";
  version: number;
  defaultVariantId: string;
  skyMode?: string;
  notes?: string;
  slots: {
    "rooftop.skyline": {
      label: string;
      variants: RooftopSkylineVariant[];
    };
  };
};

const CATALOG_URL = "/scenes/rooftop/catalog.json";

let cached: RooftopCatalog | null = null;

export async function loadRooftopCatalog(): Promise<RooftopCatalog> {
  if (cached) return cached;
  const res = await fetch(CATALOG_URL, { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error(`Rooftop catalog failed: ${res.status}`);
  }
  cached = (await res.json()) as RooftopCatalog;
  return cached;
}

export function clearRooftopCatalogCache() {
  cached = null;
}

export function skylineVariants(catalog: RooftopCatalog): RooftopSkylineVariant[] {
  return catalog.slots["rooftop.skyline"].variants;
}

export function getSkylineVariantById(
  catalog: RooftopCatalog,
  id: string,
): RooftopSkylineVariant | undefined {
  return skylineVariants(catalog).find((v) => v.id === id);
}

function normalizePhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match user text (e.g. "make my skyline Sacramento CA") to a catalog variant.
 * Longest alias substring wins; ties prefer first in catalog order.
 */
export function resolveSkylineFromText(
  catalog: RooftopCatalog,
  text: string,
): { variantId: string; matchedAlias: string | null; score: number } {
  const hay = normalizePhrase(text);
  if (!hay) {
    return { variantId: catalog.defaultVariantId, matchedAlias: null, score: 0 };
  }

  let best: { variantId: string; matchedAlias: string; score: number } | null =
    null;

  for (const v of skylineVariants(catalog)) {
    for (const alias of v.aliases) {
      const needle = normalizePhrase(alias);
      if (!needle) continue;
      if (hay.includes(needle)) {
        const score = needle.length;
        if (!best || score > best.score) {
          best = { variantId: v.id, matchedAlias: alias, score };
        }
      }
    }
  }

  if (!best) {
    return { variantId: catalog.defaultVariantId, matchedAlias: null, score: 0 };
  }
  return { variantId: best.variantId, matchedAlias: best.matchedAlias, score: best.score };
}

export function skyGradientCss(g: SkyGradient): string {
  const stops = g.stops.map((s) => `${s.color} ${Math.round(s.pos * 100)}%`).join(", ");
  return `linear-gradient(${g.angleDeg}deg, ${stops})`;
}
