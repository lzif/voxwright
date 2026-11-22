<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# Recipe API

Everything a recipe can import from `"voxwright"`. Signatures are the ones in
`packages/mcbuilder/src/` and `packages/core/src/` of the Voxwright repository; if a call is not on this page, it does not
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

| Form             | Example                                                                                             | Picks                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Block string     | `"minecraft:stone_bricks"`                                                                          | That block in every cell                               |
| Weighted palette | `["minecraft:stone_bricks", ["minecraft:mossy_stone_bricks", 0.3]]`                                 | Per cell, by a hash of seed and position (speckle)     |
| `patches(...)`   | `patches([["minecraft:stone", 3], "minecraft:andesite"], { scale: 4 })`                             | Per cell, by smooth noise (clusters)                   |
| `gradient(...)`  | `gradient(["minecraft:deepslate_tile_stairs", "minecraft:stone_brick_stairs"], { from: 6, to: 0 })` | Per cell, by position along one axis (a smooth change) |
| Function         | `(x, y, z) => (y % 4 === 0 ? "minecraft:oak_log" : "minecraft:oak_planks")`                         | Whatever it returns                                    |

```ts
patches(palette: readonly (string | readonly [block: string, weight: number])[],
        options?: { scale?: number; salt?: string }): (x, y, z) => string
```

- A bare string in a palette weighs 1. Weights are shares, not percentages.
- `scale` is the rough patch size in blocks (default 4). `salt` gives a different layout from the
  same palette; use one salt per surface so walls and floors do not share a pattern.
- Palettes and `patches` are deterministic: a cell resolves the same way on every run.

```ts
gradient(stops: readonly Material[],
         options: { from: number; to: number; axis?: "x" | "y" | "z"; blend?: number; salt?: string }): (x, y, z) => string
```

- The first stop sits at `from`, the last at `to` (both coordinates on `axis`, default `"y"`), the
  others evenly between. Cells past either end take the end stop. `from` may be larger than `to`.
- `blend` (0 to 1, default 1) is how far neighbouring stops mix: 1 mixes each stop into the next
  cell by cell over the whole step, 0 gives hard bands. `salt` gives another mix from the same stops.
- A stop is any `Material`: a block, a palette or `patches(...)`. Use it for a roof that darkens
  toward the eave. `mcbuild palette ramp` suggests stops that step evenly in colour (see SKILL.md).
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
       o: { length?: number; target?: Point; width?: number; half?: "bottom" | "top" }): Geometry
```

- Step `i` sits `i` cells toward `direction` and `i` cells up. Give exactly one of `length`
  (number of steps) or `target` (the cell of the top step, on the 1:1 diagonal).
- `width` widens the run toward +X (for north/south runs) or +Z (for east/west runs).
- Each step gets `facing=<direction>` and `half=bottom`. `stairsRun` is an alias.
- `half: "top"` keeps the same cells but makes every step upside down and faces it back down the
  run (`facing=<opposite of direction>`, `half=top`), so the underside is a smooth slope: a corbel
  stepping out toward `direction` as it rises (under a jetty, balcony or eave), or, with `start`
  one row under an ordinary flight's start, the stair sandwich that smooths the flight's
  underside.

### Roofs

```ts
roofGable(c1: Point, c2: Point, block: Material,
          o: { ridge: "x" | "z"; verge?: Material | null; eave?: Material | null;
               endFill?: Material | null; ridgeCap?: { post: Material; rail?: Material | null; every?: number; height?: number } | null;
               profile?: "straight" | "steep" | "concave" | "gambrel" | "low" | ("slab" | "stair" | "steep")[];
               slab?: Material; full?: Material;
               underlay?: Material | true | null; sandwich?: Material | true | null }): Geometry
roofHip(c1: Point, c2: Point, block: Material,
        o: { hip: Material; cap?: Material | null;
             underlay?: Material | true | null; sandwich?: Material | true | null }): Geometry
