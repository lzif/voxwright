// SPDX-License-Identifier: AGPL-3.0-only

// Reel keep: a small two-stage stone keep that shows the three shapes from the
// reel study, `arch`, `parapet` and `skirtRoof`, working together.
//
// A 10 x 10 lower stage with a pointed gate portal and segmental windows, a
// spruce skirt roof with a dentil row at the stage change, a 6 x 6 upper stage
// with stepped-arch belfry windows, and a corbelled, crenellated crown.
// Front (the gate) faces south. Paste on flat ground; the plinth is y = 0.

import { Build, type Material, patches, shapes } from "../../src/index.ts";

export const BUILD = new Build({ seed: 41, views: "az200_el025;az330_el030;az135_el035" });
const SEED = 41;

// -- palette --------------------------------------------------------------------
const STONE = patches(
  [
    ["minecraft:stone_bricks", 5],
    ["minecraft:mossy_stone_bricks", 1],
    ["minecraft:cracked_stone_bricks", 1],
    ["minecraft:andesite", 1],
  ],
  { scale: 2, salt: "stone" },
);
const PLINTH = patches(
  [["minecraft:cobbled_deepslate", 2], ["minecraft:cobblestone", 2], "minecraft:deepslate_bricks"],
  { scale: 1.5, salt: "plinth" },
);
const QUOIN = "minecraft:polished_andesite";
const ARCH_STAIR: Material = [
  ["minecraft:smooth_quartz_stairs", 4],
  ["minecraft:quartz_stairs", 1],
];
const ARCH_SLAB = "minecraft:smooth_quartz_slab";
const CROWN_STONE = patches(
  [["minecraft:stone_bricks", 4], "minecraft:andesite", "minecraft:cracked_stone_bricks"],
  { scale: 1.5, salt: "crown" },
);
const CORBEL_STAIR: Material = [
  ["minecraft:stone_brick_stairs", 3],
  ["minecraft:andesite_stairs", 1],
];
const SKIRT = patches([["minecraft:spruce_planks", 4], "minecraft:dark_oak_planks"], {
  scale: 2.5,
  salt: "skirt",
});
const SKIRT_SLAB: Material = [["minecraft:spruce_slab", 4], "minecraft:dark_oak_slab"];
const SKIRT_TRIM = "minecraft:dark_oak_planks";
const SHUTTER = "minecraft:dark_oak_trapdoor";
const LANTERN = "minecraft:lantern";
const HANGING = "minecraft:lantern[hanging=true]";
const GLASS = "minecraft:glass_pane";

// -- dimensions -----------------------------------------------------------------
const [X0, X1, Z0, Z1] = [0, 9, 0, 9]; // lower stage footprint (10 x 10)
const [UX0, UX1, UZ0, UZ1] = [2, 7, 2, 7]; // upper stage footprint (6 x 6)
const LOWER_TOP = 10; // last wall row of the lower stage
const SKIRT_Y = LOWER_TOP + 1;
const UPPER_TOP = 22; // last wall row of the upper stage

type Face = "north" | "south" | "west" | "east";
const OUT: Record<Face, readonly [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  west: [-1, 0],
  east: [1, 0],
};

interface ArchWindow {
  face: Face;
  /** First cell of the span along the wall (x for north/south walls, z for west/east). */
  from: number;
  /** Plane coordinate of the wall (z for north/south, x for west/east). */
  plane: number;
  /** First opening row. */
  sill: number;
  /** Opening rows below the head. */
  open: number;
  width: number;
  options: Omit<shapes.ArchOptions, "axis" | "seed" | "fill">;
  shutters?: number;
}

/**
 * A glazed window with an arch head, cut into a wall that is already built.
 * The arch sits in the wall plane; the spandrel is filled with the wall stone.
 */
