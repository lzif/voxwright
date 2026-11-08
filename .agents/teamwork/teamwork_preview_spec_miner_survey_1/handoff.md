# Mobile Editor Specification Mining & Formalization Report (Milestones MB1–MB4)

**Document:** `handoff.md`  
**Agent:** `teamwork_preview_spec_miner_survey_1`  
**Working Directory:** `/home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_spec_miner_survey_1/`  
**Target Specification:** `docs/mobile-editor-plan.md` (Sections 1, 2, 3, 4, 5)  
**Parent Agent:** `844bd535541ac9bed46eab8186e80394`  
**Timestamp:** 2026-11-07T18:46:00Z

---

## Executive Summary

This report extracts, formalizes, and structures the specification for Milestones **MB1, MB2, MB3, and MB4** of the mobile-first schematic editor for Voxwright. The goal is enabling full schematic editing on a touch-only mobile phone (specifically Chrome on Android with WebGL2, per Decision 3) without degrading or altering desktop mouse-and-keyboard editing workflows.

The authoritative specification comprises `docs/mobile-editor-plan.md` cross-referenced with `ORIGINAL_REQUEST.md`, `apps/web/src/routes/+page.svelte`, `apps/web/src/lib/editor-session.svelte.ts`, `packages/render/src/webgl/renderer.ts`, `packages/render/src/webgl/controls.ts`, `apps/web/src/lib/editing.ts`, and the browser e2e test harness in `apps/web/test/`.

---

## Features Discovered

