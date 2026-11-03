// SPDX-License-Identifier: AGPL-3.0-only

// Grid-level rendering logic: which blocks occlude, how walls, fences and
// panes connect, which faces a neighbour hides, and per-vertex ambient
// occlusion. Everything here is a pure function of the voxel array, so it is
// deterministic and testable without drawing a pixel.
//
// Coordinates are dense-array indices: cell `(x, y, z)` is
// `data[(x * sy + y) * sz + z]`, and `-1` means never placed.

import type { DenseVolume } from "@voxwright/core";
import type { AssetSource } from "./assets.ts";
import { blockQuads, FLUID_RGBA, tryEntityQuads } from "./blocks.ts";
import {
  FACE_NORMALS,
  modelApplications,
  modelElements,
  type Quad,
  snapNormal,
  splitBlockstate,
  type Vec3,
} from "./models.ts";
import { pyRound } from "./pymath.ts";

const AIR = "minecraft:air";
const WALL_DIRS = ["north", "south", "east", "west"] as const;
type Dir = (typeof WALL_DIRS)[number];

/** Blocks that never occlude AO even though their models fill the cube: translucent in vanilla. */
const AO_NON_OCCLUDING = new Set([
  "minecraft:ice",
  "minecraft:slime_block",
  "minecraft:honey_block",
]);

/** Same-kind neighbours of these hide each other's shared faces (vanilla HalfTransparentBlock rule). */
const SAME_TRANSLUCENT_BLOCKS = new Set([
  "minecraft:glass",
  "minecraft:water",
  "minecraft:ice",
  "minecraft:slime_block",
  "minecraft:honey_block",
]);

const short = (name: string): string => name.slice(name.indexOf(":") + 1);
type Json = Record<string, unknown>;
const asObject = (v: unknown): Json | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : null;

// -- wall detection ----------------------------------------------------------------------

const wallMemo = new WeakMap<AssetSource, Map<string, boolean>>();

/**
 * True iff `name` is a real wall block: the `east/north/south/west` `when`
 * values in its blockstate form a subset of `{low, tall, false}` with at
 * least one of low or tall. (Key names alone would misfire on vine, tripwire,
 * fences and panes, whose domain is `true/false`.)
 */
export function isWallBlock(name: string, assets: AssetSource | null): boolean {
  if (assets === null) return false;
  let memo = wallMemo.get(assets);
  if (memo === undefined) {
    memo = new Map();
    wallMemo.set(assets, memo);
  }
  const hit = memo.get(name);
  if (hit !== undefined) return hit;
  let result = false;
  const bs = asObject(assets.readJson(`blockstates/${short(name)}.json`));
  if (bs !== null) {
    const vals = new Set<string>();
    const collect = (when: unknown): void => {
      const w = asObject(when);
      if (w === null) return;
      if ("OR" in w) {
        for (const c of w.OR as unknown[]) collect(c);
        return;
      }
      if ("AND" in w) {
        for (const c of w.AND as unknown[]) collect(c);
        return;
      }
      for (const [k, v] of Object.entries(w)) {
        if (!(WALL_DIRS as readonly string[]).includes(k)) continue;
        if (Array.isArray(v)) for (const x of v) vals.add(String(x));
        else vals.add(String(v));
      }
    };
    if (Array.isArray(bs.multipart)) for (const c of bs.multipart as Json[]) collect(c.when);
    result =
      vals.size > 0 &&
      [...vals].every((v) => v === "low" || v === "tall" || v === "false") &&
      (vals.has("low") || vals.has("tall"));
  }
  memo.set(name, result);
  return result;
}

// -- occlusion --------------------------------------------------------------------------------

/**
 * True iff the block's rendered shape fills its cell for AO purposes. Mirrors
 * the quad dispatch order (fluid, entity, model, fallback) so the answer
 * always matches what is drawn. Partial blocks (stairs, slabs, walls) do not
 * cast AO onto neighbours but still receive it.
 */
