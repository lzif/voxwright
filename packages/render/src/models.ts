// SPDX-License-Identifier: AGPL-3.0-only

// Blockstate -> model -> textured quads, from the vanilla client assets.
//
// Each blockstate is resolved through its blockstate JSON, model JSON and
// textures, and the real model cuboids (`from`/`to` boxes) become quads in
// block-local 0..1 coordinates. Stairs get their true multi-box profile, walls
// their real post and arms, lanterns and trapdoors their real shapes, because
// the geometry comes straight from the model files.
//
// Orientation (verified against the vanilla assets):
// - Blockstate `y` rotations run clockwise viewed from above.
// - Blockstate `x` rotations use the right-hand rule about +X.
// - When both are present, X applies first, then Y.
//
// `uvlock`: UVs are assigned painted-on in model space, the only
// density-preserving behaviour. With `uvlock`, side faces additionally get v0
// pinned to the top so the texture stays upright (top-half stairs).
//
// Determinism: variant selection is most-specific match with ties going to
// file order; a weighted variant list always takes its first entry;
// multipart contributes every case whose `when` matches, in file order.

import type { AssetSource } from "./assets.ts";
import { DEFAULT_PROPS, type Rgb, TINT_TABLE } from "./constants.ts";
import {
  crop,
  flipLeftRight,
  flipTopBottom,
  newImage,
  type RasterImage,
  rotate90Ccw,
  rotate90Cw,
  rotate180,
  shade,
  tint,
} from "./image.ts";
import { floorDivMod, pyRound } from "./pymath.ts";

export type Vec3 = [number, number, number];

/**
 * A resolved quad. `points` are four corners in block-local 0..1 coordinates
 * in UV order `[(u0,v0), (u0,v1), (u1,v1), (u1,v0)]`. `normal` is the true
 * world-space normal (used for back-face culling). `image` is cropped to the
 * face's UV rect, with rotation and mirroring applied, shaded for the world
 * normal unless `flat`. `cull` is the face's `cullface` direction, snapped, or
 * `null` (only faces with a cullface are neighbour-culled). `flat` skips
 * directional shading and ambient occlusion.
 */
export interface Quad {
  points: Vec3[];
  normal: Vec3;
  image: RasterImage;
  cull: Vec3 | null;
  flat: boolean;
}

type FaceName = "up" | "down" | "north" | "south" | "west" | "east";

/** Classic Minecraft-ish face shading, keyed by the snapped world normal. */
const SHADES: Record<string, number> = {
  "0,1,0": 1.0,
  "0,-1,0": 0.5,
  "0,0,-1": 0.8,
  "0,0,1": 0.8,
  "1,0,0": 0.6,
  "-1,0,0": 0.6,
};

const FACE_NORMALS: Record<FaceName, Vec3> = {
  up: [0, 1, 0],
  down: [0, -1, 0],
  north: [0, 0, -1],
  south: [0, 0, 1],
  west: [-1, 0, 0],
  east: [1, 0, 0],
};

/** Per face: `[uAxis, uMinIsU0, vAxis, vMinIsV0]`, so textures read upright and unmirrored from outside. */
const UV_AXES: Record<FaceName, readonly [number, boolean, number, boolean]> = {
  north: [0, false, 1, false],
  south: [0, true, 1, false],
  west: [2, true, 1, false],
  east: [2, false, 1, false],
  up: [0, true, 2, true],
  down: [0, false, 2, true],
};

const isFace = (n: string): n is FaceName => Object.hasOwn(FACE_NORMALS, n);

// -- 3D rotation helpers (block-local 0..1 coords) ---------------------------------