| #   | Category            | Feature                                                 | Description                                                                                                                                      | Inputs                                                                   | Outputs                                                               | Error Behavior                                                         | Discovered Via                                                     |
| --- | ------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Test Harness        | Mobile Touch E2E Test Suite (`FEAT-MB1-01`)             | Playwright/Puppeteer CDP project running touch emulation (390×844, DPR 3, `hasTouch: true`, `isMobile: true`) verifying viewer and editor flows. | Touch events (`dispatchTouchEvent`, `touchscreen.tap`), phone viewport.  | Assertion pass/fail logs, screenshot artifacts.                       | Throws on assertion timeout, element occlusion, or geometry mismatch.  | `docs/mobile-editor-plan.md:178-188`                               |
| 2   | Telemetry           | Performance Debug Overlay (`FEAT-MB1-02`)               | Live HUD activated via `?perf=1` URL query displaying FPS, triangle count, JS heap memory usage, DPR, and first-frame latency.                   | `location.search` (`?perf=1`), `performance.memory`, `renderer.stats()`. | DOM HUD overlay on canvas (`pointer-events: none`).                   | Displays `N/A` if memory API unavailable; zero overhead when inactive. | `docs/mobile-editor-plan.md:160-163, 183-187`                      |
| 3   | Documentation       | Real-Phone Test Checklist (`FEAT-MB1-03`)               | Markdown manual test checklist documenting Termux dev server execution, URL binding, and verification steps.                                     | Termux setup commands, local network URL.                                | `docs/phone-test-checklist.md`.                                       | Documents network bind troubleshooting (`--host`).                     | `docs/mobile-editor-plan.md:179-188`                               |
| 4   | Telemetry           | Baseline Phone Performance Log (`FEAT-MB1-04`)          | Measurement and logging of real-phone performance on Rafeals_house fixture to unblock Decision 4 (max smooth build size).                        | Real phone runtime metrics via `?perf=1`.                                | Documented baseline metrics in plan/notes.                            | Flags thermal throttling or <30 FPS drop.                              | `docs/mobile-editor-plan.md:157-172, 186-188, Decision 4`          |
| 5   | Renderer API        | WebGL Renderer Input Ownership (`FEAT-MB2-01`)          | Additive `input: "builtin" \| "external"` option on `createWebglRenderer`. Default `"builtin"` preserves desktop listeners.                      | Configuration option in `WebglRendererOptions`.                          | Unattached or attached event listeners on canvas.                     | Idempotent attach/detach; no unhandled exceptions.                     | `docs/mobile-editor-plan.md:139-145, 191-197`                      |
| 6   | Renderer API        | Public WebGL Camera API (`FEAT-MB2-02`)                 | Public methods on `WebglRenderer`: `orbitBy(dx, dy)`, `panBy(dx, dy)`, `zoomBy(factor)`, `focusOn(target, dist)`.                                | Pixel deltas, zoom factor, target `Vec3`.                                | Updated camera pose; requests animation frame.                        | Clamps elevation to `[-89°, 89°]`, distance to `[2, 2000]`.            | `docs/mobile-editor-plan.md:141-143, 191-197`                      |
| 7   | Input Engine        | Pure Gesture Arbiter (`FEAT-MB2-03`)                    | Pure module `apps/web/src/lib/gestures.ts` translating raw pointer streams into high-level gesture intents.                                      | Stream of pointerdown, move, up, cancel events.                          | Dispatched intent events (`tap`, `longPress`, `pan`, `pinch`, etc.).  | Auto-resets on `pointercancel` or lost pointers; no stuck state.       | `docs/mobile-editor-plan.md:90, 149, 191-197`                      |
| 8   | Gesture Handling    | Second-Finger Stroke Reversal (`FEAT-MB2-04`)           | Detecting a 2nd pointer during a tool drag, aborting the active stroke (`Stroke.cancel()`), and switching to camera control.                     | Arrival of 2nd simultaneous pointer down.                                | Cancels active stroke, restores initial cells, starts pan/zoom.       | Synchronously rolls back volume before camera takes over.              | `docs/mobile-editor-plan.md:90, 191-197, Decision 1`               |
| 9   | Camera Control      | Touch Camera Navigation (`FEAT-MB2-05`)                 | Binding `gestures.ts` to `WebglRenderer`: 1-finger drag orbits, 2-finger drag pans, 2-finger pinch zooms.                                        | Touch gestures on canvas.                                                | Smooth camera transformation without jump or drift.                   | Finger lift during pinch smoothly transitions to 1-finger drag.        | `docs/mobile-editor-plan.md:76-88, 191-197`                        |
| 10  | Access Gate         | Coarse Pointer Gate Removal (`FEAT-MB3-01`)             | Removing `canEdit = fine.matches \|\| !coarse.matches` and lockout text; retaining WebGL2 requirement gate.                                      | Media queries, WebGL2 context check.                                     | `canEdit = true` on touch WebGL2 devices; editor initializes.         | If WebGL2 unavailable, renders viewer-only message.                    | `docs/mobile-editor-plan.md:31, 151-152, 198-204, Decision 11`     |
| 11  | Layout & CSS        | Full-Viewport Canvas & Touch Hygiene (`FEAT-MB3-02`)    | `100dvh`, safe-area insets, `touch-action: none`, `overscroll-behavior: none`, `viewport-fit=cover`, no page scroll.                             | Window resize, safe-area insets.                                         | Immersive edge-to-edge canvas with zero page scrolling.               | Falls back to `100vh` on browsers lacking `dvh` support.               | `docs/mobile-editor-plan.md:68, 153, 198-204`                      |
| 12  | Layout & Responsive | Breakpoint & Layout Mode Switcher (`FEAT-MB3-03`)       | Switching between desktop 3-column and mobile shell based on width (1000px) + pointer type, with manual override.                                | Viewport width, `pointer: fine`, user preference.                        | Active layout layout mode (`desktop` vs `mobile`).                    | Defaults to mobile layout on ambiguous mobile viewports.               | `docs/mobile-editor-plan.md:72, 151, 201-204, Decision 7`          |
| 13  | Navigation UI       | Top App Bar & Collapsible Menu (`FEAT-MB3-04`)          | Collapsed header bar with title and menu button; opens menu sheet with File/Open, Pack, View, and Export.                                        | Tap on top app bar menu button.                                          | Modal menu bottom sheet. Broadened file picker accept.                | Dismisses on backdrop tap or Escape.                                   | `docs/mobile-editor-plan.md:42, 68, 155, 198-204`                  |
| 14  | Toolbar UI          | Ergonomic Bottom Toolbar (`FEAT-MB3-05`)                | Single-row thumb-zone toolbar with >=48px targets for tools (View, Place, Replace, Erase, Pick, Line, Rect, Select) + block swatch.              | Tap on tool icon or active block swatch.                                 | Changes `session.tool`; opens palette sheet on swatch tap.            | Horizontal scrolling enabled if viewport is narrower than toolbar.     | `docs/mobile-editor-plan.md:69, 151, 154, 198-204`                 |
| 15  | Action UI           | Ergonomic Thumb Cluster (`FEAT-MB3-06`)                 | Corner floating buttons: Undo, Redo, Confirm (✓), Cancel (✕). Right side default; left-handed toggle.                                            | Tap on Undo/Redo/Confirm/Cancel; handedness toggle.                      | Executes undo/redo/confirm/cancel; mirrors position.                  | Buttons disabled when corresponding action is invalid.                 | `docs/mobile-editor-plan.md:70, 115-117, 151, 198-204, Decision 8` |
| 16  | Sheet Component     | Draggable Bottom Sheet with Snap Points (`FEAT-MB3-07`) | Bottom sheet supporting peek, half, and full snap points, drag handle, and `visualViewport` keyboard adaptation.                                 | Drag on handle, programmatic open, keyboard resize.                      | Resized sheet; adjusts canvas size or centers camera.                 | Auto-scrolls focused input into view when keyboard opens.              | `docs/mobile-editor-plan.md:71, 111, 151, 198-204`                 |
| 17  | Panel Presentation  | Mobile Bottom Sheet Panel Hosting (`FEAT-MB3-08`)       | Hosting Palette, Block State, Selection, and View panels inside bottom sheets without code duplication.                                          | Panel activation intent.                                                 | Sheet displaying selected panel content with >=48px rows.             | Retains session state across sheet open/close cycles.                  | `docs/mobile-editor-plan.md:71-72, 151, 198-204`                   |
| 18  | Editor Session      | Touch Event Processing in EditSession (`FEAT-MB4-01`)   | Ingesting touch pointers in `EditSession`, routing through offset cursor and stroke handling.                                                    | `PointerEvent` (`pointerType === "touch"`).                              | Dispatches to mobile editing touch pipeline.                          | Desktop mouse handling remains completely untouched.                   | `docs/mobile-editor-plan.md:32-33, 150, 206-212`                   |
| 19  | Precision Placement | Offset Cursor (Reticle) Targeting (`FEAT-MB4-02`)       | Shifting picking ray ~64px above finger contact point (`clientY - offset`) so target cell is not obscured by finger.                             | Touch contact coordinates `(x, y)`, offset setting.                      | Raycast target at `(x, y - offset)`; hover outline & ghost block.     | If ray misses bounds, hover is set to `null`.                          | `docs/mobile-editor-plan.md:64, 95-96, 142, 206-212, Decision 5`   |
| 20  | Visual Feedback     | Offset Reticle Visual Indicator (`FEAT-MB4-03`)         | Visual reticle overlay displaying targeting ring/crosshair above finger with connector line to contact point.                                    | Touch coordinates, offset distance.                                      | Rendered DOM or canvas overlay (`pointer-events: none`).              | Hides immediately on pointer up/cancel or off-canvas drag.             | `docs/mobile-editor-plan.md:96, 143, 206-212`                      |
| 21  | Tool Execution      | Single-Tap Block Placement (`FEAT-MB4-04`)              | Short tap (<8px movement, <450ms) commits block placement, replacement, or erasure at offset reticle cell.                                       | Short tap touch sequence.                                                | Creates core command (`placeCells`/`eraseCells`), pushes 1 undo.      | No-op if reticle points to air/void/outside slice.                     | `docs/mobile-editor-plan.md:81, 96, 206-212`                       |
| 22  | Tool Execution      | Single-Finger Continuous Brush Painting (`FEAT-MB4-05`) | Dragging one finger paints continuously along starting plane; committed as exactly one undo step via `Stroke`.                                   | Continuous touch drag stream.                                            | Real-time cell placement and section re-meshing.                      | Straying off starting normal plane is rejected.                        | `docs/mobile-editor-plan.md:80, 96, 206-212`                       |
| 23  | Stroke Safety       | Drag-Off / Toolbar Stroke Cancellation (`FEAT-MB4-06`)  | Dragging reticle off screen boundaries or into toolbar cancels active stroke without committing changes.                                         | Touch position crossing canvas boundaries or entering toolbar.           | Calls `Stroke.cancel()`, reverts cells, re-meshes dirty sections.     | Full volume rollback; no undo history entry created.                   | `docs/mobile-editor-plan.md:90, 96, 206-212`                       |
| 24  | Eyedropper          | Long-Press Eyedropper Pick (`FEAT-MB4-08`)              | Holding touch for ~450ms with <8px movement picks block under reticle without switching active tool.                                             | Stationary touch contact held >= 450ms.                                  | Updates `session.block = withoutNbt(hit.block)`, updates UI.          | No-op if held over void/air; cancels on movement >= 8px.               | `docs/mobile-editor-plan.md:82, 206-212`                           |
| 25  | Status HUD          | Live Cell Readout Bar (`FEAT-MB4-09`)                   | Text bar positioned directly above bottom toolbar displaying target coordinate `(X, Y, Z)` and block name.                                       | Active `hover` / reticle hit.                                            | Accessible text readout (e.g. `12, 64, -5 · stone`).                  | Displays empty/blank when reticle is off build.                        | `docs/mobile-editor-plan.md:100, 150`                              |
| 26  | Haptics             | Touch Haptic Feedback (`FEAT-MB4-10`)                   | Short vibration pulses on commit (15ms), cancel (20ms-50ms-20ms), and long-press pick via `navigator.vibrate`.                                   | Tool commit, cancel, and pick events.                                    | Device vibration pulses.                                              | Wrapped in `try...catch`; gracefully ignored if unsupported.           | `docs/mobile-editor-plan.md:100, 208`                              |
| 27  | Regression          | Desktop Mouse & Keyboard Parity (`FEAT-MB4-11`)         | Guaranteeing zero functional or visual regressions for desktop mouse and keyboard editing.                                                       | Mouse clicks, drags, wheel zoom, keyboard shortcuts.                     | Exact match with baseline test results (`e2e.ts`, `editor-suite.ts`). | Any desktop test failure blocks merge.                                 | `docs/mobile-editor-plan.md:7, 195, 203, 211`                      |

---

## Edge Cases