function archWindow({ face, from, plane, sill, open, width, options, shutters }: ArchWindow): void {
  const alongX = face === "north" || face === "south";
  const cell = (col: number, y: number, depth = 0): [number, number, number] => {
    const [ox, oz] = OUT[face];
    return alongX ? [from + col, y, plane + oz * depth] : [plane + ox * depth, y, from + col];
  };
  const head = sill + open;
  const arch = shapes.arch(cell(0, head), width, ARCH_STAIR, {
    axis: alongX ? "x" : "z",
    seed: SEED,
    fill: STONE,
    ...options,
    slab: options.profile === "stepped" ? undefined : ARCH_SLAB,
  });
  const headRows = Math.max(...arch.cells().map((c) => c[1])) - head + 1;
  BUILD.carve(cell(0, sill), cell(width - 1, head + headRows - 1));
  for (let col = 0; col < width; col++) {
    for (let y = sill; y < head; y++) BUILD.set(...cell(col, y), GLASS);
    // the head rows' open cells between the springing stairs are glass too
    for (let row = 0; row < headRows - 1; row++) {
      if (col > row && col < width - 1 - row) BUILD.set(...cell(col, head + row), GLASS);
    }
  }
  BUILD.place(arch);
  if (shutters) {
    for (const col of [-1, width]) {
      for (let y = sill; y < sill + shutters; y++) {
        const [x, , z] = cell(col, y, 1);
        BUILD.set(x, y, z, `${SHUTTER}[facing=${face},half=bottom,open=true]`);
      }
    }
  }
}

