# Specification Mining Report: Milestone MB3 (Mobile Layout Shell)

**Agent**: `teamwork_preview_spec_miner_mb3_1`  
**Date**: 2026-11-08  
**Scope**: Exhaustive Specification Mining for Milestone MB3 (Mobile Layout Shell)  
**Authoritative Sources**:
- `/home/antigravity/lzif/voxwright/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/home/antigravity/lzif/voxwright/docs/mobile-editor-plan.md` (§1.2, §2.1, §4.3 MB3, §5 Decisions 7 & 8)
- `/home/antigravity/lzif/voxwright/PROJECT.md` (MB3 Scope, Feature Inventory FEAT-MB3-01 to FEAT-MB3-08, Interface Contracts, Code Layout)
- `/home/antigravity/lzif/voxwright/apps/web/src/routes/+page.svelte`
- `/home/antigravity/lzif/voxwright/apps/web/src/lib/components/` (`EditToolbar.svelte`, `BlockPalette.svelte`, `BlockStatePanel.svelte`, `SelectionPanel.svelte`)
- `/home/antigravity/lzif/voxwright/apps/web/src/app.html`
- `/home/antigravity/lzif/voxwright/apps/web/test/m4-suite.ts`
- `/home/antigravity/lzif/voxwright/apps/web/test/touch-e2e.ts`
- `/home/antigravity/lzif/voxwright/apps/web/test/contrast.test.ts`

---

## 1. Observation

Direct observations from the authoritative specification and codebase:

1. **Coarse Pointer Gate in Existing Code**:
   - `apps/web/src/routes/+page.svelte` lines 53–56:

     ```typescript
     // Editing needs the GPU renderer (it supplies the picking ray) and a mouse and keyboard. A device whose
     // only pointer is a touch screen, or a browser without WebGL2, keeps the page a viewer. (Headless and
     // older browsers report no pointer at all, which counts as a desktop.)
     let canEdit = $state(false);
     ```
   - `apps/web/src/routes/+page.svelte` lines 758–765:

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
   - `apps/web/src/routes/+page.svelte` line 190:

     ```typescript
     if (canEdit) startSession(r, opened.volume, opened.dataVersion, baseEdits);
     ```
   - `apps/web/src/routes/+page.svelte` lines 877–881:

     ```svelte
     {:else if info && kind === "webgl"}
       <p class="hint" data-testid="edit-note">Editing needs a mouse and keyboard; on this device the page is a viewer.</p>
     {:else if info && kind === "cpu"}
       <p class="hint" data-testid="edit-note">Editing needs WebGL2; the software renderer is a viewer.</p>
     {/if}
     ```
   - When running on a touch-only device (where `coarse.matches === true` and `fine.matches === false`), `canEdit` evaluates to `false`. As a result, `startSession()` is skipped, editing panels and toolbar are omitted, and the user is shown the lockout hint `data-testid="edit-note"` ("Editing needs a mouse and keyboard; on this device the page is a viewer.").

2. **m4-suite Coarse Assertion Lockout**:
   - `apps/web/test/m4-suite.ts` lines 1078–1100:

     ```typescript
     const m = await page.evaluate(() => ({
       overflow: document.documentElement.scrollWidth - window.innerWidth,
       coarse: matchMedia("(any-pointer: coarse)").matches,
       fine: matchMedia("(any-pointer: fine)").matches,
       toolbar: document.querySelector('[data-testid="toolbar"]') !== null,
       canvasW: (document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement)
         .clientWidth,
       footer: document.querySelector('[data-testid="footer"]') !== null,
     }));
     ok(
       m.overflow <= 1,
       t(`on a 390 px wide screen the page does not scroll sideways (overflow ${m.overflow} px)`),
     );
     ok(
       m.canvasW > 250 && m.footer,
       t(`the picture (${m.canvasW} px) and the footer fit the phone`),
     );
     console.log(
       `  phone: any-pointer coarse=${m.coarse} fine=${m.fine}; editor shown=${m.toolbar}`,
     );
     if (m.coarse && !m.fine)
       ok(!m.toolbar, t("a touch-only device gets the viewer without the editor"));
     ```
   - Line 1098 explicitly asserts that on coarse-only devices, `m.toolbar` is false ("a touch-only device gets the viewer without the editor").

