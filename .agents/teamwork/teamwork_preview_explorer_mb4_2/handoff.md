# Milestone MB4 Verification Plan & Test Harness Analysis

**Agent**: `teamwork_preview_explorer_mb4_2` (Test & Verification Explorer)  
**Parent**: Orchestrator Generation 3 (`1bcb5174782f6d0b5a7a72c91040a991`)  
**Target Milestone**: MB4 (Touch placement with offset cursor)  
**Document Path**: `/home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_explorer_mb4_2/handoff.md`  

---

## 1. Observation

### 1.1 Existing Session & Input Handling Invariants
1. **Touch Early-Return in `EditSession`**:
   In `apps/web/src/lib/editor-session.svelte.ts`:
   - Line 294:
     ```typescript
     if (e.pointerType === "touch" || e.button !== 0 || e.shiftKey || e.altKey) return;
     ```
   - Line 404:
     ```typescript
     if (e.pointerType === "touch") return;
     ```
   These lines currently drop touch pointer events completely from editing.
2. **Raycasting & Coordinate Mapping in `packages/render/src/webgl/renderer.ts`**:
   - `rayFromClient(clientX: number, clientY: number)` (lines 482–494):
     Calculates normalized device coordinates `(u * 2 - 1, 1 - v * 2)` from client coordinates, clipped to `[0, 1]`, and returns a world-space ray `{ origin: Vec3; direction: Vec3 } | null` via `pickRay(getPose(), camera.fov, aspect, ndcX, ndcY)`.
   - `clientFromWorld(x: number, y: number, z: number)` (lines 497–505):
     Projects world coordinate `(x, y, z)` through `camera.project()` to calculate exact viewport screen client coordinates `{ x, y }`.
3. **Gesture Arbiter State Machine in `apps/web/src/lib/gestures.ts`**:
   - Lines 38–43:
     ```typescript
     export const DEFAULT_GESTURE_CONFIG = {
       tapSlopPx: 8,
       longPressMs: 450,
       multiTapMaxMs: 300,
       multiTapSlopPx: 12,
     } as const;
     ```
   - Lines 149–155:
     ```typescript
     // FEAT-MB2-04: Second-finger stroke abort
     if (this.dragActive) {
       this.dragActive = false;
       this.abortedDrag = true;
       intents.push({ type: "cancel" });
     }
     ```
   - Lines 382–396:
     Emits `{ type: "longPress", clientX, clientY }` when `currentTime >= startTime + 450ms` and `maxDist <= 8px`.
4. **Existing Test Framework Architecture**:
   - `apps/web/package.json` line 14: `"test": "vitest run --passWithNoTests"`. Vitest runs in Node.js (V8) without native DOM.
   - `apps/web/vite.config.ts` line 70: `test: { name: "web", include: ["test/**/*.test.ts"] }`.
   - Running `pnpm --filter @voxwright/web test` passes 9 test files (124 tests in ~1.8s).
   - `apps/web/test/touch-e2e.ts` serves the production build via Puppeteer and CDP, emulating mobile viewport `390 x 844`, DPR 3, `hasTouch: true`.
   - `editor-suite.ts` (lines 181–208) demonstrates the `tops()` inspection pattern, querying `clientFromWorld(x + 0.5, y + 1, z + 0.5)` to pinpoint top faces of reachable blocks.
5. **Specification Requirements from `docs/mobile-editor-plan.md` (§2.2, §2.3, §4.4) and `PROJECT.md`**:
   - Offset cursor reticle shifts raycast ~64px above finger contact (`clientY - 64`).
   - Single tap (<8px movement, <450ms) places, replaces, or erases block at reticle cell.
   - Dragging paints a continuous brush stroke committed as exactly one undo step (`Stroke`).
   - Second finger arrival mid-stroke triggers `Stroke.cancel()` without leaving orphan blocks.
   - Long press (~450ms, <8px movement) activates eyedropper pick into swatch without changing active tool.
   - Desktop mouse/keyboard editing must preserve 100% parity with zero regressions.

---

## 2. Logic Chain

### 2.1 Vitest Unit Testing Strategy with Mock Renderer & Raycast
1. **Need for Unit-Level Isolation**:
   End-to-end tests in Chromium execute the full WebGL engine, but Vitest unit tests provide sub-millisecond deterministic validation of pure state machine transitions in `EditSession`.
