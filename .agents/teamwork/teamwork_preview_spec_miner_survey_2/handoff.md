# Specification Mining & Formalization Report: Milestones MB5–MB8

**Author**: `teamwork_preview_spec_miner_survey_2`  
**Date**: 2026-11-07  
**Working Directory**: `/home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_spec_miner_survey_2/`  
**Authoritative Plan**: `docs/mobile-editor-plan.md` (base `main` at `d3a7ef6`)  
**Scope**: Milestone MB5 (Armed Cell, Nudge Pad & Two-Point Tools), Milestone MB6 (Selection Actions & Block State by Touch), Milestone MB7 (Phone Performance Pass), Milestone MB8 (Polish, Accessibility & Docs)

---

## 1. Observation

Direct observations from authoritative specifications and existing codebase implementations:

1. **Plan & Milestone Scope (`docs/mobile-editor-plan.md`)**:
   - **MB5 Scope (lines 214–220)**: "Confirm mode with ✓ / ✕ and the nudge pad; Line, Rectangle and Select with two corners; selection face steppers; paste ghost with the pad."
     - _Exit criterion_: "a 5-block line, a hollow 4 x 3 rectangle and a 3 x 3 x 3 selection can be made by touch only, with no typing and no mouse, and each is one Undo step; nudging one corner by ±1 changes the result by exactly one cell; results equal the commands built for the same corners via the desktop path."
     - _Verification_: "Vitest comparing command results (cells changed) against core's builders; Chromium touch e2e; phone checklist."
   - **MB6 Scope (lines 222–227)**: "Selection sheet actions (Fill, Replace A→B, Copy, Paste, Rotate, Mirror, Move with steppers); block-state sheet with toggles and chips; hotbar of recent blocks; `inspected` follows taps."
     - _Exit criterion_: "by touch alone: select a box, fill it, copy and paste it elsewhere, rotate it, flip a stairs block's `facing` and an `open` door state through chips/toggles, and export; the exported file round-trips through core's codecs with the same cells as the same edits made on desktop."
     - _Verification_: "Chromium touch e2e with export download compared to a desktop-path export (cell-for-cell, using the existing editor-suite helpers); phone checklist."
   - **MB7 Scope (lines 228–234)**: "Dynamic resolution and quality setting, on-demand frames kept, lower history cap on coarse devices, worker count, optional parse-in-worker if MB1 measured a freeze."
     - _Exit criterion_: "on Luki's phone the Rafeals_house fixture orbits at the display refresh rate (or at least 30 fps), and a 256-wide synthetic build stays at 30 fps while idle-edit stroke latency (finger move to block shown) is under 100 ms. If the phone cannot meet the 256-wide target, the plan records the largest build size that does, rather than silently lowering the bar."
     - _Verification_: "`?perf=1` overlay on the phone (numbers recorded in the PR/notes); on the VM only the no-regression check (`perf.ts` software numbers do not get worse than the M1 table)."
   - **MB8 Scope (lines 235–241)**: "Toasts with Undo, haptics, left-handed layout, optional multi-finger shortcuts (off by default), tutorial/help rewritten for touch, accessibility pass (screen-reader names, focus order, contrast test extended), README/self-hosting notes updated."
     - _Exit criterion_: "every touch gesture has a button equivalent; the extended contrast test passes; a first-run walkthrough reaches 'placed, undone, exported' in under a minute on the phone; the full existing suite and the new touch suite are green in CI (browser tests run in CI only, per `PLAN.md`)."
     - _Verification_: "CI, accessibility checks in the e2e (roles/names/sizes), Luki's final phone run."

2. **UX Design Cross-References (`docs/mobile-editor-plan.md`)**:
   - **Section 2.3 Precision Placement (lines 92–102)**: "Tool actions can be set to 'confirm' mode, in which a tap or release only _arms_ a cell and shows a small d-pad: ±X, ±Y, ±Z buttons (screen-relative arrows plus up/down) that move the armed cell one cell, and ✓ / ✕. Line, Rectangle and Select use two armed corners (A then B) and each corner can be nudged; Rectangle keeps the plane of the first face's normal (as `cellOnPlane` does today). This replaces the typed move offsets in `SelectionPanel` with steppers (±1, hold to repeat, ±8 for a longer step), and gives a way to place blocks in places no ray reaches (inside a wall, below the slice)."
   - **Section 2.4 Selection on Touch (lines 102–108)**: "Select tool: tap A, tap B (or drag a rectangle with the offset cursor); the selection box is then adjustable with face handles: six handles drawn on the faces of the box that can be dragged along their axis (or nudged ±1 from the sheet). Corner/face handles need a small extension of the renderer's highlight (extra styles, section 3), or can start as ±1 steppers per face with handles later." Selection sheet includes: Fill, Replace A→B, Copy, Paste, Rotate ↺ ↻, Mirror X/Z, Move (d-pad steppers), Clear. Paste shows ghost box at armed cell with nudge pad; ✓ pastes.
   - **Section 2.5 Block Palette & State (lines 109–114)**: "Hotbar of recent blocks (last 8) plus favourites... Recent blocks and favourites are saved in browser storage as a per-viewer convenience (try/catch; the editor works without it)." Block-state sheet for `inspected` (follows tapped/armed cell): booleans as toggle switches, enumerated values as segmented chips or steppers (facing, half, shape, axis) from `blockProperties`, free-text fallback ("Other…"), "Rotate block" shortcut cycling `facing`/`axis`.
   - **Section 2.6 Undo & Redo (lines 115–118)**: Undo/Redo in thumb cluster. Transient toast ("Placed 12 blocks · Undo") with Undo action for ~4 s. Multi-finger tap shortcuts (2-finger tap undo, 3-finger tap redo) optional setting, off by default (decision 1). Undo history not persisted across reloads (decision 10).

3. **Architecture Impact (`docs/mobile-editor-plan.md`, Section 3)**:
   - `packages/core`: No DOM, pure data functions (`drawLine`, `drawRectangle`, `boxBetween`, `shiftBox`, `cellOnPlane`, `normalAxis`, `linePoints`, `blockProperties`, `setBlockProperty`, `copySelection`, `pasteClipboard`, `fillSelection`, `replaceInSelection`, `rotateSelection`, `mirrorSelection`, `moveSelection`, `History`).
   - `packages/render`: Additive options behind flags (`builtin` vs `external` input mode, dynamic resolution ratio 1–1.5 during gestures, antialiasing options, `highlight()` extended for face handles or ghost markers).
   - `apps/web`: `EditSession` maintains `armed`, `inspected`, `confirm()`, `cancel()`, `nudge()`; components for `NudgePad`, `ThumbCluster`, `BottomSheet`, `Hotbar`, `Toast`; mobile hygiene and accessibility (WCAG 2.5.5 touch target sizes >= 44x44 px, primary >= 48x48 px).