| #   | Feature                                     | Input                                                                                                  | Observed / Required Behavior                                                                                                                                  |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Touch E2E (`FEAT-MB1-01`)                   | Dev VM has no physical GPU (SwiftShader only).                                                         | Test suite must run headless under SwiftShader WebGL2 without crashing or skipping tests.                                                                     |
| 2   | Telemetry (`FEAT-MB1-02`)                   | Browser lacks `performance.memory` (non-Chromium or security-restricted).                              | Debug HUD displays `heap: N/A` without throwing unhandled exceptions.                                                                                         |
| 3   | Renderer Mode (`FEAT-MB2-01`)               | Canvas mounted with `input: "external"` while running existing desktop tests.                          | Unaffected: desktop tests instantiate default `input: "builtin"`, retaining existing listener attachments.                                                    |
| 4   | Camera Limits (`FEAT-MB2-02`)               | Rapid 2-finger pan/zoom produces extreme offsets or scale factors.                                     | `elevation` clamped to `[-89°, 89°]`, `distance` clamped to `[minDistance, maxDistance]`; no camera inversion or NaN poles.                                   |
| 5   | Multi-touch Race (`FEAT-MB2-04`)            | Two fingers land within the same animation frame (0ms delta).                                          | Gesture arbiter recognizes simultaneous touch as 2-finger gesture immediately without firing a spurious single-finger tap.                                    |
| 6   | Mid-Stroke Multi-touch (`FEAT-MB2-04`)      | User paints 10 blocks with 1 finger, then rests 2nd finger on screen.                                  | Active stroke immediately aborted: `drag.stroke.cancel()` rolls back all 10 blocks, triggers re-mesh, enters 2-finger pan/zoom.                               |
| 7   | System Gesture Interruption (`FEAT-MB2-03`) | OS triggers system back-swipe or app switch, emitting `pointercancel`.                                 | Gesture arbiter resets cleanly to idle; any active stroke is cancelled; no orphan pointer captures remain.                                                    |
| 8   | Software Fallback Gate (`FEAT-MB3-01`)      | Device with touch screen has WebGL2 disabled or unavailable (software rendering).                      | Editing remains gated off; page displays "Editing needs WebGL2; the software renderer is a viewer" (Decision 11).                                             |
| 9   | Safe Area / Notches (`FEAT-MB3-02`)         | Phone in portrait with top notch and bottom home indicator bar.                                        | Root layout applies `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`; canvas extends behind (`viewport-fit=cover`), but buttons remain unclipped. |
| 10  | On-Screen Keyboard (`FEAT-MB3-07`)          | User taps Palette search bar; Android Gboard expands to occupy 45% screen height.                      | `window.visualViewport` handler resizes/shifts sheet; search input and top results stay visible without covering toolbar.                                     |
| 11  | Android File Picker (`FEAT-MB3-04`)         | User opens file picker on Android Chrome; `.nbt` and `.schem` are greyed out.                          | File `<input>` includes `application/octet-stream` and `*/*` in `accept`, allowing user to select schematic files.                                            |
| 12  | Top Viewport Margin (`FEAT-MB4-02`)         | User touches top edge of screen (`clientY < 64px`), pushing reticle off-screen (`clientY - 64 < 0`).   | Raycast clips to bounds; if ray misses scene, hover is set to `null`; no block is placed; dragging past boundary cancels stroke.                              |
| 13  | Micro-Jitter on Tap (`FEAT-MB4-04`)         | User taps screen to place block; finger wobbles by 4px before lifting.                                 | Movement under 8px threshold is classified as a stationary tap; places single block cleanly at reticle instead of starting brush stroke.                      |
| 14  | Drag Into Toolbar (`FEAT-MB4-06`)           | User starts brush stroke and drags finger downwards into the bottom toolbar.                           | Crossing into bottom toolbar bounding box triggers immediate `Stroke.cancel()`, reverting uncommitted changes and stopping the drag.                          |
| 15  | Long-Press Over Void (`FEAT-MB4-08`)        | User holds finger stationary for 600ms over empty sky (no block hit).                                  | Timer expires, raycast returns `null`; no block is picked; no toast or error displayed.                                                                       |
| 16  | Tab Discard / Backgrounding (`FEAT-MB3-01`) | User switches apps while editing; mobile Chrome discards background tab without firing `beforeunload`. | `visibilitychange` listener triggers immediate autosave flush to IndexedDB / localStorage on `visibilityState === "hidden"`.                                  |

---

## Detailed Milestone Formalization

### Milestone MB1: Phone Baseline & Test Harness

#### 1. Objectives & Scope

Establish automated mobile touch emulation in the VM test runner, build the live performance telemetry HUD, create the physical phone testing documentation, and record baseline real-phone metrics. No changes to editing behavior are introduced in MB1.

#### 2. Detailed Feature Inventory

##### `FEAT-MB1-01`: Touch-Emulated E2E Project Harness

- **Description:** A dedicated mobile test project in `apps/web/test/` configured with mobile viewport (`390 x 844`, DPR 3), touch emulation enabled (`hasTouch: true`, `isMobile: true`), and CDP touch dispatching.
- **Inputs:** Viewport configuration `{ width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true }`, touch event sequences.
- **Outputs:** Automated test execution report, pass/fail status, screenshot captures of mobile viewer.
- **Invariants:** Runs in headless Chromium using SwiftShader without physical GPU hardware. Desktop suites (`e2e.ts`, `editor-suite.ts`, `m4-suite.ts`) execute completely unmodified.
- **Failure Modes:** Timeout waiting for canvas frame; WebGL context creation failure in headless mode.

##### `FEAT-MB1-02`: Performance Telemetry HUD (`?perf=1`)

- **Description:** Real-time HUD overlay displayed when `?perf=1` is present in URL query parameters. Measures and displays:
  - Instantaneous and smoothed Frames Per Second (FPS).
  - Triangle count from `renderer.stats().triangles`.
  - JS Heap memory usage (`performance.memory.usedJSHeapSize` / `totalJSHeapSize`).
  - Active `devicePixelRatio` (DPR).
  - Time-to-first-full-frame (`renderer.stats().firstFullFrameMs`).
- **Inputs:** `window.location.search`, `requestAnimationFrame` timestamps, `performance.memory`, `renderer.stats()`.
- **Outputs:** Non-interactive DOM overlay (`position: fixed; top: 8px; left: 8px; pointer-events: none; z-index: 9999; font-family: monospace;`).
- **Invariants:** Inactive and zero performance overhead when `?perf=1` is absent.
- **Failure Modes:** `performance.memory` undefined on non-Chromium browsers (handled by displaying `heap: N/A`).

##### `FEAT-MB1-03`: Real-Phone Test Documentation Checklist

- **Description:** A clear, step-by-step test guide located in `docs/` describing how to start the Vite dev server inside Termux on Android, access the application over local Wi-Fi or USB tethering, run the viewer with the Rafeals_house fixture, and record telemetry numbers.
- **Inputs:** Vite host command (`pnpm dev --host`), phone network address.
- **Outputs:** Markdown document (`docs/phone-test-checklist.md`).
- **Invariants:** Targets Chrome on recent Android devices with WebGL2 (iOS excluded per Decision 3).

##### `FEAT-MB1-04`: Real-Phone Baseline Recording

