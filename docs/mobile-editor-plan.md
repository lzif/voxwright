<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# Mobile-first schematic editor: plan

Nov 7, 2026 · plan only, no code written · base: `main` at `d3a7ef6`

Goal: full editing on a touch-only phone, without taking anything away from desktop mouse-and-keyboard editing. The editing core is already input-independent, so most of the work is a new input layer and a new layout in `apps/web`, plus a few small, additive hooks in `render`. Luki's decisions on the twelve open questions are recorded in section 5 and applied below. One item stays open on purpose: the largest build size a phone must handle smoothly is set from the first real-phone measurement in MB1.

Milestones are named MB1 to MB8 (mobile B-series) so they do not collide with the M0 to M5 of `PLAN.md`. They follow its format: a task list, then an exit criterion that can be tested.

## Progress

| Step                                                       | State                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Plan written (`docs/mobile-editor-plan.md`)                | Done, 2026-11-07                                                  |
| Plan reviewed by Luki                                      | Done, 2026-11-07; decisions recorded in section 5                 |
| Dependency: `vite dev` mesh-worker fix (`server.fs.allow`) | Not started; not part of this plan, blocks phone dev-mode testing |
| MB1 to MB8                                                 | Not started (implementation needs a separate go-ahead)            |
| Mobile editing release                                     | After 0.1.0, as 0.2.0 (decision 12)                               |

## 1. Current-state audit

### What the editor does today

`EditSession` (`apps/web/src/lib/editor-session.svelte.ts`, 824 lines) holds the open `Volume`, core's `Editor`, the chosen tool, block and selection, and turns input into core commands. Panels are Svelte components (`BlockPalette`, `BlockStatePanel`, `SelectionPanel`, `EditToolbar`). Tools: Place, Replace, Erase, Pick, Line, Rectangle, Select, Paste (View is "no tool"). Selection actions: fill, replace A with B, copy, paste, move, rotate, mirror.

### Where mouse and keyboard are assumed

| Where                         | Assumption                                                                                                                                                                                                                                                                                                                                                           | Evidence                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `+page.svelte` ~559           | A device whose only pointer is coarse gets no editor (`canEdit = fine.matches \|\| !coarse.matches`) and the page says "Editing needs a mouse and keyboard". The gate itself must go.                                                                                                                                                                                | `syncPointer`                    |
| `EditSession.onPointerDown`   | `pointerType === "touch"` returns early, so touch always falls through to the renderer's camera. Also `button !== 0`, `shiftKey`, `altKey` hand the drag to the camera.                                                                                                                                                                                              | session ~L278                    |
| `EditSession.onPointerMove`   | Touch moves are ignored for hover; hover (`this.hover`) is the only thing that drives the outline, the ghost block and `inspected`. On touch there is no pointer before the touch, so there is no preview before commit.                                                                                                                                             | `onPointerMove`, `updateHover`   |
| Camera gestures in the editor | Alt+drag turns, Shift+drag or right button pans, wheel zooms. None of these exist on touch.                                                                                                                                                                                                                                                                          | help text in `+page.svelte` ~698 |
| `renderer.ts` ~L806-L880      | The renderer's own handlers already do one-finger orbit and two-finger pinch zoom (`pointerSpread`), but no two-finger pan, and a second finger while a tool drag is in progress would also feed the pinch. It owns `setPointerCapture` for the same canvas. `contextmenu` is already suppressed; the canvas already has `touch-action: none`.                       | `onPointerDown/Move/Up`          |
| Keyboard shortcuts            | `keyAction` in `editing.ts`: Ctrl/Cmd+Z, Shift+Z, Y, C, V; single keys V P B X I L R M F `[` `]`; Esc cancels a drag, clears the selection, or returns to View. Every one of these needs a touch equivalent (button or gesture).                                                                                                                                     | `editing.ts` L116                |
| Hover readout                 | `EditToolbar` shows the position and block "under the pointer" (marked `aria-hidden`).                                                                                                                                                                                                                                                                               | `EditToolbar.svelte`             |
| Block-state panel             | "The block last pointed at" (`inspected` is set by hover). Booleans are a `<select>`; other values are a text input with a `<datalist>`. Datalists and small selects are poor on phones.                                                                                                                                                                             | `BlockStatePanel.svelte`         |
| Palette and layout            | Three columns at >1000px (palette, state and selection panels on the left, canvas in the middle, view aside on the right); one column below 1000px, with the canvas capped at `max-height: 80vh` and the panels stacked under it. On a phone this means the user scrolls away from the canvas to change blocks.                                                      | `.stage.editable`, `canvas` CSS  |
| Fly camera                    | Keys only (`FLY_KEYS`: WASD, arrows, Space/E, C/Q, Shift) plus pointer lock for look. No touch input at all. `session.interactive` already disables tools in Fly.                                                                                                                                                                                                    | `controls.ts`, `renderer.ts`     |
| Selection panel               | Move by typed offsets; fine on desktop, needs the on-screen keyboard on a phone.                                                                                                                                                                                                                                                                                     | `SelectionPanel.svelte`          |
| Small details                 | The file picker `accept=".nbt,.schem,..."` is unreliable on Android (unknown extensions are often greyed out); `beforeunload` is not fired by mobile browsers when a tab is discarded (autosave already listens to `visibilitychange`, which is the right hook). `100vh` and fixed 280px side columns do not account for browser chrome (`dvh`) or safe-area insets. | `+page.svelte`                   |

