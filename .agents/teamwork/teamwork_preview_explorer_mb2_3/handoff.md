# Handoff Report: Wiring and Touch E2E Camera Verification (FEAT-MB2-05)

## 1. Observation

### 1.1 `apps/web/src/routes/+page.svelte` Renderer Instantiation and Pointer Gate

- **Lines 579–599 (`startGpu`)**:

  ```typescript
  async function startGpu(): Promise<boolean> {
    try {
      const [{ createWebglRenderer }, site, user] = await Promise.all([
        import("@voxwright/render/webgl"),
        fetchPack(packUrl()),
        loadUserPack(),
      ]);
      sitePack = site;
      userPack = user;
      const pack = mergePacks(site, user?.pack ?? null);
      const decoded = pack ? await decodePack(pack) : null;
      packBlocks = pack ? packBlockIds(pack.json) : [];
      const r = createWebglRenderer({ pack: decoded });
      r.onCamera = (p) => {
        azimuth = p.azimuth;
        elevation = p.elevation;
      };
      r.mount(canvas);
      renderer = r;
      haveAssets = decoded !== null;
      return true;
    } ...
  ```

  Currently `createWebglRenderer({ pack: decoded })` does not pass any `input` option (defaulting to `"builtin"` once FEAT-MB2-01 is implemented).
- **Lines 639–647 (`onMount` media query listener)**:

  ```typescript
  onMount(() => {
    const coarse = window.matchMedia("(any-pointer: coarse)");
    const fine = window.matchMedia("(any-pointer: fine)");
    const syncPointer = (): void => {
      canEdit = fine.matches || !coarse.matches;
    };
    syncPointer();
    coarse.addEventListener("change", syncPointer);
    fine.addEventListener("change", syncPointer);
  ```

  On a touch device, `coarse.matches` is `true` and `fine.matches` is `false`. On desktop with a mouse, `fine.matches` is `true` and `coarse.matches` is `false`.
  The condition `coarse.matches || !fine.matches` cleanly isolates touch-first environments from desktop environments.

### 1.2 `packages/render/src/webgl/` Renderer & Camera Controller Mechanics

- **`packages/render/src/webgl/renderer.ts` lines 263–276 (`mount`)**:
  Currently attaches internal canvas event listeners directly:

  ```typescript
  this.listen(canvas, "pointerdown", this.onPointerDown);
  this.listen(canvas, "pointermove", this.onPointerMove);
  this.listen(canvas, "pointerup", this.onPointerUp);
  this.listen(canvas, "pointercancel", this.onPointerUp);
  this.listen(canvas, "wheel", this.onWheel, { passive: false });
  this.listen(window, "keydown", this.onKey);
  this.listen(window, "keyup", this.onKey);
  this.listen(window, "blur", () => this.fly.keys.clear());
  ```

  When FEAT-MB2-01 adds `options.input === "external"`, these listeners are skipped when `input: "external"` is provided.
- **`packages/render/src/webgl/controls.ts` lines 80–104 (`OrbitController`)**:

  ```typescript
  rotate(dxPx: number, dyPx: number): void {
    this.azimuth = wrap(this.azimuth + dxPx * 0.4);
    this.elevation = clamp(this.elevation + dyPx * 0.4, -89, 89);
  }

  zoom(factor: number): void {
    this.distance = clamp(this.distance * factor, this.minDistance, this.maxDistance);
  }

  pan(dxPx: number, dyPx: number): void {
    const d = lookDirection(this.azimuth, this.elevation);
    const rl = Math.hypot(d[0], d[2]) || 1;
    const right: Vec3 = [-d[2] / rl, 0, d[0] / rl];
    const up: Vec3 = [
      right[1] * d[2] - right[2] * d[1],
      right[2] * d[0] - right[0] * d[2],
      right[0] * d[1] - right[1] * d[0],
    ];
    const k = this.distance * 0.0015;
    for (let i = 0; i < 3; i++)
      this.target[i] =
        (this.target[i] as number) - (right[i] as number) * dxPx * k + (up[i] as number) * dyPx * k;
  }
  ```

  Observations on Camera Methods:
  1. `rotate(dxPx, dyPx)` modifies `azimuth` and `elevation`. Leaves `distance` and `target` invariant.
  2. `pan(dxPx, dyPx)` translates `target` along screen-space `right` and `up` axes proportional to `distance * 0.0015`. Leaves `azimuth`, `elevation`, and `distance` completely invariant (guaranteeing pure translation without rotation).
  3. `zoom(factor)` scales `distance` by `factor`. Leaves `azimuth`, `elevation`, and `target` invariant (guaranteeing zoom without drift).