export function blockOccludesAo(canonical: string, assets: AssetSource | null): boolean {
  const [name, props] = splitBlockstate(canonical);
  if (name === AIR) return false;
  if (Object.hasOwn(FLUID_RGBA, name)) return name === "minecraft:chest";
  if (assets === null) return true; // magenta fallback cube
  const entity = tryEntityQuads(name, props, assets);
  if (entity !== null) return !name.endsWith("_banner"); // banners are thin cloth; chests nearly fill the cube
  if (AO_NON_OCCLUDING.has(name)) return false;
  if (name.endsWith("leaves")) return true; // vanilla treats leaves as opaque cubes for AO
  if (isWallBlock(name, assets)) return false;
  const apps = modelApplications(name, props, assets);
  if (apps.length === 0) return true; // fallback magenta cube
  try {
    const covered = new Uint8Array(16 * 16 * 16);
    const faceImages: (import("./image.ts").RasterImage | null)[] = [];
    for (const app of apps) {
      const model = modelElements(app.model, assets);
      if (model === null) return true;
      for (const el of model.elements) {
        const f = (el.from as number[]).map((c) => Math.max(0, Math.min(16, pyRound(c))));
        const t = (el.to as number[]).map((c) => Math.max(0, Math.min(16, pyRound(c))));
        for (let x = f[0] as number; x < (t[0] as number); x++) {
          for (let y = f[1] as number; y < (t[1] as number); y++) {
            for (let z = f[2] as number; z < (t[2] as number); z++)
              covered[(x * 16 + y) * 16 + z] = 1;
          }
        }
        for (const face of Object.values(asObject(el.faces) ?? {})) {
          const v = String(asObject(face)?.texture ?? "").replace(/^#+/, "");
          faceImages.push(model.images.get(v) ?? null);
        }
      }
    }
    if (covered.some((c) => c === 0)) return false;
    // Every face texture must be opaque: missing textures degrade to an opaque flat colour, and
    // fully opaque PNGs are stored as RGB, so RGBA means genuinely transparent pixels.
    return faceImages.every((img) => img === null || img.channels !== 4);
  } catch {
    // Corrupt element: the render degrades the whole block to the fallback cube, which occludes.
    return true;
  }
}

// -- scene ---------------------------------------------------------------------------------------

/** Padded boolean grid (one cell of padding on every side). Out of range reads as empty. */
export interface OccGrid {
  size: readonly [number, number, number];
  data: Uint8Array;
}

export interface WallEntry {
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
  aboveSolid: boolean;
  aboveAny: boolean;
}
export type ConnectorEntry = Record<Dir, boolean>;

export interface Scene {
  dense: DenseVolume;
  assets: AssetSource | null;
  /** Per palette entry: does it occlude AO? */
  occIdx: boolean[];
  occ: OccGrid;
  walls: Map<string, WallEntry>;
  connectors: Map<string, ConnectorEntry>;
}

const key = (x: number, y: number, z: number): string => `${x},${y},${z}`;

function cellIndex(d: DenseVolume, x: number, y: number, z: number): number {
  const [sx, sy, sz] = d.size;
  if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return -1;
  return d.data[(x * sy + y) * sz + z] as number;
}

/** Fence, glass pane or iron bars. Name-based: a value-domain gate would misfire on redstone wire and tripwire. */
export function isHorizConnectorBlock(name: string): boolean {
  const s = short(name);
  const isPane = s === "glass_pane" || s.endsWith("_glass_pane");
  return s.endsWith("_fence") || isPane || name === "minecraft:iron_bars";
}

function paletteOcclusion(palette: readonly string[], assets: AssetSource | null): boolean[] {
  return palette.map((b) => blockOccludesAo(b, assets));
}

function neighbourState(
  d: DenseVolume,
  palette: readonly string[],
  nx: number,
  ny: number,
  nz: number,
) {
  const idx = cellIndex(d, nx, ny, nz);
  if (idx < 0 || idx >= palette.length) return null;
  const block = palette[idx] as string;
  return block === AIR ? null : { idx, block };
}

function buildWalls(
  d: DenseVolume,
  occIdx: boolean[],
  assets: AssetSource | null,
): Map<string, WallEntry> {
  const out = new Map<string, WallEntry>();
  const [sx, sy, sz] = d.size;
  const wallIdx = new Set<number>();
  d.palette.forEach((b, i) => {
    if (isWallBlock(splitBlockstate(b)[0], assets)) wallIdx.add(i);
  });
  if (wallIdx.size === 0) return out;
  const connects = (nx: number, ny: number, nz: number): boolean => {
    const n = neighbourState(d, d.palette, nx, ny, nz);
    if (n === null) return false;
    const [nname] = splitBlockstate(n.block);
    if (isWallBlock(nname, assets)) return true;
    if (nname === "minecraft:iron_bars" || nname.endsWith("glass_pane")) return true;
    if (nname.endsWith("fence_gate")) return true; // gate facing ignored (documented approximation)
    return occIdx[n.idx] as boolean;
  };
  for (let x = 0; x < sx; x++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++) {
        if (!wallIdx.has(d.data[(x * sy + y) * sz + z] as number)) continue;
        const entry = { aboveSolid: false, aboveAny: false } as WallEntry;
        for (const dir of WALL_DIRS) {
          const [dx, dy, dz] = FACE_NORMALS[dir];
          entry[dir] = connects(x + dx, y + dy, z + dz);
        }
        if (y + 1 >= 0 && y + 1 < sy) {
          const a = neighbourState(d, d.palette, x, y + 1, z);
          if (a !== null) {
            entry.aboveAny = true;
            entry.aboveSolid = occIdx[a.idx] as boolean;
          }
        }
        out.set(key(x, y, z), entry);
      }
    }
  }
  return out;
}

