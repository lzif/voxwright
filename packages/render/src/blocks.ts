// SPDX-License-Identifier: AGPL-3.0-only

// Whole-block quads: the model path plus the special cases around it. Fluids
// become translucent cubes, chests and banners (block entities, so no JSON
// model) are approximated from their entity textures, and anything without a
// usable model falls back to a flat coloured cube.

import type { AssetSource } from "./assets.ts";
import type { Rgb } from "./constants.ts";
import {
  copyImage,
  crop,
  getPixel,
  newImage,
  paste,
  type RasterImage,
  setPixel,
  shade,
  solidRgba,
  tintRgb,
} from "./image.ts";
import { md5 } from "./md5.ts";
import {
  FACE_NAMES,
  FACE_NORMALS,
  type FaceName,
  faceBaseCorners,
  orderCornersUv,
  type Quad,
  resolveBlockQuads,
  SHADES,
  snapNormal,
  splitBlockstate,
  type Vec3,
} from "./models.ts";
import { floorDivMod } from "./pymath.ts";

export const FALLBACK_MAGENTA: Rgb = [205, 70, 205];

/** Vanilla dye palette; the white cloth base multiplies cleanly into every dye colour. */
export const DYE_RGB: Readonly<Record<string, Rgb>> = {
  white: [249, 255, 254],
  orange: [249, 128, 29],
  magenta: [199, 78, 189],
  light_blue: [58, 179, 218],
  yellow: [254, 216, 61],
  lime: [128, 199, 31],
  pink: [243, 139, 170],
  gray: [71, 79, 82],
  light_gray: [157, 157, 151],
  cyan: [22, 156, 156],
  purple: [137, 50, 184],
  blue: [60, 68, 170],
  brown: [131, 84, 50],
  green: [94, 124, 22],
  red: [176, 46, 38],
  black: [29, 29, 33],
};

/** Fluids have no block model; they render as translucent cubes. A chest is a plain wooden box. */
export const FLUID_RGBA: Readonly<Record<string, readonly [number, number, number, number]>> = {
  "minecraft:water": [63, 118, 228, 150],
  "minecraft:lava": [255, 110, 20, 210],
  "minecraft:chest": [181, 140, 82, 255],
};

/** Still-fluid surface height: exactly 8/9, measured from the official client. */
export const FLUID_SURFACE_HEIGHT = 8.0 / 9.0;

const COPPER_CHEST: Rgb = [200, 120, 70];
/** Flat colours for blocks that are intentional approximations (not missing models). */
const FLAT_COLORS: Record<string, Rgb> = {
  "minecraft:water": [63, 118, 228],
  "minecraft:lava": [255, 110, 20],
  "minecraft:chest": [181, 140, 82],
  "minecraft:trapped_chest": [170, 110, 75],
  "minecraft:ender_chest": [60, 55, 70],
};
for (const stage of ["", "exposed_", "weathered_", "oxidized_"]) {
  FLAT_COLORS[`minecraft:${stage}copper_chest`] = COPPER_CHEST;
  FLAT_COLORS[`minecraft:waxed_${stage}copper_chest`] = COPPER_CHEST;
}
for (const [dye, rgb] of Object.entries(DYE_RGB)) {
  FLAT_COLORS[`minecraft:${dye}_banner`] = rgb;
  FLAT_COLORS[`minecraft:${dye}_wall_banner`] = rgb;
}

/** Blocks with an intentional flat colour (fluids, chests, banners): not missing-asset warnings. */
export const hasFlatColor = (name: string): boolean => Object.hasOwn(FLAT_COLORS, name);

/** Deterministic flat colour per block name (MD5, not a language hash). */
export function fallbackColor(blockName: string): Rgb {
  const flat = Object.hasOwn(FLAT_COLORS, blockName) ? FLAT_COLORS[blockName] : undefined;
  if (flat !== undefined) return flat;
  const d = md5(new TextEncoder().encode(blockName));
  return [d[0] as number, d[1] as number, d[2] as number];
}