### 1.3 `apps/web/src/lib/gestures.ts` (from Explorer MB2-2 Blueprint)

- Emits high-level intents matching `PROJECT.md`:

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
- Two-finger moves calculate:
  - `dx = center.x - prevCenter.x`, `dy = center.y - prevCenter.y` -> emits `twoFingerPan`
  - `spread = hypot(p1 - p2)`, `factor = prevSpread / spread` -> emits `pinch`
  - Re-anchors baseline upon transition from 1-finger to 2-finger to prevent position/scale jumps.

### 1.4 Existing E2E Test Suite Behavior

- **`apps/web/test/e2e.ts`**:
  - Sets desktop viewport: `page.setViewport({ width: 1200, height: 900 })` without `hasTouch`.
  - Media queries in Chromium: `fine.matches === true`, `coarse.matches === false`.
  - Runs 338 total checks across WebGL and CPU rendering pipelines, driving `editorSuite` and `m4Suite`.
  - In `m4-suite.ts` line 1098:
    `if (m.coarse && !m.fine) ok(!m.toolbar, t("a touch-only device gets the viewer without the editor"));`
- **`apps/web/test/touch-e2e.ts`**:
  - Mobile viewport: `width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true`.
  - Media queries: `coarse.matches === true`, `fine.matches === false`.
  - Part 1 tests 1-finger CDP touch drag, touchscreen drag, tap, and CDP pinch zoom.
  - Currently lacks:
    1. Direct 2-finger pan helper and assertion that 2-finger pan translates without rotation.
    2. Comprehensive pinch zoom round-trip verification (drift and jump verification).

---

## 2. Logic Chain

### 2.1 Wiring `WebglRenderer` and `gestures.ts` in `+page.svelte`

1. From Observation §1.1, `coarse.matches || !fine.matches` detects touch-device context.
2. In `startGpu()`:
   - When `isTouch` is true, pass `input: "external"` to `createWebglRenderer`.
   - When `isTouch` is false (desktop), pass `input: "builtin"` (or omit `input`).
3. When `input: "external"`, `WebglRenderer.mount(canvas)` skips internal pointer/wheel/key listeners (Observation §1.2).
4. When `isTouch` is true, `+page.svelte` initializes `GestureArbiter` and attaches DOM listeners (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) to the canvas.
5. In the canvas `pointerdown` listener, invoke `canvas.setPointerCapture(e.pointerId)` and `e.preventDefault()`. This guarantees continuous pointer streaming even if fingers move slightly beyond the canvas boundary or near screen edges.
6. Feed raw pointer events into `GestureArbiter.feed({ id, type, x, y, time, pointerType })`.
7. Map intents to public camera methods on `WebglRenderer`:
   - `oneFingerDragMove { dx, dy }` -> `r.orbitBy(intent.dx, intent.dy)`
   - `twoFingerPan { dx, dy }` -> `r.panBy(intent.dx, intent.dy)`
   - `pinch { factor }` -> `r.zoomBy(intent.factor)`
   - `cancel` -> no-op in viewer mode (or triggers `EditSession.cancelDrag()` once editor is enabled in MB4).

### 2.2 Intent to Camera Parameter Mapping Mechanics

1. **1-Finger Orbit (`oneFingerDragMove` -> `r.orbitBy(dx, dy)`)**:
   - `dx` corresponds to horizontal pixel movement; `dy` corresponds to vertical pixel movement.
   - `orbitBy(dx, dy)` delegates to `OrbitController.rotate(dx, dy)`.
   - Azimuth increases with `+dx * 0.4`, elevation adjusts with `+dy * 0.4`.
   - Camera target and distance remain constant.