- **Description:** Execution of the checklist on a physical Android phone, recording baseline FPS, heap, and first-frame latency for Rafeals_house and synthetic builds. Unblocks Decision 4 by providing the empirical ceiling for build sizes.
- **Inputs:** Physical phone runtime measurements.
- **Outputs:** Metrics recorded in plan or docs note.

#### 3. Exit Criteria & Verification

- **Exit Criterion:** The existing viewer opens the Rafeals_house fixture on a real Android phone; the `?perf=1` overlay displays live FPS and heap; baseline numbers are recorded in documentation. The touch e2e test suite opens the viewer at 390×844 and passes the open/orbit test.
- **Verification Commands:**
  - Automated: `pnpm --filter @voxwright/web test:e2e-touch` (or equivalent mobile test invocation).
  - Regression: `node test/e2e.ts` (desktop suites pass untouched).
  - Manual: Termux physical phone run following `docs/phone-test-checklist.md`.

---

### Milestone MB2: Input Ownership & Gesture Arbiter

#### 1. Objectives & Scope

Decouple camera input handling from renderer internals. Expose public camera manipulation primitives on `WebglRenderer`. Introduce a pure, DOM-free gesture arbiter state machine (`gestures.ts`) that resolves multi-touch conflicts, ensures second-finger touches cancel active tool strokes, and drives mobile camera navigation (orbit, pan, pinch zoom).

#### 2. Detailed Feature Inventory

##### `FEAT-MB2-01`: WebGL Renderer Input Ownership Configuration

- **Description:** Extend `WebglRendererOptions` with `input?: "builtin" | "external"` (default `"builtin"`). When set to `"external"`, the renderer does NOT register its internal pointer, wheel, or keyboard listeners on the canvas element.
- **Inputs:** `createWebglRenderer({ input: "external", ... })`.
- **Outputs:** Renderer instance where canvas event handling is delegated to external application logic.
- **Invariants:** Default remains `"builtin"`, ensuring desktop behavior and tests remain byte-for-byte identical.
- **Failure Modes:** Calling unattached camera handlers in external mode without mounting canvas.

##### `FEAT-MB2-02`: Public WebGL Camera Manipulation API

- **Description:** Add public methods to `WebglRenderer` exposing camera controls:
  - `orbitBy(dxPx: number, dyPx: number): void` -> Delegates to `this.orbit.rotate(dxPx, dyPx)`.
  - `panBy(dxPx: number, dyPx: number): void` -> Delegates to `this.orbit.pan(dxPx, dyPx)`.
  - `zoomBy(factor: number): void` -> Delegates to `this.orbit.zoom(factor)`.
  - `focusOn(target: Vec3, distance?: number): void` -> Updates orbit target and pose.
    Each method invokes `this.requestFrame()` to trigger on-demand rendering.
- **Inputs:** Pixel displacement values (`dxPx`, `dyPx`), zoom multiplier (`factor`), 3D coordinate (`target`).
- **Outputs:** Updated internal `Pose` (`azimuth`, `elevation`, `target`, `distance`); triggers `onCamera` callback and frame render.
- **Invariants:** Clamps `elevation` to `[-89°, 89°]` and `distance` to `[minDistance, maxDistance]`.

##### `FEAT-MB2-03`: Pure Gesture Arbiter (`lib/gestures.ts`)

- **Description:** Pure TypeScript module implementing a deterministic gesture state machine. Ingests pointer lifecycle events and emits typed intent events:
  - `tap`: Down + up within 450ms and <8px displacement.
  - `longPress`: Down held >= 450ms with <8px displacement.
  - `dragStart`, `dragMove`, `dragEnd`: Continuous single-pointer motion exceeding 8px.
  - `twoFingerPan`: Two pointers moving with relatively constant spread.
  - `pinch`: Two pointers with changing spread (`spread2 / spread1`).
  - `cancel`: Gesture abort signal.
- **Inputs:** Synthetic or native pointer event data: `{ id, type, x, y, time }`.
- **Outputs:** Intent callbacks / dispatched events.
- **Invariants:** Completely DOM-free; executes in Node.js under Vitest.
- **Constants:** `LONG_PRESS_MS = 450`, `TAP_THRESHOLD_PX = 8`, `PINCH_SLOP_PX = 10`.

##### `FEAT-MB2-04`: Multi-Touch Arbitration & Second-Finger Stroke Abort

- **Description:** Strict pointer allocation rule (Decision 1): 1 finger operates tools; 2 fingers operate camera. If a second finger touches down while a single-finger tool drag is active, the arbiter immediately emits a `cancel` event, triggering `drag.stroke.cancel()` to revert uncommitted cell changes. The gesture then seamlessly converts into a 2-finger camera gesture (pan/pinch).
- **Inputs:** Second pointer down event while single-pointer drag is active.
- **Outputs:** Cancellation of current stroke; activation of 2-finger camera controller.
- **Invariants:** No half-painted or corrupted strokes persist when a second finger touches the canvas.

##### `FEAT-MB2-05`: Mobile Touch Camera Control

- **Description:** Wire `gestures.ts` to `WebglRenderer` camera API in `apps/web`:
  - 1-finger drag in View mode -> `renderer.orbitBy(dx, dy)`.
  - 2-finger drag -> `renderer.panBy(dx, dy)`.
  - 2-finger pinch -> `renderer.zoomBy(pinchFactor)`.
- **Inputs:** Touch gestures on canvas.
- **Outputs:** Responsive, jitter-free camera motion.
- **Invariants:** Smooth 1:1 finger tracking without coordinate jumps on pointer lift.

#### 3. Exit Criteria & Verification

- **Exit Criterion:** On a touch device, 1 finger orbits, 2 fingers pan, and pinch zooms without drift or jumps. Vitest unit tests pass for all synthetic gesture sequences (tap, long-press, drag, pinch, second-finger cancel). Full existing desktop test suites (`e2e.ts`, `editor-suite.ts`, `m4-suite.ts`) pass without modification.
- **Verification Commands:**
  - Unit: `pnpm --filter @voxwright/web vitest run test/gestures.test.ts`
  - Touch E2E: Chromium touch e2e verifying camera pan/zoom/orbit via CDP touch events.
  - Desktop Regression: `node test/e2e.ts`

---

### Milestone MB3: Mobile Layout Shell

#### 1. Objectives & Scope

Replace the desktop three-column layout on mobile viewports with a dedicated mobile-first layout shell. Remove the coarse-pointer editing lockout while enforcing the WebGL2 requirement. Implement full-viewport canvas styling (`100dvh`, safe-area insets), collapsible top app bar with menu sheet, bottom toolbar (>=48px targets), floating thumb cluster, and bottom sheets with snap points and `visualViewport` keyboard awareness.

#### 2. Detailed Feature Inventory

##### `FEAT-MB3-01`: Coarse Pointer Gate Removal & WebGL2 Enforcement

- **Description:** In `apps/web/src/routes/+page.svelte`, eliminate the coarse-pointer gate (`canEdit = fine.matches || !coarse.matches`) and remove the hint "Editing needs a mouse and keyboard; on this device the page is a viewer." Ensure `canEdit` evaluates to `true` on touch devices with WebGL2 (`hasWebgl2() === true`). Keep software renderer strictly as a viewer (Decision 11).
- **Inputs:** `hasWebgl2()`.
- **Outputs:** `canEdit = true` on mobile; `EditSession` initialized when a schematic is opened.
- **Invariants:** Software renderer displays "Editing needs WebGL2; the software renderer is a viewer" and does not start an edit session.

