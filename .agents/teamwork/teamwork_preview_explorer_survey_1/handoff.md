# Technical Reality & Architectural Survey for Mobile Editor (MB1–MB8)

## 1. Observation

Direct code observations from the current codebase (`main` at `30d90af`):

### 1.1 `apps/web/vite.config.ts`: Mesh Worker & `server.fs.allow` Dependency

- **File**: `apps/web/vite.config.ts`, lines 7, 66–69:

  ```typescript
  import { searchForWorkspaceRoot } from "vite";
  ...
  // Dev server only: the workspace packages (packages/render holds the mesh worker) live outside
  // the app root, so Vite must be allowed to serve them. The build ignores `server`.
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd())] } },
  worker: { format: "es" },
  ```
- **Git History**: Commit `30d90afff8db54b092b18a6ace7443e32a02d485` ("Let vite dev serve the workspace packages") explicitly addressed this:
  > "The WebGL mesh worker lives in packages/render, outside the apps/web root, so the dev server refused it ("outside of Vite serving allow list") and the canvas stayed blank. Allow the workspace root in server.fs.allow. The option only affects the dev server; the build is unchanged."
- **Execution verification**: Tested `searchForWorkspaceRoot(process.cwd())` in Node via pnpm:
  - From repository root: returns `/home/antigravity/lzif/voxwright`
  - From `apps/web`: returns `/home/antigravity/lzif/voxwright`
  - Production build (`pnpm --filter @voxwright/web build`): Bundles worker to `_app/immutable/workers/mesh.worker-BSG2jtKG.js` without relying on `server.fs.allow`.
- **Finding**: The dependency listed as blocking in `docs/mobile-editor-plan.md` lines 17 and 274 was already implemented in commit `30d90af`.

---

### 1.2 `apps/web/src/routes/+page.svelte`: Pointer Detection, `canEdit` Gate & Stage Layout

- **Pointer Detection & Gate**:
  - Line 54: `let canEdit = $state(false);`
  - Lines 639–646 (`onMount`):

    ```typescript
    const coarse = window.matchMedia("(any-pointer: coarse)");
    const fine = window.matchMedia("(any-pointer: fine)");
    const syncPointer = (): void => {
      canEdit = fine.matches || !coarse.matches;
    };
    syncPointer();
    coarse.addEventListener("change", syncPointer);
    fine.addEventListener("change", syncPointer);
    ```
  - Line 187 (during file load):

    ```typescript
    if (canEdit) startSession(r, opened.volume, opened.dataVersion, baseEdits);
    ```
  - Result on touch phone (`coarse=true`, `fine=false`): `canEdit` evaluates to `false`. `startSession()` is never called; `session` stays `null`.
- **Markup gating**:
  - Line 726: `<div class="stage" class:editable={session !== null}>`
  - Lines 727–733: `{#if session}<div class="tools" ...><BlockPalette/><BlockStatePanel/><SelectionPanel/></div>{/if}`
  - Line 735: `{#if session}<EditToolbar {session} />{/if}`
  - Lines 757–758: `{:else if info && kind === "webgl"}<p class="hint" data-testid="edit-note">Editing needs a mouse and keyboard; on this device the page is a viewer.</p>`
- **CSS Stage Columns & Responsiveness**:
  - Lines 870–872:

    ```css
    .stage { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 1.2rem; align-items: start; }
    canvas { width: 100%; max-height: 80vh; object-fit: contain; background: #f4f1eb; border: 1px dashed #c9c3b6; border-radius: 8px; min-height: 240px; touch-action: none; }
    ```
  - Line 881:

    ```css
    .stage.editable { grid-template-columns: 280px minmax(0, 1fr) 280px; }
    ```
  - Line 885:

    ```css
    canvas.gl { height: min(72vh, 760px); max-height: none; }
    ```
  - Line 892:

    ```css
    @media (max-width: 1000px) { .stage, .stage.editable { grid-template-columns: 1fr; } }
    ```
  - Under 1000px width (phones ~390px): The layout collapses to a single 1fr column. The canvas takes 72vh at the top, and all control panels (`aside` or `tools`) stack underneath, forcing the user to scroll vertically away from the 3D viewport. Canvas has `touch-action: none`, preventing page scroll when dragging on the canvas.

