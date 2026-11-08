# Independent Review & Adversarial Challenge Report: Milestone MB1

## Review Summary

**Verdict**: **APPROVE**

Milestone MB1 (Phone baseline and test harness) satisfies all architectural, functional, test, and integrity requirements. The touch test harness (`apps/web/test/touch-e2e.ts`) executes real touch and multi-touch gesture assertions, the telemetry HUD (`apps/web/src/lib/components/PerfOverlay.svelte`) incurs strictly zero cost when inactive, desktop tests have zero regressions (338/338 pass), and no integrity violations or facade logic were detected.

---

## 1. Observation

1. **Desktop E2E Suite Execution**:
   - Command: `node apps/web/test/e2e.ts`
   - Output: `338 checks passed`, exit code `0`.
   - All desktop editing workflows, canvas interactions, keyboard accessibility, format imports/exports, autosave debouncing/recovery, and UI contrast checks pass without regression.

2. **Mobile Touch E2E Suite Execution**:
   - Command: `pnpm --filter @voxwright/web test:touch` (`node test/touch-e2e.ts`)
   - Output: `22 checks passed`, exit code `0`.
   - Verified real touch gestures:
     - CDP `Input.dispatchTouchEvent` 6-step single-finger drag rotated camera azimuth from 45.0° to 93.0° and elevation from 35.0° to 51.0°, altering canvas picture hash (`pic1.hash !== pic0.hash`).
     - Puppeteer `page.touchscreen.touchStart/Move/End` rotated azimuth from 93.0° to 61.0°, altering picture hash (`pic2.hash !== pic1.hash`).
     - Two-finger pinch via CDP moved camera distance from 22.4 to 44.8 (`pose3.distance > distBefore * 1.5`).
     - Puppeteer `page.touchscreen.tap` completed without error.
     - Viewport hygiene: `document.documentElement.scrollWidth - window.innerWidth <= 1` (0px overflow at 390x844).

3. **Zero-Cost Inactivation of `?perf=1` Overlay**:
   - In `apps/web/src/lib/components/PerfOverlay.svelte`:
     - Lines 86-88:

       ```typescript
       onMount(() => {
         const params = new URLSearchParams(window.location.search);
         if (params.get("perf") !== "1") return;
         active = true;
         sampleMetrics();
         animId = requestAnimationFrame(tick);
       });
       ```
     - Template lines 99-128 wrapped in `{#if active}`.
     - When `?perf=1` is absent, `active` remains `false`. No DOM elements are created or mounted, no event listeners are registered, no `sampleMetrics()` calls occur, and no `requestAnimationFrame` loop is started.
     - In `touch-e2e.ts` lines 159-162:

       ```typescript
       const overlayAbsent = await page.evaluate(
         () => document.querySelector('[data-testid="perf-overlay"]') === null,
       );
       ok(overlayAbsent, t("perf overlay is inactive and unmounted without ?perf=1"));
       ```

       Directly confirmed on mobile viewport without query parameter.

4. **Telemetry HUD Functionality When Active**:
   - Navigating to `?perf=1` mounts `<aside class="perf-overlay" data-testid="perf-overlay">`.
   - Displays:
     - `data-testid="perf-dpr"`: `"3.00"`
     - `data-testid="perf-fps"`: active rolling average FPS and frame time (e.g. `5 (191.6ms)` on SwiftShader)
     - `data-testid="perf-triangles"`: updates with scene triangles (`1,932` for `Rafeals_house.nbt`)
     - `data-testid="perf-first-frame"`: displays render latency (e.g. `173 ms`)
     - `data-testid="perf-heap"`: displays `usedJSHeapSize / totalJSHeapSize MB` on Chromium, or `"n/a"` if unsupported.
   - CSS properties: `pointer-events: none` and high z-index (`9999`). In `touch-e2e.ts` lines 382-398, a touch drag directly over the overlay rotates the underlying Three.js canvas by > 5° with zero event blocking.

