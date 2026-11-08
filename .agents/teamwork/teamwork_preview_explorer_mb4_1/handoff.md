# Milestone MB4 Architectural Handoff Report: Touch Placement with Offset Cursor & Session Lifecycle

**Explorer Agent**: `teamwork_preview_explorer_mb4_1`  
**Milestone**: MB4 (`FEAT-MB4-01` through `FEAT-MB4-09`)  
**Target Audience**: Orchestrator Generation 3 (`1bcb5174782f6d0b5a7a72c91040a991`) and MB4 Implementation Workers  

---

## 1. Observation

### 1.1 Current Touch Early-Returns in `EditSession`
In `apps/web/src/lib/editor-session.svelte.ts`:
- **Line 294** in `onPointerDown(e: PointerEvent)`:
  ```typescript
  if (e.pointerType === "touch" || e.button !== 0 || e.shiftKey || e.altKey) return;
  ```
  `EditSession` explicitly discards all `pointerType === "touch"` down events, preventing editing tool initialization on mobile touch devices.
- **Line 404** in `onPointerMove(e: PointerEvent)`:
  ```typescript
  this.pointer = { x: e.clientX, y: e.clientY };
  if (e.pointerType === "touch") return;
  ```
  `EditSession` discards all touch move events, preventing hover wireframe computation (`this.updateHover`) and brush stroke updates (`this.updateDrag`).

### 1.2 Pure Gesture Arbiter Architecture in `apps/web/src/lib/gestures.ts`
- `GestureArbiter` is an input-agnostic state machine that transforms normalized `PointerSample` streams (`down`, `move`, `up`, `cancel`) into discrete high-level `GestureIntent`s:
  - `tap`: `< 8px` displacement (`tapSlopPx: 8`), `< 450ms` duration (`longPressMs: 450`).
  - `longPress`: `< 8px` displacement held for `>= 450ms` (lines 489–504).
  - `oneFingerDragStart`, `oneFingerDragMove`, `oneFingerDragEnd`: Displacement `> 8px` within 450ms (lines 209–236).
  - `twoFingerPan`, `pinch`: Two concurrent touches evaluated for centroid delta and finger spread (lines 431–487).
  - `cancel`: Automatically triggered upon second finger arrival during an active drag (lines 149–155):
    ```typescript
    } else if (this.pointers.size === 2) {
      this.cancelLongPress();
      // FEAT-MB2-04: Second-finger stroke abort
      if (this.dragActive) {
        this.dragActive = false;
        this.abortedDrag = true;
        intents.push({ type: "cancel" });
      }
      this.state = "two_pointer_gesture";
    ```

### 1.3 WebGL Renderer Raycasting and Camera API
In `packages/render/src/webgl/renderer.ts`:
- `rayFromClient(clientX: number, clientY: number)` (lines 482–494):
  Normalizes client coordinates to NDC coordinates `u = (clientX - r.left) / r.width`, `v = (clientY - r.top) / r.height`, and calls pure `pickRay(...)`. Returns `null` if the point is outside the canvas bounding rect.
- `highlight(boxes: Box[])` (lines 450–478):
  Renders instanced 3D bounding boxes with styles: `"hover"` (targeted cell wireframe), `"ghost"` (block to be placed wireframe), and `"selection"` (selection bounding box).
- Public camera methods: `orbitBy(dx, dy)`, `panBy(dx, dy)`, `zoomBy(factor)`.

### 1.4 Core Transactional Editing Core (`packages/core/src/edit/`)
In `packages/core/src/edit/editor.ts`:
- `Stroke` (lines 20–65):
  - `stroke.apply(command)`: Applies command to `Volume`, marks dirty sections in `DirtyTracker`, records in internal `applied` array.
  - `stroke.commit()`: Merges all applied commands via `mergeCommands(this.label, this.applied)` into exactly **one** undo history entry in `History.push(merged)`. Returns `false` if no cells changed.
  - `stroke.cancel()`: Reverts all applied commands in reverse order and re-marks dirty sections, reverting the volume with zero history entries.
