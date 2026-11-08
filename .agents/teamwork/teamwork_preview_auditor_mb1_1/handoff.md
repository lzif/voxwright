# Forensic Integrity Audit Report: Milestone MB1 (Phone baseline and test harness)

## Forensic Audit Summary

- **Work Product**: Milestone MB1 implementation (`apps/web/src/lib/components/PerfOverlay.svelte`, `apps/web/src/routes/+page.svelte`, `apps/web/test/touch-e2e.ts`, `docs/phone-test-checklist.md`, `apps/web/package.json`, `package.json`)
- **Profile**: General Project
- **Verdict**: **CLEAN**

---

## 1. Observation

### 1.1 Source Code & Static Analysis

1. **`apps/web/src/lib/components/PerfOverlay.svelte`**:
   - Query gating (Lines 86–92):

     ```typescript
     const params = new URLSearchParams(window.location.search);
     if (params.get("perf") !== "1") return;
     active = true;
     sampleMetrics();
     animId = requestAnimationFrame(tick);
     ```

     When `?perf=1` is not set, `active` remains `false`, the component renders zero DOM nodes (`{#if active}`), and starts no rAF loops.
   - Real rolling display FPS calculation (Lines 62–83):

     ```typescript
     function tick(now: number): void {
       frameTimes.push(now);
       while (frameTimes.length > 0 && now - (frameTimes[0] as number) > 1000) {
         frameTimes.shift();
       }
       if (now - lastSampleTime >= 250) {
         lastSampleTime = now;
         if (frameTimes.length >= 2) {
           const span = (frameTimes[frameTimes.length - 1] as number) - (frameTimes[0] as number);
           fps = span > 0 ? Math.round(((frameTimes.length - 1) * 1000) / span) : 0;
           frameMs = span > 0 ? Math.round((span / (frameTimes.length - 1)) * 10) / 10 : 0;
         }
       ...
     ```

     Uses real browser timestamp deltas from `requestAnimationFrame(tick)` over a 1000ms rolling window, sampled at 4 Hz (250ms). No hardcoded frame rates.
   - Real renderer telemetry (Lines 35–46):

     ```typescript
     if (renderer) {
       try {
         const s = renderer.stats();
         triangles = s.triangles;
         firstFullFrameMs = s.firstFullFrameMs;
       } catch {
       }
     }
     ```

     Invokes `renderer.stats()`, dynamically extracting `triangles` and `firstFullFrameMs` from the WebGL Three.js render pipeline.
   - Real memory inspection (Lines 49–56):

     ```typescript
     const mem = (performance as unknown as { memory?: ChromeMemory }).memory;
     if (mem && typeof mem.usedJSHeapSize === "number") {
       heapUsedMb = Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
       heapTotalMb = Math.round((mem.totalJSHeapSize / (1024 * 1024)) * 10) / 10;
     } else {
       heapUsedMb = null;
       heapTotalMb = null;
     }
     ```

     Safely queries Chromium's `performance.memory` API, falling back cleanly to `"n/a"` if undefined.
   - Device pixel ratio (Line 59):

     ```typescript
     dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
     ```

2. **`apps/web/src/routes/+page.svelte`**:
   - Line 14: Imports `PerfOverlay`.
   - Line 47: Uses raw reactive state `let renderer = $state.raw<WebglRenderer | null>(null);` to provide reactive binding to `<PerfOverlay {renderer} />` without proxying Three.js internals.
   - Line 851: Mounts `<PerfOverlay {renderer} />`.

3. **`apps/web/test/touch-e2e.ts`**:
   - Genuinely launches headless Chromium:

     ```typescript
     const browser = await puppeteer.launch({
       executablePath: chromium,
       headless: true,
       args: chromiumArgs(true),
     });
     ```
   - Configures mobile touch viewport:

     ```typescript
     export const MOBILE_VIEWPORT = {
       width: 390,
       height: 844,
       deviceScaleFactor: 3,
       hasTouch: true,
       isMobile: true,
     } as const;
     ```
   - Real CDP touch event dispatch (`Input.dispatchTouchEvent`) for drag and pinch:
     - Dispatches `touchStart`, `touchMove`, and `touchEnd`.
     - Asserts camera pose delta: `Math.abs(pose1.azimuth - pose0.azimuth) > 5 || Math.abs(pose1.elevation - pose0.elevation) > 5`.
     - Asserts canvas pixel buffer hash changed: `ok(pic1.hash !== pic0.hash)`.
     - Asserts two-finger pinch alters distance: `ok(pose3.distance > distBefore * 1.5)`.
     - Asserts `?perf=1` overlay renders with live non-zero FPS, real triangle counts (`1,932`), first full frame latency (`ms`), and heap memory.
     - Asserts touch events pass through overlay to canvas (`pointer-events: none`).

4. **Git Workspace Diff Inspection**:
   - `git status --porcelain`:

     ```text
     M apps/web/package.json
     M apps/web/src/routes/+page.svelte
     M package.json
     ?? apps/web/src/lib/components/PerfOverlay.svelte
     ?? apps/web/test/touch-e2e.ts
     ?? docs/phone-test-checklist.md
     ```

     No unauthorized files were modified or created.

### 1.2 Independent Empirical Verification Results