---

### 1.3 `apps/web/src/lib/editor-session.svelte.ts`: Event Flow, Touch Handling & State Machine

- **Event Listeners Attached (`attach()`)**:
  - Lines 200–215:

    ```typescript
    const host = this.canvas.parentElement ?? this.canvas;
    host.addEventListener("pointerdown", down, true); // capture phase!
    this.canvas.addEventListener("pointermove", move);
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointercancel", up);
    this.canvas.addEventListener("pointerleave", leave);
    this.canvas.addEventListener("wheel", wheel, { passive: true });
    window.addEventListener("keydown", key);
    ```

- **Touch Handling in `onPointerDown` & `onPointerMove`**:
  - Lines 290–294:

    ```typescript
    private onPointerDown(e: PointerEvent): void {
      if (e.target !== this.canvas || !this.interactive) return;
      if (e.pointerType === "touch" || e.button !== 0 || e.shiftKey || e.altKey) return;
      e.stopPropagation();
      e.preventDefault();
      this.canvas.focus({ preventScroll: true });
      this.canvas.setPointerCapture(e.pointerId);
      this.error = "";
      this.begin(this.pick(e.clientX, e.clientY), e);
    }
    ```
  - Line 402–404:

    ```typescript
    private onPointerMove(e: PointerEvent): void {
      this.pointer = { x: e.clientX, y: e.clientY };
      if (e.pointerType === "touch") return;
      ...
    ```
  - Both methods completely drop touch events via `if (e.pointerType === "touch") return;`. Touch events fall through capture phase down to `canvas` where `WebglRenderer` listens.
- **Drag States & Hover Tracking**:
  - Lines 75–87: `type Drag` union:
    - `brush`: `{ kind: "brush", tool: "place"|"paint"|"erase", stroke: Stroke, axis: 0|1|2|null, layer: number, last: Vec3|null, touched: Set<string> }`
    - `line`: `{ kind: "line", a: Vec3, b: Vec3 }`
    - `rectangle`: `{ kind: "rectangle", a: Vec3, b: Vec3, axis: 0|1|2, at: number }`
    - `select`: `{ kind: "select", a: Vec3, b: Vec3, before: Box|null }`
  - In `updateHover(x, y)` (lines 431–443): `this.hover = hit; if (hit !== null) this.inspected = hit.position; this.refreshHighlight();`. Because touch moves are ignored, `hover` and `inspected` are never updated on touch.
  - Brush drag lifecycle: `beginBrush` (line 356) creates `Stroke` via `this.editor.beginStroke(label)`. `brushTo` (line 374) applies commands via `drag.stroke.apply(command)`. `onPointerUp` (line 500) commits via `drag.stroke.commit()`. `cancelDrag` (line 544) reverts via `drag.stroke.cancel()`.
- **Camera Interaction**:
  - Mouse button 0 clicks call `e.stopPropagation()` in capture phase on parent `host`, intercepting before `WebglRenderer` sees them.
  - When `button !== 0`, `shiftKey`, `altKey`, or `pointerType === "touch"`, `onPointerDown` returns without `stopPropagation()`, allowing event to reach `WebglRenderer`.

---

### 1.4 `packages/render`: Renderer & Controls Decoupling

- **`packages/render/src/webgl/controls.ts`**:
  - `OrbitController` (lines 63–121): Pure math controller.
    - `rotate(dxPx, dyPx)`: azimuth & elevation rotation.
    - `pan(dxPx, dyPx)`: screen-relative camera target pan.
    - `zoom(factor)`: distance clamping and scaling.
    - `fromPose(Pose)` / `pose()`: pose serialization.
  - `FlyController` (lines 133–195): Keyboard-driven (`FLY_KEYS`: WASD, arrows, Space/E, C/Q, Shift).