2. **2-Finger Pan (`twoFingerPan` -> `r.panBy(dx, dy)`)**:
   - `dx` and `dy` represent the delta of the two-finger midpoint center.
   - `panBy(dx, dy)` delegates to `OrbitController.pan(dx, dy)`.
   - Target translates in camera plane: `target -= right * dx * k - up * dy * k`.
   - Angles `azimuth` and `elevation` are unmodified ($\Delta \text{azimuth} = 0, \Delta \text{elevation} = 0$).
   - Distance is unmodified ($\Delta \text{distance} = 0$).
   - Camera position translates identically to target: $\Delta \text{position} = \Delta \text{target}$.
   - Thus, 2-finger pan produces pure translation without rotation.
3. **2-Finger Pinch Zoom (`pinch` -> `r.zoomBy(factor)`)**:
   - `GestureArbiter` emits `factor = prevSpread / currSpread`.
   - When fingers spread apart (zooming in), `currSpread > prevSpread` $\implies factor < 1.0$.
   - `OrbitController.zoom(factor)` computes `distance = distance * factor`. Since $factor < 1.0$, `distance` decreases, moving the camera closer to the target (zoom in).
   - When fingers move closer together (zooming out), `currSpread < prevSpread` $\implies factor > 1.0$. `distance` increases (zoom out).
   - In both cases, `target`, `azimuth`, and `elevation` are untouched.
   - Re-anchoring `prevSpread` upon second finger landing prevents initial zoom jumps.
   - Incremental per-event factors prevent exponential runaway.

### 2.3 Assertions in `apps/web/test/touch-e2e.ts`

1. **1-Finger Orbit Check**:
   - Capture `pose0 = await pose()`.
   - Drag 1 finger: `await cdpTouchDrag(cdp, { x: cx, y: cy }, { x: cx + 120, y: cy + 40 })`.
   - Verify `pose1.azimuth` and/or `pose1.elevation` rotated by $> 5^\circ$.
   - **New assertion**: `Math.abs(pose1.distance - pose0.distance) < 0.01` (camera distance is strictly invariant during 1-finger orbit).
2. **2-Finger Pan Check (Translation Without Rotation)**:
   - Introduce `cdpTwoFingerPan(cdp, center, { dx, dy }, spacing, steps)` helper that moves both touch points synchronously by identical delta increments so $\Delta \text{spread} = 0$ throughout the gesture.
   - Capture `beforePan = await pose()`.
   - Execute `cdpTwoFingerPan(cdp, { x: cx, y: cy }, { dx: 120, dy: -60 })`.
   - Capture `afterPan = await pose()`.
   - Assert:
     - Zero azimuth rotation: `Math.abs(afterPan.azimuth - beforePan.azimuth) < 0.05`
     - Zero elevation rotation: `Math.abs(afterPan.elevation - beforePan.elevation) < 0.05`
     - Zero distance change: `Math.abs(afterPan.distance - beforePan.distance) < 0.05`
     - Non-zero 3D translation: $\sqrt{\sum (p_{after}[i] - p_{before}[i])^2} > 1.0$ blocks
     - Canvas picture hash updated: `afterPic.hash !== beforePic.hash`.