### What in `core` is already input-independent

All of `packages/core/src/edit/` is DOM-free and takes plain data:

- `raycast(volume, origin, direction, { maxDistance, accept })` (`pick.ts`): a DDA over a `Volume`. It takes any ray; the renderer's `rayFromClient(clientX, clientY)` makes the ray from any client point, so a touch point works unchanged. The `accept` callback already supports the layer slice.
- `Editor`, `Stroke` (one drag = one undo step), `History` (capped by memory, not count), `DirtyTracker`, the command builders (`placeCells`, `eraseCells`, `drawLine`, `drawRectangle`, `fillSelection`, `replaceInSelection`, `copySelection`, `pasteClipboard`, `moveSelection`, `rotateSelection`, `mirrorSelection`, `setBlockProperty`). None reads a device, a key or a button.
- `pickRay` in `controls.ts` is pure and already tested against three.js's own camera.
- `editing.ts` helpers (`clipRayToBox`, `cellOnPlane`, `boxBetween`, `shiftBox`, `normalAxis`, `inSlice`, palette search) are pure and run under Vitest.

### What is not input-independent

Everything that is, is in `apps/web` and `render`:

1. `EditSession`'s pointer, keyboard and hover code (`attach`, `onPointerDown/Move/Up/Leave`, `onKey`, `tick`, `updateHover`, `updateDrag`). The drag state machine (`Drag` union) is already reusable; its triggers are not.
2. The renderer's built-in camera gesture handling (not configurable from outside).
3. The page layout and the panels (CSS and markup).
4. `FlyController` input (keys).

## 2. Mobile-first UX design

Principles: the canvas gets the whole screen; the finger never covers the cell being edited; every edit can be previewed before it is committed; nothing needs the keyboard except searching for a block by name; undo is always in reach.

### 2.1 Layout