- Atomic edits in `EditSession`:
  - `placeAt(pos: Vec3, block: string)` (lines 738–742): Runs `placeCells` via `this.editor.run(command)`, records 1 undo step.
  - `eraseAt(pos: Vec3)` (lines 745–749): Runs `eraseCells` via `this.editor.run(command)`, records 1 undo step.

### 1.5 Mobile Shell and Toolbar in `apps/web`
- In `apps/web/src/routes/+page.svelte`:
  - `wireTouchGestures` (lines 614–714) currently attaches canvas pointer listeners and feeds `arbiter`. However, `oneFingerDragMove` is hardcoded to `r.orbitBy(intent.dx, intent.dy)` without checking if an editing session or tool is active.
- In `apps/web/src/lib/components/BottomToolbar.svelte`:
  - Displays docked mobile toolbar with `[data-testid="bottom-toolbar"]`, tool buttons (`data-testid="tool-<id>"`), and active block swatch (`data-testid="active-block-swatch"`).
  - Lacks the live cell readout line that exists in desktop `EditToolbar.svelte` (`data-testid="hover"`).

---

## 2. Logic Chain

### 2.1 Interaction Coordination: `EditSession` & `GestureArbiter`
1. On desktop (`pointer: fine` / mouse), `EditSession` directly processes `PointerEvent`s (`button === 0`, `setPointerCapture`), while the WebGL renderer has `input: "builtin"`.
2. On touch devices (`pointer: coarse`), the renderer operates with `input: "external"`, and all pointer samples pass through `GestureArbiter`.
3. To prevent duplicate listeners and state conflicts, `GestureArbiter` in `wireTouchGestures` must serve as the single source of truth for high-level gesture intents on touch.
4. When `session` is active:
   - If `session.tool === "navigate"` (View mode, `session.interactive === false`), one-finger drag moves orbit the camera via `r.orbitBy`, and tap/long-press inspects or picks the block.
   - If `session.tool !== "navigate"` (`session.interactive === true`, e.g. "place", "paint", "erase"):
     - `oneFingerDragStart` → `session.touchDragStart(...)` begins a transactional brush stroke.
     - `oneFingerDragMove` → `session.touchDragMove(...)` paints continuous blocks via `brushTo`.
     - `oneFingerDragEnd` → `session.touchDragEnd(...)` commits the stroke into 1 undo step.
     - `tap` → `session.touchTap(...)` executes an atomic single-tap placement/erasure.
     - `longPress` → `session.touchLongPress(...)` triggers an eyedropper block pick without changing active tool.
     - `cancel` → `session.touchCancel()` cleanly cancels and reverts any active brush stroke.
     - `twoFingerPan` and `pinch` → Forwarded directly to `r.panBy` and `r.zoomBy` for smooth camera control.

### 2.2 Offset Cursor Reticle Mathematics & Rendering
1. Direct finger touch occludes ~35–45px of screen space. In Minecraft schematic editing, a voxel may occupy only 10–30px.
2. By defining `RETICLE_OFFSET_Y = 64`, the reticle target coordinate is evaluated at:
   $$\text{reticleX} = \text{clientX}, \quad \text{reticleY} = \text{clientY} - 64$$
3. Feeding `(reticleX, reticleY)` into `this.renderer.rayFromClient(reticleX, reticleY)` projects a ray directly through the camera view above the user's finger.
4. Raycast via `this.pick(reticleX, reticleY)` identifies the targeted voxel `hit.position` and the placement surface `hit.adjacent`.
5. Visual representation is decoupled into two tiers:
   - **3D World Highlight**: `this.renderer.highlight(boxes)` renders the 3D voxel wireframe (`style: "hover"` on `hit.position`) and the preview block (`style: "ghost"` on `hit.adjacent`).
   - **2D DOM Reticle Indicator (`ReticleOverlay.svelte`)**: An SVG overlay fixed over the canvas (`pointer-events: none; z-index: 25;`) renders:
     - Touch contact ring at `(touchX, touchY)` ($r = 18\text{px}$, subtle translucent fill).
     - Dashed connector stem from `(touchX, touchY)` to `(reticleX, reticleY)`.
     - Reticle target ring at `(reticleX, reticleY)` ($r = 14\text{px}$, center dot, changes to bright cyan `#4dedd5` when over a valid block).

