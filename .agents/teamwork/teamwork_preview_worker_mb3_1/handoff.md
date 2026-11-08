# Handoff Report: Milestone MB3 (Mobile Layout Shell)

## 1. Observation

- **Viewport Meta (`apps/web/src/app.html`)**:
  - Updated `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />` enabling full-bleed screen coverage and safe area insets on mobile displays.
- **BottomSheet Component (`apps/web/src/lib/components/BottomSheet.svelte`)**:
  - Implemented 4 snap states: `"closed"`, `"peek"` (160px), `"half"` (52% viewport height), and `"full"` (88% viewport height, expanding to 96% when keyboard opens).
  - Handles drag physics via `PointerCapture` and threshold velocity / position detection.
  - Automatically listens to `window.visualViewport` resize and scroll events, translating the sheet upward so that search inputs and result lists remain visible above the software keyboard.
  - Integrated accessible handle zone (`button` with `aria-label="Drag sheet handle"`), close button (`[data-testid="bottom-sheet-close"]`), and backdrop.
- **BottomToolbar Component (`apps/web/src/lib/components/BottomToolbar.svelte`)**:
  - Single-row horizontally scrollable container with thumb-zone positioning (`bottom: 0`, safe area padding).
  - All touch targets satisfy WCAG 2.5.5 (>= 44px) and ergonomics spec (>= 48px x 48px).
  - Features active block swatch with color swatch indicator (`[data-testid="active-block-swatch"]`), tool buttons (`[data-testid="tool-navigate"]`, `tool-place`, `tool-paint`, `tool-erase`, `tool-eyedropper`, `tool-line`, `tool-rectangle`, `tool-select`), and quick sheet toggles (`mobile-state-toggle`, `mobile-selection-toggle`).
- **ThumbCluster Component (`apps/web/src/lib/components/ThumbCluster.svelte`)**:
  - Floating 2x2 action cluster providing `Undo`, `Redo`, `Cancel` (✕), and `Confirm` (✓) buttons.
  - Placed at `bottom: calc(64px + env(safe-area-inset-bottom, 0px))`, positioned on the right by default and mirrored to the left when `leftHanded` is enabled.
- **Adaptive Page Integration (`apps/web/src/routes/+page.svelte`)**:
  - Retains a single persistent `<canvas>` instance across layout modes inside `.stage > .center > .canvas-host`, preventing WebGL context loss or chunk mesh rebuilds when resizing or switching layout modes.
  - Replaced coarse pointer lockout with `canEdit = $derived(kind === "webgl")`. Removed the coarse device lockout message while retaining the software renderer note (`Editing needs WebGL2; the software renderer is a viewer.`).
  - Added responsive Top App Bar (`[data-testid="top-app-bar"]`) with Menu button, app title, status chip, and engine chip.
  - Added mobile Menu sheet hosting File/Open, Texture Pack (`PackPanel`), View controls (azimuth, elevation, zoom, slice layers), Export (`select[data-testid="format"]`, `button[data-testid="convert"]`), Layout mode override (`Auto`, `Mobile`, `Desktop`), and Left-Handed controls toggle.
  - Broadened schematic file input accept attribute to `.nbt,.schem,.schematic,.litematic,application/octet-stream,*/*`.
- **Test Updates**:
  - `apps/web/test/m4-suite.ts`: Updated coarse WebGL2 assertion so coarse touch devices expect the toolbar to be present (`ok(m.toolbar, ...)`) and assert `lockout === null`.
  - `apps/web/test/touch-e2e.ts`: Updated line 275 assertion, added checks verifying zero document horizontal/vertical scroll (`overflow <= 1`), verified all touch targets >= 44px (WCAG 2.5.5) and >= 48px (spec), verified palette sheet opening and block filtering, verified visualViewport keyboard resize resilience (450px), and asserted desktop 1280x800 layout maintains 3-column stage with zero regressions.

## 2. Logic Chain

1. **Persistent Canvas Principle**:
   - Condition: WebGL2 context destruction occurs if the `<canvas>` DOM node is unmounted or recreated during layout toggles.
   - Solution: The `<canvas>` is kept permanently inside `<div class="canvas-host" class:mobile={isMobileLayout}>`. CSS switches between desktop stage columns (`height: min(72vh, 760px)`) and mobile full-bleed fixed viewport (`position: fixed; inset: 0; width: 100dvw; height: 100dvh; z-index: 10`).
   - Outcome: Context is 100% preserved; chunk meshes and textures remain untouched across layout transitions.

2. **Pointer & Ergonomics Compatibility**:
   - Condition: Coarse touch devices with WebGL2 support must be allowed to edit schematics, while headless test runners (like Puppeteer in CI) report no pointer devices (`pointer: fine` is false, `pointer: coarse` is false).
   - Solution: Layout detection uses `mqWidth.matches && (mqFine.matches || !mqCoarse.matches)`. A screen >= 1000px without a coarse pointer is recognized as desktop, while touch screens and viewports < 1000px adopt mobile layout. Manual overrides (`Auto`, `Mobile`, `Desktop`) are persisted in `localStorage`.
   - Outcome: Desktop tests run in desktop mode without requiring mouse emulation flags, and touch viewports cleanly switch to the mobile editing shell.

3. **Virtual Keyboard & VisualViewport**:
   - Condition: On mobile devices, opening the on-screen keyboard shrinks the visible viewport height (e.g. from 844px to 450px). A half-sheet would push search results off-screen.
   - Solution: `BottomSheet` listens to `window.visualViewport` resize/scroll events and derives `isKeyboardOpen`. When keyboard is active or effective height < 600px, the sheet expands to `full` snap and offsets with `keyboardOffset`, keeping input and search results visible within the viewport.
   - Outcome: Verified in `touch-e2e.ts` that both the palette search input and list results stay visible and tappable within a 450px visual viewport.

## 3. Caveats

- In headless Chromium without touch emulation (`pointer: fine` false and `pointer: coarse` false), the page defaults to desktop layout above 1000px width. Mobile mode can be explicitly forced either via viewport < 1000px, touch emulation (`hasTouch: true`), or the Layout Mode manual toggle.
- No other caveats.

## 4. Conclusion

Milestone MB3 is complete. The mobile layout shell is fully functional, responsive, and robust:
- Viewport meta cover, bottom sheets, docked toolbar, thumb cluster, and adaptive page integration are implemented.
- Coarse WebGL2 editing lockout has been eliminated without breaking CPU software renderer viewer constraints.
- All 104 checks in `touch-e2e.ts`, all 339 checks in `e2e.ts`, all 839 unit tests in `vitest`, and all TypeScript typechecks pass cleanly with 0 errors and 0 warnings.

## 5. Verification Method

To independently verify the implementation:

1. **Typecheck**:
   ```bash
   pnpm typecheck
   ```
   *Expected: 0 errors and 0 warnings across all 5 workspace projects.*

2. **Unit Tests**:
   ```bash
   pnpm test
   ```
   *Expected: 52 test files passed, 839 tests passed.*

3. **Mobile Touch End-to-End Suite**:
   ```bash
   pnpm --filter @voxwright/web build
   node apps/web/test/touch-e2e.ts
   ```
   *Expected: 104 checks passed, confirming zero scroll overflow, touch target sizes >= 44px / 48px, palette sheet interaction, keyboard resize adaptation, and desktop 1280x800 3-column regression check.*

4. **Full E2E Suite (WebGL, CPU, Editor, M4)**:
   ```bash
   node apps/web/test/e2e.ts
   ```
   *Expected: 339 checks passed, including coarse WebGL2 toolbar checks and axe-core accessibility checks.*