5. **Typecheck, Unit, Dependency, and Build Verification**:
   - `pnpm --filter @voxwright/web typecheck`: `svelte-check found 0 errors and 0 warnings`, exit code 0.
   - `pnpm test`: `49 passed (49 files), 786 passed`, exit code 0.
   - `pnpm depcheck`: `✔ no dependency violations found (317 modules, 818 dependencies cruised)`, exit code 0.
   - `pnpm --filter @voxwright/web build`: Built cleanly with `@sveltejs/adapter-static` in 1.4s, exit code 0.

6. **Documentation & Physical Phone Test Procedures**:
   - `docs/phone-test-checklist.md` contains Termux instructions, Wi-Fi LAN host procedures, WebGL2 diagnostics (`chrome://gpu` / `#ignore-gpu-blocklist`), an 11-point pass/fail manual checklist, and a structured Decision 4 template for recording real-hardware telemetry on `Rafeals_house.nbt` and synthetic builds.

7. **Workspace & Layout Compliance**:
   - `.agents/teamwork/` contains exclusively agent metadata (`.md` reports, plans, briefings). Zero source code, tests, or binary fixtures were added to `.agents/teamwork/`.
   - New code strictly adheres to project layout (`apps/web/src/lib/components/PerfOverlay.svelte`, `apps/web/test/touch-e2e.ts`, `docs/phone-test-checklist.md`).

---

## 2. Logic Chain

1. **Integrity and Authenticity Verification**:
   - _Observation_: Source inspection of `PerfOverlay.svelte` and `touch-e2e.ts` shows dynamic metric extraction (`renderer.stats()`, `window.devicePixelRatio`, `performance.memory`, `renderer.getPose()`, `renderer.capture()`).
   - _Inference_: Tests do not compare against hardcoded strings or mocked values. Real WebGL rendering, camera orientation changes, and image hashes are validated.
   - _Conclusion_: **NO INTEGRITY VIOLATION**. Implementation is authentic and verifiable.

2. **Zero-Cost Verification**:
   - _Observation_: In `PerfOverlay.svelte`, `onMount` immediately returns if `params.get("perf") !== "1"`. `active` defaults to `false`. The template body is guarded by `{#if active}`.
   - _Inference_: When `?perf=1` is not in the URL, Svelte renders a comment placeholder node without DOM elements, and no animation frame loop or timer runs.
   - _Conclusion_: The overlay has zero CPU, GPU, and DOM overhead for regular users.

3. **Touch Input Realism Verification**:
   - _Observation_: `touch-e2e.ts` sets `MOBILE_VIEWPORT` with `hasTouch: true` and `isMobile: true`. It dispatches touch sequences through CDP `Input.dispatchTouchEvent` and Puppeteer `page.touchscreen`.
   - _Inference_: The renderer's camera responds to both single-touch drags (orbit) and multi-touch pinches (zoom), producing measurable coordinate rotations (> 5°) and picture hash modifications.
   - _Conclusion_: The test runner genuinely exercises the mobile touch path.

4. **Desktop Non-Regression Verification**:
   - _Observation_: The changes in `+page.svelte` are strictly additive (`<PerfOverlay {renderer} />` and `$state.raw` on `renderer`). All 338 desktop tests in `apps/web/test/e2e.ts` passed with 0 errors.
   - _Inference_: Existing desktop pointer and keyboard workflows are untouched.
   - _Conclusion_: Zero regression confirmed.

---

## 3. Adversarial Challenges & Stress Testing

### Challenge Summary

**Overall Risk Assessment**: **LOW**

### Challenge 1: Memory Accumulation in Telemetry Animation Loop

- **Assumption**: A long-running telemetry session could leak memory if frame history is unbounded.
- **Stress Test**: Inspected lines 63-66 in `PerfOverlay.svelte`:

  ```typescript
  frameTimes.push(now);
  while (frameTimes.length > 0 && now - (frameTimes[0] as number) > 1000) {
    frameTimes.shift();
  }
  ```