### 2.3 Stroke Transaction Lifecycle
1. **Single-Tap Placement (`FEAT-MB4-04`)**:
   - Touch duration `< 450ms` with displacement `< 8px`.
   - `GestureArbiter` emits `tap`.
   - `session.touchTap(clientX, clientY)` executes:
     - For `"place"`: `this.placeAt(hit.adjacent, this.block)`
     - For `"paint"`: `this.placeAt(hit.position, this.block)`
     - For `"erase"`: `this.eraseAt(hit.position)`
     - For `"eyedropper"`: `this.block = withoutNbt(hit.block); this.message = \`Picked \${this.block}\`; this.tool = "place"`
   - Atomic commit adds exactly **one** record to `editor.history`.
2. **Continuous Brush Painting (`FEAT-MB4-05`)**:
   - Displacement exceeds `8px`.
   - `GestureArbiter` emits `oneFingerDragStart`. `session.touchDragStart(...)` initializes `drag = { kind: "brush", stroke: this.editor.beginStroke(label), ... }`.
   - Each `oneFingerDragMove` invokes `brushTo(drag, hit)` which paints voxels along the initial contact plane and appends commands to `drag.stroke.apply(command)`.
   - On release, `GestureArbiter` emits `oneFingerDragEnd`. `session.touchDragEnd(...)` calls `drag.stroke.commit()`, which merges all applied commands into exactly **one** undo history entry.
3. **Drag-Off & Toolbar Cancellation (`FEAT-MB4-06`)**:
   - When finger/reticle moves outside canvas bounds (`reticleY < 0`, `reticleX < 0`, `reticleX > window.innerWidth`) or enters the bottom toolbar zone (`clientY >= toolbarTop` or `reticleY >= toolbarTop`), `session.touchMove` detects out-of-bounds.
   - It invokes `this.cancelDrag()`, which executes `drag.stroke.cancel()`, reverts all modified voxels, and re-meshes dirty sections.
4. **Second Finger Arrival Abort (`FEAT-MB2-04`)**:
   - When a second touch appears mid-drag, `GestureArbiter` line 153 immediately emits `{ type: "cancel" }` and transitions state to `"two_pointer_gesture"`.
   - `session.touchCancel()` calls `this.cancelDrag()`.
   - The brush stroke is discarded with 0 committed changes, and the two fingers immediately transition to panning/pinching the camera.

### 2.4 Live Cell Readout Bar (`FEAT-MB4-08`)
1. In desktop layout, `EditToolbar.svelte` displays `session.hover.position` and `session.hover.block` inside `<span data-testid="hover">`.
2. In mobile layout, `EditToolbar.svelte` is unmounted.
3. Positioning a dedicated `.cell-readout-bar` directly above the mobile tool row inside `BottomToolbar.svelte`:
   - Stays within thumb reach without obscuring the canvas.
   - Displays `[X, Y, Z]` and block name for the cell currently targeted by the reticle.
   - Includes `role="status"` and `aria-live="polite"` for accessibility.
   - Retains `data-testid="hover"` and `data-testid="cell-block"` for automated test parity.

---

## 3. Caveats

1. **Setting the Reticle Offset**: The default offset is fixed at $64\text{px}$ per specification. In milestone MB5/MB8, this will become user-configurable in settings.
2. **Line, Rectangle, and Box Selection Tools**: In MB4, Line, Rectangle, and Select tools can be previewed and dragged by touch using the offset cursor. Modal corner nudging and two-point click-to-place confirmation mode are part of Milestone MB5 (`FEAT-MB5-01` through `FEAT-MB5-05`).
3. **Multi-Touch Tap Shortcuts**: Optional 2-finger tap (undo) and 3-finger tap (redo) are part of Milestone MB8 polish and remain off by default.

---

## 4. Conclusion & Architectural Design

### 4.1 Interface Additions to `EditSession` (`apps/web/src/lib/editor-session.svelte.ts`)