3. **2-Finger Pinch Zoom (Without Drift or Jumps)**:
   - Capture `beforeZoom = await pose()`.
   - Execute pinch-in (fingers move together from spread 140 to 70): `cdpPinch(cdp, { x: cx, y: cy }, 140, 70)`.
   - Capture `zoomOut = await pose()`.
   - Assert:
     - Distance scaled smoothly: `zoomOut.distance > beforeZoom.distance * 1.8 && zoomOut.distance < beforeZoom.distance * 2.2` (no instantaneous jump, monotonic ~2x zoom out).
     - No rotational drift: `Math.abs(zoomOut.azimuth - beforeZoom.azimuth) < 0.05` and `Math.abs(zoomOut.elevation - beforeZoom.elevation) < 0.05`.
     - No target drift: Target point computed from $(pos + lookDirection \times dist)$ has displacement $< 0.1$ blocks.
   - Execute reverse pinch-out (spread 70 to 140): `cdpPinch(cdp, { x: cx, y: cy }, 70, 140)`.
   - Capture `zoomIn = await pose()`.
   - Assert:
     - Reversibility: `Math.abs(zoomIn.distance - beforeZoom.distance) / beforeZoom.distance < 0.1` (returns to baseline within 10%).
     - No cumulative rotational drift: `Math.abs(zoomIn.azimuth - beforeZoom.azimuth) < 0.05` and `Math.abs(zoomIn.elevation - beforeZoom.elevation) < 0.05`.

### 2.4 Guaranteeing Desktop `e2e.ts` (338 Checks) Passes Unchanged

1. `apps/web/test/e2e.ts` and its subordinate files (`editor-suite.ts`, `m4-suite.ts`) are NOT modified.
2. `WebglRendererOptions.input` defaults to `"builtin"`.
3. On desktop browsers in `e2e.ts`, `fine.matches` is true and `coarse.matches` is false.
4. Therefore, `isTouch === false`. `+page.svelte` passes `input: "builtin"` to `createWebglRenderer`.
5. `WebglRenderer` attaches its standard mouse, wheel, and key listeners.
6. `GestureArbiter` is not attached to the canvas on desktop.
7. `canEdit = fine.matches || !coarse.matches` remains unchanged in MB2, keeping editing workflows active on desktop and viewer mode active on touch.
8. Every existing desktop test flow executes byte-for-byte identical code paths as before MB2.

---

## 3. Caveats

1. **`apps/web/vite.config.ts` test glob**:
   `apps/web/vite.config.ts` currently configures `test: { name: "web", include: ["test/**/*.test.ts"] }`. To ensure Vitest discovers `gestures.test.ts`, either add `"src/**/*.test.ts"` to `include` in `vite.config.ts` or place the unit test at `apps/web/test/gestures.test.ts`.
2. **`TouchPose` vs `Pose` Interface in Tests**:
   `TouchPose` in `touch-e2e.ts` already has `distance: number` and `position: Vec3`. Orbit camera target is not directly on `Pose`, but because $\text{target} = \text{position} + \text{lookDirection} \times \text{distance}$, it is computed deterministically in tests.
3. **Single vs Double Media Query**:
   `coarse.matches || !fine.matches` handles mobile browsers, mobile emulators, and touch screens without mouse pointers. Hybrid devices with both touchscreen and mouse will match both `coarse` and `fine`; per design decision, desktop mouse usage takes precedence when `fine` is true unless in touch emulation.

---

## 4. Conclusion & Actionable Blueprints

### 4.1 Implementation Blueprint for `apps/web/src/routes/+page.svelte`

