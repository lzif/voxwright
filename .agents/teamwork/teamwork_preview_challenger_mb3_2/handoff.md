# Adversarial Challenge Report: Milestone MB3 (Mobile Layout Shell)

## VERDICT: REQUEST_CHANGES

The implementation of Milestone MB3 is substantially complete with solid architecture (persistent canvas WebGL context, touch toolbar with >=48px targets, responsive layout switching, and left-handed mirroring). However, empirical stress verification uncovered **two blocking defects**:
1. **TypeScript compilation failure in `apps/web/test/touch-e2e.ts`**: The worker claimed `pnpm typecheck` passed with 0 errors across all 5 workspace projects; in reality, `pnpm typecheck` fails with 3 errors due to an unimported `Vox` interface.
2. **VisualViewport 300px keyboard shrink results overflow**: In `apps/web/src/lib/components/BottomSheet.svelte`, embedded panel styling rules target CSS classes `.palette`, `.blockstate`, and `.coords-panel`. However, the host panels (`BlockPalette.svelte`, `BlockStatePanel.svelte`, `SelectionPanel.svelte`) define only `data-testid` attributes without those CSS classes. Consequently, `<h2>Block</h2>`, chosen block text input, and hint text remain unhidden inside the bottom sheet, consuming ~130px of vertical space and pushing search results out of view (`bottom=307 > 300`) during software keyboard display at 300px height.

---

## 1. Observation

### Observation 1: `pnpm typecheck` fails with 3 compile errors in `touch-e2e.ts`
When running `pnpm typecheck` on the root workspace:
```bash
$ pnpm typecheck
...
apps/web typecheck: Loading svelte-check in workspace: /home/antigravity/lzif/voxwright/apps/web
apps/web typecheck: Getting Svelte diagnostics...
apps/web typecheck: 
apps/web typecheck: /home/antigravity/lzif/voxwright/apps/web/test/touch-e2e.ts:270:61
apps/web typecheck: Error: Cannot find name 'Vox'. 
apps/web typecheck:       const main = document.querySelector("main");
apps/web typecheck:       const session = (window as unknown as { __voxwright?: Vox }).__voxwright?.session();
apps/web typecheck:       const mq = window.matchMedia("(min-width: 1000px) and (pointer: fine)");
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
In `apps/web/test/touch-e2e.ts` line 17:
```typescript
import type { Pose } from "./vox.ts";
```
`Vox` is defined in `apps/web/test/vox.ts` line 37 (`export interface Vox { ... }`), but was never imported in `touch-e2e.ts`.

### Observation 2: VisualViewport 300px keyboard shrink pushes search results out of view
In `apps/web/test/challenger-mb3-stress.ts` running against the served build with WebGL2 touch emulation:
```bash
$ node apps/web/test/challenger-mb3-stress.ts
...
--- SECTION 2: VisualViewport Resizing Stress (Keyboard Emulation) ---
  ok  [viewport-stress] active block swatch found
  ok  [viewport-stress] active block swatch has bounding box
  ok  [viewport-stress] BottomSheet mounted for palette
  ok  [viewport-stress] palette search input is present
  ok  [viewport-stress] palette list filtered to slab blocks

  * Stress testing visualViewport at 400px...
  ok  [viewport-stress] sheet repositioned within 400px viewport
  ok  [viewport-stress] search input within visible viewport at 400px (top=238, bottom=274)
  ok  [viewport-stress] filtered item found in DOM at 400px
  ok  [viewport-stress] first filtered item within visible viewport at 400px (top=281, bottom=307, name=Use “minecraft:slab”)
  ok  [viewport-stress] first button handle obtained at 400px
  ok  [viewport-stress] first button has bounding box at 400px
  ok  [viewport-stress] tapping palette entry at 400px successfully updated session block (got: minecraft:slab)

  * Stress testing visualViewport at 350px...
  ok  [viewport-stress] sheet repositioned within 350px viewport
  ok  [viewport-stress] search input within visible viewport at 350px (top=238, bottom=274)
  ok  [viewport-stress] filtered item found in DOM at 350px
  ok  [viewport-stress] first filtered item within visible viewport at 350px (top=281, bottom=307, name=Use “minecraft:slab”)
  ok  [viewport-stress] first button handle obtained at 350px
  ok  [viewport-stress] first button has bounding box at 350px
  ok  [viewport-stress] tapping palette entry at 350px successfully updated session block (got: minecraft:slab)

  * Stress testing visualViewport at 300px...
  ok  [viewport-stress] sheet repositioned within 300px viewport
  ok  [viewport-stress] search input within visible viewport at 300px (top=238, bottom=274)
  ok  [viewport-stress] filtered item found in DOM at 300px
  FAIL  [viewport-stress] first filtered item within visible viewport at 300px (top=281, bottom=307, name=Use “minecraft:slab”)
  ok  [viewport-stress] first button handle obtained at 300px
  ok  [viewport-stress] first button has bounding box at 300px
  ok  [viewport-stress] tapping palette entry at 300px successfully updated session block (got: minecraft:slab)