```

- `c1`..`c2` is the XZ footprint; the lowest row sits at the lower Y of the two corners. The roof
  only places stairs (plus slabs and full blocks with `profile`): close the gable ends yourself, or
  use `endFill`.
- `roofGable`: `ridge` is the axis the ridge line runs along. The roof rises one row per cell
  inward, `ceil(span / 2)` rows in all, where `span` is the footprint's size across the ridge.
  `verge` replaces the stairs on the two gable-end columns, `eave` those of the lowest row; both
  are stair blocks.
- `roofGable` options, all opt-in (without them the output is the plain roof above):
  - `endFill` is a full-block material that closes the triangle under each gable end, between the
    outermost stairs (the same two columns as `verge`). It never overwrites a roof cell.
  - `ridgeCap` puts a cresting on the ridge. `post` stands on the ridge about every `every` cells
    (default 3, and always on the last cell), rooted in the top roof row and rising `height` rows
    above it (default 1). `rail`, if given, fills the cells between the posts in the posts' top
    row; omitted or `null` leaves the posts alone. The shape does not set block properties: write
    the axis yourself (`"minecraft:stripped_oak_log[axis=y]"`), and a top slab
    (`"minecraft:oak_slab[type=top]"`) is a good thin rail. On an even span the cresting stands on
    the lower-coordinate ridge cell only.
  - `profile` sets the pitch across the span. `"straight"` (default) is one stair per column.
    `"steep"` is a full block under each stair (A-frame), `"low"` is slabs only, `"gambrel"` is
    steep below and stairs above, `"concave"` is slabs at the eave then stairs then steep columns
    (flared roofs). Or give an array with one pitch per column from the eave in: `"slab"` rises half
    a block, `"stair"` one, `"steep"` two. The array has `floor(span / 2)` entries and the slab
    columns before a stair or steep column must be an even number.
  - `slab` and `full` override the slab and full block that profiles use. By default they follow
    the stair block's name (`oak_stairs` gives `oak_slab` and `oak_planks`,
    `stone_brick_stairs` gives `stone_bricks`).
  - `underlay` puts a full block under every roof cell above the eave row, so the roof is a
    stepped solid one block thick and only the eave keeps the thin stair edge (most real roofs
    are built this way). `true` takes each cell's own full block (`deepslate_tile_stairs` →
    `deepslate_tiles`; a spruce `verge` sits on spruce planks). `sandwich` instead puts an
    upside-down stair facing down the slope under every stair (`true`: the same stair), for a
    smooth underside under open eaves. One or the other; both also work on `roofHip` and
    `shapes.roofUnion`, and both win over `endFill` in the gable plane.
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

These shapes exist only in `shapes`; place them with `BUILD.place(...)`:

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

shapes.bayWall(c1: Point, c2: Point, block: Material, o: {
  period: number | number[];                    // required: distance between post centres, or a list of them
  post?: Material; infill?: Material | null;   // default `block`; `infill: null` leaves the bays open
  beam?: Material; sill?: Material;             // continuous top and bottom row over the whole run
  postWidth?: number;                           // cells per post along the run, default 1
  inset?: boolean; pilaster?: boolean;          // depth treatments, need `face` and a 2-deep footprint
  face?: "north" | "south" | "east" | "west";   // the outer face, perpendicular to the run
}): Geometry

shapes.polygon(vertices: [x: number, z: number][], y1: number, y2: number, block: Material, o?: {
  mode?: "walls" | "solid" | "floor";           // default "walls"; "floor" needs y1 === y2
}): Geometry

shapes.jetty(c1: Point, c2: Point, block: Material, o?: {
  overhang?: number;                            // cells past the wall line, default 1
  sides?: ("north" | "south" | "east" | "west")[];  // default all four
  bracket?: Material | null;                    // stair without `facing`, upside-down under the deck; none by default
  every?: number;                               // a bracket every `every` cells, default 3
  beam?: Material;                              // continuous row under the deck's outer edge
}): Geometry

type Facing = "north" | "south" | "east" | "west";

shapes.roofUnion(parts: { c1: Point; c2: Point; ridge: "x" | "z" | "hip" }[], block: Material, o?: {
  endFill?: Material | null;                    // full block for each exposed gable end
  underlay?: Material | true | null;            // as roofGable's
  sandwich?: Material | true | null;            // as roofGable's
}): Geometry

shapes.dormer(c1: Point, c2: Point, facing: Facing, block: Material, o?: {
  window?: Material | null;                     // default glass_pane; null leaves the opening as air
}): Geometry
shapes.dormerRoof(c1: Point, c2: Point, facing: Facing): { c1: Point; c2: Point; ridge: "x" | "z" }

shapes.chimney(base: Point, height: number, block: Material, o?: {
  size?: number;                                // square shaft side, default 1
  band?: { block: Material; rows: number[] } | null;  // shaft rows (0 = bottom) in another block
  cap?: "none" | "slab" | "posts";              // default "none"
  slab?: Material;                              // slab without `type`, required for a cap
  post?: Material;                              // the cap's corner posts, default `block`
  smoke?: boolean;                              // lit campfire in the top row, default false
  fire?: Material;                              // default "minecraft:campfire[lit=true]"
}): Geometry

shapes.door(base: Point, facing: Facing, block: Material, o?: {
  hinge?: "left" | "right";                     // default "left"
  open?: boolean;                               // default false
  double?: boolean;                             // a second leaf to the right, opposite hinge
  frame?: Material | null;                      // posts either side, 2 rows tall
  lintel?: Material | null;                     // row over leaves and posts, default `frame`
}): Geometry

shapes.window(c1: Point, c2: Point, facing: Facing, o?: {
  glass?: Material | null;                      // default glass_pane; null leaves the opening as air
  frame?: Material | null;                      // both sides and the row under the opening
  lintel?: Material | null;                     // row over the opening, default `frame`
  sill?: Material | null;                       // one cell out, under the opening
  shutters?: Material | null;                   // trapdoors one cell out either side, open, flat on the wall
}): Geometry

shapes.cladding(c1: Point, c2: Point, block: Material, o?: {
  faces?: ("north" | "south" | "east" | "west" | "up" | "down")[];  // default the four sides
}): Geometry
shapes.corbels(c1: Point, c2: Point, facing: Facing, block: Material, o?: {
  depth?: number;                               // cells each corbel steps out, default 1
  every?: number;                               // a corbel every n cells (and on the last), default 1
}): Geometry

shapes.paperLantern(top: Point, o?: {
  core?: "lantern" | "glow" | "none";           // default "lantern"
  banner?: Material; chain?: Material; post?: Material; base?: Material;
}): Geometry
shapes.lampPost(base: Point, o?: { height?: number; post?: Material; light?: Material }): Geometry
shapes.windowBox(c1: Point, c2: Point, facing: Facing, o?: { plant?: Material; box?: Material }): Geometry
```

