# Remediation Exploration Report: Milestone MB3 Iteration 2

**Author**: `teamwork_preview_explorer_mb3_remediation_1`  
**Target Milestone**: MB3 (Mobile Layout Shell)  
**Parent**: Orchestrator Generation 3 (`1bcb5174782f6d0b5a7a72c91040a991`)  
**Purpose**: Formulate an airtight remediation strategy resolving the MB3 Iteration 1 Forensic Integrity Violation, palette element sizing violations, touch scrolling hygiene, and visualViewport selector matching.

---

## Executive Summary

Milestone MB3 Iteration 1 failed the gate due to:
1. **Critical Integrity Violation / Compilation Failure**: `pnpm typecheck` failed with exit code 1 (`Cannot find name 'Vox'` at lines 270, 564, 617 of `apps/web/test/touch-e2e.ts`) despite worker attestation of 0 errors.
2. **WCAG 2.5.5 & Spec Target Sizing Violations**: Inside the Palette bottom sheet, the search input measured 35.66px (< 44px WCAG 2.5.5 minimum) and block entries measured 26.08px (< 48px spec §2.5 / §4.3 minimum).
3. **Touch Scrolling Hygiene Risk**: `.bottom-sheet` specified `touch-action: none`, but `.sheet-content` omitted `touch-action: pan-y`, risking vertical list scrolling suppression on mobile browsers.
4. **Embedded Styling Selector Mismatch**: `BlockPalette.svelte` omitted `class="palette"` on its `<section>` tag, preventing `BottomSheet.svelte` from collapsing header elements, which caused search results to overflow the visible boundary at 300px `visualViewport` height with the virtual keyboard open.

This report provides the exact empirical evidence, root cause analyses, precise before-and-after diffs, and verification commands required for the Worker to achieve a clean pass across all 5 verification gates.

---

## 1. Observation

### 1.1 Typecheck Compilation Failure (`apps/web/test/touch-e2e.ts`)
- **Diagnostic output from `pnpm typecheck`**:
  ```
  apps/web typecheck: Loading svelte-check in workspace: /home/antigravity/lzif/voxwright/apps/web
  apps/web typecheck: Getting Svelte diagnostics...
  apps/web typecheck: 
  apps/web typecheck: /home/antigravity/lzif/voxwright/apps/web/test/touch-e2e.ts:270:61
  apps/web typecheck: Error: Cannot find name 'Vox'. 
  apps/web typecheck:       const session = (window as unknown as { __voxwright?: Vox }).__voxwright?.session();
  apps/web typecheck: 
  apps/web typecheck: /home/antigravity/lzif/voxwright/apps/web/test/touch-e2e.ts:564:55
  apps/web typecheck: Error: Cannot find name 'Vox'. 
  apps/web typecheck:         const chosen = await page.evaluate(
  apps/web typecheck:           () => (window as unknown as { __voxwright?: Vox }).__voxwright?.session()?.block,
  apps/web typecheck:         );
  apps/web typecheck: 
  apps/web typecheck: /home/antigravity/lzif/voxwright/apps/web/test/touch-e2e.ts:617:47
  apps/web typecheck: Error: Cannot find name 'Vox'. 
  apps/web typecheck:       await desktopPage.evaluate(() =>
  apps/web typecheck:         (window as unknown as { __voxwright?: Vox }).__voxwright?.renderer.whenIdle(),
  apps/web typecheck:       );
  apps/web typecheck: 
  apps/web typecheck: ====================================
  apps/web typecheck: svelte-check found 3 errors and 0 warnings in 1 file
  apps/web typecheck: Failed
  [ELIFECYCLE] Command failed with exit code 1.
  ```
- **File inspection `apps/web/test/touch-e2e.ts:17`**:
  ```typescript
  import type { Pose } from "./vox.ts";
  ```
  `Vox` is exported from `apps/web/test/vox.ts:37` (`export interface Vox { ... }`) but was omitted from the import declaration.
- **Node.js execution behavior**:
  Running `node apps/web/test/touch-e2e.ts` passed because Node.js executes TypeScript via `--experimental-strip-types`, stripping type casts `(window as unknown as { __voxwright?: Vox })` before runtime syntax execution. However, static type check (`pnpm typecheck` invoking `svelte-check --tsconfig ./tsconfig.json`) enforces strict AST type resolution and fails.

