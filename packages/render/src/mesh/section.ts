// SPDX-License-Identifier: AGPL-3.0-only

// The section mesher: one 16x16x16 piece of a volume, with a one-cell border
// taken from its neighbours, becomes typed-array vertex buffers. The quads
// come from the same pipeline as the CPU renderer (models, multipart, chests,
// banners, fluids, wall and fence connections), the culling and ambient
// occlusion are the same rules, and the output is ready to upload: positions,
// UVs into a texture atlas, a per-vertex colour that carries tint, face shade
// and ambient occlusion, and indices, split into an opaque, a cutout and a
// translucent bucket.
//
// No DOM and no Node API: it runs on the main thread, in a worker, or in tests.

import type { DenseVolume } from "@voxwright/core";
import type { AssetSource } from "../assets.ts";
import { blockQuads } from "../blocks.ts";
import { type Quad, type QuadTex, snapNormal, splitBlockstate, type Vec3 } from "../models.ts";
import {
  blockOccludesAo,
  effectiveBlock,
  isHorizConnectorBlock,
  isWallBlock,
  type OccGrid,
  prepareScene,
  quadAoLevels,
  SAME_TRANSLUCENT_BLOCKS,
  type Scene,
} from "../scene.ts";
import { type AtlasEntry, type AtlasLayout, TEXTURE_CUTOUT, TEXTURE_TRANSLUCENT } from "./atlas.ts";

/** Cells along each axis of a section. */
export const SECTION_SIZE = 16;
/** Cells along each axis of the padded block a mesh job reads: the section plus one cell all round. */
export const PADDED = SECTION_SIZE + 2;
export const PADDED_VOLUME = PADDED * PADDED * PADDED;
/** Index into a padded block: `x`, `y`, `z` in `0..17`, x slowest, like a `DenseVolume`. */
export const paddedIndex = (x: number, y: number, z: number): number =>
  (x * PADDED + y) * PADDED + z;

const AIR = "minecraft:air";
/** Same brightness per ambient occlusion level as the CPU rasterizer. */
const AO_BRIGHTNESS = [0.4, 0.6, 0.8, 1.0] as const;
/** Texels to pull each UV edge inward, so nearest sampling never reads the neighbouring texel. */
const UV_INSET = 0.02;

export const BUCKET_OPAQUE = 0;
export const BUCKET_CUTOUT = 1;
export const BUCKET_TRANSLUCENT = 2;
type Bucket = 0 | 1 | 2;

/** One draw pass worth of geometry, in section-local coordinates (0 to 16, with a little overhang). */
export interface MeshBuffers {
  /** xyz per vertex. */
  positions: Float32Array;
  /** uv per vertex, in 0..1 atlas space with v running down the atlas image. */
  uvs: Float32Array;
  /** rgba per vertex, unsigned bytes: tint, face shade and ambient occlusion in rgb, alpha of flat-coloured faces. */
  colors: Uint8Array;
  indices: Uint16Array | Uint32Array;
}

export interface SectionMesh {
  opaque: MeshBuffers | null;
  cutout: MeshBuffers | null;
  translucent: MeshBuffers | null;
  /** Visible quads emitted over all buckets. */
  quads: number;
}

export interface SliceRange {
  /** Inclusive range of world cell rows that remain; cells outside it read as unset. */
  y0: number;
  y1: number;
  /** World y of the first row (padded row 1) of the section being meshed. */
  originY: number;
}

// -- section keys ---------------------------------------------------------------------------

/** The key core's sections use: `"sx,sy,sz"` in section units (cell coordinate >> 4). */
export const sectionKey = (sx: number, sy: number, sz: number): string => `${sx},${sy},${sz}`;

export function parseSectionKey(key: string): [number, number, number] {
  const p = key.split(",").map(Number);
  if (p.length !== 3 || p.some((n) => !Number.isInteger(n)))
    throw new Error(`bad section key '${key}'`);
  return [p[0] as number, p[1] as number, p[2] as number];
}

/**
 * Keys of every section whose mesh depends on the cell `(x, y, z)`: its own,
 * plus the neighbours across any border it touches (culling, connections and
 * ambient occlusion all look one cell out). Pass these to `markDirty` after
 * editing that cell.
 */