function rotY(p: Vec3, degrees: number): Vec3 {
  let [x, y, z] = p;
  for (let i = 0; i < floorDivMod(degrees, 90, 4); i++) [x, y, z] = [1.0 - z, y, x];
  return [x, y, z];
}
function rotYDir(v: Vec3, degrees: number): Vec3 {
  let [x, y, z] = v;
  for (let i = 0; i < floorDivMod(degrees, 90, 4); i++) [x, y, z] = [-z, y, x];
  return [x, y, z];
}
function rotX(p: Vec3, degrees: number): Vec3 {
  let [x, y, z] = p;
  for (let i = 0; i < floorDivMod(degrees, 90, 4); i++) {
    const ny = 1.0 - z;
    z = y;
    y = ny;
  }
  return [x, y, z];
}
function rotXDir(v: Vec3, degrees: number): Vec3 {
  let [x, y, z] = v;
  for (let i = 0; i < floorDivMod(degrees, 90, 4); i++) {
    const ny = -z;
    z = y;
    y = ny;
  }
  return [x, y, z];
}
/** X first, then Y (vanilla order). */
const applyModelRotation = (p: Vec3, xDeg: number, yDeg: number): Vec3 => rotY(rotX(p, xDeg), yDeg);
const applyModelRotationDir = (v: Vec3, xDeg: number, yDeg: number): Vec3 =>
  rotYDir(rotXDir(v, xDeg), yDeg);

interface ElementRotation {
  origin?: number[];
  axis?: string;
  angle?: number;
  rescale?: boolean;
}

/** Rodrigues rotation of `p` about an axis through `origin` (in 1/16 units). */
function applyElementRotation(
  p: Vec3,
  origin: readonly number[],
  axis: string,
  angleDeg: number,
): Vec3 {
  const [ox, oy, oz] = origin.map((c) => c / 16.0) as Vec3;
  const theta = (angleDeg * Math.PI) / 180;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const k: Vec3 = axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
  const [vx, vy, vz] = [p[0] - ox, p[1] - oy, p[2] - oz];
  const cx = k[1] * vz - k[2] * vy;
  const cy = k[2] * vx - k[0] * vz;
  const cz = k[0] * vy - k[1] * vx;
  const dot = k[0] * vx + k[1] * vy + k[2] * vz;
  return [
    vx * c + cx * s + k[0] * dot * (1 - c) + ox,
    vy * c + cy * s + k[1] * dot * (1 - c) + oy,
    vz * c + cz * s + k[2] * dot * (1 - c) + oz,
  ];
}

/**
 * Vanilla `rescale`: for 45 degree element rotations, widen the element by
 * root 2 along the axes perpendicular to the rotation axis, around `origin`,
 * so the rotated cross-section still spans the original footprint.
 */
function applyRescale(p: Vec3, origin: readonly number[], axis: string): Vec3 {
  const s = Math.sqrt(2);
  const o = origin.map((c) => c / 16.0);
  const ax = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  const q: Vec3 = [...p];
  for (let i = 0; i < 3; i++)
    if (i !== ax) q[i] = (o[i] as number) + ((q[i] as number) - (o[i] as number)) * s;
  return q;
}

// -- model resolution ----------------------------------------------------------------

type Json = Record<string, unknown>;
const asObject = (v: unknown): Json | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : null;
const lastAfterColon = (s: string): string => s.slice(s.indexOf(":") + 1);

interface ResolvedModel {
  elements: Json[];
  images: Map<string, RasterImage | null>;
  ambientOcclusion: boolean;
}

/**
 * Walk the parent chain (cycle-safe, depth 8): textures merge with the child
 * overriding the parent; elements come from the nearest chain entry that
 * defines them, and `ambientocclusion` is read from that same entry.
 */
function resolveModel(modelRef: string, assets: AssetSource): ResolvedModel | null {
  const chain: Json[] = [];
  const seen = new Set<string>();
  let ref = modelRef;
  for (let i = 0; i < 8; i++) {
    const rel = lastAfterColon(ref);
    if (seen.has(rel)) break;
    seen.add(rel);
    const model = asObject(assets.readJson(`models/${rel}.json`));
    if (model === null) break;
    chain.push(model);
    const parent = model.parent;
    if (!parent || typeof parent !== "string") break;
    ref = parent;
  }
  if (chain.length === 0) return null;
  let elements: Json[] | null = null;
  let ambientOcclusion = true;
  for (const model of chain) {
    if (Array.isArray(model.elements) && model.elements.length > 0) {
      elements = model.elements as Json[];
      ambientOcclusion =
        model.ambientocclusion === undefined ? true : (model.ambientocclusion as boolean);
      break;
    }
  }
  if (elements === null) return null;

  const textures: Record<string, unknown> = {};
  for (const model of [...chain].reverse()) Object.assign(textures, asObject(model.textures) ?? {});

  const sprite = (value: unknown): unknown => {
    // 26.2+ texture metadata form: { "sprite": "...", ... }
    const o = asObject(value);
    return o !== null ? (o.sprite ?? "") : value;
  };
  const resolve = (value: unknown, depth = 0): unknown => {
    const v = sprite(value);
    if (typeof v !== "string" || !v.startsWith("#") || depth > 8) return v;
    return resolve(textures[v.slice(1)] ?? "", depth + 1);
  };
  const images = new Map<string, RasterImage | null>();
  for (const [name, value] of Object.entries(textures)) {
    const target = resolve(value);
    images.set(
      name,
      typeof target === "string" && target !== "" ? assets.texture(lastAfterColon(target)) : null,
    );
  }
  return { elements, images, ambientOcclusion };
}