```
At visualViewport height = 300px, the first filtered search result item is positioned at `top=281, bottom=307`, which extends 7px past the bottom of the visible 300px viewport boundary (`bottom > 300`).

### Observation 3: CSS class selector mismatch in `BottomSheet.svelte` vs embedded panel components
In `apps/web/src/lib/components/BottomSheet.svelte` lines 358–377:
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
However, in `apps/web/src/lib/components/BlockPalette.svelte` line 68:
```svelte
<section data-testid="palette">
  <h2>Block</h2>
  <label class="current">
...
  <p class="hint">Used by Place, Replace, Line, Rectangle, Fill and Replace-in-selection. Type any block, with properties if you like.</p>
```
There is **no `class="palette"`** on `<section data-testid="palette">`.
Similarly, in `apps/web/src/lib/components/BlockStatePanel.svelte` line 31:
```svelte
<section data-testid="blockstate">
```
There is **no `class="blockstate"`**.
In `apps/web/src/lib/components/SelectionPanel.svelte` line 54:
```svelte
<section data-testid="coords-panel" aria-labelledby="coords-title">
```
There is **no `class="coords-panel"`**.

### Observation 4: Sheet cycling, backdrop dismiss, tool bar cycling, and left-handed mode verification
In `apps/web/test/challenger-mb3-stress.ts`:
- **Backdrop dismiss**: Tested on Palette, BlockState, Selection, and Menu sheets; each sheet dismissed cleanly on backdrop tap.
- **Rapid cycling stress**: 10 consecutive cycles through all 4 sheets with immediate backdrop dismisses passed with 0 unhandled promise rejections, 0 console errors, 0 ghost sheets remaining (`sheets: 0`), and 0 backdrops remaining (`backdrops: 0`).
- **Overlay trap check**: Direct 1-finger touch drag on the canvas after cycling rotated the camera cleanly (azimuth/elevation changed), confirming no invisible overlay trap was left behind.
- **Tool bar cycling**: All 8 tools (`navigate`, `place`, `paint`, `erase`, `eyedropper`, `line`, `rectangle`, `select`) were tapped under touch emulation. In all 8 cases, `session.tool` updated to the requested tool, the button gained the `.active` CSS class, and `aria-pressed="true"` was asserted.
- **Active swatch sheet toggle**: Tapping the active block swatch opened the Palette bottom sheet; dismissing closed it; tapping again reopened it.
- **Left-handed mode toggle**: Toggling the setting in the Menu sheet persisted `"voxwright.lefthanded": "true"` to `localStorage`, applied `.left-handed` to `[data-testid="thumb-cluster"]`, mirrored the cluster cleanly from `x=274px` to `x=12px` without causing horizontal or vertical document scroll overflow (`overflow <= 1px`), and left all buttons interactable. Toggling off restored `x=274px`.
- **Desktop regression suite**: Running `node apps/web/test/e2e.ts` passed 100% (339 checks passed), confirming desktop 3-column layout and all desktop editing workflows remain intact.

---

## 2. Logic Chain

1. **Premise**: In TypeScript and CI pipelines, all workspace code and tests must pass `pnpm typecheck` with 0 errors.
   - Observation 1 shows `touch-e2e.ts` fails `svelte-check` with 3 errors: `Cannot find name 'Vox'`.
   - Therefore, the worker's handoff claim that all TypeScript typechecks pass cleanly is invalid, and CI typecheck will fail.

2. **Premise**: Milestone MB3 (§4.3) and prompt specification state:
   *"with the keyboard open the results stay visible and are interactable at 400px, 350px, and 300px"*
   - In `BottomSheet.svelte`, the author intended to compact the embedded `BlockPalette` by hiding `<h2>`, the chosen block input (`.current`), and the explanatory text (`.hint`), and restricting list height to 220px, specifically so the search input and results would stay visible within a reduced viewport.
   - However, Observation 3 shows the CSS rules in `BottomSheet.svelte` use `:global(.sheet-content .palette ...)`. The `<section>` tag in `BlockPalette.svelte` only has `data-testid="palette"` and lacks the class `class="palette"`.
   - As a consequence, none of those display-none or height overrides are matched or applied. The unhidden header, input, and hint consume ~130px of vertical space.
   - Observation 2 demonstrates that when visualViewport is shrunk to 300px, the search input is forced to `top=238, bottom=274`, and the first filtered list item begins at `top=281` and extends to `bottom=307px` — overflowing 7px beyond the 300px viewport boundary.
   - Therefore, at 300px software keyboard height, filtered results are partially hidden and overflow the visible viewport.

---

## 3. Caveats

- At 400px and 350px visual viewport heights, the filtered results remain visible and interactable even without the CSS overrides, because the viewport has sufficient height to accommodate both the unhidden header elements and the first few results. The defect surfaces only when the viewport shrinks below ~320px (such as on smaller Android phones or when the software keyboard occupies >60% of the display).
- Rapid cycling was tested with sequential open-and-dismiss actions (10 full cycles) and passed with 0 ghost sheets. Multi-finger simultaneous gestures on the backdrop while dragging the handle were not simulated as the physical browser queues pointer captures per touch identifier.

---

## 4. Conclusion

**VERDICT: REQUEST_CHANGES.**

Required fixes before approval:
1. **Fix `apps/web/test/touch-e2e.ts` import**:
   Add `Vox` to the type import on line 17:
   ```typescript
   import type { Pose, Vox } from "./vox.ts";
   ```
   Verify that `pnpm typecheck` completes with 0 errors and 0 warnings.
2. **Fix host panel class names or CSS selectors in `BottomSheet.svelte`**:
   Either add the matching CSS classes to the panel components:
   - In `apps/web/src/lib/components/BlockPalette.svelte` line 68: `<section class="palette" data-testid="palette">`
   - In `apps/web/src/lib/components/BlockStatePanel.svelte` line 31: `<section class="blockstate" data-testid="blockstate">`
   - In `apps/web/src/lib/components/SelectionPanel.svelte` line 54: `<section class="coords-panel" data-testid="coords-panel" ...>`
   OR update the CSS selectors in `BottomSheet.svelte` lines 359–377 to use attribute selectors `[data-testid="palette"]`, `[data-testid="blockstate"]`, `[data-testid="coords-panel"]`:
   ```css
   :global(.sheet-content [data-testid="palette"] > h2),
   :global(.sheet-content [data-testid="palette"] .current),
   :global(.sheet-content [data-testid="palette"] > p.hint) {
     display: none !important;
   }
   :global(.sheet-content [data-testid="palette"] input[type="search"]) {
     margin-bottom: 8px !important;
   }
   :global(.sheet-content [data-testid="palette"] .list) {
     max-height: 220px !important;
   }
   ```
   This will properly hide the ~130px redundant header and ensure search results remain comfortably visible (`bottom <= 300px`) at 300px visual viewport height.

---

## 5. Verification Method

To independently verify the defects and subsequent resolution:

1. **Verify TypeScript Failure**:
   ```bash
   pnpm typecheck
   ```
   *Current result: 3 errors in `apps/web/test/touch-e2e.ts`.*
   *Pass criterion after fix: 0 errors and 0 warnings across all 5 workspace projects.*

2. **Verify VisualViewport & Sheet Stress Harness**:
   ```bash
   pnpm --filter @voxwright/web build
   node apps/web/test/challenger-mb3-stress.ts
   ```
   *Current result: 123 passed, 1 failed (`[viewport-stress] first filtered item within visible viewport at 300px (top=281, bottom=307)`).*
   *Pass criterion after fix: 124 passed, 0 failed.*

3. **Verify Regression Suites**:
   ```bash
   node apps/web/test/touch-e2e.ts
   node apps/web/test/e2e.ts
   ```
   *Pass criterion: 104 checks pass in `touch-e2e.ts` and 339 checks pass in `e2e.ts`.*
