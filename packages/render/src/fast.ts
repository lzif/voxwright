// SPDX-License-Identifier: AGPL-3.0-only

// Per-face textures for a block treated as a textured cube: the "fast" tier's
// resolution, also used by the build guide. It picks one texture per cube face
// from the blockstate's model, falls back to a flat colour, and applies the
// plains biome tint to real textures only.

import type { AssetSource } from "./assets.ts";
import { fallbackColor, hasFlatColor } from "./blocks.ts";
import { DEFAULT_PROPS, TINT_TABLE } from "./constants.ts";
import { newImage, type RasterImage, tint } from "./image.ts";
import { type FaceName, splitBlockstate } from "./models.ts";

const TEMPLATE_PARENTS = new Set(["cube_all", "cube_column", "cube", "cube_mirrored"]);
const FACES: readonly FaceName[] = ["up", "down", "north", "south", "east", "west"];

type Json = Record<string, unknown>;
const asObject = (v: unknown): Json | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : null;
const afterColon = (s: string): string => s.slice(s.indexOf(":") + 1);

interface Resolved {
  images: Map<string, RasterImage | null>;
  parentLeaf: string | null;
  tintedVars: Set<string>;
}

/**
 * Pick the variant contradicting no explicit prop, best default fit (the same
 * rule as the model path; kept local so this tier stays self-contained).
 */
function matchVariant(variants: Json, explicit: Record<string, string>): Json | null {
  let best: unknown = null;
  let bestScore: [number, number] | null = null;
  for (const [key, value] of Object.entries(variants)) {
    const pairs = key ? key.split(",").filter((p) => p) : [];
    let nExp = 0;
    let nDef = 0;
    let ok = true;
    for (const p of pairs) {
      const eq = p.indexOf("=");
      const k = eq === -1 ? p : p.slice(0, eq);
      const v = eq === -1 ? "" : p.slice(eq + 1);
      if (Object.hasOwn(explicit, k)) {
        if (explicit[k] !== v) {
          ok = false;
          break;
        }
        nExp++;
      } else if (DEFAULT_PROPS[k] === v) nDef++;
    }
    if (!ok) continue;
    if (
      bestScore === null ||
      nExp > bestScore[0] ||
      (nExp === bestScore[0] && nDef > bestScore[1])
    ) {
      best = value;
      bestScore = [nExp, nDef];
    }
  }
  if (Array.isArray(best)) best = best.length > 0 ? best[0] : null;
  return asObject(best);
}