- **`packages/render/src/webgl/renderer.ts`**:
  - Mount event attachment (lines 263–273):

    ```typescript
    this.listen(canvas, "pointerdown", this.onPointerDown);
    this.listen(canvas, "pointermove", this.onPointerMove);
    this.listen(canvas, "pointerup", this.onPointerUp);
    this.listen(canvas, "pointercancel", this.onPointerUp);
    this.listen(canvas, "wheel", this.onWheel, { passive: false });
    this.listen(window, "keydown", this.onKey);
    this.listen(window, "keyup", this.onKey);
    ```
  - Input Handling (lines 806–880):
    - Multi-touch handling: Tracks `this.pointers = new Map<number, {x, y}>()`.
    - If `pointers.size === 2`, calculates `pointerSpread()` and applies `orbit.zoom(this.pinch / spread)`.
    - **No two-finger pan exists today** in `renderer.ts`.
    - If a single pointer is down: `button === 0 && !shift` orbits, else pans.
  - Highlight rendering (lines 338–379):
    - `highlight(boxes: Box[])`: Uses `HIGHLIGHT_STYLES = { selection, hover, ghost }`.
    - Draws `Mesh` with `BoxGeometry` and `LineSegments` with `EdgesGeometry`.
- **Decoupling Strategy**:
  - `WebglRendererOptions` in `types.ts` currently lacks an input mode option.
  - Adding `input?: "builtin" | "external"` (default `"builtin"`):
    - `"builtin"`: preserves existing event listener attachment for desktop/standalone viewer.
    - `"external"`: skips attaching canvas gesture listeners (`pointerdown`, `pointermove`, `pointerup`, `wheel`, `keydown`, `keyup`).
    - Exposes public camera manipulation methods on `WebglRenderer`:
      `orbitBy(dxPx: number, dyPx: number)`, `panBy(dxPx: number, dyPx: number)`, `zoomBy(factor: number)`, `focusOn(target: Vec3, distance?: number)`.

---

### 1.5 Existing Test Infrastructure & Execution

- **Root `package.json` scripts**:
  - `"test": "vitest run"`
  - `"typecheck": "pnpm -r --if-present run typecheck && tsc -p scripts/tsconfig.json"`
  - `"check": "biome check ."`
  - `"depcheck": "depcruise --config .dependency-cruiser.cjs ."`
- **Test execution results verified**:
  1. `pnpm test`:
     - 49 test files passed across `@voxwright/core`, `@voxwright/render`, `@voxwright/mcbuilder`, `@voxwright/web`.
     - 786 passed, 190 skipped (tests requiring Mojang asset pack, per `PLAN.md`).
  2. `pnpm typecheck`:
     - Passed with 0 errors across all 5 workspace projects (including `svelte-check`).
  3. `pnpm depcheck`:
     - 248 modules, 703 dependencies cruised; 0 violations.
  4. `pnpm --filter @voxwright/web build`:
     - Successfully built in ~1.4s, outputs static bundle in `apps/web/build/` with both `render.worker` and `mesh.worker`.
  5. `node apps/web/test/e2e.ts`:
     - Drives headless Chromium via `puppeteer-core` (both with WebGL2 on SwiftShader and CPU fallback).
     - **338 checks passed**!
     - In `apps/web/test/m4-suite.ts` line 1098–1099:
       `if (m.coarse && !m.fine) ok(!m.toolbar, t("a touch-only device gets the viewer without the editor"));`
       Currently asserts that coarse-only devices do NOT get the editor!
     - In `apps/web/test/m4-suite.ts`: axe-core is run on 7 page states; 0 violations allowed (`ACCEPTED` dictionary is empty).
     - In `apps/web/test/contrast.test.ts`: 17 color contrast pairs verified for WCAG AA compliance.

---

## 2. Logic Chain

1. **Mesh Worker Availability**:
   - `docs/mobile-editor-plan.md` noted `server.fs.allow` as an unaddressed blocking dependency from base commit `d3a7ef6`.
   - Inspection of `apps/web/vite.config.ts` line 68 and git commit `30d90af` proves that `server: { fs: { allow: [searchForWorkspaceRoot(process.cwd())] } }` was added by Luki.
   - Verified via runtime evaluation that `searchForWorkspaceRoot` correctly finds `/home/antigravity/lzif/voxwright` from both root and subdirectories.
   - Therefore, the mesh worker dev dependency is already solved.