// -- blockstate -> model applications ---------------------------------------------------

type Props = Record<string, string>;

/** Evaluate a multipart `when` clause against blockstate props. */
function whenMatches(when: unknown, props: Props): boolean {
  const w = asObject(when);
  if (w === null) return false;
  if ("OR" in w) return (w.OR as unknown[]).some((c) => whenMatches(c, props));
  if ("AND" in w) return (w.AND as unknown[]).every((c) => whenMatches(c, props));
  for (const [key, value] of Object.entries(w)) {
    const propVal = props[key];
    if (Array.isArray(value)) {
      if (propVal === undefined || !value.includes(propVal)) return false;
    } else if (propVal !== value) return false;
  }
  return true;
}

/**
 * Pick the variant contradicting no explicit prop, best default fit. A variant
 * is rejected only when a key pair contradicts an explicit prop; survivors
 * score `(explicit matches, default matches)`; ties keep file order.
 */
function matchVariant(variants: Json, explicit: Props, defaults: Props): Json | null {
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
      } else if (defaults[k] === v) nDef++;
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

export interface ModelApplication {
  model: string;
  x: number;
  y: number;
  uvlock: boolean;
}

const applicationOf = (v: Json): ModelApplication => ({
  model: v.model as string,
  x: Math.trunc(Number(v.x ?? 0)),
  y: Math.trunc(Number(v.y ?? 0)),
  uvlock: Boolean(v.uvlock ?? false),
});

/**
 * Models for a blockstate. Variants: the best match. Multipart: every
 * matching case, in file order. Empty when the blockstate is missing or
 * nothing matches.
 */
export function modelApplications(
  blockName: string,
  props: Props,
  assets: AssetSource,
): ModelApplication[] {
  const short = lastAfterColon(blockName);
  const bs = asObject(assets.readJson(`blockstates/${short}.json`));
  if (bs === null || Object.keys(bs).length === 0) return [];
  // Fill missing props from defaults so partial canonical blockstates still
  // match multipart `when` clauses.
  const full: Props = { ...DEFAULT_PROPS, ...props };
  const apps: ModelApplication[] = [];
  const variants = asObject(bs.variants);
  if (variants !== null && Object.keys(variants).length > 0) {
    const v = matchVariant(variants, props, DEFAULT_PROPS);
    if (v && v.model) apps.push(applicationOf(v));
  } else if (Array.isArray(bs.multipart) && bs.multipart.length > 0) {
    for (const rawCase of bs.multipart as Json[]) {
      const when = rawCase.when;
      if (when !== undefined && when !== null && !whenMatches(when, full)) continue;
      let apply = rawCase.apply;
      if (Array.isArray(apply)) apply = apply.length > 0 ? apply[0] : null;
      const a = asObject(apply);
      if (a && a.model) apps.push(applicationOf(a));
    }
  }
  return apps;
}

// -- quad construction -----------------------------------------------------------------------

/** Snap a near-axis normal to its dominant axis. */
function snapNormal(v: Vec3): Vec3 {
  let ax = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(v[i] as number) > Math.abs(v[ax] as number)) ax = i;
  const out: Vec3 = [0, 0, 0];
  out[ax] = (v[ax] as number) >= 0 ? 1.0 : -1.0;
  return out;
}