```typescript
export interface ReticleState {
  active: boolean;
  touchX: number;
  touchY: number;
  reticleX: number;
  reticleY: number;
  hit: Hover | null;
}

export const RETICLE_OFFSET_Y = 64;

export class EditSession {
  // Existing state properties preserved...
  
  /** Reactive state for the mobile offset cursor reticle */
  reticle = $state.raw<ReticleState | null>(null);

  /** Checks whether reticle or touch has entered toolbar or left canvas */
  isOutOfBounds(clientX: number, clientY: number, reticleY: number): boolean {
    if (reticleY < 0 || clientX < 0 || clientX > window.innerWidth) return true;
    const toolbar = document.querySelector('[data-testid="bottom-toolbar"]');
    if (toolbar) {
      const rect = toolbar.getBoundingClientRect();
      if (clientY >= rect.top || reticleY >= rect.top) return true;
    }
    return false;
  }

  // --- Touch Lifecycle Methods ---

  touchDown(clientX: number, clientY: number): void {
    if (!this.interactive) return;
    const reticleY = clientY - RETICLE_OFFSET_Y;
    const hit = this.pick(clientX, reticleY);
    this.reticle = { active: true, touchX: clientX, touchY: clientY, reticleX: clientX, reticleY, hit };
    this.hover = hit;
    if (hit) this.inspected = hit.position;
    this.refreshHighlight();
  }

  touchMove(clientX: number, clientY: number): void {
    if (!this.interactive || !this.reticle?.active) return;
    const reticleY = clientY - RETICLE_OFFSET_Y;
    if (this.isOutOfBounds(clientX, clientY, reticleY)) {
      if (this.drag !== null) this.cancelDrag();
      this.reticle = null;
      this.hover = null;
      this.refreshHighlight();
      return;
    }
    const hit = this.pick(clientX, reticleY);
    this.reticle = { active: true, touchX: clientX, touchY: clientY, reticleX: clientX, reticleY, hit };
    this.hover = hit;
    if (hit) this.inspected = hit.position;
    if (this.drag !== null) {
      this.updateDrag(clientX, reticleY);
    }
    this.refreshHighlight();
  }

  touchDragStart(clientX: number, clientY: number): void {
    if (!this.interactive) return;
    const reticleY = clientY - RETICLE_OFFSET_Y;
    const hit = this.pick(clientX, reticleY);
    if (!hit) return;
    const tool = this.tool;
    if (tool === "place" || tool === "paint" || tool === "erase") {
      if (tool !== "erase") canonicalize(this.block);
      this.beginBrush(tool, hit);
    }
    this.refreshHighlight();
  }

  touchDragMove(clientX: number, clientY: number, _dx: number, _dy: number): void {
    if (!this.interactive || this.drag === null) return;
    const reticleY = clientY - RETICLE_OFFSET_Y;
    if (this.isOutOfBounds(clientX, clientY, reticleY)) {
      this.cancelDrag();
      this.reticle = null;
      this.hover = null;
      this.refreshHighlight();
      return;
    }
    this.updateDrag(clientX, reticleY);
  }

  touchDragEnd(clientX: number, clientY: number): void {
    if (this.drag !== null) {
      const reticleY = clientY - RETICLE_OFFSET_Y;
      this.updateDrag(clientX, reticleY);
      const drag = this.drag;
      this.drag = null;
      if (drag.kind === "brush") {
        if (drag.stroke.commit()) {
          this.revision++;
          this.message = `${drag.stroke.label} done (Undo to revert)`;
        }
      }
    }
    this.reticle = null;
    this.hover = null;
    this.refreshHighlight();
  }

  touchTap(clientX: number, clientY: number): void {
    if (!this.interactive) {
      if (this.tool === "navigate") {
        const hit = this.pick(clientX, clientY);
        if (hit) {
          this.inspected = hit.position;
          this.refreshHighlight();
        }
      }
      return;
    }
    const reticleY = clientY - RETICLE_OFFSET_Y;
    const hit = this.pick(clientX, reticleY);
    if (hit) {
      switch (this.tool) {
        case "place":
          this.placeAt(hit.adjacent, this.block);
          break;
        case "paint":
          this.placeAt(hit.position, this.block);
          break;
        case "erase":
          this.eraseAt(hit.position);
          break;
        case "eyedropper":
          this.block = withoutNbt(hit.block);
          this.message = `Picked ${this.block}`;
          this.tool = "place";
          break;
      }
    }
    this.reticle = null;
    this.hover = null;
    this.refreshHighlight();
  }

  touchLongPress(clientX: number, clientY: number): void {
    const reticleY = clientY - RETICLE_OFFSET_Y;
    const hit = this.pick(clientX, reticleY) ?? this.pick(clientX, clientY);
    if (hit) {
      this.block = withoutNbt(hit.block);
      this.message = `Picked ${this.block}`;
      this.pointAt(hit.position);
      try {
        navigator.vibrate?.(15);
      } catch {}
    }
  }

  touchCancel(): void {
    if (this.drag !== null) {
      this.cancelDrag();
    }
    this.reticle = null;
    this.hover = null;
    this.refreshHighlight();
  }
}
```