export function sectionKeysAround(x: number, y: number, z: number): string[] {
  const out: string[] = [];
  const lo = [x & 15, y & 15, z & 15].map((l) => (l === 0 ? -1 : 0));
  const hi = [x & 15, y & 15, z & 15].map((l) => (l === 15 ? 1 : 0));
  for (let dx = lo[0] as number; dx <= (hi[0] as number); dx++)
    for (let dy = lo[1] as number; dy <= (hi[1] as number); dy++)
      for (let dz = lo[2] as number; dz <= (hi[2] as number); dz++)
        out.push(sectionKey((x >> 4) + dx, (y >> 4) + dy, (z >> 4) + dz));
  return out;
}

// -- prepared quads ---------------------------------------------------------------------------

interface PQuad {
  /** Corner positions, xyz x 4, block-local. */
  pts: Float32Array;
  /** Corner positions as vectors, for the ambient occlusion lookup. */
  local: Vec3[];
  uv: Float32Array;
  /** Axis-snapped normal. */
  normal: Vec3;
  /** Neighbour to test for culling, or null. */
  cull: Vec3 | null;
  flat: boolean;
  r: number;
  g: number;
  b: number;
  a: number;
  bucket: Bucket;
  /** True if the corner order winds against the outward normal. */
  reverse: boolean;
}

interface PaletteInfo {
  name: string;
  nameId: number;
  air: boolean;
  /** Occludes ambient occlusion, and hides the faces of neighbours (leaves excepted). */
  occ: boolean;
  leaves: boolean;
  /** Same-kind neighbours hide each other's shared faces (glass, water, ice...). */
  hidesSame: boolean;
  /** 0 plain, 1 wall, 2 fence/pane/bars: those two take props from their neighbours. */
  special: 0 | 1 | 2;
  quads: PQuad[] | null;
}

class Emitter {
  pos = new Float32Array(3 * 1024);
  uv = new Float32Array(2 * 1024);
  col = new Uint8Array(4 * 1024);
  idx = new Uint32Array(6 * 256);
  nv = 0;
  ni = 0;

  reset(): void {
    this.nv = 0;
    this.ni = 0;
  }

  private grow(extraV: number, extraI: number): void {
    if ((this.nv + extraV) * 3 > this.pos.length) {
      const cap = Math.max(this.pos.length * 2, (this.nv + extraV) * 3);
      const pos = new Float32Array(cap);
      pos.set(this.pos.subarray(0, this.nv * 3));
      this.pos = pos;
      const uv = new Float32Array((cap / 3) * 2);
      uv.set(this.uv.subarray(0, this.nv * 2));
      this.uv = uv;
      const col = new Uint8Array((cap / 3) * 4);
      col.set(this.col.subarray(0, this.nv * 4));
      this.col = col;
    }
    if (this.ni + extraI > this.idx.length) {
      const idx = new Uint32Array(Math.max(this.idx.length * 2, this.ni + extraI));
      idx.set(this.idx.subarray(0, this.ni));
      this.idx = idx;
    }
  }

  /** Append one quad. `shades` are the four per-vertex brightness factors. */
  quad(
    q: PQuad,
    ox: number,
    oy: number,
    oz: number,
    shades: readonly number[] | null,
    flipDiagonal: boolean,
  ): void {
    this.grow(4, 6);
    const v0 = this.nv;
    for (let k = 0; k < 4; k++) {
      const p = (v0 + k) * 3;
      this.pos[p] = (q.pts[k * 3] as number) + ox;
      this.pos[p + 1] = (q.pts[k * 3 + 1] as number) + oy;
      this.pos[p + 2] = (q.pts[k * 3 + 2] as number) + oz;
      this.uv[(v0 + k) * 2] = q.uv[k * 2] as number;
      this.uv[(v0 + k) * 2 + 1] = q.uv[k * 2 + 1] as number;
      const f = shades === null ? 1 : (shades[k] as number);
      const c = (v0 + k) * 4;
      this.col[c] = Math.round(q.r * f);
      this.col[c + 1] = Math.round(q.g * f);
      this.col[c + 2] = Math.round(q.b * f);
      this.col[c + 3] = q.a;
    }
    // Split along the diagonal between the brighter pair of corners, so shading does not seam.
    const a = flipDiagonal ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
    const i = this.ni;
    if (q.reverse) {
      for (let t = 0; t < 6; t += 3) {
        this.idx[i + t] = v0 + (a[t] as number);
        this.idx[i + t + 1] = v0 + (a[t + 2] as number);
        this.idx[i + t + 2] = v0 + (a[t + 1] as number);
      }
    } else {
      for (let t = 0; t < 6; t++) this.idx[i + t] = v0 + (a[t] as number);
    }
    this.nv += 4;
    this.ni += 6;
  }