4. **Authoritative Decisions (`docs/mobile-editor-plan.md`, Section 5)**:
   - Decision 1: One finger uses armed tool, two fingers camera (pan/zoom/orbit). Multi-finger tap shortcuts optional, off by default.
   - Decision 2: Fly mode hidden on touch devices.
   - Decision 3: Chrome on Android, recent devices with WebGL2. No iOS.
   - Decision 4: Largest smooth build on phone open by design, calibrated from MB1.
   - Decision 5: Offset cursor default; setting offers confirm step on every placement; adjustable offset (~64 px).
   - Decision 6: No magnifier lens; zoom-to-target only.
   - Decision 8: Thumb cluster right by default, with left-handed toggle at launch.
   - Decision 9: Palette text rows only for now; recents/favourites persist in browser storage; icons later.
   - Decision 10: Undo history not persisted across reloads; autosave keeps restoring edits.
   - Decision 11: Software renderer on phones stays viewer.

---

## 2. Logic Chain

1. **Progression from MB1–MB4 to MB5**:
   - Milestones MB1–MB4 establish the mobile test harness, input arbiter (`lib/gestures.ts`), layout shell (`BottomToolbar`, `BottomSheet`, `ThumbCluster`), and basic touch placement via the offset cursor.
   - However, single-finger direct touch / offset brushing cannot handle two-point geometric tools (Line, Rectangle, 3D Box Selection) or precision adjustments in occluded regions (inside walls, under slice planes).
   - Therefore, MB5 introduces the discrete **Armed Cell** state machine, **Nudge Pad** (d-pad coordinate steppers along screen-relative and world axes ±X, ±Y, ±Z), explicit **Confirm (✓) / Cancel (✕)** lifecycle, two-point modal selection (corner A -> corner B), and bounding box face steppers.

2. **Progression from MB5 to MB6**:
   - Once precision bounding boxes and armed coordinates can be placed and adjusted via MB5, complex manipulation operations become possible on touch.
   - MB6 adapts desktop panel operations into touch-native bottom sheets: `SelectionPanel` operations (Fill, Replace A→B, Copy, Paste, Rotate CW/CCW, Mirror X/Z, Move) are refactored to use d-pad steppers instead of desktop keyboard number inputs.
   - `BlockStatePanel` is refactored from desktop `<datalist>` and tiny `<select>` elements into touch-accessible segmented chips, boolean toggle switches, and a "Rotate block" button cycling directional properties (`facing`, `axis`).
   - A `Hotbar` component caching the 8 most recent blocks and user favourites is added above the palette to streamline the common touch authoring cycle.

3. **Progression from MB6 to MB7**:
   - Complex touch editing on high-DPR mobile devices (DPR 2.5–3.5) with thermal limitations risks dropped frames during camera manipulation and high battery drain during stroke meshing.
   - MB7 introduces performance optimizations: Dynamic resolution scaling (lowering DPR to 1.0–1.5 during orbit/pan/zoom and disabling MSAA while moving), on-demand requestFrame throttling, worker pool clamp to 2 workers for mobile big.LITTLE architectures, lower history memory cap on mobile devices (e.g., 16/32 MiB instead of desktop 64 MiB), and optional off-main-thread schematic parsing if MB1 benchmark thresholds exceed 1 second.

4. **Progression from MB7 to MB8**:
   - With performance within budget and full feature parity established, MB8 delivers final UX polish, ergonomics, and accessibility compliance.
   - Adds transient commit toasts with an embedded 4-second Undo button; haptic feedback (`navigator.vibrate`) on commit/cancel; a left-handed layout toggle (mirroring the thumb cluster and toolbar); optional 2-finger / 3-finger tap shortcuts; a revised touch-first tutorial walkthrough; and accessibility verification (WCAG 2.5.5 target sizes >= 44 px, screen reader labels, keyboard/switch access, and extended `contrast.test.ts` for all new UI components).

---

## 3. Features Discovered