2. **Mobile Editor Gating & Layout Conflict**:
   - Currently, `canEdit = fine.matches || !coarse.matches`. On mobile devices, `fine` is false and `coarse` is true, forcing `canEdit = false`.
   - In `apps/web/src/routes/+page.svelte`, `canEdit = false` suppresses `startSession()`.
   - When `session === null`, the editor tools (`BlockPalette`, `BlockStatePanel`, `SelectionPanel`, `EditToolbar`) are omitted from DOM.
   - The CSS stage layout collapses under 1000px to a single column, stacking panels below a 72vh canvas, which prevents simultaneous viewing and tool selection.
   - In `apps/web/test/m4-suite.ts` line 1098, an existing e2e test explicitly checks that coarse-only devices get the viewer without the toolbar. Removing the gate without adjusting this test will break `e2e.ts`.

3. **Input Ownership and Conflict**:
   - `EditSession.attach()` binds pointer listeners on canvas parent `host` with capture `true`.
   - `EditSession.onPointerDown` immediately returns on `pointerType === "touch"`, allowing touch events to reach `WebglRenderer`.
   - `WebglRenderer.mount()` attaches canvas listeners directly to `canvas`.
   - `WebglRenderer` currently handles 2-finger spread as pinch-zoom, but has no 2-finger pan, and a 2nd finger arriving during a tool stroke causes conflicting behavior (the renderer starts pinch-zooming while the session holds an active stroke).
   - Therefore, input ownership must be decoupled via `input: "external"` on `WebglRenderer`, routed through a new pure `gestures.ts` arbiter in `apps/web`.

4. **Test Infrastructure Alignment**:
   - The plan mentions "Playwright-style suites with touch emulation". The actual codebase uses `puppeteer-core` driving Chromium via Chrome DevTools Protocol (CDP) and `page.setViewport`.
   - `puppeteer-core` natively supports mobile viewports with touch emulation:
     `page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })`.
   - Single taps can be dispatched via CDP or DOM touch events; drags and multi-touch gestures via CDP `Input.dispatchTouchEvent` or synthetic pointer events.
   - Pure logic (e.g. `gestures.ts`) runs under Node/Vitest, which executes fast and cleanly (49/49 passed in 31s).

---

## 3. Caveats

- **Hardware Acceleration**: The dev VM runs software rendering (SwiftShader/Vulkan); real-device GPU performance numbers (fps, frame times, thermal characteristics) can only be measured on a real phone via Termux or Chrome on Android.
- **`m4-suite.ts` Coarse Pointer Assertion**: Line 1098 of `m4-suite.ts` (`ok(!m.toolbar, ...)`) directly tests the legacy behavior of gating coarse pointers. When MB3 enables mobile editing, this test must be updated to expect the mobile toolbar instead.
- **Axe-core Accessibility Enforcement**: `m4-suite.ts` strictly enforces 0 axe-core violations on all main states. Any mobile bottom sheet, thumb cluster, or dialog markup added in MB3–MB8 must satisfy all ARIA guidelines, roles, labels, and focus trap requirements.

---

## 4. Conclusion & Milestone Roadmap Technical Assessment

### Summary Assessment

The core editing architecture in `@voxwright/core` and the WebGL renderer in `@voxwright/render` are cleanly designed and ready for the mobile editor extensions. The blocking `server.fs.allow` issue is already resolved. The path forward for MB1–MB8 is well-defined:

| Milestone                                    | Key Files Involved                                                                                 | Technical Tasks & Recommendations                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MB1: Phone baseline & test harness**       | `apps/web/test/`, `apps/web/src/routes/+page.svelte`, `docs/phone-test.md`                         | Add `?perf=1` overlay displaying FPS, triangle count, heap, and DPR. Create phone-emulated Puppeteer test project (`width: 390, height: 844, hasTouch: true, isMobile: true`). Document Termux testing checklist in `docs/phone-test.md`.                                                                                |
| **MB2: Input ownership & gesture arbiter**   | `packages/render/src/webgl/renderer.ts`, `controls.ts`, `types.ts`, `apps/web/src/lib/gestures.ts` | Add `input: "builtin" \| "external"` to `WebglRendererOptions`. Expose `orbitBy`, `panBy`, `zoomBy`, `focusOn` on `WebglRenderer`. Implement pure `gestures.ts` state machine with unit test coverage in Vitest. Connect to `external` mode: one-finger orbit, two-finger pan, pinch zoom. Second finger cancels stroke. |
| **MB3: Mobile layout shell**                 | `apps/web/src/routes/+page.svelte`, new components in `apps/web/src/lib/components/`               | Remove coarse pointer gate (`canEdit`). Update `m4-suite.ts` coarse pointer check. Implement full-viewport layout (`100dvh`, safe-area insets, no page scroll). Create `BottomToolbar`, `ThumbCluster`, `BottomSheet` with 3 snap points (peek, half, full). Integrate existing panels into sheets.                      |
| **MB4: Precision placement (offset cursor)** | `apps/web/src/lib/editor-session.svelte.ts`, `apps/web/src/routes/+page.svelte`                    | Remove `pointerType === "touch"` early returns in `onPointerDown`/`Move`. Implement offset cursor (~64px above touch contact). Raycast from offset coordinate. Display reticle outline and ghost block during touch. Drag-off cancels stroke. Long press triggers eyedropper (`pick`).                                   |
| **MB5: Armed cell & nudge pad**              | `apps/web/src/lib/editor-session.svelte.ts`, `NudgePad.svelte`                                     | Implement "confirm" mode with ✓ / ✕ buttons and ±X, ±Y, ±Z d-pad steppers. Implement two-point armed placement for Line, Rectangle, and Select tools. Face adjustment steppers for selections. Unit test coordinate math against core builders.                                                                          |
| **MB6: Selection actions & block state**     | `apps/web/src/lib/components/`, `apps/web/src/lib/user-pack.ts`                                    | Selection bottom sheet (Fill, Replace, Copy, Paste, Rotate, Mirror, Move). Block-state bottom sheet with toggle switches for booleans and chip selectors for properties. Hotbar storing last 8 recent blocks in `localStorage`. Cell-for-cell export verification.                                                       |
| **MB7: Phone performance pass**              | `packages/render/src/webgl/renderer.ts`, `apps/web/src/routes/+page.svelte`                        | Dynamic resolution: scale canvas DPR (1.0–1.5) and disable MSAA during camera gestures, restoring upon idle. Memory budget tuning: lower default history cap on mobile. Restrict mesher worker pool to 2 on mobile devices.                                                                                              |
| **MB8: Polish & accessibility**              | `apps/web/test/contrast.test.ts`, `apps/web/src/lib/components/`, `docs/`                          | Toast notification with Undo action (4s auto-dismiss). Haptic feedback via `navigator.vibrate`. Left-handed layout toggle. Extend `contrast.test.ts` for all new UI colors. Full axe-core accessibility audit pass.                                                                                                      |

---

## 5. Verification Method

To independently verify all findings and test suites reported above:

1. **Verify vite.config.ts `server.fs.allow` configuration**:

   ```bash
   grep -n -C 3 "searchForWorkspaceRoot" apps/web/vite.config.ts
   ```
2. **Verify pointer gate and stage layout**:

   ```bash
   grep -n -C 5 "syncPointer" apps/web/src/routes/+page.svelte
   grep -n -C 5 "stage.editable" apps/web/src/routes/+page.svelte
   ```
3. **Verify EditSession touch handling**:

   ```bash
   grep -n -C 3 'pointerType === "touch"' apps/web/src/lib/editor-session.svelte.ts
   ```
4. **Verify WebglRenderer event listeners & OrbitController math**:

   ```bash
   grep -n -C 5 "this.listen(canvas" packages/render/src/webgl/renderer.ts
   grep -n -C 5 "rotate(" packages/render/src/webgl/controls.ts
   ```
5. **Run all automated test suites**:

   ```bash
   # Run Vitest test suites (core, render, mcbuilder, web)
   pnpm test

   # Run TypeScript typechecks
   pnpm typecheck

   # Run architecture dependency check
   pnpm depcheck

   # Build web app production bundle
   pnpm --filter @voxwright/web build

   # Run end-to-end browser suite (SwiftShader + CPU fallback, 338 checks)
   node apps/web/test/e2e.ts
   ```

**Invalidation conditions**:
- If `pnpm test` fails any unit tests.
- If `apps/web/vite.config.ts` fails to locate the workspace root.
- If `e2e.ts` fails any of the 338 checks.