### 4.2 Reticle Visual Overlay Component (`apps/web/src/lib/components/ReticleOverlay.svelte`)

```svelte
<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import type { EditSession } from "../editor-session.svelte.ts";

let { session }: { session: EditSession } = $props();
const reticle = $derived(session.reticle);
</script>

{#if reticle && reticle.active}
  <svg
    class="reticle-svg"
    data-testid="reticle-indicator"
    aria-hidden="true"
  >
    <!-- Connector stem -->
    <line
      x1={reticle.touchX}
      y1={reticle.touchY}
      x2={reticle.reticleX}
      y2={reticle.reticleY}
      class="reticle-stem"
    />
    <!-- Touch contact ring -->
    <circle
      cx={reticle.touchX}
      cy={reticle.touchY}
      r="16"
      class="reticle-touch"
    />
    <!-- Target reticle ring -->
    <circle
      cx={reticle.reticleX}
      cy={reticle.reticleY}
      r="14"
      class="reticle-target"
      class:hit={reticle.hit !== null}
    />
    <!-- Center reticle dot -->
    <circle
      cx={reticle.reticleX}
      cy={reticle.reticleY}
      r="2"
      class="reticle-dot"
    />
  </svg>
{/if}

<style>
  .reticle-svg {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 25;
  }
  .reticle-stem {
    stroke: rgba(255, 255, 255, 0.65);
    stroke-width: 2;
    stroke-dasharray: 3 3;
  }
  .reticle-touch {
    fill: rgba(255, 255, 255, 0.12);
    stroke: rgba(255, 255, 255, 0.45);
    stroke-width: 1.5;
  }
  .reticle-target {
    fill: none;
    stroke: #f4f1eb;
    stroke-width: 2.5;
    filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.7));
    transition: stroke 0.1s ease;
  }
  .reticle-target.hit {
    stroke: #4dedd5;
  }
  .reticle-dot {
    fill: #f4f1eb;
  }
</style>
```

### 4.3 Live Cell Readout Bar Integration in `BottomToolbar.svelte`

Add docked readout bar above toolbar row inside `.bottom-toolbar-container`:
```svelte
<div class="bottom-toolbar-container" data-testid="bottom-toolbar">
  <!-- Live cell readout bar -->
  <div
    class="cell-readout-bar"
    data-testid="cell-readout-bar"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <div class="readout-cell">
      <span class="readout-coord" data-testid="hover">
        {#if session.hover}
          [{session.hover.position.join(", ")}]
        {:else if session.inspected}
          [{session.inspected.join(", ")}]
        {:else}
          [—, —, —]
        {/if}
      </span>
      <span class="readout-sep" aria-hidden="true">·</span>
      <span class="readout-block" data-testid="cell-block">
        {#if session.hover}
          {session.hover.block.replace("minecraft:", "")}
        {:else if session.inspectedBlock}
          {session.inspectedBlock.replace("minecraft:", "")}
        {:else}
          {session.block.replace("minecraft:", "")}
        {/if}
      </span>
    </div>
    {#if session.message}
      <span class="readout-msg" data-testid="edit-message">{session.message}</span>
    {:else if session.error}
      <span class="readout-error" data-testid="edit-error">{session.error}</span>
    {/if}
  </div>

  <div class="bottom-toolbar" role="toolbar" ...>
    ...
```

### 4.4 Coordination in `+page.svelte` (`wireTouchGestures`)

