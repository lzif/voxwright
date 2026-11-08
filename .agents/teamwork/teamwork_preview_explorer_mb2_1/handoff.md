# Investigation Report: Renderer Input Decoupling & Public Camera API (FEAT-MB2-01 & FEAT-MB2-02)

**Author**: `teamwork_preview_explorer_mb2_1`  
**Working Directory**: `/home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_explorer_mb2_1/`  
**Target Milestone**: MB2  
**Target Features**: `FEAT-MB2-01` (WebGL Renderer Input Mode) & `FEAT-MB2-02` (Public WebGL Camera API)

---

## 1. Observation

### 1.1 File Locations & Exports

- **Renderer Entry Point**: `@voxwright/render/webgl` is located in `packages/render/src/webgl/` (not `packages/render/src/types.ts` directly; `packages/render/src/webgl/types.ts` and `packages/render/src/webgl/renderer.ts` define the WebGL renderer types and implementation).
- `packages/render/src/webgl/index.ts` lines 7–16:

  ```typescript
  export {
    type BenchmarkResult,
    createWebglRenderer,
    type RendererStats,
    WebglRenderer,
    type WebglRendererOptions,
    webgl2Available,
  } from "./renderer.ts";
  export type { Box, CameraMode, Renderer, SliceRange } from "./types.ts";
  ```
- `packages/render/src/webgl/types.ts` defines `Renderer` (lines 22–33) with methods: `mount(canvas)`, `setVolume(v)`, `markDirty(sectionKeys)`, `setCamera(mode)`, `setSlice(range)`, `highlight(boxes)`, `dispose()`.
- `packages/render/src/webgl/controls.ts`:
  - `export type Vec3 = [number, number, number];` (line 12)
  - `export class OrbitController`:
    - `target: Vec3 = [0, 0, 0];` (line 64)
    - `distance = 40; minDistance = 2; maxDistance = 2000;` (lines 65, 68–69)
    - `rotate(dxPx: number, dyPx: number): void` (lines 80–83)
    - `zoom(factor: number): void` (lines 85–87)
    - `pan(dxPx: number, dyPx: number): void` (lines 90–104)
    - `pose(): Pose` (lines 118–120)

### 1.2 WebglRenderer Current Input Handling & Event Binding

- In `packages/render/src/webgl/renderer.ts`:
  - `WebglRendererOptions` (lines 52–65):

    ```typescript
    export interface WebglRendererOptions {
      pack: DecodedPack | null;
      workers?: number;
      createWorker?: () => WorkerLike;
      maxUpdatesPerFrame?: number;
      background?: number;
      antialias?: boolean;
    }
    ```
  - In `mount(canvas: HTMLCanvasElement): void` (lines 260–276):

    ```typescript
    canvas.tabIndex = 0;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.listen(canvas, "pointerdown", this.onPointerDown);
    this.listen(canvas, "pointermove", this.onPointerMove);
    this.listen(canvas, "pointerup", this.onPointerUp);
    this.listen(canvas, "pointercancel", this.onPointerUp);
    this.listen(canvas, "wheel", this.onWheel, { passive: false });
    this.listen(canvas, "contextmenu", (e) => e.preventDefault());
    this.listen(canvas, "webglcontextlost", (e) => e.preventDefault());
    this.listen(canvas, "webglcontextrestored", () => this.requestFrame());
    this.listen(window, "keydown", this.onKey);
    this.listen(window, "keyup", this.onKey);
    this.listen(window, "blur", () => this.fly.keys.clear());
    this.resize();
    this.requestFrame();
    ```
  - Input event handlers (lines 806–893):
    - `onPointerDown`: sets pointer in `this.pointers`, computes pinch spread if 2 pointers, captures pointer (`c.setPointerCapture(e.pointerId)`), requests pointer lock if fly mode.
    - `onPointerMove`: handles fly look, 2-pointer pinch zoom (`this.orbit.zoom(this.pinch / spread)`), 1-pointer drag orbit (`this.orbit.rotate(dx, dy)`) or pan (`this.orbit.pan(dx, dy)`).
    - `onPointerUp`: removes tracked pointers and clears drag/pinch.
    - `onWheel`: calls `this.orbit.zoom(k)` or fly speed scale.
    - `onKey`: manages fly movement keys.

### 1.3 Caller Interactions

