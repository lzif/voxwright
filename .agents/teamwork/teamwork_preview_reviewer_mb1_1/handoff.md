# Handoff Report: Milestone MB1 Review & Adversarial Audit

## Review Summary

**Verdict**: **APPROVE**

---

## 1. Observation

### Codebase Inspections & Diff

1. **`apps/web/src/lib/components/PerfOverlay.svelte`**:
   - Lines 10–12: Prop `renderer: WebglRenderer | null` ingested via Svelte 5 `$props()`. Local state `active = $state(false)`.
   - Lines 85–92: `onMount` inspects `new URLSearchParams(window.location.search).get("perf") === "1"`. If absent, component returns immediately without starting any timers or mounting DOM (`active` remains `false`).
   - Lines 62–83: When active, `requestAnimationFrame(tick)` samples frame timestamps in a sliding 1000ms window, updating reactive display metrics at 4 Hz (`now - lastSampleTime >= 250`) to eliminate unnecessary DOM layout churn.
   - Lines 33–60: `sampleMetrics()` safely wraps `renderer.stats()` in a `try...catch` block to guard against renderer teardown. Inspects Chromium `(performance as any).memory` with full type guards, falling back to `null` (`"n/a"`) on non-Chromium platforms. Safely falls back to `1` if `window.devicePixelRatio` is falsy.
   - Lines 94–96: `onDestroy` cleans up animation frame via `cancelAnimationFrame(animId)`.
   - Lines 130–166: Scoped CSS applies `position: fixed`, `pointer-events: none`, `user-select: none`, `z-index: 9999`, and safe-area insets (`env(safe-area-inset-top, 0px)` and `env(safe-area-inset-right, 0px)`).

2. **`apps/web/src/routes/+page.svelte`**:
   - Line 14: Clean import of `PerfOverlay`.
   - Line 47: `let renderer = $state.raw<WebglRenderer | null>(null);` correctly uses `$state.raw` rather than `$state` proxying, preserving raw Three.js object identity and preventing reactivity overhead on WebGL engine internals.
   - Line 851: Cleanly mounts `<PerfOverlay {renderer} />`.

3. **`apps/web/test/touch-e2e.ts`**:
   - Lines 19–25: Emulates realistic mobile device profile (`width: 390`, `height: 844`, `deviceScaleFactor: 3`, `hasTouch: true`, `isMobile: true`).
   - Lines 47–70: Implements `cdpTouchDrag` dispatching CDP `Input.dispatchTouchEvent` sequence (`touchStart`, interpolated `touchMove`s, and `touchEnd`). Correctly passes released touch points on `touchEnd` to satisfy Chromium's touch gesture recognizer.
   - Lines 73–112: Implements `cdpPinch` with two distinct touch identifiers (IDs 1 and 2).
   - Lines 135–284 (Part 1): Verifies coarse pointer detection, DPR 3, overlay absence when `?perf=1` is omitted, WebGL renderer selection, `Rafeals_house.nbt` loading, zero horizontal viewport overflow, CDP touch orbit, Puppeteer touchscreen orbit, tap, and pinch zoom.
   - Lines 286–412 (Part 2): Opens `?perf=1`, asserts overlay presence, asserts formatted DPR `"3.00"`, asserts positive rolling FPS, asserts scene triangles match `1,932`, asserts first frame latency displays, asserts JS heap metric displays or falls back to `"n/a"`, and tests touch gesture pass-through through the overlay coordinates.
   - Lines 410–419: Guaranteed cleanup in `finally` blocks for both browser and HTTP server instances.

4. **`docs/phone-test-checklist.md`**:
   - Complete manual test guide covering Termux on-device setup (including `termux-wake-lock` and `termux-setup-storage` for Android downloads folder), LAN Wi-Fi host instructions, WebGL2 hardware acceleration checks via `chrome://gpu`, 11-step manual checklist, and Decision 4 baseline telemetry template.

5. **`package.json` & `apps/web/package.json`**:
   - Added `"test:touch"` scripts cleanly without modifying existing build/test scripts.

### Independent Verification Run Commands & Results

- `pnpm --filter @voxwright/web typecheck`:
  - **Result**: `svelte-check found 0 errors and 0 warnings`, exit code 0.
- `pnpm test`:
  - **Result**: `49 passed (49 files), 786 passed, 190 skipped (976)`, exit code 0.
- `node apps/web/test/touch-e2e.ts`:
  - **Result**: `22 checks passed`, exit code 0.
- `node apps/web/test/e2e.ts`:
  - **Result**: `338 checks passed`, exit code 0 (zero regressions).
- `pnpm depcheck`:
  - **Result**: `no dependency violations found (317 modules, 818 dependencies cruised)`, exit code 0.
- `pnpm exec biome check` on changed implementation files:
  - **Result**: 0 syntax errors, exit code 0.

---

## 2. Logic Chain