- `arch` is the head only, from upside-down stairs. `start` is the left end of the span on the
  first row above the opening; the head covers `width` cells along `axis`. Carve the opening and
  build the jambs yourself. `stepped`: `rise` stairs per corner and a flat top (default rise
  `min(2, floor(width / 2))`). `pointed`: the two sides meet, rise is `floor(width / 2)`.
  `segmental`: stairs then a slab crown (default rise 2, needs `width >= 2 * rise - 1`).
- `parapet` crenellates the outline of the footprint, starting at the lower Y. Corners are always
  merlons.
- `skirtRoof` is a flared brim with terraces around a tower stage, starting at the lower Y.
- `bayWall` is a straight wall run of posts at a fixed rhythm with bays between them (timber
  frame, arcade, pier-and-slit, pilasters). `c1`..`c2` is 1 thick in X or Z (2 thick with `inset`
  or `pilaster`); the other axis is the run, at least 2 cells. Posts stand on cell 0, every
  `period` and always on the last cell, so a number `period` must divide the run length minus
  `postWidth` (minus 1 by default; with wider posts `period` counts from one post's first cell to
  the next). An array `period` lists those distances, which must add up to the same value
  (`[2, 3, 2]` for P S P SS P S P). A bay's clear width is its distance minus the post width.
  A `beam` or `sill` wins where it meets a post. `inset` sets the infill in the back layer and
  the frame in the front one; `pilaster` makes every post 1 cell proud of the wall (beam and
  sill stay flush); they cannot be combined. Block axes are not set for you: pass
  `oak_log[axis=y]` for `post` and a beam with the axis of the run.