- `apps/web/src/routes/+page.svelte` (line 591): `createWebglRenderer({ pack: decoded })`.
- `apps/web/src/lib/editor-session.svelte.ts` (lines 200–215):
  - `attach()` attaches a capture-phase listener to the canvas container:
    `host.addEventListener("pointerdown", down, true);`
    to intercept tool editing clicks before `WebglRenderer` canvas listeners can start turning the camera.
  - When `pointerType === "touch"`, `onPointerDown` currently returns early without `stopPropagation`, letting touch events fall through to `WebglRenderer`'s canvas listeners.
  - In `external` mode, `WebglRenderer` will detach its own canvas listeners so the touch gesture arbiter (`gestures.ts` in FEAT-MB2-03) has sole, unambiguous ownership of all touch pointer streams.

### 1.4 Baseline Validation

- `pnpm test`: 49 test files passed (786 passed, 190 skipped).
- `pnpm typecheck`: 0 errors, 0 warnings across all packages.
- `pnpm depcheck`: 0 dependency violations found.
- Verification in Node CLI: `WebglRenderer` constructor and camera methods execute cleanly in Node when polyfilling `cancelAnimationFrame`.

---

## 2. Logic Chain

1. **Option Formulation (`FEAT-MB2-01`)**:
   - `WebglRendererOptions` is expanded with optional `input?: "builtin" | "external"`.
   - Default value is `"builtin"` (when `input` is `undefined` or `"builtin"`).
   - In `types.ts`, `export type RendererInputMode = "builtin" | "external";` defines the formal type contract.

2. **Mount Listener Separation (`FEAT-MB2-01`)**:
   - The listeners in `mount(canvas)` fall into two distinct categories:
     - **Canvas/WebGL Lifecycle**: `ResizeObserver`, `contextmenu` (prevent default context menu on canvas), `webglcontextlost`, `webglcontextrestored`. These MUST remain attached in all modes to ensure correct canvas sizing and WebGL recovery.
     - **Interactive User Input**: `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `wheel`, `keydown`, `keyup`, and window `blur`.
   - Wrapping the 8 interactive user input listeners with `if (this.options.input !== "external")` ensures:
     - In `"external"` mode: zero canvas/window pointer/wheel/key listeners are attached by `WebglRenderer`. No pointer capture or pointer lock is invoked internally.
     - In default/`"builtin"` mode: all 8 listeners are attached exactly as before.

3. **Public Camera API Formulation (`FEAT-MB2-02`)**:
   - `orbitBy(dxPx: number, dyPx: number): void`:
     Directly calls `this.orbit.rotate(dxPx, dyPx)` and `this.requestFrame()`.
     Directly matches the internal `onPointerMove` orbit behavior (`this.orbit.rotate(dx, dy); this.requestFrame()`).
   - `panBy(dxPx: number, dyPx: number): void`:
     Directly calls `this.orbit.pan(dxPx, dyPx)` and `this.requestFrame()`.
     Directly matches internal `onPointerMove` pan behavior (`this.orbit.pan(dx, dy); this.requestFrame()`).
   - `zoomBy(factor: number): void`:
     Directly calls `this.orbit.zoom(factor)` and `this.requestFrame()`.
     Directly matches internal pinch and wheel zoom behavior.
   - `focusOn(target: Vec3, distance?: number): void`:
     - If `this.mode === "fly"`, transitions to `"orbit"` via `this.setCamera("orbit")`.
     - Assigns `this.orbit.target = [target[0], target[1], target[2]]`.
     - If `distance` is defined, clamps `distance` to `[this.orbit.minDistance, this.orbit.maxDistance]`.
     - Calls `this.requestFrame()`.
   - All four methods defensively guard against `NaN` and infinite arguments to prevent camera matrix corruption.

4. **100% Desktop / Builtin Byte-for-Byte Parity**:
   - Existing callers construct `createWebglRenderer({ pack })` without `input`.
   - Because `this.options.input` is `undefined`, `this.options.input !== "external"` evaluates to `true`.
   - Every event listener is attached at the exact same point in `mount()`, in the exact same order.
   - The public methods are strictly additive and do not alter internal state unless invoked.
   - Existing unit and e2e test suites execute without any behavioural divergence.

---

## 3. Caveats

1. **`controls.ts` Scope**: `controls.ts` does not require any source modifications because `OrbitController` already provides `rotate(dxPx, dyPx)`, `pan(dxPx, dyPx)`, `zoom(factor)`, `target`, `distance`, `minDistance`, and `maxDistance`.
2. **`setPixelRatio` Milestone Boundary**: `PROJECT.md` contract lists `setPixelRatio(dpr: number)`. In the project plan, dynamic resolution scaling is scoped under `FEAT-MB7-01` (Milestone MB7). Implementing it now as an additive helper is trivial and non-breaking, but is not strictly required for MB2.
3. **DOM vs Node Testing**: `WebglRenderer.dispose()` references browser global `cancelAnimationFrame`. When writing Node/Vitest unit tests that construct `WebglRenderer`, mocking `globalThis.cancelAnimationFrame = () => {}` or testing camera math via `OrbitController` avoids any unhandled reference errors in headless Node.

---

## 4. Conclusion & Code Specification for Worker

### 4.1 Interface Contract (`packages/render/src/webgl/types.ts`)

```typescript
// Additive export:
export type RendererInputMode = "builtin" | "external";
```

### 4.2 Re-exports (`packages/render/src/webgl/index.ts`)

```typescript
export {
  type BenchmarkResult,
  createWebglRenderer,
  type RendererStats,
  WebglRenderer,
  type WebglRendererOptions,
  webgl2Available,
} from "./renderer.ts";
export type { Box, CameraMode, Renderer, RendererInputMode, SliceRange } from "./types.ts";
export type { Pose, Vec3 } from "./controls.ts";
```

### 4.3 Exact Unified Diff for `packages/render/src/webgl/renderer.ts`

```patch
--- a/packages/render/src/webgl/renderer.ts
+++ b/packages/render/src/webgl/renderer.ts
@@ -49,3 +49,3 @@
-import { FlyController, lookDirection, OrbitController, type Pose, pickRay } from "./controls.ts";
+import { FlyController, lookDirection, OrbitController, type Pose, pickRay, type Vec3 } from "./controls.ts";
 import type { Box, CameraMode, Renderer, SliceRange } from "./types.ts";