- **Full-viewport canvas** in editing mode (`100dvh`, `env(safe-area-inset-*)`), `touch-action: none`, no page scroll while editing, `overscroll-behavior: none`. The status/header/open/pack sections collapse into a top app bar and a menu sheet ("File", "Pack", "View", "Export").
- **Bottom toolbar** (thumb zone), one row, horizontally scrollable if needed, targets at least 48 x 48 CSS px: the tool buttons (Place, Replace, Erase, Pick, Line, Rect, Select; View is the default state when nothing is armed), then the current block swatch/name (opens the palette sheet).
- **Thumb cluster**, bottom corner above the toolbar: Undo, Redo, Confirm (✓) and Cancel (✕) for the pending action in 2.3. Right side by default, with a left-handed toggle at launch (decision 8); the layout is built mirrorable from the start.
- **Bottom sheets** with three snap points (peek, half, full), draggable by a handle, not covering the whole canvas at peek/half: Palette, Block state, Selection actions, View (slicer, Orbit/Fly, render options), Menu. Only one is open at a time. The canvas is resized with the sheet (so the target cell stays visible), or the camera is re-centred on it.
- Desktop: unchanged three-column layout above a width/pointer breakpoint (decision 7: width plus pointer type, with a manual override in the menu; `min-width: 1000px` and `pointer: fine` as starting values). The same components render in both; the sheet is a presentation of the same panel, not a second implementation.

### 2.2 Gesture map

Decided assignments (decision 1: one finger uses the tool, two fingers move the camera):

| Gesture                              | View tool / nothing armed                                                              | Place / Replace / Erase                                                                        | Line / Rect / Select            |
| ------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------- |
| One-finger drag                      | Orbit (as today)                                                                       | Paint stroke (one undo step), following today's "stay on the surface the stroke began on" rule | Move the armed corner (see 2.3) |
| Tap                                  | Inspect the block (shows state sheet chip, selects `inspected`)                        | Arm the cell under the finger (offset cursor, 2.3)                                             | Set corner A, then B            |
| Long press (~450 ms, <8 px movement) | Eyedropper on the cell                                                                 | Eyedropper on the cell (Pick without leaving the tool)                                         | Same                            |
| Two-finger drag                      | Pan                                                                                    | Pan                                                                                            | Pan                             |
| Pinch                                | Zoom                                                                                   | Zoom                                                                                           | Zoom                            |
| Two-finger twist / vertical drag     | Orbit azimuth / tilt (planned; feel tuned in MB2)                                      | same                                                                                           | same                            |
| Two-finger tap                       | Undo (optional setting, off by default)                                                | same                                                                                           | same                            |
| Three-finger tap                     | Redo (optional setting, off by default)                                                | same                                                                                           | same                            |
| Double tap                           | Focus the camera on the tapped cell (planned; this is the Fly replacement, decision 2) | not used                                                                                       | not used                        |

Whichever fingers are down decide the mode for the whole gesture. A second finger arriving during a one-finger tool drag cancels that stroke (`Stroke.cancel()` already reverts and marks dirty), then the gesture becomes a camera gesture; this avoids half-painted strokes. A gesture arbiter (pure module, section 3) holds this state and is tested in Node with synthetic pointer sequences.

### 2.3 Precision placement (fat-finger)

A finger covers about 8-10 mm; one cell on a 256-wide build can be a few pixels. The plan combines three mechanisms, so the user can pick the one that fits:

1. **Offset cursor** (default for Place/Replace/Erase/Line/Rect/Select; a setting offers a confirm step on every placement instead, and the offset, about 64 px by default, is adjustable): on touch-down the target is the cell under a reticle drawn about 64 px above the contact point (shown as the existing `hover` outline plus the ghost block), so the finger does not hide it. Dragging moves the reticle with the finger; lifting commits for a brush tool (one undo step). Dragging the reticle off the top/side of the screen or into the toolbar cancels. A short tap with no movement also commits, at the offset position.
2. **Armed cell + nudge pad** (the precise path, and the typing-free coordinate input): tool actions can be set to "confirm" mode, in which a tap or release only _arms_ a cell and shows a small d-pad: ±X, ±Y, ±Z buttons (screen-relative arrows plus up/down) that move the armed cell one cell, and ✓ / ✕. Line, Rectangle and Select use two armed corners (A then B) and each corner can be nudged; Rectangle keeps the plane of the first face's normal (as `cellOnPlane` does today). This replaces the typed move offsets in `SelectionPanel` with steppers (±1, hold to repeat, ±8 for a longer step), and gives a way to place blocks in places no ray reaches (inside a wall, below the slice).
3. **Zoom-to-target**: a "Zoom in here" button/double-tap that dollies the orbit target onto the armed cell, so cells are many pixels wide. No magnifier lens (decision 6): a second render pass or an offscreen crop doubles the per-frame cost on phones (see section 3), whereas moving the camera is free. It can be revisited if testing shows zoom-to-target is not enough.