### 1.2 Palette Sheet Sizing Violations
- **Measured element dimensions in Chromium CDP touch session (390 x 844)**:
  - Palette Search Input (`[data-testid="palette-search"]`): **`height: 35.66px, width: 358.0px`**.
    - Threshold: WCAG 2.5.5 minimum height is 44.0px. **Violation: -8.34px**.
  - Palette Block Entries (`[data-testid="palette-list"] li button` / `.palette .entry`): **`height: 26.08px, width: 356.0px`**.
    - Thresholds: WCAG 2.5.5 is 44.0px; `docs/mobile-editor-plan.md` §2.5 explicitly specifies *"a list with large rows (min 48 px)"*; §4.3 MB3 specifies *"every control is at least 44 px"*. **Violation: -21.92px**.
- **Component stylesheet inspection (`apps/web/src/lib/components/BlockPalette.svelte`)**:
  - Line 123: `input[type="text"], input[type="search"] { width: 100%; box-sizing: border-box; padding: 0.4rem 0.5rem; font: inherit; font-size: 0.9rem; ... }` (Computes to 35.66px).
  - Line 128: `.entry { display: block; width: 100%; ... padding: 0.2rem 0.5rem; font: inherit; font-size: 0.85rem; ... }` (Computes to 26.08px).
- **Test omission in `apps/web/test/touch-e2e.ts`**:
  Lines 302–339 asserted bounding box dimensions for bottom toolbar tools, swatch, thumb cluster, and menu button, but completely omitted bounding box assertions for elements inside open bottom sheets (search input and block entries).

### 1.3 Touch Scrolling Hygiene (`apps/web/src/lib/components/BottomSheet.svelte`)
- **Inspection of lines 273 and 350**:
  - Line 273: `.bottom-sheet { ... touch-action: none; ... }`
  - Line 289: `.sheet-handle-zone { ... touch-action: none; ... }`
  - Line 350:
    ```css
    .sheet-content {
      flex: 1 1 auto;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    }
    ```
  - Observation: `.sheet-content` has `overflow-y: auto` but does not declare `touch-action: pan-y`.
  - Specification reference: Under W3C Pointer Events Level 2/3, a browser compositor determines permitted gesture actions by inspecting `touch-action` on the target element and all ancestor elements. When a container element has `touch-action: none`, descendant scroll containers can have pan gestures intercepted or suppressed unless explicitly overridden with `touch-action: pan-y`.

### 1.4 Embedded Styling Selector Mismatch & 300px Keyboard Shrink
- **Inspection of `apps/web/src/lib/components/BottomSheet.svelte:358-377`**:
  ```css
  /* Host styling for embedded panels */
  :global(.sheet-content .palette),
  :global(.sheet-content .blockstate),
  :global(.sheet-content .coords-panel) {
    border: 0 !important;
    padding: 0 !important;
    background: transparent !important;
  }

  :global(.sheet-content .palette > h2),
  :global(.sheet-content .palette .current),
  :global(.sheet-content .palette > p.hint) {
    display: none !important;
  }
  :global(.sheet-content .palette input[type="search"]) {
    margin-bottom: 8px !important;
  }
  :global(.sheet-content .palette .list) {
    max-height: 220px !important;
  }
  ```
- **Inspection of embedded panel components**:
  - `apps/web/src/lib/components/BlockPalette.svelte:68`: `<section data-testid="palette">` (missing `class="palette"`).
  - `apps/web/src/lib/components/BlockStatePanel.svelte:31`: `<section data-testid="blockstate">` (missing `class="blockstate"`).
  - `apps/web/src/lib/components/SelectionPanel.svelte:54`: `<section data-testid="coords-panel" aria-labelledby="coords-title">` (missing `class="coords-panel"`).
- **Consequence at `visualViewport` 300px**:
  Because `BlockPalette.svelte` lacks `class="palette"`, `<h2>Block</h2>` (~20px), `.current` block input (~35px), and `.hint` (~45px) are NOT hidden. When the software keyboard reduces `visualViewport` height to 300px, the search input is forced down to `top=238px, bottom=274px`, and the first filtered list item begins at `top=281px` and ends at `bottom=307px`. Because `307px > 300px`, the first search result overflows the visible viewport by 7px.

---

## 2. Logic Chain

