<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# voxwright: user guide

This guide is for people using the voxwright web app, the browser viewer and editor that accompanies the build engine. It covers opening a Minecraft schematic (often one an AI agent or a script generated), looking at it, inspecting its blocks and block states, fixing details by hand, and exporting it in the format you need. To run your own copy of the site, see [self-hosting.md](self-hosting.md).

Everything runs in your browser. Files you open are read on your machine and are not uploaded.

## Where the app fits in the workflow

Voxwright is first a programmatic Minecraft build engine and an Agent Skill. An agent or a script writes a short recipe for the build engine (`packages/mcbuilder`), which validates the blocks and writes a schematic as `.schem`, `.litematic`, `.nbt` or `.mcstructure`. This app is the human-in-the-loop part of that workflow:

1. An agent or a script produces a schematic.
2. You look at it. Either run the preview command of the skill CLI, `node skills/voxwright/scripts/voxwright-cli.mjs preview <file>` (an agent that has the skill does this for you), which serves the app and the file together and opens the page, or open the page yourself and open the file (section 1).
3. You inspect the build in 3D: block placement, block states, layers (section 2).
4. You fix details by hand with the editor (section 4) or the touch layout (section 5).
5. You export the result in the format Minecraft needs (section 6) and load it into the game.

When the page is served by the preview command, a build can be opened by link with the `?open=` query parameter (the address ends in something like `?open=__preview/house.schem`). The preview command prints the exact link. The file named by `?open=` must come from the same address as the page, and it is opened as if you had dropped it on the page. Because the parameter stays in the address, refreshing the page reloads the file, which shows a rebuilt version of the same file.

You can also use the app on its own, with any schematic from any source: it opens files, converts between the four formats and reports what a conversion could not carry (section 3).

## Contents