  finish(): MeshBuffers | null {
    if (this.nv === 0) return null;
    const indices =
      this.nv <= 0xffff
        ? Uint16Array.from(this.idx.subarray(0, this.ni))
        : this.idx.slice(0, this.ni);
    return {
      positions: this.pos.slice(0, this.nv * 3),
      uvs: this.uv.slice(0, this.nv * 2),
      colors: this.col.slice(0, this.nv * 4),
      indices,
    };
  }
}

// -- the mesher ---------------------------------------------------------------------------------

export interface MesherOptions {
  /** Where models and textures come from; `null` draws every block as the magenta fallback cube. */
  assets: AssetSource | null;
  atlas: AtlasLayout;
}

export class SectionMesher {
  /** The interned palette, shared with the volume being drawn: append only. */
  readonly palette: string[] = [];
  /** Block names drawn as the fallback cube so far. */
  readonly fallbackBlocks = new Set<string>();
  private readonly assets: AssetSource | null;
  private readonly atlas: AtlasLayout;
  private readonly info: (PaletteInfo | undefined)[] = [];
  private readonly nameIds = new Map<string, number>();
  private readonly byBlock = new Map<string, PQuad[]>();
  private readonly occ = new Uint8Array((PADDED + 2) ** 3);
  private readonly buckets = [new Emitter(), new Emitter(), new Emitter()] as const;

  constructor(options: MesherOptions) {
    this.assets = options.assets;
    this.atlas = options.atlas;
  }

  /** Append palette entries, which must continue where the last call stopped. */
  extendPalette(entries: readonly string[]): void {
    for (const e of entries) this.palette.push(e);
  }

  /** Forget the palette and everything derived from it (a new volume). */
  resetPalette(): void {
    this.palette.length = 0;
    this.info.length = 0;
    this.byBlock.clear();
    this.fallbackBlocks.clear();
  }

  private infoOf(idx: number): PaletteInfo {
    let inf = this.info[idx];
    if (inf !== undefined) return inf;
    const canonical = this.palette[idx];
    if (canonical === undefined)
      throw new Error(`palette index ${idx} is not in the mesher's palette`);
    const [name] = splitBlockstate(canonical);
    let nameId = this.nameIds.get(name);
    if (nameId === undefined) {
      nameId = this.nameIds.size;
      this.nameIds.set(name, nameId);
    }
    const air = name === AIR;
    inf = {
      name,
      nameId,
      air,
      occ: !air && blockOccludesAo(canonical, this.assets),
      leaves: name.endsWith("leaves"),
      hidesSame: SAME_TRANSLUCENT_BLOCKS.has(name) || name.endsWith("_stained_glass"),
      special: air ? 0 : isWallBlock(name, this.assets) ? 1 : isHorizConnectorBlock(name) ? 2 : 0,
      quads: null,
    };
    this.info[idx] = inf;
    return inf;
  }

  private quadsOfBlock(block: string): PQuad[] {
    let hit = this.byBlock.get(block);
    if (hit === undefined) {
      const { quads, isFallback } = blockQuads(block, this.assets, new Set());
      if (isFallback) this.fallbackBlocks.add(splitBlockstate(block)[0]);
      hit = quads.map((q) => this.prepare(q));
      this.byBlock.set(block, hit);
    }
    return hit;
  }

  private quadsOf(idx: number): PQuad[] {
    const inf = this.infoOf(idx);
    if (inf.quads === null) inf.quads = this.quadsOfBlock(this.palette[idx] as string);
    return inf.quads;
  }