function buildConnectors(
  d: DenseVolume,
  occIdx: boolean[],
  assets: AssetSource | null,
): Map<string, ConnectorEntry> {
  const out = new Map<string, ConnectorEntry>();
  const [sx, sy, sz] = d.size;
  const kinds = new Map<number, boolean>(); // palette index -> is fence
  d.palette.forEach((b, i) => {
    const name = splitBlockstate(b)[0];
    if (isHorizConnectorBlock(name)) kinds.set(i, short(name).endsWith("_fence"));
  });
  if (kinds.size === 0) return out;
  const connects = (nx: number, ny: number, nz: number, isFence: boolean): boolean => {
    const n = neighbourState(d, d.palette, nx, ny, nz);
    if (n === null) return false;
    const [nname] = splitBlockstate(n.block);
    const ns = short(nname);
    const nIsPane = ns === "glass_pane" || ns.endsWith("_glass_pane");
    if (isFence) {
      if (ns.endsWith("_fence") || ns.endsWith("_fence_gate")) return true;
    } else if (nIsPane || nname === "minecraft:iron_bars" || isWallBlock(nname, assets))
      return true;
    return occIdx[n.idx] as boolean;
  };
  for (let x = 0; x < sx; x++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++) {
        const isFence = kinds.get(d.data[(x * sy + y) * sz + z] as number);
        if (isFence === undefined) continue;
        const entry = {} as ConnectorEntry;
        for (const dir of WALL_DIRS) {
          const [dx, dy, dz] = FACE_NORMALS[dir];
          entry[dir] = connects(x + dx, y + dy, z + dz, isFence);
        }
        out.set(key(x, y, z), entry);
      }
    }
  }
  return out;
}