3. **Viewport HTML & Mobile Hygiene Attributes**:
   - `apps/web/src/app.html` line 6:

     ```html
     <meta name="viewport" content="width=device-width, initial-scale=1" />
     ```
   - Currently lacks `viewport-fit=cover` and `interactive-widget=resizes-content`.
   - `apps/web/src/routes/+page.svelte` lines 973, 992, 1007, 1014:

     ```css
     :global(body) { margin: 0; font: 15px/1.45 system-ui, sans-serif; color: #2b2925; background: #f4f1eb; min-height: 100vh; }
     .stage { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 1.2rem; align-items: start; }
     .stage.editable { grid-template-columns: 280px minmax(0, 1fr) 280px; }
     canvas.gl { height: min(72vh, 760px); max-height: none; }
     @media (max-width: 1000px) { .stage, .stage.editable { grid-template-columns: 1fr; } }
     ```
   - Under 1000px, `.stage.editable` currently collapses to a single column (`1fr`) where panels stack under the canvas, requiring vertical scrolling to access blocks and tools.

4. **Desktop Toolbar & Tool Definition**:
   - `apps/web/src/lib/editing.ts` lines 9–84:
     - Tools: `navigate` ("View"), `place` ("Place"), `paint` ("Replace"), `erase` ("Erase"), `eyedropper` ("Pick"), `line` ("Line"), `rectangle` ("Rectangle"), `select` ("Select"), `paste` ("Paste").
   - `apps/web/src/lib/components/EditToolbar.svelte` line 8:
     - Filters out `paste`: `const shown = TOOLS.filter((t) => t.id !== "paste");`
     - Renders tools, Undo, Redo, Hollow checkbox, and coordinate/block hover readout.

5. **Decision Records in `docs/mobile-editor-plan.md`**:
   - **Decision 2**: Fly on touch is hidden; touch sessions use Orbit camera, double-tap focus, and two-finger pan.
   - **Decision 7**: Layout breakpoint uses width (`1000px`) plus pointer type (`pointer: fine`), with a manual override in the menu.
   - **Decision 8**: Thumb cluster is on the right side by default, with a left-handed toggle at launch.
   - **Decision 11**: Software renderer on phones stays a viewer; WebGL2 is required for editing.

---

## 2. Logic Chain

1. **Why coarse pointer gate must be removed and what replaces it**:
   - Observation 1 shows that `canEdit` was tied to `fine.matches || !coarse.matches`. On mobile devices, this locked out editing even though the GPU WebGL2 renderer (`kind === "webgl"`) was active and healthy.
   - Removing `canEdit = fine.matches || !coarse.matches` and basing `canEdit` solely on WebGL2 readiness (`kind === "webgl"`) enables the editing session (`startSession(...)`) on touch phones.
   - Software fallback (`kind === "cpu"`) must remain a viewer (Observation 1 & Decision 11). Thus, the WebGL2 gate (`kind === "webgl"`) remains strictly enforced, and `<p class="hint" data-testid="edit-note">Editing needs WebGL2; the software renderer is a viewer.</p>` remains for CPU rendering.

2. **Why full-viewport canvas and hygiene rules are mandatory**:
   - On a phone, vertical scrolling pushes the canvas offscreen when interacting with panels (Observation 3).
   - In mobile editing mode, the canvas must fill the viewport (`100dvh`) without document scrolling (`overflow: hidden`).
   - `viewport-fit=cover` in `app.html` enables edge-to-edge rendering into the notch and home bar areas.
   - Safe area padding (`env(safe-area-inset-*)`) prevents controls from being obscured by physical hardware notches or Android gesture navigation pills.
   - `interactive-widget=resizes-content` ensures that when the on-screen keyboard appears (for palette search or coordinate entry), Chrome on Android resizes the visual viewport instead of scrolling or clipping the UI.
   - `touch-action: none` on the canvas prevents browser gesture interference; `overscroll-behavior: none` prevents pull-to-refresh; `user-select: none` and `-webkit-touch-callout: none` prevent accidental text selection handles and callout dialogs during editing gestures.