The cell readout (position and block) moves to a line above the toolbar and updates for the armed cell. Haptic feedback (`navigator.vibrate`) on commit and cancel where the browser supports it; never required.

### 2.4 Selection on touch

- Select tool: tap A, tap B (or drag a rectangle with the offset cursor); the selection box is then adjustable with **face handles**: six handles drawn on the faces of the box that can be dragged along their axis (or nudged ±1 from the sheet). Corner/face handles need a small extension of the renderer's highlight (extra styles, section 3), or can start as ±1 steppers per face with handles later.
- Selection sheet: Fill, Replace A→B, Copy, Paste, Rotate ↺ ↻, Mirror X/Z, Move (d-pad steppers), Clear. Same functions as `SelectionPanel`.
- Paste: after Copy, the Paste tool shows the ghost box at the armed cell with the nudge pad; ✓ pastes (as `pasteAt` does).
- "Select all" and "Clear selection" are buttons; Esc is replaced by ✕ and by tapping an empty region of the canvas in View.

### 2.5 Block palette and block state on a small screen

- **Palette sheet:** a search field (this is the one place the on-screen keyboard is expected; the sheet follows `visualViewport` so the keyboard does not cover results), then a list with large rows (min 48 px). Above the list: a **hotbar** of recent blocks (last 8) plus favourites, so the common loop is "tap tool, tap hotbar block, tap canvas". The palette is already `paletteEntries(volume.palette, packBlocks)`, so the data stays.
- **Block icons** are optional: a texture-atlas swatch per row would need an icon helper in `render` (reading the atlas the renderer already builds). Decision 9: text rows only for now, icons later. Recent blocks and favourites are saved in browser storage as a per-viewer convenience (try/catch; the editor works without it).
- **Block-state sheet** for `inspected` (on touch: the last tapped/armed cell, not a hover): booleans as toggle switches; enumerated values as segmented chips or steppers (facing, half, shape, axis) built from the suggestions `blockProperties` already returns; free-text entry stays as a fallback ("Other…"). A "Rotate block" shortcut cycles `facing`/`axis` where present. No `<datalist>` on touch.

### 2.6 Undo and redo within thumb reach

Undo and Redo sit in the thumb cluster, always visible while editing, disabled when empty (`canUndo`/`canRedo` exist). A transient toast ("Placed 12 blocks · Undo") with an Undo action appears after each commit for ~4 s. Multi-finger tap shortcuts are an optional setting, off by default (decision 1). Undo history is still not persisted across reloads (decision 10; autosave restores the edits).

### 2.7 Fly mode on touch

Today Fly is keys plus pointer lock; it has no touch input, and tools are disabled in Fly. Decision 2: on a coarse-only device the Fly toggle is hidden, so every touch session is Orbit, and no MB milestone adds Fly input. "Focus on cell" and two-finger pan cover moving around.

## 3. Architecture impact

Dependency rules stay as in `PLAN.md`: `core` has no DOM; `render` has no knowledge of editing; the touch logic is in `apps/web`.

### `packages/core`: nothing required for the first milestones

All editing code is reused as is. Possible small, additive items (each only if a milestone needs it; none is assumed):

- A helper that lists the legal values of a block property (the BlockStatePanel already gets suggestions through `blockProperties`; chips need only the existing data).
- `raycast` runs at ~hundreds of cell steps per call; picking on every pointer move on a phone is fine, but a `maxDistance` bound from the build size (already clipped by `clipRayToBox`) keeps it cheap. No change needed.
- History memory cap (`maxBytes`, default constant `DEFAULT_HISTORY_BYTES`) may be too generous for low-RAM phones; make it configurable from the page (the option already exists, so this is a page-side setting, not a core change).

