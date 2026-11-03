// SPDX-License-Identifier: AGPL-3.0-only

// A synthetic build for measuring the viewer: rolling terrain with lakes, trees,
// ore, and a village of small houses (stairs, panes, fences, walls, doors).
// Deterministic for a seed, so every run measures the same thing. Nothing is
// committed: scripts and tests generate it on the fly.

import { Volume } from "@voxwright/core";

export interface SyntheticOptions {
  /** Width and depth in cells (default 256). */
  size?: number;
  /** Height in cells (default 64). */
  height?: number;
  seed?: number;
}

const WATER_LEVEL = 24;

/** A small integer hash in 0..1, stable across runs. */
function hash(x: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

export function generateTerrain(options: SyntheticOptions = {}): Volume {
  const size = options.size ?? 256;
  const height = options.height ?? 64;
  const seed = options.seed ?? 1;
  const v = new Volume();
  const top = new Int32Array(size * size);
  const ground = (x: number, z: number): number => top[x * size + z] as number;

  // Terrain: stacked sine hills, clamped to the build height.
  for (let x = 0; x < size; x++)
    for (let z = 0; z < size; z++) {
      const h =
        26 +
        9 * Math.sin(x / 23) +
        7 * Math.sin(z / 17 + 1) +
        5 * Math.sin((x + z) / 31) +
        3 * Math.sin(x / 7) * Math.sin(z / 9);
      top[x * size + z] = Math.max(6, Math.min(height - 12, Math.round(h)));
    }

  for (let x = 0; x < size; x++)
    for (let z = 0; z < size; z++) {
      const g = ground(x, z);
      v.set(x, 0, z, "minecraft:bedrock");
      for (let y = 1; y <= g; y++) {
        let block = "minecraft:stone";
        if (y > g - 3) block = "minecraft:dirt";
        else if (hash(x * 131 + y, z * 17 + y, seed) < 0.012)
          block = y < 14 ? "minecraft:iron_ore" : "minecraft:coal_ore";
        if (y === g) block = g <= WATER_LEVEL + 1 ? "minecraft:sand" : "minecraft:grass_block";
        v.set(x, y, z, block);
      }
      for (let y = g + 1; y <= WATER_LEVEL; y++) v.set(x, y, z, "minecraft:water");
    }

  // Trees on dry grass.
  for (let x = 3; x < size - 3; x++)
    for (let z = 3; z < size - 3; z++) {
      const g = ground(x, z);
      if (g <= WATER_LEVEL + 1 || hash(x, z, seed + 7) > 0.006) continue;
      const trunk = 4 + Math.floor(hash(z, x, seed) * 3);
      for (let y = 1; y <= trunk; y++) v.set(x, g + y, z, "minecraft:oak_log[axis=y]");
      for (let dx = -2; dx <= 2; dx++)
        for (let dz = -2; dz <= 2; dz++)
          for (let dy = trunk - 1; dy <= trunk + 1; dy++) {
            if (Math.abs(dx) + Math.abs(dz) + Math.max(0, dy - trunk) > 3) continue;
            if (dx === 0 && dz === 0 && dy < trunk + 1) continue;
            if (v.get(x + dx, g + dy, z + dz) === undefined)
              v.set(x + dx, g + dy, z + dz, "minecraft:oak_leaves[distance=1,persistent=true]");
          }
    }

  // A village: a house on a flat pad every 40 cells.
  for (let hx = 24; hx < size - 24; hx += 40)
    for (let hz = 24; hz < size - 24; hz += 40) {
      const base = ground(hx + 4, hz + 3);
      if (base <= WATER_LEVEL + 1) continue;
      house(v, hx, base + 1, hz, 9, 7);
    }
  return v;
}

function house(v: Volume, x0: number, y0: number, z0: number, w: number, d: number): void {
  // Clear and flatten the pad so the house stands on grass.
  for (let x = x0 - 1; x <= x0 + w; x++)
    for (let z = z0 - 1; z <= z0 + d; z++) {
      v.set(x, y0 - 1, z, "minecraft:grass_block");
      for (let y = y0; y <= y0 + 9; y++) v.unset(x, y, z);
    }
  for (let x = x0; x < x0 + w; x++)
    for (let z = z0; z < z0 + d; z++) {
      v.set(x, y0 - 1, z, "minecraft:cobblestone");
      const edge = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + d - 1;
      for (let y = y0; y < y0 + 4; y++) {
        if (!edge) continue;
        const corner = (x === x0 || x === x0 + w - 1) && (z === z0 || z === z0 + d - 1);
        const window = !corner && y === y0 + 2 && (x + z) % 3 === 0;
        v.set(
          x,
          y,
          z,
          corner
            ? "minecraft:oak_log[axis=y]"
            : window
              ? "minecraft:glass_pane"
              : "minecraft:oak_planks",
        );
      }
    }
  // The door gap, then a gable roof of stairs and a slab ridge.
  v.set(x0 + 4, y0, z0, "minecraft:oak_door[facing=north,half=lower,hinge=left,open=false]");
  v.set(x0 + 4, y0 + 1, z0, "minecraft:oak_door[facing=north,half=upper,hinge=left,open=false]");
  for (let layer = 0; layer < 4; layer++)
    for (let z = z0 - 1; z <= z0 + d; z++) {
      v.set(
        x0 - 1 + layer,
        y0 + 4 + layer,
        z,
        "minecraft:oak_stairs[facing=east,half=bottom,shape=straight]",
      );
      v.set(
        x0 + w - layer,
        y0 + 4 + layer,
        z,
        "minecraft:oak_stairs[facing=west,half=bottom,shape=straight]",
      );
    }
  for (let z = z0 - 1; z <= z0 + d; z++)
    v.set(x0 + 4, y0 + 8, z, "minecraft:oak_slab[type=bottom]");
  // A fenced yard with a low wall and a lantern post.
  for (let x = x0 - 2; x <= x0 + w + 1; x++) {
    v.set(x, y0, z0 - 3, "minecraft:oak_fence");
    v.set(x, y0, z0 + d + 2, "minecraft:cobblestone_wall");
  }
  v.set(x0 + 4, y0, z0 - 3, "minecraft:oak_fence_gate[facing=north,open=false]");
  v.set(x0 - 2, y0 + 1, z0 - 3, "minecraft:lantern[hanging=false]");
}
