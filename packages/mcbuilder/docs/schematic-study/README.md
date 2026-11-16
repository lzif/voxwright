# Schematic study: measured techniques from 17 real builds

Status 2026-11-16. Companion to `../build-patterns.md`.

`build-patterns.md` reads techniques off build reels and photos: what a frame shows, interpreted.
This study reads them off schematic files: every block, every block state, counted. The two
agree on most points; where they differ, this file has the exact numbers. Use it to:

- check a recipe's output against what popular builds actually do (the targets in
  [Numbers to aim for](#numbers-to-aim-for));
- find the block combinations behind a look (the techniques S1 to S16);
- see which techniques the engine makes easy and which still need hand-placed blocks
  ([Engine mapping](#engine-mapping)).

## Sources

15 free downloads from abfielder.com, picked from the most-downloaded house, tower and medieval
results so the set reflects builds many players liked, plus 3 files Luki sent on 2026-11-16. The
files are not in the repository (creators keep their copyright). They live on the AIO box in
`~/workspace/schematic-study/downloads/<slug>/`, one directory per build with the page
metadata in `meta.json`.

| slug                                            | build, credited creator                       | size (X×Y×Z) | blocks | DataVersion |
| ----------------------------------------------- | --------------------------------------------- | ------------ | -----: | ----------: |
| `ivy-s-starter-house-2338`                      | Ivy's Starter House, Ivysagee                 | 15×10×12     |    651 |        3120 |
| `simple-watchtower-7763`                        | Simple Watchtower, TiltCraft                  | 11×32×11     |    719 |        4556 |
| `upload-raifox-medivial-house`                  | raifox medieval house (Luki upload, `.schem`) | 14×20×15     |   1595 |        5023 |
| `large-farmhouse-2539`                          | Large Farmhouse, Disruptive Builds            | 28×17×24     |   2871 |        3337 |
| `fishing-dock-by-disruptive-builds-2706`        | Fishing Dock by disruptive builds, NCbr0      | 27×11×24     |   3033 |        3465 |
| `simple-medieval-house-7986`                    | Simple Medieval House, MsBean                 | 25×24×28     |   3654 |        3953 |
| `cozy-medieval-house-10829`                     | Cozy medieval house, Ivanya                   | 28×26×28     |   4228 |        4440 |
| `gothic-tower-3872`                             | gothic tower, DownTheBlockHomes               | 15×100×15    |   4272 |        4082 |
| `forest-house-2865`                             | Forest House, Arken                           | 46×25×24     |   4568 |        3578 |
| `upload-castelo-medieval`                       | castelo medieval (Luki upload, `.schem`)      | 29×39×27     |   4895 |        5023 |
| `the-tavern-furnished-5930`                     | The Tavern (Furnished), Sunque                | 22×49×31     |   5053 |        4325 |
| `stone-pillar-tower-5824`                       | Stone Pillar Tower, Raaamseeel                | 33×55×33     |   5383 |        4325 |
| `elven-house-7671`                              | Elven House, Raaamseeel                       | 33×49×53     |   5820 |        4325 |
| `simple-survival-mansion-8022`                  | Simple Survival Mansion, MsBean               | 25×26×47     |   6218 |        3953 |
| `wizard-tower-2831`                             | Wizard Tower, Crema_                          | 45×70×35     |   8335 |        3578 |
| `minecraft-overgrown-survival-castle-full-2159` | Overgrown Survival Castle, BiggyDiggy7        | 41×42×53     |  26784 |        3105 |
| `japanese-tower-10615`                          | Japanese Tower, jxtgaming                     | 45×120×43    |  29655 |        4671 |

The site URL of each is `https://abfielder.com/Products/ProductDetails.php?id=<number in the
slug>`. The DataVersions run from 1.19 (3105) to 1.21.11 (4671); 5023 is a 26.x save, newer
than the engine's default 26.2.

The third upload, `simple-survival-mansion-edited.nbt`, is the MsBean mansion above saved again
in 26.x. A cell diff against the download finds no design edits: 16 `chain` became `iron_chain`
(the game's own rename) and 17 `grass_block` fill gaps in the ground plate. It is left out of the
statistics so the mansion is not counted twice.

Planet Minecraft was tried first; even in Camoufox it answered with a Cloudflare check page that
did not clear while the script waited. abfielder serves its files directly.

## Method

1. **Fetch.** `tools/fetch_abfielder.py` opens each product page in headed Camoufox (the
   `camoufox-browser` skill), reads the title, creator, dimensions and description, clicks
   Download and saves the `.litematic` with a `meta.json`.
2. **Read.** `tools/litematic.py` is a standard-library reader for `.litematic` (NBT, bit-packed
   block states, any number of regions). `.schem` and `.nbt` files are converted first with
   `node scripts/convert.ts in.schem out.litematic`. Block counts match `voxwright-cli inspect`
   for all 18 files.
3. **Measure.** `tools/analyze.py` writes one JSON record per build: block families, states,
   materials, an exterior/interior split (flood fill of outside air), facade relief, roof caps,
   vertical bands, mirror symmetry, adjacency pairs and the repurposing patterns below.

   ```sh
   find ~/workspace/schematic-study/downloads -name '*.litematic' ! -path '*edited*' -print0 \
     | sort -z | xargs -0 python3 -I packages/mcbuilder/docs/schematic-study/tools/analyze.py analysis.json
   ```

4. **Look.** Each build was imported with `voxwright-cli import` and rendered with
   `run --preview --views 'az135_el030;az315_el030;top'`; the techniques were checked against
   those images, and the unusual ones (paper lanterns, sign trim, campfire furniture) against
   printed block columns.

Terms used below:

- **non-ground**: every block except grass, dirt, sand, snow, water and the like (many
  schematics carry a terrain plate).
- **shape blocks**: stairs, slabs, trapdoors, fences, fence gates, walls, buttons, panes and bars,
  chains and ladders, pressure plates, carpets.
- **detail blocks**: shape blocks plus lights, props (barrels, pots, chests...), plants, leaves
  and doors.
- **materials**: a block family with the shape suffix removed (`spruce_stairs`, `spruce_planks`
  and `stripped_spruce_log` are all `spruce`; `stone_brick_wall` is `stone_brick`).
- **off-plane**: looking at a facade from outside, the share of cells whose first solid block is
  not on the facade's most common depth.

## Numbers to aim for

Medians over the 17 builds, with the range. A recipe whose summary is far outside these is
probably missing a technique, not making a style choice.

| measure                                           | median | range   | what it says                                        |
| ------------------------------------------------- | -----: | ------- | --------------------------------------------------- |
| shape blocks, share of non-ground blocks          |    38% | 20–66%  | more than a third of a good build is not full cubes |
| detail blocks, share of non-ground blocks         |    45% | 28–79%  |                                                     |
| stairs placed upside down (`half=top`)            |    44% | 13–74%  | inverted stairs are trim, not an exception          |
| stairs with a corner shape                        |   4.5% | 0–32%   | round towers push this up                           |
| slabs placed as top slabs                         |    56% | 4–87%   | soffits, ceilings, sills, shelf boards              |
| trapdoors placed open                             |    44% | 0–94%   | open trapdoors are wall panels and rails            |
| logs lying horizontal (`axis=x` or `z`)           |    35% | 0–100%  | beams                                               |
| lanterns hanging                                  |    70% | 41–100% |                                                     |
| light sources per 100 non-ground blocks           |    1.2 | 0–2.6   |                                                     |
| materials that cover 80% of the structural blocks |      4 | 1–9     | a narrow palette with many shapes of each material  |
| distinct block ids                                |     47 | 10–220  |                                                     |
| bounding box filled                               |    19% | 7–43%   |                                                     |
| facade cells off the main wall plane              |    77% | 53–90%  | almost no facade is a flat sheet                    |
| depth layers within ±3 blocks of the main plane   |      6 | 3–7     |                                                     |

Per build (percentages rounded; `-` where the build has none of that block):

| build              | shape | detail | stairs top | slab top | trapdoor open | log horiz. | lights /100 | mats 80% | mirror |
| ------------------ | ----: | -----: | ---------: | -------: | ------------: | ---------: | ----------: | -------: | -----: |
| ivy starter house  |    38 |     53 |         26 |       48 |             0 |         44 |        2.57 |        3 |     96 |
| simple watchtower  |    31 |     31 |         50 |        9 |            94 |          0 |        0.70 |        4 |     63 |
| raifox house       |    42 |     57 |         42 |        4 |            36 |         32 |        0.81 |        2 |     65 |
| large farmhouse    |    49 |     62 |         44 |       52 |            54 |         42 |        1.04 |        6 |     16 |
| fishing dock       |    66 |     79 |         57 |       62 |            32 |         24 |        1.69 |        1 |     20 |
| simple medieval    |    42 |     52 |         36 |       72 |            65 |         11 |        1.30 |        6 |     38 |
| cozy medieval      |    27 |     41 |         74 |       71 |            74 |         58 |        1.46 |        8 |     14 |
| gothic tower       |    45 |     45 |         53 |       85 |             - |        100 |        0.00 |        3 |    100 |
| forest house       |    40 |     43 |         13 |       87 |            34 |         35 |        1.65 |        4 |     27 |
| castelo medieval   |    35 |     38 |         29 |       50 |            36 |          - |        2.47 |        2 |     98 |
| tavern             |    30 |     37 |         64 |       47 |            36 |         43 |        1.15 |        9 |     11 |
| stone pillar tower |    50 |     50 |         29 |       57 |             - |          - |        0.00 |        3 |    100 |
| elven house        |    40 |     45 |         64 |       62 |            42 |         35 |        0.00 |        5 |     70 |
| survival mansion   |    38 |     47 |         41 |       56 |            74 |         17 |        1.32 |        3 |     37 |
| wizard tower       |    25 |     33 |         49 |       35 |            44 |         16 |        1.18 |        7 |     12 |
| overgrown castle   |    20 |     28 |         42 |       57 |            71 |         60 |        1.37 |        4 |     44 |
| japanese tower     |    36 |     42 |         69 |       27 |            68 |         43 |        0.58 |        4 |     85 |

`mirror` is the better of the two mirror matches (across X or across Z) of non-ground blocks,
compared by block id.

## Techniques

Counts are summed over the 17 builds unless a build is named.

### S1. Spend a third of the blocks on shapes

The lowest shape share (20%, the overgrown castle) belongs to a build whose bulk is a solid stone
hill under it; its buildings alone are well above that. Builds that read as detailed sit at 35–50%,
and the fishing dock, all deck and rails, at 66%. The useful check after a `build`: add up the
stairs, slabs, trapdoors, fences, walls and panes in the palette summary. Under about 25% of the
non-ground blocks, the build will look like boxes.

### S2. Upside-down stairs carry the trim

Across the set 4,731 stairs are upside down: 2,646 with nothing under them and 2,085 on a support.

- **Over air** they are corbels, eave undersides, arch heads and the underside of overhangs. The
  gothic tower has 226: each stage of its buttresses steps out on a row of inverted
  `polished_tuff_stairs`. The stone pillar tower has 174 under its rings of slabs.
- **On a support** they are ledges, window heads, sills and the second half of a "stair sandwich"
  (S3). The survival mansion has 207 of them.

In a recipe: `shapes.arch` uses inverted stairs for arch heads, `shapes.corbels` puts a row of
corbels under a jetty, an eave or a balcony, and `stairs` with `half: "top"` builds any
upside-down run (a buttress stage, the underside of a flight).

### S3. Roofs are two layers thick

For the topmost stair of each roof column, the analyzer looked at the block under it.

| build             | roof stairs | solid, same material | upside-down stair | air (true edge) | other           |
| ----------------- | ----------: | -------------------: | ----------------: | --------------: | --------------- |
| japanese tower    |         145 |                  81% |               13% |              0% | 6%              |
| castelo medieval  |         220 |                  73% |                0% |              6% | 21%             |
| forest house      |         542 |                  68% |                2% |              4% | 25%             |
| overgrown castle  |         639 |                  63% |               10% |             12% | 16%             |
| survival mansion  |         390 |                  62% |                6% |             12% | 19%             |
| ivy starter house |          78 |                  54% |                8% |             15% | 23%             |
| raifox house      |          97 |                  18% |               57% |             12% | 13%             |
| large farmhouse   |          96 |                   0% |               23% |             18% | 59% (29% slabs) |

Three constructions:

- **Underlay** (the common one): a full block of the roof's own material under every stair, so
  the roof is a stepped solid one block thick (`deepslate_tile_stairs` on `deepslate_tiles`:
  330 such pairs in the forest house). Only the eave row and the gable ends show the thin stair
  edge. The simple medieval house does the same with two materials of one tone (cobbled
  deepslate stairs on deepslate bricks and the other way round), which speckles the roof.
- **Stair sandwich**: an inverted stair under each roof stair, facing the other way, so the
  underside is a smooth slope too. Used where the roof is seen from below: the raifox house's
  open eaves (57%) and the tavern's tower roof.
- **Slab steps**: a low roof that rises half a block per column, slabs between stairs, in two or
  three dark materials (`deepslate_brick_slab`, `deepslate_tile_slab`, `dark_oak_slab` in the
  large farmhouse).

In a recipe, `underlay: true` on `roofGable`, `roofHip` or `shapes.roofUnion` builds the
underlay (each cell's own full block, so a spruce verge sits on spruce planks) and
`sandwich: true` the stair sandwich; `profile: "low"` and the profile arrays give the slab
steps. The underlay is the same as one line of full blocks under each stair row above the eave,
plus one under the apex row:

```ts
BUILD.roofGable([-1, 6, -1], [11, 6, 9], "minecraft:deepslate_tile_stairs", {
  ridge: "x",
  underlay: true,
});
```

`profile: "steep"` also puts a full block under each stair, but rises two rows per column; it is
the A-frame, not the underlay.

### S4. Roof edges in a second material

Nine of the 17 builds have a dark stone roof (deepslate tiles, deepslate bricks or cobbled
deepslate), and all nine trim its edges in wood (stairs, slabs or trapdoors): the forest house's roof caps are
394 `deepslate_tile_stairs` and 142 `spruce_stairs`, the spruce ones on the verges and eaves; the
simple medieval house and the survival mansion use `dark_oak_stairs` (104 and 126 roof caps). The
raifox house turns it around: a spruce roof with `deepslate_brick_stairs` and slabs on its edges.
The two MsBean builds also run the verge beam past the apex and past the eave, so each gable end
has crossed horns. `roofGable`'s `verge` and `eave` options take the trim stair.

### S5. Top slabs close every underside

Top slabs with air under them, by build: overgrown castle 453, japanese tower 539 (dark oak, oak,
deepslate tile and jungle), farmhouse 246, elven house 266, simple medieval 83. They are soffits
under eaves and balconies, ceilings of porches and the flat tops of window hoods. A top slab is
also the classic thin rail (`roofGable`'s `ridgeCap.rail` suggests it) and shelf board.

### S6. Trapdoors are the most repurposed block

| use                                                    | count | where it stands out                                     |
| ------------------------------------------------------ | ----: | ------------------------------------------------------- |
| open, flat on a block face: panel, shutter, rib, plate |  2231 | elven house 398, overgrown castle 583                   |
| closed top half over air: eave and ceiling trim        |  1770 | japanese tower 588, elven house 292, tavern 226         |
| open, nothing behind: rail, screen, shutter            |  1559 | japanese tower 1025 (the balcony rails of every storey) |
| closed, lying on a block: tabletop, floor edge         |   310 | elven house 133                                         |

What the open trapdoors hang on: stripped logs most of all (elven house 213 on
`stripped_spruce_wood`, japanese tower 282 on `stripped_spruce_log`), which gives posts and beams
a planked or ribbed face; then plaster blocks (calcite, diorite) as shutters; then grass and dirt
(raifox house 39, simple medieval house 35) as the edging of a garden bed; and leaves (farmhouse
19) as the box around a hedge planter.

### S7. Timber frame on a fixed post rhythm

Columns of three or more upright logs, and the distance to the next one in line:

- mostly 2 (one block between posts) in the simple medieval house (77 of 92 posts), elven house,
  survival mansion, tavern, raifox house, wizard tower and farmhouse: posts close around single
  windows and narrow panels;
- mostly 4 (three-block bays) in the forest house, japanese tower, overgrown castle, fishing dock
  and the starter house.

Horizontal logs are 35% of all logs (4,834 beams), and the frame wood is almost always stripped
(`stripped_spruce_log`, `stripped_dark_oak_wood`, `stripped_oak_log`). The infill is pale:
calcite, diorite and polished diorite, white or light gray concrete, or planks of a lighter wood
(birch in the starter house, pale oak in the elven house and tavern). `shapes.bayWall` covers this
directly: `period: 2` or `4`, `post` an upright stripped log, `beam` a horizontal one, `infill`
the plaster.

### S8. Speckle within one tone

The most common pairs of different full blocks touching each other, by build:

| pair                                   | count | build              |
| -------------------------------------- | ----: | ------------------ |
| stone + stone bricks                   |  2062 | overgrown castle   |
| andesite + stone bricks                |  1049 | overgrown castle   |
| andesite + cobblestone                 |   361 | tavern             |
| tuff + tuff bricks                     |   235 | tavern             |
| calcite + polished diorite             |   211 | large farmhouse    |
| diorite + polished diorite             |   230 | tavern             |
| green wool + lime terracotta           |   216 | elven house (roof) |
| andesite + tuff                        |   167 | simple watchtower  |
| calcite + diorite                      |   147 | cozy medieval      |
| mossy stone bricks + stone bricks      |   138 | forest house       |
| cobbled deepslate + deepslate bricks   |   132 | wizard tower       |
| cobbled deepslate + polished deepslate |   116 | cozy medieval      |
| cracked stone bricks + stone bricks    |    65 | simple medieval    |

Two to four blocks of nearly the same colour, mixed cell by cell, on walls, plaster and even
roofs. The watchtower adds 19 `stone_button`s on its cobblestone and andesite as extra grain.
Wall blocks are mixed the same way (`cobblestone_wall` with `mossy_cobblestone_wall`). In a
recipe this is a weighted palette for scattered grain or `patches(...)` for clusters, with one
`salt` per surface; `palette near <block>` lists blocks of nearly the same colour.

### S9. Walls and fences hold things up

| use                       | count | example                                                    |
| ------------------------- | ----: | ---------------------------------------------------------- |
| wall under a full block   |   562 | stone pillar tower: 292 `andesite_wall` under `stone`      |
| fence under a full block  |   567 | japanese tower: 516 `spruce_fence` under `deepslate_tiles` |
| fence under stairs        |   285 | survival mansion, simple medieval house                    |
| wall under stairs or slab |   246 | forest house: `deepslate_tile_wall` under `spruce_stairs`  |
| fence under a trapdoor    |   148 | elven house: railings capped with a trapdoor               |

A wall is a thin column: the stone pillar tower is a lattice of 1,660 `andesite_wall`, and the
gothic tower's buttress ribs are 1,087 `polished_tuff_wall`. A fence is a thinner one: the
japanese tower's storeys stand on fence colonnades under the tile eaves. The castelo uses
`diorite_wall` (114) as pale shafts set into stone bricks.

### S10. Lighting recipes

- **Density**: about 1.2 lights per 100 non-ground blocks. The three builds with none (gothic
  tower, stone pillar tower, elven house) are display pieces.
- **Lanterns hang**: 70% of lanterns. They hang from chains (cozy 10, wizard 23, tavern 11), under
  slabs (castelo 24), under eave stairs (forest house 13 under `deepslate_tile_stairs`, starter
  house 7 under `oak_stairs`) and under hoppers (japanese tower 44, see S13).
- **Standing lanterns** sit on fences (fishing dock lamp posts), on iron bars (castelo 20, a
  lantern finial on a bar post; japanese tower 11), on slabs and trapdoors (overgrown castle 20
  on `spruce_slab`).
- **Lamp posts**: a lantern standing on a fence (survival mansion 16, dock 4).
- **Other light blocks**: glowstone (overgrown castle 54), shroomlight inside the paper lanterns
  (japanese tower 19, S13), glow lichen (wizard tower 12).
- **Campfires** are rarely fire: 170 of the castle's 175 are unlit (S13). A lit one on a hay bale
  (survival mansion 6 of 11, `signal_fire=true`) is a chimney or hearth: the hay makes the smoke
  rise high.

### S11. Blank wall signs as thin trim

500 wall signs in 10 of the 17 builds, and 497 of them have no text (`{"text":""}` on every
line); the other 3 are the tavern's real signage ("The Tavern", "Rooms / Beer / Food", "Wine
Cellar"). A wall sign is a board a few pixels thick on a block face:

- the fishing dock hangs 62 on its log piles, 24 of them right at the water line, a waterline
  skirt;
- the raifox house hangs 27 on stairs and 22 on slabs, most of them along the roof edge (17 in
  the top third of the house), a fascia board;
- the cozy house puts 96 on calcite, stripped logs, moss and diorite as thin panels;
- the farmhouse and simple medieval house hang them on barrels (12, 16), leaves and beds as
  crate fronts, planter boards and footboards.

The engine places wall signs as block states (`minecraft:spruce_wall_sign[facing=east]`); with no
block-entity data they come out blank, which is exactly this use.

### S12. Leaves are part of the building

1,137 leaf blocks touch masonry or wood rather than a trunk: moss on roofs (the cozy house has 55
azalea leaves on its cobbled deepslate roof), bushes along foundations, planters in trapdoor or
barrel boxes, ivy down walls. Every leaf block in the 10 builds that use leaves this way is
`persistent=true`; the japanese tower's spruce leaves, the one exception, are on real trees with
trunks. The elven house goes further and builds its overgrown roofs from green wool, lime
terracotta and moss blocks (S8).

### S13. Composite props: one object from several blocks

- **Paper lantern** (japanese tower, 63 of them): from the top, `iron_chain`, `spruce_fence`,
  `hopper[facing=down]`, with a `white_wall_banner` hung on each of the hopper's four sides as the
  paper. Under the hopper, 19 of them have a glowing core (`red_wool`, `shroomlight`, then a closed
  top-half trapdoor as the base) and 44 let a hanging `lantern` drop out of the bottom.
- **Note block plant stand** (overgrown castle, 14): `note_block` with a potted fern on it.
- **Campfire furniture** (overgrown castle): 69 unlit campfires on open fence gates, as small
  tables.
- **Barrel as planter or pedestal**: 178 barrels with a slab, stair, light, plant or pot on top.
- **Flower pots** stand on stairs, slabs and trapdoors more than on full blocks (overgrown castle:
  31 on `spruce_slab`, 19 on `dark_oak_trapdoor`).
- **New blocks**: the raifox house (26.x) furnishes its rooms with 68 `spruce_shelf` blocks.

### S14. Base, body, crown

The three most common blocks of the bottom fifth, the middle and the top third of each building
show the same order almost everywhere: stone at the bottom, timber and plaster in the middle, a
dark roof on top.

| build            | base                                               | body                                                     | crown                                                      |
| ---------------- | -------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| tavern           | cobblestone, stripped spruce log, andesite         | stripped spruce log, deepslate tiles, spruce trapdoor    | smooth basalt, spruce planks, spruce trapdoor              |
| simple medieval  | dark oak planks, stone bricks, stone brick stairs  | stripped dark oak wood, dark oak planks, dark oak stairs | dark oak planks, cobbled deepslate, deepslate brick stairs |
| wizard tower     | cobbled deepslate, stone, deepslate bricks         | calcite, cobbled deepslate, spruce planks                | cobbled deepslate, its slabs, its walls                    |
| japanese tower   | cobblestone, spruce leaves, stripped spruce log    | stripped spruce log, deepslate tiles, spruce fence       | deepslate tile stairs, deepslate tiles                     |
| castelo medieval | stone bricks, stone brick wall, stone brick stairs | stone bricks, stone brick stairs, stone brick wall       | deepslate bricks, deepslate brick stairs                   |

The base band is often a different shape language too: the raifox house and simple medieval house
edge their foundations with trapdoors and stone brick stairs; the raifox house scatters ore blocks
(iron, copper, coal, emerald, diamond) through its stone floor as grain.

### S15. Houses are asymmetric, towers are not

Mirror match of non-ground blocks: houses 11–40% (tavern 11, wizard tower 12, cozy 14, farmhouse
16, forest house 27, survival mansion 37, simple medieval 38), with the 15-wide starter house
(96%) the exception. Towers and castles: gothic tower and stone pillar tower 100%, castelo 98%,
japanese tower 85%. A house built with one `scope` and mirrored will look stiff; give it a wing,
a tower, a porch or a chimney on one side.

### S16. A narrow palette, used in every shape

Four materials cover 80% of the structural blocks (median), even though the median build uses 47
block ids. The pattern: one main wood, one accent wood, one
dark roof stone, one pale infill, one base stone, each used as full block, stairs, slab, wall or
fence and trapdoor. The main wood is spruce in 12 builds, dark oak in 3 and oak in 1. The fishing
dock is the extreme: one material (dark oak) in eight shapes.

## Per build

- **Ivy's Starter House**: oak and birch timber with a polished granite roof whose middle rows
  are full blocks between oak stair edges; flower pots on stairs, barrels as planters, lanterns
  under the eaves. Small and nearly symmetric.
- **Simple Watchtower**: cobblestone, andesite and tuff speckled together, mossy patches, stone
  buttons as grain, a cobblestone slab and stair cap; 94% of its trapdoors open, as shutters.
- **raifox house**: spruce stair roof on a stair sandwich with a deepslate brick edge, spruce and
  dark oak log frame on a 2-block rhythm, sign fascia, flower boxes from trapdoors on grass, a
  lightning rod finial on the chimney.
- **Large Farmhouse**: low slab-stepped roof in three dark materials, spruce frame with calcite
  and polished diorite infill, 57 trapped chests and 49 barrels of storage, signs as crate
  fronts.
- **Fishing Dock**: one material in eight shapes; slab deck on log piles, fence lamp posts,
  blank signs at the waterline, a boat hull of stone brick slabs.
- **Simple Medieval House**: dark oak frame on a 2-block rhythm, two-tone deepslate roof with dark
  oak verges and crossed horns, cracked and plain stone bricks at the base, flower boxes.
- **Cozy medieval house**: cobbled deepslate, polished deepslate and tuff roof with azalea moss,
  calcite and diorite plaster, a stone brick chimney with a campfire, 96 blank signs as panels.
- **gothic tower**: tuff bricks and polished tuff; buttresses of walls and stairs that step out on
  inverted stairs at every stage, black glass, perfectly symmetric.
- **Forest House**: three cross-gabled wings with steep deepslate tile roofs on a full underlay and
  spruce trim, dark oak frame, glass panes framed by planks above and below, snow plate.
- **castelo medieval**: stone brick castle with deepslate brick conical roofs, lantern finials on
  iron bars, diorite wall shafts, 95 lanterns; symmetric across one axis.
- **The Tavern**: a stone tower with a flared octagonal roof beside a timber hall; the widest
  palette here (9 materials for 80%), speckled cobblestone and andesite, a pale chimney, and the
  only signs with text.
- **Stone Pillar Tower**: a round open lattice of andesite walls under stone rings carried on
  inverted stairs; 3 materials, no light, no wood.
- **Elven House**: hillside house whose roofs are green wool, lime terracotta and moss; spruce
  frame clad in 952 trapdoors; a white calcite tower with a leaf spire.
- **Simple Survival Mansion**: deepslate tile roofs on an underlay with dark oak verges and horns,
  spruce frame, fence and lantern lamp posts, signal campfires on hay.
- **Wizard Tower**: two towers joined by a bridge on a terrain plate; cobbled deepslate base and
  spires, calcite and spruce body, amethyst, sculk and crying obsidian accents.
- **Overgrown Survival Castle**: a stone hill crowned with spruce-roofed halls and cone spires,
  full interior (55% of the blocks are inside), ivy everywhere, campfire and note block furniture.
- **Japanese Tower**: five tiled storeys on fence colonnades with trapdoor balcony rails and
  upturned eaves, 63 paper lanterns, a chain and wall spire.

## Engine mapping

| technique                 | in the engine today                                                 | gap                                                              |
| ------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| S1 shape share            | the build summary's palette                                         | a shape-share line in the summary would make the check automatic |
| S2 inverted-stair trim    | `shapes.arch`, `shapes.corbels`, `stairs` with `half: "top"`        |                                                                  |
| S3 roof underlay          | `underlay` on `roofGable`, `roofHip`, `shapes.roofUnion`; `profile` |                                                                  |
| S3 stair sandwich         | `sandwich` on the same three roofs                                  |                                                                  |
| S4 contrasting edges      | `roofGable` `verge` and `eave`                                      | verge horns past the apex and eave                               |
| S6 trapdoor cladding      | `shapes.cladding` (sides open and flat, `down` and `up` closed)     |                                                                  |
| S7 timber frame           | `shapes.bayWall` (`period`, `post`, `beam`, `infill`, `postWidth`)  |                                                                  |
| S8 speckle                | weighted palettes, `patches`, `palette near`                        |                                                                  |
| S9 wall and fence columns | `pillar` with a wall or fence block                                 | the engine does not connect walls and fences; set their sides    |
| S10 lighting              | `shapes.lampPost`, `shapes.paperLantern`; other lights hand-placed  | a light-density line in the summary                              |
| S11 sign trim             | wall sign block states                                              |                                                                  |
| S13 composite props       | `shapes.paperLantern`, `shapes.lampPost`, `shapes.windowBox`        | more props (campfire table, barrel planter, note-block stand)    |

## What the study changed in the engine

Importing these files exposed that `import` kept block ids Minecraft has since renamed: the
overgrown castle carries `chain` and `grass` (1.19), and the re-import failed validation on 26.2.
`import` now renames `chain` to `iron_chain`, `grass` to `short_grass` and `grass_path` to
`dirt_path` when the registry knows only the new id, writes `import { Build } from "voxwright"`
from the published command line, and writes `.ts` or `.mjs` by the `-o` extension (the code is
the same). All 18 files now import and rebuild with 0 validation errors.

The gaps in the table above then became options and shapes (2026-11-16):

- `underlay` and `sandwich` on `roofGable`, `roofHip` and `shapes.roofUnion` (S3);
- `stairs` `half: "top"` and `shapes.corbels` (S2);
- `shapes.cladding` (S6);
- `shapes.paperLantern` (the japanese tower's 63 lanterns, read cell by cell: 44 with a hanging
  lantern, 19 with a red wool, shroomlight and trapdoor core), `shapes.lampPost` and
  `shapes.windowBox` (S10, S12, S13).