```typescript
// Add import at top of +page.svelte:
import { GestureArbiter, type GestureIntent } from "../lib/gestures.ts";

// Add state/ref for gesture cleanup:
let gestureCleanup: (() => void) | null = null;

function wireTouchGestures(c: HTMLCanvasElement, r: WebglRenderer): void {
  gestureCleanup?.();
  const arbiter = new GestureArbiter({
    onIntent: (intent: GestureIntent) => {
      switch (intent.type) {
        case "oneFingerDragMove":
          r.orbitBy(intent.dx, intent.dy);
          break;
        case "twoFingerPan":
          r.panBy(intent.dx, intent.dy);
          break;
        case "pinch":
          r.zoomBy(intent.factor);
          break;
        case "tap":
        case "longPress":
        case "oneFingerDragStart":
        case "oneFingerDragEnd":
        case "multiFingerTap":
        case "cancel":
          // In MB2 viewer mode, editing tools are not yet active; no-op
          break;
      }
    },
  });

  const onDown = (e: PointerEvent): void => {
    c.focus({ preventScroll: true });
    c.setPointerCapture(e.pointerId);
    e.preventDefault();
    arbiter.feed({
      id: e.pointerId,
      type: "down",
      x: e.clientX,
      y: e.clientY,
      time: e.timeStamp || performance.now(),
      pointerType: e.pointerType,
    });
  };

  const onMove = (e: PointerEvent): void => {
    arbiter.feed({
      id: e.pointerId,
      type: "move",
      x: e.clientX,
      y: e.clientY,
      time: e.timeStamp || performance.now(),
      pointerType: e.pointerType,
    });
  };

  const onUp = (e: PointerEvent): void => {
    arbiter.feed({
      id: e.pointerId,
      type: "up",
      x: e.clientX,
      y: e.clientY,
      time: e.timeStamp || performance.now(),
      pointerType: e.pointerType,
    });
  };

  const onCancel = (e: PointerEvent): void => {
    arbiter.feed({
      id: e.pointerId,
      type: "cancel",
      x: e.clientX,
      y: e.clientY,
      time: e.timeStamp || performance.now(),
      pointerType: e.pointerType,
    });
  };

  c.addEventListener("pointerdown", onDown);
  c.addEventListener("pointermove", onMove);
  c.addEventListener("pointerup", onUp);
  c.addEventListener("pointercancel", onCancel);

  gestureCleanup = () => {
    c.removeEventListener("pointerdown", onDown);
    c.removeEventListener("pointermove", onMove);
    c.removeEventListener("pointerup", onUp);
    c.removeEventListener("pointercancel", onCancel);
    gestureCleanup = null;
  };
}
```

In `startGpu()`:
```typescript
const coarse = window.matchMedia("(any-pointer: coarse)");
const fine = window.matchMedia("(any-pointer: fine)");
const isTouch = coarse.matches || !fine.matches;

const r = createWebglRenderer({
  pack: decoded,
  input: isTouch ? "external" : "builtin",
});
r.onCamera = (p) => {
  azimuth = p.azimuth;
  elevation = p.elevation;
};
r.mount(canvas);
renderer = r;
haveAssets = decoded !== null;

if (isTouch) {
  wireTouchGestures(canvas, r);
}
```

In `onMount` return:
```typescript
  return () => {
    window.clearInterval(statsTimer);
    window.removeEventListener("beforeunload", onBeforeUnload);
    document.removeEventListener("visibilitychange", onHidden);
    coarse.removeEventListener("change", syncPointer);
    fine.removeEventListener("change", syncPointer);
    endSession();
    gestureCleanup?.();
    renderer?.dispose();
    worker.terminate();
  };
```

---

### 4.2 Implementation Blueprint for `apps/web/test/touch-e2e.ts`

#### 1. Add `cdpTwoFingerPan` and `computeTarget` Helpers

```typescript
/** Helper: dispatch a two-finger pan gesture via CDP Input.dispatchTouchEvent */
export async function cdpTwoFingerPan(
  cdp: CDPSession,
  startCenter: { x: number; y: number },
  delta: { dx: number; dy: number },
  fingerSpacing = 80,
  steps = 8,
): Promise<void> {
  const p1Start = { x: Math.round(startCenter.x - fingerSpacing / 2), y: startCenter.y };
  const p2Start = { x: Math.round(startCenter.x + fingerSpacing / 2), y: startCenter.y };

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: p1Start.x, y: p1Start.y, id: 1 },
      { x: p2Start.x, y: p2Start.y, id: 2 },
    ],
  });

  for (let i = 1; i <= steps; i++) {
    const curDx = Math.round((delta.dx * i) / steps);
    const curDy = Math.round((delta.dy * i) / steps);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: p1Start.x + curDx, y: p1Start.y + curDy, id: 1 },
        { x: p2Start.x + curDx, y: p2Start.y + curDy, id: 2 },
      ],
    });
  }

  const p1End = { x: p1Start.x + delta.dx, y: p1Start.y + delta.dy };
  const p2End = { x: p2Start.x + delta.dx, y: p2Start.y + delta.dy };

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [
      { x: p1End.x, y: p1End.y, id: 1 },
      { x: p2End.x, y: p2End.y, id: 2 },
    ],
  });
}

function computeTarget(p: TouchPose): [number, number, number] {
  const RAD = Math.PI / 180;
  const dx = -Math.sin(p.azimuth * RAD) * Math.cos(p.elevation * RAD);
  const dy = -Math.sin(p.elevation * RAD);
  const dz = Math.cos(p.azimuth * RAD) * Math.cos(p.elevation * RAD);
  return [
    p.position[0] + dx * p.distance,
    p.position[1] + dy * p.distance,
    p.position[2] + dz * p.distance,
  ];
}
```