1. [Opening a file](#1-opening-a-file)
2. [The viewer](#2-the-viewer)
3. [Converting and the loss report](#3-converting-and-the-loss-report)
4. [The editor](#4-the-editor)
5. [Using a touch screen](#5-using-a-touch-screen)
6. [Exporting](#6-exporting)
7. [Autosave and restore](#7-autosave-and-restore)
8. [Your own resource pack or client jar](#8-your-own-resource-pack-or-client-jar)
9. [Known limits](#9-known-limits)

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

### Touch screens

On a phone or tablet with WebGL2 the page switches to a layout made for fingers, with the same editor behind it: a full-screen picture, a **Menu** button and a **View** button, a bottom toolbar, round buttons for Undo, Redo, the check mark and the cross, and sheets that slide up for the palette, block state and selection. It is described in section 5. Without WebGL2 the page is still a viewer (see above). The **Turn** and **Tilt** sliders and the zoom buttons also exist in the **View** sheet.

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

With a mouse and keyboard, a WebGL2 browser and a file open, the toolbar appears above the picture, and a column of panels appears on its left: the block palette, the block-state panel and the selection panel (which also holds **Block at coordinates**). The editor works in the **Orbit** camera only. This section is about the desktop layout, with a mouse and keyboard; on a phone or tablet the same editor is driven by fingers, as section 5 describes.

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

## 5. Using a touch screen

The page uses the touch layout on a phone or tablet, or whenever the window is narrower than 1000 pixels or **Menu**, **Settings**, **Layout mode** says Mobile. It needs WebGL2, like the editor on a computer. Everything below is also available without a mouse or a keyboard. Section 4 describes the editor itself; this section is how a finger drives it.

### 5.1 The layout

- The **top bar** has the **Menu** button on the left, the file's status in the middle and the **View** button, which opens the View & camera sheet (zoom and centre buttons, **Turn** and **Tilt**, and the layer sliders).
- The **bottom toolbar** has the current block (tap it to open the palette), the tools (View, Place, Replace, Erase, Pick, Line, Rectangle, Select), and the **State** and **Select** buttons that open the Block state and Selection sheets. The tools are 48 pixel buttons; the row scrolls sideways if the screen is narrow.
- The **line above the toolbar** shows the cell and block under the cursor, or what you have begun, and a short message after each action. With a block tapped, **Zoom** and **Edit state ›** sit at its right end.
- The **thumb cluster** (bottom right) has **Undo**, **Redo**, the **cross** (drop what you began) and the **check mark** (apply it). The **nudge pad** appears beside it while something waits for the check mark. With **Left-handed controls** on in the settings, the cluster, the pad, the quick row of blocks and the toast all move to the left side.
- **Sheets** slide up from the bottom for the palette, block state, selection, the view and the menu. Drag the handle to resize a sheet, or tap it (or press Enter on it) to switch between half and full height. The **✕** button, a tap beside the sheet and Esc close it. Only one sheet is open at a time.
- A **toast** with an Undo button appears under the top bar after every edit (section 5.6).

### 5.2 Gestures

What a finger does depends on the tool. One finger **uses the tool** when a tool other than View is chosen, and **turns the picture** with View. Two fingers always move the picture.

| Gesture                      | With View                                                  | With another tool                                           |
| ---------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| One finger, drag             | Turns the picture                                          | Paints a stroke (Place, Replace, Erase) or moves the cursor |
| Tap                          | Outlines the block and shows **Edit state ›** and **Zoom** | Uses the tool once at the cursor, or sets a corner          |
| Double tap                   | Moves the centre of the view to the block and comes closer | Belongs to the tool (the camera does not move)              |
| Long press                   | Chooses the block under the finger                         | Chooses the block under the cursor, and keeps the tool      |
| Two fingers, drag            | Move the picture sideways                                  | The same                                                    |
| Pinch                        | Zoom                                                       | The same                                                    |
| Twist                        | Turns the view like a dial                                 | The same                                                    |
| Two-finger tap (optional)    | Undo                                                       | The same                                                    |
| Three-finger tap (optional)  | Redo                                                       | The same                                                    |
| A finger left after two lift | Keeps turning the picture, without a jump                  | The same; it never paints                                   |

A second finger that lands while a tool is working cancels what the tool began (a stroke is taken back at once) and the two fingers move the picture instead. A two-finger tap during a tool gesture therefore never places anything.

### 5.3 Placing blocks

With **Place**, **Replace**, **Erase** or **Pick** chosen in the bottom toolbar, one finger on the picture does not turn the build. It drives a cursor that sits about 64 pixels above your fingertip (you can change that, see below), so your finger does not cover the block you are aiming at. A ring marks the cursor, and the block under it is outlined (with a ghost block next to it for Place):

- **Tap** applies the tool once at the cursor, as one undo step. Pick chooses the block under the cursor and switches to Place.
- **Drag** paints a stroke along the surface where it began, like the mouse does; lifting the finger ends it, and one **Undo** removes the whole stroke. A drag with Pick only moves the cursor.
- **Long press** chooses the block under the cursor as the current block and keeps the tool you have.
- **A second finger** cancels the stroke at once (the blocks it painted are removed) and the two fingers pan and zoom the view. A finger left down after that does not paint; it keeps turning the build.
- **Sliding the finger onto the bottom toolbar, the Undo and Redo buttons or a sheet, or sliding the cursor off the top or a side of the picture,** cancels the stroke the same way.

Choose **View** to turn the build with one finger again. The line above the toolbar says "place done" (or "erase done", and so on) after each edit; **Undo** is in the thumb cluster.

### 5.4 Lines, rectangles, selections and the nudge pad

**Line**, **Rectangle** and **Select** take two corners. Nothing changes until you confirm:

- **Tap** a block: that sets corner **A** (Line and Rectangle use the cell next to the face you tapped, Select the block itself). The corner is outlined in yellow and the **nudge pad** appears next to the thumb cluster. **Tap** again: that sets corner **B**, and the result is previewed (a green box for a line or a rectangle, the blue selection box for Select). A rectangle's B is the cell under the cursor on A's plane, so it can be over empty space. Later taps move the corner that is active.
- **Drag** one finger to move the active corner with the cursor, live; lifting leaves it there. A drag before corner A exists sets A where you lift. A second finger puts the corner back where it was before the drag, and the two fingers pan and zoom the view as always; the line, rectangle or selection you began stays, even after you pinch, pan or turn the view.
- The **check mark** in the thumb cluster draws the line or rectangle (one **Undo** removes it) or makes the selection ("Selected 3 × 3 × 3"). With only corner A set it uses one block. The **cross** drops everything and changes nothing (Select goes back to the selection you had before corner A). Both are greyed out while nothing is pending. Choosing another tool, **Undo** or **Redo** also drops what you began.
- The **line above the toolbar** shows the corners and the size, for example `A 6,8,3 ▸B 10,8,6 · 5×1×4` (the arrow marks the active corner), and the message next to it says what just happened.

**The nudge pad.** Four arrows move the active corner one block along the ground the way they point on the screen (left, right, away from you, toward you), **Up** and **Down** move it one layer, and the **A B** button in the middle switches the corner the pad moves (the active letter is highlighted). Hold a button to repeat it (after about half a second, then ten times a second). With a rectangle, **Up** and **Down** move the whole rectangle one layer, and a **Hollow** button turns the hollow setting on and off. A move that would leave the visible layers, or make the build longer than 512 blocks, is refused with a message and nothing moves. The arrows follow the view: turn the view and "right" is still the way the screen's right points (when the view is exactly diagonal, "away" is along z and "right" along x). With **Left-handed controls** on, the pad and the thumb cluster move to the left side. The **Zoom** button in the bottom-left corner of the pad ("Zoom to the armed cell") brings the camera closer to the cell you are working on: it centres the view on the armed cell, the paste origin or the active corner (corner A while B is not set) and halves the distance to it, to no less than 4 blocks. It changes nothing pending, so you can zoom, nudge the cell by a block, and zoom again; the message line says "Zoomed in on 6, 1, 7".

**Confirm each placement.** In **Menu**, **Settings**, turn on **Confirm each placement** (kept in this browser, off at the start). Then **Place**, **Replace** and **Erase** no longer act on a tap: a tap, or lifting the finger at the end of a drag, arms the cell under the cursor (a drag paints nothing), the nudge pad can move it, and the check mark applies the tool to that one cell (one **Undo** step). The cross drops it. **Pick** is not affected.

**Paste.** After **Copy** in the Selection sheet, **Paste** there chooses the Paste tool and closes the sheet, so the picture is free for the tap. A tap arms the paste origin and draws the copied box as a green ghost; the nudge pad moves it; the check mark pastes (one **Undo** step; the "leave the target alone where there is air" setting applies), the cross cancels.

### 5.5 Sheets: block state, selection and blocks

**Looking at a block's state.** With **View**, a short tap on a block (not a drag, and not a long press) outlines it and shows an **Edit state ›** button at the right end of the line above the toolbar, next to the block's name and position. A tap on empty space clears both. With any other tool, the block you last tapped, armed or set a corner on is the one the button refers to. The button opens the **Block state** sheet (the **State** button in the toolbar opens the same sheet). The sheet covers the line above the toolbar, so it shows its own message line at the top ("set facing=north: 1 block changed").

**The Block state sheet on a touch screen.** Each property of the block has the control that fits its values; every tap applies at once and is one **Undo** step:

- A true / false property (`open`, `waterlogged`, `powered`, `lit`, ...) is a **switch**: tap to flip it.
- A property with a few named values (`facing`, `half`, `shape`, `axis`, `type`, `hinge`, ...) is a row of **chips**, the current value pressed; long lists wrap onto more lines. Tapping the chip that is already pressed does nothing.
- A number is a **stepper** (minus, the value, plus) when the property has many values (`rotation` and `power` run from 0 to 15 and stop at both ends); a number whose range is not known (`age`, `level`, ...) steps up from 0 with no top, since the editor cannot know where it ends. A number with eight values or fewer would be chips.
- **Rotate block** turns a block clockwise: `facing` goes north, east, south, west and north again; `axis` goes x, y, z and x again. A block that faces up or down, or has neither property, has no such button.
- **Other…** opens a text field for every property (any value can be typed) and a row to add a property that the block does not have yet. The field applies when you leave it.

**The Selection sheet on a touch screen.** Fill, Replace, Rotate ↺ ↻, Mirror E–W and N–S, Move, Copy, Paste, Select all and Clear are all buttons of at least 44 px. **Replace** takes the block to replace from the text field, or from **Use inspected block**, which copies the block you last tapped. **Copy** says how many blocks it copied. **Move** is a pad of six arrows (the four ground directions as the screen shows them, **Up** and **Down**): each press moves the selected blocks one block and is one **Undo** step; hold a button to repeat it (each repeat is a step too); **×8** makes a step eight blocks. The typed block position and the typed selection corners are at the bottom of the sheet, for the rare case that needs them.

**Selection steppers.** Open the **Selection** sheet (the **Select** button in the bottom toolbar) while a selection exists. Under its size, each of the six faces has **+1** (one more layer on that side) and **−1** (one layer less): **West** and **East** (the x faces), **Bottom** and **Top** (y), **North** and **South** (z). A selection cannot get smaller than one block in any direction, cannot grow outside the visible layers, and is at most 512 blocks long. These are not undo steps; a selection is not an edit.

**Recent blocks and favourites.** The palette sheet has a row of chips above its search field: the blocks you starred (with a ★), then the last eight you chose, newest first. Tap a chip to choose that block; the sheet stays open. Every block in the list has a star on its right: tap it to add the block to your favourites (up to 32) or to remove it. A block counts as chosen when you tap it in the palette, tap a chip, pick it with **Pick**, or long press it. Whenever the row has something in it, the same chips are also shown in one row above the line over the toolbar (hidden while a corner or armed cell waits for confirmation, and while a sheet is open); it scrolls sideways inside itself. Both lists are kept in this browser only.

### 5.6 Moving the view, and the undo toast

**Getting closer, and turning the view with two fingers.** With the **View** tool, **double tap** a block (two quick taps, the second within about 0.3 seconds of the first and within about 24 pixels of it): the centre of the view moves onto that block and the camera comes half as close, down to 4 blocks away and no further, so a few double taps in a row bring a small detail up close. The first tap still outlines the block as a single tap does. A double tap on empty space does nothing, and a double tap with any other tool belongs to that tool (it never moves the camera). **Twist two fingers** like a dial to turn the view: the build turns the way your fingers turn (clockwise fingers, clockwise build, seen from above). Nothing moves until the twist passes about 10 degrees, which keeps a plain pinch or pan from turning the view by accident; after that the view follows every further turn of your fingers one for one, so it stays about 10 degrees behind them (it never jumps to catch up), and the pinch and the two-finger pan keep working during the same gesture. Moving two fingers up and down still pans the build, and the tilt is on the **Tilt** slider. If the twist gets in your way, turn off **Twist with two fingers to turn** in **Menu**, **Settings** (it is on at the start and kept in this browser).

**Zoom, and the centre of the build.** After you tap a block, the **Zoom** button in the line above the toolbar does what a double tap does (and with any tool, not only View): the centre of the view moves onto the block and the camera comes half as close, to no less than 4 blocks. The **View** button in the top bar has **Centre on the build**, which puts the centre of the view back on the middle of the whole build at a distance that fits it (the turn and the tilt stay), the way to get back after moving the picture away. It is the button for the two-finger move, together with Zoom.

**The undo toast.** After every edit that adds an undo step (a tap, a stroke, a confirmed line, rectangle or paste, a fill, replace, move, rotate or mirror, a change of block state) a small bar under the top bar says what happened and how many blocks: "Placed 12 blocks", "Erased 1 block", "Filled 27 blocks", "Drew a line of 5 blocks". Its **Undo** button takes back exactly that step. The bar goes away after about four seconds; it also goes as soon as you edit again (the new edit gets its own bar), or undo or redo by any other means, because then its step is no longer the newest. Screen readers announce the words without moving the focus, and the bar does not slide in if the system asks for less motion. It stays clear of the thumb cluster, the nudge pad, the line above the toolbar and the toolbar.

**Vibration.** Where the browser allows it, the phone buzzes for a moment when an edit is made and for a little longer when something is cancelled or refused (a stroke taken back by a second finger, the cross, a nudge that is not allowed). Nothing depends on it; turn it off with **Vibrate on edits**.

### 5.7 Settings

All of these are in **Menu**, **Settings**, apply at once and are kept in this browser only.

| Setting                        | Choices                 | At the start | What it does                                                                                |
| ------------------------------ | ----------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| Layout mode                    | Auto, Mobile, Desktop   | Auto         | Auto picks the touch layout for narrow windows and touch-only devices; the others force one |
| Left-handed controls           | on, off                 | off          | Mirrors the thumb cluster, the nudge pad, the quick row of blocks and the toast             |
| Confirm each placement         | on, off                 | off          | Place, Replace and Erase arm a cell and wait for the check mark                             |
| Twist with two fingers to turn | on, off                 | on           | A two-finger twist turns the view                                                           |
| Vibrate on edits               | on, off                 | on           | A short buzz on an edit, a longer one on a cancel or a refusal                              |
| Two-finger tap undoes          | on, off                 | off          | A quick tap with two fingers is Undo                                                        |
| Three-finger tap redoes        | on, off                 | off          | A quick tap with three fingers is Redo                                                      |
| Quality                        | Auto, High, Low         | Auto         | How sharp the picture is drawn, and whether it is less sharp while it moves                 |
| Cursor distance                | 0 to 128 px, steps of 8 | 64 px        | How far above the fingertip the cursor sits; 0 puts it under the finger                     |

Also kept in this browser: the recent and starred blocks, and whether you have seen the quick start card. There is also a **Help** text in the menu that sums up this section, and **Show tips** (section 5.8).

**Quality.** In the **Menu** sheet, under **Settings**, **Quality** has three choices (kept in this browser, Auto at the start) for a phone that struggles with a big build. **Auto** draws sharp when the picture is still and at a lower resolution (one pixel per screen pixel instead of up to two) while you turn, pan, zoom or twist it with your fingers; the picture goes sharp again about a fifth of a second after you stop, even if your fingers stay on the glass. **High** always draws sharp. **Low** always draws at the lower resolution and without anti-aliasing (the smoothing of jagged edges), which is the lightest on a slow phone. The resolution changes at once when you choose. Anti-aliasing is fixed when the page loads, so changing to or from **Low** shows a note, and the smoothing changes the next time you open the page. On a phone or tablet with only a touchscreen the editor also uses at most two background workers for building the picture and keeps the last 16 MB of undo steps (a mouse and keyboard machine keeps the larger default, 64 MB, so the oldest undo steps of a very large edit go sooner on a phone).

### 5.8 The quick start card

The first time you open a file in the touch layout, a small card under the top bar lists three steps, and each one ticks itself when you do it: **Choose Place and tap the picture**, **Tap Undo** and **Open Menu and Export**. The card has no backdrop and does not cover the buttons it mentions, so you can use the picture while it is there. It closes when all three steps are done, or when you press its **✕** button, and then it does not come back. **Menu**, **Help**, **Show tips** shows it again with every step to do. A person who has the steps in mind can place a block, undo it and export in under a minute.

### 5.9 Every gesture has a button

| Gesture                                | Button that does the same                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| One-finger orbit, the finger left down | **Turn** and **Tilt** sliders in the **View** sheet (top bar)                                          |
| Twist                                  | The **Turn** slider                                                                                    |
| Pinch                                  | **Zoom in** and **Zoom out** in the same place                                                         |
| Two-finger move                        | **Centre on the build** in the same place, and **Zoom** beside the block in the line above the toolbar |
| Double tap                             | **Zoom** beside the block in the line above the toolbar (works with any tool)                          |
| Long press                             | The **Pick** tool                                                                                      |
| Tap on a block in View                 | The **Edit state ›** button after a tap; the **State** button in the toolbar                           |
| Two-finger tap                         | The **Undo** button (or the toast's)                                                                   |
| Three-finger tap                       | The **Redo** button                                                                                    |
| Dragging a corner                      | The arrows of the nudge pad                                                                            |
| Holding a pad button to repeat         | Pressing it again; **×8** on the move pad takes eight blocks a step                                    |
| Dragging a sheet                       | Tapping its handle (or Enter on it), and its **✕** button                                              |
| Tap on empty space beside the sheet    | The **✕** button                                                                                       |

Every button is at least 44 pixels square (48 pixels for the main ones), has a name for screen readers and can be reached with the Tab key in the order it appears on the screen.

## 6. Exporting

In the editor, the side panel's conversion section is called **Export**, and the button **Export and download**. It writes the build as it is now, edits included, to a new file in the format you chose. The text under the button says how many edits are included.

- The file you opened is never changed.
- With edits, the download is named `<name>-edited.<extension>`. Without edits it is `<name>.<extension>`.
- The loss report appears as for any conversion (see section 3).
- Export runs on the main thread, so the page pauses while a very large build is encoded.
- After an export, the autosave copy is deleted (see section 7).

## 7. Autosave and restore

While you have unexported edits, the page copies the volume into the browser's own storage (IndexedDB). It writes a few seconds after your last change (about 2 s), at the latest every 8 s while changes keep coming, and when the tab is hidden. The **Autosave** section of the side panel says what is happening: "Saved in this browser at ...", or a warning if the storage is full or unavailable.

There is one slot: the build you are editing.

- **Restore.** The next time you open the page, a dialog titled "Restore your unsaved work?" shows the file name, when it was saved and the number of edits. **Restore** loads the build back; **Discard** deletes the copy.
- **No undo after a restore.** The undo history is not kept. You can export or keep editing, but you cannot undo the edits you got back. The file you opened is never changed.
- **When the copy is deleted.** After an export, when you undo every edit, when you discard it, and when you choose to open another file and drop the edits.
- **Where it lives.** In this browser only. A different browser or device does not see it, and clearing the site's data removes it. If the browser blocks storage (some private windows), autosave turns itself off and the panel says so: export to keep your work.

Autosave is for the editor. A page that cannot edit (software renderer) does not offer a restore.

## 8. Your own resource pack or client jar

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

## 9. Known limits

Editing:

- No editing in Fly mode. Switch to Orbit.
- No editing with the software renderer (no WebGL2). On a touch screen every tool except View works through the offset cursor (section 5); the palette has recent blocks and favourites, text only, with no block pictures yet.
- The touch editor has been tried only in an emulated phone so far, not on a real one. How large a build it handles smoothly on a phone is not known yet and is the one open question of the touch plan (`docs/mobile-editor-plan.md`). The page reads a file on its main thread, so a large file freezes it for a moment, longer on a phone than the 0.4 s of the development machine.
- Undo history is not kept when you close the tab (the autosave restores the edits, not the undo steps).
- Selections are boxes. A drag chooses a box between two blocks, so you cannot select cells in empty air by dragging. Type the corners instead.
- Mirror works east-west and north-south only. There is no vertical mirror.
- Move uses typed offsets or the up and down buttons (on a touch screen, the move pad). There is no drag-to-move.
- Entities are not part of a selection. Block entities and entities are kept, not edited.
- A build cannot be grown past 512 blocks along one axis by editing. The editor refuses the edit. A file that is already more than 512 blocks along an axis is refused when it is opened (section 1).
- The palette shows names only, and it does not know which property values are legal for a block. Values other than true/false are suggestions only.
- Undo history is not kept in the autosave copy.

Files and conversion:

- Export runs on the main thread, so a very large build pauses the page while it is written.
- Java block entities and entities are not translated to Bedrock, and the other way round. They are listed in the loss report.
- Block-state translation between Java and Bedrock covers the families named in section 3, not every block.
- Pending block and fluid ticks are not carried over.

Not yet checked by the project, or checked by hand only:

- An exported `.litematic` was opened in Litematica itself by the project's owner, by hand, on 2026-11-11. That was one manual check; the project's tests do not run Litematica and check the file by reading it back with their own reader.
- Whether Minecraft and Litematica read the block entities and entities that were written is also unchecked.
- `.schem` files saved by a real tool (WorldEdit, for example) have not been tested yet. The `.nbt`, `.litematic` and `.mcstructure` samples used for testing came from one web converter.

Drawing:

- There is no level-of-detail or greedy meshing, so very large builds draw more slowly, especially on a computer without a graphics card.
- Translucent faces (glass, water) are ordered by section, not by face, so some overlaps may look wrong.
- Textures are sampled without mipmaps. Animated textures show their first frame.
