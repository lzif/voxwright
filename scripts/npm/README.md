<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# mcbuild

Build Minecraft structures from a short TypeScript recipe. `mcbuild` runs the recipe, checks every
block against the block registry of the Minecraft version, and writes `.schem` (WorldEdit),
`.litematic` (Litematica), `.nbt` (structure blocks) or `.mcstructure` (Bedrock Edition).

It is the command line of [Voxwright](https://github.com/lzif/voxwright), in one file with no
dependencies. It needs Node 22.18 or later.

```sh
npx mcbuild build house.ts --out house.schem --out house.litematic
npx mcbuild inspect house.schem
npx mcbuild preview house.litematic
```

A recipe is an ES module that exports a `Build`:

```ts
import { Build } from "voxwright";

export const BUILD = new Build({ seed: 7 });

BUILD.scope(() => {
  BUILD.box([0, 0, 0], [8, 0, 6], "minecraft:cobblestone");
  BUILD.walls([0, 1, 0], [8, 4, 6], "minecraft:oak_planks");
  BUILD.roofGable([-1, 5, -1], [9, 5, 7], "minecraft:spruce_stairs", { ridge: "x" });
});
```

`"voxwright"` resolves to `mcbuild` itself, so a recipe runs from any directory and needs no
`package.json`.

| Command   | Result                                                                             |
| --------- | ---------------------------------------------------------------------------------- |
| `build`   | Runs the recipe, validates block names and block states, writes the schematic      |
| `inspect` | Prints format, DataVersion, size, block count and palette of a schematic           |
| `preview` | Serves a 3D viewer and editor on localhost with the file open; nothing is uploaded |

Further commands work with numbered run directories: `init` (a starter recipe), `check`, `run`
(`report.json`, the `.nbt`, and with `--preview` PNG views drawn with the game's textures),
`import` (a schematic back into a recipe), `diff` and `assets fetch`. `mcbuild --help` lists them.

`mcbuild <command> --help` lists the options of `build`, `inspect` and `preview`. The first `build` for a Minecraft version downloads
its block registry (about 120 kB) into `~/.cache/mcbuilder/`.

Documentation:

- [Recipe API](https://github.com/lzif/voxwright/blob/main/skills/voxwright/references/builder-api.md)
- [Block ids and block states](https://github.com/lzif/voxwright/blob/main/skills/voxwright/references/block-states.md)
- [Recipe examples](https://github.com/lzif/voxwright/blob/main/skills/voxwright/references/recipe-examples.md)

AI agents can use the same command line as an Agent Skill: `npx skills install lzif/voxwright`.

Not affiliated with Mojang or Microsoft. Licence: AGPL-3.0-only.