| #   | Category         | Feature                                         | Description                                                                                                                                                                           | Inputs                                                                             | Outputs                                                                                          | Error Behavior                                                                                          | Discovered Via                                                          |
| --- | ---------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | MB5: Precision   | Armed Cell State & Lifecycle                    | Explicit modal state where a cell coordinate is held as `armed` before committing or cancelling. Supported in both direct touch confirm mode and two-point tools.                     | Tap/release on canvas or coordinate input; Confirm (✓) or Cancel (✕) button events | `armed: Vec3 \| null`, active ghost highlight at armed position, cell readout update             | If clicked outside volume bounds, armed remains null or retains previous valid state                    | `docs/mobile-editor-plan.md` §2.3, §4.5                                 |
| 2   | MB5: Precision   | Nudge Pad (D-Pad Steppers)                      | Touch-accessible on-screen d-pad offering ±X, ±Y, ±Z stepped translation buttons (screen-relative horizontal/vertical + up/down depth) for the currently armed cell or active corner. | Button click or touch hold (repeat at ±1, rapid step ±8)                           | Mutated coordinate `armed = [x±d, y±d, z±d]`, ghost highlight shifted                            | Clamped to volume bounds or slice limits if slice active; bounds warning in status line                 | `docs/mobile-editor-plan.md` §2.3, §4.5                                 |
| 3   | MB5: Two-Point   | Two-Point Line Tool                             | Allows constructing straight 3D Bresenham lines by setting armed corner A, nudging/dragging to corner B, and committing as a single atomic Undo step.                                 | Corner A tap, Corner B tap, nudge pad deltas, Confirm (✓)                          | Core `drawLine(volume, a, b, block)` executed; single undo step pushed to History                | Rejects non-integer coords or slice violations (`inSlice(slice, y)`); surfaces error in `session.error` | `docs/mobile-editor-plan.md` §2.3, §4.5; `tools.ts:98`                  |
| 4   | MB5: Two-Point   | Two-Point Rectangle Tool                        | Draws flat 2D rectangle along the normal plane established by initial surface contact, allowing corner nudging with constraint preservation.                                          | Initial touch face normal, corner A & B taps, nudge deltas, Confirm (✓)            | Core `drawRectangle(volume, a, b, block, { normal, hollow })` executed; single undo step         | Rejects out-of-slice coordinates; surfaces errors via `session.error`                                   | `docs/mobile-editor-plan.md` §2.3, §4.5; `tools.ts:121`                 |
| 5   | MB5: Two-Point   | Two-Point Box Selection                         | Modal selection creation: tap corner A, tap corner B (or drag), showing bounding box highlight with active corner switching.                                                          | Corner A tap, corner B tap, nudge pad movements                                    | `session.selection = boxBetween(a, b)`, selection box highlight updated                          | Invalid box or unplaced space resets or collapses gracefully to 1x1x1 box                               | `docs/mobile-editor-plan.md` §2.4, §4.5; `editing.ts:345`               |
| 6   | MB5: Selection   | Selection Face Steppers                         | Steppers (±1, ±8) or 6 directional face handles enabling single-cell adjustments of each face of an active 3D selection box without typing.                                           | Face selection / axis button click (±X, ±Y, ±Z per min/max face)                   | `session.selection` updated (`makeBox(min, max)`), selection outline refreshed                   | Disallows min > max inversion; automatically normalizes via `makeBox`                                   | `docs/mobile-editor-plan.md` §2.4, §4.5; `SelectionPanel.svelte:32`     |
| 7   | MB5: Clipboard   | Paste Ghost with Nudge Pad                      | When Paste tool is active, renders ghost bounding box at the armed target cell; user can nudge in 3D before tapping Confirm (✓).                                                      | Clipboard buffer, armed anchor point, nudge pad deltas, Confirm (✓)                | `pasteClipboard(volume, clip, at, { skipAir })` executed; selection set to pasted bounding box   | If clipboard is empty, paste tool disabled with message "Nothing copied yet"                            | `docs/mobile-editor-plan.md` §2.4, §4.5; `editor-session.svelte.ts:723` |
| 8   | MB6: Selection   | Touch Selection Bottom Sheet                    | Bottom sheet presentation of `SelectionPanel` with three snap points (peek, half, full), housing touch-friendly action buttons.                                                       | Sheet drag handle, swipe gesture, or bottom toolbar action trigger                 | Presentation mode of selection controls without occluding target canvas cell                     | Sheet follows `visualViewport` on resize; does not cover canvas at peek/half                            | `docs/mobile-editor-plan.md` §2.1, §2.4, §4.6                           |
| 9   | MB6: Selection   | Selection Transformation Actions                | One-touch buttons for Rotate ↺ (CCW 90°), Rotate ↻ (CW 90°), Mirror E–W (X), Mirror N–S (Z), and Move with d-pad steppers.                                                            | Action button taps in Selection Sheet                                              | Commands `rotateSelection`, `mirrorSelection`, `moveSelection` executed; single undo step        | If no selection exists, displays "Select blocks first"; error shown in `session.error`                  | `docs/mobile-editor-plan.md` §2.4, §4.6; `editor-session.svelte.ts:683` |
| 10  | MB6: Selection   | Selection Modification Actions                  | Touch triggers for Fill (with `onlyEmpty` toggle) and Replace A→B (with "Pointed-at" picker and search).                                                                              | Fill button, Replace button, input block state                                     | Commands `fillSelection`, `replaceInSelection` executed; single undo step                        | Missing target block triggers "Say which block to replace"; syntax error caught by `canonicalize`       | `docs/mobile-editor-plan.md` §2.4, §4.6; `editor-session.svelte.ts:665` |
| 11  | MB6: Selection   | Selection Clear & Select All                    | Buttons for "Select All" (`session.selectAll()`) and "Clear Selection" (`session.clearSelection()`), plus tapping empty canvas in View.                                               | Button tap or empty canvas tap in View tool                                        | Selection updated to `volume.placedBounds()` or `null`                                           | No-op if volume empty or already deselected                                                             | `docs/mobile-editor-plan.md` §2.4, §4.6; `editor-session.svelte.ts:767` |
| 12  | MB6: Block State | Touch Block-State Sheet & Inspector             | Displays properties of the inspected block (follow-tap / armed cell) inside a bottom sheet without requiring hover.                                                                   | Tap on block cell; sheet open trigger                                              | Shows block name, position `x, y, z`, and editable property list                                 | If inspected cell is empty or unset, displays "Point at a block to see and change its properties"       | `docs/mobile-editor-plan.md` §2.5, §4.6; `BlockStatePanel.svelte:33`    |
| 13  | MB6: Block State | Boolean Property Toggle Switches                | Touch switches for boolean properties (`waterlogged`, `open`, `lit`, `powered`) replacing desktop `<select>`.                                                                         | Tap on toggle switch control                                                       | Core `setBlockProperty(volume, pos, key, "true"\|"false")` executed; single undo step            | Catches `EditError` and reverts UI toggle state on failure                                              | `docs/mobile-editor-plan.md` §2.5, §4.6; `blockstate.ts:87`             |
| 14  | MB6: Block State | Segmented Chips for Enumerated Properties       | Touch-accessible segmented chip buttons for known property sets (`facing`, `half`, `shape`, `axis`, `hinge`) replacing `<datalist>`.                                                  | Tap on segmented chip option                                                       | Core `setBlockProperty(volume, pos, key, selectedOption)` executed; single undo step             | If invalid value attempted, catches error and restores previous chip selection                          | `docs/mobile-editor-plan.md` §2.5, §4.6; `blockstate.ts:31`             |
| 15  | MB6: Block State | Quick "Rotate Block" Action                     | Shortcut button in block-state sheet that immediately advances `facing` or `axis` to the next canonical orientation.                                                                  | Tap "Rotate Block" button                                                          | Cycles `facing` (north->east->south->west) or `axis` (x->y->z); commits `setBlockProperty`       | Disabled / hidden if block has neither `facing` nor `axis` property                                     | `docs/mobile-editor-plan.md` §2.5, §4.6                                 |
| 16  | MB6: Palette     | Recent Blocks Hotbar                            | Horizontally scrolling quick-access bar displaying the last 8 used block states plus user-pinned favourites above the palette list.                                                   | Block placement or selection; tap hotbar swatch                                    | Sets `session.block = selectedBlock`; updates toolbar swatch                                     | Gracefully ignores duplicates; preserves order (most recent first)                                      | `docs/mobile-editor-plan.md` §2.5, §4.6                                 |
| 17  | MB6: Storage     | Recents & Favourites Persistence                | Browser `localStorage` persistence layer caching recent blocks and user favourites across sessions.                                                                                   | Block usage events, star/pin toggles, page init                                    | Restores recent/favourite lists on startup; saves on modification                                | Wrapped in `try/catch`; silently degrades to in-memory array if storage disabled/quota exceeded         | `docs/mobile-editor-plan.md` §2.5, §5 (Dec. 9)                          |
| 18  | MB7: Performance | Dynamic Resolution Scaling                      | Dynamically lowers canvas drawing buffer resolution (DPR 1.0–1.5) during active camera gestures (orbit, pan, pinch) and restores full DPR on idle.                                    | Gesture start (`twoFingerPan`, `pinch`, `drag`), gesture end / idle event          | Renderer resizes drawing buffer (`renderer.setPixelRatio`); requests frame                       | Smooth transition without visible jump or camera repositioning                                          | `docs/mobile-editor-plan.md` §3 (Perf. 3), §4.7                         |
| 19  | MB7: Performance | Quality Setting (Auto / High / Low)             | User-selectable rendering quality preset controlling resolution scaling thresholds, MSAA toggle, and render limits.                                                                   | User selection in View sheet / settings                                            | Controls renderer antialias flag, base pixel ratio, and dynamic scaling behavior                 | Persisted in session settings; default "Auto" adapts to device DPR and GPU tier                         | `docs/mobile-editor-plan.md` §3 (Perf. 3), §4.7                         |
| 20  | MB7: Performance | On-Demand Frame Throttling                      | Enforces strictly demand-driven frame rendering (`requestFrame`) during mobile brush strokes; only re-meshes dirty sections.                                                          | Pointer move, brush stroke event                                                   | Re-meshes only dirty section keys (0.1–5 ms on worker); draws single frame                       | Never enters continuous requestAnimationFrame loop; conserves battery                                   | `docs/mobile-editor-plan.md` §3 (Perf. 2), §4.7; `renderer.ts:849`      |
| 21  | MB7: Memory      | Mobile History Memory Budget                    | Configurable `maxBytes` history memory limit applied on coarse pointer devices (e.g. 16 or 32 MiB vs desktop 64 MiB).                                                                 | Device pointer detection (`any-pointer: coarse`) at session initialization         | Sets `HistoryOptions.maxBytes` in `new History({ maxBytes })`                                    | Drops oldest undo entries when exceeding budget; always guarantees last command can be undone           | `docs/mobile-editor-plan.md` §3 (Core & Perf. 6), §4.7; `history.ts:11` |
| 22  | MB7: Performance | Mobile Worker Pool Adaptation                   | Constrains worker pool size to `min(2, navigator.hardwareConcurrency - 1)` on mobile devices to prevent thermal throttling on big.LITTLE cores.                                       | Device capability detection / coarse pointer flag                                  | Initialises `WebglRendererOptions.workers = 2`                                                   | If worker creation fails, falls back to 1 worker or synchronous fallback                                | `docs/mobile-editor-plan.md` §3 (Perf. 7), §4.7; `renderer.ts:56`       |
| 23  | MB7: Telemetry   | Real-Time Performance Overlay (`?perf=1`)       | Debug diagnostic HUD rendering FPS, triangle count, JS heap memory, DPR, draw calls, and stroke latency on mobile screens.                                                            | URL parameter `?perf=1`                                                            | Renders high-contrast semi-transparent overlay HUD on top of canvas                              | Does not intercept touch pointer events (`pointer-events: none`)                                        | `docs/mobile-editor-plan.md` §3 (Perf. 1), §4.7                         |
| 24  | MB7: Performance | Off-Main-Thread Schematic Parsing (Conditional) | Moves NBT/schematic decompression and decoding into a background Web Worker if MB1 measurements show main-thread freeze > 1 s.                                                        | File open event (`.litematic`, `.schem`, `.nbt`)                                   | PostMessage transfer of raw file buffer; receives decoded `Volume` transfer                      | If worker fails or throws, catches error and reports format problem to user                             | `docs/mobile-editor-plan.md` §3 (Perf. 9), §4.7; `+page.svelte:649`     |
| 25  | MB8: UX Polish   | Transient Commit Toast with Undo Action         | Ephemeral toast notification appearing for ~4 seconds after every committed tool edit ("Placed 12 blocks · Undo") with inline Undo button.                                            | Tool commit event (`place`, `line`, `rect`, `fill`, `replace`, `move`, etc.)       | Displays toast above bottom toolbar; tapping Undo reverts edit immediately                       | Automatically dismisses after 4 s timeout; cancels timer if new edit occurs                             | `docs/mobile-editor-plan.md` §2.6, §4.8                                 |
| 26  | MB8: Feedback    | Haptic Feedback Integration                     | Subtle tactile vibration pulse triggered upon command commit and gesture cancellation where supported by the browser.                                                                 | Tool commit event, cancel event                                                    | Calls `navigator.vibrate([15])` (commit) or `navigator.vibrate([10, 40, 10])` (cancel)           | Feature-detected; wrapped in try/catch; silently ignored if unsupported or denied                       | `docs/mobile-editor-plan.md` §2.3, §4.8                                 |
| 27  | MB8: Ergonomics  | Left-Handed Layout Toggle                       | UI option that mirrors the thumb cluster (moves Undo/Redo/Confirm/Cancel to the bottom-left corner) and inverts toolbar alignment.                                                    | User toggle in menu / settings                                                     | Inverts CSS layout container flex/grid classes (`layout-left-handed`)                            | State persisted in localStorage; instantly reflows without page reload                                  | `docs/mobile-editor-plan.md` §2.1, §4.8, §5 (Dec. 8)                    |
| 28  | MB8: Shortcuts   | Multi-Finger Tap Gesture Shortcuts              | Optional gesture shortcuts: two-finger tap triggers Undo; three-finger tap triggers Redo. Off by default per Decision 1.                                                              | 2-finger or 3-finger simultaneous contact tap with low displacement (<8 px)        | Dispatches `session.undo()` or `session.redo()`                                                  | Off by default; requires explicit enablement in settings to prevent gesture collision                   | `docs/mobile-editor-plan.md` §2.2, §4.8, §5 (Dec. 1)                    |
| 29  | MB8: Docs & Help | Touch Tutorial & Contextual Help                | Updated interactive help text, toolbar tooltips, and first-run walkthrough tailored to touch gestures instead of keyboard/mouse shortcuts.                                            | First visit or help menu open                                                      | Displays step-by-step guidance: "Tap canvas to arm -> nudge with d-pad -> tap ✓ to commit"       | Dismissible; never blocks canvas editing                                                                | `docs/mobile-editor-plan.md` §4.8; `+page.svelte:755`                   |
| 30  | MB8: A11y        | Touch Target Sizing & ARIA Audit                | Ensures all buttons and interactive elements meet WCAG 2.5.5 (min 44x44 CSS px, primary 48x48 px), with screen-reader labels and focus order.                                         | DOM element layout and accessibility tree                                          | Strict compliance with minimum touch bounding boxes and polite `aria-live` announcements         | Automated e2e assertions fail if any interactive bounding box < 44x44 px                                | `docs/mobile-editor-plan.md` §3 (A11y), §4.8                            |
| 31  | MB8: A11y        | Automated Contrast Test Extension               | Extends `apps/web/test/contrast.test.ts` to assert WCAG AA compliance (4.5:1 text, 3:1 UI components) across all newly added mobile elements.                                         | Color definitions of toasts, chips, toggle switches, nudge pad, bottom sheets      | Vitest test assertions in `contrast.test.ts` pass                                                | Fails build if any text/background pair falls below 4.5:1 (or 3:1 for focus rings)                      | `docs/mobile-editor-plan.md` §3 (A11y), §4.8; `contrast.test.ts:23`     |
| 32  | MB8: Docs        | Documentation & Self-Hosting Update             | Updates `README.md`, mobile architecture documentation, and Termux mobile testing guide.                                                                                              | Documentation source files                                                         | Clear instructions on Termux dev-server setup, Android Chrome compatibility, and mobile gestures | Reviewed for accuracy against implemented MB1–MB8 features                                              | `docs/mobile-editor-plan.md` §4.8                                       |