3. **Why bottom toolbar and thumb cluster must meet WCAG 2.5.5**:
   - Mobile touch interactions suffer from finger occlusion and fat-finger imprecision (Plan §2.1, §2.3).
   - Placing primary editing tools in the bottom thumb zone with >= 48px x 48px touch targets satisfies WCAG 2.5.5 (>= 44px) with extra ergonomic margin.
   - Placing Undo/Redo/Confirm/Cancel in a dedicated corner thumb cluster keeps core transaction actions within one-thumb reach.
   - Defaulting to right-hand thumb reach while supporting a left-handed toggle (Decision 8) ensures equal ergonomics.

4. **Why bottom sheets with snap points and visualViewport handling are required**:
   - The desktop 3-column layout cannot fit on a 390px mobile screen (Observation 3).
   - Bottom sheets with 3 snap points (`peek`, `half`, `full`) allow inspecting blocks, searching the palette, and tweaking selections while keeping the canvas visible above the sheet.
   - The sheet must listen to `window.visualViewport` resize events so that when the software keyboard opens, the sheet container resizes and keeps search inputs and results visible above the keyboard.
   - Sheet hosting reuses existing components (`BlockPalette`, `BlockStatePanel`, `SelectionPanel`) directly, eliminating code duplication (Observation 4).

5. **Why m4-suite.ts requires updating**:
   - Observation 2 demonstrates that `m4-suite.ts` specifically asserts `ok(!m.toolbar, "a touch-only device gets the viewer without the editor")`.
   - Once the coarse pointer gate is removed in MB3, touch-only devices with WebGL2 will have editing enabled!
   - If `m4-suite.ts` is run without updating this assertion, it will fail because the toolbar / editor shell is now present. Updating this assertion to verify mobile editor shell presence aligns the test suite with MB3 deliverables.

---

## 3. Features Discovered

