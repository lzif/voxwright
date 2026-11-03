// SPDX-License-Identifier: AGPL-3.0-only

// Shared by the mesher tests: a small in-memory asset source, a real one when
// the vanilla assets are present, and helpers that flatten meshes into
// comparable strings.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Volume } from "@voxwright/core";
import {
  type AssetSource,
  type Atlas,
  buildAtlas,
  fromRgba,
  type MeshBuffers,
  parseSectionKey,
  type RasterImage,
  type SectionMesh,
  SectionMesher,
  SectionStore,
  sourceFromDecoded,
} from "../src/index.ts";
import { directoryAssets } from "../src/node/index.ts";

export const vanillaRoot =
  process.env.VOXWRIGHT_ASSETS ?? join(homedir(), ".cache/mcbuilder/26.2/client/assets/minecraft");
export const haveVanilla = existsSync(join(vanillaRoot, "blockstates"));

/** A 16x16 texture in which every texel is distinct, so any UV mix-up shows. */
export function patternTexture(
  seed: number,
  alpha: "none" | "cutout" | "glass" = "none",
): RasterImage {
  const rgba = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4;
      rgba[i] = (x * 16 + seed * 7) & 255;
      rgba[i + 1] = (y * 16 + seed * 13) & 255;
      rgba[i + 2] = (x * 5 + y * 11 + seed * 29) & 255;
      rgba[i + 3] =
        alpha === "cutout" ? ((x + y) % 3 === 0 ? 0 : 255) : alpha === "glass" ? 120 : 255;
    }
  return fromRgba(16, 16, rgba);
}

const CUBE_FACES = (tex: string, extra: Record<string, unknown> = {}): Record<string, unknown> => {
  const faces: Record<string, unknown> = {};
  for (const f of ["down", "up", "north", "south", "west", "east"])
    faces[f] = { texture: tex, cullface: f, ...extra };
  return faces;
};

/** Stone, glass, leaves, a lopsided block and a column: enough to exercise buckets, tint, UV transforms. */
export function fakeAssets(): AssetSource & { textureIds(): string[] } {
  const json: Record<string, unknown> = {
    "blockstates/stone.json": { variants: { "": { model: "block/stone" } } },
    "blockstates/glass.json": { variants: { "": { model: "block/glass" } } },
    "blockstates/oak_leaves.json": { variants: { "": { model: "block/oak_leaves" } } },
    "blockstates/lopsided.json": { variants: { "": { model: "block/lopsided", y: 90 } } },
    "blockstates/slab.json": { variants: { "": { model: "block/slab" } } },
    "models/block/stone.json": {
      textures: { all: "block/stone" },
      elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: CUBE_FACES("#all") }],
    },
    "models/block/glass.json": {
      textures: { all: "block/glass" },
      elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: CUBE_FACES("#all") }],
    },
    "models/block/oak_leaves.json": {
      textures: { all: "block/leaves" },
      elements: [
        { from: [0, 0, 0], to: [16, 16, 16], faces: CUBE_FACES("#all", { tintindex: 0 }) },
      ],
    },
    "models/block/slab.json": {
      textures: { all: "block/stone" },
      elements: [
        {
          from: [0, 0, 0],
          to: [16, 8, 16],
          faces: {
            ...CUBE_FACES("#all"),
            north: { texture: "#all", uv: [0, 8, 16, 16], cullface: "north" },
            up: { texture: "#all" },
          },
        },
      ],
    },
    // Mirrored and rotated faces on a cube, with a crop, to prove the UV mapping.
    "models/block/lopsided.json": {
      textures: { all: "block/stone" },
      elements: [
        {
          from: [0, 0, 0],
          to: [16, 16, 16],
          faces: {
            down: { texture: "#all", uv: [16, 0, 0, 16], cullface: "down" },
            up: { texture: "#all", uv: [0, 0, 16, 8], rotation: 90, cullface: "up" },
            north: { texture: "#all", uv: [0, 16, 16, 0], cullface: "north" },
            south: { texture: "#all", uv: [4, 2, 12, 14], rotation: 270, cullface: "south" },
            west: { texture: "#all", uv: [0, 0, 16, 16], rotation: 180, cullface: "west" },
            east: { texture: "#all", uv: [16, 16, 0, 0], rotation: 90, cullface: "east" },
          },
        },
      ],
    },
  };
  const textures: Record<string, RasterImage> = {
    "block/stone": patternTexture(1),
    "block/glass": patternTexture(2, "glass"),
    "block/leaves": patternTexture(3, "cutout"),
  };
  return sourceFromDecoded({ json, textures });
}