---

## 4. Edge Cases

| #   | Feature                 | Input                                                                                                            | Observed Behavior                                                                                                                                             |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | MB5: Nudge Pad          | Tapping nudge pad arrows when armed cell is at the volume's coordinate boundary (e.g. `x = max`).                | Coordinate increments beyond boundary; volume bounds expand dynamically on commit via `Editor` / `afterChange` or clamp if bounded by fixed container.        |
| 2   | MB5: Two-Point Line     | Placing corner A and corner B on the same identical cell (`a == b`).                                             | `linePoints(a, b)` returns `[[a[0], a[1], a[2]]]`; commits a single block placement command (`placeCells` with 1 cell), exactly equivalent to `placeBlock`.   |
| 3   | MB5: Two-Point Line     | Nudging corner B to a layer outside active slice (`inSlice(slice, b[1]) == false`).                              | UI prevents nudge or visually flags coordinate as invalid; line command execution ignores points outside slice or rejects with polite message.                |
| 4   | MB5: Two-Point Rect     | Setting corner B such that `a` and `b` form a 3D volume instead of a 2D plane.                                   | Rectangle tool enforces `normal` axis plane established at corner A; `b[normal]` is strictly locked to `a[normal]`, keeping rectangle 2D on the chosen plane. |
| 5   | MB5: Paste Ghost        | Activating Paste when clipboard contains blocks with block entities, then nudging across slice boundaries.       | Ghost outline displays full 3D extent; on commit, cells outside slice are filtered if slice active; block entities are cloned and offset correctly.           |
| 6   | MB5: Face Steppers      | Nudging a selection face stepper past its opposite face (e.g. Min X > Max X).                                    | Coordinates are automatically normalized via `makeBox(min, max)` so `min` is always `<= max`; box remains valid without inverted dimensions.                  |
| 7   | MB6: Selection Move     | Moving a selection with `skipAir: true` into a destination partially overlapping existing structure.             | Only non-air blocks in selection overwrite destination cells; destination cells matching selection air blocks remain completely untouched.                    |
| 8   | MB6: Selection Rotate   | Rotating a non-square selection box (e.g. 5x2x10) by 90°.                                                        | Dimensions swap (`[w, h, l]` -> `[l, h, w]`); block states (stairs, doors) turn via `rotateBlockstate`; selection box updates to `rotatedBox`.                |
| 9   | MB6: Block State        | User inspects an unset cell or air block by tapping empty space.                                                 | `inspected` is set to null or air cell; `inspectedBlock` returns null; block-state sheet shows "Point at a block to see and change its properties".           |
| 10  | MB6: Block State        | Inspecting a block whose property has non-standard values not in `KNOWN` table.                                  | `blockProperties` returns `options: null, exact: false`; UI offers text input fallback with "Other…" option instead of broken chip list.                      |
| 11  | MB6: Block State        | Rapidly toggling boolean property switch multiple times before render frame completes.                           | Each toggle creates a distinct `setBlockProperty` command pushed to history; consecutive toggles remain reversible via Undo.                                  |
| 12  | MB6: Hotbar Storage     | Browser has `localStorage` disabled or quota exceeded (Private Browsing / Incognito mode).                       | Wrapped in `try/catch`; fallback to in-memory state; editor functions normally without crashing, showing recents for current session.                         |
| 13  | MB6: Hotbar Duplicates  | User repeatedly places blocks of the same type.                                                                  | Hotbar checks for existing entry, moves it to index 0 without duplicating, and truncates list at maximum 8 recent entries.                                    |
| 14  | MB7: Dynamic Resolution | Two-finger pinch gesture starts immediately while high-polygon section is meshing in worker.                     | Canvas resolution drops to 1.0–1.5 DPR immediately; meshing continues concurrently in worker without blocking main-thread camera movement.                    |
| 15  | MB7: Dynamic Resolution | Camera gesture ends abruptly (fingers lifted instantly).                                                         | Debounce timer (~100 ms) restores native DPR and re-enables MSAA; single sharp frame drawn without stutter.                                                   |
| 16  | MB7: History Budget     | Huge selection fill (e.g. 100,000 blocks) pushed on low-RAM device with 16 MiB history cap.                      | Command is applied; history drops all older undo entries to accommodate command; newest command is guaranteed retained even if it exceeds budget alone.       |
| 17  | MB7: Worker Pool        | Device reports `navigator.hardwareConcurrency = 1` or undefined.                                                 | Worker count clamps to 1; mesher queue processes sequentially without starvation.                                                                             |
| 18  | MB8: Toast Undo         | User triggers another edit action (e.g. places second block) while Undo toast for first edit is still displayed. | Previous toast is replaced; new toast reflects second action ("Placed 1 block · Undo"); tapping Undo reverts the second edit.                                 |
| 19  | MB8: Toast Undo         | User navigates away or opens file picker while toast is active.                                                  | Toast automatically dismisses; pending timeouts cleared; no memory leaks or dangling event handlers.                                                          |
| 20  | MB8: Haptics            | Browser does not support `navigator.vibrate` (e.g. desktop Chrome, certain Android WebView contexts).            | `navigator.vibrate` check guards call; gracefully no-ops without throwing exceptions.                                                                         |
| 21  | MB8: Multi-Finger Tap   | User performs a two-finger pinch-to-zoom with slight delay between finger touches.                               | Gesture arbiter evaluates movement distance threshold (<8 px) and touch duration; pinch zoom is engaged instead of accidental Undo tap.                       |
| 22  | MB8: Left-Handed Layout | User toggles left-handed layout while a bottom sheet is open at half snap point.                                 | Layout instantly mirrors thumb cluster to bottom-left; bottom sheet remains open and anchored to bottom without layout shift.                                 |
| 23  | MB8: Virtual Keyboard   | On-screen keyboard opens when focusing palette search input in bottom sheet.                                     | Bottom sheet follows `visualViewport.height`; search results scroll into view above keyboard without covering active canvas view.                             |