  /** Turn a pipeline quad into what the emitter needs: atlas UVs, base colour, bucket, winding. */
  private prepare(q: Quad): PQuad {
    const local = q.points.map((p) => [p[0], p[1], p[2]] as Vec3);
    const pts = new Float32Array(12);
    local.forEach((p, k) => {
      pts[k * 3] = p[0];
      pts[k * 3 + 1] = p[1];
      pts[k * 3 + 2] = p[2];
    });
    // The corners are listed as (u0,v0), (u0,v1), (u1,v1), (u1,v0): with this winding the
    // triangle 0,1,2 faces along (p1 - p0) x (p2 - p0).
    const [p0, p1, p2] = local as [Vec3, Vec3, Vec3, Vec3];
    const e1: Vec3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const e2: Vec3 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const cross: Vec3 = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const reverse = cross[0] * q.normal[0] + cross[1] * q.normal[1] + cross[2] * q.normal[2] < 0;

    let uv: Float32Array;
    let r = 255;
    let g = 255;
    let b = 255;
    let a = 255;
    let bucket: Bucket = BUCKET_OPAQUE;
    const entry = q.tex === undefined ? undefined : this.atlas.entries[q.tex.id];
    if (q.tex !== undefined && entry !== undefined) {
      uv = this.texUv(q.tex, entry);
      const t = q.tex.tint;
      r = (t === null ? 255 : t[0]) * q.tex.shade;
      g = (t === null ? 255 : t[1]) * q.tex.shade;
      b = (t === null ? 255 : t[2]) * q.tex.shade;
      bucket =
        entry.kind === TEXTURE_TRANSLUCENT
          ? BUCKET_TRANSLUCENT
          : entry.kind === TEXTURE_CUTOUT
            ? BUCKET_CUTOUT
            : BUCKET_OPAQUE;
    } else {
      // A flat colour, or a texture the atlas does not hold: draw the quad's own average colour.
      const solid = q.solid ?? averageColour(q);
      r = solid[0];
      g = solid[1];
      b = solid[2];
      a = solid[3];
      uv = new Float32Array([
        this.atlas.whiteU,
        this.atlas.whiteV,
        this.atlas.whiteU,
        this.atlas.whiteV,
        this.atlas.whiteU,
        this.atlas.whiteV,
        this.atlas.whiteU,
        this.atlas.whiteV,
      ]);
      bucket = a < 255 ? BUCKET_TRANSLUCENT : BUCKET_OPAQUE;
    }
    return {
      pts,
      local,
      uv,
      normal: snapNormal(q.normal),
      cull: q.cull,
      flat: q.flat,
      r,
      g,
      b,
      a,
      bucket,
      reverse,
    };
  }

  /**
   * Atlas UVs for the four corners. A corner `(a, b)` of the finished face image maps back through
   * the rotation, the flips and the crop to a point of the source texture.
   */
  private texUv(tex: QuadTex, entry: AtlasEntry): Float32Array {
    const [l, t, r, bt] = tex.rect;
    const rw = Math.max(1e-6, r - l);
    const rh = Math.max(1e-6, bt - t);
    const insetX = Math.min(0.5, UV_INSET / rw);
    const insetY = Math.min(0.5, UV_INSET / rh);
    const out = new Float32Array(8);
    const corners = [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ] as const;
    corners.forEach(([a, b], k) => {
      let ca: number = a;
      let cb: number = b;
      // Undo the clockwise rotation.
      if (tex.rotation === 90) [ca, cb] = [b, 1 - a];
      else if (tex.rotation === 180) [ca, cb] = [1 - a, 1 - b];
      else if (tex.rotation === 270) [ca, cb] = [1 - b, a];
      if (tex.flipV) cb = 1 - cb;
      if (tex.flipH) ca = 1 - ca;
      ca = insetX + ca * (1 - 2 * insetX);
      cb = insetY + cb * (1 - 2 * insetY);
      const px = Math.min(entry.w, Math.max(0, l + ca * rw));
      const py = Math.min(entry.h, Math.max(0, t + cb * rh));
      out[k * 2] = (entry.x + px) / this.atlas.width;
      out[k * 2 + 1] = (entry.y + py) / this.atlas.height;
    });
    return out;
  }

