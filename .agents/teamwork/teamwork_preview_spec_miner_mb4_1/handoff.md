# Handoff Report: Specification Mining for Milestone MB4 (Touch Placement with Offset Cursor)

**Agent**: `teamwork_preview_spec_miner_mb4_1`  
**Milestone**: MB4 (`FEAT-MB4-01` through `FEAT-MB4-09`)  
**Target Repository**: `lzif/voxwright`  
**Base Commit / State**: `main` (with MB1, MB2, MB3 complete)  
**Date**: 2026-11-08  

---

## 1. Observation

Direct observations from codebase inspection, specification documents, and test execution:

1. **Touch Early-Returns in `EditSession`**:
   - `apps/web/src/lib/editor-session.svelte.ts` lines 290–295:
     ```typescript
     private onPointerDown(e: PointerEvent): void {
       if (e.target !== this.canvas || !this.interactive) return;
       // Touch stays a viewer; a modifier or another button hands the drag to the camera
       // (Alt turns, Shift or the right button moves sideways).
       if (e.pointerType === "touch" || e.button !== 0 || e.shiftKey || e.altKey) return;
       e.stopPropagation();
       e.preventDefault();
       this.canvas.focus({ preventScroll: true });
       this.canvas.setPointerCapture(e.pointerId);
       this.error = "";
       this.begin(this.pick(e.clientX, e.clientY), e);
     }
     ```
   - `apps/web/src/lib/editor-session.svelte.ts` lines 402–404:
     ```typescript
     private onPointerMove(e: PointerEvent): void {
       this.pointer = { x: e.clientX, y: e.clientY };
       if (e.pointerType === "touch") return;
     ```
   - In `apps/web/src/lib/editor-session.svelte.ts`, lines 201–215:
     ```typescript
     host.addEventListener("pointerdown", down, true);
     this.canvas.addEventListener("pointermove", move);
     this.canvas.addEventListener("pointerup", up);
     this.canvas.addEventListener("pointercancel", up);
     ```
     `host` is `this.canvas.parentElement ?? this.canvas`. The `pointerdown` listener runs in the capture phase.

2. **Existing Gesture Arbiter Implementation**:
   - `apps/web/src/lib/gestures.ts` lines 3–12:
     ```typescript
     export type GestureIntent =
       | { type: "tap"; clientX: number; clientY: number }
       | { type: "longPress"; clientX: number; clientY: number }
       | { type: "oneFingerDragStart"; clientX: number; clientY: number }
       | { type: "oneFingerDragMove"; clientX: number; clientY: number; dx: number; dy: number }
       | { type: "oneFingerDragEnd"; clientX: number; clientY: number }
       | { type: "twoFingerPan"; dx: number; dy: number }
       | { type: "pinch"; factor: number; center: { x: number; y: number } }
       | { type: "multiFingerTap"; fingers: 2 | 3 }
       | { type: "cancel" };
     ```
   - `apps/web/src/lib/gestures.ts` lines 38–43:
     `tapSlopPx = 8`, `longPressMs = 450`, `multiTapMaxMs = 300`, `multiTapSlopPx = 12`.
   - `apps/web/src/lib/gestures.ts` lines 149–155:
     ```typescript
     // Second-finger stroke abort
     if (this.dragActive) {
       this.dragActive = false;
       this.abortedDrag = true;
       intents.push({ type: "cancel" });
     }
     ```
     When a second finger touches down during an active 1-finger drag, the arbiter immediately emits `{ type: "cancel" }` and transitions to `"two_pointer_gesture"`.

3. **Page-Level Touch Routing in `apps/web/src/routes/+page.svelte`**:
   - Lines 614–673: `wireTouchGestures(c: HTMLCanvasElement, r: WebglRenderer)` sets up an arbiter instance that handles `oneFingerDragMove` by invoking `r.orbitBy(intent.dx, intent.dy)` unconditionally, treating all 1-finger drags as camera orbit.
   - Lines 231–242:
     ```typescript
     function startSession(r: WebglRenderer, v: Volume, dv: number | null, baseEdits: number): void {
       const s = new EditSession({ ... });
       stopSession = s.attach();
       session = s;
     }
     ```
   - Lines 1081–1089: In mobile layout (`isMobileLayout && session`), `ThumbCluster` and `BottomToolbar` are mounted. The bottom toolbar is fixed at `bottom: 0` with a 56px height plus safe area inset (`padding-bottom: env(safe-area-inset-bottom, 0px)`).

4. **Transactional `Stroke` Architecture in `packages/core/src/edit/editor.ts`**:
   - Lines 20–65:
     `Stroke.apply(command)`: applies command immediately to `volume`, marks sections dirty in `DirtyTracker`, and appends to `applied`.
     `Stroke.commit()`: merges all applied commands via `mergeCommands` into a single history entry in `editor.history` (1 undo step).
     `Stroke.cancel()`: iterates backwards through `this.applied`, calls `revertCommand(volume, c)`, and marks sections dirty. Reverts the volume to the exact state before the stroke began.

5. **Picking and Raycasting in `packages/render/src/webgl/renderer.ts`**:
   - Lines 482–494:
     ```typescript
     rayFromClient(clientX: number, clientY: number): { origin: [number, number, number]; direction: [number, number, number] } | null {
       const c = this.canvas;
       if (c === null) return null;
       const r = c.getBoundingClientRect();
       const u = (clientX - r.left) / r.width;
       const v = (clientY - r.top) / r.height;
       if (u < 0 || u > 1 || v < 0 || v > 1) return null;
       return pickRay(this.getPose(), this.camera.fov, r.width / r.height, u * 2 - 1, 1 - v * 2);
     }
     ```
     Raycast queries strictly return `null` whenever `clientX` or `clientY` is outside the canvas bounding rect (`u < 0 || u > 1 || v < 0 || v > 1`).
   - Lines 497–503: `clientFromWorld(x, y, z)` maps world coordinates back to 2D client coordinates (`{ x, y }`), providing the exact target point for synthetic E2E tests.