---

## 5. Cross-Module Interfaces and Dependencies

### 5.1 Architecture Layering & Module Isolation

The architectural boundaries defined in `PLAN.md` and `docs/mobile-editor-plan.md` §3 are strictly preserved:
- **`packages/core`**: Zero DOM dependencies, 100% pure TypeScript, operates on plain typed arrays (`Volume`, `Vec3`, `Box`, `Command`, `History`). Fully reusable across Node, Vitest, and Web Workers.
- **`packages/render`**: Pure visualization and WebGL rendering. No knowledge of editing tools, commands, or UI layouts. Additive camera and highlight hooks only.
- **`apps/web`**: Coordinates user interaction, DOM events, Svelte components, bottom sheets, gesture recognition, and wires `core` commands to `render` highlights.

```
+-------------------------------------------------------------------------+
|                                apps/web                                 |
|  +--------------------+  +--------------------+  +-------------------+  |
|  |  Layout & Sheets   |  |   EditSession      |  |  lib/gestures.ts  |  |
|  |  - BottomToolbar   |  |   - armed state    |  |  - Tap / Drag     |  |
|  |  - BottomSheet     |  |   - nudgePad logic |  |  - Pan / Pinch    |  |
|  |  - NudgePad        |  |   - two-point mode |  |  - Multi-tap      |  |
|  |  - ThumbCluster    |  |   - selection sheet|  |  - Arbiter        |  |
|  |  - Hotbar / Toast  |  |   - block-state    |  |                   |  |
|  +--------------------+  +--------------------+  +-------------------+  |
+--------------------|-------------------------------|--------------------+
                     |                               |
                     v                               v
+------------------------------------+  +---------------------------------+
|          packages/core             |  |        packages/render          |
|  - drawLine, drawRectangle         |  |  - external input mode          |
|  - boxBetween, shiftBox            |  |  - orbitBy, panBy, zoomBy       |
|  - blockProperties, withBlockProp  |  |  - dynamic resolution scaling   |
|  - copy, paste, fill, replace      |  |  - highlight(boxes with styles) |
|  - History (maxBytes cap)          |  |  - mesh workers pool (clamp 2)  |
+------------------------------------+  +---------------------------------+
```

