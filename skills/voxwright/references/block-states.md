<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# Block ids and block states

How to write blocks so that `build` validates them and every export format carries them. The
recipe API is in [builder-api.md](builder-api.md).

## Block strings

```text
minecraft:oak_stairs[facing=east,half=bottom]
└─ namespace:name ─┘└──── properties ─────┘
```

- Always write the `minecraft:` namespace. Names are the Java Edition ids of the target version
  (default 26.2), lowercase with underscores.
- Properties go in square brackets, comma separated, no spaces needed. Their order does not
  matter: the engine sorts them, so `count()` and `find()` match either order.
- A property you leave out takes the game's default when the build is pasted. Write only the
  properties that matter for the look.
- The engine places exactly the string you give. It never guesses a property, never renames a
  block and never connects neighbours. The only blocks oriented for you are the stairs and slabs
  of `stairs`, `roofGable`, `roofHip`, `arch`, and the corbel of `parapet`.

## Validation

`build` checks every block state of the build against the registry of the Minecraft version:

| Problem          | Example                            | Result                                          |
| ---------------- | ---------------------------------- | ----------------------------------------------- |
| Unknown block    | `minecraft:oak_plank`              | Error with up to three did-you-mean names       |
| Unknown property | `minecraft:oak_log[facing=up]`     | Error listing the block's legal properties      |
| Illegal value    | `minecraft:oak_stairs[half=lower]` | Error listing the property's legal values       |
| Other namespace  | `mymod:gizmo`                      | Error, unless passed with `--allow mymod:gizmo` |
| Malformed string | `minecraft:oak_log[axis=y`         | The recipe fails where the block is placed      |

Any error stops the build before a file is written. Fix the recipe and run `build` again.

Block names change between versions. In 26.2 the chain is `minecraft:iron_chain`; the old
`minecraft:chain` is an unknown block there. Trust the validator's suggestion over memory.

### Looking up a block

The registry is a JSON file in `~/.cache/mcbuilder/<version>/minecraft-data.json` (the first
`build` downloads it). Look up the legal properties of a block, or search names:

```sh
node -e 'const b=require(require("os").homedir()+"/.cache/mcbuilder/26.2/minecraft-data.json").blocks;console.log(b["minecraft:"+process.argv[1]]?.properties??"unknown block")' oak_stairs
node -e 'const b=require(require("os").homedir()+"/.cache/mcbuilder/26.2/minecraft-data.json").blocks;console.log(Object.keys(b).filter(n=>n.includes(process.argv[1])).join("\n"))' copper_lantern
```

Do this before using a block or a property you are not sure about.

## Properties that matter for builds

Horizontal directions are `north` (-Z), `south` (+Z), `east` (+X), `west` (-X).

| Property                         | Blocks                                               | Values                                                               | Meaning                                                                                      |
| -------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `facing`                         | Stairs                                               | 4 horizontal                                                         | The direction you walk when climbing; the tall back is on that side                          |
| `facing`                         | Doors, fence gates                                   | 4 horizontal                                                         | The direction the placing player looked; a closed door sits on the opposite edge of its cell |
| `facing`                         | Ladders, wall torches, wall signs, wall banners      | 4 horizontal                                                         | Away from the supporting block, which is on the opposite side                                |
| `facing`                         | Trapdoors                                            | 4 horizontal                                                         | Away from the hinge side                                                                     |
| `facing`                         | Chests, furnaces, and other blocks with a front      | 4 horizontal                                                         | Where the front points                                                                       |
| `facing`                         | Barrels, end rods, lightning rods, pistons, droppers | 4 horizontal, `up`, `down`                                           | Where the block points                                                                       |
| `facing`, `part`                 | Beds                                                 | 4 horizontal; `foot`, `head`                                         | Two cells: `part=foot`, then `part=head` one cell toward `facing`                            |
| `axis`                           | Logs, wood pillars, basalt, chains, hay              | `x`, `y`, `z`                                                        | The axis the grain runs along; `y` is upright                                                |
| `half`                           | Stairs, trapdoors                                    | `bottom`, `top`                                                      | `top` is upside-down (stairs) or in the upper half of the cell                               |
| `half`                           | Doors, tall plants                                   | `lower`, `upper`                                                     | Two cells stacked: place both                                                                |
| `type`                           | Slabs                                                | `bottom`, `top`, `double`                                            | Which half of the cell is filled                                                             |
| `shape`                          | Stairs                                               | `straight`, `inner_left`, `inner_right`, `outer_left`, `outer_right` | Corner pieces, relative to `facing`                                                          |
| `shape`                          | Rails                                                | `north_south`, `east_west`, `ascending_*`, corner pairs              | Track direction                                                                              |
| `open`                           | Doors, trapdoors, fence gates, barrels               | `true`, `false`                                                      |                                                                                              |
| `hinge`                          | Doors                                                | `left`, `right`                                                      | Which side the hinge is on                                                                   |
| `north`, `east`, `south`, `west` | Fences, glass panes, iron bars                       | `true`, `false`                                                      | An arm toward that side                                                                      |
| `north`, `east`, `south`, `west` | Walls                                                | `none`, `low`, `tall`                                                | An arm toward that side, and its height                                                      |
| `up`                             | Walls                                                | `true`, `false`                                                      | The centre post                                                                              |
| `rotation`                       | Standing signs, banners, skulls                      | `0`..`15`                                                            | Sixteenths of a turn: 0 south, 4 west, 8 north, 12 east                                      |
| `face`                           | Buttons, levers                                      | `floor`, `wall`, `ceiling`                                           | What the block is attached to                                                                |
| `hanging`                        | Lanterns                                             | `true`, `false`                                                      | Hung under a block instead of standing                                                       |
| `persistent`                     | Leaves                                               | `true`, `false`                                                      | `true` keeps placed leaves from decaying                                                     |
| `waterlogged`                    | Stairs, slabs, fences, and many more                 | `true`, `false`                                                      | The cell also holds water                                                                    |
| `lit`                            | Furnaces, campfires, candles, redstone lamps         | `true`, `false`                                                      |                                                                                              |
| `layers`                         | Snow                                                 | `1`..`8`                                                             | Height in eighths                                                                            |