2. **Minimal Mock Environment**:
   `EditSession` requires:
   - `WebglRenderer`: specifically `rayFromClient(x, y)`, `markDirty(keys)`, `highlight(boxes)`, and optionally `clientFromWorld(x, y, z)`.
   - `HTMLCanvasElement`: requires `addEventListener`, `removeEventListener`, `focus`, `setPointerCapture`, `releasePointerCapture`, and `getBoundingClientRect()`.
   - `globalThis.requestAnimationFrame` and `globalThis.cancelAnimationFrame` (Node polyfill via `setTimeout`/`clearTimeout`).
3. **Offset Cursor Invariant (`clientY - 64`)**:
   - In a mock renderer, we record all raycast requests: `mockRenderer.raysCast.push({ clientX, clientY })`.
   - When a touch tap arrives at `(clientX: 150, clientY: 300)`:
     The session must query `rayFromClient(150, 236)` (because `300 - 64 = 236`).
   - By mapping `(150, 236)` to a targeted ground block `[2, 0, 2]`, the tap places a block at `[2, 1, 2]`.
   - A direct assertion `expect(mockRenderer.raysCast[0]).toEqual({ clientX: 150, clientY: 236 })` provides indisputable proof of the 64px offset.
4. **Atomic Drag Stroke & Single Undo**:
   - A sequence of drag moves (`dragStart` -> `dragMove` -> `dragMove` -> `dragEnd`) paints multiple cells along a plane.
   - Internally, `Stroke.apply(command)` modifies volume and marks dirty sections.
   - On `dragEnd`, `Stroke.commit()` pushes exactly ONE composite undo transaction to `editor.history`.
   - `session.undoCount` increases by 1. Calling `session.undo()` removes all painted blocks in that single operation, restoring the volume to its pre-drag snapshot.
5. **Second-Finger Cancellation Invariant**:
   - During an active one-finger brush stroke, if a second touch arrives, `GestureArbiter` emits `{ type: "cancel" }`.
   - The session calls `Stroke.cancel()`. In `@voxwright/core`, `Stroke.cancel()` reverts all changes applied by the active stroke and re-marks dirty sections.
   - In Vitest, we assert that the volume is byte-for-byte identical to the pre-stroke volume snapshot, `session.undoCount` remains 0, and no dangling references exist in `session.drag`.
6. **Eyedropper Long-Press Pick**:
   - Long press timer expires (>450ms, <8px movement), emitting `longPress`.
   - The session picks the block under the reticle `(clientX, clientY - 64)` via `session.block = withoutNbt(hit.block)`.
   - `session.tool` is NOT changed (remains `"place"` or current tool).
   - `session.undoCount` does not increment (non-mutating operation).
   - Upon pointer release, tap placement is suppressed.

### 2.2 CDP / Puppeteer Touch Emulation Strategy in `touch-e2e.ts`
1. **Targeting Real 3D Cells with the Offset Cursor**:
   - In `touch-e2e.ts`, we query reachable blocks via `v.renderer.clientFromWorld(x + 0.5, y + 1, z + 0.5)`.
   - Suppose block `B` has top-face client coordinate `(targetX, targetY)`.
   - Because the reticle sits 64px above the finger, the finger must touch at `(touchX = targetX, touchY = targetY + 64)`.
   - The reticle will land exactly on `(targetX, targetY)`, raycasting directly into block `B`.
2. **Touch Drag Stroke**:
   - `cdpTouchDrag(cdp, { x: startX, y: startY + 64 }, { x: endX, y: endY + 64 }, steps = 8)` sends `touchStart`, 8 `touchMove` events, and `touchEnd`.
   - The entire stroke paints multiple blocks.
   - Bounding box query on `[data-testid="undo"]` allows a single touch tap on the ThumbCluster Undo button (`page.touchscreen.tap(undoX, undoY)`), restoring the volume completely.
3. **Multi-Touch Second-Finger Mid-Stroke Cancel**:
   - Send `touchStart` for finger 1 (`id: 1`).
   - Send `touchMove` for finger 1 (stroke starts painting).
   - Send `touchStart` for finger 2 (`id: 2`, offset by 80px).
   - Send `touchMove` for both fingers (camera pan).
   - Send `touchEnd` for both fingers.
   - Assert `diff(snapBefore, snapAfter).length === 0`.
4. **Long-Press Pick**:
   - Send `touchStart` at `(touchX, touchY + 64)`.
   - Wait 500ms (`await sleep(500)`).
   - Send `touchEnd`.
   - Assert `[data-testid="active-block-swatch"]` text content matches picked block name, and volume was not edited.

---