1. **Integrity Audit**:
   - Checked for hardcoded test results, fake returns, or facade implementations.
   - _Finding_: No hardcoding. In `PerfOverlay.svelte`, `fps` is computed from rolling `performance.now()` frame intervals, `triangles` and `firstFullFrameMs` are queried dynamically from `renderer.stats()`, `heapUsedMb` is read from Chromium's live `performance.memory`, and `dpr` is read from `window.devicePixelRatio`.
   - In `touch-e2e.ts`, all assertions validate live CDP and Puppeteer interactions against a real built site running on localhost.

2. **Reactivity & State Isolation**:
   - Using `$state.raw` for `renderer` in `+page.svelte` is the correct Svelte 5 idiom for high-performance external engines (Three.js/WebGL2). It provides reactive prop propagation when `renderer = r;` is assigned without wrapping `WebglRenderer` in reactive proxies that would degrade render loops.
   - Destructuring `{ renderer } = $props()` in `PerfOverlay.svelte` functions reactively because Svelte 5 compiles prop access to getters, ensuring `sampleMetrics()` sees updated renderer references upon GPU initialization.

3. **Lifecycle & Resource Cleanup**:
   - `PerfOverlay` initiates `requestAnimationFrame` only if `?perf=1` is explicitly present in `window.location.search`.
   - When active, the rAF loop is cleanly cancelled in `onDestroy`.
   - The sliding `frameTimes` array is pruned to a 1000ms window, bounding memory usage.
   - Throttling UI updates to 250ms (4 Hz) prevents layout thrashing that could skew measured FPS.

4. **Touch Ergonomics & CSS Hygiene**:
   - `pointer-events: none` on `.perf-overlay` guarantees that the HUD never intercepts touch gestures meant for the 3D canvas or toolbar.
   - Tested explicitly in `touch-e2e.ts` by executing an orbit drag directly across the overlay's coordinates, confirming zero interference.
   - Safe area insets ensure visibility on notched mobile displays.

5. **Desktop Regression Guard**:
   - All 338 desktop checks in `apps/web/test/e2e.ts` pass without modification.
   - Mobile touch tests are cleanly isolated in `apps/web/test/touch-e2e.ts`.

---

## 3. Caveats

1. **Software Rasterizer Limitations in CI/VM**:
   - In headless dev environments, Chromium uses SwiftShader (CPU software rendering), reporting ~6 FPS for WebGL2. Actual mobile phone GPU hardware will yield significantly higher frame rates, which will be logged using physical hardware via `docs/phone-test-checklist.md`.
2. **Browser-Specific Memory API**:
   - `performance.memory` is specific to Chromium. On non-Chromium browsers (Firefox/Safari), the HUD displays `"n/a"` as designed.

---

## 4. Adversarial Challenge & Stress-Testing

### Challenge Assessment: LOW RISK

#### Challenge 1: Background Tab rAF Latency Spike

- **Scenario**: User switches away from Chrome or minimizes the browser with `?perf=1` active.
- **Stress-Test**: When a tab is backgrounded, the browser throttles rAF. Upon resumption, the timestamp delta exceeds 1000ms.
- **Result**: The loop `while (frameTimes.length > 0 && now - frameTimes[0] > 1000) frameTimes.shift()` completely clears old entries. If `frameTimes.length < 2`, `fps` and `frameMs` evaluate to 0 instead of NaN or negative numbers. **PASS**.

#### Challenge 2: Renderer Teardown Mid-Sample

- **Scenario**: File load error or WebGL context reset occurs while `sampleMetrics()` is reading stats.
- **Stress-Test**: `renderer.stats()` is protected with `try...catch` and null-checks.
- **Result**: No uncaught exceptions thrown during disposal. **PASS**.

#### Challenge 3: Gesture Occlusion

- **Scenario**: Mobile user touches the top right corner where the overlay sits.
- **Stress-Test**: Tested via CDP touch drag across overlay coordinates in `touch-e2e.ts`.
- **Result**: Pointer events pass transparently through to canvas, camera orbits smoothly. **PASS**.

---

## 5. Conclusion

**Verdict: APPROVE**

The MB1 implementation strictly satisfies all criteria of `PROJECT.md` and `docs/mobile-editor-plan.md` §4.1:
- Zero integrity violations.
- Clean reactive design with `$state.raw` and 4 Hz throttled rAF.
- Comprehensive headless touch E2E test suite (`touch-e2e.ts`) passing all 22 mobile checks.
- Zero regressions on existing desktop workflows (338/338 checks passed).
- Exhaustive documentation and baseline telemetry template in `docs/phone-test-checklist.md`.

---

## 6. Verification Method

To independently reproduce verification:

```bash
# 1. Typecheck
pnpm --filter @voxwright/web typecheck

# 2. Unit and integration tests
pnpm test

# 3. Build site and run mobile touch E2E suite
pnpm --filter @voxwright/web build
node apps/web/test/touch-e2e.ts

# 4. Run desktop regression E2E suite
node apps/web/test/e2e.ts

# 5. Dependency check
pnpm depcheck
```