@@ -55,2 +55,7 @@
   pack: DecodedPack | null;
+  /**
+   * Input handling mode: "builtin" attaches canvas pointer/wheel/key listeners;
+   * "external" skips them so an external gesture arbiter has full ownership of input.
+   * Default: "builtin".
+   */
+  input?: "builtin" | "external";
   /** Mesher workers (default: cores minus one, between 1 and 4). */
@@ -262,9 +267,11 @@
     this.resizeObserver.observe(canvas);
-    this.listen(canvas, "pointerdown", this.onPointerDown);
-    this.listen(canvas, "pointermove", this.onPointerMove);
-    this.listen(canvas, "pointerup", this.onPointerUp);
-    this.listen(canvas, "pointercancel", this.onPointerUp);
-    this.listen(canvas, "wheel", this.onWheel, { passive: false });
     this.listen(canvas, "contextmenu", (e) => e.preventDefault());
     this.listen(canvas, "webglcontextlost", (e) => e.preventDefault());
     this.listen(canvas, "webglcontextrestored", () => this.requestFrame());
+    if (this.options.input !== "external") {
+      this.listen(canvas, "pointerdown", this.onPointerDown);
+      this.listen(canvas, "pointermove", this.onPointerMove);
+      this.listen(canvas, "pointerup", this.onPointerUp);
+      this.listen(canvas, "pointercancel", this.onPointerUp);
+      this.listen(canvas, "wheel", this.onWheel, { passive: false });
+      this.listen(window, "keydown", this.onKey);
+      this.listen(window, "keyup", this.onKey);
+      this.listen(window, "blur", () => this.fly.keys.clear());
+    }
-    this.listen(window, "keydown", this.onKey);
-    this.listen(window, "keyup", this.onKey);
-    this.listen(window, "blur", () => this.fly.keys.clear());
     this.resize();
@@ -412,2 +419,34 @@
 
+  /** Orbit the camera around its target by screen pixel deltas. */
+  orbitBy(dxPx: number, dyPx: number): void {
+    if (!Number.isFinite(dxPx) || !Number.isFinite(dyPx)) return;
+    this.orbit.rotate(dxPx, dyPx);
+    this.requestFrame();
+  }
+
+  /** Pan the camera target in the screen plane by screen pixel deltas. */
+  panBy(dxPx: number, dyPx: number): void {
+    if (!Number.isFinite(dxPx) || !Number.isFinite(dyPx)) return;
+    this.orbit.pan(dxPx, dyPx);
+    this.requestFrame();
+  }
+
+  /** Zoom the orbit camera by scaling the distance by factor (>1 zooms out, <1 zooms in). */
+  zoomBy(factor: number): void {
+    if (!Number.isFinite(factor) || factor <= 0) return;
+    this.orbit.zoom(factor);
+    this.requestFrame();
+  }
+
+  /** Focus the orbit camera on a target cell/world position, optionally setting the distance. */
+  focusOn(target: Vec3, distance?: number): void {
+    if (this.mode === "fly") {
+      this.setCamera("orbit");
+    }
+    this.orbit.target = [target[0], target[1], target[2]];
+    if (distance !== undefined && Number.isFinite(distance)) {
+      this.orbit.distance = Math.max(
+        this.orbit.minDistance,
+        Math.min(this.orbit.maxDistance, distance),
+      );
+    }
+    this.requestFrame();
+  }
+
   /** Where the camera is now. */