## 3. Caveats
1. **Headless Environment Performance**: The dev environment runs headless Chromium using SwiftShader software WebGL. Frame settlement must use `renderer.whenIdle()` rather than fixed sleep timers to avoid race conditions.
2. **Safe Touch Y-Coordinates**: The viewport height is 844px. The top app bar occupies ~56px and the bottom toolbar occupies ~56px (`y > 788`). When calculating `touchY = targetY + 64`, `targetY` must be <= 720px so `touchY` remains inside the canvas and does not land on the bottom toolbar or thumb cluster.
3. **Svelte 5 Runes in Test Environment**: `EditSession` uses Svelte 5 `$state` runes. When importing in Vitest, `@sveltejs/vite-plugin-svelte` compiles `.svelte.ts` files automatically. Tests must use Vitest runner through Vite, not plain `node`.

---

## 4. Conclusion & Test Specification

### 4.1 Vitest Unit Test Suite: `apps/web/test/editor-session-touch.test.ts`

```typescript
// Proposed structure for apps/web/test/editor-session-touch.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { Volume, makeBox } from "@voxwright/core";
import { EditSession } from "../src/lib/editor-session.svelte.ts";
import type { Vec3 } from "@voxwright/core";
import type { Box as MarkBox, WebglRenderer } from "@voxwright/render/webgl";

// 1. Mock Renderer & Canvas Harness
class MockRenderer implements Partial<WebglRenderer> {
  public raysCast: { clientX: number; clientY: number }[] = [];
  public dirtyKeys: string[][] = [];
  public marks: readonly MarkBox[] = [];
  public customRay: ((x: number, y: number) => { origin: Vec3; direction: Vec3 } | null) | null = null;

  rayFromClient(clientX: number, clientY: number) {
    this.raysCast.push({ clientX, clientY });
    if (this.customRay) return this.customRay(clientX, clientY);
    // Default mock: ray projecting downwards from Y=50
    return { origin: [clientX, 50, clientY], direction: [0, -1, 0] };
  }

  markDirty(keys: readonly string[]) {
    this.dirtyKeys.push([...keys]);
  }

  highlight(boxes: readonly MarkBox[]) {
    this.marks = boxes;
  }

  whenIdle() {
    return Promise.resolve();
  }
}

function createMockCanvas() {
  const listeners: Record<string, Function[]> = {};
  return {
    parentElement: null,
    addEventListener(event: string, fn: Function) {
      (listeners[event] = listeners[event] || []).push(fn);
    },
    removeEventListener(event: string, fn: Function) {
      listeners[event] = (listeners[event] || []).filter(f => f !== fn);
    },
    focus() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture() { return false; },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 400, height: 800, right: 400, bottom: 800 };
    },
    _emit(event: string, data: any) {
      for (const fn of listeners[event] || []) fn(data);
    }
  } as unknown as HTMLCanvasElement;
}
```

#### Detailed Test Cases
1. **Tap Placement with -64px Offset (`FEAT-MB4-02`, `FEAT-MB4-04`)**:
   - Volume initialized with a 3x3 platform of `minecraft:stone` at Y=0.
   - Mock raycast configured: point `(100, 200)` points at cell `[1, 0, 1]` with normal `[0, 1, 0]`.
   - Contact point is dispatched at `(100, 264)` (i.e. `200 + 64`).
   - Reticle position is calculated as `(100, 264 - 64) = (100, 200)`.
   - Assert: `mockRenderer.raysCast` contains `{ clientX: 100, clientY: 200 }`.
   - Assert: `volume.get(1, 1, 1)` is `"minecraft:gold_block"`.
   - Assert: `session.undoCount === 1`.
2. **Continuous Drag Stroke & Atomic Undo (`FEAT-MB4-05`)**:
   - Volume with stone line from `(0, 0, 0)` to `(9, 0, 0)`.
   - Mock raycast maps `clientX = 50 + i * 20, clientY = 136` to block `(i, 0, 0)`.
   - Drag touch points: start `(50, 200)`, move `(70, 200)`, `(90, 200)`, `(110, 200)`, end `(110, 200)`.
   - Assert: Cells `(0, 1, 0)`, `(1, 1, 0)`, `(2, 1, 0)`, `(3, 1, 0)` are placed.
   - Assert: `session.undoCount === 1` (exactly one undo transaction).
   - Execute `session.undo()`:
     - Assert: ALL 4 blocks are reverted.
     - Assert: `session.undoCount === 0` and `session.canUndo === false`.
3. **Second-Finger Arrival Mid-Stroke Abort (`FEAT-MB2-04`, `FEAT-MB4-01`)**:
   - Snapshot volume before touch.
   - Begin drag stroke: move through 2 points, placing tentative blocks.
   - Simulate second-finger arrival -> trigger `{ type: "cancel" }` / `cancelDrag()`.
   - Assert: Volume equals pre-touch snapshot (zero orphan blocks).
   - Assert: `session.undoCount === 0`.
   - Assert: `session.drag === null`.
