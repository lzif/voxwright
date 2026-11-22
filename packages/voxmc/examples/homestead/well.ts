// SPDX-License-Identifier: AGPL-3.0-only

// Small roofed well. The shaft goes 3 blocks below y = 0, so dig before
// pasting (or paste with the structure's origin 3 blocks lower).

import { Build, patches } from "../../src/index.ts";
import { HANGING_LANTERN } from "./common.ts";

export const BUILD = new Build({ seed: 1207, views: "iso;az200_el025" });

BUILD.scope(() => {
  BUILD.box(
    [-1, -3, -1],
    [1, 1, 1],
    patches([["minecraft:mossy_cobblestone", 2], "minecraft:cobblestone"], { scale: 1.5 }),
  );
  BUILD.box([0, -3, 0], [0, 0, 0], "minecraft:water");
  BUILD.set(0, 1, 0, "minecraft:air");
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    BUILD.pillar([x, 2, z], 2, "minecraft:spruce_fence");
  }
  BUILD.roofHip([-1, 4, -1], [1, 4, 1], "minecraft:spruce_stairs", {
    hip: "minecraft:spruce_planks",
  });
  BUILD.set(0, 3, 0, "minecraft:iron_chain[axis=y]");
  BUILD.set(0, 2, 0, HANGING_LANTERN);
});