/** Labeled-cube fallback: 6 quads. Full-cube stand-in: each face's outward normal is its cull direction. */
export function fallbackCubeQuads(color: Rgb): Quad[] {
  const img = newImage(16, 16, color);
  return FACE_NAMES.map((face) => {
    const ordered = orderCornersUv(faceBaseCorners(face, [0, 0, 0], [1, 1, 1]), face);
    const n = FACE_NORMALS[face];
    const shaded = shade(img, SHADES[n.join(",")] as number);
    return {
      points: ordered,
      normal: n,
      image: shaded,
      cull: n,
      flat: false,
      solid: [shaded.data[0] as number, shaded.data[1] as number, shaded.data[2] as number, 255],
    };
  });
}

/**
 * Translucent fluid cube: 6 shaded RGBA quads. `topHeight` lowers only the up
 * face's top corners. Side faces span the full 0..1: vanilla clips them
 * per neighbour, but the per-palette quad cache has no neighbour context.
 */
export function fluidCubeQuads(
  rgba: readonly [number, number, number, number],
  topHeight = 1.0,
): Quad[] {
  const [r, g, b, a] = rgba;
  return FACE_NAMES.map((face) => {
    const t: Vec3 = [1.0, face === "up" ? topHeight : 1.0, 1.0];
    const ordered = orderCornersUv(faceBaseCorners(face, [0, 0, 0], t), face);
    const n = FACE_NORMALS[face];
    const factor = SHADES[n.join(",")] as number;
    const solid = [
      Math.min(255, Math.trunc(r * factor)),
      Math.min(255, Math.trunc(g * factor)),
      Math.min(255, Math.trunc(b * factor)),
      a,
    ] as const;
    const img = solidRgba(16, 16, solid);
    return { points: ordered, normal: n, image: img, cull: n, flat: false, solid };
  });
}

// -- block-entity approximations ---------------------------------------------------
// Chests and banners are block entities, so vanilla ships no JSON model with
// elements for them. UV regions below were measured from the real 26.2 PNGs:
// chest normal.png 64x64 (lid band y0-18, body band y19-42), banner_base.png
// 64x64 (cloth panels (0,0)-(22,41) and (22,0)-(42,41), pole strip (44,0)-(52,42),
// bar strip (0,42)-(44,46)). The canonical chest puts the latch on the NORTH face.

const ENTITY_TEXTURES: Record<string, string> = {
  "minecraft:chest": "entity/chest/normal",
  "minecraft:trapped_chest": "entity/chest/trapped",
  "minecraft:ender_chest": "entity/chest/ender",
  "minecraft:copper_chest": "entity/chest/copper",
  "minecraft:exposed_copper_chest": "entity/chest/copper_exposed",
  "minecraft:weathered_copper_chest": "entity/chest/copper_weathered",
  "minecraft:oxidized_copper_chest": "entity/chest/copper_oxidized",
  "minecraft:waxed_copper_chest": "entity/chest/copper",
  "minecraft:waxed_exposed_copper_chest": "entity/chest/copper_exposed",
  "minecraft:waxed_weathered_copper_chest": "entity/chest/copper_weathered",
  "minecraft:waxed_oxidized_copper_chest": "entity/chest/copper_oxidized",
};

type UvRect = readonly [number, number, number, number];
type FaceUvs = Partial<Record<FaceName, UvRect>>;

const CHEST_BODY_UVS: FaceUvs = {
  north: [14, 33, 28, 43],
  south: [42, 33, 56, 43],
  east: [28, 33, 42, 43],
  west: [0, 33, 14, 43],
  up: [14, 19, 28, 33],
  down: [28, 19, 42, 33],
};
const CHEST_LID_UVS: FaceUvs = {
  north: [14, 14, 28, 19],
  south: [42, 14, 56, 19],
  east: [28, 14, 42, 19],
  west: [0, 14, 14, 19],
  up: [14, 0, 28, 14],
  down: [28, 0, 42, 14],
};
// Per-face latch regions for the knob box (2,4,1) at uv(0,0).
const CHEST_LATCH_UVS: FaceUvs = {
  north: [1, 1, 3, 5],
  south: [4, 1, 6, 5],
  east: [3, 1, 4, 5],
  west: [0, 1, 1, 5],
  up: [1, 0, 3, 1],
  down: [3, 0, 5, 1],
};

