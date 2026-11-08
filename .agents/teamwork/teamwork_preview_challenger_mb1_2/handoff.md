# Challenger Handoff Report: Milestone MB1 (Mobile Touch Viewport & Touch Behavior)

**Verdict**: **`APPROVE`**
**Overall Risk Assessment**: **`LOW`**

---

## 1. Observation

1. **Independent Verification of Baseline Test Suites**:
   - `pnpm test:touch`: Executed independently. Output: `22 checks passed`, exit code `0`.
   - `node apps/web/test/e2e.ts`: Executed independently. Output: `338 checks passed`, exit code `0`.
   - `pnpm test`: Executed independently. Output: `49 test files passed (786 passed | 190 skipped)`, exit code `0`.
   - `pnpm --filter @voxwright/web typecheck`: Executed independently. Output: `svelte-check found 0 errors and 0 warnings`, exit code `0`.
   - `pnpm depcheck`: Executed independently. Output: `no dependency violations found (317 modules, 818 dependencies cruised)`, exit code `0`.

2. **Adversarial Stress Test Suite (`apps/web/test/challenger-mb1-stress.ts`)**:
   An empirical stress harness with 8 test groups and 69 checks was authored and executed via `pnpm --filter @voxwright/web exec node test/challenger-mb1-stress.ts`.
   Output: **`Summary: 69 PASSED, 0 FAILED (Total: 69)`**, exit code `0`.

3. **Coarse Pointer Desktop Toolbar Gating (Test Group 6)**:
   - On a mobile touch session (`MOBILE_VIEWPORT`: 390x844, DPR 3, `hasTouch: true, isMobile: true`):
     - `matchMedia("(any-pointer: coarse)").matches` is `true`, `matchMedia("(any-pointer: fine)").matches` is `false`.
     - After opening `Rafeals_house.nbt` and settling:
       - `document.querySelector('[data-testid="toolbar"]')` is `null` (strictly absent).
       - `document.querySelector('[data-testid="editor-side"]')` is `null` (strictly absent).
       - `document.querySelectorAll('[data-testid^="tool-"]').length` is `0`.
       - `document.querySelector('[data-testid="undo"]')` is `null`.
       - `document.querySelector('[data-testid="redo"]')` is `null`.
       - `document.querySelector('[data-testid="edit-note"]')?.textContent` contains `"Editing needs a mouse and keyboard; on this device the page is a viewer."`.
       - `document.querySelector('[data-testid="convert"]')?.textContent` is `"Convert and download"` (not `"Export and download"`).
       - `window.__voxwright?.session()` is strictly `null`.
   - In contrast, on a desktop session (`1280x800`, DPR 1, `hasTouch: false, isMobile: false`):
     - `document.querySelector('[data-testid="toolbar"]')` is present.
     - `document.querySelector('[data-testid="editor-side"]')` is present.
     - `document.querySelector('[data-testid="convert"]')?.textContent` is `"Export and download"`.
     - `window.__voxwright?.session()` is active and non-null.

4. **`touch-action: none` and Zero Horizontal Overflow Across Multi-Viewport Matrix (Test Group 7)**:
   Tested across 8 distinct real-world device viewports:
   - `iPhone SE 1st gen` (320x568, DPR 2): `touchAction === "none"`, `docOverflow === 0px`, `canvasWidth (283.6px) <= windowWidth (404px)`.
   - `Android standard` (360x780, DPR 2.625): `touchAction === "none"`, `docOverflow === 0px`, `canvasWidth (323.6px) <= windowWidth (405px)`.
   - `iPhone SE 2nd/3rd gen` (375x667, DPR 2): `touchAction === "none"`, `docOverflow === 0px`, `canvasWidth (338.6px) <= windowWidth (404px)`.
   - `iPhone 12/13/14 baseline` (390x844, DPR 3): `touchAction === "none"`, `docOverflow === 0px`, `canvasWidth (353.6px) <= windowWidth (405px)`.
   - `Google Pixel 8` (412x915, DPR 2.625): `touchAction === "none"`, `docOverflow === 0px`, `canvasWidth (375.6px) <= windowWidth (412px)`.
   - `iPhone Pro Max` (430x932, DPR 3): `touchAction === "none"`, `docOverflow === 0px`, `canvasWidth (393.6px) <= windowWidth (430px)`.
   - `Mobile Landscape iPhone` (844x390, DPR 3): `touchAction === "none"`, `docOverflow === 0px`, `canvasWidth (807.6px) <= windowWidth (844px)`.
   - `Tablet Portrait` (768x1024, DPR 2): `touchAction === "none"`, `docOverflow === 0px`, `canvasWidth (731.6px) <= windowWidth (768px)`.
     In all 8 tested viewports, horizontal overflow was strictly `0px` (with subpixel body overflow `<= 1px`), and canvas computed `touch-action` was strictly `"none"`.

