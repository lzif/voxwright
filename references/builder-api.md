<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# Recipe API

Everything a recipe can import from `"voxwright"`. Signatures are the ones in
`packages/mcbuilder/src/` and `packages/core/src/`; if a call is not on this page, it does not
exist. Block ids and block states are in [block-states.md](block-states.md); complete recipes are
in [recipe-examples.md](recipe-examples.md).

## Recipe contract

```ts
import { Build, Geometry, patches, shapes } from "voxwright";

export const BUILD = new Build({ seed: 7 });

BUILD.scope(() => {
  BUILD.box([0, 0, 0], [8, 0, 6], "minecraft:cobblestone");
  BUILD.walls([0, 1, 0], [8, 4, 6], "minecraft:oak_planks");
});
```

- A recipe is an ES module (`.ts`, `.mts`, `.mjs` or `.js`) that exports a `Build` as `BUILD`, or
  as the default export. TypeScript types are stripped, not checked.
- Every placement must run inside `BUILD.scope(() => { ... })`. Outside it, a placement throws
  `BuildError`. Scopes nest, and one recipe may open several.
- Import only from `"voxwright"` and from your own files by relative path
  (`import { tower } from "./tower.ts"`). No other package is available.
- `new Build(options)`:

  | Option          | Type                         | Default           | Meaning                                                  |
  | --------------- | ---------------------------- | ----------------- | -------------------------------------------------------- |
  | `seed`          | `number \| string \| null`   | `null`            | Drives palettes and `rng()`. Same seed, same build.      |
  | `maxDimensions` | `[number, number, number]`   | `[256, 256, 256]` | Each axis accepts coordinates from `-max` to `max - 1`.  |
  | `views`         | `string \| string[] \| null` | `null`            | Preview views for `mcbuild`; the skill CLI ignores them. |

## Coordinates

| Axis | Positive direction | Negative direction |
| ---- | ------------------ | ------------------ |
| X    | east               | west               |
| Y    | up                 | down               |
| Z    | south              | north              |

- A `Point` is `[x, y, z]` with integer values. A non-integer throws.
- Corners are inclusive and may be given in any order: `box([0, 0, 0], [8, 0, 6], ...)` is 9 wide
  and 7 deep.
- Negative coordinates are fine. The exported file starts at the build's own lowest corner, so
  only the shape matters, not where it sits. `BUILD.recenter()` moves the XZ centre to the origin.
- The last write to a cell wins. Build large to small: masses first, then openings, then details.
- A build larger than 512 blocks on an axis cannot be exported. A coordinate outside
  `maxDimensions` throws `GridBoundsError` when it is placed.

## Materials

Wherever a parameter is typed `Material`, any of these is accepted:

| Form             | Example                                                                     | Picks                                              |
| ---------------- | --------------------------------------------------------------------------- | -------------------------------------------------- |
| Block string     | `"minecraft:stone_bricks"`                                                  | That block in every cell                           |
| Weighted palette | `["minecraft:stone_bricks", ["minecraft:mossy_stone_bricks", 0.3]]`         | Per cell, by a hash of seed and position (speckle) |
| `patches(...)`   | `patches([["minecraft:stone", 3], "minecraft:andesite"], { scale: 4 })`     | Per cell, by smooth noise (clusters)               |
| Function         | `(x, y, z) => (y % 4 === 0 ? "minecraft:oak_log" : "minecraft:oak_planks")` | Whatever it returns                                |

```ts
patches(palette: readonly (string | readonly [block: string, weight: number])[],
        options?: { scale?: number; salt?: string }): (x, y, z) => string
```

- A bare string in a palette weighs 1. Weights are shares, not percentages.
- `scale` is the rough patch size in blocks (default 4). `salt` gives a different layout from the
  same palette; use one salt per surface so walls and floors do not share a pattern.
- Palettes and `patches` are deterministic: a cell resolves the same way on every run.
- Stairs and slabs that a shape orients for you (`stairs`, roofs, `arch`, a `parapet` corbel) take
  the block **without** `facing` (stairs) or `type` (slabs); the shape refuses a block that
  carries one.

## `Build` methods

Every shape method places its blocks and returns the placed `Geometry`.

### Primitives

```ts
set(x: number, y: number, z: number, block: Material): void
box(c1: Point, c2: Point, block: Material): Geometry        // solid, corners inclusive
walls(c1: Point, c2: Point, block: Material): Geometry      // the four vertical sides, no floor or ceiling
floor(c1: Point, c2: Point, block: Material): Geometry      // one layer at the lower Y of the two corners
pillar(base: Point, height: number, block: Material): Geometry   // `height` blocks up from `base`
line(p1: Point, p2: Point, block: Material): Geometry       // any direction, cells share faces
railing(start: Point, end: Point, block: Material): Geometry     // horizontal and axis-aligned only
carve(c1: Point, c2: Point): void                           // unset every cell in the box
```

- `carve` removes blocks; pasting the build leaves the world untouched there. To force air into
  the world (clear terrain inside a room), place `"minecraft:air"` with `box` instead.
