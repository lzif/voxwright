<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# voxwright: user guide

This guide is for people using the voxwright web app: opening a Minecraft schematic, looking at it, converting it to another format, and making quick edits. To run your own copy of the site, see [self-hosting.md](self-hosting.md).

Everything runs in your browser. Files you open are read on your machine and are not uploaded.

## Contents

1. [Opening a file](#1-opening-a-file)
2. [The viewer](#2-the-viewer)
3. [Converting and the loss report](#3-converting-and-the-loss-report)
4. [The editor](#4-the-editor)
5. [Exporting](#5-exporting)
6. [Autosave and restore](#6-autosave-and-restore)
7. [Your own resource pack or client jar](#7-your-own-resource-pack-or-client-jar)
8. [Known limits](#8-known-limits)

## 1. Opening a file

Choose **Open a schematic**, or drop a file on the page. The drop works on the main area, not on the footer or on the empty margins of a very wide window; the browser may open a file dropped there itself instead. These formats open:

| Extension      | Format                           |
| -------------- | -------------------------------- |
| `.nbt`         | Structure block (Java)           |
| `.schem`       | Sponge schematic, version 2 or 3 |
| `.litematic`   | Litematica                       |
| `.mcstructure` | Bedrock structure                |

The format is chosen from the file name's extension. Any other extension is refused with a message.

- A build that is more than 512 blocks along any axis is refused when it is read, with a message such as "this build is 601 x 40 x 80; the limit is 512 blocks per axis".
- A legacy `.schematic` file (the format from before Minecraft 1.13) is refused with a message to re-save it as `.schem`, for example with WorldEdit in Minecraft 1.13 or later, and open that.

A file with no blocks is refused ("nothing to draw: the file has no blocks"). Once a file is open, the status line shows its name, its size in blocks and its block count.

With the WebGL renderer, reading a file happens on the page's main thread, so a large file makes the page busy for a moment. (The software renderer reads it in a worker.) On the project's 256 x 64 x 256 test build (2 million cells), reading took about 0.4 s on the development machine.

## 2. The viewer

### Cameras

The page has two ways to move: **Orbit** and **Fly**. Pick one under **View** in the side panel.

**Orbit** turns the build around a centre point.

| Input                                     | Effect          |
| ----------------------------------------- | --------------- |
| Drag                                      | Turn            |
| Mouse wheel                               | Zoom            |
| Shift+drag, or drag with the right button | Move sideways   |
| Arrow keys (picture focused)              | Turn            |
| `+` and `-` (picture focused)             | Zoom in and out |

The **Turn** and **Tilt** sliders and the **Zoom in** and **Zoom out** buttons do the same without a mouse.

**Fly** puts you inside the scene. Click the picture first, then:

| Input                       | Effect                          |
| --------------------------- | ------------------------------- |
| W A S D (or the arrow keys) | Move forward, left, back, right |
| Space or E                  | Up                              |
| C or Q                      | Down                            |
| Shift                       | Faster                          |
| Mouse wheel                 | Change speed                    |
| Esc                         | Let go of the mouse             |

### Layer slicer

Under **Layers**, the **From** and **To** sliders limit the picture to a range of layers. Layer 0 is the lowest layer of the build. Layers outside the range are hidden. Moving the sliders back to the full range shows everything again. After an edit, undo or redo changes the build's height, the sliders follow it: a range that showed every layer keeps showing every layer, and a narrowed range keeps the same layers.

### Side panel details

- **Blocks** lists the 12 most used block types and their counts. The counts follow your edits a moment after the last one.
- **Renderer** shows the number of sections drawn, the frame rate and the graphics device the browser reports.
- Blocks that have no model in the texture pack are drawn as magenta cubes, and the page lists their names.

### Without WebGL2: the software renderer

The page draws with WebGL2. If the browser has none (or the renderer cannot start), the page falls back to a software renderer that runs in a worker, and labels itself "software renderer (no WebGL2)" at the top.

In that mode:

- You can open files, turn the picture by dragging or with the **Turn** and **Tilt** sliders, limit layers, and convert.
- There is no Orbit/Fly choice and no zoom buttons, and the tilt slider runs from 0 to 90 degrees.
- There is no editor. The page says "Editing needs WebGL2; the software renderer is a viewer."

### Touch-only devices

On a phone or tablet with WebGL2, the page uses a mobile layout: a full-screen picture, a top bar with a **Menu** button (for opening files, texture packs, view settings and exporting), a bottom toolbar for choosing tools and opening the block palette, a floating **Undo** / **Redo** cluster (which can be moved to the left side for left-handed use), and draggable bottom sheets (with peek, half and full heights) for the palette, block state and selection panels. (Direct touch block placement on the picture is still in progress; see `docs/mobile-editor-plan.md`.)

On a touch screen in Orbit, one finger turns the build, pinching with two fingers zooms, and moving two fingers together pans the build across the screen. If you lift one finger after a two-finger gesture, the remaining finger keeps turning the build without jumping. The **Turn**, **Tilt** and zoom controls in the **Menu** sheet work too, and **Fly** mode is hidden on touch devices. Adding `?perf=1` to the address shows a small performance overlay (frame rate, triangle count, frame time, heap memory and pixel ratio).

## 3. Converting and the loss report

With a file open, choose a format in the **File format** list and press **Convert and download**. The options are:

- Structure block (`.nbt`)
- Sponge (`.schem`, v3)
- Sponge (`.schem`, v2)
- Litematica (`.litematic`)
- Bedrock (`.mcstructure`)

The download is named after the file you opened, with the new extension. The file you opened is never changed.

A `.schem` keeps its `Offset` when it is converted to `.schem`, and a `.litematic` keeps its name, author and description when it is converted to `.litematic`. Other conversions do not carry them.

The game version number (DataVersion) is kept from the source file. A `.mcstructure` file carries none, so a conversion from it to a Java format uses 4903 (Minecraft 26.2).

### The loss report

Formats do not hold the same things. The **Loss report** under the format list says what the source file held that could not be read, and what the output format could not carry. It is shown whenever a file is open. Before you convert, it lists what the file itself could not give (for example blocks the reader left out). After a conversion it also lists what the output format could not carry. When nothing was lost it says "Nothing was lost reading this file.", and after a conversion "Nothing was lost." Each line is one kind of loss.

Typical lines:

| Line (shape)                                                                              | Meaning                                                                                                   |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `N block entities not carried over (Java NBT cannot be translated to Bedrock): chest x18` | Chests, signs and similar blocks with stored data were not written, with a count per kind.                |
| `N entities not carried over (Bedrock NBT cannot be translated to Java): ...`             | The same for entities (mobs, item frames and so on).                                                      |
| `N pending block and fluid ticks not carried over`                                        | Scheduled updates in a `.litematic` are not kept. For `.mcstructure` the line says "pending block ticks". |
| `...: dropped Bedrock state k=v` or `...: dropped Java property k=v`                      | A block property has no equivalent in the other edition, so it was left out.                              |
| `... (their position holds no block, or is missing or malformed)`                         | The file listed a block entity or entity at a place that holds no block, or with a damaged position.      |
| `... (their cell is air, which this export leaves out)`                                   | Writing `.nbt` leaves out air, so a block entity on an air cell is lost.                                  |
| `N blocks not carried over (editor leftovers that are not part of a build): jigsaw x3`    | `structure_void`, `structure_block` and `jigsaw` are left out on purpose, with a count per name.          |
| `N blocks turned into air (cave_air and void_air are not kept): ...`                      | `cave_air` and `void_air` are read as plain air.                                                          |
| `Metadata not carried over (...)`, `biomes not carried over (...)`                        | A `.schem` held metadata or biomes; this app keeps neither.                                               |
| `N regions flattened into one`, `N cells overwritten where regions overlap (...)`         | A `.litematic` with several regions is merged into one; where regions overlap, the later one wins.        |

### Block entities and entities

- **Between the Java formats** (`.nbt`, `.schem`, `.litematic`), block entities (chest contents, signs, banners) and entities are carried over with their data.
- **From one `.mcstructure` to another**, they are kept as they are.
- **Between Java and Bedrock**, they are not translated, because Java and Bedrock store this data differently. They are not written, and the loss report lists them with a count and a kind. The one exception: a Bedrock bed's block entity that holds only its colour is not listed, because the Java block name already says the colour.

### Block states between Java and Bedrock

Block states are translated by rule, for stairs, slabs, doors, beds, logs and other pillars, fences, panes, walls, moss carpets and blocks with a facing. Block names are written as they are, apart from two renames (`cobweb` and Bedrock's `web`, `sugar_cane` and Bedrock's `reeds`). A block property the rules do not cover is dropped and listed in the loss report, not guessed. A block name that differs between the editions but is not one of the two renames is written unchanged and is not listed, so it can be wrong in the other game. This is not a full mapping table.

## 4. The editor

With a mouse and keyboard, a WebGL2 browser and a file open, the toolbar appears above the picture, and a column of panels appears on its left: the block palette, the block-state panel and the selection panel (which also holds **Block at coordinates**). The editor works in the **Orbit** camera only.

### How the mouse works

The page starts with the **View** tool, where the mouse only looks around. After you choose another tool:

| Input                                     | Effect                 |
| ----------------------------------------- | ---------------------- |
| Left click or drag                        | Use the tool           |
| Alt+drag                                  | Turn the view          |
| Shift+drag, or drag with the right button | Move the view sideways |
| Mouse wheel                               | Zoom                   |

Choose **View** to look around without any risk of editing.

When layers are limited with the slicer, the mouse tools (Place, Replace, Erase, Pick, Line, Rectangle, Select and the click that places a paste) pick only blocks in the visible layers: clicks pass through the hidden ones, and Place, Line and Rectangle will not put a block in a hidden layer. Selection actions do not look at the slider (see Selection below).

### Tools and shortcuts

Shortcuts are single keys. They are ignored while you type in a text field (the palette search, the property and coordinate fields), and the single keys are ignored while Shift or Alt is held. Where the table says Ctrl, Cmd works too.

| Tool or action       | Key                  | What it does                                                                                                                                          |
| -------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| View                 | V                    | Look around only. Clicks change nothing.                                                                                                              |
| Place                | P                    | Click a face to put the chosen block next to it. Drag to paint along that surface.                                                                    |
| Replace              | B                    | Click a block to turn it into the chosen block. Drag to paint along that surface.                                                                     |
| Erase                | X                    | Click a block to remove it. Drag to clear along that surface.                                                                                         |
| Pick                 | I                    | Click a block to choose its type. The tool then switches to Place.                                                                                    |
| Line                 | L                    | Drag from one face to another to draw a straight line of the chosen block.                                                                            |
| Rectangle            | R                    | Drag across a surface to draw a flat rectangle. Tick **Hollow** to draw only the frame.                                                               |
| Select               | M                    | Drag from one block to another to select the box between them.                                                                                        |
| Fill                 | F                    | Fill the selection with the chosen block.                                                                                                             |
| Rotate anticlockwise | `[`                  | Turn the selection a quarter turn anticlockwise.                                                                                                      |
| Rotate clockwise     | `]`                  | Turn the selection a quarter turn clockwise.                                                                                                          |
| Copy                 | Ctrl+C               | Copy the selection.                                                                                                                                   |
| Paste                | Ctrl+V               | Start pasting, then click where the copied blocks should go. There is no toolbar button; use the **Paste** button in the selection panel or this key. |
| Cancel               | Esc                  | Cancels a drag in progress. If there is none, clears the selection. If there is none, returns to View.                                                |
| Undo                 | Ctrl+Z               | Undo the last step.                                                                                                                                   |
| Redo                 | Ctrl+Shift+Z, Ctrl+Y | Redo.                                                                                                                                                 |

Each tool's tooltip repeats its shortcut. The line under the toolbar shows the block under the pointer and a help line for the active tool.

Erase writes air, so the build keeps its size.

### Block palette

The **Block** panel sets the block that Place, Replace, Line, Rectangle, Fill and replace-in-selection use.

- The **Chosen block** field holds the block. You can type any block, with properties if you like, such as `minecraft:oak_stairs[facing=north,half=top]`. If what you typed is not a valid block, the panel says why.
- **Search blocks** filters the list below. Each word you type must appear in the name, so `oak stair` finds `minecraft:oak_stairs`. Enter chooses the first match, or your text as typed when nothing matches. When the text you typed is not exactly an entry in the list, a **Use "..."** entry appears at the top of the list and offers it as typed (with `minecraft:` added if you left it off).
- The list holds the blocks the open build already uses, and the blocks of the texture pack. A tooltip says which. Without a texture pack, only the build's blocks are listed, and you can still type any other block. At most 200 matches are shown; the count below the list says how many matched.
- In the list, the arrow keys, Home and End move between entries and Enter chooses one.

The list shows names only, with no block pictures.

### Block-state panel

**Block state** shows the properties (facing, half, waterlogged and so on) of the block you last pointed at. It keeps showing that block when the pointer moves to the panel.

- A property with true/false values is a drop-down.
- Any other property is a text field. It offers suggested values, but the suggestions are only a guess, because the editor does not know which values are legal for a block. Any value can be typed. Press Enter to apply.
- The row at the bottom adds a property that the block does not have yet (property, value, **Add**).
- Each change is one undo step.

### Selection

Choose the **Select** tool and drag from one block to another. The selection is a box. You can also press **select everything** in the selection panel, or type the box's corners into the number fields. There is one row per axis (x, y, z) with two fields in it: the lower corner first, the upper corner second (their labels for screen readers are "From x" and "To x").

Under **Block at coordinates**, type x, y and z to set one cell to the chosen block (**Set to chosen block**) or clear it (**Erase**), with the keyboard alone. The panel also prints the extent of the build.

Actions on a selection:

| Action  | How                                                                                                                                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fill    | **Fill** or F. Fills the box with the chosen block. Tick **only empty cells** to leave existing blocks alone.                                                                                                                          |
| Replace | Type the block to replace (or press **Pointed-at** to use the block last pointed at), then **Replace with the chosen block**. It matches the whole block state, such as `minecraft:stone` or `minecraft:oak_stairs[facing=north,...]`. |
| Copy    | **Copy** or Ctrl+C.                                                                                                                                                                                                                    |
| Paste   | **Paste** or Ctrl+V, then click. The copied box is placed with its lowest corner on the block next to the face you click. The pasted area becomes the new selection.                                                                   |
| Move    | Type x, y and z offsets and press **Move**, or use the up and down arrow buttons for one block. There is no drag-to-move.                                                                                                              |
| Rotate  | **Rotate** with the anticlockwise or clockwise button, or `[` and `]`. Block properties such as facing turn with the blocks.                                                                                                           |
| Mirror  | **Mirror E–W** or **Mirror N–S**.                                                                                                                                                                                                      |
| Clear   | **Clear** or Esc, to deselect.                                                                                                                                                                                                         |

The checkbox **leave the target alone where there is air (paste and move)** is on by default. With it on, air in the copied or moved box does not overwrite blocks at the target.

Selection actions (Fill, Replace, Copy, Move, Rotate, Mirror) work on the box whatever the layer slider shows, so they also change hidden layers if the box reaches them.

Rotate on a selection that is not square (different width and length) turns the box into a footprint that sticks out past it, and writes every selected cell there, air included. That air can overwrite blocks next to the selection. Undo brings them back. A square selection does not have this problem. Mirror stays inside its box.

### Undo and redo

Ctrl+Z, Ctrl+Shift+Z (or Ctrl+Y), and the **Undo** and **Redo** buttons. A mouse drag with Place, Replace or Erase is one undo step. A line, a rectangle, a fill, a paste and every other selection action are each one step too.

### Block entities and entities in the editor

The editor keeps block entities (chest contents, signs and so on) and entities but does not edit them.

- A block entity belongs to its cell and its block. It stays while the block name stays: changing `facing` keeps a chest's contents. Erase, replace, fill and putting a different block there drop it. Undo brings it back.
- Move, rotate, mirror, copy and paste carry a block entity with its block.
- Entities (mobs, item frames) are not part of a selection and stay where they are.

### Leaving the page

Edits live in the page. The browser asks before you close the tab, and the page asks before you open another file, if there are edits you have not exported. Exporting counts as saving. Undoing every edit also counts as nothing to lose.

## 5. Exporting

In the editor, the side panel's conversion section is called **Export**, and the button **Export and download**. It writes the build as it is now, edits included, to a new file in the format you chose. The text under the button says how many edits are included.

- The file you opened is never changed.
- With edits, the download is named `<name>-edited.<extension>`. Without edits it is `<name>.<extension>`.
- The loss report appears as for any conversion (see section 3).
- Export runs on the main thread, so the page pauses while a very large build is encoded.
- After an export, the autosave copy is deleted (see section 6).

## 6. Autosave and restore

While you have unexported edits, the page copies the volume into the browser's own storage (IndexedDB). It writes a few seconds after your last change (about 2 s), at the latest every 8 s while changes keep coming, and when the tab is hidden. The **Autosave** section of the side panel says what is happening: "Saved in this browser at ...", or a warning if the storage is full or unavailable.

There is one slot: the build you are editing.

- **Restore.** The next time you open the page, a dialog titled "Restore your unsaved work?" shows the file name, when it was saved and the number of edits. **Restore** loads the build back; **Discard** deletes the copy.
- **No undo after a restore.** The undo history is not kept. You can export or keep editing, but you cannot undo the edits you got back. The file you opened is never changed.
- **When the copy is deleted.** After an export, when you undo every edit, when you discard it, and when you choose to open another file and drop the edits.
- **Where it lives.** In this browser only. A different browser or device does not see it, and clearing the site's data removes it. If the browser blocks storage (some private windows), autosave turns itself off and the panel says so: export to keep your work.

Autosave is for the editor. A page that cannot edit (software renderer) does not offer a restore.

## 7. Your own resource pack or client jar

The **Textures** section tells you what the page is using:

- "Using the texture pack this site provides", if the site has one.
- "No texture pack: blocks are drawn as flat colours", if it has none and you have not added one.
- "Using your pack ...", once you add one.

To use your own, press **Use my own pack** and choose a resource pack (`.zip`) or a Minecraft client `.jar`, or drop the file on the page (the same drop area as in section 1). A file with the extension `.zip` or `.jar` is treated as a pack; any other file as a schematic.

- The page reads these from the pack: block states, block models, block textures, and the chest and banner textures. Everything else is ignored.
- They must be under `assets/minecraft/`, as in any resource pack or client jar. A zip made by zipping a folder, with the folder name in front, works too.
- Your pack is laid over the site's, file by file, the way Minecraft stacks resource packs. A pack with only textures keeps the site's models.
- It is read in your browser and never uploaded. The extracted files (not the zip) are kept in this browser, so the pack is used on later visits. If the browser refuses to store it, the pack works until you reload and the page says so.
- **Replace my pack** swaps it, and **Remove my pack** deletes it.
- If the file is not a zip or jar, or holds no block assets, the page says so. Files inside that are not valid JSON are skipped and counted.

The software renderer (no WebGL2) also uses your pack.

## 8. Known limits

Editing:

- No editing in Fly mode. Switch to Orbit.
- No editing with the software renderer (no WebGL2). Direct touch block placement on the canvas is still in progress (see `docs/mobile-editor-plan.md`).
- Selections are boxes. A drag chooses a box between two blocks, so you cannot select cells in empty air by dragging. Type the corners instead.
- Mirror works east-west and north-south only. There is no vertical mirror.
- Move uses typed offsets or the up and down buttons. There is no drag-to-move.
- Entities are not part of a selection. Block entities and entities are kept, not edited.
- A build cannot be grown past 512 blocks along one axis by editing. The editor refuses the edit. A file that is already more than 512 blocks along an axis is refused when it is opened (section 1).
- The palette shows names only, and it does not know which property values are legal for a block. Values other than true/false are suggestions only.
- Undo history is not kept in the autosave copy.

Files and conversion:

- Export runs on the main thread, so a very large build pauses the page while it is written.
- Java block entities and entities are not translated to Bedrock, and the other way round. They are listed in the loss report.
- Block-state translation between Java and Bedrock covers the families named in section 3, not every block.
- Pending block and fluid ticks are not carried over.

Not yet checked by the project:

- An exported `.litematic` has not been opened in Litematica itself. The project checks it by reading it back with its own reader.
- Whether Minecraft and Litematica read the block entities and entities that were written is also unchecked.
- `.schem` files saved by a real tool (WorldEdit, for example) have not been tested yet. The `.nbt`, `.litematic` and `.mcstructure` samples used for testing came from one web converter.

Drawing:

- There is no level-of-detail or greedy meshing, so very large builds draw more slowly, especially on a computer without a graphics card.
- Translucent faces (glass, water) are ordered by section, not by face, so some overlaps may look wrong.
- Textures are sampled without mipmaps. Animated textures show their first frame.