Untouched: all codecs, `Volume`, `Command`, `History`, `Stroke`, `pick.ts`.

### `packages/render`

Additive only, behind options so the desktop behaviour is byte-for-byte unchanged by default:

- **Input ownership.** The WebGL renderer's built-in pointer, wheel and key handling gets an option (for example `input: "builtin" | "external"`, default `builtin`). With `external`, the renderer attaches no gesture listeners and exposes camera operations as public methods: `orbitBy(dxPx, dyPx)`, `panBy(dxPx, dyPx)`, `zoomBy(factor)`, `focusOn(point, distance?)` (several already exist internally on `OrbitController`: `rotate`, `pan`, `zoom`, `fromPose`). The web app's gesture arbiter then calls them. This fixes the double handling (the renderer and the session both reacting to the same pointer) with one owner per gesture.
- **Picking** needs nothing: `rayFromClient` takes any client point; the offset cursor is just a different point.
- **Highlights:** the offset-cursor reticle can be a DOM overlay (cheap). Face handles for selections need either extra `Box` styles or a small `handles` highlight in `highlight()`. `highlight()` already requests a frame.
- **Frame cost.** Section "Performance" below.
- **Fly:** unchanged (decision 2: hidden on touch).

### `apps/web`

- New pure module `lib/gestures.ts`: a state machine from pointer events (id, type, position, time) to intents (`tap`, `longPress`, `drag-start/move/end`, `twoFingerPan`, `pinch`, `twist`, `multiTap`, `cancel`), with thresholds as constants. No DOM, so it runs under Vitest with synthetic sequences, like `editing.ts`.
- `EditSession` changes: replace the `pointerType === "touch"` early return with a touch input path that feeds the existing `begin/brushTo/updateDrag/onPointerUp`; add an `armed` cell and `confirm()/cancel()`; make `hover` also mean "armed/reticle"; make `inspected` follow taps; add `nudge(axis, step)`. Keyboard handling stays and calls the same methods. `Drag` stays; the arbiter decides whether a drag is a tool drag or a camera gesture.
- Layout: new `BottomToolbar`, `BottomSheet` (snap points, `visualViewport`), `NudgePad`, `ThumbCluster`, `Hotbar`; the existing panels' content is reused inside sheets. `+page.svelte` (834 lines) needs its stage layout and `canEdit` gate rewritten; keep a pointer/width breakpoint to choose layout, plus a manual override.
- Remove the touch-only "viewer" gate; keep the "Editing needs WebGL2" gate (software renderer stays a viewer; see performance).
- Mobile hygiene: `viewport` `viewport-fit=cover`, `interactive-widget=resizes-content`, `touch-action`, `-webkit-touch-callout: none`, `user-select: none` on the canvas and toolbar, `100dvh`, safe-area padding, prevent double-tap zoom on controls, `:focus-visible` kept for accessibility, reduced-motion respected for sheet animation.
- Accessibility: all gesture actions have a button equivalent (nothing is gesture-only); targets at least 44 px (WCAG 2.5.5 target) and 48 px for primary actions; announcements via the existing `aria-live` message line; the existing `contrast.test.ts` is extended to new components' colours.
- File opening: add a visible "Open" menu entry, and consider widening the file input's `accept` (adding `application/octet-stream`) since Android pickers often ignore unknown extensions.

### Performance on phones

Facts we have: the only measurement is software (SwiftShader) rendering, 7 fps for 1.27 M triangles on a 256 x 64 x 256 build, where the main-thread cost of `render` itself is 4.4 ms; meshing is 0.7 ms median per section on workers. A real phone has a GPU, so frame rate is expected to be far better, but it has less memory bandwidth, thermal throttling and a high-DPR screen. This is an expectation until measured on a phone (MB1 produces the first number).