1. **`pnpm --filter @voxwright/web test:touch`**:

   ```text
   $ node test/touch-e2e.ts
     ok  [touch-viewer] browser reports coarse pointer and no fine pointer
     ok  [touch-viewer] devicePixelRatio is 3
     ok  [touch-viewer] touch events supported on window
     ok  [touch-viewer] the mobile viewer selects the WebGL renderer
     ok  [touch-viewer] perf overlay is inactive and unmounted without ?perf=1
     ok  [touch-viewer] the schematic opens and renders (704x1216, 233 colours)
     ok  [touch-viewer] page does not scroll horizontally (overflow: 0px)
     ok  [touch-viewer] toolbar is hidden for touch-only coarse device in MB1 viewer
     ok  [touch-viewer] CDP touch drag orbits camera (azimuth 45.0 -> 93.0, elevation 35.0 -> 51.0)
     ok  [touch-viewer] CDP touch orbit updates rendered picture hash
     ok  [touch-viewer] page.touchscreen drag turns the view (azimuth 93.0 -> 61.0)
     ok  [touch-viewer] touchscreen drag updates canvas picture
     ok  [touch-viewer] page.touchscreen.tap succeeds without error
     ok  [touch-viewer] two-finger pinch changes camera distance (22.4 -> 44.8)
     ok  [touch-viewer] ?perf=1 navigates and mounts the perf-overlay HUD
     ok  [touch-viewer] perf overlay reports DPR 3.00 (got: 3.00)
     ok  [touch-viewer] perf overlay reports active rolling FPS (6 (180ms))
     ok  [touch-viewer] perf overlay displays scene triangles (1,932)
     ok  [touch-viewer] perf overlay displays first full frame latency (288 ms)
     ok  [touch-viewer] perf overlay displays JS heap memory (5.5 / 9.3 MB)
     ok  [touch-viewer] touch gestures pass cleanly through the overlay to canvas
     ok  [touch-viewer] no console errors throughout mobile touch run
   22 checks passed
   ```

   Exit code: 0.

2. **`node apps/web/test/e2e.ts`**:
   - Exit code: 0.
   - Result: **338 checks passed** (all desktop viewer, editor, m4, and accessibility tests pass; 0 regressions).

3. **`pnpm --filter @voxwright/web typecheck`**:
   - Exit code: 0 (`svelte-check found 0 errors and 0 warnings`).

4. **`pnpm test`**:
   - Exit code: 0.
   - Result: **49 test files passed, 786 passed** (0 failures).

5. **`pnpm depcheck`**:
   - Exit code: 0 (`no dependency violations found`).

6. **`pnpm exec biome check apps/web/test/touch-e2e.ts docs/phone-test-checklist.md`**:
   - Exit code: 0 (`Checked 2 files in 12ms. No fixes applied`).

---

## 2. Logic Chain

1. **Zero Facades & Zero Mock Bypasses**:
   - `PerfOverlay.svelte` contains no hardcoded numbers, mock strings, or facade functions. Every displayed value is computed dynamically: FPS from rolling rAF frame timestamps, triangles and frame latency from `renderer.stats()`, heap memory from `performance.memory`, and DPR from `window.devicePixelRatio`.
   - When `?perf=1` is not present, the component performs early return before registering any animation frame callback or rendering any DOM, guaranteeing zero runtime overhead during standard usage.

2. **Empirical Mobile Touch & Telemetry Verification**:
   - `touch-e2e.ts` executes in headless Chromium under a mobile emulation profile (390 x 844, DPR 3, `hasTouch: true`).
   - The test independently verifies coarse pointer media query matching, uploads the `Rafeals_house.nbt` fixture, confirms 762 blocks, dispatches CDP touch drag events, and verifies camera rotation (>5°) as well as canvas pixel hash differences.
   - In `?perf=1` mode, the test verifies presence of the HUD, verifies DPR equals 3.00, verifies non-zero rolling FPS, scene triangles (1,932), first full frame latency, and pointer events passing through the HUD overlay to the canvas.

3. **Desktop Regression Guard**:
   - The entire existing desktop end-to-end test suite (`node apps/web/test/e2e.ts`) was executed independently and passed all 338 checks with 0 errors, confirming zero regression on desktop workflows.

4. **Strict Scope & Clean Git Status**:
   - Only files directly required for Milestone MB1 were altered or introduced. No core logic, codecs, or unauthorized files were modified.

---

## 3. Caveats

- In headless Chromium with SwiftShader (CPU software rasterizer), FPS numbers reflect software rendering (~6 FPS on VM) rather than physical mobile GPU performance. Physical phone benchmarks will be recorded via Termux using `docs/phone-test-checklist.md`.
- `performance.memory` is specific to Chromium-based browsers; non-Chromium browsers display `"n/a"`, which was verified in code inspection to handle undefined safely.

---

## 4. Conclusion

The Milestone MB1 implementation is authentic, rigorous, and fully compliant with `PROJECT.md` and `docs/mobile-editor-plan.md`. No shortcuts, facades, hardcoded test results, or mock bypasses exist.

### **Final Verdict**: **CLEAN**

---

## 5. Verification Method

To independently reproduce this forensic audit:

1. **Run Mobile Touch E2E Test Suite**:

   ```bash
   pnpm test:touch
   ```

   _Expected outcome_: 22 checks passed, exit code 0.

2. **Run Desktop E2E Regression Suite**:

   ```bash
   node apps/web/test/e2e.ts
   ```

   _Expected outcome_: 338 checks passed, exit code 0.

3. **Run Typecheck**:

   ```bash
   pnpm --filter @voxwright/web typecheck
   ```

   _Expected outcome_: 0 errors and 0 warnings, exit code 0.

4. **Run Unit & Integration Suites**:

   ```bash
   pnpm test
   ```

   _Expected outcome_: 49 test files passed (786 passed), exit code 0.

5. **Run Architecture & Dependency Boundary Audit**:

   ```bash
   pnpm depcheck
   ```

   _Expected outcome_: 0 violations found, exit code 0.