- `polygon` builds a rectilinear outline from `[x, z]` vertices, in order, closed back to the first
  (do not repeat it). Every edge must be axis-aligned, an edge covers both end cells, and the
  outline may not visit a cell twice. `"walls"` is the outline cells at every y from `y1` to `y2`,
  `"solid"` adds the inside, `"floor"` is outline and inside at one layer. Use it for L, T,
  cruciform and notched plans. It has no roof and no holes.
- `jetty` is the overhanging deck of an upper storey. `c1`..`c2` is the footprint of the lower
  storey's top; the deck row is the lower Y and holds `block` only on the projecting ring, outside
  the footprint. Your lower wall's top row is at `y - 1` and the upper floor and walls are yours: stand
  them on the outer outline of the deck. `bracket` puts upside-down stairs under the deck next to
  the wall, every `every` cells counted from both ends of a side.
- `roofUnion` roofs several overlapping rectangles at once: L, T and cross plans, a front
  cross-gable, a hipped end, dormer roofs. Each part is a gable (`ridge: "x"` or `"z"`) or a hip
  over its footprint, rising one row per cell from its eave row (its lower Y). Where parts
  overlap the higher roof wins and they meet in valleys and hips, with the stair corners
  (`shape=inner_*`, `outer_*`) set the way the game sets them. A single gable part is exactly
  `roofGable`. `endFill` closes only the gable ends that are exposed, not a wing end that runs
  into the main roof. A roof hipped at one end and gabled at the other is a hip part over the
  whole footprint plus a gable part over the gabled half. Parts with a higher eave row sit on the
  main slope (dormer roofs). Every part uses the straight profile; there is no `verge`, `eave`,
  `ridgeCap` or `profile` here.
- `dormer` is the body of a dormer on a straight slope: `c1`..`c2` is its front wall, one cell
  thick toward `facing`, from the first row above the main roof's stairs to the row under the
  dormer's roof, at least 3 x 3. The window is the wall less a 1-cell border; the cheeks run back
  one row shorter per cell, down the slope. Roof it with a part from `dormerRoof(c1, c2, facing)`
  in the main roof's `roofUnion`, placed after the dormer. Its ridge must stay under the main
  ridge: a dormer `w` wide whose wall top is `t` rows above the slope needs the main ridge
  `t + 1 + floor((w + 1) / 2)` rows above that point.
- `chimney` is a square shaft from `base` (its low corner and bottom row) up `height` rows. Place
  it after the roof so the shaft replaces the roof cells. `cap: "slab"` is a slab lid on the top;
  `"posts"` is a post on each top corner and the slab lid above them. `smoke` puts a lit campfire
  in the middle of the top row.
- `door` places both halves. `facing` is the door's own: the way you look walking in. The second
  leaf of `double` goes one cell to the right of someone facing `facing`. The frame and lintel
  replace the wall cells they stand in; write the log axis yourself.
- `window` fills an opening one cell thick in a wall whose outside faces `facing`. Panes and bars
  get their two sides in the wall's plane. A `sill` stair becomes upside down with its back to the
  wall, a trapdoor a closed top-half plate, a slab a top slab, unless you set those properties.
- `cladding` puts trapdoors on the faces of the box `c1`..`c2`: open and flat against each side
  face (a planked or ribbed post or beam), closed top-half under it for `down` (eave and ceiling
  trim), closed bottom-half on it for `up`. `block` is the trapdoor without `facing`, `open` and
  `half`.