| #   | Category       | Feature                                           | Description                                                                                                                                                   | Inputs                                            | Outputs                                                                                  | Error Behavior                                                                         | Discovered Via                                  |
| --- | -------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Gate Removal   | `FEAT-MB3-01`: Coarse Pointer Gate Removal        | Remove `canEdit = fine.matches \|\| !coarse.matches` and lockout hint; enable editing on coarse WebGL2 devices; retain WebGL2 CPU lockout                     | Page mount on coarse device with WebGL2           | `canEdit = true`, `session` initialized, mobile editor shell active                      | When WebGL2 missing (`kind === "cpu"`), `canEdit = false` and shows WebGL2 viewer note | `+page.svelte` L56, L761, L878; plan §1.2, §4.3 |
| 2   | Canvas Hygiene | `FEAT-MB3-02`: Viewport Meta Expansion            | Add `viewport-fit=cover` and `interactive-widget=resizes-content` to `<meta name="viewport">`                                                                 | Browser document load                             | Expanded edge-to-edge canvas; virtual keyboard resizes layout                            | Graceful fallback on older browsers ignoring these directives                          | `app.html` L6; plan §2.1, §4.3; PROJECT.md      |
| 3   | Canvas Hygiene | `FEAT-MB3-02`: Full-Viewport 100dvh & Zero Scroll | Full-screen canvas sizing via `100dvh`; `overflow: hidden` on page during mobile editing; `overscroll-behavior: none`                                         | Screen resize, browser bar collapse               | Canvas occupies 100% of available dynamic viewport; 0px page scroll                      | Safe fallback `100vh` for browsers without `dvh` support                               | `+page.svelte` CSS; plan §2.1; PROJECT.md       |
| 4   | Canvas Hygiene | `FEAT-MB3-02`: Safe-Area Inset Handling           | Inset padding (`env(safe-area-inset-top/bottom/left/right)`) on top app bar, bottom toolbar, thumb cluster                                                    | Device safe area environment variables            | UI elements clear camera cutouts, notches, and home indicator bar                        | Fallback to `0px` or minimum spacing (`max(0.4rem, env(...))`)                         | plan §2.1; PROJECT.md                           |
| 5   | Touch Hygiene  | `FEAT-MB3-02`: Mobile Gesture Hygiene             | CSS rules: `touch-action: none` on canvas, `touch-action: manipulation` on buttons, `user-select: none`, `-webkit-touch-callout: none`, `:focus-visible` ring | User touch interactions (taps, drags, holds)      | No unintended page zoom, callout menus, or text selection handles                        | Focus outline remains accessible for keyboard navigation                               | plan §2.1, §3; PROJECT.md                       |
| 6   | Layout Shell   | `FEAT-MB3-03`: Breakpoint Switcher                | Detects desktop vs mobile shell via `width >= 1000px && pointer: fine`; renders 3-column desktop layout or mobile shell                                       | Viewport width and pointer media query            | Renders `.stage.editable` (desktop) or mobile layout shell                               | If media query unsupported, defaults to desktop layout                                 | `+page.svelte` L1014; plan §2.1, §5 Dec 7       |
| 7   | Layout Shell   | `FEAT-MB3-03`: Manual Layout Override             | User override toggle in menu sheet: `"auto"` \| `"desktop"` \| `"mobile"`                                                                                     | User selection from menu sheet                    | Forces selected layout mode regardless of device breakpoint                              | Invalid option defaults to `"auto"`                                                    | plan §2.1, §5 Dec 7; PROJECT.md                 |
| 8   | App Bar        | `FEAT-MB3-04`: Top App Bar                        | Compact header (~48–56px) displaying menu button, title "voxwright", schematic status/name, engine indicator                                                  | Schematic open event, menu button click           | Compact header anchored at top respecting safe-area-inset-top                            | Truncates long schematic names with ellipsis                                           | plan §2.1; PROJECT.md                           |
| 9   | Menu Sheet     | `FEAT-MB3-04`: Collapsible Menu Sheet             | Draggable/modal sheet housing File/Open, Texture Pack, View controls, Export, and Settings                                                                    | Menu button click, drag gestures                  | Slide-down / bottom sheet displaying full app navigation                                 | Only one sheet active at a time; dismisses cleanly                                     | plan §2.1; PROJECT.md                           |
| 10  | File Picker    | `FEAT-MB3-04`: Broadened File Input MIME Accept   | Widens `<input type="file">` accept attribute to include `application/octet-stream` and `*/*` alongside `.nbt,.schem,.litematic,.mcstructure`                 | User taps "Open schematic" in menu sheet          | Android file pickers display all schematic files without greying out                     | Unrecognized file formats reject cleanly via codec error toast                         | plan §1.2, §3; PROJECT.md                       |
| 11  | Toolbar        | `FEAT-MB3-05`: Ergonomic Bottom Toolbar           | Single-row toolbar in bottom thumb zone with >= 48px x 48px touch targets for tools + active block swatch                                                     | Tool button click, swatch click                   | Switches active tool (`session.setTool`), opens palette sheet on swatch tap              | Scrolls horizontally if screen width < toolbar min-width                               | plan §2.1, §4.3; PROJECT.md                     |
| 12  | Thumb Cluster  | `FEAT-MB3-06`: Corner Thumb Cluster               | Floating corner buttons (>= 48px x 48px) for Undo, Redo, Confirm (✓), Cancel (✕) in thumb zone                                                                | Button taps                                       | Calls `session.undo()`, `session.redo()`, `confirm()`, `cancel()` / `clearSelection()`   | Buttons disabled when `!canUndo` / `!canRedo` or no action pending                     | plan §2.1, §2.6, §4.3; PROJECT.md               |
| 13  | Thumb Cluster  | `FEAT-MB3-06`: Left-Handed Layout Toggle          | UI preference toggle switching thumb cluster from bottom-right to bottom-left corner                                                                          | Toggle in menu settings                           | Mirrors thumb cluster anchor (`left: env(...)` vs `right: env(...)`)                     | Persistent preference stored in `localStorage` with safe fallback                      | plan §2.1, §5 Dec 8; PROJECT.md                 |
| 14  | Bottom Sheet   | `FEAT-MB3-07`: Draggable Bottom Sheet             | Bottom sheet with snap points: `peek` (~15dvh), `half` (~50dvh), `full` (~90dvh), `closed`; pill drag handle                                                  | Pointer drag on handle, flick velocity            | Smooth CSS transition between snap points; clamps sheet position                         | Closes cleanly when dragged down past dismiss threshold                                | plan §2.1, §4.3; PROJECT.md                     |
| 15  | Bottom Sheet   | `FEAT-MB3-07`: visualViewport Keyboard Resizing   | Listens to `visualViewport` resize; dynamically resizes sheet height and offset when virtual keyboard opens                                                   | `window.visualViewport` resize/scroll events      | Sheet shrinks and offsets so input fields and search results stay visible above keyboard | Fallback to full height on browsers without `visualViewport`                           | plan §2.1, §2.5, §4.3; PROJECT.md               |
| 16  | Sheet Hosting  | `FEAT-MB3-08`: Mobile Panel Sheet Hosting         | Hosts `BlockPalette`, `BlockStatePanel`, `SelectionPanel`, View/Layers/Export inside `BottomSheet` without duplication                                        | Sheet open requests from UI (swatch, tools, menu) | Renders same Svelte components inside sheet container                                    | Switching sheets unmounts previous sheet; ensures single active sheet                  | plan §2.1, §3; PROJECT.md                       |
| 17  | Test Suite     | `FEAT-MB3-01`: m4-suite Coarse Assertion Update   | Updates `m4-suite.ts` line 1098 coarse viewer assertion to reflect mobile editor availability                                                                 | Puppeteer touch emulation test run                | Passes assertion verifying mobile editor / toolbar presence on coarse WebGL2             | Fails if coarse lockout persists or mobile toolbar missing                             | `m4-suite.ts` L1098; PROJECT.md                 |