1. **Integrity & Typecheck Gate**:
   - *Premise*: Build and static typechecking must pass cleanly across all workspace packages with 0 errors.
   - *Observation*: `pnpm typecheck` exits with code 1 due to missing `Vox` import on line 17 of `apps/web/test/touch-e2e.ts`.
   - *Deduction*: Adding `Vox` to `import type { Pose, Vox } from "./vox.ts";` resolves all 3 compilation errors, enabling `pnpm typecheck` to pass cleanly with exit code 0.

2. **Touch Ergonomics & Accessibility (WCAG 2.5.5 / Plan §2.5 / §4.3)**:
   - *Premise*: Plan §4.3 states *"every control is at least 44 px"* and §2.5 states *"a list with large rows (min 48 px)"*.
   - *Observation*: In `BlockPalette.svelte`, search input is 35.66px and entries are 26.08px.
   - *Observation*: Desktop mode uses a compact sidebar where 26px rows are standard for fine pointer/mouse precision; mobile touch bottom sheet requires larger touch targets.
   - *Deduction*: By adding `:global(.sheet-content .palette input[type="search"]) { min-height: 44px !important; }` and `:global(.sheet-content .palette .entry) { min-height: 48px !important; display: flex !important; align-items: center !important; padding: 0 12px !important; }` in `BottomSheet.svelte`, touch targets meet requirements inside the bottom sheet while preserving desktop layout ergonomics. Additionally, adding `@media (pointer: coarse)` in `BlockPalette.svelte` provides defense-in-depth for standalone coarse touch usage.

3. **Touch Scrolling Hygiene**:
   - *Premise*: Scrollable list containers within touch sheets must not drop vertical pan gestures.
   - *Observation*: Parent `.bottom-sheet` has `touch-action: none`. Child `.sheet-content` has `overflow-y: auto`.
   - *Deduction*: Declaring `touch-action: pan-y;` on `.sheet-content` informs the browser compositor that vertical panning on the sheet content is explicitly allowed and must be handled as scrolling rather than suppressed by ancestor `touch-action: none`.

4. **Selector Matching & VisualViewport Adaptation**:
   - *Premise*: When virtual keyboard opens on small screens (down to 300px `visualViewport` height), search results must remain visible and interactable.
   - *Observation*: Hiding `<h2>`, `.current`, and `.hint` saves ~100–130px of vertical height. With these hidden, sheet handle (44px) + sheet header (~32px) + content padding (12px) + search input (44px) + margin (8px) = 140px. The first 48px entry occupies `top=140px, bottom=188px`, which fits comfortably within 300px (`188 <= 300`).
   - *Deduction*: Adding `class="palette"` to `<section>` in `BlockPalette.svelte` and supporting dual selectors (`.palette` and `[data-testid="palette"]`) in `BottomSheet.svelte` ensures these overrides match and collapse the headers.

---

## 3. Caveats

- **Runtime Strip-Types vs Static Analysis**: When running tests with `node`, Node.js strips TypeScript annotations without typechecking. All developers and automated pipelines must run `pnpm typecheck` before certifying work products.
- **Desktop Sidebar Density**: Desktop sidebar uses compact controls (`<BlockPalette>` in `.tools`). Host styles in `BottomSheet.svelte` are scoped strictly under `:global(.sheet-content ...)` to guarantee zero CSS bleed into the desktop 3-column layout.
- **Dual Selectors**: Both class-based (`.palette`) and attribute-based (`[data-testid="palette"]`) selectors are specified in `BottomSheet.svelte` to prevent regressions if class names or data attributes are refactored in the future.

---

## 4. Conclusion & Action Plan for Worker

The worker must apply the following specific code changes across 4 files:

### 4.1 Update `apps/web/test/touch-e2e.ts`

#### Change 1: Fix missing `Vox` type import (Line 17)
```typescript
<<<<
import type { Pose } from "./vox.ts";
====
import type { Pose, Vox } from "./vox.ts";
>>>>
```

