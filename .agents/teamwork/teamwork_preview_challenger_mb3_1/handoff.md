# Adversarial Challenge Report: Milestone MB3 (Mobile Layout Shell)

**Agent**: `teamwork_preview_challenger_mb3_1`  
**Target Milestone**: MB3 (§4.3 of `docs/mobile-editor-plan.md` / `PROJECT.md`)  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Typecheck Failure (`pnpm typecheck`)
Execution of the mandatory baseline build verification command:
```bash
pnpm typecheck
```
Exited with code 1 and produced the following verbatim compilation diagnostic errors:
```
apps/web typecheck: /home/antigravity/lzif/voxwright/apps/web/test/touch-e2e.ts:270:61
apps/web typecheck: Error: Cannot find name 'Vox'. 
      const main = document.querySelector("main");
      const session = (window as unknown as { __voxwright?: Vox }).__voxwright?.session();
      const mq = window.matchMedia("(min-width: 1000px) and (pointer: fine)");

apps/web typecheck: /home/antigravity/lzif/voxwright/apps/web/test/touch-e2e.ts:564:55
apps/web typecheck: Error: Cannot find name 'Vox'. 
        const chosen = await page.evaluate(
          () => (window as unknown as { __voxwright?: Vox }).__voxwright?.session()?.block,
        );

apps/web typecheck: /home/antigravity/lzif/voxwright/apps/web/test/touch-e2e.ts:617:47
apps/web typecheck: Error: Cannot find name 'Vox'. 
      await desktopPage.evaluate(() =>
        (window as unknown as { __voxwright?: Vox }).__voxwright?.renderer.whenIdle(),
      );

====================================
svelte-check found 3 errors and 0 warnings in 1 file
[ELIFECYCLE] Command failed with exit code 1.
```
In `apps/web/test/touch-e2e.ts`, line 17:
```typescript
17: import type { Pose } from "./vox.ts";
```
`Vox` interface is exported from `./vox.ts` (line 37), but was omitted from the import declaration.

### 1.2 Existing Test Suites
- `node apps/web/test/touch-e2e.ts`: Passed (104 checks passed with exit code 0 when executed with runtime Node.js strip-types).
- `pnpm test`: Passed (52 test files passed, 839 tests passed with exit code 0).

### 1.3 Standalone Empirical Stress & Adversarial Test Suite (`apps/web/test/challenger-mb3-stress.ts`)
A comprehensive adversarial stress harness was authored and executed:
```bash
node apps/web/test/challenger-mb3-stress.ts
```
Result: **217 PASSED, 0 FAILED** (Total: 217 checks, exit code 0).

1. **Multi-Viewport Dimension Stress & Strict Overflow Verification**:
   - Tested 7 distinct viewports:
     - 320 x 568 (iPhone SE 1st gen, DPR 2, touch)
     - 360 x 640 (Galaxy S5 / budget Android, DPR 3, touch)
     - 390 x 844 (iPhone 12/13/14, DPR 3, touch)
     - 412 x 915 (Pixel 7, DPR 2.625, touch)
     - 768 x 1024 (iPad Portrait, DPR 2, touch)
     - 1024 x 768 (iPad Landscape, DPR 2, touch)
     - 1280 x 800 (Desktop HD, DPR 1, no-touch)
   - Across all touch viewports (initial welcome screen and active editor state):
     - `scrollWidth - clientWidth <= 1px` (0 horizontal overflow).
     - `scrollHeight - clientHeight <= 1px` (0 vertical page scroll).
     - `window.scrollX === 0` and `window.scrollY === 0`.
     - Mobile shell dynamically mounts `top-app-bar`, docked `toolbar`, and floating `thumb-cluster`.
     - Desktop 1280x800 layout preserves 3-column stage without mounting mobile chrome.

2. **WCAG 2.5.5 Touch Target Size Enforcement**:
   - Across both narrow (320px) and standard (390px) viewports:
     - All 16 primary touch targets (`mobile-menu-btn`, `tool-navigate`, `tool-place`, `tool-paint`, `tool-erase`, `tool-eyedropper`, `tool-line`, `tool-rectangle`, `tool-select`, `active-block-swatch`, `mobile-state-toggle`, `mobile-selection-toggle`, `undo`, `redo`, `cancel`, `confirm`):
     - Satisfy WCAG 2.5.5: `box.width >= 44.0px` and `box.height >= 44.0px`.
     - Satisfy ergonomics spec: `box.width >= 48.0px` and `box.height >= 48.0px`.
     - Sheet handle zone height: 44.0px.
     - Sheet close button: 44.0px x 44.0px.