const BANNER_TEXTURE = "entity/banner/banner_base";

const FACING_Y_ROT: Record<string, number> = { north: 0, east: 90, south: 180, west: 270 };
const WALL_BANNER_Y_ROT: Record<string, number> = { south: 0, west: 90, north: 180, east: 270 };

/** Y rotation clockwise from above, in 90 degree steps. */
function rotYDeg(p: Vec3, degrees: number): Vec3 {
  let [x, y, z] = p;
  for (let i = 0; i < floorDivMod(degrees, 90, 4); i++) [x, y, z] = [1.0 - z, y, x];
  return [x, y, z];
}
function rotYDirDeg(v: Vec3, degrees: number): Vec3 {
  let [x, y, z] = v;
  for (let i = 0; i < floorDivMod(degrees, 90, 4); i++) [x, y, z] = [-z, y, x];
  return [x, y, z];
}
/** Continuous Y rotation about the block centre (standing banners turn in 22.5 degree steps). */
function rotYContinuous(p: Vec3, degrees: number): Vec3 {
  const theta = (degrees * Math.PI) / 180;
  const [c, s] = [Math.cos(theta), Math.sin(theta)];
  const [vx, vz] = [p[0] - 0.5, p[2] - 0.5];
  return [0.5 + c * vx - s * vz, p[1], 0.5 + s * vx + c * vz];
}
function rotYContinuousDir(v: Vec3, degrees: number): Vec3 {
  const theta = (degrees * Math.PI) / 180;
  const [c, s] = [Math.cos(theta), Math.sin(theta)];
  return [c * v[0] - s * v[2], v[1], s * v[0] + c * v[2]];
}

interface RawEntityQuad {
  points: Vec3[];
  normal: Vec3;
  crop: RasterImage;
  /** Texture id and crop rectangle, for atlas sampling; `tint` multiplies the colour. */
  texId: string;
  rect: UvRect;
  tint: Rgb | null;
}

/**
 * One textured box from an entity PNG in canonical orientation. Crops are
 * unshaded; the caller rotates points and normals and shades for the world
 * normal. Faces absent from `faceUvs` are skipped.
 */
function entityBoxQuads(
  f: Vec3,
  t: Vec3,
  faceUvs: FaceUvs,
  img: RasterImage,
  texId: string,
  tint: Rgb | null = null,
): RawEntityQuad[] {
  const out: RawEntityQuad[] = [];
  for (const [face, rect] of Object.entries(faceUvs) as [FaceName, UvRect][]) {
    const piece = crop(img, rect[0], rect[1], rect[2], rect[3]);
    if (piece.width < 1 || piece.height < 1) continue;
    out.push({
      points: orderCornersUv(faceBaseCorners(face, f, t), face),
      normal: FACE_NORMALS[face],
      crop: piece,
      texId,
      rect,
      tint,
    });
  }
  return out;
}

/** Rotate entity quads to their final orientation and shade for the world normal. Block entities never neighbour-cull. */
function finalizeEntityQuads(quads: RawEntityQuad[], degrees: number, continuous = false): Quad[] {
  return quads.map(({ points, normal, crop: piece, texId, rect, tint }) => {
    const pts = points.map((p) => (continuous ? rotYContinuous(p, degrees) : rotYDeg(p, degrees)));
    const n2 = snapNormal(
      continuous ? rotYContinuousDir(normal, degrees) : rotYDirDeg(normal, degrees),
    );
    const factor = SHADES[n2.join(",")] ?? 0.75;
    return {
      points: pts,
      normal: n2,
      image: shade(piece, factor),
      cull: null,
      flat: false,
      tex: { id: texId, rect, flipH: false, flipV: false, rotation: 0, tint, shade: factor },
    };
  });
}