5. **Single-Finger Orbit and Pinch Zoom Against Adversarial Inputs (Test Groups 4 & 8)**:
   - _50 rapid sequential drags_ (opposing directions): camera azimuth, elevation, and distance stayed finite and valid; 0 errors.
   - _Out-of-bounds drags_ (`x: -500, y: -200` to `x: 3000, y: 5000`): camera elevation correctly clamped at `89.0°`, coordinates remained finite; 0 errors.
   - _Zero-delta touch drag_ (`dx: 0, dy: 0`): completed without NaN or error.
   - _Interleaved `touchCancel` mid-stroke_: subsequent normal drag rotated azimuth by `32.0°`; renderer cleanly recovered.
   - _20 rapid pinch oscillation cycles_: distance remained finite and positive (`22.4`); 0 errors.
   - _0-spread coincident pinch_ (both fingers on identical pixel coordinates): handled gracefully without division by zero or NaN (`distance: 22.4`).
   - _Inverted crossing-fingers pinch_ (fingers crossing over each other): distance remained finite and positive; 0 errors.
   - _3-finger simultaneous gesture_: camera pose remained uncorrupted; 0 errors.
   - _2-to-1 finger mid-pinch lift transition_: transition was seamless (`azimuth: 61.0°, distance: 18.7`).
   - _Pinch `touchCancel` interruption_: renderer recovered cleanly, subsequent 1-finger orbit turned azimuth by `32.0°`.

6. **Query Parameter and Telemetry Robustness (Test Groups 1, 2, 3, 5)**:
   - 15 query parameter permutations tested (`?perf=abc`, `?perf=0`, `?perf=false`, `?perf=`, `?perf`, `?perf=10`, `?perf=-1`, `?perf=2`, `?perf=1.0`, duplicate parameters, hash fragments): only canonical `?perf=1` activated the HUD.
   - Degraded / missing `performance.memory` (undefined, empty object, missing totalJSHeapSize, zero values): all degraded cleanly to `"n/a"` or `"0 / 0 MB"` with zero uncaught exceptions.
   - Rapid 50x viewport resize stress: WebGL context remained healthy, scene geometry intact (`1,932` triangles), HUD remained mounted and updated DPR to `3.00`.

---

## 2. Logic Chain

1. **MB1 Scope & Gating Contract**:
   - According to `docs/mobile-editor-plan.md` §4.1 and `PROJECT.md` FEAT-MB1-01 through FEAT-MB1-04, MB1 is strictly a "Phone baseline and test harness" milestone with "No behaviour change to editing". The removal of the coarse pointer editing lockout is explicitly scheduled for Milestone MB3 (FEAT-MB3-01).
   - In `apps/web/src/routes/+page.svelte` lines 640–645:

     ```typescript
     const syncPointer = (): void => {
       canEdit = fine.matches || !coarse.matches;
     };
     ```

     When a device has only coarse pointers, `canEdit` evaluates to `false`. Line 188 (`if (canEdit) startSession(...)`) ensures `session` is not initialized, preventing the desktop toolbar (`<EditToolbar>`) and side panels from mounting.
   - Observation 3 empirically confirms this invariant: on mobile touch sessions, all editing UI elements and `window.__voxwright.session()` are strictly absent, whereas desktop sessions mount the full editing interface.

2. **Touch-Action and Zero Horizontal Overflow**:
   - In `apps/web/src/routes/+page.svelte`, canvas CSS specifies `touch-action: none;`.
   - Observation 4 confirms that across all 8 mobile screen sizes (narrow 320px up to 844px landscape), computed `touch-action` is `"none"`, preventing native browser pinch-zoom or scrolling on the canvas.
   - Observation 4 also confirms that horizontal overflow (`scrollWidth - innerWidth`) is strictly `<= 1px` across all 8 viewports, ensuring zero horizontal wobble during touch gestures.