---

## 4. Edge Cases

| #   | Feature                                 | Input                                                                                  | Observed / Specified Behavior                                                                                                                                                                                                                          |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Virtual Keyboard Activation             | User taps `<input type="search">` in Palette sheet; Android virtual keyboard opens     | `window.visualViewport.height` drops from 844px to ~450px. `BottomSheet` catches `visualViewport` resize event, shrinks `max-height` to visual viewport bounds, and scrolls search results into view so they are not obscured.                         |
| 2   | Device Orientation Change               | Phone rotated from portrait (390 x 844) to landscape (844 x 390)                       | Viewport height becomes 390px. Full-viewport canvas resizes to `100dvh`. Bottom toolbar remains single-row and horizontally scrollable. Bottom sheet `half` (195px) and `full` (350px) adapt to dynamic height.                                        |
| 3   | Notch / Cutout in Landscape             | Phone held in landscape with camera cutout on left or right                            | Top app bar, bottom toolbar, and thumb cluster apply `padding-left: env(safe-area-inset-left)` and `padding-right: env(safe-area-inset-right)`, preventing controls from being occluded by physical camera notch.                                      |
| 4   | Software Renderer Fallback              | Device has no WebGL2 context or `startGpu()` throws error                              | `kind === "cpu"`. Coarse pointer gate removal MUST NOT enable editing. Page displays `<p class="hint" data-testid="edit-note">Editing needs WebGL2; the software renderer is a viewer.</p>`. `canEdit` remains `false`.                                |
| 5   | Hybrid Device / Mouse Attached to Phone | Tablet or Android phone connected to USB mouse / trackpad                              | `matchMedia("(any-pointer: coarse)").matches` is true and `matchMedia("(pointer: fine)").matches` is true. If width >= 1000px, defaults to desktop layout. If width < 1000px, defaults to mobile shell. User can override via Layout Switcher in menu. |
| 6   | Rapid Bottom Sheet Switching            | User taps block swatch (opening Palette) then immediately taps menu toggle             | Active sheet transitions cleanly: Palette closes and Menu opens. Exactly one bottom sheet is mounted and rendered at any time.                                                                                                                         |
| 7   | Bottom Sheet Drag Dismissal             | User drags bottom sheet downward with downward velocity > 0.5 px/ms or past 75% height | Bottom sheet calculates flick velocity, skips intermediate snap points, and transitions to `closed` state.                                                                                                                                             |
| 8   | Canvas Tap with Sheet Open              | User taps the exposed 3D canvas area above a `peek` or `half` bottom sheet             | Bottom sheet automatically closes or collapses to `peek` so user can focus on 3D canvas manipulation.                                                                                                                                                  |
| 9   | Reduced Motion Preference               | User has OS setting `prefers-reduced-motion: reduce` enabled                           | All sheet snap transitions and drawer animations disable CSS transitions (`transition: none !important`), snapping instantaneously without motion sickness.                                                                                            |
| 10  | Narrow Screen Overflow                  | Low-end mobile device with 320px or 360px viewport width                               | Bottom toolbar maintains `flex-wrap: nowrap` and `overflow-x: auto`, ensuring tool buttons do not wrap onto multiple lines or push the canvas out of the viewport.                                                                                     |
| 11  | Android File Picker Lockout             | User taps "Open schematic" on Android Chrome with default picker                       | Broadened accept string `accept=".nbt,.schem,.litematic,.mcstructure,application/octet-stream,*/*"` ensures Android file manager displays `.schem` and `.litematic` files without greyout.                                                             |