6. **Current Test Suite Health**:
   - `vitest run` executed across all 52 test files: **839 tests passed, 190 skipped, 0 failed**.

---

## 2. Logic Chain

1. **Touch Ingestion Dilemma & Resolution**:
   - Observation: In `EditSession`, `pointerType === "touch"` currently returns early in `onPointerDown` and `onPointerMove`. Meanwhile, `wireTouchGestures` in `+page.svelte` routes all 1-finger moves to `orbitBy`.
   - Inference: On a touch screen, raw `pointerdown` cannot distinguish whether the user intends a short tap (<450ms, <8px), a long-press pick (450ms), a continuous brush stroke, or a 2-finger camera pinch.
   - Deduction: Replacing the early-return with genuine touch routing requires feeding touch pointer samples into `GestureArbiter`. When `EditSession` owns touch pointer ingestion (either directly via an integrated arbiter or by coordinating with the page's arbiter), pointer events are mapped to high-level intents (`tap`, `longPress`, `oneFingerDragStart`, `oneFingerDragMove`, `oneFingerDragEnd`, `twoFingerPan`, `pinch`, `cancel`).

2. **Offset Cursor Raycast Mechanics**:
   - Observation: When a human finger touches a mobile screen, the fingertip covers ~8–10mm (approximately 30–50 CSS pixels), completely occluding the cell being placed or painted.
   - Inference: To allow precise visual placement without occlusion, the raycasting point must be shifted above the touch contact point by ~64 CSS pixels (`reticleY = clientY - cursorOffsetPx`, where `cursorOffsetPx = 64` by default).
   - Deduction: Raycasting via `this.renderer.rayFromClient(clientX, clientY - cursorOffsetPx)` accurately computes the cell ray above the finger. When the offset cursor is dragged off the top edge of the canvas (`reticleY < canvasRect.top`), `rayFromClient` returns `null`.

3. **Stroke Transactionality and Cancellation**:
   - Observation: `packages/core` provides `Stroke.begin()`, `Stroke.apply()`, `Stroke.commit()`, and `Stroke.cancel()`.
   - Inference: A continuous drag represents a single creative act.
   - Deduction: When a one-finger drag starts over an eligible block, `beginBrush` creates an open `Stroke`. Drag moves append delta commands to the stroke and update dirty render sections. When the finger lifts, `Stroke.commit()` turns the multi-cell stroke into exactly one history step. If a second finger lands (`cancel` intent) or the reticle leaves canvas bounds / enters the toolbar, calling `drag.stroke.cancel()` rolls back all applied blocks and dirty sections with zero history pollution.

4. **Long-Press Eyedropper Mechanics**:
   - Observation: `gestures.ts` triggers `longPress` at 450ms if displacement is within 8px slop.
   - Inference: In desktop mode, the eyedropper tool picks a block and switches the tool to `"place"`. In mobile mode, the user is already in a tool (e.g. `place`, `paint`, `erase`) and wants to pick a block from the scene without losing their active tool context.
   - Deduction: Upon `longPress` intent, `session.block = withoutNbt(hit.block)` updates the active block and sets `inspected = hit.position`, but leaves `session.tool` unchanged. Because the arbiter is in `"one_pointer_long_press"`, lifting the finger suppresses `tap`, preventing accidental block placement on release.

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Input / Routing | Touch Pointer Ingestion (`FEAT-MB4-01`) | `EditSession` ingests touch events replacing the `pointerType === "touch"` early-return, routing touch points through `GestureArbiter` state machine | `PointerEvent` (`down`, `move`, `up`, `cancel`) with `pointerType: "touch"` | Emits `GestureIntent` to session handlers | Invalid pointer IDs or missing touch targets safely ignored | `docs/mobile-editor-plan.md` §3, `editor-session.svelte.ts` L294 |
| 2 | Precision Cursor | Offset Cursor Raycast (`FEAT-MB4-02`) | Shifts raycast ~64px above finger contact point (`reticleX = clientX`, `reticleY = clientY - cursorOffsetPx`) to eliminate finger occlusion | Contact coordinates `(clientX, clientY)`, `cursorOffsetPx` (default 64) | World-space `RayHit` (`position`, `adjacent`, `normal`, `block`) | Returns `null` if reticle is outside canvas bounds or volume bounds | `docs/mobile-editor-plan.md` §2.3, §5 Dec 5 |
| 3 | UI / Indicator | Visual Reticle Indicator (`FEAT-MB4-03`) | 2D DOM/canvas overlay showing touch contact circle, target crosshair, and connecting stem line, paired with 3D hover/ghost highlight | Active reticle state `(contactX, contactY, targetX, targetY, active)` | Rendered DOM SVG overlay + 3D `renderer.highlight()` boxes | Hidden when touch is inactive or cancelled | `docs/mobile-editor-plan.md` §2.3, `PROJECT.md` L49 |
| 4 | Tool Execution | Single-Tap Block Placement (`FEAT-MB4-04`) | Short touch tap (<8px movement, <450ms) places, replaces, or erases block at reticle cell as exactly 1 undo step | `tap` intent with `(clientX, clientY)` | Updated `Volume`, incremented `undoCount`, dirty sections re-meshed | No-op if reticle points at empty sky or outside slice | `docs/mobile-editor-plan.md` §2.2, §4.4 |
| 5 | Tool Execution | Continuous Brush Painting (`FEAT-MB4-05`) | Dragging finger paints connected blocks along starting surface plane, committed as exactly one undo step (`Stroke`) | `oneFingerDragStart`, `oneFingerDragMove`, `oneFingerDragEnd` | Multi-block `Stroke` committed to `editor.history` | Invalid block names fail before stroke begins; skips cells outside slice | `docs/mobile-editor-plan.md` §2.2, `editor.ts` L20-65 |
| 6 | Abort Semantics | Drag-Off & Toolbar Cancel (`FEAT-MB4-06`) | Dragging reticle off canvas bounds or into bottom toolbar cleanly aborts active stroke via `Stroke.cancel()` | Drag coordinates crossing canvas rect or toolbar top threshold | `Stroke.cancel()` reverts volume, dirty sections flushed, drag cleared | Non-destructive abort; no undo history entry created | `docs/mobile-editor-plan.md` §2.3, `PROJECT.md` L52 |
| 7 | Abort Semantics | Second-Finger Stroke Abort (`FEAT-MB4-07`) | Arrival of 2nd finger mid-stroke cancels active stroke (`Stroke.cancel()`) and seamlessly transitions to camera pan/pinch | Second `pointerdown` during 1-finger brush drag | `cancel` intent emitted; active stroke reverted; arbiter enters camera mode | Reverts all interim stroke modifications cleanly | `docs/mobile-editor-plan.md` §2.2, `gestures.ts` L149 |
| 8 | Eyedropper | Eyedropper Long-Press Pick (`FEAT-MB4-08`) | Holding touch for ~450ms with <8px movement picks block under reticle without leaving current tool | `longPress` intent with `(clientX, clientY)` | `session.block` updated; `inspected` set; message displayed; tool preserved | No-op if pointing at empty sky; suppresses release tap | `docs/mobile-editor-plan.md` §2.2, §4.4 |
| 9 | UI / HUD | Live Cell Readout Bar (`FEAT-MB4-09`) | Accessible readout bar docked above bottom toolbar showing targeted cell coordinates and block name | `session.hover` / `session.inspected` / `session.armed` | Visible text pill + `role="status"` / `aria-live="polite"` text | Shows "—" or empty when pointing at air/sky | `docs/mobile-editor-plan.md` §2.3, `PROJECT.md` L54 |
| 10 | Compatibility | Desktop Mouse & Keyboard Parity | Desktop mouse clicks, drags, modifiers, and keyboard shortcuts continue working with zero regressions | Mouse events (`pointerType: "mouse"`), keyboard events | Desktop editing commands executed as before | Unchanged error handling and feedback | `docs/mobile-editor-plan.md` §1.3, §4.4, `PROJECT.md` L55 |
| 11 | Configuration | Configurable Cursor Offset | Adjustable reticle offset height in CSS pixels, with persistence in `localStorage` | Number `px` (e.g. 0 to 128, default 64) | Adjusts reticle distance above finger contact point | Clamped to non-negative bounds `[0, 200]` | `docs/mobile-editor-plan.md` §2.3, §5 Dec 5 |
| 12 | Precision Mode | Confirm Mode Tap Arming (MB5 Bridge) | In confirm mode, single-tap arms cell (`session.armed = cell`) rather than committing immediately | `tap` intent when `session.confirmMode === true` | `session.armed` set; highlight updated to armed cell | Cancel button or tap outside clears armed cell | `docs/mobile-editor-plan.md` §2.3, `PROJECT.md` L56 |

---

## 4. Edge Cases

| # | Feature | Input / Condition | Observed / Specified Behavior |
|---|---------|-------------------|-------------------------------|
| 1 | Single-Tap Placement | Tap on sky / empty air where ray hits nothing | `pick(reticleX, reticleY)` returns `null`. Tap intent completes without action; no block placed; `undoCount` unchanged; no error thrown. |
| 2 | Offset Cursor Raycast | Touch contact near top edge (`clientY < 64px`) causing `reticleY < 0` | Reticle coordinate falls outside canvas bounding rect. `rayFromClient` returns `null`. Raycast aborted; stroke does not begin or aborts cleanly. |
| 3 | Continuous Brush Painting | Fast finger flick causing multi-pixel / multi-cell jump | `brushTo` invokes `linePoints(drag.last, cell)`. Interpolates straight line up to 64 cells, preventing holes/gaps in the painted line. |
| 4 | Drag-Off Abort | Reticle dragged off left (`reticleX < rect.left`) or right (`reticleX > rect.right`) edge | Bounding check detects out-of-bounds reticle. `cancelDrag()` triggers `Stroke.cancel()`. All painted blocks in this stroke revert; dirty sections re-mesh; drag cleared. |
| 5 | Toolbar Abort | Reticle or finger dragged into bottom toolbar (`clientY >= toolbarTop`) | Boundary check detects entry into bottom toolbar zone. `cancelDrag()` triggers `Stroke.cancel()`. Stroke aborted cleanly before interacting with toolbar buttons. |
| 6 | Second-Finger Abort | Finger 2 touches canvas while finger 1 is dragging a 5-block stroke | Arbiter detects 2 concurrent pointers, cancels long-press, emits `{ type: "cancel" }`. `EditSession` cancels stroke; all 5 blocks revert; arbiter switches to pan/pinch. |
| 7 | Long-Press Pick | Finger held stationary for 450ms, then dragged before release | At 450ms, `longPress` fires and picks block under reticle. Arbiter enters `"one_pointer_long_press"`. Subsequent movement does NOT start a brush drag; release does NOT place a block. |
| 8 | Eyedropper Long-Press | Long press on empty sky / void | `pick(reticleX, reticleY)` returns `null`. No block is picked; active block and active tool remain unchanged; release does not place a block. |
| 9 | Surface Plane Lock | Continuous brush drag moves over previously placed blocks or background voxels | `drag.axis` and `drag.layer` are locked on the starting face normal. Cells with different axis or layer are rejected, preventing stroke from wandering into background layers. |
| 10 | Slicer Clipping | Brush stroke dragged across active layer slice boundary (`y < slice.y0` or `y > slice.y1`) | `inSlice(this.slice, cell[1])` evaluates to `false`. Out-of-slice cells are ignored and not modified; in-slice cells paint normally. |
| 11 | Erase Tool Tap / Drag | Tap or drag with `tool = "erase"` | Single tap erases target cell (`eraseAt(hit.position)`). Drag creates `eraseCells` stroke. Lifting commits as 1 undo step. Second finger or drag-off reverts erased blocks. |
| 12 | Replace Tool Tap / Drag | Tap or drag with `tool = "paint"` (Replace) | Single tap replaces block at `hit.position`. Drag replaces cells along starting surface plane. If target cell already matches `this.block`, cell is untouched. |
| 13 | Two-Point Tools (Line/Rect/Select) | Touch down and drag in `line`, `rectangle`, or `select` tool | Drag updates preview box between `drag.a` and `drag.b` using reticle coordinates. Releasing finger commits line/rect command or sets selection. |
| 14 | Simultaneous Touch & Mouse | Hybrid device (touchscreen laptop) receives both mouse click and touch | Event pointer type determines routing: `e.pointerType === "mouse"` uses mouse path (zero offset); `e.pointerType === "touch"` uses offset cursor and arbiter. |
| 15 | Pointer Cancellation | OS interrupts touch (incoming phone call, notification drawer swipe down) | Browser dispatches `pointercancel`. Arbiter emits `{ type: "cancel" }`. Active stroke calls `Stroke.cancel()`; volume and renderer revert; state resets to idle. |
| 16 | Touch on UI Elements | Finger taps toolbar buttons, swatch, or sheet controls | Event target is a DOM button inside toolbar, not the canvas. `e.target !== this.canvas` skips canvas pointer capture; button handles click event normally. |

---

## 5. Exhaustive Specifications for Milestone MB4

### Specification 1: Touch Pointer Event Ingestion in `EditSession`

#### Architecture & Ownership Model
`EditSession` must own all canvas pointer input during an active editing session (`session !== null`).
- In `EditSession.attach()`:
  - Register capture-phase `pointerdown` listener on `host` (`canvas.parentElement ?? canvas`) to intercept pointer events before any background/camera listeners.
  - Register `pointermove`, `pointerup`, `pointercancel`, `pointerleave` listeners on `canvas`.
- For `e.pointerType === "mouse"`:
  - Preserve 100% of existing desktop mouse behavior: check `e.button === 0 && !e.shiftKey && !e.altKey`, call `e.preventDefault()`, set pointer capture, and call `this.begin(this.pick(e.clientX, e.clientY), e)`.
- For `e.pointerType === "touch"`:
  - Remove the early-return statements at lines 294 and 404 of `editor-session.svelte.ts`.
  - Maintain a dedicated `GestureArbiter` instance within `EditSession` (or shared with the page).
  - In `onPointerDown(e)`:
    - Prevent browser default scrolling: `e.preventDefault()`.
    - Focus canvas: `this.canvas.focus({ preventScroll: true })`.
    - Acquire pointer capture: `try { this.canvas.setPointerCapture(e.pointerId); } catch {}`.
    - Convert event via `pointerEventToSample(e)` and feed into arbiter: `this.arbiter.feed(sample)`.
  - In `onPointerMove(e)`:
    - Feed sample into arbiter: `this.arbiter.feed(pointerEventToSample(e))`.
  - In `onPointerUp(e)` and `onPointerCancel(e)`:
    - Feed sample into arbiter: `this.arbiter.feed(pointerEventToSample(e))`.
    - Release pointer capture: `try { this.canvas.releasePointerCapture(e.pointerId); } catch {}`.

#### Gesture Intent Dispatcher
`EditSession.handleGestureIntent(intent: GestureIntent)` processes each emitted intent:
- `oneFingerDragStart`: If `this.interactive`, computes offset reticle `(intent.clientX, intent.clientY - this.cursorOffsetPx)` and initiates tool drag / brush stroke. If `!this.interactive` (View tool), orbits camera.
- `oneFingerDragMove`: If `this.interactive`, validates bounds (drag-off / toolbar), updates reticle indicator, and calls `updateDrag(reticleX, reticleY)`. If `!this.interactive`, calls `this.renderer.orbitBy(intent.dx, intent.dy)`.
- `oneFingerDragEnd`: If `this.interactive`, commits active stroke (`drag.stroke.commit()`) or two-point command, and clears reticle indicator.
- `tap`: Executes atomic single-tap placement/replacement/erase at `(intent.clientX, intent.clientY - this.cursorOffsetPx)`. In View tool, inspects block under finger.
- `longPress`: Executes eyedropper pick at `(intent.clientX, intent.clientY - this.cursorOffsetPx)` without changing tool.
- `cancel`: Immediately invokes `this.cancelDrag()` (`Stroke.cancel()`), reverts volume and renderer dirty sections, and clears reticle.
- `twoFingerPan`: Invokes `this.renderer.panBy(intent.dx, intent.dy)`.
- `pinch`: Invokes `this.renderer.zoomBy(intent.factor)`.

---

### Specification 2: Offset Cursor Mechanics

#### Mathematical Coordinate Transformation
- Touch contact coordinate: `(clientX, clientY)` in viewport CSS pixels.
- Reticle target coordinate:
  $$\text{reticleX} = \text{clientX}$$
  $$\text{reticleY} = \text{clientY} - \text{cursorOffsetPx}$$
- Default offset: `DEFAULT_CURSOR_OFFSET_PX = 64` (approximately 14–16mm on standard mobile displays, placing the reticle comfortably above the user's thumb/finger contact patch).
- Configurable range: $0 \le \text{cursorOffsetPx} \le 200$. When set to $0$, reticle aligns directly with the touch contact point.

#### Raycasting Execution
- Ray generation:
  $$\text{ray} = \text{renderer.rayFromClient}(\text{reticleX}, \text{reticleY})$$
- Volume boundary clipping:
  $$\text{clippedRay} = \text{clipRayToBox}(\text{ray}, \text{this.bounds})$$
- DDA voxel traversal via `raycast(this.volume, clippedRay.origin, ray.direction, { maxDistance, accept })`:
  - `accept`: enforces layer slicing: `inSlice(this.slice, y)` and skips touched cells during brush painting.
- Resulting `RayHit`:
  - `hit.position`: targeted existing voxel coordinate $[X, Y, Z]$ (used for Erase, Paint/Replace, Eyedropper, Inspect).
  - `hit.adjacent`: targeted empty voxel coordinate $[X, Y, Z]$ adjacent to targeted face (used for Place, Line, Rectangle).
  - `hit.normal`: face normal unit vector (used for brush plane locking).

---

### Specification 3: Visual Reticle Indicator

The visual indicator consists of two coordinated systems: a 2D DOM viewport overlay and a 3D WebGL scene highlight.

#### 1. 2D Viewport Overlay (`ReticleOverlay.svelte` or inline DOM SVG)
- Active condition: rendered whenever a 1-finger touch is down on the canvas during an active editing tool (`tool !== "navigate"`).
- Components:
  1. **Touch Contact Point**: A translucent circle at `(clientX, clientY)`:
     - Diameter: 28px (radius 14px).
     - Styling: `fill: rgba(244, 241, 235, 0.25); stroke: rgba(244, 241, 235, 0.6); stroke-width: 1.5px;`.
  2. **Connecting Stem Line**: A vertical line connecting contact point to target reticle:
     - Coordinates: from `(clientX, clientY - 14)` to `(reticleX, reticleY + 12)`.
     - Styling: `stroke: #f4f1eb; stroke-width: 1.5px; stroke-dasharray: 3 3; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7));`.
  3. **Target Reticle Crosshair**: A circular crosshair centered at `(reticleX, reticleY)`:
     - Outer ring diameter: 24px (radius 12px).
     - Center dot diameter: 4px (radius 2px).
     - 4 tick marks: 4px length extending along cardinal axes.
     - Styling: `stroke: #f4f1eb; stroke-width: 2px; fill: none; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));`.
- DOM container attributes: `pointer-events: none; position: fixed; inset: 0; z-index: 45;`.

#### 2. 3D World Highlights (`renderer.highlight`)
- `EditSession.refreshHighlight()` draws in the 3D scene:
  - If target voxel exists: `{ min: hit.position, max: hit.position, style: "hover" }` (wireframe highlight box around targeted block).
  - If placing: `{ min: hit.adjacent, max: hit.adjacent, style: "ghost" }` (semi-transparent ghost preview box of the active block).

---

### Specification 4: Single-Tap Placement, Replacement, and Erase

#### Trigger Criteria
- Touch duration: $t_{\text{up}} - t_{\text{down}} < 450\text{ ms}$.
- Touch displacement: $\max \left( \sqrt{(x - x_0)^2 + (y - y_0)^2} \right) \le 8\text{ px}$.
- Emitted by arbiter as `{ type: "tap", clientX, clientY }`.

#### Action by Tool
1. **Place Tool (`tool === "place"`)**:
   - Query hit: `hit = this.pick(clientX, clientY - cursorOffsetPx)`.
   - If `hit === null`: abort (no-op).
   - If `!inSlice(this.slice, hit.adjacent[1])`: abort (outside slice).
   - Execute: `this.placeAt(hit.adjacent, this.block)`.
   - Result: 1 block placed at `hit.adjacent`. `editor.history.push()` records 1 command. Exactly 1 undo step created.
2. **Replace / Paint Tool (`tool === "paint"`)**:
   - Query hit: `hit = this.pick(clientX, clientY - cursorOffsetPx)`.
   - If `hit === null` or target cell already contains `this.block`: abort.
   - Execute: `this.placeAt(hit.position, this.block)`.
   - Result: 1 block replaced at `hit.position`. Exactly 1 undo step created.
3. **Erase Tool (`tool === "erase"`)**:
   - Query hit: `hit = this.pick(clientX, clientY - cursorOffsetPx)`.
   - If `hit === null`: abort.
   - Execute: `this.eraseAt(hit.position)`.
   - Result: 1 block cleared to air at `hit.position`. Exactly 1 undo step created.
4. **Eyedropper Tool (`tool === "eyedropper"`)**:
   - Query hit: `hit = this.pick(clientX, clientY - cursorOffsetPx)`.
   - If `hit === null`: abort.
   - Execute: `this.block = withoutNbt(hit.block); this.tool = "place";`.

---

### Specification 5: Continuous Brush Painting

#### Stroke Initiation (`oneFingerDragStart`)
- Trigger: displacement from initial touch exceeds `tapSlopPx` (8px).
- Raycast through reticle: `hit = this.pick(clientX, clientY - cursorOffsetPx)`.
- If `hit === null`: drag does not start (idle).
- Surface plane locking:
  - `axis = normalAxis(hit.normal)` (0 for X, 1 for Y, 2 for Z).
  - Target cell: `cell = tool === "place" ? hit.adjacent : hit.position`.
  - `layer = axis === null ? 0 : cell[axis]`.
- Stroke instantiation:
  - `stroke = this.editor.beginStroke(toolLabel)`.
  - `drag = { kind: "brush", tool, stroke, axis, layer, last: null, touched: new Set() }`.
  - Apply initial block: `brushTo(drag, hit)`.

#### Continuous Movement (`oneFingerDragMove`)
- On each touch move sample:
  - Reticle point: `(reticleX, reticleY) = (clientX, clientY - cursorOffsetPx)`.
  - Raycast query skipping touched cells:
    $$\text{hit} = \text{this.pick}(\text{reticleX}, \text{reticleY}, (\text{cx}, \text{cy}, \text{cz}) \Rightarrow \text{drag.touched.has(`${cx},${cy},${cz}`))}$$
  - Surface plane constraint:
    - Verify `normalAxis(hit.normal) === drag.axis`.
    - Verify `cell[drag.axis] === drag.layer`.
    - If surface plane diverges, skip applying block (maintains flat plane).
  - Hole prevention via interpolation:
    - If `drag.last !== null` and Manhattan distance $\le 64$:
      $$\text{cells} = \text{linePoints}(\text{drag.last}, \text{cell}).\text{slice}(1)$$
    - Else: `cells = [cell]`.
  - Command execution:
    - Build `placeCells(volume, cells, block)` or `eraseCells(volume, cells)`.
    - Apply transactionally: `drag.stroke.apply(command)`.
    - Record cells in `drag.touched`.
    - Trigger `afterChange(command)` to dirty affected sections and trigger re-meshing.

#### Stroke Commitment (`oneFingerDragEnd`)
- On finger release:
  - Invoke `drag.stroke.commit()`.
  - All commands applied during the drag are merged into a single `Command` history entry.
  - Increment `this.revision`.
  - Display confirmation: `this.message = "${drag.stroke.label} done (Ctrl+Z undoes it)"`.
  - Clear `this.drag = null` and clear reticle overlay.
  - **Single Undo Guarantee**: Calling `session.undo()` once rolls back every block painted during the entire continuous stroke.

---

### Specification 6: Drag-Off and Toolbar Abort

#### Abort Trigger Zones
During an active brush stroke (`drag.kind === "brush"`), after computing `(reticleX, reticleY)`:
1. **Canvas Bounding Rect Abort**:
   - `const canvasRect = this.canvas.getBoundingClientRect()`.
   - Condition:
     $$\text{reticleX} < \text{canvasRect.left} \quad\lor\quad \text{reticleX} > \text{canvasRect.right} \quad\lor\quad \text{reticleY} < \text{canvasRect.top}$$
2. **Bottom Toolbar Abort**:
   - `const toolbarRect = document.querySelector('[data-testid="bottom-toolbar"]')?.getBoundingClientRect()`.
   - Threshold: `toolbarTop = toolbarRect ? toolbarRect.top : (window.innerHeight - 56)`.
   - Condition:
     $$\text{clientY} \ge \text{toolbarTop} \quad\lor\quad \text{reticleY} \ge \text{toolbarTop}$$

#### Abort Execution
Upon detecting either abort condition:
1. Call `this.cancelDrag()`.
2. Inside `cancelDrag()`:
   ```typescript
   if (drag.kind === "brush") {
     drag.stroke.cancel(); // reverts all commands in reverse order
     this.flush();         // marks reverted sections dirty in renderer
   }
   this.drag = null;
   this.hover = null;
   this.reticle = null;
   this.refreshHighlight();
   ```
3. Set internal drag abort flag to suppress any further painting until all fingers lift.
4. Output status: `this.message = "Stroke cancelled"`.
5. Result: Volume is 100% restored to its pre-stroke state. Exactly 0 history entries created. `undoCount` unchanged.

---

### Specification 7: Second-Finger Stroke Abort

#### Arbiter Transition Mechanics
1. Active state: One finger dragging (`arbiter.state === "one_pointer_dragging"`, `dragActive === true`).
2. Event: Second finger contacts canvas (`PointerSample` with `type === "down"`, new `id`, `pointers.size === 2`).
3. Arbiter actions in `feed(sample)`:
   - Sets `this.dragActive = false`.
   - Sets `this.abortedDrag = true`.
   - Emits `{ type: "cancel" }`.
   - Transitions to `"two_pointer_gesture"`.
   - Initializes two-finger center and spread references for pan/pinch.

#### Session Reaction
1. `EditSession` receives `{ type: "cancel" }`.
2. Invokes `this.cancelDrag()`.
3. Calls `drag.stroke.cancel()`. Every block placed during the stroke is unapplied via `revertCommand()`.
4. Renderer sections are marked dirty and re-meshed.
5. All interim blocks vanish from screen; the volume matches its state prior to finger 1 touch-down.
6. As the two fingers move:
   - Arbiter emits `twoFingerPan` and/or `pinch`.
   - Page/session executes `renderer.panBy(intent.dx, intent.dy)` and `renderer.zoomBy(intent.factor)`.
   - Zero painting occurs.
7. Result: Zero half-painted strokes; smooth, natural handoff from editing to camera manipulation.

---

### Specification 8: Eyedropper Long-Press Pick

#### Activation Semantics
- Active tool: Any tool (`place`, `paint`, `erase`, `line`, `rectangle`, `select`).
- Gesture: One finger down, held stationary for $\ge 450\text{ ms}$ with movement $\le 8\text{ px}$.
- Arbiter fires timer, transitions to `"one_pointer_long_press"`, and emits:
  `{ type: "longPress", clientX: p.curX, clientY: p.curY }`.

#### Pick Execution in `EditSession`
1. Compute reticle target: `(reticleX, reticleY) = (clientX, clientY - cursorOffsetPx)`.
2. Query hit: `hit = this.pick(reticleX, reticleY)`.
3. If `hit === null`: no block under reticle; return without action.
4. If `hit !== null`:
   - Extract base block identifier: `const clean = withoutNbt(hit.block)`.
   - Assign block: `this.block = clean`.
   - Assign inspected: `this.inspected = hit.position`.
   - Feedback message: `this.message = "Picked ${clean.replace('minecraft:', '')}"`.
   - **Crucial Invariant**: `this.tool` is **NOT** modified. If user was in `place`, tool remains `place`. If in `paint`, remains `paint`.
   - Optional haptic feedback: `if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40)`.

#### Touch Release Suppression
- When the finger subsequently lifts (`pointerup`):
  - Arbiter detects `state === "one_pointer_long_press"`.
  - Suppresses `tap` intent (does not emit `{ type: "tap" }`).
  - Resets to `"idle"`.
- Result: Picking a block never accidentally places a block upon lifting the finger.

---

### Specification 9: Live Cell Readout Bar

#### Visual Layout & Positioning
- Fixed location directly above bottom toolbar:
  - `bottom: calc(56px + env(safe-area-inset-bottom, 0px))`.
  - Centered or full-width pill above bottom toolbar.
  - Height: 28px.
  - Background: `#24221f` with 85% opacity, border `#3d3a34`, border-radius 6px.
  - Text color: `#f4f1eb`, font: `ui-monospace, monospace`, font-size: `0.78rem`.
  - Data testid: `data-testid="live-cell-readout"` (and `data-testid="cell-readout"` alias).

#### Information Display Logic
- When `session.hover !== null`:
  - Shows targeted coordinate and block name:
    `[X, Y, Z] · block_name`
    (e.g., `12, 64, -5 · oak_planks`).
- When cell is armed (confirm mode in MB5):
  - Shows armed cell coordinate and name with `[ARMED]` badge.
- When pointing at empty air / sky:
  - Shows `— · air` or `No cell targeted`.

#### Accessibility Contract
- Container attributes:
  - `role="status"`
  - `aria-live="polite"`
  - `aria-atomic="true"`
  - `aria-label="Target cell readout"`
- Screen readers announce the targeted cell position and block type as the reticle moves over scene elements.

---

### Specification 10: Desktop Mouse & Keyboard Parity

The mobile touch additions must produce **zero regressions** on desktop mouse and keyboard workflows:
1. **Pointer Event Discrimination**:
   - `onPointerDown`, `onPointerMove`, `onPointerUp`:
     ```typescript
     if (e.pointerType === "touch") {
       this.arbiter.feed(pointerEventToSample(e));
       return;
     }
     ```
   - Mouse events (`pointerType === "mouse"`) bypass `GestureArbiter` and the offset cursor entirely.
   - Mouse cursor offset is strictly $0$ (`reticleY = clientY`).
2. **Camera Controls Parity**:
   - Mouse left-drag on View tool orbits.
   - Alt + left-drag orbits.
   - Shift + left-drag or Right-drag pans.
   - Mouse wheel zooms.
3. **Desktop Shortcut Parity**:
   - `Ctrl+Z` / `Cmd+Z` (Undo), `Ctrl+Shift+Z` / `Ctrl+Y` (Redo).
   - Tool shortcut keys: `V`, `P`, `B`, `X`, `I`, `L`, `R`, `M`, `F`, `[`, `]`.
   - `Esc`: cancels active drag, clears selection, or returns to View.
4. **Desktop Layout Parity**:
   - Three-column layout above 1000px breakpoint on fine pointer devices remains visually and functionally identical.
   - Existing E2E suites (`editor-suite.ts`, `e2e.ts`, `m4-suite.ts`) pass without modification.

---

### Specification 11: Exit Criteria and Test Requirements

#### 1. Vitest Unit & Session Tests (`apps/web/test/`)
- Test file: `apps/web/test/editor-session-touch.test.ts` (using mock renderer and synthetic Volume).
- **Required Assertions**:
  1. *Offset Cursor Math*: Assert `session.pick` receives `clientY - 64` when touch coordinate is `clientY`.
  2. *Single-Tap Placement*: Dispatch tap on voxel at $(10, 64, 10)$; assert volume at adjacent coordinate receives block; assert `session.undoCount === 1`; assert `session.undo()` removes block.
  3. *Single-Tap Erase*: Select Erase tool; dispatch tap on block; assert cell becomes `minecraft:air`; assert 1 undo step.
  4. *Single-Tap Replace*: Select Paint tool; dispatch tap on stone; assert cell becomes active block; assert 1 undo step.
  5. *Continuous Brush Stroke*: Dispatch touch down, 5 sequential move events across surface plane, and touch up; assert all 5 cells are populated; assert `session.undoCount === 1`; assert single `session.undo()` removes all 5 cells.
  6. *Second-Finger Stroke Cancel*: Dispatch touch down, 3 move events, followed by pointer 2 touch down; assert `Stroke.cancel()` reverts volume to initial state; assert `session.undoCount === 0`.
  7. *Drag-Off Abort*: Dispatch touch down, drag moves past `reticleY < 0`; assert stroke cancelled; volume clean.
  8. *Toolbar Abort*: Dispatch touch down, drag moves into toolbar zone (`clientY >= toolbarTop`); assert stroke cancelled; volume clean.
  9. *Long-Press Eyedropper*: Dispatch touch down at $(10, 64, 10)$; advance time 450ms; assert `session.block` equals block at $(10, 64, 10)$; assert `session.tool` remains unchanged; dispatch touch up and assert no block placed.
  10. *Configurable Offset*: Update `session.cursorOffsetPx = 80`; assert raycast receives `clientY - 80`.

#### 2. End-to-End Touch Browser Tests (`apps/web/test/touch-e2e.ts`)
- Execution environment: Headless Chromium with touch emulation (`MOBILE_VIEWPORT`: 390 x 844, DPR 3, `hasTouch: true`).
- **Required Assertions**:
  1. *Mobile Reticle Presence*: While touch drag is active, assert DOM element `[data-testid="reticle-overlay"]` or SVG reticle is visible with connection line.
  2. *Live Cell Readout*: While touching house block, assert `[data-testid="live-cell-readout"]` displays matching $[X, Y, Z]$ and block name.
  3. *Touch Single-Tap E2E*: Calculate screen point of roof block via `window.__voxwright.renderer.clientFromWorld(x, y, z)`. Dispatch CDP touch tap at `(pt.x, pt.y + 64)`. Verify block placed at $[X, Y, z]$. Tap Undo button (`data-testid="undo"`) and verify block removed.
  4. *Touch Brush Stroke E2E*: Dispatch multi-point CDP drag across 3 adjacent surface cells at `pt.y + 64`. Verify 3 blocks placed. Tap Undo button once. Verify all 3 blocks reverted.
  5. *Second-Finger Abort E2E*: Dispatch CDP drag, inject second finger touch point before release. Verify stroke cancelled and camera enters pan/pinch.
  6. *Eyedropper Long-Press E2E*: Dispatch 500ms CDP touch press on oak plank. Verify active swatch (`data-testid="active-block-swatch"`) updates to `oak_planks` while active tool remains `place`.
  7. *Desktop Parity E2E*: Run standard mouse and keyboard edit suite on desktop viewport (1440 x 900); assert 100% pass rate.

---

## 6. Caveats

1. **Synthetic Touch Coordinates in Headless Chromium**:
   - In CDP touch emulation (`Input.dispatchTouchEvent`), sub-pixel floating point coordinates should be rounded to integer pixels to match real mobile device touch event dispatchers.
2. **Bottom Toolbar Dynamic Safe Area**:
   - On devices with home indicator bars (e.g. modern Android gesture navigation), `env(safe-area-inset-bottom)` can add 16–34px to the toolbar height. Toolbar abort detection should query `getBoundingClientRect().top` dynamically rather than hardcoding `844 - 56`.
3. **Software Renderer Device Fallback**:
   - On devices lacking WebGL2 support, the editor falls back to the CPU software renderer, which remains viewer-only (as mandated by Section 3, Performance Item 8 and Decision 11).

---

## 7. Conclusion

Milestone MB4 bridges mobile touch ergonomics with the existing high-performance voxel editing core:
- By embedding the proven `GestureArbiter` state machine into `EditSession`, touch events are routed cleanly without race conditions or input double-handling.
- The 64px offset cursor resolves the fundamental mobile fat-finger occlusion problem while preserving pixel-exact raycasting.
- The transactional `Stroke` lifecycle guarantees atomic single-undo brush strokes and provides instantaneous, clean cancellation on drag-off, toolbar entry, or second-finger camera transitions.
- The visual reticle overlay, live cell readout bar, and long-press eyedropper create a fluid, accessible mobile editing experience.
- Desktop mouse and keyboard editing remain completely uncompromised with zero regressions.

---

## 8. Verification Method

To independently verify this specification and the codebase state:

1. **Verify Existing Tests and Infrastructure**:
   ```bash
   pnpm test
   ```
   *Expected result*: All 52 test files pass (including `gestures.test.ts`, `gestures-adversarial.test.ts`, `editing.test.ts`, `contrast.test.ts`).

2. **Verify Typecheck**:
   ```bash
   pnpm typecheck
   ```
   *Expected result*: Zero type errors across `@voxwright/core`, `@voxwright/render`, `@voxwright/mcbuilder`, and `@voxwright/web`.

3. **Verify Touch E2E Baseline**:
   ```bash
   pnpm --filter @voxwright/web build
   pnpm test:touch
   ```
   *Expected result*: Touch viewer suite, mobile layout shell, and toolbar target tests pass cleanly.

4. **Verify Milestone MB4 Implementation against this Spec**:
   - Inspect `apps/web/src/lib/editor-session.svelte.ts`: Confirm removal of `pointerType === "touch"` early returns and presence of `GestureArbiter` touch ingestion.
   - Run Vitest touch session suite:
     ```bash
     pnpm vitest run apps/web/test/editor-session-touch.test.ts
     ```
   - Run full touch E2E with MB4 placement checks:
     ```bash
     pnpm test:touch
     ```