BUILD.scope(() => {
  // =========================================================================
  // plinth, floors, lower stage
  // =========================================================================
  BUILD.place(shapes.box([X0 - 2, 0, Z0 - 2], [X1 + 2, 0, Z1 + 2], PLINTH, { seed: SEED }));
  BUILD.place(shapes.box([X0 + 1, 0, Z0 + 1], [X1 - 1, 0, Z1 - 1], "minecraft:spruce_planks"));
  BUILD.place(shapes.walls([X0, 1, Z0], [X1, LOWER_TOP, Z1], STONE, { seed: SEED }));
  BUILD.place(shapes.walls([X0, 1, Z0], [X1, 1, Z1], PLINTH, { seed: SEED })); // footing course
  for (const x of [X0, X1]) {
    for (const z of [Z0, Z1]) BUILD.place(shapes.pillar([x, 1, z], LOWER_TOP, QUOIN));
  }
  // a path to the gate
  BUILD.place(shapes.box([4, 0, Z1 + 3], [5, 0, Z1 + 6], PLINTH, { seed: SEED }));

  // =========================================================================
  // gate: pointed arch over a double door with iron-bar sidelights
  // =========================================================================
  BUILD.carve([3, 1, Z1], [6, 3, Z1]);
  BUILD.set(4, 1, Z1, "minecraft:spruce_door[facing=north,half=lower,hinge=left]");
  BUILD.set(4, 2, Z1, "minecraft:spruce_door[facing=north,half=upper,hinge=left]");
  BUILD.set(5, 1, Z1, "minecraft:spruce_door[facing=north,half=lower,hinge=right]");
  BUILD.set(5, 2, Z1, "minecraft:spruce_door[facing=north,half=upper,hinge=right]");
  for (const x of [3, 6]) BUILD.place(shapes.pillar([x, 1, Z1], 3, "minecraft:iron_bars"));
  for (const x of [4, 5]) BUILD.set(x, 3, Z1, SKIRT_TRIM);
  archWindow({
    face: "south",
    from: 3,
    plane: Z1,
    sill: 4,
    open: 0,
    width: 4,
    options: { profile: "pointed" },
  });
  for (const x of [2, 7]) {
    BUILD.place(shapes.pillar([x, 1, Z1 + 1], 2, "minecraft:dark_oak_fence"));
    BUILD.set(x, 3, Z1 + 1, LANTERN);
  }

  // =========================================================================
  // lower windows: segmental heads, shuttered
  // =========================================================================
  for (const z of [1, 6]) {
    for (const [face, plane] of [
      ["west", X0],
      ["east", X1],
    ] as const) {
      archWindow({
        face,
        from: z,
        plane,
        sill: 4,
        open: 3,
        width: 3,
        options: { profile: "segmental" },
        shutters: 3,
      });
    }
    archWindow({
      face: "north",
      from: z,
      plane: Z0,
      sill: 4,
      open: 3,
      width: 3,
      options: { profile: "segmental" },
      shutters: 3,
    });
  }
  // the window over the gate
  archWindow({
    face: "south",
    from: 3,
    plane: Z1,
    sill: 7,
    open: 2,
    width: 4,
    options: { profile: "segmental" },
    shutters: 2,
  });

  // =========================================================================
  // skirt roof at the stage change, with lanterns under the brim
  // =========================================================================
  BUILD.place(
    shapes.skirtRoof([X0, SKIRT_Y, Z0], [X1, SKIRT_Y, Z1], SKIRT, {
      overhang: 2,
      courses: 3,
      slab: SKIRT_SLAB,
      rim: SKIRT_TRIM,
      dentil: SKIRT_TRIM,
      hole: [
        [UX0, 0, UZ0],
        [UX1, 0, UZ1],
      ],
      seed: SEED,
    }),
  );
  for (const [x, z] of [
    [X0 - 1, Z0 - 1],
    [X1 + 1, Z0 - 1],
    [X0 - 1, Z1 + 1],
    [X1 + 1, Z1 + 1],
    [X0 - 1, 4],
    [X1 + 1, 4],
    [4, Z0 - 1],
    [3, Z1 + 1],
    [6, Z1 + 1],
  ] as const) {
    BUILD.set(x, LOWER_TOP, z, HANGING);
  }

  // =========================================================================
  // upper stage: belfry windows with stepped heads
  // =========================================================================
  BUILD.place(shapes.walls([UX0, SKIRT_Y, UZ0], [UX1, UPPER_TOP, UZ1], STONE, { seed: SEED }));
  for (const x of [UX0, UX1]) {
    for (const z of [UZ0, UZ1])
      BUILD.place(shapes.pillar([x, SKIRT_Y, z], UPPER_TOP - SKIRT_Y + 1, QUOIN));
  }
  const upper: [Face, number, number][] = [
    ["south", UX0 + 1, UZ1],
    ["north", UX0 + 1, UZ0],
    ["west", UZ0 + 1, UX0],
    ["east", UZ0 + 1, UX1],
  ];
  for (const [face, from, plane] of upper) {
    archWindow({
      face,
      from,
      plane,
      sill: 16,
      open: 3,
      width: 4,
      options: { profile: "stepped", rise: 2 },
      shutters: 3,
    });
  }

  // =========================================================================
  // crown: floor, corbelled parapet, flagpole
  // =========================================================================
  BUILD.place(
    shapes.box(
      [UX0 + 1, UPPER_TOP, UZ0 + 1],
      [UX1 - 1, UPPER_TOP, UZ1 - 1],
      "minecraft:spruce_planks",
    ),
  );
  BUILD.place(
    shapes.parapet([UX0, UPPER_TOP + 1, UZ0], [UX1, UPPER_TOP + 1, UZ1], CROWN_STONE, {
      corbel: CORBEL_STAIR,
      merlon: 1,
      crenel: 1,
      base: 1,
      height: 2,
      seed: SEED,
    }),
  );
  for (const [x, z] of [
    [UX0 + 1, UZ0 + 1],
    [UX1 - 1, UZ1 - 1],
  ] as const) {
    BUILD.place(shapes.pillar([x, UPPER_TOP + 1, z], 1, "minecraft:dark_oak_fence"));
    BUILD.set(x, UPPER_TOP + 2, z, LANTERN);
  }
  BUILD.place(shapes.pillar([4, UPPER_TOP + 1, 4], 5, "minecraft:dark_oak_fence"));
  BUILD.set(4, UPPER_TOP + 6, 4, "minecraft:red_banner[rotation=8]");
});