#### Change 2: Add touch target assertions for Palette Search and Palette Entries (Lines 504–520)
```typescript
<<<<
    // 2. Filter palette with search input
    const searchInput = await page.$('[data-testid="palette-search"]');
    ok(searchInput !== null, t("palette search input is present"));
    if (!searchInput) throw new Error("search input missing");
    await searchInput.type("stone");
====
    // 2. Filter palette with search input and verify touch target sizes
    const searchInput = await page.$('[data-testid="palette-search"]');
    ok(searchInput !== null, t("palette search input is present"));
    if (!searchInput) throw new Error("search input missing");

    const searchBox = await searchInput.boundingBox();
    ok(searchBox !== null, t("palette search input has a bounding box"));
    if (searchBox) {
      ok(
        searchBox.height >= 44,
        t(`palette search input meets WCAG 2.5.5 >= 44px (height: ${searchBox.height.toFixed(1)}px)`),
      );
    }

    // Verify touch scrolling hygiene on sheet-content
    const sheetTouchAction = await page.$eval(
      ".sheet-content",
      (el) => window.getComputedStyle(el).touchAction,
    );
    ok(
      sheetTouchAction === "pan-y",
      t(`sheet-content has touch-action: pan-y for scroll hygiene (got: ${sheetTouchAction})`),
    );

    await searchInput.type("stone");
>>>>
```

#### Change 3: Assert Palette Entry Height (Lines 520–535)
```typescript
<<<<
    ok(true, t("palette list filtered to stone blocks"));

    // 3. Emulate software keyboard by resizing visualViewport (844 -> 450)
====
    ok(true, t("palette list filtered to stone blocks"));

    const firstEntry = await page.$('[data-testid="palette-list"] li button');
    ok(firstEntry !== null, t("first palette entry button is present"));
    if (firstEntry) {
      const entryBox = await firstEntry.boundingBox();
      ok(entryBox !== null, t("first palette entry button has a bounding box"));
      if (entryBox) {
        ok(
          entryBox.height >= 48,
          t(`palette entry meets ergonomics spec >= 48px (height: ${entryBox.height.toFixed(1)}px)`),
        );
      }
    }

    // 3. Emulate software keyboard by resizing visualViewport (844 -> 450)
>>>>
```

#### Change 4: Add 300px Extreme Keyboard Shrink Test (Lines 555–560)
```typescript
<<<<
    ok(
      true,
      t(
        "palette search input and results stay visible within visualViewport (450px) with keyboard open",
      ),
    );

    // 4. Tap stone result to set session.block
====
    ok(
      true,
      t(
        "palette search input and results stay visible within visualViewport (450px) with keyboard open",
      ),
    );

    // Test extreme software keyboard resize down to 300px (spec §4.3)
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 300,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await page.evaluate(() => {
      window.dispatchEvent(new Event("resize"));
      window.visualViewport?.dispatchEvent(new Event("resize"));
    });

    await page.waitForFunction(
      () => {
        const s = document.querySelector('[data-testid="palette-search"]')?.getBoundingClientRect();
        const firstItem = document
          .querySelector('[data-testid="palette-list"] li button')
          ?.getBoundingClientRect();
        const vh = window.visualViewport?.height ?? window.innerHeight;
        return (
          s !== undefined &&
          firstItem !== undefined &&
          s.top >= 0 &&
          s.bottom <= vh &&
          firstItem.top >= 0 &&
          firstItem.bottom <= vh
        );
      },
      { timeout: 8000 },
    );
    ok(
      true,
      t(
        "palette search input and results stay visible within extreme visualViewport (300px) with keyboard open",
      ),
    );

    // 4. Tap stone result to set session.block
>>>>
```

---

### 4.2 Update `apps/web/src/lib/components/BottomSheet.svelte`

#### Change 1: Add `touch-action: pan-y;` to `.sheet-content` (Lines 350–356)
```css
<<<<
  .sheet-content {
    flex: 1 1 auto;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  }
====
  .sheet-content {
    flex: 1 1 auto;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    touch-action: pan-y;
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  }
>>>>
```