4. **Long-Press Eyedropper Pick (`FEAT-MB4-07`)**:
   - Cell `[2, 0, 2]` contains `"minecraft:crying_obsidian"`.
   - `session.tool = "place"`, `session.block = "minecraft:stone"`.
   - Touch down at `(150, 300)` (reticle at `(150, 236)`).
   - Hold for >450ms within 8px slop -> long-press intent.
   - Assert: `session.block === "minecraft:crying_obsidian"`.
   - Assert: `session.tool === "place"` (does not leave Place tool).
   - Assert: `session.undoCount === 0`.
   - Assert: Volume unchanged upon pointer release.

---

### 4.2 End-to-End Suite: `apps/web/test/touch-e2e.ts` Extension

Add the following verification block to `touch-e2e.ts`:

```typescript
// =========================================================================
// PART 1C: MB4 Mobile Touch Placement, Offset Cursor, and Stroke Verification
// =========================================================================

// 1. Single Tap Block Placement at Known Reticle Coordinates
const allTops = await tops();
const targetCell = allTops.find(c => c.pt.y + 64 < 700 && c.pt.y > 100 && c.pt.x > 60 && c.pt.x < 330);
ok(targetCell !== undefined, t("found accessible top-face block for touch placement"));
if (!targetCell) throw new Error("no reachable block for touch placement");

// Choose Place tool & sea_lantern
await page.touchscreen.tap(placeToolBox.x + placeToolBox.width / 2, placeToolBox.y + placeToolBox.height / 2);
await page.evaluate(() => window.__voxwright?.session()?.block = "minecraft:sea_lantern");

const snapBeforeTap = await snapshot();
const undoBeforeTap = (await session()).undoCount;

// Touch at c.pt.y + 64 so reticle hits c.pt.y
const touchPt = { x: targetCell.pt.x, y: targetCell.pt.y + 64 };
await page.touchscreen.tap(touchPt.x, touchPt.y);
await settle();

const snapAfterTap = await snapshot();
const tapDiff = diff(snapBeforeTap, snapAfterTap);
const expectedPlaced = `${targetCell.pos[0]},${targetCell.pos[1] + 1},${targetCell.pos[2]}`;
ok(tapDiff.length === 1 && tapDiff[0] === expectedPlaced, t(`touch tap with offset cursor places block at ${expectedPlaced}`));
ok((await session()).undoCount === undoBeforeTap + 1, t("single touch tap creates exactly 1 undo step"));

// 2. Touch Drag Painting Continuous Stroke & Single-Tap Undo
const snapBeforeDrag = await snapshot();
const undoBeforeDrag = (await session()).undoCount;

// Drag over 80px horizontally
await cdpTouchDrag(cdp, { x: 120, y: touchPt.y }, { x: 220, y: touchPt.y }, 8);
await settle();

const snapAfterDrag = await snapshot();
const dragDiff = diff(snapBeforeDrag, snapAfterDrag);
ok(dragDiff.length >= 3, t(`touch drag painted a continuous stroke of ${dragDiff.length} blocks`));
ok((await session()).undoCount === undoBeforeDrag + 1, t("entire painted stroke commits as exactly ONE undo step"));

// Single tap on ThumbCluster Undo button
const undoBtn = await page.$('[data-testid="undo"]');
const uBox = await undoBtn?.boundingBox();
if (!uBox) throw new Error("Undo button missing");
await page.touchscreen.tap(uBox.x + uBox.width / 2, uBox.y + uBox.height / 2);
await settle();

const snapAfterUndo = await snapshot();
ok(diff(snapBeforeDrag, snapAfterUndo).length === 0, t("single tap on ThumbCluster Undo completely restores pre-drag volume"));

// 3. Multi-Touch 2-Finger Mid-Stroke Cancellation
const snapBeforeCancel = await snapshot();
const undoBeforeCancel = (await session()).undoCount;

// Start stroke with finger 1
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: 140, y: 300, id: 1 }],
});
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [{ x: 170, y: 300, id: 1 }],
});

// Second finger arrives mid-stroke
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [
    { x: 170, y: 300, id: 1 },
    { x: 250, y: 300, id: 2 },
  ],
});
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [
    { x: 190, y: 320, id: 1 },
    { x: 270, y: 320, id: 2 },
  ],
});
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [
    { x: 190, y: 320, id: 1 },
    { x: 270, y: 320, id: 2 },
  ],
});
await settle();

const snapAfterCancel = await snapshot();
ok(diff(snapBeforeCancel, snapAfterCancel).length === 0, t("second finger mid-stroke cancels placement without leaving orphan blocks"));
ok((await session()).undoCount === undoBeforeCancel, t("cancelled stroke adds 0 undo steps"));

// 4. Long-Press Block Pick into Palette Swatch
const stairBlock = allTops.find(c => c.block.includes("stairs"));
if (!stairBlock) throw new Error("no stairs block found");

// Touch at stairBlock.pt.y + 64
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: stairBlock.pt.x, y: stairBlock.pt.y + 64, id: 1 }],
});
await new Promise(r => setTimeout(r, 500)); // > 450ms
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [{ x: stairBlock.pt.x, y: stairBlock.pt.y + 64, id: 1 }],
});
await settle();

const pickedBlock = (await session()).block;
ok(pickedBlock === withoutNbt(stairBlock.block), t(`long press picks block ${pickedBlock} under reticle`));
const swatchText = await page.$eval('[data-testid="active-block-swatch"]', el => el.textContent?.trim());
ok(swatchText?.includes(pickedBlock.replace("minecraft:", "")), t("active swatch displays picked block name"));
```