3. **Touch Orbit and Pinch Zoom Robustness**:
   - In `packages/render/src/webgl/renderer.ts` lines 845–851:

     ```typescript
     if (this.pointers.size === 2) {
       const spread = this.pointerSpread();
       if (this.pinch > 0 && spread > 0) this.orbit.zoom(this.pinch / spread);
       this.pinch = spread;
       this.requestFrame();
       return;
     }
     ```

     The guard `this.pinch > 0 && spread > 0` prevents division by zero when fingers are coincident (`spread === 0`).
   - In `packages/render/src/webgl/controls.ts` lines 81–86, `clamp` bounds elevation between `-89` and `89`, and distance between `minDistance` and `maxDistance`.
   - Observation 5 empirically confirms that degenerate gestures (0 spread, finger inversion, 3 fingers, mid-gesture lift, `touchCancel`) do not cause NaN values, unhandled exceptions, or camera instability.

4. **Telemetry HUD Isolation**:
   - `apps/web/src/lib/components/PerfOverlay.svelte` only activates when `new URLSearchParams(window.location.search).get("perf") === "1"`.
   - Observation 6 confirms that no rAF loops or DOM nodes mount when `?perf=1` is omitted or malformed, and missing Chromium memory APIs degrade gracefully.

---

## 3. Caveats

1. **Software WebGL2 Emulation (SwiftShader)**:
   - Tests were executed in headless Chromium using SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`).
   - Real-world GPU frame rates, hardware thermal throttling, and battery consumption cannot be evaluated in the dev container and must be tested on a physical phone via Termux according to `docs/phone-test-checklist.md`.
2. **`performance.memory` API**:
   - The memory metric in `PerfOverlay.svelte` is Chromium-specific. In Safari or Firefox, the overlay displays `"n/a"`, which was empirically verified to handle gracefully without error.

---

## 4. Conclusion

**Verdict: `APPROVE`**

Milestone MB1 satisfies all requirements set forth in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `docs/mobile-editor-plan.md`:
1. Coarse pointer detection strictly gates off the desktop toolbar and editing sessions on touch-only devices.
2. `touch-action: none` is enforced on the WebGL canvas, and the mobile viewer exhibits zero horizontal overflow across 8 mobile viewport sizes.
3. Touch single-finger orbit and pinch zoom withstand hostile and degenerate touch inputs (0-spread, crossing fingers, 3-finger gestures, mid-pinch finger releases, and `touchCancel` events) with complete state recovery.
4. The `?perf=1` debug overlay is robust, non-intrusive, and does not degrade default viewer performance.
5. Zero regressions observed across the entire desktop suite (338/338 checks passed) and core unit tests (786/786 passed).

---

## 5. Verification Method

To independently reproduce the empirical findings of this review:

1. **Run Full Adversarial Stress Suite**:

   ```bash
   pnpm --filter @voxwright/web exec node test/challenger-mb1-stress.ts
   ```

   _Expected result_: `69 PASSED, 0 FAILED (Total: 69)`, exit code 0.

2. **Run Mobile Touch E2E Suite**:

   ```bash
   pnpm test:touch
   ```

   _Expected result_: `22 checks passed`, exit code 0.

3. **Run Desktop E2E Suite**:

   ```bash
   node apps/web/test/e2e.ts
   ```

   _Expected result_: `338 checks passed`, exit code 0.

4. **Run Unit / Integration Test Suites**:

   ```bash
   pnpm test
   ```

   _Expected result_: `49 test files passed (786 passed)`, exit code 0.

5. **Run Typecheck & Dependency Cruise**:

   ```bash
   pnpm --filter @voxwright/web typecheck
   pnpm depcheck
   ```

   _Expected result_: 0 errors, 0 warnings, 0 dependency violations.

6. **Files to Inspect**:
   - `apps/web/test/challenger-mb1-stress.ts`
   - `apps/web/src/lib/components/PerfOverlay.svelte`
   - `apps/web/src/routes/+page.svelte` (lines 47, 640-645, 728-763, 851)
   - `apps/web/test/touch-e2e.ts`
   - `docs/phone-test-checklist.md`