##### `FEAT-MB3-02`: Full-Viewport Canvas & Mobile CSS Hygiene

- **Description:** CSS and HTML shell optimizations:
  - Height set to `100dvh` with padding from `env(safe-area-inset-*)`.
  - Canvas has `touch-action: none; overscroll-behavior: none; user-select: none;`.
  - HTML meta tags: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">`.
  - Controls styled with `-webkit-touch-callout: none; touch-action: manipulation;`.
  - Disables double-tap zoom on buttons; respects `prefers-reduced-motion`.
- **Inputs:** Mobile viewport and system safe-area insets.
- **Outputs:** Zero horizontal overflow (`scrollWidth <= innerWidth`), zero page scroll during editing.
- **Invariants:** Canvas occupies full available viewport area.

##### `FEAT-MB3-03`: Layout Breakpoint & Mode Switcher

- **Description:** Responsive layout selector:
  - Default: Desktop 3-column layout if `min-width: 1000px` AND `pointer: fine`; otherwise mobile shell.
  - Manual override: Toggle in menu sheet allows forcing mobile or desktop layout.
- **Inputs:** Window width, pointer media query, user layout preference.
- **Outputs:** Reactive layout selection state.
- **Invariants:** Desktop layout at 1280×800 remains pixel-identical to baseline.

##### `FEAT-MB3-04`: Top App Bar & Collapsible Menu Sheet

- **Description:** Compact mobile header displaying project title and a Menu button. Tapping menu opens a bottom sheet with:
  - File actions: Open (with broadened `accept="*/*,application/octet-stream,.nbt,.schem,.litematic"` for Android compatibility), Export, Convert.
  - Texture Pack settings.
  - View settings (Slicer / layers, Orbit/Fly).
  - Layout mode switch.
- **Inputs:** User taps menu icon.
- **Outputs:** Opens menu bottom sheet.
- **Invariants:** Android file picker allows selecting any schematic file format without greyed-out extensions.

##### `FEAT-MB3-05`: Bottom Toolbar (Thumb Zone)

- **Description:** Single-row horizontal bar positioned at bottom of viewport. Targets >= 48×48 CSS px. Contains:
  - Tool selectors: View (navigate), Place, Replace, Erase, Pick, Line, Rect, Select.
  - Active block swatch / name chip (opens Palette sheet).
- **Inputs:** Tap on tool button or block swatch.
- **Outputs:** Switches `session.tool`; opens Palette sheet on block swatch tap.
- **Invariants:** All touch targets satisfy WCAG 2.5.5 (>= 44px minimum, 48px primary).

##### `FEAT-MB3-06`: Thumb Cluster (Undo / Redo / Confirm / Cancel)

- **Description:** Corner floating cluster above bottom toolbar:
  - Undo and Redo buttons (bound to `session.undo()` / `session.redo()`).
  - Confirm (✓) and Cancel (✕) buttons (active during armed operations in MB4/MB5).
  - Defaults to bottom-right corner; includes left-handed toggle (Decision 8).
- **Inputs:** Taps on cluster buttons; left-handed preference toggle.
- **Outputs:** Undo/redo actions executed; cluster mirrored to bottom-left when enabled.
- **Invariants:** Buttons disabled when operation is unavailable.

##### `FEAT-MB3-07`: Bottom Sheet Component (`BottomSheet.svelte`)

- **Description:** Draggable modal sheet supporting 3 snap points:
  - `peek`: Shows header and quick chips (~15-20% height).
  - `half`: Occupies ~50% viewport height; leaves canvas visible.
  - `full`: Expands to ~90% viewport height for long lists.
  - Features draggable top pill handle.
  - Integrates with `window.visualViewport`: shrinks and pans when on-screen keyboard opens to keep active inputs visible.
- **Inputs:** Drag gestures on handle, backdrop tap, keyboard appearance.
- **Outputs:** Animated sheet positioning; adjusts canvas resize / camera target.
- **Invariants:** Only one sheet open at any time; never covers 100% of canvas at peek/half.

##### `FEAT-MB3-08`: Panel Integration in Bottom Sheets

- **Description:** Adapter rendering existing panels inside bottom sheets:
  - Palette Panel: Search field + list with >=48px row targets.
  - Block State Panel: Property controls.
  - Selection Panel: Selection actions.
  - View Panel: Layer slicing sliders and camera modes.
- **Inputs:** Sheet selection intent.
- **Outputs:** Rendered panel UI within bottom sheet container.
- **Invariants:** Zero duplicated business logic; panel components interact directly with `EditSession`.

#### 3. Exit Criteria & Verification

- **Exit Criterion:** At 390×844 viewport, there is zero horizontal scroll and zero page scroll while editing; all touch targets are >= 44px; tools can be selected from toolbar; palette sheet opens, searches with keyboard open without obscuring results, and selects blocks by touch. The desktop layout is pixel-identical at 1280×800.
- **Verification Commands:**
  - Automated Touch E2E: Verify bounding box sizes (>=44px), `scrollWidth <= innerWidth`, keyboard appearance in visualViewport, and block selection.
  - Desktop Regression: `node test/e2e.ts` verifying desktop screenshot diffs and editor workflows.

---

### Milestone MB4: Touch Placement with Offset Cursor

#### 1. Objectives & Scope

Implement direct touch editing in `EditSession` for Place, Replace (paint), Erase, and Pick (eyedropper). Introduce the Offset Cursor (reticle) drawn ~64px above the contact point to prevent fat-finger occlusion. Enable single-tap placement, continuous single-finger brush drags (one undo step), drag-off-to-cancel, mid-stroke second-finger abort, long-press eyedropper, live cell readout HUD, and optional haptic feedback. Ensure desktop mouse editing remains byte-for-byte identical.

#### 2. Detailed Feature Inventory

##### `FEAT-MB4-01`: Touch Ingestion in EditSession

- **Description:** Remove the `if (e.pointerType === "touch") return;` early exit in `EditSession.onPointerDown` and `onPointerMove`. Route touch pointers through a dedicated touch pipeline that calculates offset coordinates and coordinates with the gesture arbiter.
- **Inputs:** Touch `PointerEvent`.
- **Outputs:** Ingestion into touch stroke state machine.
- **Invariants:** Mouse and pen pointers continue through original pointer paths.

##### `FEAT-MB4-02`: Offset Cursor (Reticle) Targeting

- **Description:** Solve fat-finger cell occlusion by offsetting the raycast target:
  - Raycast point: `targetY = contactY - offsetPx` (default `offsetPx = 64`, user-adjustable, Decision 5).
  - Ray is generated via `renderer.rayFromClient(contactX, targetY)`.
  - Target cell rendered with hover bounding box and transparent ghost block.
- **Inputs:** Touch position `(contactX, contactY)`, configurable offset.
- **Outputs:** Raycast hit at offset location; outline and ghost block updated.
- **Invariants:** Finger NEVER occludes the cell being edited.

##### `FEAT-MB4-03`: Reticle Visual Overlay