---

### 4.3 Multi-Tier Pass Criteria Matrix

| Evaluation Tier | Role | Primary Focus | Required Pass Criteria |
|---|---|---|---|
| **Tier 1: Reviewers** | Quality & Spec Reviewers | Specification Compliance & Regression Immunity | 1. 100% pass on desktop test suites (`e2e.ts`, `editor-suite.ts`, `m4-suite.ts`).<br>2. Offset cursor distance strictly 64px (`clientY - 64`).<br>3. Continuous brush stroke undone in exactly one `session.undo()`.<br>4. Multi-touch arrival reverts stroke via `Stroke.cancel()` without orphan blocks.<br>5. Long-press picks block without altering active tool. |
| **Tier 2: Challengers** | Adversarial & Stress Testers | Boundary Conditions & Edge Cases | 1. Reticle drag off-canvas or into bottom toolbar aborts stroke cleanly via `cancelDrag()`.<br>2. High-frequency touch jitter (<8px at 60Hz) does not cancel tap/long-press.<br>3. Rapid multi-touch alternation (20 cycles of 1-finger / 2-finger transitions) leaves zero orphan blocks and zero unhandled errors.<br>4. Rapid Undo/Redo thrashing (20 cycles) on continuous strokes keeps mesh synchronized.<br>5. Raycast outside build bounds gracefully handles null hits without throwing. |
| **Tier 3: Auditors** | Accessibility & Architecture Auditors | Non-Functional Standards & Hygiene | 1. All interactive touch targets >= 44x44px (WCAG 2.5.5); primary controls >= 48x48px.<br>2. Accessible live readout bar (`[data-testid="cell-readout"]`) announces coordinates and block name.<br>3. Zero console errors throughout the entire test suite execution.<br>4. Canvas hygiene: `touch-action: none`, `100dvh`, no document scrolling (`overflow <= 1`, `overflowY <= 1`).<br>5. Layout compliance: no tests, scripts, or source files in `.agents/teamwork/`. |

---

## 5. Verification Method

### 5.1 Independent Vitest Execution
Run Vitest to verify all pure unit tests and session mocks:
```bash
pnpm --filter @voxwright/web test
```
*Expected Result*: All 9 existing test files + new `editor-session-touch.test.ts` pass cleanly (100% green).

### 5.2 Independent Touch E2E Execution
Build and execute the touch emulation suite:
```bash
pnpm --filter @voxwright/web build
node apps/web/test/touch-e2e.ts
```
*Expected Result*: Passes all touch viewer, sheet, and MB4 touch placement checks with 0 console errors.

### 5.3 Independent Desktop E2E Regression Execution
Verify that desktop workflows and existing suites have zero regressions:
```bash
node apps/web/test/e2e.ts
```
*Expected Result*: All WebGL and software renderer checks in `e2e.ts`, `editor-suite.ts`, and `m4-suite.ts` pass.

### 5.4 Typecheck and Code Hygiene
```bash
pnpm typecheck
pnpm check
```
*Expected Result*: 0 TypeScript diagnostic errors and 0 Biome linter warnings.

### 5.5 Invalidation Conditions
This verification plan is invalidated if:
1. `EditSession` introduces any touch logic that alters the behavior of mouse events on desktop.
2. A brush stroke commits more than 1 undo transaction for a single continuous drag.
3. Second-finger arrival fails to call `Stroke.cancel()` or leaves uncommitted blocks in `Volume`.
4. The reticle offset is hardcoded in a way that breaks when device pixel ratio varies or when `clientFromWorld` coordinates are transformed.