### 5.2 Specific Interface Contracts

#### 1. Core Interfaces (`packages/core/src/edit/`)

- **`tools.ts`**:

  ```ts
  export function drawLine(volume: Volume, a: Vec3, b: Vec3, block: string): Command;
  export function drawRectangle(volume: Volume, a: Vec3, b: Vec3, block: string, options?: RectangleOptions): Command;
  export function linePoints(a: Vec3, b: Vec3): Vec3[];
  ```
- **`selection.ts`**:

  ```ts
  export function copySelection(volume: Volume, box: Box): Clipboard;
  export function pasteClipboard(volume: Volume, clip: Clipboard, at: Vec3, options?: PasteOptions): Command;
  export function fillSelection(volume: Volume, box: Box, block: string, options?: FillOptions): Command;
  export function replaceInSelection(volume: Volume, box: Box, from: string, to: string): Command;
  export function rotateSelection(volume: Volume, box: Box, rotation: Rotation, options?: PasteOptions): Command;
  export function mirrorSelection(volume: Volume, box: Box, axis: "x" | "z"): Command;
  export function moveSelection(volume: Volume, box: Box, delta: Vec3, options?: PasteOptions): Command;
  ```
- **`blockstate.ts`**:

  ```ts
  export interface BlockProperty {
    key: string;
    value: string;
    options: readonly string[] | null;
    exact: boolean;
  }
  export function blockProperties(state: string): BlockProperty[];
  export function setBlockProperty(volume: Volume, pos: Vec3, key: string, value: string): Command;
  export function withBlockProperty(state: string, key: string, value: string): string;
  ```
- **`history.ts`**:

  ```ts
  export interface HistoryOptions {
    maxBytes?: number; // default 64 MiB; MB7 lowers to 16/32 MiB on mobile
  }
  export class History {
    readonly maxBytes: number;
    push(command: Command): number;
    undo(volume: Volume): Command | null;
    redo(volume: Volume): Command | null;
    clear(): void;
  }
  ```

#### 2. Render Interfaces (`packages/render/src/webgl/`)

- **`renderer.ts` & `types.ts`**:

  ```ts
  export interface Box {
    readonly min: readonly [x: number, y: number, z: number];
    readonly max: readonly [x: number, y: number, z: number];
    readonly style?: "selection" | "hover" | "ghost" | "armed" | "handles";
  }
  export interface WebglRendererOptions {
    // ... existing options ...
    workers?: number;             // MB7: defaults to 2 on mobile
    antialias?: boolean;          // MB7: toggled dynamically during gestures
    input?: "builtin" | "external"; // MB2/MB7
    pixelRatio?: number;          // MB7: dynamic resolution scaling (1.0 to 2.0)
  }
  // Public camera manipulation methods for external input ownership:
  export class WebglRenderer implements Renderer {
    orbitBy(dxPx: number, dyPx: number): void;
    panBy(dxPx: number, dyPx: number): void;
    zoomBy(factor: number): void;
    focusOn(point: Vec3, distance?: number): void;
    setPixelRatio(ratio: number): void;
  }
  ```

#### 3. Web App Session Interfaces (`apps/web/src/lib/`)

- **`editor-session.svelte.ts` Additions for MB5–MB8**:

  ```ts
  export class EditSession {
    // Modal armed state
    armed = $state.raw<Vec3 | null>(null);
    armedCornerA = $state.raw<Vec3 | null>(null);
    armedCornerB = $state.raw<Vec3 | null>(null);
    activeCorner = $state<"a" | "b">("a");
    confirmMode = $state(false); // Decision 5

    // Nudge and Confirmation API
    nudge(axis: 0 | 1 | 2, step: number): void;
    nudgeSelectionFace(face: "minX" | "maxX" | "minY" | "maxY" | "minZ" | "maxZ", step: number): void;
    confirm(): boolean;
    cancel(): void;

    // Toast and Feedback
    latestToast = $state<{ message: string; timestamp: number } | null>(null);
    triggerHaptic(type: "commit" | "cancel"): void;

    // Hotbar & Recents
    recentBlocks = $state<string[]>([]);
    favouriteBlocks = $state<string[]>([]);
    pushRecentBlock(block: string): void;
    toggleFavourite(block: string): void;
  }
  ```

---

## 6. Testability and Verification Criteria for Each Milestone

### 6.1 Milestone MB5: Armed Cell, Nudge Pad & Two-Point Tools