/** Fill fully transparent texels with their opaque neighbour's colour (entity textures have rounded corners). */
function fillTransparentCorners(
  img: RasterImage,
  corners: readonly (readonly [number, number])[],
): void {
  if (img.channels !== 4) return;
  for (const [x, y] of corners) {
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (nx >= 0 && nx < img.width && ny >= 0 && ny < img.height) {
        const [r, g, b, a] = getPixel(img, nx, ny);
        if (a === 255) {
          setPixel(img, x, y, [r, g, b, 255]);
          break;
        }
      }
    }
  }
}

/** Single-chest approximation: body + lid + latch boxes, latch canonically on the north face. */
function chestQuads(
  props: Record<string, string>,
  source: RasterImage,
  texId: string,
): Quad[] | null {
  if (source.width !== 64 || source.height !== 64) return null;
  const img = copyImage(source);
  // The latch unwrap has two fully transparent corner texels, (0,0) and (5,0).
  fillTransparentCorners(img, [
    [0, 0],
    [5, 0],
  ]);
  const parts = [
    ...entityBoxQuads(
      [1 / 16, 0.0, 1 / 16],
      [15 / 16, 10 / 16, 15 / 16],
      CHEST_BODY_UVS,
      img,
      texId,
    ),
    ...entityBoxQuads(
      [1 / 16, 10 / 16, 1 / 16],
      [15 / 16, 15 / 16, 15 / 16],
      CHEST_LID_UVS,
      img,
      texId,
    ),
    ...entityBoxQuads(
      [7 / 16, 9 / 16, 0.0],
      [9 / 16, 13 / 16, 1 / 16],
      CHEST_LATCH_UVS,
      img,
      texId,
    ),
  ];
  return finalizeEntityQuads(parts, FACING_Y_ROT[props.facing ?? "north"] ?? 0);
}

/** Banner approximation: pole, crossbar and tinted hanging cloth. Base dye colour only; no pattern layers. */
function bannerQuads(
  props: Record<string, string>,
  img: RasterImage,
  dye: Rgb,
  wall: boolean,
): Quad[] | null {
  const texId = BANNER_TEXTURE;
  if (img.width !== 64 || img.height !== 64) return null;
  // Tint the cloth panels in a working copy; pole and bar stay wood.
  const panel = copyImage(img);
  paste(panel, tintRgb(crop(img, 0, 0, 22, 41), dye), 0, 0);
  paste(panel, tintRgb(crop(img, 22, 0, 42, 41), dye), 22, 0);
  fillTransparentCorners(panel, [
    [0, 0],
    [41, 0],
  ]);
  const quads: RawEntityQuad[] = [];
  if (!wall) {
    // Pole (2x14x2); the bottom face is skipped (it sits on the ground).
    const poleUvs: FaceUvs = {
      north: [44, 2, 46, 42],
      south: [46, 2, 48, 42],
      east: [48, 2, 50, 42],
      west: [50, 2, 52, 42],
      up: [46, 0, 48, 2],
    };
    quads.push(
      ...entityBoxQuads([7 / 16, 0.0, 7 / 16], [9 / 16, 14 / 16, 9 / 16], poleUvs, img, texId),
    );
  }
  // Crossbar (20x2x2); the strip's end columns have transparent corners, so the ends sample just inside them.
  const barUvs: FaceUvs = {
    north: [12, 42, 32, 44],
    south: [12, 42, 32, 44],
    east: [2, 42, 4, 44],
    west: [40, 42, 42, 44],
    up: [12, 42, 32, 44],
    down: [12, 42, 32, 44],
  };
  let clothF: Vec3;
  let clothT: Vec3;
  if (wall) {
    quads.push(
      ...entityBoxQuads([-2 / 16, 12 / 16, 0.0], [18 / 16, 14 / 16, 2 / 16], barUvs, img, texId),
    );
    clothF = [-2 / 16, 2 / 16, 0.5 / 16];
    clothT = [18 / 16, 12 / 16, 1.5 / 16];
  } else {
    quads.push(
      ...entityBoxQuads([-2 / 16, 12 / 16, 7 / 16], [18 / 16, 14 / 16, 9 / 16], barUvs, img, texId),
    );
    clothF = [-2 / 16, 2 / 16, 7.5 / 16];
    clothT = [18 / 16, 12 / 16, 8.5 / 16];
  }
  // Cloth (20x10x1); thin edges sample the tinted panel's edge columns.
  const clothUvs: FaceUvs = {
    south: [0, 0, 22, 41],
    north: [22, 0, 42, 41],
    east: [20, 0, 22, 41],
    west: [0, 0, 2, 41],
    up: [0, 0, 22, 2],
    down: [0, 39, 22, 41],
  };
  quads.push(...entityBoxQuads(clothF, clothT, clothUvs, panel, texId, dye));
  if (wall) return finalizeEntityQuads(quads, WALL_BANNER_Y_ROT[props.facing ?? "north"] ?? 0);
  const rotation = Number.parseInt(props.rotation ?? "0", 10);
  return finalizeEntityQuads(
    quads,
    ((((Number.isNaN(rotation) ? 0 : rotation) % 16) + 16) % 16) * 22.5,
    true,
  );
}