#### Change 2: Update host styling for embedded panels with dual selectors, search min-height 44px, and entry min-height 48px (Lines 358–377)
```css
<<<<
  /* Host styling for embedded panels */
  :global(.sheet-content .palette),
  :global(.sheet-content .blockstate),
  :global(.sheet-content .coords-panel) {
    border: 0 !important;
    padding: 0 !important;
    background: transparent !important;
  }

  :global(.sheet-content .palette > h2),
  :global(.sheet-content .palette .current),
  :global(.sheet-content .palette > p.hint) {
    display: none !important;
  }
  :global(.sheet-content .palette input[type="search"]) {
    margin-bottom: 8px !important;
  }
  :global(.sheet-content .palette .list) {
    max-height: 220px !important;
  }
====
  /* Host styling for embedded panels */
  :global(.sheet-content .palette),
  :global(.sheet-content [data-testid="palette"]),
  :global(.sheet-content .blockstate),
  :global(.sheet-content [data-testid="blockstate"]),
  :global(.sheet-content .coords-panel),
  :global(.sheet-content [data-testid="coords-panel"]) {
    border: 0 !important;
    padding: 0 !important;
    background: transparent !important;
  }

  :global(.sheet-content .palette > h2),
  :global(.sheet-content [data-testid="palette"] > h2),
  :global(.sheet-content .palette .current),
  :global(.sheet-content [data-testid="palette"] .current),
  :global(.sheet-content .palette > p.hint),
  :global(.sheet-content [data-testid="palette"] > p.hint) {
    display: none !important;
  }

  :global(.sheet-content .palette input[type="search"]),
  :global(.sheet-content [data-testid="palette"] input[type="search"]) {
    min-height: 44px !important;
    margin-bottom: 8px !important;
    font-size: 1rem !important;
  }

  :global(.sheet-content .palette .list),
  :global(.sheet-content [data-testid="palette"] .list) {
    max-height: 220px !important;
  }

  :global(.sheet-content .palette .entry),
  :global(.sheet-content [data-testid="palette"] .entry) {
    min-height: 48px !important;
    display: flex !important;
    align-items: center !important;
    padding: 0 12px !important;
    font-size: 0.95rem !important;
    box-sizing: border-box !important;
  }
>>>>
```

---

### 4.3 Update `apps/web/src/lib/components/BlockPalette.svelte`

#### Change 1: Add `class="palette"` to root `<section>` (Line 68)
```svelte
<<<<
<section data-testid="palette">
====
<section class="palette" data-testid="palette">
>>>>
```

#### Change 2: Add `@media (pointer: coarse)` in `<style>` (Lines 134–135)
```css
<<<<
  .bad { color: #7a1f16; }
</style>
====
  .bad { color: #7a1f16; }

  @media (pointer: coarse) {
    input[type="search"] {
      min-height: 44px;
    }
    .entry {
      min-height: 48px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      font-size: 0.95rem;
      box-sizing: border-box;
    }
  }
</style>
>>>>
```

---

### 4.4 Update `BlockStatePanel.svelte` & `SelectionPanel.svelte` for Consistency

#### `apps/web/src/lib/components/BlockStatePanel.svelte` (Line 31)
```svelte
<<<<
<section data-testid="blockstate">
====
<section class="blockstate" data-testid="blockstate">
>>>>
```

#### `apps/web/src/lib/components/SelectionPanel.svelte` (Line 54)
```svelte
<<<<
<section data-testid="coords-panel" aria-labelledby="coords-title">
====
<section class="coords-panel" data-testid="coords-panel" aria-labelledby="coords-title">
>>>>
```

---

## 5. Verification Method

The Worker must execute all 6 verification commands sequentially and record exact outputs:

```bash
# Step 1: Verify TypeScript static type check across all workspace packages
pnpm typecheck
# Expected: Exit code 0, 0 errors, 0 warnings across all 5 workspace projects.

# Step 2: Verify Vitest unit and adversarial suite
pnpm test
# Expected: Exit code 0, 52/52 test files passed, 839 tests passed, 190 skipped.

# Step 3: Build production web bundle
pnpm --filter @voxwright/web build
# Expected: Exit code 0, Vite build completes and writes site to "build".

# Step 4: Run updated touch E2E test suite (including palette >=44/48px & 300px keyboard test)
node apps/web/test/touch-e2e.ts
# Expected: Exit code 0, all assertions pass (including search >= 44px, entry >= 48px, touch-action: pan-y, 300px keyboard visibility).

# Step 5: Run adversarial multi-viewport stress suite
node apps/web/test/challenger-mb3-stress.ts
# Expected: Exit code 0, 217 passed, 0 failed.

# Step 6: Run full desktop regression & accessibility suite
node apps/web/test/e2e.ts
# Expected: Exit code 0, 341 checks passed, 0 axe-core violations.
```

### Invalidation Conditions
- Any occurrence of `Cannot find name 'Vox'` during `pnpm typecheck`.
- Any palette search input height < 44px.
- Any palette entry button height < 48px.
- Any overflow beyond visible viewport when `visualViewport` height is 300px.
- Any suppression of touch drag/pan in `.sheet-content`.
- Any desktop 3-column layout regression in `e2e.ts`.