3. **Rapid Layout Mode Toggling & WebGL Context Preservation**:
   - 10 rapid layout mode toggles (`mobile` -> `desktop` -> `auto` -> `mobile` -> ...) executed against live WebGL canvas.
   - Identified that `<canvas>` DOM element is never unmounted or replaced across transitions (`status.isSameCanvas === true`).
   - Monitored `webglcontextlost` event and `gl.isContextLost()`: 0 context losses occurred across all 10 cycles.
   - 1-finger touch orbit gesture immediately post-toggle verified interactive rendering remains fully operational (`deltaAzimuth = 40.0°`, 0 console errors).

4. **BottomSheet Drag Physics, Snap States & Fling Calculations**:
   - Initial snap: `half` snap (`visibleHeight = 440px`, `translateY(304px)`).
   - Drag handle upward: smoothly transitions to `full` snap (`visibleHeight = 744px`, `translateY(0px)`).
   - Downward fling (> 0.45 px/ms) from `full`: snaps down to `half` (`visibleHeight = 440px`, `translateY(304px)`).
   - Downward fling from `half`: snaps down to `peek` (`visibleHeight = 161px`, `translateY(583px)`).
   - Downward fling from `peek`: completely closes sheet and unmounts (`open = false`).
   - Reopened sheet dismissed cleanly via backdrop click.
   - Reopened sheet dismissed cleanly via `Escape` keypress.
   - Software keyboard simulation (`visualViewport` height 844 -> 450): sheet expands and keeps search input and block results fully visible within viewport.

5. **Ergonomic Controls & Left-Handed Mirroring**:
   - Default right-handed thumb cluster positioned on right (`x = 274.0px > 195px`).
   - Left-handed mode toggle in Menu sheet cleanly mirrors thumb cluster to left margin (`x = 12.0px <= 24px`).
   - Horizontal toolbar scroll (`maxScrollLeft = 366px`) operates cleanly without triggering page-level document scroll (`docScrollX = 0`).

---

## 2. Logic Chain

1. **Empirical Behavior is Robust**:
   - The UI components (`BottomSheet`, `BottomToolbar`, `ThumbCluster`), layout switching, CSS rules (`100dvh`, fixed canvas host, safe areas), and touch event handling meet all functional criteria set forth in §4.3 MB3 of `docs/mobile-editor-plan.md`.
   - All 217 adversarial stress tests and all 104 existing touch e2e checks pass cleanly without runtime exceptions or console errors.

2. **Typecheck Broken by Worker Change**:
   - In `apps/web/test/touch-e2e.ts`, the worker added lines 270, 564, and 617 referencing the type `Vox`:
     ```typescript
     const session = (window as unknown as { __voxwright?: Vox }).__voxwright?.session();
     ```
   - However, `Vox` was not included in the import from `./vox.ts`.
   - As a result, `pnpm typecheck` exits with code 1.
   - Although Node.js runtime strips types when executing `node apps/web/test/touch-e2e.ts` (allowing tests to run), static type checking fails for the workspace.
   - The worker's handoff claim that `pnpm typecheck` passed with "0 errors and 0 warnings across all 5 workspace projects" was empirically invalid.

3. **Gate Requirement**:
   - Clean compilation under `pnpm typecheck` is a non-negotiable exit criterion.
   - Per role constraints, the challenger does not modify implementation files. The worker must apply the 1-line import fix.

---

## 3. Caveats

- Testing was performed inside headless Chromium with SwiftShader WebGL2 software acceleration, which validates layout geometry, CDP touch emulation, and DOM lifecycle, but not hardware GPU thermal throttling on physical Android devices.
- No other caveats.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

The runtime implementation of Milestone MB3 is high-quality, highly stable, and passes all 217 empirical adversarial tests. However, the milestone cannot be approved until the worker fixes the TypeScript compilation error in `apps/web/test/touch-e2e.ts`.

### Action Required by Worker:
In `apps/web/test/touch-e2e.ts` line 17:
```diff
- import type { Pose } from "./vox.ts";
+ import type { Pose, Vox } from "./vox.ts";
```
Once this import is added, `pnpm typecheck` passes with 0 errors across all workspace packages.

---

## 5. Verification Method

To independently verify this report:

1. **Verify Typecheck Failure**:
   ```bash
   pnpm typecheck
   ```
   *Observed: Exits with code 1, reporting 3 errors in `apps/web/test/touch-e2e.ts` ("Cannot find name 'Vox'").*

2. **Verify Adversarial Stress Harness**:
   ```bash
   node apps/web/test/challenger-mb3-stress.ts
   ```
   *Observed: 217 passed, 0 failed across 7 viewports, rapid layout mode toggles, sheet drag/fling physics, and touch targets.*

3. **Verify Standard Touch E2E Suite**:
   ```bash
   node apps/web/test/touch-e2e.ts
   ```
   *Observed: 104 passed, 0 failed.*

4. **Verify Unit Test Suite**:
   ```bash
   pnpm test
   ```
   *Observed: 52 test files passed, 839 tests passed.*