- **Test Scenarios**:
  1. _Two-Point Line Creation_:
     - Vitest: Arm cell `[10, 5, 10]`, arm cell `[14, 5, 10]`, confirm. Assert command contains exactly 5 cells with coordinates matching Bresenham calculation (`linePoints`). Assert 1 undo step restores prior state.
     - Playwright touch e2e: Tap cell A, tap cell B, tap Nudge +X twice, tap ✓. Assert line length matches 7 cells, cell-for-cell verified via volume snapshot.
  2. _Hollow Rectangle Creation_:
     - Arm corner A, arm corner B (4x3 extent), toggle hollow checkbox, confirm.
     - Assert resulting blocks form a hollow perimeter frame (width 1) lying in the face plane, matching desktop `drawRectangle({ hollow: true })`.
  3. _3x3x3 Box Selection_:
     - Arm corner A, arm corner B (3x3x3).
     - Assert `session.selection` is `[min, max]` of size `3x3x3`.
     - Test selection face steppers: Tap +X on max face stepper; assert selection becomes `4x3x3`.
  4. _Paste Ghost & Nudge_:
     - Copy existing 2x2x2 selection. Switch to Paste tool.
     - Assert ghost highlight appears at armed cell. Nudge Y by +1. Tap ✓. Assert blocks are placed at offset cell coordinates.
- **Exit Criterion Check**:
  - A 5-block line, a hollow 4x3 rectangle, and a 3x3x3 selection made by touch only without keyboard/typing; each is exactly 1 Undo step; nudging one corner by ±1 modifies result by exactly 1 cell; snapshot diff matches desktop path.

### 6.2 Milestone MB6: Selection Actions and Block State by Touch

- **Test Scenarios**:
  1. _Touch Selection Actions (Fill, Replace, Rotate, Mirror, Move)_:
     - Select a 3x3x3 region via touch. Open Selection bottom sheet.
     - Tap "Fill". Assert 27 cells filled with chosen block; assert 1 undo step.
     - Tap "Rotate ↻". Assert volume rotates 90° clockwise; selection box updates footprint (`rotatedBox`).
     - Tap "Mirror E–W". Assert volume mirrored across X axis.
     - Tap "Copy", move armed cursor to new position with nudge pad, tap "Paste". Assert copied blocks round-trip to new location with block entities intact.
  2. _Touch Block-State Manipulation_:
     - Tap an `oak_stairs` block. Block-state sheet displays `facing`, `half`, `shape`, `waterlogged`.
     - Tap segmented chip for `facing` to select `south`. Assert `facing=south` committed.
     - Tap "Rotate block" button. Assert `facing` advances to `west`.
     - Tap an `iron_door` block; toggle `open` switch from `false` to `true`. Assert door state updates.
  3. _Recent Blocks Hotbar_:
     - Place 3 different blocks (`stone`, `dirt`, `glass`).
     - Assert hotbar displays `glass`, `dirt`, `stone` in recents order.
     - Tap `dirt` in hotbar. Assert `session.block` switches to `minecraft:dirt`.
     - Reload page. Assert recents persist in `localStorage`.
  4. _Export Round-Trip_:
     - Export modified schematic to `.litematic`. Read back in Node using `readLitematic` and assert cell-for-cell identity with desktop-edited equivalent.
- **Exit Criterion Check**:
  - Touch-only workflow selects box, fills, copies, pastes, rotates, flips stairs `facing` and door `open` via chips/toggles, exports file, and exported file round-trips through core codecs matching desktop edits.

### 6.3 Milestone MB7: Phone Performance Pass

- **Test Scenarios**:
  1. _Dynamic Resolution Scaling_:
     - Monitor canvas `width` and `height` attributes during simulated two-finger pan/orbit gesture in touch e2e.
     - Assert drawing buffer scales down by configured factor (e.g. 1.0–1.5 DPR) while gesture active and restores to full DPR after gesture end.
  2. _Render-on-Demand Verification_:
     - Assert `requestFrame` is invoked only upon pointer movement or camera update; no continuous render loop while idle.
  3. _Memory History Cap_:
     - Configure `maxBytes = 16 * 1024 * 1024`. Apply 50 commands that push 1 MiB each.
     - Assert `history.bytes` never exceeds 16 MiB; assert oldest commands are dropped; assert `canUndo` remains true for recent commands.
  4. _Worker Pool Clamping_:
     - On coarse pointer environments, verify `WebglRendererOptions.workers` defaults to 2.
  5. _Performance HUD Overlay (`?perf=1`)_:
     - Open test page with `?perf=1`. Assert overlay DOM exists, displays valid numeric values for FPS, triangle count, and heap.
- **Exit Criterion Check**:
  - On phone: `Rafeals_house` fixture orbits at >= 30 fps (or display refresh rate); 256-wide synthetic build sustains >= 30 fps; idle-edit stroke latency is < 100 ms. VM software regression check passes without dropping below M1 baseline.

### 6.4 Milestone MB8: Polish, Accessibility and Docs

- **Test Scenarios**:
  1. _Commit Toast & Undo_:
     - Place block. Assert toast appears with text "Placed 1 block · Undo".
     - Tap "Undo" inside toast within 4 seconds. Assert block placement is reverted and toast disappears.
     - Place block, wait 4.5 seconds. Assert toast automatically fades/unmounts.
  2. _Haptics_:
     - Mock `navigator.vibrate`. Perform commit and cancel. Assert mock received `[15]` on commit and `[10, 40, 10]` on cancel.
  3. _Left-Handed Mode_:
     - Toggle left-handed layout in settings. Assert thumb cluster container has left-aligned CSS classes; verify buttons remain fully functional.
  4. _Accessibility & Target Sizing_:
     - Execute automated Playwright query across all buttons, inputs, chips, and sheet handles.
     - Assert every interactive element bounding box is `>= 44 x 44 CSS px` (primary actions `>= 48 x 48 CSS px`).
     - Assert all buttons have valid non-empty accessible names (`aria-label` or visible text).
  5. _Extended Color Contrast Suite_:
     - Run `pnpm --filter @voxwright/web test`. Assert `contrast.test.ts` includes all new color pairs (toast background/text, chip background/text, toggle switch borders, sheet handles) and passes WCAG AA (>= 4.5:1 text, >= 3:1 controls).
  6. _First-Run Walkthrough_:
     - Verify walkthrough steps allow reaching "placed, undone, exported" within 60 seconds on phone.
- **Exit Criterion Check**:
  - Every touch gesture has a button equivalent; extended contrast test passes; first-run walkthrough completed in under 1 minute; full existing desktop suite and new mobile touch suite pass in CI.

---

## 7. Specific Constraints, Invariants, and Failure Modes