/**
 * Textured block-entity approximations (chest and banner families), or `null`
 * when the block is not one or its entity texture failed to load.
 */
export function tryEntityQuads(
  name: string,
  props: Record<string, string>,
  assets: AssetSource,
): Quad[] | null {
  if (Object.hasOwn(ENTITY_TEXTURES, name)) {
    const img = assets.texture(ENTITY_TEXTURES[name] as string);
    return img === null ? null : chestQuads(props, img, ENTITY_TEXTURES[name] as string);
  }
  const short = name.slice(name.indexOf(":") + 1);
  let color: string;
  let wall: boolean;
  if (short.endsWith("_wall_banner")) {
    color = short.slice(0, -"_wall_banner".length);
    wall = true;
  } else if (short.endsWith("_banner")) {
    color = short.slice(0, -"_banner".length);
    wall = false;
  } else return null;
  const dye = Object.hasOwn(DYE_RGB, color) ? DYE_RGB[color] : undefined;
  if (dye === undefined) return null;
  const img = assets.texture(BANNER_TEXTURE);
  return img === null ? null : bannerQuads(props, img, dye, wall);
}

/**
 * Quads for one canonical block string, and whether they are the fallback
 * cube. Dispatch order: entity approximations, fluids, then the model path.
 */
export function blockQuads(
  canonical: string,
  assets: AssetSource | null,
  fallbackBlocks: Set<string> = new Set(),
): { quads: Quad[]; isFallback: boolean } {
  const [name, props] = splitBlockstate(canonical);
  if (assets !== null) {
    const entity = tryEntityQuads(name, props, assets);
    if (entity !== null) return { quads: entity, isFallback: false }; // an approximation, not a missing model
  }
  const fluid = Object.hasOwn(FLUID_RGBA, name) ? FLUID_RGBA[name] : undefined;
  if (fluid !== undefined) {
    const top =
      name === "minecraft:water" || name === "minecraft:lava" ? FLUID_SURFACE_HEIGHT : 1.0;
    return { quads: fluidCubeQuads(fluid, top), isFallback: false };
  }
  if (assets === null) return { quads: fallbackCubeQuads(FALLBACK_MAGENTA), isFallback: true };
  const quads = resolveBlockQuads(name, props, assets, fallbackColor(name), fallbackBlocks);
  if (quads === null || quads.length === 0)
    return { quads: fallbackCubeQuads(FALLBACK_MAGENTA), isFallback: true };
  return { quads, isFallback: false };
}