- `corbels` is a row of upside-down stairs growing out of a wall under a ledge: `c1`..`c2` is a
  run of the wall's face cells one row high, just under the overhang, and `facing` the side the
  wall faces. Each corbel steps `depth` cells out, the top stair on the run's row, each lower one
  a cell nearer the wall and a row down.
- `paperLantern` hangs from `top` down: a chain, a fence, a hopper with a wall banner on each side
  as the paper, and a hanging lantern under it (`core: "glow"`: red wool, a shroomlight and a
  trapdoor base instead). Use `chain: "minecraft:chain[axis=y]"` before 1.21.9.
- `lampPost` is `height` rows of fence from `base` with a lantern on top.
- `windowBox` is a row of plants (`c1`..`c2`, one row high, just out from a wall facing `facing`)
  boxed in by open trapdoors on its front and both ends.

```ts
// A main roof with a front cross-gable, a dormer, a chimney, a door and a window.
BUILD.walls([0, 1, 0], [12, 5, 14], "minecraft:spruce_planks");
BUILD.walls([8, 1, 14], [12, 5, 19], "minecraft:spruce_planks");
BUILD.place(shapes.dormer([3, 9, 13], [5, 11, 13], "south", "minecraft:spruce_planks"));
BUILD.place(
  shapes.roofUnion(
    [
      { c1: [-1, 6, -1], c2: [13, 6, 15], ridge: "x" },
      { c1: [7, 6, 10], c2: [13, 6, 20], ridge: "z" },
      shapes.dormerRoof([3, 9, 13], [5, 11, 13], "south"),
    ],
    "minecraft:deepslate_tile_stairs",
    { endFill: "minecraft:white_concrete" },
  ),
);
BUILD.place(
  shapes.chimney([1, 1, 3], 15, "minecraft:bricks", {
    cap: "posts",
    slab: "minecraft:stone_brick_slab",
    post: "minecraft:stone_brick_wall",
    smoke: true,
  }),
);
BUILD.place(shapes.door([10, 1, 19], "north", "minecraft:spruce_door"));
BUILD.place(
  shapes.window([3, 2, 14], [4, 3, 14], "south", {
    sill: "minecraft:spruce_stairs",
    shutters: "minecraft:spruce_trapdoor",
  }),
);
```

```ts
BUILD.place(
  shapes.bayWall([0, 1, 0], [10, 4, 0], "minecraft:white_concrete", {
    period: 5,
    post: "minecraft:oak_log[axis=y]",
    beam: "minecraft:oak_log[axis=x]",
  }),
);
BUILD.place(
  shapes.polygon(
    [
      [0, 0],
      [8, 0],
      [8, 4],
      [3, 4],
      [3, 8],
      [0, 8],
    ],
    1,
    4,
    "minecraft:stone_bricks",
  ),
); // L plan
BUILD.place(
  shapes.jetty([0, 5, 0], [8, 5, 6], "minecraft:spruce_planks", {
    overhang: 1,
    bracket: "minecraft:spruce_stairs",
  }),
);
BUILD.roofGable([-1, 9, -1], [9, 9, 7], "minecraft:spruce_stairs", {
  ridge: "x",
  endFill: "minecraft:white_concrete",
  profile: "concave",
});
```

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

- Anything from the Python mcbuilder that is not listed above. In a recipe run by the CLI,
  validation and export are done by the CLI, not by the recipe (`Build.validate` and
  `Build.render` exist on `Build` for library callers).
- Automatic connections: the engine places exactly the block state you give it (see
  [block-states.md](block-states.md)).
- Chest contents, sign text and other block-entity data, and entities.
- Ellipsoids, tori, boolean operations other than `carve`, terrain generators. Compose them from
  `set` in loops, material functions and `rng`.
- Reading a schematic from inside a recipe. The CLI's `import` command turns a schematic into a
  recipe instead (see SKILL.md).