/** Real vanilla assets from disk, when they were fetched. */
export const vanillaAssets = (): AssetSource => directoryAssets(vanillaRoot);

export function atlasFor(assets: AssetSource, ids: string[]): Atlas {
  return buildAtlas(ids, assets);
}

/** Every texture id under block/ and the chest and banner entities, found by walking the folder. */
export async function vanillaTextureIds(): Promise<string[]> {
  const { readdirSync, statSync } = await import("node:fs");
  const out: string[] = [];
  const walk = (rel: string): void => {
    const dir = join(vanillaRoot, "textures", rel);
    if (!existsSync(dir)) return;
    for (const n of readdirSync(dir).sort()) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(`${rel}/${n}`);
      else if (n.endsWith(".png")) out.push(`${rel}/${n.slice(0, -4)}`);
    }
  };
  walk("block");
  walk("entity/chest");
  walk("entity/banner");
  return out;
}

/** Mesh every section of a volume. */
export function meshVolume(
  volume: Volume,
  mesher: SectionMesher,
  slice: { y0: number; y1: number } | null = null,
): Map<string, SectionMesh> {
  const store = new SectionStore(volume);
  mesher.resetPalette();
  mesher.extendPalette(volume.palette);
  const out = new Map<string, SectionMesh>();
  for (const key of store.keys()) {
    const [sx, sy, sz] = parseSectionKey(key);
    out.set(
      key,
      mesher.mesh(store.padded(sx, sy, sz), slice === null ? null : { ...slice, originY: sy * 16 }),
    );
  }
  return out;
}

const BUCKETS = ["opaque", "cutout", "translucent"] as const;

/** One string per quad: bucket, then its four vertices (world position, colour, uv) in sorted order. */
export function quadSignatures(meshes: Map<string, SectionMesh>, shift = [0, 0, 0]): string[] {
  const out: string[] = [];
  for (const [key, mesh] of meshes) {
    const [sx, sy, sz] = parseSectionKey(key);
    for (const bucket of BUCKETS) {
      const b = mesh[bucket] as MeshBuffers | null;
      if (b === null) continue;
      for (let q = 0; q < b.positions.length / 12; q++) {
        const verts: string[] = [];
        for (let k = 0; k < 4; k++) {
          const v = q * 4 + k;
          const p = [0, 1, 2].map((a) =>
            (
              (b.positions[v * 3 + a] as number) +
              ([sx, sy, sz][a] as number) * 16 +
              (shift[a] as number)
            ).toFixed(4),
          );
          const c = [...b.colors.subarray(v * 4, v * 4 + 4)];
          const uv = [...b.uvs.subarray(v * 2, v * 2 + 2)].map((n) => n.toFixed(5));
          verts.push(`${p.join(",")}|${c.join(",")}|${uv.join(",")}`);
        }
        out.push(`${bucket}:${verts.sort().join(" ")}`);
      }
    }
  }
  return out.sort();
}

export const quadCount = (meshes: Map<string, SectionMesh>): number =>
  [...meshes.values()].reduce((n, m) => n + m.quads, 0);

export function mesherFor(assets: AssetSource | null, atlas: Atlas): SectionMesher {
  return new SectionMesher({ assets, atlas });
}