- **Result**: The array is pruned on every frame to retain only timestamps within the last 1000 ms (bounded to <= 120 elements at 120 Hz). Zero unbounded growth.
- **Pass/Fail**: **PASS**.

### Challenge 2: Reactivity Proxying of WebGL Renderer

- **Assumption**: Binding `renderer` as a reactive prop could wrap Three.js internals in deep Svelte 5 proxies, causing performance degradation or identity comparison bugs.
- **Stress Test**: Inspected `apps/web/src/routes/+page.svelte` line 47:

  ```typescript
  let renderer = $state.raw<WebglRenderer | null>(null);
  ```
- **Result**: `$state.raw` explicitly disables deep proxying while preserving reference-change reactivity to child components.
- **Pass/Fail**: **PASS**.

### Challenge 3: Cross-Browser Compatibility of `performance.memory`

- **Assumption**: Querying `performance.memory` on non-Chromium browsers (Firefox, Safari) could throw `TypeError`.
- **Stress Test**: Inspected lines 49-56 in `PerfOverlay.svelte`:

  ```typescript
  const mem = (performance as unknown as { memory?: ChromeMemory }).memory;
  if (mem && typeof mem.usedJSHeapSize === "number") { ... }
  else { heapUsedMb = null; heapTotalMb = null; }
  ```
- **Result**: Safe optional property access with fallback to `"n/a"`. No uncaught errors.
- **Pass/Fail**: **PASS**.

### Challenge 4: Interaction Blocking by the HUD

- **Assumption**: An overlay on a small mobile screen might block touches meant for the 3D canvas.
- **Stress Test**: In `touch-e2e.ts`, executed a touch drag directly across the overlay coordinates.
- **Result**: With CSS `pointer-events: none`, touches pass through unhindered, rotating the camera.
- **Pass/Fail**: **PASS**.

---

## 4. Caveats

- **Software Rasterizer Constraints**: On the headless Linux VM, Chromium runs WebGL2 via SwiftShader (CPU software rasterizer), yielding ~5–7 FPS. Real mobile GPU hardware frame rates must be collected on physical devices using `docs/phone-test-checklist.md` to establish the final Decision 4 baseline for MB7.
- No caveats regarding code correctness, safety, or test integrity.

---

## 5. Conclusion

**Verdict**: **APPROVE**

All acceptance criteria for Milestone MB1 have been met:
1. Zero regression on desktop E2E tests (`338 checks passed`).
2. Mobile touch runner executes real touch and multi-touch assertions (`22 checks passed`).
3. Zero-cost inactivation of `?perf=1` overlay when not in URL is verified.
4. Typecheck, unit tests, dependency check, and build all pass cleanly.
5. Physical phone test guide and Decision 4 benchmark template are in place.

---

## 6. Verification Method

To independently reproduce this verification:

1. **Touch E2E Test Suite**:

   ```bash
   pnpm --filter @voxwright/web test:touch
   ```

   _Expected_: `22 checks passed`, exit code `0`.

2. **Desktop E2E Test Suite**:

   ```bash
   node apps/web/test/e2e.ts
   ```

   _Expected_: `338 checks passed`, exit code `0`.

3. **Typecheck**:

   ```bash
   pnpm --filter @voxwright/web typecheck
   ```

   _Expected_: `0 errors and 0 warnings`, exit code `0`.

4. **Unit Tests**:

   ```bash
   pnpm test
   ```

   _Expected_: `49 passed (49 files), 786 passed`, exit code `0`.

5. **Dependency Check**:

   ```bash
   pnpm depcheck
   ```

   _Expected_: `✔ no dependency violations found`, exit code `0`.

6. **Web Production Build**:

   ```bash
   pnpm --filter @voxwright/web build
   ```

   _Expected_: Clean build with adapter-static, exit code `0`.
