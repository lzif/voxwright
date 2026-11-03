// SPDX-License-Identifier: AGPL-3.0-only

export type Rgb = readonly [number, number, number];

/**
 * Default props for variant matching when the canonical blockstate omits them.
 * A missing prop means the vanilla default blockstate. A variant is rejected
 * only by contradicting an explicit prop; defaults only score, so adding one
 * can only break ties toward variants that agree with it.
 */
export const DEFAULT_PROPS: Readonly<Record<string, string>> = {
  facing: "north",
  half: "bottom",
  shape: "straight",
  type: "bottom", // slabs
  axis: "y",
  hanging: "false", // lanterns
  waterlogged: "false",
  open: "false",
  // Sign templates key variants on rotation= / attached=.
  rotation: "0",
  attached: "false",
  // grass_block / mycelium / podzol are the only blockstates keyed on snowy=.
  snowy: "false",
};

const PLAINS_GRASS: Rgb = [145, 189, 89]; // grass.png @ (50,173)
const PLAINS_FOLIAGE: Rgb = [119, 171, 47]; // foliage.png @ (50,173)
const PLAINS_DRY_FOLIAGE: Rgb = [163, 117, 70]; // dry_foliage.png @ (50,173)

/**
 * Block to plains RGB tint. Faces whose model declares `tintindex >= 0` get
 * their texture multiplied by this. Blocks not listed get no tint even when
 * their model declares one (default-deny, as in vanilla for cherry and
 * pale-oak leaves). Redstone dust and stems use power/age tints and are left out.
 */
export const TINT_TABLE: Readonly<Record<string, Rgb>> = {
  "minecraft:grass_block": PLAINS_GRASS,
  "minecraft:short_grass": PLAINS_GRASS,
  "minecraft:tall_grass": PLAINS_GRASS,
  "minecraft:fern": PLAINS_GRASS,
  "minecraft:large_fern": PLAINS_GRASS,
  "minecraft:potted_fern": PLAINS_GRASS,
  "minecraft:sugar_cane": PLAINS_GRASS,
  "minecraft:bush": PLAINS_GRASS,
  "minecraft:wildflowers": PLAINS_GRASS,
  "minecraft:pink_petals": PLAINS_GRASS,
  "minecraft:bamboo": PLAINS_GRASS,
  "minecraft:oak_leaves": PLAINS_FOLIAGE,
  "minecraft:jungle_leaves": PLAINS_FOLIAGE,
  "minecraft:acacia_leaves": PLAINS_FOLIAGE,
  "minecraft:dark_oak_leaves": PLAINS_FOLIAGE,
  "minecraft:mangrove_leaves": PLAINS_FOLIAGE,
  "minecraft:vine": PLAINS_FOLIAGE,
  "minecraft:leaf_litter": PLAINS_DRY_FOLIAGE,
  "minecraft:birch_leaves": [128, 167, 85],
  "minecraft:spruce_leaves": [97, 153, 97],
  "minecraft:lily_pad": [32, 128, 48],
};