- There is no hollow box: use `walls` plus `floor`, or a `box` followed by `carve` of the inside.

### Curved shapes

```ts
cylinder(center: Point, radius: number, height: number, block: Material,
         o?: { axis?: "x" | "y" | "z"; hollow?: boolean; fill?: Material | null }): Geometry
sphere(center: Point, radius: number, block: Material,
       o?: { hollow?: boolean; thickness?: number; dome?: boolean; fill?: Material | null }): Geometry
cone(center: Point, radius: number, height: number, block: Material,
     o?: { hollow?: boolean }): Geometry
```

- `radius` and `height` are integers of at least 1. A radius `r` spans `2r + 1` cells.
- `cylinder`: `center` is the middle of the first disc. `axis: "y"` (default) grows up; `"x"` and
  `"z"` lie on their side and grow toward +X and +Z. `hollow` keeps a 1-block shell; `fill` fills
  the inside with another material.
- `sphere`: `dome: true` keeps the upper half (`y >= center.y`). `hollow` keeps a shell
  `thickness` thick (default 1).
- `cone`: the base disc is at `center.y`, the tip `height - 1` above.

### Stairs

```ts
stairs(start: Point, direction: "north" | "south" | "east" | "west", block: Material,
       o: { length?: number; target?: Point; width?: number }): Geometry
```

- Step `i` sits `i` cells toward `direction` and `i` cells up. Give exactly one of `length`
  (number of steps) or `target` (the cell of the top step, on the 1:1 diagonal).
- `width` widens the run toward +X (for north/south runs) or +Z (for east/west runs).
- Each step gets `facing=<direction>` and `half=bottom`. `stairsRun` is an alias.

### Roofs

```ts
roofGable(c1: Point, c2: Point, block: Material,
          o: { ridge: "x" | "z"; verge?: Material | null; eave?: Material | null }): Geometry
roofHip(c1: Point, c2: Point, block: Material,
        o: { hip: Material; cap?: Material | null }): Geometry
```

- `c1`..`c2` is the XZ footprint; the lowest row sits at the lower Y of the two corners. The roof
  only places stairs: close the gable ends yourself.
- `roofGable`: `ridge` is the axis the ridge line runs along. The roof rises one row per cell
  inward, `ceil(span / 2)` rows in all, where `span` is the footprint's size across the ridge.
  `verge` replaces the stairs on the two gable-end columns, `eave` those of the lowest row; both
  are stair blocks.
- `roofHip`: all four sides slope. `block` is the stair for the slopes, `hip` a full block for
  the diagonal hip lines, `cap` (default `hip`) the top line or cell.
- For an overhang, make the footprint one cell larger than the walls on every side.

### Reading the build back

```ts
get(x: number, y: number, z: number): string | null   // canonical block, null for unset or air
count(block: string): number                           // cells holding exactly this block state
find(block: string): Point[]                           // their coordinates, sorted
bounds(): [min: Point, max: Point] | null              // inclusive box of the non-air cells
recenter(): void                                       // XZ centre to the origin, Y unchanged
```

### Randomness

```ts
rng(namespace?: string): Rng
```

`BUILD.rng()` is one shared stream; `BUILD.rng("garden")` is an independent stream for that
name, so changing one part of a recipe does not reshuffle the others. `Rng` has `random()`
(`[0, 1)`), `uniform(a, b)`, `int(lo, hi)` (both inclusive), `choice(items)` and `shuffle(items)`
(in place). Never use `Math.random()` or the clock: the CLI warns, and the build changes on every
run.

## `shapes` and `Geometry`

`shapes.<name>(...)` builds a `Geometry` without placing it. Every `Build` shape method has a
`shapes` twin with the same arguments (`shapes.box`, `shapes.walls`, `shapes.pillar`,
`shapes.line`, `shapes.railing`, `shapes.stairs`, `shapes.cylinder`, `shapes.sphere`,
`shapes.cone`, `shapes.roofGable`, `shapes.roofHip`). A `shapes` call does not know the build's
seed: pass `{ seed }` in the options when the material is a palette.

Three shapes exist only in `shapes`; place them with `BUILD.place(...)`:

```ts
shapes.arch(start: Point, width: number, block: Material, o: {
  axis: "x" | "z";                              // the axis the span runs along
  profile: "stepped" | "segmental" | "pointed";
  rise?: number;                                // rows of the head
  slab?: Material;                              // slab without `type`; required for "pointed"
  fill?: Material | null;                       // the masonry outside the curve
  depth?: number;                               // layers through the wall, default 1
}): Geometry

shapes.parapet(c1: Point, c2: Point, block: Material, o?: {
  merlon?: number; crenel?: number;             // widths along a side, default 1 and 1
  height?: number;                              // merlon rows above the base, default 1
  base?: number;                                // continuous rows under the merlons, default 1
  corbel?: Material;                            // stair without `facing`: steps the ring out 1 cell
}): Geometry

shapes.skirtRoof(c1: Point, c2: Point, block: Material, o?: {
  overhang?: number;                            // cells beyond the footprint, default 2
  courses?: number;                             // terraces stepping up to the shaft, default 2
  slab?: Material;                              // slab without `type`: half-height terraces
  rim?: Material;                               // outer edge course, default `block`
  dentil?: Material | null;                     // row under the rim, default `block`; null leaves it out
  hole?: [Point, Point];                        // XZ footprint left open for the upper stage
}): Geometry
```