- **Description:** Visual targeting indicator rendered above finger:
  - Targeting reticle/circle centered at `(contactX, contactY - offsetPx)`.
  - Subtle stem/line connecting finger contact point to reticle.
  - Implemented as lightweight DOM overlay or renderer highlight with `pointer-events: none`.
- **Inputs:** Touch coordinates and active offset.
- **Outputs:** Reticle overlay rendered on screen.
- **Invariants:** Hides immediately on pointer up or cancellation.

##### `FEAT-MB4-04`: Single-Tap Block Placement

- **Description:** A short tap (<8px movement, <450ms duration) commits a single tool action:
  - Place: Places active block next to targeted face (`hit.adjacent`).
  - Replace: Replaces targeted block (`hit.position`).
  - Erase: Removes targeted block (`hit.position`).
  - Recorded as exactly ONE step in undo history.
- **Inputs:** Touch tap event at `(contactX, contactY)`.
- **Outputs:** Cell placed at `(contactX, contactY - offsetPx)`; undo step created.
- **Invariants:** Places at offset cell, not contact cell. No-op if ray hits void.

##### `FEAT-MB4-05`: Single-Finger Continuous Brush Painting

- **Description:** Dragging with one finger paints a continuous stroke:
  - Constrained to the normal plane of the initial hit surface (`normalAxis(hit.normal) === drag.axis`).
  - Fills gaps between consecutive pointer events using `linePoints()`.
  - Bundled into a single undo step using `core.Editor.beginStroke()`.
- **Inputs:** Continuous touch drag sequence.
- **Outputs:** Continuous block changes; re-meshes dirty sections.
- **Invariants:** Entire drag commits as ONE undo step on release.

##### `FEAT-MB4-06`: Off-Canvas / Toolbar Drag-To-Cancel

- **Description:** If the user drags the reticle off the canvas boundary or drags their finger into the bottom toolbar or thumb cluster, the stroke is aborted:
  - Executes `drag.stroke.cancel()`.
  - All modified cells during this drag are reverted to their initial values.
  - Affected sections re-meshed; no undo entry recorded.
- **Inputs:** Pointer coordinates leaving canvas bounds or entering toolbar rect.
- **Outputs:** Stroke cancelled, volume restored.
- **Invariants:** Zero partial or orphaned edits remain.

##### `FEAT-MB4-07`: Mid-Stroke Second-Finger Abort

- **Description:** If a second touch contact arrives while a single-finger brush stroke is in progress:
  - Arbiter detects 2nd pointer down.
  - Immediately invokes `drag.stroke.cancel()` to revert all changes from the active stroke.
  - Re-meshes dirty sections.
  - Hands control to 2-finger camera controller (pan/zoom).
- **Inputs:** 2nd touch pointer down during brush stroke.
- **Outputs:** Immediate stroke cancellation; camera gesture activated.
- **Invariants:** Volume state restored identically to pre-stroke state.

##### `FEAT-MB4-08`: Long-Press Eyedropper (Pick)

- **Description:** Holding a touch contact in place for >= 450ms with <8px movement triggers eyedropper:
  - Raycasts at reticle position.
  - Sets `session.block = withoutNbt(hit.block)`.
  - Updates active block swatch in toolbar.
  - Displays message ("Picked <block>").
  - Triggers haptic pulse.
  - Retains currently active tool (does NOT switch to Place tool).
- **Inputs:** Touch held stationary >= 450ms.
- **Outputs:** `session.block` updated; UI swatch updated.
- **Invariants:** Does not commit block placement on finger lift.

##### `FEAT-MB4-09`: Live Cell Readout Bar

- **Description:** Text readout line directly above bottom toolbar displaying coordinates `X, Y, Z` and block name under reticle.
- **Inputs:** Current `hover` state from `this.pick()`.
- **Outputs:** Updated text readout.
- **Invariants:** Throttled to animation frames; accessible live region.

##### `FEAT-MB4-10`: Haptic Feedback

- **Description:** Haptic vibration on tactile milestones:
  - Commit: `navigator.vibrate([15])` (15ms crisp pulse).
  - Cancel / Abort: `navigator.vibrate([20, 50, 20])` (double buzz).
  - Eyedropper Pick: `navigator.vibrate([25])`.
- **Inputs:** Session event triggers.
- **Outputs:** Vibration pulse on supported devices.
- **Invariants:** Guarded with `if (typeof navigator !== "undefined" && "vibrate" in navigator)` and `try...catch`. Failure never interrupts editing.

##### `FEAT-MB4-11`: Desktop Mouse & Keyboard Invariance

- **Description:** Zero behavioral regressions for desktop mouse and keyboard interactions:
  - Clicks, drags, Alt-orbit, Shift-pan, mouse wheel zoom, shortcuts (P, B, X, I, Ctrl+Z, etc.) operate identically.
- **Inputs:** Mouse and keyboard events.
- **Outputs:** Exact parity with pre-MB4 behavior.
- **Invariants:** Desktop test suite passes with zero regressions.

#### 3. Exit Criteria & Verification

- **Exit Criterion:** In a touch-only context: a tap places one block exactly at the cell under the reticle (offset ~64px above finger, not under finger); a drag paints a stroke that one Undo removes; adding a second finger mid-stroke reverts the stroke completely; long press picks the block and the palette/swatch shows it. The same sequences run with a mouse produce identical results as before.
- **Verification Commands:**
  - Unit Tests: Vitest tests for `EditSession` with mocked renderer and synthetic touch events.
  - Automated Touch E2E: Chromium touch e2e verifying cell coordinates via `renderer.clientFromWorld()` (touching at `(pt.x, pt.y + 64)` hits cell at `pt`), single undo reversal, second-finger abort, and long-press pick.
  - Desktop Regression: `node test/e2e.ts` and `editor-suite.ts` pass without errors.

---

## Cross-Module Interfaces & Dependencies

