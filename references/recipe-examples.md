<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# Recipe examples

Three complete recipes. Each one builds as written and passes validation for Minecraft 26.2.
Copy the closest one, rename it and change it; the API is in [builder-api.md](builder-api.md),
block states in [block-states.md](block-states.md).

| Recipe                                | Shows                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Watchtower](#watchtower)             | Architecture: named dimensions, `patches`, `carve`, `arch`, `parapet`, explicit block states |
| [Hill with a pond](#hill-with-a-pond) | Terrain: a height function, layered columns, water, `rng` scatter, a tree                    |
| [Pavilion](#pavilion)                 | Symmetry: one `Geometry` per side, placed four times with `rotation`                         |

Run one from the directory that holds the file (`<skill-dir>` is the directory of `SKILL.md`):

```sh
node <skill-dir>/scripts/voxwright-cli.mjs build watchtower.ts --out out/watchtower.schem
```

More recipes, larger and less commented, are in `packages/mcbuilder/examples/` of the skill
directory (`storehouse/`, `homestead/`, `crystal_observatory/`, `waystones/`, ...). They run the
same way.

## Watchtower

A 7×7 stone tower on a plinth: an arched doorway to the south, pane windows, a ladder inside,
and a crenellated parapet carried on upside-down stairs.

```ts
// recipe: watchtower.ts
import { Build, patches, shapes } from "voxwright";

export const BUILD = new Build({ seed: 11 });

// Dimensions first; every coordinate below is derived from them.
const W = 7; // shaft footprint: x and z from 0 to W - 1
const E = W - 1; // the far edge
const MID = 3; // centre column
const H = 11; // wall rows: y from 1 to H
const TOP = H + 1; // walkway level

const STONE = patches(
  [
    ["minecraft:stone_bricks", 6],
    ["minecraft:cracked_stone_bricks", 1],
    ["minecraft:mossy_stone_bricks", 1],
    ["minecraft:andesite", 1],
  ],
  { scale: 2, salt: "shaft" },
);

BUILD.scope(() => {
  // 1. Masses: plinth, shaft, corner posts.
  BUILD.box([-1, 0, -1], [W, 0, W], "minecraft:cobblestone");
  BUILD.walls([0, 1, 0], [E, H, E], STONE);
  for (const [x, z] of [
    [0, 0],
    [E, 0],
    [0, E],
    [E, E],
  ] as const) {
    BUILD.pillar([x, 1, z], H, "minecraft:polished_andesite");
  }

  // 2. Doorway in the south wall (z = E): a 3-wide opening and an arch head on its top row.
  BUILD.carve([MID - 1, 1, E], [MID + 1, 3, E]);
  BUILD.place(
    shapes.arch([MID - 1, 3, E], 3, "minecraft:stone_brick_stairs", {
      axis: "x",
      profile: "stepped",
      rise: 1,
    }),
  );
  // Wall torches point away from the wall they hang on.
  BUILD.set(MID - 2, 3, E + 1, "minecraft:wall_torch[facing=south]");
  BUILD.set(MID + 2, 3, E + 1, "minecraft:wall_torch[facing=south]");

  // 3. Windows: panes need their arms written out. On the north wall they run east-west.
  for (const y of [5, 6, 9]) {
    BUILD.set(MID, y, 0, "minecraft:glass_pane[east=true,west=true]");
    BUILD.set(0, y, MID, "minecraft:glass_pane[north=true,south=true]");
    BUILD.set(E, y, MID, "minecraft:glass_pane[north=true,south=true]");
  }

  // 4. Walkway on top of the walls, with a hatch for the ladder.
  BUILD.floor([0, TOP, 0], [E, TOP, E], "minecraft:spruce_planks");
  BUILD.carve([1, TOP, 1], [1, TOP, 1]);
  // The ladder hangs on the north wall (z = 0), so it faces south.
  BUILD.pillar([1, 1, 1], TOP, "minecraft:ladder[facing=south]");
  BUILD.set(MID, H, MID, "minecraft:lantern[hanging=true]");

  // 5. Parapet: stepped out one cell on a ring of upside-down stairs under it.
  BUILD.place(
    shapes.parapet([0, TOP, 0], [E, TOP, E], "minecraft:stone_bricks", {
      corbel: "minecraft:stone_brick_stairs",
      height: 1,
      base: 1,
    }),
  );
});
```

## Hill with a pond

Terrain comes from a height function, not from shapes: loop over the columns, stack layers by
depth, then scatter details with a named `rng` stream so they stay put between runs.

```ts
// recipe: hill-pond.ts
import { Build, patches } from "voxwright";

export const BUILD = new Build({ seed: 42 });

const SIZE = 28; // x and z from 0 to SIZE - 1
const WATER = 3; // water surface level
const TREE: [number, number] = [20, 8]; // on the hilltop

const ROCK = patches([["minecraft:stone", 4], ["minecraft:andesite", 2], "minecraft:cobblestone"], {
  scale: 3,
  salt: "rock",
});

/** Ground level of a column: rolling ground, one hill, one bowl for the pond. */
function height(x: number, z: number): number {
  const rolling = 4 + 1.5 * Math.sin(x / 4.5) * Math.cos(z / 5.5);
  const hill = 5 * Math.exp(-((x - TREE[0]) ** 2 + (z - TREE[1]) ** 2) / 40);
  const bowl = 5 * Math.exp(-((x - 8) ** 2 + (z - 18) ** 2) / 18);
  return Math.max(1, Math.round(rolling + hill - bowl));
}

BUILD.scope(() => {
  const plants = BUILD.rng("plants");

  for (let x = 0; x < SIZE; x++) {
    for (let z = 0; z < SIZE; z++) {
      const h = height(x, z);
      const wet = h < WATER;
      // Layers by depth: rock, three blocks of dirt, then the surface.
      if (h > 3) BUILD.box([x, 0, z], [x, h - 4, z], ROCK);
      BUILD.box([x, Math.max(0, h - 3), z], [x, h - 1, z], "minecraft:dirt");
      BUILD.set(x, h, z, wet || h === WATER ? "minecraft:sand" : "minecraft:grass_block");

      if (wet) {
        BUILD.box([x, h + 1, z], [x, WATER, z], "minecraft:water");
        if (plants.random() < 0.08) BUILD.set(x, WATER + 1, z, "minecraft:lily_pad");
      } else if (h > WATER) {
        const roll = plants.random();
        if (roll < 0.1) BUILD.set(x, h + 1, z, "minecraft:short_grass");
        else if (roll < 0.13)
          BUILD.set(
            x,
            h + 1,
            z,
            plants.choice(["minecraft:poppy", "minecraft:dandelion", "minecraft:azure_bluet"]),
          );
      }
    }
  }

  // Boulders: half-buried spheres. Their own stream, so editing plants does not move them.
  const rocks = BUILD.rng("rocks");
  for (let i = 0; i < 4; i++) {
    const x = rocks.int(3, SIZE - 4);
    const z = rocks.int(3, SIZE - 4);
    if (height(x, z) > WATER) BUILD.sphere([x, height(x, z), z], rocks.int(1, 2), ROCK);
  }

  // Tree: leaves first, trunk last, so the trunk wins where they overlap.
  const [tx, tz] = TREE;
  const ground = height(tx, tz);
  const LEAVES = "minecraft:oak_leaves[persistent=true]";
  BUILD.sphere([tx, ground + 6, tz], 3, LEAVES);
  BUILD.sphere([tx + 2, ground + 5, tz - 1], 2, LEAVES);
  BUILD.sphere([tx - 2, ground + 5, tz + 1], 2, LEAVES);
  BUILD.pillar([tx, ground + 1, tz], 6, "minecraft:oak_log[axis=y]");
});
```

## Pavilion

Four identical sides. Model one side as a `Geometry` relative to the centre of the build, facing
south, and place it four times with `rotation`: positions and block states (`facing`, fence
arms) turn together.

```ts
// recipe: pavilion.ts
import { Build, Geometry, shapes } from "voxwright";

export const BUILD = new Build({ seed: 5 });

const R = 4; // half-width of the platform: x and z from -R to R
const DECK = 1; // top of the platform
const BEAM = 6; // the ring of beams that carries the roof

/** The south side: steps, the corner pier to the south-east, railings and a lantern. */
function side(): Geometry {
  const g = new Geometry();
  // Pier on the south-east corner; the other three corners come from the rotated copies.
  for (let y = DECK + 1; y <= BEAM; y++) g.set(R, y, R, "minecraft:stripped_spruce_log[axis=y]");
  // Railings left and right of the entrance. The arms are written for this side only.
  for (const x of [-3, -2, 2, 3])
    g.set(x, DECK + 1, R, "minecraft:spruce_fence[east=true,west=true]");
  g.set(0, BEAM - 1, R, "minecraft:lantern[hanging=true]");
  // Two steps climbing north onto the deck, three wide, on a solid base.
  const steps = shapes.stairs([-1, 0, R + 2], "north", "minecraft:stone_brick_stairs", {
    length: 2,
    width: 3,
  });
  const base = shapes.box([-1, 0, R + 1], [1, 0, R + 1], "minecraft:stone_bricks");
  return g.concat(base).concat(steps);
}

BUILD.scope(() => {
  BUILD.box([-R, 0, -R], [R, DECK, R], "minecraft:smooth_stone");
  BUILD.floor([-R + 1, DECK, -R + 1], [R - 1, DECK, R - 1], "minecraft:spruce_planks");

  const part = side();
  for (const rotation of [
    "NONE",
    "CLOCKWISE_90",
    "CLOCKWISE_180",
    "COUNTERCLOCKWISE_90",
  ] as const) {
    BUILD.place(part, { rotation });
  }

  // Beams on the piers, then a hip roof one cell wider than the beams on every side.
  BUILD.walls([-R, BEAM, -R], [R, BEAM, R], "minecraft:spruce_planks");
  BUILD.roofHip([-R - 1, BEAM, -R - 1], [R + 1, BEAM, R + 1], "minecraft:dark_oak_stairs", {
    hip: "minecraft:dark_oak_planks",
    cap: "minecraft:dark_oak_slab[type=bottom]",
  });

  // A small basin in the middle.
  BUILD.cylinder([0, DECK + 1, 0], 1, 1, "minecraft:chiseled_stone_bricks", {
    hollow: true,
    fill: "minecraft:water",
  });
});
```

## Checklist before running `build`

- Every placement is inside `BUILD.scope`.
- Stairs given to `stairs`, roofs, `arch` and `corbel` have no `facing`; slabs given to `arch` and
  `skirtRoof` have no `type`.
- Doors, beds and tall plants have both halves; leaves have `persistent=true`.
- Fences, panes and walls that must look connected have their arms written.
- Randomness comes from `BUILD.rng(...)`, never from `Math.random()`.