/** Texture variables to images, the template parent, and which variables faces tint. Never throws. */
function resolveModelTextures(
  blockName: string,
  props: Record<string, string>,
  assets: AssetSource,
): Resolved {
  const empty: Resolved = { images: new Map(), parentLeaf: null, tintedVars: new Set() };
  try {
    const bs = asObject(assets.readJson(`blockstates/${afterColon(blockName)}.json`));
    if (bs === null) return empty;
    let modelRef: string | null = null;
    const variants = asObject(bs.variants);
    if (variants !== null && Object.keys(variants).length > 0) {
      const v = matchVariant(variants, props);
      if (v?.model) modelRef = v.model as string;
    } else if (Array.isArray(bs.multipart) && bs.multipart.length > 0) {
      for (const c of bs.multipart as Json[]) {
        let apply = c.apply;
        if (Array.isArray(apply)) apply = apply.length > 0 ? apply[0] : null;
        const a = asObject(apply);
        if (a?.model) {
          modelRef = a.model as string;
          break;
        }
      }
    }
    if (!modelRef) return empty;

    const chain: Json[] = [];
    const seen = new Set<string>();
    let ref = modelRef;
    for (let i = 0; i < 8; i++) {
      const rel = afterColon(ref);
      if (seen.has(rel)) break;
      seen.add(rel);
      const model = asObject(assets.readJson(`models/${rel}.json`));
      if (model === null) break;
      chain.push(model);
      if (!model.parent || typeof model.parent !== "string") break;
      ref = model.parent;
    }
    if (chain.length === 0) return empty;

    const textures: Record<string, unknown> = {};
    for (const model of [...chain].reverse())
      Object.assign(textures, asObject(model.textures) ?? {});
    const sprite = (value: unknown): unknown => {
      const o = asObject(value);
      return o !== null ? (o.sprite ?? "") : value;
    };
    const resolve = (value: unknown, depth = 0): unknown => {
      const v = sprite(value);
      if (typeof v !== "string" || !v.startsWith("#") || depth > 8) return v;
      return resolve(textures[v.slice(1)] ?? "", depth + 1);
    };

    // The template parent: the first known template leaf walking down from the variant's model.
    const leaves: string[] = [];
    ref = modelRef;
    for (const model of chain) {
      leaves.push((afterColon(ref).split("/").pop() as string) ?? "");
      ref = typeof model.parent === "string" ? model.parent : "";
    }
    const parentLeaf = leaves.find((l) => TEMPLATE_PARENTS.has(l)) ?? null;

    const images = new Map<string, RasterImage | null>();
    for (const [name, value] of Object.entries(textures)) {
      const target = resolve(value);
      images.set(
        name,
        typeof target === "string" && target !== ""
          ? assets.texture(afterColon(target), { firstFrameOnly: false })
          : null,
      );
    }

    // Variables referenced by faces with tintindex >= 0, from the nearest chain entry defining elements.
    const tintedVars = new Set<string>();
    for (const model of chain) {
      if (Array.isArray(model.elements) && model.elements.length > 0) {
        for (const el of model.elements as unknown[]) {
          const faces = asObject(asObject(el)?.faces) ?? {};
          for (const face of Object.values(faces)) {
            const f = asObject(face);
            if (f === null) continue;
            const ti = f.tintindex ?? -1;
            if (typeof ti === "number" && Number.isInteger(ti) && ti >= 0) {
              const v = String(f.texture ?? "").replace(/^#+/, "");
              if (images.has(v)) tintedVars.add(v);
            }
          }
        }
        break;
      }
    }
    return { images, parentLeaf, tintedVars };
  } catch {
    return empty;
  }
}

/** Map each cube face to a texture variable name, by the parent-type rule. */
function faceTexVars(
  images: Map<string, RasterImage | null>,
  parentLeaf: string | null,
): Record<FaceName, string | null> {
  const keys = new Set([...images].filter(([, v]) => v !== null).map(([k]) => k));
  const all = (v: string | null): Record<FaceName, string | null> => ({
    up: v,
    down: v,
    north: v,
    south: v,
    east: v,
    west: v,
  });
  if (parentLeaf === "cube_all") return all(keys.has("all") ? "all" : null);
  if (parentLeaf === "cube_column") {
    const end = keys.has("end") ? "end" : null;
    const side = keys.has("side") ? "side" : null;
    return { up: end, down: end, north: side, south: side, east: side, west: side };
  }
  const pick = (...cands: string[]): string | null => cands.find((c) => keys.has(c)) ?? null;
  // Last resort for non-cube models (fences, torches, ...): any usable texture beats a flat colour.
  // The Python original iterated a set here, so its pick depended on the string-hash seed it
  // pins at startup. This takes the first usable texture in model order instead.
  const anyTex = [...keys].find((k) => k !== "particle") ?? null;
  const side = pick("side", "front", "all", "texture") ?? anyTex;
  return {
    up: pick("top", "up", "end", "all", "texture") ?? side,
    down: pick("bottom", "down", "end", "all", "texture") ?? side,
    north: side,
    south: side,
    east: side,
    west: side,
  };
}

/** Per-face textures for one palette entry, with flat fallback colours. */
export function buildFaceTextures(
  block: string,
  assets: AssetSource | null,
  fallbackBlocks: Set<string> = new Set(),
): Record<FaceName, RasterImage> {
  const [name, props] = splitBlockstate(block);
  const resolved =
    assets === null
      ? { images: new Map(), parentLeaf: null, tintedVars: new Set<string>() }
      : resolveModelTextures(name, props, assets);
  const vars = faceTexVars(resolved.images, resolved.parentLeaf);
  const tintRgb = Object.hasOwn(TINT_TABLE, name) ? TINT_TABLE[name] : undefined;
  const out = {} as Record<FaceName, RasterImage>;
  for (const face of FACES) {
    const v = vars[face];
    let img = v ? (resolved.images.get(v) ?? null) : null;
    if (img === null) {
      // Fluids, chests and banners are intentional approximations, not missing-asset warnings.
      if (!hasFlatColor(name)) fallbackBlocks.add(name);
      img = newImage(16, 16, fallbackColor(name));
    } else if (v && resolved.tintedVars.has(v) && tintRgb !== undefined) {
      img = tint(img, tintRgb);
    }
    out[face] = img;
  }
  return out;
}