```
┌────────────────────────────────────────────────────────────────────────┐
│                              apps/web                                  │
│                                                                        │
│  ┌───────────────────────┐              ┌───────────────────────────┐  │
│  │   lib/gestures.ts     │              │     +page.svelte          │  │
│  │ (Pure state machine:  │── intents ──>│  (Mobile layout shell,    │  │
│  │  tap, pan, pinch,     │              │   toolbar, bottom sheets, │  │
│  │  second-finger abort) │              │   visualViewport, HUD)    │  │
│  └───────────────────────┘              └─────────────┬─────────────┘  │
│              │                                        │                │
│       pointer events                            session events         │
│              │                                        │                │
│              ▼                                        ▼                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │               lib/editor-session.svelte.ts                       │  │
│  │  (Touch pipeline, offset cursor raycast, brush stroke, undo/redo) │  │
│  └───────────────┬────────────────────────────────────┬─────────────┘  │
└──────────────────┼────────────────────────────────────┼────────────────┘
                   │                                    │
           camera & raycast                      volume & commands
                   │                                    │
                   ▼                                    ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│          packages/render             │  │       packages/core          │
│                                      │  │                              │
│  - createWebglRenderer({             │  │  - Volume (cells, bounds)    │
│      input: "builtin" | "external"   │  │  - Editor (beginStroke)      │
│    })                                │  │  - Stroke (apply, commit,    │
│  - orbitBy(dx, dy)                   │  │            cancel)           │
│  - panBy(dx, dy)                     │  │  - Command (placeCells,      │
│  - zoomBy(factor)                    │  │             eraseCells)      │
│  - focusOn(target, dist)             │  │  - raycast(vol, ray, opts)   │
│  - rayFromClient(x, y)               │  │  - History (undo/redo cap)   │
│  - clientFromWorld(x, y, z)          │  │                              │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

### Module Interface Contracts

1. **`packages/core` (Unchanged, Pure Data & Engine)**
   - Contract: Remains DOM-free and input-independent.
   - `Editor.beginStroke(label: string): Stroke` -> Initializes a reversible brush transaction.
   - `Stroke.apply(command: Command): void` -> Applies cell mutation and marks sections dirty.
   - `Stroke.commit(): boolean` -> Finalizes stroke into undo history stack.
   - `Stroke.cancel(): void` -> Completely reverts all cell mutations made within the stroke back to initial volume state; re-marks affected sections dirty.
   - `raycast(volume: Volume, origin: Vec3, direction: Vec3, options: RaycastOptions): RayHit | null` -> Performs pure DDA raycast.

2. **`packages/render` (Additive Options & Camera API)**
   - Contract: Retains isolation from editing logic; additive options preserve default desktop behavior.
   - `WebglRendererOptions.input?: "builtin" | "external"` (default `"builtin"`).
   - Public Camera Control Methods:
     - `orbitBy(dxPx: number, dyPx: number): void`
     - `panBy(dxPx: number, dyPx: number): void`
     - `zoomBy(factor: number): void`
     - `focusOn(target: Vec3, distance?: number): void`
   - Public Query & Projection Methods:
     - `rayFromClient(clientX: number, clientY: number): { origin: Vec3; direction: Vec3 } | null`
     - `clientFromWorld(x: number, y: number, z: number): { x: number; y: number } | null`
     - `stats(): RendererStats`

3. **`apps/web` (Input Engine, Session & Layout UI)**
   - `apps/web/src/lib/gestures.ts`: Pure state machine converting pointer events into semantic intents (`tap`, `longPress`, `pan`, `pinch`, `cancel`).
   - `apps/web/src/lib/editor-session.svelte.ts`:
     - Exposes `pick(x, y)` taking arbitrary client coordinates.
     - Implements offset cursor: `pick(clientX, clientY - offsetPx)`.
     - Coordinates with `gestures.ts` intents.
     - Manages stroke lifecycle (`beginBrush`, `brushTo`, `commit`, `cancel`).
   - Svelte UI Architecture:
     - `+page.svelte`: Orchestrates layout mode (desktop vs mobile shell), manages WebGL2 gating, binds `visualViewport`.
     - `BottomToolbar.svelte`: Renders thumb-zone tool buttons (>=48px).
     - `ThumbCluster.svelte`: Renders Undo/Redo/Confirm/Cancel in bottom corner.
     - `BottomSheet.svelte`: Manages snap points (peek/half/full), dragging, and panel content hosting.
     - `PerfOverlay.svelte`: Telemetry HUD (`?perf=1`).

---

## Testability & Verification Framework

### 1. Verification Layers

| Layer                           | Environment                     | Test Target                                      | Key Assertions / Verifications                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layer 1: Unit (Vitest)**      | Node.js                         | `gestures.ts`, `editing.ts`, `EditSession` logic | - Synthetic pointer sequence transitions.<br>- Long press timer expiry vs movement cancellation.<br>- Pinch zoom calculation accuracy.<br>- Second-finger stroke abort logic.<br>- Offset coordinate calculation.                                                                                                                           |
| **Layer 2: Headless Touch E2E** | Dev VM (Chromium + SwiftShader) | Full Web Application at 390×844 (DPR 3)          | - Zero page scroll (`window.scrollY === 0`).<br>- Zero horizontal overflow (`scrollWidth <= 390`).<br>- Touch target sizes >= 44px.<br>- Tap at `(pt.x, pt.y + 64)` hits cell at `pt`.<br>- Drag stroke creates 1 undo step.<br>- Second finger mid-stroke reverts volume.<br>- Long press picks block.<br>- Desktop suite regression-free. |
| **Layer 3: Physical Device**    | Android Phone (Termux + Chrome) | Real-world UX & Performance                      | - Rafeals_house viewer baseline FPS & heap.<br>- Ergonomic thumb reach on toolbar.<br>- Bottom sheet drag feel & Gboard keyboard adaptation.<br>- Fat-finger placement accuracy with offset reticle.<br>- Haptic feedback on commit/cancel.                                                                                                 |

### 2. Milestone Test Matrix

| Milestone | Automated Unit Tests (Vitest)                                           | Headless Touch E2E (Chromium/Puppeteer)                                                                                                                                                                                        | Desktop Regression Suite                        | Physical Phone Checklist                                                                                |
| --------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **MB1**   | N/A                                                                     | - Load `?perf=1` at 390×844.<br>- Verify HUD presence and metric fields.<br>- Viewer open & orbit test.                                                                                                                        | `e2e.ts`, `editor-suite.ts`, `m4-suite.ts` pass | - Termux `vite dev` run.<br>- Record Rafeals_house FPS/heap into docs.                                  |
| **MB2**   | `test/gestures.test.ts` (tap, longPress, pan, pinch, 2nd-finger cancel) | - CDP 1-finger drag orbits camera.<br>- CDP 2-finger drag pans camera.<br>- CDP pinch zooms camera.                                                                                                                            | All desktop suites pass unmodified              | - Verify fluid orbit, pan, and zoom feel on touch screen.                                               |
| **MB3**   | Component prop & state tests                                            | - 390×844 layout assertions (no scroll, target sizes >= 44px).<br>- Palette sheet opens by touch.<br>- Search with virtual keyboard preserves result visibility.<br>- Desktop screenshot diff identical at 1280×800.           | All desktop suites pass unmodified              | - Verify bottom toolbar thumb reach.<br>- Verify bottom sheet snap points & keyboard behavior.          |
| **MB4**   | Session unit tests with fake renderer                                   | - Tap at `(pt.x, pt.y + 64)` places block at `pt`.<br>- Drag paints stroke; 1 Undo reverts.<br>- 2nd finger mid-stroke reverts all edits.<br>- Long press picks block into active swatch.<br>- Drag off screen cancels stroke. | All desktop suites pass unmodified              | - Verify offset reticle placement accuracy.<br>- Verify drag-off cancel.<br>- Verify haptic pulse feel. |

---

## 5-Component Handoff Report

### 1. Observation

1. **Current Coarse Pointer Lockout:**
   In `apps/web/src/routes/+page.svelte` lines 638–644:

   ```ts
   const coarse = window.matchMedia("(any-pointer: coarse)");
   const fine = window.matchMedia("(any-pointer: fine)");
   const syncPointer = (): void => {
     canEdit = fine.matches || !coarse.matches;
   };
   ```

   And lines 757–761:

   ```svelte
   {:else if info && kind === "webgl"}
     <p class="hint" data-testid="edit-note">Editing needs a mouse and keyboard; on this device the page is a viewer.</p>
   {:else if info && kind === "cpu"}
     <p class="hint" data-testid="edit-note">Editing needs WebGL2; the software renderer is a viewer.</p>
   {/if}
   ```

   Directly observed: touch-only devices with coarse pointers are unconditionally locked out of editing.

2. **Touch Rejection in `EditSession`:**
   In `apps/web/src/lib/editor-session.svelte.ts` lines 290–294:

   ```ts
   private onPointerDown(e: PointerEvent): void {
     if (e.target !== this.canvas || !this.interactive) return;
     if (e.pointerType === "touch" || e.button !== 0 || e.shiftKey || e.altKey) return;
   ```

   And line 404:

   ```ts
   private onPointerMove(e: PointerEvent): void {
     this.pointer = { x: e.clientX, y: e.clientY };
     if (e.pointerType === "touch") return;
   ```

   Directly observed: `EditSession` completely ignores touch pointer events for both tool actions and hover updates.

3. **Renderer Input Ownership & Double-Handling:**
   In `packages/render/src/webgl/renderer.ts` lines 806–860:
   The renderer directly attaches its own pointer listeners on the canvas, tracking `this.pointers.set(e.pointerId, ...)` and executing 1-finger orbit and 2-finger pinch zoom, while capturing pointers via `c.setPointerCapture(e.pointerId)`. There is currently no way to disable these listeners externally or invoke camera moves programmatically without passing synthetic events.

4. **Input-Independent Editing Engine in `packages/core`:**
   In `packages/core/src/edit/`:
   `Editor`, `Stroke`, `Command`, `Volume`, and `raycast()` take pure data structures (`Vec3`, `Box`, `Ray`). `Stroke.cancel()` exists and cleanly reverts uncommitted mutations back to initial cell values, marking dirty sections.

5. **`vite.config.ts` Dependency Status:**
   In `apps/web/vite.config.ts` line 68:
   `server: { fs: { allow: [searchForWorkspaceRoot(process.cwd())] } },`
   Directly observed: the `server.fs.allow` configuration mentioned as an unstarted dependency in `docs/mobile-editor-plan.md` line 17 is already present in the current codebase!

6. **E2E Cell Projection Mechanism:**
   In `apps/web/test/editor-suite.ts` lines 181–208:
   The test suite uses `renderer.clientFromWorld(x + 0.5, y + 1, z + 0.5)` to project 3D block face centers to 2D client coordinates, and verifies hits via `session.pick(pt.x, pt.y)`.

### 2. Logic Chain

1. _From Observation 1 & 2 to MB3 & MB4 Requirements:_
   Because `+page.svelte` disables `canEdit` for coarse-only pointers, and `EditSession` rejects `pointerType === "touch"`, enabling mobile editing requires:
   - Modifying `+page.svelte` to allow `canEdit = true` whenever WebGL2 is available (MB3).
   - Removing the touch early-exit guards in `EditSession` and introducing a dedicated touch pipeline with offset targeting (MB4).

2. _From Observation 3 to MB2 Architecture:_
   Because `WebglRenderer` attaches its own pointer listeners and claims pointer captures, running `EditSession` and `WebglRenderer` simultaneously on touch pointers causes event contention (double handling). Therefore:
   - An explicit `input: "builtin" | "external"` option is needed in `WebglRenderer`.
   - The renderer must expose public camera methods (`orbitBy`, `panBy`, `zoomBy`, `focusOn`).
   - A pure gesture arbiter (`gestures.ts`) must own the canvas touch listeners in external mode and arbitrate between camera and tool operations (MB2).

3. _From Observation 4 to Multi-Touch Safety (MB2/MB4):_
   Because `Stroke.cancel()` in `core` can completely revert an active stroke and restore the volume, multi-touch conflict resolution (Decision 1) is achieved by having the gesture arbiter detect 2nd finger arrival, synchronously call `Stroke.cancel()`, and transition immediately to 2-finger camera control (MB2, MB4).

4. _From Observation 6 to Automated Touch Testability:_
   Because `renderer.clientFromWorld()` deterministically maps world cell coordinates to client pixels, touch tests can simulate fat-finger interactions by dispatching touch events at `(pt.x, pt.y + offsetPx)`, proving that the offset reticle hits `pt` and places the block exactly at the expected cell without manual intervention.

### 3. Caveats

1. **Physical Phone Testing Dependency:**
   Automated VM tests run on headless Chromium using SwiftShader software rendering. While functional correctness, layout boundaries, and gesture sequences can be 100% verified on the VM, real-world frame rates, thermal throttling, and battery drain must be validated on physical Android hardware (Termux checklist in MB1).
2. **On-Screen Keyboard Inconsistencies:**
   Mobile browsers on Android handle viewport resizing differently depending on OS version and keyboard implementation (Gboard vs Samsung Keyboard). Use of the modern `window.visualViewport` API is specified, but fallback padding should be maintained.
3. **Decision 4 Open Metric:**
   The exact maximum build size a phone must support smoothly remains open by design, pending the empirical measurement from MB1.
4. **iOS Explicitly Excluded:**
   Per Decision 3, iOS / WebKit quirks (such as Safari touch scrolling bugs or home indicator gesture interference) are out of scope.

### 4. Conclusion

The requirements for Milestones MB1, MB2, MB3, and MB4 in `docs/mobile-editor-plan.md` are completely formalized, structurally coherent, and implementable without architectural conflicts:
- **MB1** establishes the touch test harness, `?perf=1` telemetry HUD, and physical phone documentation.
- **MB2** decouples renderer input ownership, implements the pure gesture arbiter, and enables touch camera navigation with second-finger stroke cancellation.
- **MB3** introduces the mobile layout shell (`100dvh`, bottom toolbar, thumb cluster, draggable bottom sheets, keyboard adaptation) while preserving desktop pixel parity.
- **MB4** implements direct touch editing via the offset cursor (reticle), single-tap placement, single-undo brush strokes, drag-off cancellation, and long-press eyedropper.

### 5. Verification Method

To independently verify the facts, interfaces, and code locations cited in this report:

1. **Verify Coarse Pointer Gate in `+page.svelte`:**

   ```bash
   grep -n "canEdit" /home/antigravity/lzif/voxwright/apps/web/src/routes/+page.svelte
   ```

   Lines 54, 187, 292, 642.

2. **Verify Touch Early Returns in `EditSession`:**

   ```bash
   grep -n 'pointerType === "touch"' /home/antigravity/lzif/voxwright/apps/web/src/lib/editor-session.svelte.ts
   ```

   Lines 294, 404.

3. **Verify Existing Renderer Pointer Listeners:**

   ```bash
   sed -n '806,865p' /home/antigravity/lzif/voxwright/packages/render/src/webgl/renderer.ts
   ```

4. **Verify `vite.config.ts` Mesh Worker Allow List:**

   ```bash
   grep -n "allow" /home/antigravity/lzif/voxwright/apps/web/vite.config.ts
   ```

   Line 68.

5. **Run Baseline Tests to Verify Workspace Health:**

   ```bash
   pnpm --filter @voxwright/core test
   pnpm --filter @voxwright/render test
   pnpm --filter @voxwright/web test
   ```

**Invalidation Conditions:**
- If `packages/core` requires non-additive changes or DOM dependencies to support mobile editing, this analysis is invalidated.
- If desktop e2e tests fail after introducing `input: "external"`, the backwards compatibility invariant is violated.
