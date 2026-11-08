# Handoff Report: Milestone MB1 (Phone baseline and test harness)

## 1. Observation

1. **`apps/web/src/lib/components/PerfOverlay.svelte`**:
   - Created standalone telemetry HUD component.
   - Evaluates `new URLSearchParams(window.location.search).get("perf") === "1"`. When absent, `active` remains `false`, no DOM is mounted, and no requestAnimationFrame loop or event listeners run (zero overhead).
   - When active, a rolling `requestAnimationFrame` loop calculates true browser display FPS over a 1000ms window, throttled to 250ms (4 Hz) display updates to prevent DOM churn.
   - Reads `renderer.stats().triangles`, `renderer.stats().firstFullFrameMs`, `window.devicePixelRatio`, and safely inspects Chromium `(performance as any).memory` (`usedJSHeapSize`, `totalJSHeapSize`), displaying `"n/a"` if undefined.
   - Fixed monospace overlay with `pointer-events: none` positioned at `top: calc(0.5rem + env(safe-area-inset-top, 0px)); right: calc(0.5rem + env(safe-area-inset-right, 0px)); z-index: 9999;`.

2. **`apps/web/src/routes/+page.svelte`**:
   - Line 14: Added `import PerfOverlay from "../lib/components/PerfOverlay.svelte";`.
   - Line 47: Converted `let renderer: WebglRenderer | null = null;` to reactive raw state `let renderer = $state.raw<WebglRenderer | null>(null);` so that asynchronous initialization in `startGpu()` reactively propagates to child components without wrapping the WebGL renderer in a reactive proxy.
   - Line 851: Mounted `<PerfOverlay {renderer} />` next to `<RestoreDialog>`.

3. **`apps/web/test/touch-e2e.ts`**:
   - Created dedicated touch E2E test harness using `puppeteer-core`.
   - Emulates mobile viewport:

     ```typescript
     export const MOBILE_VIEWPORT = {
       width: 390,
       height: 844,
       deviceScaleFactor: 3,
       hasTouch: true,
       isMobile: true,
     } as const;
     ```
   - Part 1 verifies:
     - Environment detection: `coarse` pointer is `true`, `fine` pointer is `false`, `dpr` is `3`, and `"ontouchstart" in window` is `true`.
     - Inactive overlay: `document.querySelector('[data-testid="perf-overlay"]') === null` when `?perf=1` is omitted.
     - WebGL renderer selection (`kind === "webgl"`).
     - Schematic loading: opens `Rafeals_house.nbt` fixture and confirms 762 blocks.
     - Viewport hygiene: `scrollWidth - innerWidth <= 1` (zero horizontal overflow) and desktop toolbar omitted for coarse pointer in MB1 viewer.
     - Initial scene rendering (`pic0.w > 300 && pic0.distinct > 12`).
     - Touch single-finger orbit via CDP `Input.dispatchTouchEvent` rotating azimuth and elevation (> 5°) and updating picture hash.
     - Touch single-finger orbit via Puppeteer `page.touchscreen` rotating view and updating picture.
     - Touch tap via `page.touchscreen.tap` without errors.
     - Touch two-finger pinch zoom via CDP altering camera distance (from 22.4 to 44.8).
   - Part 2 verifies:
     - Opens page with `?perf=1` query parameter in a clean mobile session.
     - `[data-testid="perf-overlay"]` presence.
     - `[data-testid="perf-dpr"]` displaying `"3.00"`.
     - `[data-testid="perf-fps"]` displaying positive rolling FPS and frame time.
     - Opens `Rafeals_house.nbt` and asserts `[data-testid="perf-triangles"]` updates with scene count (`1,932` triangles).
     - `[data-testid="perf-first-frame"]` displaying initial render latency (e.g. `67 ms`).
     - `[data-testid="perf-heap"]` displaying formatted memory metrics.
     - Touch gesture pass-through: single-finger CDP drag on canvas through overlay rotates camera pose.
     - Zero unhandled console or page errors throughout.

4. **Package Scripts**:
   - `apps/web/package.json`: Added `"test:touch": "node test/touch-e2e.ts"`.
   - Root `package.json`: Added `"test:touch": "pnpm --filter @voxwright/web test:touch"`.

5. **`docs/phone-test-checklist.md`**:
   - Added complete physical phone manual testing guide covering Method A (Termux on-device), Method B (LAN Wi-Fi host), WebGL2 checks, 11-point pass/fail checklist, and Decision 4 baseline telemetry log template.
   - Formatted cleanly with Biome.