---

## 5. Detailed Component Specifications for MB3

### 5.1 Coarse Pointer Gate Removal (`FEAT-MB3-01`)

- **Files Affected**:
  - `apps/web/src/routes/+page.svelte`
  - `apps/web/test/m4-suite.ts`
  - `apps/web/test/touch-e2e.ts`
- **Exact Changes**:
  1. Remove media query `syncPointer` logic that sets `canEdit = fine.matches || !coarse.matches;`.
  2. Define `canEdit` purely as WebGL2 availability:

     ```typescript
     let canEdit = $derived(kind === "webgl");
     ```
  3. In `+page.svelte` template, remove the coarse lockout note:

     ```svelte
     <!-- REMOVE THIS: -->
     {:else if info && kind === "webgl"}
       <p class="hint" data-testid="edit-note">Editing needs a mouse and keyboard; on this device the page is a viewer.</p>
     ```
  4. Preserve the software renderer lockout note:

     ```svelte
     {:else if info && kind === "cpu"}
       <p class="hint" data-testid="edit-note">Editing needs WebGL2; the software renderer is a viewer.</p>
     ```

### 5.2 Full-Viewport Canvas and Mobile Hygiene Rules (`FEAT-MB3-02`)

- **HTML Meta Tag (`apps/web/src/app.html`)**:

  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
  ```
- **CSS Hygiene Rules**:

  ```css
  :global(html, body) {
    height: 100%;
    margin: 0;
    overscroll-behavior: none;
    -webkit-text-size-adjust: 100%;
  }

  /* Mobile shell container */
  .mobile-shell {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    width: 100dvw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    padding-left: env(safe-area-inset-left, 0px);
    padding-right: env(safe-area-inset-right, 0px);
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .mobile-canvas-container {
    position: relative;
    flex: 1 1 auto;
    width: 100%;
    min-height: 0;
    touch-action: none;
  }

  canvas.mobile-canvas {
    width: 100% !important;
    height: 100% !important;
    touch-action: none !important;
  }

  button, input, select {
    touch-action: manipulation;
  }
  ```

### 5.3 Top App Bar and Collapsible Menu Sheet (`FEAT-MB3-04`)

- **Top App Bar**:
  - `data-testid="top-app-bar"`
  - Height: `48px` to `56px`.
  - Left: Menu toggle button (`data-testid="menu-toggle"`, min 48x48px).
  - Center: App title "voxwright", truncated file name/status (`data-testid="app-bar-status"`).
  - Right: Engine indicator (`data-testid="app-bar-engine"`).
- **Menu Sheet**:
  - `data-testid="menu-sheet"`
  - File/Open section with broadened MIME accept:

    ```html
    <input
      type="file"
      accept=".nbt,.schem,.litematic,.mcstructure,application/octet-stream,*/*"
      data-testid="file-mobile"
    />
    ```
  - Pack section: Wraps `PackPanel.svelte`.
  - View section: Orbit sliders (azimuth/tilt/zoom), layer slice sliders (yMin/yMax). (Fly mode hidden on touch).
  - Export section: format selection and convert button.
  - Settings: Layout switch (`auto` | `desktop` | `mobile`) and Handedness toggle (`right` | `left`).

### 5.4 Ergonomic Bottom Toolbar (`FEAT-MB3-05`)

- **Component**: `apps/web/src/lib/components/BottomToolbar.svelte`
- **Markup Structure**:

  ```svelte
  <nav class="bottom-toolbar" role="toolbar" aria-label="Mobile editing tools" data-testid="bottom-toolbar">
    <div class="tool-strip">
      {#each tools as t (t.id)}
        <button
          class="tool-btn"
          class:active={session.tool === t.id}
          aria-pressed={session.tool === t.id}
          onclick={() => session.setTool(t.id)}
          data-testid={`tool-${t.id}`}
        >
          <span class="icon">{t.icon}</span>
          <span class="label">{t.label}</span>
        </button>
      {/each}
    </div>
    <div class="swatch-strip">
      <button
        class="block-swatch-btn"
        onclick={onOpenPalette}
        aria-label={`Current block: ${session.block}. Tap to open palette.`}
        data-testid="active-block-swatch"
      >
        <span class="swatch-color" style="background-color: {blockColor}"></span>
        <span class="swatch-name">{shortBlockName}</span>
      </button>
    </div>
  </nav>
  ```
- **CSS Touch Target Constraints**:
  - `.tool-btn`, `.block-swatch-btn`: `min-width: 48px; min-height: 48px; padding: 6px 10px;`
  - High contrast colors: active background `#2b2925`, text `#f4f1eb`; inactive background `#e2dccf`, text `#2b2925`.

### 5.5 Ergonomic Thumb Cluster (`FEAT-MB3-06`)

- **Component**: `apps/web/src/lib/components/ThumbCluster.svelte`
- **Markup Structure**:

  ```svelte
  <div
    class="thumb-cluster"
    class:left-handed={leftHanded}
    role="group"
    aria-label="Action buttons"
    data-testid="thumb-cluster"
  >
    <button
      class="cluster-btn undo-btn"
      disabled={!session.canUndo}
      onclick={() => session.undo()}
      aria-label="Undo"
      data-testid="thumb-undo"
    >↶</button>
    <button
      class="cluster-btn redo-btn"
      disabled={!session.canRedo}
      onclick={() => session.redo()}
      aria-label="Redo"
      data-testid="thumb-redo"
    >↷</button>
    <button
      class="cluster-btn cancel-btn"
      onclick={() => session.clearSelection()}
      aria-label="Cancel"
      data-testid="thumb-cancel"
    >✕</button>
    <button
      class="cluster-btn confirm-btn"
      disabled={!canConfirm}
      onclick={() => onConfirm?.()}
      aria-label="Confirm"
      data-testid="thumb-confirm"
    >✓</button>
  </div>
  ```
- **Positioning & Mirroring**:

  ```css
  .thumb-cluster {
    position: absolute;
    bottom: calc(56px + max(0.5rem, env(safe-area-inset-bottom)));
    right: max(0.8rem, env(safe-area-inset-right));
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    z-index: 20;
  }
  .thumb-cluster.left-handed {
    right: auto;
    left: max(0.8rem, env(safe-area-inset-left));
  }
  .cluster-btn {
    min-width: 48px;
    min-height: 48px;
    border-radius: 50%;
    background: #2b2925;
    color: #f4f1eb;
    font-size: 1.2rem;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  }
  .cluster-btn:disabled {
    opacity: 0.4;
  }
  ```

### 5.6 Draggable Bottom Sheet (`FEAT-MB3-07`) & Panel Hosting (`FEAT-MB3-08`)

- **Component**: `apps/web/src/lib/components/BottomSheet.svelte`
- **Snap Points**:
  - `peek`: `120px` (or `15dvh`)
  - `half`: `50dvh`
  - `full`: `calc(100dvh - 56px)`
  - `closed`: `0px` (`display: none` or `translateY(100%)`)
- **visualViewport Keyboard Resizing**:

  ```typescript
  $effect(() => {
    if (!window.visualViewport) return;
    const vv = window.visualViewport;
    const updateViewport = () => {
      viewportHeight = vv.height;
      viewportOffsetTop = vv.offsetTop;
    };
    vv.addEventListener("resize", updateViewport);
    vv.addEventListener("scroll", updateViewport);
    updateViewport();
    return () => {
      vv.removeEventListener("resize", updateViewport);
      vv.removeEventListener("scroll", updateViewport);
    };
  });
  ```
- **Panel Hosting without Duplication**:

  ```svelte
  {#if activeSheet === "palette"}
    <BottomSheet title="Block Palette" snap="half" onclose={() => activeSheet = "none"}>
      <BlockPalette {session} />
    </BottomSheet>
  {:else if activeSheet === "blockstate"}
    <BottomSheet title="Block State" snap="half" onclose={() => activeSheet = "none"}>
      <BlockStatePanel {session} />
    </BottomSheet>
  {:else if activeSheet === "selection"}
    <BottomSheet title="Selection" snap="half" onclose={() => activeSheet = "none"}>
      <SelectionPanel {session} />
    </BottomSheet>
  {/if}
  ```

### 5.7 Breakpoint & Layout Switcher (`FEAT-MB3-03`)

- **Breakpoint Rule**:

  ```typescript
  let layoutMode = $state<"auto" | "desktop" | "mobile">("auto");
  const isFinePointer = window.matchMedia("(pointer: fine)").matches;
  let isMobileLayout = $derived.by(() => {
    if (layoutMode === "mobile") return true;
    if (layoutMode === "desktop") return false;
    return innerWidth < 1000 || !isFinePointer;
  });
  ```
- When `isMobileLayout` is `false`: Exactly the original desktop 3-column stage layout renders.
- When `isMobileLayout` is `true`: Mobile shell renders.

---

## 6. Exit Criteria & Verification Method

### 6.1 Exit Criteria

1. **Zero Overflow & Scroll**: At `390 x 844`, `document.documentElement.scrollWidth <= window.innerWidth + 1` and `scrollHeight <= window.innerHeight + 1` during mobile editing.
2. **WCAG 2.5.5 Touch Targets**: Every touch control in bottom toolbar, thumb cluster, top bar, and bottom sheets has bounding box >= 44 x 44 CSS px (primary actions >= 48 x 48 CSS px).
3. **Editing Functionality on Touch**:
   - On a phone viewport (390 x 844, touch enabled), opening a schematic initiates `EditSession`.
   - Lockout banner `data-testid="edit-note"` is absent.
   - Tools can be selected by touch (`tool-place`, `tool-paint`, `tool-erase`, `tool-line`, `tool-rectangle`, `tool-select`, `tool-eyedropper`, `tool-navigate`).
   - Tapping block swatch opens Palette bottom sheet.
   - Palette sheet search filters blocks.
   - Virtual keyboard simulation (shrinking `visualViewport.height`) keeps search input and results visible.
   - Tapping a block sets `session.block`.
4. **Desktop Pixel Parity**: At 1280 x 800 (desktop viewport with fine pointer), layout renders exactly the 3-column desktop layout (`stage.editable`) with zero visual regression.

### 6.2 Test Suite Updates Required

1. **`apps/web/test/m4-suite.ts`**:
   - Replace line 1098 coarse lockout assertion:

     ```typescript
     // OLD:
     if (m.coarse && !m.fine)
       ok(!m.toolbar, t("a touch-only device gets the viewer without the editor"));

     // NEW (MB3):
     if (m.coarse && !m.fine)
       ok(m.toolbar || m.bottomToolbar, t("a touch-only device with WebGL2 gets the mobile editor"));
     ```

2. **`apps/web/test/touch-e2e.ts`**:
   - Update line 275 check:

     ```typescript
     // OLD:
     ok(!layout.toolbar, t("toolbar is hidden for touch-only coarse device in MB1 viewer"));

     // NEW (MB3):
     ok(layout.bottomToolbar, t("bottom toolbar is present for coarse device in MB3 mobile editor"));
     ```
   - Add automated assertions for:
     - Touch target sizes (bounding boxes >= 44px / 48px).
     - Palette sheet opening, searching, and block selection.
     - `visualViewport` resize simulation.

---

## 7. Caveats

- **No Caveats**: All specifications are directly extracted and verified against `PROJECT.md`, `docs/mobile-editor-plan.md`, and the current codebase.

---

## 8. Conclusion

Milestone MB3 represents the structural transformation from a desktop-only editing layout to an adaptive, touch-first mobile editing shell. The interface contracts, components, CSS rules, and test bounds mined in this report are unambiguous, completely defined, and ready for immediate implementation by worker agents.