Update `wireTouchGestures` in `apps/web/src/routes/+page.svelte` to invoke session touch methods on pointer events and gesture intents:
```typescript
  const arbiter = new GestureArbiter({
    onIntent: (intent: GestureIntent) => {
      switch (intent.type) {
        case "oneFingerDragStart":
          flushTwoFinger();
          if (session?.interactive) {
            session.touchDragStart(intent.clientX, intent.clientY);
          }
          break;
        case "oneFingerDragMove":
          flushTwoFinger();
          if (session?.interactive) {
            session.touchDragMove(intent.clientX, intent.clientY, intent.dx, intent.dy);
          } else {
            r.orbitBy(intent.dx, intent.dy);
          }
          break;
        case "oneFingerDragEnd":
          flushTwoFinger();
          if (session?.interactive) {
            session.touchDragEnd(intent.clientX, intent.clientY);
          }
          break;
        case "tap":
          flushTwoFinger();
          if (session) {
            session.touchTap(intent.clientX, intent.clientY);
          }
          break;
        case "longPress":
          flushTwoFinger();
          if (session) {
            session.touchLongPress(intent.clientX, intent.clientY);
          }
          break;
        case "twoFingerPan":
          pendingPan = { dx: intent.dx, dy: intent.dy };
          scheduleFlushTwoFinger();
          break;
        case "pinch":
          pendingPinch = { factor: intent.factor };
          scheduleFlushTwoFinger();
          break;
        case "cancel":
          flushTwoFinger();
          if (session?.interactive) {
            session.touchCancel();
          }
          break;
      }
    },
  });

  const onDown = (e: PointerEvent): void => {
    c.focus({ preventScroll: true });
    try {
      c.setPointerCapture(e.pointerId);
    } catch {}
    e.preventDefault();
    if (session?.interactive) {
      session.touchDown(e.clientX, e.clientY);
    }
    arbiter.feed(pointerEventToSample(e));
    flushTwoFinger();
  };

  const onMove = (e: PointerEvent): void => {
    if (session?.interactive) {
      session.touchMove(e.clientX, e.clientY);
    }
    arbiter.feed(pointerEventToSample(e));
    flushTwoFinger();
  };

  const onCancel = (e: PointerEvent): void => {
    if (session?.interactive) {
      session.touchCancel();
    }
    arbiter.feed(pointerEventToSample(e));
    flushTwoFinger();
  };
```

Mount `<ReticleOverlay {session} />` inside `+page.svelte` when `session` exists and mobile layout is active.

---

## 5. Verification Method

### 5.1 Unit Tests (`apps/web/test/editor-touch.test.ts`)
Run:
```bash
pnpm --filter @voxwright/web test
```
Verify synthetic tests for:
1. Single tap placement with offset: Touch down at $(200, 300)$, tap fires, block placed at $(200, 236)$ raycast coordinate.
2. 1-undo invariant: Single tap creates exactly 1 history undo entry.
3. Continuous brush drag: Drag from $(200, 300)$ to $(250, 300)$ paints multiple voxels; `undo()` reverts all of them in a single step.
4. Second-finger abort: Mid-stroke touch down of second finger triggers `cancel`, reverts all painted voxels, and leaves 0 new undo history entries.
5. Drag-off canvas cancel: Moving reticle to $y = -10$ or into toolbar triggers `cancelDrag()`.
6. Long-press pick: Holding for 450ms picks the voxel under the reticle without changing the active tool.

### 5.2 Mobile Touch End-to-End Suite (`apps/web/test/touch-e2e.ts`)
Run:
```bash
pnpm --filter @voxwright/web build
node apps/web/test/touch-e2e.ts
```
Assertions to add/verify:
1. Select "Place" tool from mobile bottom toolbar.
2. Tap canvas via CDP `Input.dispatchTouchEvent`: Assert reticle indicator appears, block placed at reticle coordinate, cell readout bar displays voxel `[X, Y, Z]` and block name.
3. Perform touch drag: Verify continuous brush stroke creates a line of blocks and thumb cluster Undo reverts the entire line.
4. Verify desktop suites (`e2e.ts`, `editor-suite.ts`, `m4-suite.ts`) remain 100% green without regressions.