/** Classify the palette, expand to a padded occlusion grid, and infer wall and fence connections. */
export function prepareScene(dense: DenseVolume, assets: AssetSource | null): Scene {
  const occIdx = paletteOcclusion(dense.palette, assets);
  const [sx, sy, sz] = dense.size;
  const psz: [number, number, number] = [sx + 2, sy + 2, sz + 2];
  const occData = new Uint8Array(psz[0] * psz[1] * psz[2]);
  for (let x = 0; x < sx; x++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++) {
        const idx = dense.data[(x * sy + y) * sz + z] as number;
        if (idx >= 0 && occIdx[idx]) occData[((x + 1) * psz[1] + (y + 1)) * psz[2] + (z + 1)] = 1; // -1 = unset = non-occluding
      }
    }
  }
  return {
    dense,
    assets,
    occIdx,
    occ: { size: psz, data: occData },
    walls: buildWalls(dense, occIdx, assets),
    connectors: buildConnectors(dense, occIdx, assets),
  };
}

type Props = Record<string, string>;

/** Infer missing wall props for one cell. Only fills keys absent from the canonical string. */
export function inferWallProps(
  block: string,
  x: number,
  y: number,
  z: number,
  scene: Scene,
): Props {
  const [, explicit] = splitBlockstate(block);
  const entry = scene.walls.get(key(x, y, z));
  const inferred: Props = {};
  for (const d of WALL_DIRS) {
    if (Object.hasOwn(explicit, d)) continue;
    inferred[d] = !entry?.[d] ? "false" : entry.aboveSolid ? "tall" : "low";
  }
  if (!Object.hasOwn(explicit, "up")) {
    if (entry?.aboveAny) inferred.up = "true";
    else {
      const sides = WALL_DIRS.filter((d) => entry?.[d]).sort();
      const key2 = sides.join(",");
      // Two opposite sides, or all four, leave the centre post out.
      inferred.up =
        key2 === "north,south" || key2 === "east,west" || key2 === "east,north,south,west"
          ? "false"
          : "true";
    }
  }
  if (!Object.hasOwn(explicit, "waterlogged")) inferred.waterlogged = "false";
  return inferred;
}

/** Infer missing fence, pane or bars props for one cell. */
export function inferConnectorProps(
  block: string,
  x: number,
  y: number,
  z: number,
  scene: Scene,
): Props {
  const [, explicit] = splitBlockstate(block);
  const entry = scene.connectors.get(key(x, y, z));
  const inferred: Props = {};
  for (const d of WALL_DIRS) {
    if (Object.hasOwn(explicit, d)) continue;
    inferred[d] = entry?.[d] ? "true" : "false";
  }
  if (!Object.hasOwn(explicit, "waterlogged")) inferred.waterlogged = "false";
  return inferred;
}

/** The block string actually rendered at a cell: walls and connectors get their inferred props (explicit wins). */
export function effectiveBlock(scene: Scene, x: number, y: number, z: number): string | null {
  const idx = cellIndex(scene.dense, x, y, z);
  if (idx < 0 || idx >= scene.dense.palette.length) return null;
  const block = scene.dense.palette[idx] as string;
  if (block === AIR) return null;
  const [name, explicit] = splitBlockstate(block);
  let inferred: Props | null = null;
  if (isWallBlock(name, scene.assets)) inferred = inferWallProps(block, x, y, z, scene);
  else if (isHorizConnectorBlock(name)) inferred = inferConnectorProps(block, x, y, z, scene);
  if (inferred === null || Object.keys(inferred).length === 0) return block;
  const merged = { ...inferred, ...explicit }; // explicit > inferred
  return `${name}[${Object.keys(merged)
    .sort()
    .map((k) => `${k}=${merged[k]}`)
    .join(",")}]`;
}

/** Quads for the block at a cell (with inferred props), cached by effective block string. */
export function cellQuads(
  scene: Scene,
  x: number,
  y: number,
  z: number,
  cache: Map<string, { quads: Quad[]; isFallback: boolean }>,
  fallbackBlocks: Set<string> = new Set(),
): { quads: Quad[]; isFallback: boolean; block: string } | null {
  const block = effectiveBlock(scene, x, y, z);
  if (block === null) return null;
  let hit = cache.get(block);
  if (hit === undefined) {
    hit = blockQuads(block, scene.assets, fallbackBlocks);
    cache.set(block, hit);
  }
  return { ...hit, block };
}