#### 2. Enhanced Assertions in `touch-e2e.ts`

Replace existing gesture section (lines 226–284) with:
```typescript
// 3. Touch Orbit via CDP Input.dispatchTouchEvent
const canvasEl = await page.$('[data-testid="canvas"]');
if (!canvasEl) throw new Error("canvas element not found");
const canvasBox = await canvasEl.boundingBox();
if (!canvasBox) throw new Error("canvas bounding box not found");
const cx = Math.round(canvasBox.x + canvasBox.width / 2);
const cy = Math.round(canvasBox.y + canvasBox.height / 2);

const pose0 = await pose();
await cdpTouchDrag(cdp, { x: cx, y: cy }, { x: cx + 120, y: cy + 40 });
await settle();
const pose1 = await pose();
const pic1 = await picture();
ok(
  Math.abs(pose1.azimuth - pose0.azimuth) > 5 || Math.abs(pose1.elevation - pose0.elevation) > 5,
  t(
    `CDP touch drag orbits camera (azimuth ${pose0.azimuth.toFixed(1)} -> ${pose1.azimuth.toFixed(1)}, elevation ${pose0.elevation.toFixed(1)} -> ${pose1.elevation.toFixed(1)})`,
  ),
);
ok(
  Math.abs(pose1.distance - pose0.distance) < 0.05,
  t("1-finger touch orbit preserves camera distance without scaling"),
);
ok(pic1.hash !== pic0.hash, t("CDP touch orbit updates rendered picture hash"));

// 4. Touch Orbit via Puppeteer page.touchscreen
await page.touchscreen.touchStart(cx, cy);
await page.touchscreen.touchMove(cx - 80, cy - 30);
await page.touchscreen.touchEnd();
await settle();
const pose2 = await pose();
const pic2 = await picture();
ok(
  Math.abs(pose2.azimuth - pose1.azimuth) > 5 || Math.abs(pose2.elevation - pose1.elevation) > 5,
  t(
    `page.touchscreen drag turns the view (azimuth ${pose1.azimuth.toFixed(1)} -> ${pose2.azimuth.toFixed(1)})`,
  ),
);
ok(pic2.hash !== pic1.hash, t("touchscreen drag updates canvas picture"));

// 5. Touch Tap via Puppeteer page.touchscreen.tap
await page.touchscreen.tap(cx, cy);
await settle();
ok(true, t("page.touchscreen.tap succeeds without error"));

// 6. Two-Finger Pan via CDP (FEAT-MB2-05: Translation without rotation)
const panPoseBefore = await pose();
const panPicBefore = await picture();
await cdpTwoFingerPan(cdp, { x: cx, y: cy }, { dx: 120, dy: -60 });
await settle();
const panPoseAfter = await pose();
const panPicAfter = await picture();

ok(
  Math.abs(panPoseAfter.azimuth - panPoseBefore.azimuth) < 0.05,
  t("2-finger pan causes zero azimuth rotation"),
);
ok(
  Math.abs(panPoseAfter.elevation - panPoseBefore.elevation) < 0.05,
  t("2-finger pan causes zero elevation rotation"),
);
ok(
  Math.abs(panPoseAfter.distance - panPoseBefore.distance) < 0.05,
  t("2-finger pan preserves exact camera distance"),
);
const translationDist = Math.hypot(
  panPoseAfter.position[0] - panPoseBefore.position[0],
  panPoseAfter.position[1] - panPoseBefore.position[1],
  panPoseAfter.position[2] - panPoseBefore.position[2],
);
ok(
  translationDist > 1.0,
  t(`2-finger pan translates camera in 3D space (moved ${translationDist.toFixed(2)} blocks)`),
);
ok(panPicAfter.hash !== panPicBefore.hash, t("2-finger pan updates rendered canvas image"));

// 7. Two-Finger Pinch Zoom via CDP (Without drift or jumps)
const zoomPose0 = await pose();
const target0 = computeTarget(zoomPose0);

// Zoom out (fingers move closer: spread 140 -> 70, ~2.0x distance)
await cdpPinch(cdp, { x: cx, y: cy }, 140, 70);
await settle();
const zoomPose1 = await pose();
const target1 = computeTarget(zoomPose1);

ok(
  zoomPose1.distance > zoomPose0.distance * 1.8 && zoomPose1.distance < zoomPose0.distance * 2.2,
  t(
    `two-finger pinch-in smoothly zooms out by ~2.0x (${zoomPose0.distance.toFixed(1)} -> ${zoomPose1.distance.toFixed(1)})`,
  ),
);
ok(
  Math.abs(zoomPose1.azimuth - zoomPose0.azimuth) < 0.05,
  t("pinch zoom produces no azimuth drift"),
);
ok(
  Math.abs(zoomPose1.elevation - zoomPose0.elevation) < 0.05,
  t("pinch zoom produces no elevation drift"),
);
const targetDrift = Math.hypot(
  target1[0] - target0[0],
  target1[1] - target0[1],
  target1[2] - target0[2],
);
ok(
  targetDrift < 0.1,
  t(`pinch zoom causes no target translation drift (drift: ${targetDrift.toFixed(3)})`),
);

// Reverse Zoom In (fingers move apart: spread 70 -> 140, ~0.5x distance)
await cdpPinch(cdp, { x: cx, y: cy }, 70, 140);
await settle();
const zoomPose2 = await pose();
ok(
  Math.abs(zoomPose2.distance - zoomPose0.distance) / zoomPose0.distance < 0.1,
  t(
    `two-finger pinch-out zooms back in to original distance (${zoomPose1.distance.toFixed(1)} -> ${zoomPose2.distance.toFixed(1)}, baseline ${zoomPose0.distance.toFixed(1)})`,
  ),
);
ok(
  Math.abs(zoomPose2.azimuth - zoomPose0.azimuth) < 0.05,
  t("round-trip pinch zoom preserves azimuth"),
);
ok(
  Math.abs(zoomPose2.elevation - zoomPose0.elevation) < 0.05,
  t("round-trip pinch zoom preserves elevation"),
);
```

---

## 5. Verification Method

To independently verify the investigation findings and resulting Worker implementation:

1. **Verify Unit Tests Pass**:

   ```bash
   pnpm test
   ```

   Ensures core, render, and web units continue to pass 100% (currently 49 test files, 786 passed).

2. **Verify Touch E2E Test Suite**:

   ```bash
   pnpm --filter @voxwright/web build
   node apps/web/test/touch-e2e.ts
   ```

   Expected: Passes all checks including 1-finger orbit distance preservation, 2-finger pan translation without rotation, and reversible 2-finger pinch zoom without drift or jumps.

3. **Verify Desktop E2E Test Suite (338 Checks)**:

   ```bash
   node apps/web/test/e2e.ts
   ```

   Expected: Exactly `338 checks passed` with 0 failures, confirming zero desktop regression.

4. **Invalidation Conditions**:
   - If `OrbitController.pan()` changes `azimuth` or `elevation`, the 2-finger pan rotation assertions will fail.
   - If `GestureArbiter` emits cumulative rather than per-step factor for `pinch`, pinch zoom will exponentially accelerate and fail distance bounds.
   - If `WebglRenderer` defaults `input` to `"external"` instead of `"builtin"`, desktop `e2e.ts` mouse listeners will be missing and fail.