  /**
   * Mesh one section from its padded block of palette indices (`PADDED`^3, x slowest, -1 for
   * unset). Palette indices must
   * already be known to {@link extendPalette}. With `slice`, rows outside the range read as unset.
   */
  mesh(cells: Int32Array, slice: SliceRange | null = null): SectionMesh {
    let data = cells;
    if (slice !== null) {
      data = new Int32Array(cells);
      for (let x = 0; x < PADDED; x++)
        for (let y = 0; y < PADDED; y++) {
          const wy = slice.originY - 1 + y;
          if (wy >= slice.y0 && wy <= slice.y1) continue;
          for (let z = 0; z < PADDED; z++) data[paddedIndex(x, y, z)] = -1;
        }
    }

    // Pass 1: classify what is present and build the occlusion grid (one cell of padding more).
    const occ = this.occ;
    occ.fill(0);
    const OP = PADDED + 2;
    let any = false;
    let special = false;
    for (let x = 0; x < PADDED; x++) {
      const innerX = x > 0 && x < PADDED - 1;
      for (let y = 0; y < PADDED; y++) {
        const innerXY = innerX && y > 0 && y < PADDED - 1;
        for (let z = 0; z < PADDED; z++) {
          const idx = data[paddedIndex(x, y, z)] as number;
          if (idx < 0) continue;
          const inf = this.infoOf(idx);
          if (inf.occ) occ[((x + 1) * OP + (y + 1)) * OP + (z + 1)] = 1;
          if (innerXY && z > 0 && z < PADDED - 1 && !inf.air) {
            any = true;
            if (inf.special !== 0) special = true;
          }
        }
      }
    }
    if (!any) return { opaque: null, cutout: null, translucent: null, quads: 0 };

    const occGrid: OccGrid = { size: [OP, OP, OP], data: occ };
    let scene: Scene | null = null;
    if (special) {
      const dense: DenseVolume = {
        size: [PADDED, PADDED, PADDED],
        origin: [0, 0, 0],
        data,
        palette: this.palette,
      };
      // Only the entries present matter to the scene; the rest read as non-occluding.
      const known: boolean[] = [];
      for (let i = 0; i < data.length; i++) {
        const idx = data[i] as number;
        if (idx >= 0 && known[idx] === undefined) known[idx] = this.infoOf(idx).occ;
      }
      scene = prepareScene(dense, this.assets, known);
    }

    for (const e of this.buckets) e.reset();
    let quads = 0;
    for (let x = 1; x <= SECTION_SIZE; x++) {
      for (let y = 1; y <= SECTION_SIZE; y++) {
        for (let z = 1; z <= SECTION_SIZE; z++) {
          const idx = data[paddedIndex(x, y, z)] as number;
          if (idx < 0) continue;
          const inf = this.infoOf(idx);
          if (inf.air) continue;
          let list: PQuad[];
          if (inf.special !== 0 && scene !== null) {
            const block = effectiveBlock(scene, x, y, z);
            if (block === null) continue;
            list = this.quadsOfBlock(block);
          } else {
            list = this.quadsOf(idx);
          }
          for (const q of list) {
            if (q.cull !== null) {
              const n = data[
                paddedIndex(
                  x + Math.trunc(q.cull[0]),
                  y + Math.trunc(q.cull[1]),
                  z + Math.trunc(q.cull[2]),
                )
              ] as number;
              if (n >= 0) {
                const ni = this.infoOf(n);
                if (ni.occ ? !ni.leaves : inf.hidesSame && ni.nameId === inf.nameId) continue;
              }
            }
            let shades: number[] | null = null;
            let flip = false;
            if (!q.flat) {
              const lv = quadAoLevels(q.local, q.normal, [x, y, z], occGrid);
              if (lv[0] !== 3 || lv[1] !== 3 || lv[2] !== 3 || lv[3] !== 3) {
                shades = lv.map((l) => AO_BRIGHTNESS[l] as number);
                flip =
                  (shades[0] as number) + (shades[2] as number) <
                  (shades[1] as number) + (shades[3] as number);
              }
            }
            (this.buckets[q.bucket] as Emitter).quad(q, x - 1, y - 1, z - 1, shades, flip);
            quads++;
          }
        }
      }
    }
    return {
      opaque: this.buckets[BUCKET_OPAQUE].finish(),
      cutout: this.buckets[BUCKET_CUTOUT].finish(),
      translucent: this.buckets[BUCKET_TRANSLUCENT].finish(),
      quads,
    };
  }
}

function averageColour(q: Quad): readonly [number, number, number, number] {
  const img = q.image;
  const n = img.width * img.height;
  const sum = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++)
      sum[k] = (sum[k] as number) + (img.data[i * img.channels + k] as number);
    sum[3] = (sum[3] as number) + (img.channels === 4 ? (img.data[i * 4 + 3] as number) : 255);
  }
  return [
    Math.round((sum[0] as number) / n),
    Math.round((sum[1] as number) / n),
    Math.round((sum[2] as number) / n),
    Math.round((sum[3] as number) / n),
  ];
}