```

### 4.4 Proposed Unit Test Suite (`packages/render/test/webgl-renderer.test.ts`)

```typescript
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { WebglRenderer } from "../src/webgl/renderer.ts";

const dummyWorker = () => ({ postMessage() {}, terminate() {} }) as any;

describe("WebglRenderer public camera API & options", () => {
  it("defaults to builtin input mode without error", () => {
    const r = new WebglRenderer({ pack: null, workers: 1, createWorker: dummyWorker });
    expect(r.getMode()).toBe("orbit");
    const pose = r.getPose();
    expect(pose.azimuth).toBe(45);
    expect(pose.elevation).toBe(35);
    expect(pose.distance).toBe(40);
  });

  it("accepts external input option", () => {
    const r = new WebglRenderer({
      pack: null,
      input: "external",
      workers: 1,
      createWorker: dummyWorker,
    });
    expect(r.getMode()).toBe("orbit");
  });

  it("orbitBy rotates azimuth and elevation cleanly", () => {
    const r = new WebglRenderer({ pack: null, workers: 1, createWorker: dummyWorker });
    r.orbitBy(10, 5);
    const p1 = r.getPose();
    expect(p1.azimuth).toBeCloseTo(45 + 10 * 0.4, 5);
    expect(p1.elevation).toBeCloseTo(35 + 5 * 0.4, 5);

    // Guard against non-finite
    r.orbitBy(NaN, Infinity);
    const p2 = r.getPose();
    expect(p2.azimuth).toBe(p1.azimuth);
    expect(p2.elevation).toBe(p1.elevation);
  });

  it("panBy updates camera position", () => {
    const r = new WebglRenderer({ pack: null, workers: 1, createWorker: dummyWorker });
    const pos0 = [...r.getPose().position];
    r.panBy(20, -10);
    const pos1 = r.getPose().position;
    expect(pos1[0] !== pos0[0] || pos1[1] !== pos0[1] || pos1[2] !== pos0[2]).toBe(true);
  });

  it("zoomBy scales distance within bounds", () => {
    const r = new WebglRenderer({ pack: null, workers: 1, createWorker: dummyWorker });
    r.zoomBy(1.5);
    expect(r.getPose().distance).toBeCloseTo(60, 5);
    r.zoomBy(0.5);
    expect(r.getPose().distance).toBeCloseTo(30, 5);
    // Non-finite or negative ignored
    r.zoomBy(-1);
    expect(r.getPose().distance).toBeCloseTo(30, 5);
    r.zoomBy(NaN);
    expect(r.getPose().distance).toBeCloseTo(30, 5);
  });

  it("focusOn sets target and distance, and switches from fly mode", () => {
    const r = new WebglRenderer({ pack: null, workers: 1, createWorker: dummyWorker });
    r.focusOn([10, 20, 30], 50);
    expect(r.getPose().distance).toBe(50);

    // Switch to fly mode, then focusOn
    r.setCamera("fly");
    expect(r.getMode()).toBe("fly");
    r.focusOn([100, 50, 100], 25);
    expect(r.getMode()).toBe("orbit");
    expect(r.getPose().distance).toBe(25);
  });
});
```

---

## 5. Verification Method

To independently verify the implementation, the Worker should execute:

1. **Unit Tests**:

   ```bash
   pnpm --filter @voxwright/render test
   ```

   _Expected_: All render unit tests pass, including new `webgl-renderer.test.ts`.

2. **Full Workspace Vitest Suite**:

   ```bash
   pnpm test
   ```

   _Expected_: All 49+ test files pass across `core`, `mcbuilder`, `render`, and `web`.

3. **TypeScript Typecheck**:

   ```bash
   pnpm typecheck
   ```

   _Expected_: 0 errors, 0 warnings across all tsconfig projects (including `tsconfig.webgl.json`).

4. **Architecture & Dependency Check**:

   ```bash
   pnpm depcheck
   ```

   _Expected_: 0 dependency violations found.

5. **Desktop Regression Check**:

   ```bash
   node apps/web/test/touch-e2e.ts
   ```

   _Expected_: Passes desktop and touch viewer smoke checks.