Rules that follow from the table:

- **Leaves**: always `persistent=true`, or they decay once pasted away from a log.
- **Doors, beds and tall plants** take two cells. Place both halves; a single half pops off.
- **Fences, walls, panes and iron bars**: a schematic stores the state you wrote. Write the
  `north`/`east`/`south`/`west` arms yourself when the look matters, because not every paste tool
  recomputes them. A bare `minecraft:oak_fence` is a lone post until something updates it.
- **Stair corners**: the engine does not compute `shape`. A roof made with `roofGable` or
  `roofHip` needs none; a hand-laid stair ring does (`outer_*` on convex corners, `inner_*` on
  concave ones).
- **Chest contents, sign text and other block-entity data** cannot be written from a recipe. A
  block string with an NBT tail (`minecraft:chest{...}`) is exported without the tail, with a
  warning.

## Rotation and mirroring

`BUILD.place(geometry, { rotation })`, `Geometry.rotate()` and `rotateBlockstate(block, rotation)`
turn clockwise seen from above. `CLOCKWISE_90` turns north to east.

| Property                               | `CLOCKWISE_90`              | `CLOCKWISE_180`  | `COUNTERCLOCKWISE_90`      |
| -------------------------------------- | --------------------------- | ---------------- | -------------------------- |
| `facing` (horizontal values)           | north→east→south→west→north | opposite side    | north→west→south→east      |
| `north`/`east`/`south`/`west` arms     | the keys move the same way  | swapped in pairs | the keys move the same way |
| `axis`                                 | `x` and `z` swap            | unchanged        | `x` and `z` swap           |
| `rotation` (0..15)                     | +4                          | +8               | +12                        |
| `orientation` (for example `north_up`) | the horizontal part turns   | likewise         | likewise                   |

Everything else is unchanged by rotation: `facing=up`/`down`, `half`, `type`, `hinge`, `open`,
stair `shape` (it is relative to `facing`, so it stays correct).

Not handled, so avoid or fix by hand:

- Rail `shape` (`north_south`, `ascending_east`, ...) is not turned. Lay rails after rotating.
- `Geometry.mirror(axis)` swaps `facing` and the arm keys across the axis, and nothing else: a
  mirrored door keeps its `hinge` and a mirrored corner stair keeps `inner_left`/`inner_right`.
  Prefer rotation for parts that contain doors or corner stairs.

## Minecraft versions

`--mc-version` selects the registry and the DataVersion written to the file. Default `26.2`.

| Version   | DataVersion |
| --------- | ----------- |
| `26.2`    | 4903        |
| `26.1`    | 4786        |
| `1.21.11` | 4671        |
| `1.21.4`  | 4189        |
| `1.21.1`  | 3955        |

For another version pass `--data-version <n>` as well. A file loads in the version it names and
later ones; build for the oldest version it must open in.

## Export formats

| Format         | Loads in                                                            | Notes                                                                |
| -------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `.schem`       | WorldEdit, FastAsyncWorldEdit and tools that read Sponge schematics | Sponge version 3 by default; `--schem-version 2` for older tools     |
| `.litematic`   | Litematica                                                          | One region named `Main`; `--name` and `--author` set the metadata    |
| `.nbt`         | Vanilla structure blocks, `/place template`, data packs             | A structure block loads at most 48×48×48; `--air` controls air cells |
| `.mcstructure` | Bedrock Edition structure blocks and `/structure load`              | Block states are translated to Bedrock by rule; see below            |

Caveats that hold for every format:

- One build is one region. The file starts at the build's lowest corner.
- No axis may exceed 512 blocks.
- Cells you never set, or removed with `carve`, are empty. `.nbt` and `.mcstructure` leave them
  out, so pasting does not touch the world there. `.schem` and `.litematic` store a full box, so
  those cells are air in the file; whether that air is pasted is up to the tool (WorldEdit's
  `//paste -a` skips it).
- Cells set to `minecraft:air` are air in every format, except `.nbt` with the default
  `--air none`, which leaves them out (`--air explicit` writes them, `--air all` writes the whole
  box as air).
- Entities and block-entity data are not written.

`.mcstructure` only: Java states are translated to Bedrock by rule, for stairs, slabs, doors,
trapdoors, beds, logs and other pillars, fences, panes, walls, torches, lanterns, leaves, and
blocks with a `facing`. A property the rules do not cover is dropped and listed as a warning,
never guessed. Read the warnings of a `.mcstructure` export and tell the user what was lost. Block
names are passed through (apart from `grass_block` -> `grass` and wall torches -> `torch` with
`torch_facing_direction`), so another block that has a different name on Bedrock arrives as an
unknown block there.