// -- culling and ambient occlusion -----------------------------------------------------------------

const occAt = (g: OccGrid, x: number, y: number, z: number): boolean =>
  g.data[(x * g.size[1] + y) * g.size[2] + z] === 1;

function isLeavesCell(scene: Scene, nx: number, ny: number, nz: number): boolean {
  const idx = cellIndex(scene.dense, nx, ny, nz);
  if (idx < 0 || idx >= scene.dense.palette.length) return false;
  return splitBlockstate(scene.dense.palette[idx] as string)[0].endsWith("leaves");
}

function isSameTranslucentNeighbour(
  scene: Scene,
  name: string,
  nx: number,
  ny: number,
  nz: number,
): boolean {
  if (!SAME_TRANSLUCENT_BLOCKS.has(name) && !name.endsWith("_stained_glass")) return false;
  const idx = cellIndex(scene.dense, nx, ny, nz);
  if (idx < 0 || idx >= scene.dense.palette.length) return false;
  return splitBlockstate(scene.dense.palette[idx] as string)[0] === name;
}

/**
 * True iff this quad's face is hidden by its neighbour. Only faces with a
 * cullface are culled. A face is hidden when the neighbour occludes, or is the
 * same translucent block (glass or water stacking). Leaves occlude AO but not
 * faces: vanilla leaves are no-occlusion, so faces behind them still show
 * through the cut-out holes.
 */
export function quadCulledByNeighbour(
  scene: Scene,
  cull: Vec3 | null,
  x: number,
  y: number,
  z: number,
  name: string,
): boolean {
  if (cull === null) return false;
  const [nx, ny, nz] = [Math.trunc(x + cull[0]), Math.trunc(y + cull[1]), Math.trunc(z + cull[2])];
  if (occAt(scene.occ, nx + 1, ny + 1, nz + 1)) return !isLeavesCell(scene, nx, ny, nz);
  return isSameTranslucentNeighbour(scene, name, nx, ny, nz);
}

/**
 * AO levels (0 to 3) for the 4 vertices of one quad. `vLocals` are vertex
 * positions minus the cell's array coords (in 0..1; fractional allowed for
 * partial blocks); `normal` is the face's axis-snapped world normal. For each
 * vertex, in the face-adjacent layer, sample the two side cells and the
 * corner cell: level is 0 if both sides are solid, else 3 minus the solid count.
 */
export function quadAoLevels(
  vLocals: readonly Vec3[],
  normal: Vec3,
  cell: readonly [number, number, number],
  occ: OccGrid,
): number[] {
  const ax = normal[0] ? 0 : normal[1] ? 1 : 2;
  const [t1, t2] = [0, 1, 2].filter((t) => t !== ax) as [number, number];
  const base: Vec3 = [cell[0] + normal[0] + 1, cell[1] + normal[1] + 1, cell[2] + normal[2] + 1];
  return vLocals.map((v) => {
    const o1 = (v[t1] as number) <= 1e-9 ? -1 : (v[t1] as number) >= 1 - 1e-9 ? 1 : 0;
    const o2 = (v[t2] as number) <= 1e-9 ? -1 : (v[t2] as number) >= 1 - 1e-9 ? 1 : 0;
    const i1: Vec3 = [...base];
    i1[t1] = (i1[t1] as number) + o1;
    const i2: Vec3 = [...base];
    i2[t2] = (i2[t2] as number) + o2;
    const ic: Vec3 = [...base];
    ic[t1] = (ic[t1] as number) + o1;
    ic[t2] = (ic[t2] as number) + o2;
    const s1 = occAt(occ, ...i1);
    const s2 = occAt(occ, ...i2);
    const c = occAt(occ, ...ic);
    return s1 && s2 ? 0 : 3 - (Number(s1) + Number(s2) + Number(c));
  });
}

/** Re-exported for callers that need the axis-snapped normal. */
export { snapNormal };