/** 4 corners of an element face (0..1 coords), in a fixed order. */
function faceBaseCorners(face: FaceName, f: Vec3, t: Vec3): Vec3[] {
  const [x0, y0, z0] = f;
  const [x1, y1, z1] = t;
  switch (face) {
    case "up":
      return [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ];
    case "down":
      return [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ];
    case "north":
      return [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y1, z0],
        [x0, y1, z0],
      ];
    case "south":
      return [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ];
    case "west":
      return [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ];
    case "east":
      return [
        [x1, y0, z0],
        [x1, y0, z1],
        [x1, y1, z1],
        [x1, y1, z0],
      ];
  }
}

/** Order 4 corners as `[(u0,v0), (u0,v1), (u1,v1), (u1,v0)]`. */
function orderCornersUv(corners: Vec3[], face: FaceName): Vec3[] {
  const [uAxis, uMinIsU0, vAxis, vMinIsV0] = UV_AXES[face];
  const key = (c: Vec3): [number, number] => {
    const u = c[uAxis] as number;
    const v = c[vAxis] as number;
    return [uMinIsU0 ? u : -u, vMinIsV0 ? v : -v];
  };
  const cmp = (a: Vec3, b: Vec3): number => {
    const [ka, kb] = [key(a), key(b)];
    return ka[0] - kb[0] || ka[1] - kb[1];
  };
  const s = [...corners].sort(cmp); // stable, like Python's sorted
  const p00 = s[0] as Vec3;
  const p11 = s[3] as Vec3;
  const mids = [s[1] as Vec3, s[2] as Vec3].sort(cmp);
  // Disambiguate by kv: max kv is (u0,v1), min kv is (u1,v0). Ties keep the first.
  let p01 = mids[0] as Vec3;
  let p10 = mids[0] as Vec3;
  for (const c of mids) {
    if (key(c)[1] > key(p01)[1]) p01 = c;
    if (key(c)[1] < key(p10)[1]) p10 = c;
  }
  return [p00, p01, p11, p10];
}

function faceUvRotation(img: RasterImage, rotation: number): RasterImage {
  const r = ((rotation % 360) + 360) % 360;
  if (r === 90) return rotate90Cw(img);
  if (r === 180) return rotate180(img);
  if (r === 270) return rotate90Ccw(img);
  return img;
}

/**
 * Resolve one blockstate to textured quads, or `null` when the caller should
 * fall back (no blockstate, no matching variant, missing model or elements).
 * `fallbackColor` paints faces whose texture is missing; such blocks are added
 * to `fallbackBlocks`.
 */