6. **Automated Verification Results**:
   - `pnpm --filter @voxwright/web test:touch`: Passed with **`22 checks passed`**, exit code 0.
   - `node apps/web/test/e2e.ts`: Passed with **`338 checks passed`**, exit code 0 (zero regressions).
   - `pnpm --filter @voxwright/web typecheck`: Passed with **`0 errors and 0 warnings`**, exit code 0.
   - `pnpm test`: Passed with **`49 passed (49 files), 786 passed`**, exit code 0.
   - `pnpm depcheck`: Passed with **`no dependency violations found`**, exit code 0.
   - `pnpm exec biome check` on all modified/created files: Clean.

---

## 2. Logic Chain

1. **Reactivity Isolation & Zero Overhead (FEAT-MB1-02)**:
   - In Svelte 5, non-reactive variables do not trigger downstream prop updates. Wrapping `WebglRenderer` in `$state` would proxy a complex Three.js object with internal state loops.
   - Declaring `let renderer = $state.raw<WebglRenderer | null>(null)` allows reactive assignment notification to `PerfOverlay` when `startGpu()` mounts the canvas, without proxying Three.js internals.
   - Checking `location.search` for `?perf=1` on mount ensures zero DOM nodes, zero rAF loops, and zero memory overhead when the query parameter is not present.

2. **Mobile Viewport & Touch Gesture Testing (FEAT-MB1-01)**:
   - Testing mobile behavior required a dedicated runner that sets `{ width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true }`.
   - In Chromium CDP, `Input.dispatchTouchEvent` requires sending the touch points being released on `touchEnd`. Sending `touchPoints: [{ x, y, id }]` allows Chromium to update its internal touch gesture recognizer, enabling subsequent single-touch and multi-touch interactions without getting stuck in a pressed state.
   - Separate test sections for baseline viewer and `?perf=1` HUD ensure both inactive and active states are strictly validated.

3. **Desktop Regression Guard**:
   - Isolating touch tests in `apps/web/test/touch-e2e.ts` and keeping `apps/web/test/e2e.ts` completely unmodified ensures all 338 desktop checks continue to pass without risk of regression.

4. **Real-Phone Testing & Decision 4 Documentation (FEAT-MB1-03, FEAT-MB1-04)**:
   - Termux process background suspension is mitigated via `termux-wake-lock`.
   - Android Chrome sandbox file picking isolation is resolved by documenting copying fixtures to `~/storage/shared/Download/` via `termux-setup-storage`.
   - Providing structured benchmark recording tables directly equips the project to settle Decision 4 for Milestone MB7.

---

## 3. Caveats

- In headless Chromium with SwiftShader (CPU software rasterizer), FPS numbers reflect software rendering rather than real mobile GPU hardware. Real mobile GPU numbers must be recorded using physical hardware as detailed in `docs/phone-test-checklist.md`.
- `performance.memory` is specific to Chromium-based browsers; in non-Chromium browsers, the overlay gracefully displays `"n/a"`.

---

## 4. Conclusion

Milestone MB1 is completely and genuinely implemented:
- Telemetry overlay `PerfOverlay.svelte` is functional and inactive unless `?perf=1` is requested.
- `+page.svelte` exposes `renderer` reactively via `$state.raw` and mounts `PerfOverlay`.
- `apps/web/test/touch-e2e.ts` reliably validates phone detection, touch gestures, and telemetry metrics.
- `docs/phone-test-checklist.md` provides complete physical phone manual testing and baseline logging procedures.
- All 22 mobile checks and all 338 desktop checks pass cleanly.

---

## 5. Verification Method

To independently verify this milestone:

1. **Run Mobile Touch E2E Test**:

   ```bash
   pnpm test:touch
   ```

   _Expected result_: 22 checks passed, exit code 0.

2. **Run Desktop E2E Test Suite**:

   ```bash
   node apps/web/test/e2e.ts
   ```

   _Expected result_: 338 checks passed, exit code 0.

3. **Run Typecheck**:

   ```bash
   pnpm --filter @voxwright/web typecheck
   ```

   _Expected result_: 0 errors and 0 warnings, exit code 0.

4. **Run Unit / Integration Test Suites**:

   ```bash
   pnpm test
   ```

   _Expected result_: 49 test files passed (786 tests passed), exit code 0.

5. **Run Dependency Cruise Check**:

   ```bash
   pnpm depcheck
   ```

   _Expected result_: 0 dependency violations found, exit code 0.

6. **Inspect Files**:
   - `apps/web/src/lib/components/PerfOverlay.svelte`
   - `apps/web/src/routes/+page.svelte`
   - `apps/web/test/touch-e2e.ts`
   - `docs/phone-test-checklist.md`
   - `apps/web/package.json`
   - `package.json`