- `arch` is the head only, from upside-down stairs. `start` is the left end of the span on the
  first row above the opening; the head covers `width` cells along `axis`. Carve the opening and
  build the jambs yourself. `stepped`: `rise` stairs per corner and a flat top (default rise
  `min(2, floor(width / 2))`). `pointed`: the two sides meet, rise is `floor(width / 2)`.
  `segmental`: stairs then a slab crown (default rise 2, needs `width >= 2 * rise - 1`).
- `parapet` crenellates the outline of the footprint, starting at the lower Y. Corners are always
  merlons.
- `skirtRoof` is a flared brim with terraces around a tower stage, starting at the lower Y.

### Geometry

```ts
BUILD.place(geometry: Geometry, o?: { at?: Point; rotation?: Rotation }): Geometry

class Geometry {
  set(dx: number, dy: number, dz: number, block: Material): void
  concat(other: Geometry): Geometry            // later cells win where they overlap
  shift(dx: number, dy: number, dz: number): Geometry
  rotate(rotation?: Rotation, anchor?: Point): Geometry   // default CLOCKWISE_90 about [0, 0, 0]
  mirror(axis?: "x" | "z"): Geometry           // "x" maps x to -x (default), "z" maps z to -z
  carve(c1: Point, c2: Point): Geometry        // remove the cells in the box
  cells(): [x: number, y: number, z: number, block: string][]
  bounds(): [min: Point, max: Point] | null
  readonly length: number
}

type Rotation = "NONE" | "CLOCKWISE_90" | "CLOCKWISE_180" | "COUNTERCLOCKWISE_90";
```

- A geometry never changes: `shift`, `rotate`, `mirror`, `carve` and `concat` return new ones, and
  one geometry can be placed many times.
- `place` rotates the geometry about its own origin `[0, 0, 0]` first, then adds `at`. Rotation is
  clockwise seen from above (`CLOCKWISE_90` turns north to east) and turns block states with the
  cells. So build a reusable part around the origin, facing one way, and place rotated copies:

```ts
import { Build, Geometry, shapes } from "voxwright";

export const BUILD = new Build({ seed: 1 });

// A buttress leaning on a wall to its north, modelled at the origin.
function buttress(): Geometry {
  return shapes
    .pillar([0, 0, 0], 3, "minecraft:stone_bricks")
    .concat(shapes.stairs([0, 0, 1], "north", "minecraft:stone_brick_stairs", { length: 1 }));
}

BUILD.scope(() => {
  BUILD.walls([0, 0, 0], [8, 4, 8], "minecraft:stone_bricks");
  const part = buttress();
  BUILD.place(part, { at: [4, 0, 9] }); // south wall
  BUILD.place(part, { at: [4, 0, -1], rotation: "CLOCKWISE_180" }); // north wall
  BUILD.place(part, { at: [-1, 0, 4], rotation: "CLOCKWISE_90" }); // west wall
  BUILD.place(part, { at: [9, 0, 4], rotation: "COUNTERCLOCKWISE_90" }); // east wall
});
```

Exact rotation and mirror rules for block states are in [block-states.md](block-states.md).

## Structuring a large build

A recipe produces one volume, exported as a single region. There is no multi-region or
multi-volume API. Split a large build in code instead:

- One function per part (`foundation()`, `tower(at)`, `roof()`), each placing into `BUILD` or
  returning a `Geometry`. Call them in order inside one `BUILD.scope`.
- Put shared palettes and helpers in a sibling module and import it by relative path.
- Name the key coordinates once (`const W = 15, EAVE_Y = 6`) and derive the rest from them.
- For several separate schematics, write several recipes and run `build` once per recipe.

## Errors

| Error                            | Cause                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `BuildError`                     | A placement outside `BUILD.scope`, or a point that is not 3 integers          |
| `GridBoundsError`                | A coordinate outside `maxDimensions`                                          |
| `McbuilderError`                 | Bad shape arguments, such as a stair block that already has `facing`          |
| `TypeError`                      | A non-integer voxel coordinate                                                |
| `BlockStringError`               | A malformed block string, such as an unclosed `[`                             |
| Validation errors (from `build`) | An unknown block, an unknown property or an illegal value; nothing is written |

The CLI reports a thrown error as one line with the recipe's `file:line:column`.

## Not available

- `Build.validate`, `Build.render` and anything else from the Python mcbuilder that is not listed
  above. Validation and export are done by the CLI, not by the recipe.
- Automatic connections: the engine places exactly the block state you give it (see
  [block-states.md](block-states.md)).
- Chest contents, sign text and other block-entity data, and entities.
- Ellipsoids, tori, boolean operations other than `carve`, terrain generators. Compose them from
  `set` in loops, material functions and `rng`.
- Reading an existing schematic into a recipe.