### 7.1 Key Invariants

1. **Atomic Undo Invariant**: Every tool action (whether single block, line, rectangle, fill, replace, move, or paste) MUST produce exactly one atomic `Command` pushed to `History`. Undo must completely revert the operation in a single step.
2. **Surface Constraint Invariant**: During two-point tools (Line, Rectangle), the first contact point's surface normal establishes the active plane. Rectangle tools MUST keep the plane of the first face's normal (`cellOnPlane`), preventing diagonal skew into hidden layers.
3. **Desktop Zero-Regression Invariant**: All desktop mouse-and-keyboard interactions, keyboard shortcuts, panel layouts, and golden test vectors MUST remain byte-for-byte and pixel-identical when coarse pointers are not detected.
4. **Input Non-Interference Invariant**: While a tool stroke or two-point confirmation is active, camera interactions must either be isolated or cleanly cancel the stroke (second-finger cancel rule) to prevent half-painted corrupted states.
5. **DOM-Free Core Invariant**: All additions to `packages/core` must remain strictly DOM-free and runnable under headless Node / Vitest environments.

### 7.2 Failure Modes and Mitigations

| Failure Mode                            | Root Cause                                                                 | Impact                                            | Mitigation Strategy                                                                                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Occluded Target Under Finger**        | Contact patch covers cell on small screen                                  | Inaccurate placement, user frustration            | Offset cursor (~64 px above finger) by default; Armed cell + Nudge Pad mode for discrete confirmation.                                                     |
| **Accidental Tool Drag on Camera Move** | Touch arbiter misclassifies two-finger camera pinch as tool drag           | Corrupted line or unwanted blocks painted         | Gesture arbiter requires multi-touch evaluation: second finger arriving cancels tool stroke immediately (`Stroke.cancel()`) and shifts to camera pan/zoom. |
| **Virtual Keyboard Sheet Occlusion**    | Mobile keyboard resizes viewport when palette search is focused            | Search input and list hidden behind keyboard      | Attach sheet container styling to `visualViewport` height; automatically scroll active search result into visible viewport area.                           |
| **History OOM on Mobile**               | Desktop 64 MiB history cap exceeds available RAM on budget Android devices | Browser tab crash or OS memory kill               | Enforce lower mobile history cap (16–32 MiB) on coarse devices; cap drops oldest undo steps while strictly guaranteeing the last edit can be undone.       |
| **Thermal Throttling / Low FPS**        | High DPR (3.0+) and heavy MSAA overtax mobile GPU                          | Stuttering frames, high battery drain             | Dynamic resolution scaling: downsample drawing buffer to 1.0–1.5 DPR and disable MSAA during active gestures; render on demand only.                       |
| **LocalStorage Failure in Incognito**   | User operates in private browsing mode or restricts storage                | Exception thrown on saving recents/favourites     | Wrap all storage reads and writes in `try/catch`; seamlessly fall back to volatile session memory.                                                         |
| **Haptic API Rejection**                | Browser denies `navigator.vibrate` without user activation or unsupported  | Uncaught Promise rejection or script error        | Feature-detect `navigator.vibrate` and wrap in try/catch; treat haptics as optional enhancement.                                                           |
| **Inverted Selection Box**              | User drags or nudges Min corner coordinate beyond Max corner               | Negative dimension bounding box crashing renderer | Always normalize bounding boxes through `makeBox(min, max)` / `boxBetween(a, b)` before passing to core or render.                                         |

---

## 8. Caveats

1. **MB1–MB4 Implementation Prerequisites**: Milestones MB5–MB8 depend directly on the foundational infrastructure delivered in MB1 (test harness & performance baseline), MB2 (gesture arbiter & external renderer input), MB3 (mobile layout shell, bottom toolbar, bottom sheet component, thumb cluster), and MB4 (offset cursor & touch brush). The formal specifications here assume those contracts are fulfilled as planned.
2. **Real-Phone Performance Numbers (Decision 4)**: The exact threshold for the largest smooth build size on phone in MB7 remains open by design, pending empirical measurement from MB1's Termux benchmark run on Luki's phone.
3. **Android / Chrome Platform Focus (Decision 3)**: Luki's authoritative decision explicitly excludes iOS / Safari testing and support. Implementation and verification must focus strictly on Android Chrome (WebGL2).
4. **Vite Dev Mesh-Worker Dependency**: The known issue with `server.fs.allow` in `apps/web/vite.config.ts` blocking Termux dev-server worker loading must be resolved before real-phone dev testing can occur. Static production builds served via a local HTTP server serve as the interim workaround.

---

## 9. Conclusion

The requirements, data flows, interfaces, and exit criteria for Milestones MB5, MB6, MB7, and MB8 have been completely mined and formalized from `docs/mobile-editor-plan.md`, cross-referenced with UX principles (§2), architectural impacts (§3), milestone definitions (§4), and authoritative project decisions (§5).

- **MB5** delivers precision placement via the Armed Cell lifecycle, Nudge Pad steppers, two-point modal tools (Line, Rectangle, Selection), selection face steppers, and paste ghost positioning.
- **MB6** delivers touch-optimized selection sheet operations, boolean toggle switches, enumerated property chips, quick block rotation, recent blocks hotbar, and local storage caching.
- **MB7** delivers high-performance mobile rendering via dynamic resolution scaling, on-demand frame throttling, worker pool clamping, mobile history memory budgets, and performance telemetry overlays.
- **MB8** delivers final touch ergonomics and accessibility polish via commit toasts, haptic feedback, left-handed layout toggle, multi-finger gesture shortcuts, touch tutorials, and automated WCAG contrast verification.

This specification is complete, self-contained, and ready for task estimation, architectural decomposition, and implementation planning.

---

## 10. Verification Method

To verify the accuracy and consistency of this specification:
1. **Source Inspection**:
   - Verify all cited line numbers and quotations against `docs/mobile-editor-plan.md` using `view_file`.
   - Cross-check core function signatures in `packages/core/src/edit/` (`tools.ts`, `selection.ts`, `blockstate.ts`, `history.ts`).
   - Cross-check renderer options in `packages/render/src/webgl/` (`renderer.ts`, `types.ts`, `controls.ts`).
   - Cross-check current web app components in `apps/web/src/lib/` (`editor-session.svelte.ts`, `editing.ts`, `SelectionPanel.svelte`, `BlockStatePanel.svelte`, `+page.svelte`).
2. **Test Suite Verification**:
   - Run existing core tests: `pnpm --filter @voxwright/core test` (Vitest pure functions).
   - Run contrast suite: `pnpm --filter @voxwright/web test` (`contrast.test.ts`).
   - Verify layout and e2e suites: `pnpm --filter @voxwright/web check`.