export function resolveBlockQuads(
  blockName: string,
  props: Props,
  assets: AssetSource,
  fallbackColor: Rgb,
  fallbackBlocks: Set<string> = new Set(),
): Quad[] | null {
  const apps = modelApplications(blockName, props, assets);
  if (apps.length === 0) return null;
  const quads: Quad[] = [];
  for (const { model, x: xDeg, y: yDeg, uvlock } of apps) {
    const resolved = resolveModel(model, assets);
    if (resolved === null) return null;
    const { elements, images, ambientOcclusion } = resolved;
    for (const el of elements) {
      if (!Array.isArray(el.from) || !Array.isArray(el.to)) return null; // corrupt element: degrade the block
      const f = (el.from as number[]).map((c) => c / 16.0) as Vec3;
      const t = (el.to as number[]).map((c) => c / 16.0) as Vec3;
      const elRot = asObject(el.rotation) as ElementRotation | null;
      const hasRot = elRot !== null && Object.keys(elRot).length > 0;
      const origin = elRot?.origin ?? [8, 8, 8];
      const axis = elRot?.axis ?? "y";
      const angle = elRot?.angle ?? 0;
      // Flat lighting: element "shade": false or model "ambientocclusion": false.
      const flat = el.shade === false || ambientOcclusion === false;
      const faces = asObject(el.faces) ?? {};
      for (const [faceName, rawFace] of Object.entries(faces)) {
        if (!isFace(faceName)) continue;
        const face = asObject(rawFace) ?? {};
        const corners = faceBaseCorners(faceName, f, t);

        const xform = (p: Vec3): Vec3 => {
          let q = p;
          if (hasRot) {
            if (elRot?.rescale) q = applyRescale(q, origin, axis); // 45 degree elements: widen by root 2
            q = applyElementRotation(q, origin, axis, angle);
          }
          return applyModelRotation(q, xDeg, yDeg);
        };
        const rotateDirThroughElement = (local: Vec3): Vec3 => {
          if (!hasRot) return local;
          // Offset from the rotation origin by the unit normal, rotate, subtract back.
          const n = applyElementRotation(
            [0.5 + local[0], 0.5 + local[1], 0.5 + local[2]],
            origin,
            axis,
            angle,
          );
          return [n[0] - 0.5, n[1] - 0.5, n[2] - 0.5];
        };

        const worldFloat = applyModelRotationDir(
          rotateDirThroughElement(FACE_NORMALS[faceName]),
          xDeg,
          yDeg,
        );
        const worldN = snapNormal(worldFloat);
        // Neighbour-cull direction: the face's cullface through the same transforms.
        let cull: Vec3 | null = null;
        const cf = face.cullface;
        if (typeof cf === "string" && isFace(cf)) {
          cull = snapNormal(
            applyModelRotationDir(rotateDirThroughElement(FACE_NORMALS[cf]), xDeg, yDeg),
          );
        }

        const texVar = String(face.texture ?? "").replace(/^#+/, "");
        let img = images.get(texVar) ?? null;
        const uv = (face.uv as number[] | undefined) ?? [0, 0, 16, 16];
        let u0: number;
        let v0: number;
        let u1: number;
        let v1: number;
        let flipH = false;
        let flipV = false;
        let hasRealTexture = false;
        if (img === null) {
          // Per-face graceful degradation to a flat colour; the block still renders.
          fallbackBlocks.add(blockName);
          img = newImage(16, 16, fallbackColor);
          [u0, v0, u1, v1] = [0, 0, 16, 16];
        } else {
          // Mirrored UVs: crop the un-mirrored rect, then flip the crop.
          [u0, v0, u1, v1] = uv as [number, number, number, number];
          flipH = u0 > u1;
          flipV = v0 > v1;
          if (flipH) [u0, u1] = [u1, u0];
          if (flipV) [v0, v1] = [v1, v0];
          hasRealTexture = true;
        }
        const [sx, sy] = [img.width / 16.0, img.height / 16.0];
        let piece = crop(
          img,
          pyRound(u0 * sx),
          pyRound(v0 * sy),
          pyRound(u1 * sx),
          pyRound(v1 * sy),
        );
        if (piece.width < 1 || piece.height < 1) continue;
        if (flipH) piece = flipLeftRight(piece);
        if (flipV) piece = flipTopBottom(piece);
        piece = faceUvRotation(piece, Math.trunc(Number(face.rotation ?? 0)));

        // Biome tint (plains default), multiplied into the per-face crop only.
        const ti = face.tintindex;
        const tintRgb = Object.hasOwn(TINT_TABLE, blockName) ? TINT_TABLE[blockName] : undefined;
        if (
          hasRealTexture &&
          typeof ti === "number" &&
          Number.isInteger(ti) &&
          ti >= 0 &&
          tintRgb !== undefined
        ) {
          piece = tint(piece, tintRgb);
        }

        // UV corner assignment: painted-on for both uvlock values.
        let ordered = orderCornersUv(corners, faceName).map(xform);
        if (uvlock) {
          // Pin v0 to the top on side faces, so x-rotated sides stay upright.
          if (Math.abs(worldN[1]) < 0.5 && (ordered[0] as Vec3)[1] < (ordered[1] as Vec3)[1]) {
            ordered = [ordered[1], ordered[0], ordered[3], ordered[2]] as Vec3[];
          }
        }
        const factor = flat ? 1.0 : (SHADES[worldN.join(",")] ?? 0.75);
        quads.push({
          points: ordered,
          normal: worldFloat,
          image: shade(piece, factor),
          cull,
          flat,
        });
      }
    }
  }
  return quads;
}

/** `'minecraft:oak_log[axis=y]'` gives `['minecraft:oak_log', { axis: 'y' }]`; trailing NBT is ignored. */
export function splitBlockstate(canonical: string): [string, Props] {
  const head = canonical.split("{", 1)[0] as string;
  const open = head.indexOf("[");
  if (open === -1) return [head, {}];
  const props: Props = {};
  for (const p of head
    .slice(open + 1)
    .replace(/\]+$/, "")
    .split(",")) {
    const eq = p.indexOf("=");
    if (eq !== -1) props[p.slice(0, eq)] = p.slice(eq + 1);
  }
  return [head.slice(0, open), props];
}