The plan keeps the editor usable by treating performance as a budget with levers, in this order:

1. **Measure first (MB1):** run the existing `perf.ts` approach on the phone and log fps, triangle count, JS heap and time-to-first-frame for the Rafeals_house fixture and the synthetic build, in a debug overlay (`?perf=1`).
2. **Render on demand.** The renderer already draws on request (`requestFrame`), not in a continuous loop; keep it so, because battery matters more on a phone. During a one-finger brush stroke only the dirty sections re-mesh (0.1-5 ms in a worker).
3. **Pixel ratio.** It is currently `min(devicePixelRatio, 2)`; phones commonly have 3. Add a quality setting (auto/high/low) that drops to ratio 1-1.5 and no MSAA while a camera gesture is in progress and restores on idle (dynamic resolution). Antialiasing is already off for software renderers; make it a phone setting too.
4. **Reduce triangle load while moving:** hide translucent buckets or distant sections during a camera gesture (levers that exist as visibility per section); greedy meshing and LOD are known limits in `PLAN.md` and are only taken up if measurement shows the need (not planned now).
5. **Picking cost** is negligible (DDA clipped to the volume bounds), but throttle hover/reticle updates to one pick per animation frame (the session already does, in `schedule/tick`).
6. **Memory:** a typed-array `Volume` for 2 M cells is a few MB; the history cap (`maxBytes`) and the mesh geometry per section are the real consumers on a phone. Set a lower default history cap on coarse devices; report heap in the debug overlay.
7. **Worker count:** default is cores minus one, between 1 and 4; on phones with big.LITTLE cores keep it at 2.
8. **Software fallback stays a viewer** (decision 11): if only SwiftShader/llvmpipe or no WebGL2 exists, editing stays disabled with an explanation, as today (7 fps is not usable for editing, and the CPU renderer is not wired to the editor).
9. **Parsing on the main thread** (408 ms for the 256-wide build on the dev VM, longer on a phone) blocks the UI; moving parsing into a worker is a candidate follow-up, only if MB1's numbers show a freeze over ~1 s.

## 4. Milestones

Each milestone is small and ends with a testable exit criterion. Verification layers:

- **Node/Vitest:** pure modules (`gestures.ts`, `editing.ts` additions, session logic against a fake renderer).
- **Chromium e2e on the dev VM:** the existing `apps/web/test` Playwright-style suites with touch emulation (`hasTouch: true`, `isMobile: true`, a phone viewport such as 390 x 844 at DPR 3) driving real `pointerType: "touch"` events (Playwright's `touchscreen.tap` for single taps; CDP `Input.dispatchTouchEvent` or `Input.synthesizePinchGesture` for drags and two-finger gestures). The VM has no GPU, so these check correctness and layout, not speed.
- **On a real phone:** Luki runs `vite dev` in Termux and opens it in the phone's browser; each milestone lists a short checklist he can run. This is blocked until the `server.fs.allow` fix (see "Dependency").

### MB1: Phone baseline and test harness

- Touch-emulated e2e project (phone viewport, `hasTouch`) added next to the existing suites; a `?perf=1` overlay (fps, triangles, heap, DPR).
- A "phone test" markdown checklist in `docs/` (how to run `vite dev` in Termux, the URL, what to look at).
- No behaviour change to editing.

**Exit criterion:** on the phone the existing viewer opens the Rafeals_house fixture and the overlay shows fps and heap; the numbers are written into this plan or a `docs/` note (first real-phone measurement). The touch e2e opens the page at 390 x 844 and passes the same open/orbit test as desktop.
**Verify:** Chromium e2e with touch emulation on the VM; Luki's Termux run for the numbers.

### MB2: Input ownership and the gesture arbiter

- `renderer` input option (`builtin`/`external`) and public camera methods; the default stays `builtin` so desktop is unchanged.
- `lib/gestures.ts` state machine with unit tests; wired to the renderer in `external` mode on touch only: one-finger orbit, two-finger pan, pinch zoom (the first behaviour change).

**Exit criterion:** on a touch device, one finger orbits, two fingers pan and pinch zooms without drift or jumps; on desktop, the full existing e2e (`e2e.ts`, `editor-suite.ts`, `m4-suite.ts`) still passes unchanged; Vitest covers tap/long-press/drag/pinch/second-finger-cancel sequences.
**Verify:** Vitest sequences, Chromium touch e2e, phone checklist (orbit/pan/zoom feel).

### MB3: Mobile layout shell

- Remove the touch-only viewer gate; full-viewport canvas, top bar, bottom toolbar, thumb cluster (Undo/Redo), bottom-sheet component with snap points; palette, block-state and selection panels placed in sheets; `dvh`, safe-area, `visualViewport` handling for the keyboard.
- Desktop layout kept at the pointer/width breakpoint, with an override.

**Exit criterion:** at 390 x 844 there is no horizontal scroll and no page scroll while editing; every control is at least 44 px; tools can be chosen and the palette sheet opens, searches (with the keyboard open the results stay visible) and sets the block, all by touch; the desktop layout is pixel-identical in the existing screenshots/e2e at 1280 x 800.
**Verify:** Chromium touch e2e with bounding-box assertions (target size, overflow), desktop e2e regression, phone checklist (keyboard + sheet).

### MB4: Touch placement with the offset cursor

- Touch input path in `EditSession` for Place, Replace, Erase, Pick: reticle offset, hover outline and ghost during touch, commit on release, cancel by dragging off; brush strokes as one undo step; second finger cancels the stroke.
- Long press = Pick.

**Exit criterion:** with a touch-only context a tap places one block exactly at the cell under the reticle (not under the finger); a drag paints a stroke that one Undo removes; adding a second finger mid-stroke reverts the stroke; long press picks the block and the palette shows it. The same sequences run on a mouse produce the same results as before.
**Verify:** Vitest (session with a fake renderer and fake ray), Chromium touch e2e (known cell coordinates via the renderer's `clientFromWorld`, as the existing editor suite does), phone checklist.

### MB5: Armed cell, nudge pad and two-point tools

- Confirm mode with ✓ / ✕ and the nudge pad; Line, Rectangle and Select with two corners; selection face steppers; paste ghost with the pad.

**Exit criterion:** a 5-block line, a hollow 4 x 3 rectangle and a 3 x 3 x 3 selection can be made by touch only, with no typing and no mouse, and each is one Undo step; nudging one corner by ±1 changes the result by exactly one cell; results equal the commands built for the same corners via the desktop path.
**Verify:** Vitest comparing command results (cells changed) against core's builders; Chromium touch e2e; phone checklist.

### MB6: Selection actions and block state by touch

- Selection sheet actions (Fill, Replace A→B, Copy, Paste, Rotate, Mirror, Move with steppers); block-state sheet with toggles and chips; hotbar of recent blocks; `inspected` follows taps.

**Exit criterion:** by touch alone: select a box, fill it, copy and paste it elsewhere, rotate it, flip a stairs block's `facing` and an `open` door state through chips/toggles, and export; the exported file round-trips through core's codecs with the same cells as the same edits made on desktop.
**Verify:** Chromium touch e2e with export download compared to a desktop-path export (cell-for-cell, using the existing editor-suite helpers); phone checklist.

### MB7: Phone performance pass

- Dynamic resolution and quality setting, on-demand frames kept, lower history cap on coarse devices, worker count, optional parse-in-worker if MB1 measured a freeze.

**Exit criterion (numbers fixed after MB1's measurement, decision 4; proposed):** on Luki's phone the Rafeals_house fixture orbits at the display refresh rate (or at least 30 fps), and a 256-wide synthetic build stays at 30 fps while idle-edit stroke latency (finger move to block shown) is under 100 ms. If the phone cannot meet the 256-wide target, the plan records the largest build size that does, rather than silently lowering the bar.
**Verify:** `?perf=1` overlay on the phone (numbers recorded in the PR/notes); on the VM only the no-regression check (`perf.ts` software numbers do not get worse than the M1 table).

### MB8: Polish, accessibility and docs

- Toasts with Undo, haptics, left-handed layout, optional multi-finger shortcuts (off by default), tutorial/help rewritten for touch, accessibility pass (screen-reader names, focus order, contrast test extended), README/self-hosting notes updated.

**Exit criterion:** every touch gesture has a button equivalent; the extended contrast test passes; a first-run walkthrough reaches "placed, undone, exported" in under a minute on the phone; the full existing suite and the new touch suite are green in CI (browser tests run in CI only, per `PLAN.md`).
**Verify:** CI, accessibility checks in the e2e (roles/names/sizes), Luki's final phone run.

## 5. Decisions (Luki, 2026-11-07)

Luki chose the recommended option for every question and said iOS does not matter, so iOS is not a target and needs no testing.

| #   | Question                        | Decision                                                                                                                                                         | Effect on the plan                                       |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Gesture conflicts               | One finger uses the armed tool; two fingers pan, pinch and (optionally) orbit. Multi-finger tap shortcuts for undo/redo are an optional setting, off by default. | Section 2.2; MB2, MB4, MB8                               |
| 2   | Fly on touch                    | Hidden on touch devices. Orbit, "focus on cell" and two-finger pan replace it.                                                                                   | Section 2.7; no Fly input work                           |
| 3   | Minimum devices                 | Chrome on Android, recent devices, with WebGL2. No iOS. No RAM floor unless MB1's numbers call for one.                                                          | MB1 checklist and MB7 target use the Termux/Chrome phone |
| 4   | Largest smooth build on a phone | **Open by design:** set from MB1's real-phone measurement, then written into MB7.                                                                                | MB1, MB7                                                 |
| 5   | Precision model                 | Offset cursor by default; a setting switches to a confirm step on every placement; the offset is adjustable (about 64 px to start).                              | Section 2.3; MB4, MB5                                    |
| 6   | Magnifier                       | None. Zoom-to-target only.                                                                                                                                       | Section 2.3                                              |
| 7   | Layout breakpoint               | Width plus pointer type, with a manual override in the menu.                                                                                                     | Section 2.1; MB3                                         |
| 8   | Thumb cluster side              | Right by default, with a left-handed toggle at launch.                                                                                                           | Section 2.1; MB3, MB8                                    |
| 9   | Palette                         | Text rows only for now; recents and favourites persist in browser storage. Icons later.                                                                          | Section 2.5; MB6                                         |
| 10  | Undo history                    | Not persisted across reloads; autosave keeps restoring the edits.                                                                                                | Section 2.6                                              |
| 11  | Software renderer on phones     | Stays a viewer.                                                                                                                                                  | Section 3, performance item 8                            |
| 12  | Release scope                   | 0.1.0 ships first as it is; mobile editing is a later release (0.2.0).                                                                                           | Out of scope below; no change to M4                      |

The only item still waiting is decision 4, which needs data from MB1.

## 6. Explicitly out of scope

- No implementation in this task: this file is the only thing written (plus its `docs/` directory).
- No release: no 0.1.0 version bump, no tag, no npm publish, no npm organization. Mobile editing is planned for a release after 0.1.0 (decision 12), which is also not part of this plan.
- No GitHub Pages deploy.
- No commit or push as part of this plan.
- The mcbuilder port (M5) and the converter are unaffected.
- No new file formats, no multiplayer or cloud sync, no native app wrapper.

### Dependency, not a task

`vite dev` currently fails to load the mesh worker (`server.fs.allow` is missing in `apps/web/vite.config.ts`). Until that is fixed, dev-mode testing on the phone through Termux is blocked, and every "phone checklist" above depends on it. The fix itself is not part of this plan; a production build served statically is the possible workaround, but it was not tried here.
