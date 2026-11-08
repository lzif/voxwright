# Architecture and Implementation Design for Milestone MB3: Mobile Layout Shell

## 1. Observation

### 1.1 Current Pointer Gating & `canEdit` in `+page.svelte`

In `apps/web/src/routes/+page.svelte`:
- **Line 56**:

  ```ts
  let canEdit = $state(false);
  ```
- **Lines 758–765**:

  ```ts
  const coarse = window.matchMedia("(any-pointer: coarse)");
  const fine = window.matchMedia("(any-pointer: fine)");
  const syncPointer = (): void => {
    canEdit = fine.matches || !coarse.matches;
  };
  syncPointer();
  coarse.addEventListener("change", syncPointer);
  fine.addEventListener("change", syncPointer);
  ```
- **Lines 190, 295**:

  ```ts
  if (canEdit) startSession(r, opened.volume, opened.dataVersion, baseEdits);
  ...
  if (!canEdit) return; // in checkForSaved()
  ```
- **Lines 877–881**:

  ```svelte
  {:else if info && kind === "webgl"}
    <p class="hint" data-testid="edit-note">Editing needs a mouse and keyboard; on this device the page is a viewer.</p>
  {:else if info && kind === "cpu"}
    <p class="hint" data-testid="edit-note">Editing needs WebGL2; the software renderer is a viewer.</p>
  {/if}
  ```
On a touch-only device (e.g. `any-pointer: coarse` matches and `any-pointer: fine` does not), `canEdit` evaluates to `false`. As a consequence, `startSession()` is never called when opening a schematic, `session` remains `null`, the editor UI is completely locked out, and the page renders `<p class="hint" data-testid="edit-note">Editing needs a mouse and keyboard; on this device the page is a viewer.</p>`.

### 1.2 Current Desktop Stage Layout in `+page.svelte`

- **Lines 846–856**:

  ```svelte
  <div class="stage" class:editable={session !== null}>
    {#if session}
      <div class="tools" data-testid="editor-side" role="region" aria-label="Editing panels">
        <BlockPalette {session} />
        <BlockStatePanel {session} />
        <SelectionPanel {session} />
      </div>
    {/if}
    <div class="center">
      {#if session}<EditToolbar {session} />{/if}
      <canvas ...></canvas>
      ...
    </div>
    {#if info}
      <aside aria-label="View, export and block counts">
        ...
      </aside>
    {/if}
  </div>
  ```
- **Lines 992–1014**:

  ```css
  .stage { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 1.2rem; align-items: start; }
  canvas { width: 100%; max-height: 80vh; object-fit: contain; background: #f4f1eb; border: 1px dashed #c9c3b6; border-radius: 8px; min-height: 240px; touch-action: none; }
  .stage.editable { grid-template-columns: 280px minmax(0, 1fr) 280px; }
  .center { min-width: 0; }
  .tools { background: #fffdf8; border: 1px solid #e2dccf; border-radius: 8px; padding: 0.9rem 1rem 1rem; max-height: 86vh; overflow: auto; }
  canvas.gl { height: min(72vh, 760px); max-height: none; }
  @media (max-width: 1000px) { .stage, .stage.editable { grid-template-columns: 1fr; } }
  ```
When viewport width is below 1000px, `.stage` drops to 1 column. If editing was enabled, the canvas is capped at `max-height: 80vh` and the panels stack beneath the canvas, forcing the user to scroll away from the 3D scene to change blocks or adjust settings.

### 1.3 Viewport Meta Tag & Global HTML

In `apps/web/src/app.html`:
- **Line 6**:

  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ```
Missing `viewport-fit=cover` and `interactive-widget=resizes-content`.
Global body styling uses `min-height: 100vh;` and lacks `overscroll-behavior: none` and safe-area inset adaptation.

### 1.4 Test Suite Assertions on Coarse Pointer

In `apps/web/test/m4-suite.ts`:
- **Lines 1082, 1098–1099**:

  ```ts
  toolbar: document.querySelector('[data-testid="toolbar"]') !== null,
  ...
  if (m.coarse && !m.fine)
    ok(!m.toolbar, t("a touch-only device gets the viewer without the editor"));
  ```
In `apps/web/test/touch-e2e.ts`:
- **Lines 269, 275**:

  ```ts
  toolbar: document.querySelector('[data-testid="toolbar"]') !== null,
  ...
  ok(!layout.toolbar, t("toolbar is hidden for touch-only coarse device in MB1 viewer"));
  ```

---

## 2. Logic Chain

1. **Gate Removal**:
   Per `docs/mobile-editor-plan.md` §1.2 and `PROJECT.md` `FEAT-MB3-01`, editing on touch-only devices is supported provided WebGL2 is available. The software renderer (`kind === "cpu"`) remains a viewer.
   Therefore, `canEdit` should be true whenever WebGL2 is active (`kind === "webgl"` and GPU initialized).
   The lockout message `"Editing needs a mouse and keyboard; on this device the page is a viewer."` must be removed completely. The message `"Editing needs WebGL2; the software renderer is a viewer."` is preserved.

2. **Single Canvas Preservation**:
   The `<canvas>` element must remain a single, persistent DOM node across layout changes. Destroying and recreating the canvas when switching between desktop and mobile modes would discard the WebGL context, meshed chunk geometry, Three.js scene graph, and texture atlases. The canvas should be mounted once and restyled via CSS container classes.

3. **Layout Mode Arbiter & Breakpoint**:
   Per Plan Decision 7: Layout selection is based on `min-width: 1000px` AND `pointer: fine`, with a manual override option ("auto", "desktop", "mobile") stored in `localStorage["voxwright.layout"]`.
   - Media query listener: `window.matchMedia("(min-width: 1000px) and (pointer: fine)")`.
   - If override is `"desktop"` -> render desktop 3-column layout.
   - If override is `"mobile"` -> render mobile full-viewport shell.
   - If override is `"auto"` (default) -> use media query result.

4. **Mobile Layout Shell Structure**:
   On mobile mode:
   - Full-viewport container: `height: 100dvh; width: 100vw; overflow: hidden; position: fixed; inset: 0; overscroll-behavior: none;`.
   - **Top App Bar**:
     - Sticky top: `height: 48px`, `padding-top: env(safe-area-inset-top, 0px)`.
     - Displays title ("voxwright"), status/file chip, and a Menu button (>= 48px touch target).
   - **Full-Viewport Canvas**:
     - Fills the screen behind the floating UI: `touch-action: none; position: absolute; inset: 0; width: 100%; height: 100%;`.
   - **Thumb Cluster**:
     - Positioned at corner above the bottom toolbar: `bottom: calc(64px + env(safe-area-inset-bottom, 0px))`.
     - Default right-hand side (`right: calc(12px + env(safe-area-inset-right, 0px))`), with left-hand toggle support (`left: calc(12px + env(safe-area-inset-left, 0px))`).
     - Contains Undo, Redo, Confirm (✓), and Cancel (✕) buttons with touch targets >= 48px.
   - **Bottom Toolbar**:
     - Positioned along bottom edge: `bottom: 0; height: 56px + env(safe-area-inset-bottom, 0px)`.
     - Single row, horizontally scrollable thumb zone.
     - Houses tool selection buttons (View, Place, Replace, Erase, Pick, Line, Rect, Select) with >= 48px touch targets.
     - Contains active block swatch button: tapping toggles the Palette BottomSheet.
   - **Draggable Bottom Sheet**:
     - Hosts active panel (`activeSheet: "palette" | "blockstate" | "selection" | "menu" | "none"`).
     - Snap points: `peek` (~140px–180px), `half` (~50vh), `full` (~88vh), `closed` (translateY 100%).
     - Drag handle with 60fps pointer tracking (`setPointerCapture`) and velocity fling calculation.
     - Backdrop dismiss at half/full.
     - Virtual keyboard adaptation via `window.visualViewport`.

5. **Dry Panel Hosting**:
   The existing Svelte panel components (`BlockPalette.svelte`, `BlockStatePanel.svelte`, `SelectionPanel.svelte`) take `{ session }` props. In desktop mode, they render inside `<div class="tools">`. In mobile mode, they render inside `<BottomSheet>`. No panel code is duplicated.

---

## 3. Component Architectural Specifications

### 3.1 `BottomSheet.svelte` (`apps/web/src/lib/components/BottomSheet.svelte`)

#### Props & Types

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";

  export type SnapPoint = "closed" | "peek" | "half" | "full";

  let {
    snap = $bindable<SnapPoint>("closed"),
    title = "",
    onsnapchange,
    onclose,
    children,
  }: {
    snap?: SnapPoint;
    title?: string;
    onsnapchange?: (snap: SnapPoint) => void;
    onclose?: () => void;
    children?: Snippet;
  } = $props();
</script>
```

#### Gesture & Drag State Machine

- **Constants**:
  - `SNAP_HEIGHTS = { peek: 160, halfFraction: 0.52, fullFraction: 0.88 }`
  - Fling threshold: `0.5 px/ms`.
- **Drag Handling**:
  - Drag handle area: minimum 44px height for reliable touch contact, handle bar pill: `36px × 4px`, background `#c9c3b6`, border-radius 2px.
  - On `pointerdown`:
    - `setPointerCapture(e.pointerId)`.
    - Record `startY = e.clientY`, `startTime = performance.now()`.
    - Disable CSS animation transition during drag: `isDragging = true`.
  - On `pointermove`:
    - If `!isDragging`, return.
    - `const delta = e.clientY - startY`.
    - Clamp translation between `0` (full) and sheet height (closed).
  - On `pointerup` / `pointercancel`:
    - `isDragging = false`.
    - Calculate fling velocity: `const v = (e.clientY - startY) / (performance.now() - startTime)`.
    - If `v > 0.5` -> step snap down (`full -> half -> peek -> closed`).
    - If `v < -0.5` -> step snap up (`closed -> peek -> half -> full`).
    - Otherwise -> calculate nearest snap point by vertical distance.
    - Update `snap` and fire `onsnapchange?.(snap)`. If `snap === "closed"`, fire `onclose?.()`.

#### Backdrop Behavior

- Backdrop element: `<div class="backdrop" class:visible={snap === "half" || snap === "full"} onclick={handleBackdropClick}></div>`.
- When `snap === "peek"`, backdrop is transparent and non-blocking (`pointer-events: none; opacity: 0;`), allowing touch interaction with the 3D canvas above the sheet.
- When `snap === "half"` or `snap === "full"`, backdrop has `background: rgba(0, 0, 0, 0.45); pointer-events: auto;` and tapping it snaps down to `peek` or `closed`.

#### Virtual Keyboard & `visualViewport` Resizing

- To prevent mobile soft keyboard (Android Gboard/Chrome) from obscuring inputs (such as the palette search input):

  ```ts
  let viewportHeight = $state(typeof window !== "undefined" ? window.innerHeight : 800);
  let keyboardOffset = $state(0);

  function syncViewport(): void {
    if (!window.visualViewport) return;
    const vv = window.visualViewport;
    viewportHeight = vv.height;
    keyboardOffset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
  }

  onMount(() => {
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);
    return () => {
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
    };
  });
  ```
- The sheet's bottom coordinate is adjusted by `keyboardOffset`:
  `style="bottom: {keyboardOffset}px; max-height: calc({viewportHeight}px - env(safe-area-inset-top, 0px) - 52px);"`
  This ensures that when the keyboard opens, the bottom sheet shifts upward dynamically, keeping search input and matches in full view.

#### Accessibility

- Container has `role="dialog"`, `aria-label={title}`, and `aria-modal={snap === "full"}`.
- Close button has `aria-label="Close sheet"`, minimum 44px touch target.
- Escape key listener snaps sheet to `"closed"`.
- Content area has `overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;`.

---

### 3.2 `BottomToolbar.svelte` (`apps/web/src/lib/components/BottomToolbar.svelte`)

#### Props & Types

```svelte
<script lang="ts">
  import { TOOLS, toolTitle, type ToolId } from "../editing.ts";
  import type { EditSession } from "../editor-session.svelte.ts";

  export type SheetType = "none" | "palette" | "blockstate" | "selection" | "menu";

  let {
    session,
    activeSheet = "none",
    ontogglesheet,
  }: {
    session: EditSession;
    activeSheet?: SheetType;
    ontogglesheet: (sheet: SheetType) => void;
  } = $props();
</script>
```

#### Items & Touch Target Requirements

- Container:
  - `role="toolbar"`, `aria-label="Mobile editing toolbar"`, `data-testid="bottom-toolbar"`.
  - Single row, horizontal scrolling: `display: flex; gap: 8px; align-items: center; padding: 6px 10px calc(6px + env(safe-area-inset-bottom, 0px)); overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; touch-action: pan-x;`.
- **Tool buttons**:
  - Place, Replace, Erase, Pick, Line, Rect, Select. (View mode is `session.tool = "navigate"`).
  - Each button target: `min-width: 48px; min-height: 48px; border-radius: 8px; font-size: 0.82rem; font-weight: 500;`.
  - Test IDs: `data-testid={`mobile-tool-${t.id}`}` (e.g. `mobile-tool-place`, `mobile-tool-paint`, etc.).
  - Active tool state: `background: #f4f1eb; color: #2b2925;` when selected; inactive: `background: #3d3a34; color: #f4f1eb;`.
- **Block Swatch & Name**:
  - Displays currently selected block name without prefix (`session.block.replace("minecraft:", "")`).
  - Swatch chip button: `min-height: 48px; padding: 0 12px;` with border indicator.
  - Test ID: `data-testid="mobile-palette-toggle"`.
  - Tapping toggles `ontogglesheet("palette")`.
- **Block State & Selection Quick Toggles**:
  - State toggle: `data-testid="mobile-state-toggle"` (toggles `ontogglesheet("blockstate")`).
  - Selection toggle: `data-testid="mobile-selection-toggle"` (toggles `ontogglesheet("selection")`).

---

### 3.3 `ThumbCluster.svelte` (`apps/web/src/lib/components/ThumbCluster.svelte`)

#### Props & Types

```svelte
<script lang="ts">
  import type { EditSession } from "../editor-session.svelte.ts";

  let {
    session,
    leftHanded = false,
    onconfirm,
    oncancel,
  }: {
    session: EditSession;
    leftHanded?: boolean;
    onconfirm?: () => void;
    oncancel?: () => void;
  } = $props();
</script>
```

#### Layout & Actions

- Floating position:
  - Vertical stack above bottom toolbar:
    `position: fixed; z-index: 25; bottom: calc(64px + env(safe-area-inset-bottom, 0px));`
  - When `!leftHanded`: `right: calc(12px + env(safe-area-inset-right, 0px)); left: auto;`
  - When `leftHanded`: `left: calc(12px + env(safe-area-inset-left, 0px)); right: auto;`
- Action Buttons:
  - **Undo**:
    - `data-testid="mobile-undo"` (and responds to Undo).
    - `disabled={!session.canUndo}`.
    - Button size: `48px × 48px`, border-radius 50%, elevated drop-shadow (`box-shadow: 0 3px 8px rgba(0,0,0,0.3)`).
    - Icon / Label: `↺` (with `aria-label="Undo"`).
  - **Redo**:
    - `data-testid="mobile-redo"`.
    - `disabled={!session.canRedo}`.
    - Button size: `48px × 48px`, border-radius 50%.
    - Icon / Label: `↻` (with `aria-label="Redo"`).
  - **Confirm (✓)** and **Cancel (✕)**:
    - Included in markup, displayed when modal action/armed cell is pending (`session.confirmMode` or pending action):
    - `data-testid="mobile-confirm"` and `data-testid="mobile-cancel"`.
    - Target sizes: 48px × 48px.

---

### 3.4 Top App Bar & Menu Sheet Content

#### Top App Bar:

- Fixed at top in mobile mode:
  `position: fixed; top: 0; left: 0; right: 0; height: 50px; z-index: 20; padding-top: env(safe-area-inset-top, 0px); display: flex; align-items: center; justify-content: space-between; padding-left: 12px; padding-right: 12px; background: #2b2925; color: #f4f1eb;`
- Elements:
  - Brand: `<h1>voxwright</h1>` (compact `font-size: 1.1rem; margin: 0;`).
  - Active file / status chip: `<span class="file-chip">{info ? info.name : status}</span>`.
  - Menu trigger button: `<button class="menu-btn" data-testid="mobile-menu-btn" onclick={() => toggleSheet("menu")} aria-label="Open menu">Menu ☰</button>` (target size >= 48px).

#### Menu Sheet Content:

Rendered inside `<BottomSheet snap={...} title="Menu">`:
1. **File Operations**:
   - "Open a schematic" button triggering file input (`accept=".nbt,.schem,.litematic,.mcstructure,application/octet-stream"`).
   - "Export and download" button with format selector dropdown.
   - Loss report summary.
   - Autosave status readout.
2. **Texture Pack**:
   - Embedded `<PackPanel>` or pack management controls.
3. **View & Camera Controls**:
   - Camera mode selector (Orbit / Fly; hidden on coarse pointer per Decision 2 unless user switches to desktop layout).
   - Azimuth & elevation sliders.
   - Zoom in & Zoom out buttons.
   - Layer slice range sliders (yMin, yMax).
4. **Layout & Accessibility Settings**:
   - Layout mode picker: segmented control `[ Auto | Mobile | Desktop ]` with `data-testid="layout-override"`.
   - Left-handed thumb cluster toggle checkbox (`bind:checked={leftHanded}`).

---

### 3.5 Layout State Management & Storage

In `+page.svelte`:
```ts
type LayoutMode = "desktop" | "mobile";
type LayoutPreference = "auto" | "desktop" | "mobile";

let layoutPreference = $state<LayoutPreference>("auto");
let mqMatchesDesktop = $state(false);
let leftHanded = $state(false);

const isMobileLayout = $derived(
  layoutPreference === "mobile" || (layoutPreference === "auto" && !mqMatchesDesktop),
);

function initLayout(): void {
  try {
    const saved = localStorage.getItem("voxwright.layout") as LayoutPreference | null;
    if (saved === "auto" || saved === "desktop" || saved === "mobile") {
      layoutPreference = saved;
    }
    const lh = localStorage.getItem("voxwright.lefthanded");
    if (lh !== null) leftHanded = lh === "true";
  } catch {
    // localStorage unavailable fallback
  }

  const mq = window.matchMedia("(min-width: 1000px) and (pointer: fine)");
  mqMatchesDesktop = mq.matches;
  mq.addEventListener("change", (e) => {
    mqMatchesDesktop = e.matches;
  });
}

function setLayoutPreference(pref: LayoutPreference): void {
  layoutPreference = pref;
  try {
    localStorage.setItem("voxwright.layout", pref);
  } catch {}
}

function setLeftHanded(lh: boolean): void {
  leftHanded = lh;
  try {
    localStorage.setItem("voxwright.lefthanded", String(lh));
  } catch {}
}
```

---

## 4. CSS Modifications & Mobile Hygiene

### 4.1 `apps/web/src/app.html`

Update line 6:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
```

### 4.2 Global & Page CSS in `+page.svelte`

- **Body & Shell**:

  ```css
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    min-height: 100dvh;
    overflow: hidden;
    overscroll-behavior: none;
    -webkit-user-select: none;
    user-select: none;
  }
  ```
- **Mobile Mode Stage**:
  When `isMobileLayout` is true:

  ```css
  .mobile-shell {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100dvh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #1e1d1a;
  }
  .mobile-canvas-host {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    touch-action: none;
    overflow: hidden;
  }
  .mobile-canvas-host canvas {
    width: 100% !important;
    height: 100% !important;
    max-height: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    touch-action: none;
    cursor: default;
  }
  ```
- **Desktop Mode Stage**:
  When `!isMobileLayout`:
  Retains the exact existing CSS:

  ```css
  main { max-width: 1500px; margin: 0 auto; padding: 1.2rem; }
  .stage { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 1.2rem; align-items: start; }
  .stage.editable { grid-template-columns: 280px minmax(0, 1fr) 280px; }
  canvas.gl { height: min(72vh, 760px); max-height: none; }
  ```
- **Touch Target Sizing**:
  All interactive buttons, chips, handles in mobile mode have `min-height: 48px; min-width: 48px;` adhering to WCAG 2.5.5 and mobile ergonomics.

---

## 5. File Modification Map & Step-by-Step Implementation Plan

### 5.1 File Map

| Action     | File                                               | Description                                                                                                                                                                                    |
| ---------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Modify** | `apps/web/src/app.html`                            | Add `viewport-fit=cover, interactive-widget=resizes-content` to viewport meta tag.                                                                                                             |
| **Create** | `apps/web/src/lib/components/BottomSheet.svelte`   | Draggable bottom sheet with peek/half/full snap points, backdrop, drag handle, and `visualViewport` listener.                                                                                  |
| **Create** | `apps/web/src/lib/components/BottomToolbar.svelte` | Ergonomic single-row thumb-zone bottom toolbar with >=48px touch targets for tools and block swatch.                                                                                           |
| **Create** | `apps/web/src/lib/components/ThumbCluster.svelte`  | Corner floating action buttons (Undo, Redo, Confirm, Cancel) with left-handed toggle support.                                                                                                  |
| **Modify** | `apps/web/src/routes/+page.svelte`                 | Remove coarse gate check, add layout arbiter (`(min-width: 1000px) and (pointer: fine)`), integrate mobile shell, top app bar, bottom sheets hosting existing panels without code duplication. |
| **Modify** | `apps/web/test/m4-suite.ts`                        | Update phone coarse assertion at line 1098 to reflect mobile editor availability.                                                                                                              |
| **Modify** | `apps/web/test/touch-e2e.ts`                       | Add MB3 mobile layout shell test assertions (bottom toolbar, >=44px target sizes, sheet opening, block selection).                                                                             |

---

### 5.2 Step-by-Step Implementation Plan for Worker

#### Step 1: Update `app.html` Viewport Meta Tag

- Edit `apps/web/src/app.html`:
  Change `<meta name="viewport" content="width=device-width, initial-scale=1" />` to:
  `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />`.

#### Step 2: Implement `BottomSheet.svelte`

- Create `apps/web/src/lib/components/BottomSheet.svelte`:
  - Implement snap point logic (`closed`, `peek`, `half`, `full`).
  - Implement drag handle pointer events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) with `setPointerCapture`.
  - Calculate velocity fling to snap smoothly.
  - Implement backdrop that dismisses on tap.
  - Implement `window.visualViewport` listener for virtual keyboard resize offset.
  - Implement accessibility (`role="dialog"`, close button, Escape key dismiss).

#### Step 3: Implement `BottomToolbar.svelte`

- Create `apps/web/src/lib/components/BottomToolbar.svelte`:
  - Render horizontally scrolling flex row with tool buttons (View, Place, Replace, Erase, Pick, Line, Rect, Select).
  - Ensure all tool buttons have minimum dimensions `48px × 48px`.
  - Render active block swatch chip button with `data-testid="mobile-palette-toggle"` that toggles the Palette sheet.
  - Render state and selection toggles (`data-testid="mobile-state-toggle"`, `data-testid="mobile-selection-toggle"`).

#### Step 4: Implement `ThumbCluster.svelte`

- Create `apps/web/src/lib/components/ThumbCluster.svelte`:
  - Floating corner buttons for Undo (`mobile-undo`) and Redo (`mobile-redo`).
  - Minimum dimensions `48px × 48px`.
  - Support `leftHanded` prop to toggle between right corner and left corner.
  - Include Confirm (✓) and Cancel (✕) buttons for precision mode.

#### Step 5: Refactor `+page.svelte`

- Remove coarse pointer gating from `canEdit`:
  - Replace `canEdit = fine.matches || !coarse.matches;` with `canEdit = kind === "webgl";`.
  - Remove lockout `<p class="hint" data-testid="edit-note">Editing needs a mouse and keyboard...</p>`.
- Add layout state management:
  - Add `layoutPreference` ("auto" | "desktop" | "mobile") and `mqMatchesDesktop`.
  - Compute `isMobileLayout`.
  - Add active bottom sheet state (`activeSheet = "none" | "palette" | "blockstate" | "selection" | "menu"`).
- Render Structure:
  - Keep a single `<canvas bind:this={canvas}>` element.
  - When `isMobileLayout` is true:
    - Render top app bar with status and Menu button.
    - Render `<canvas>` in full-viewport container.
    - If `session` is active, render `<ThumbCluster {session} {leftHanded} />` and `<BottomToolbar {session} {activeSheet} ontogglesheet={...} />`.
    - Render `<BottomSheet>` containing the active panel (`BlockPalette`, `BlockStatePanel`, `SelectionPanel`, or Menu content).
  - When `isMobileLayout` is false:
    - Render existing desktop header, open section, `<PackPanel>`, `<div class="stage editable">`, `<aside>`, `<SiteFooter>`.
- Preserve all existing desktop testids and DOM hierarchy for desktop test suites.

#### Step 6: Update Test Suites

- In `apps/web/test/m4-suite.ts`:
  - Update line 1098 from asserting toolbar is absent to asserting that mobile editing / bottom toolbar is available on touch with WebGL2:

    ```ts
    const hasEditor = m.toolbar || (await page.$('[data-testid="bottom-toolbar"]')) !== null;
    ok(hasEditor, t("a touch-only device with WebGL2 gets the mobile editor"));
    ```

- In `apps/web/test/touch-e2e.ts`:
  - Add MB3 verification block asserting:
    - `[data-testid="bottom-toolbar"]` is mounted when schematic is loaded.
    - All touch targets in `bottom-toolbar` and `thumb-cluster` have bounding box width and height >= 44px.
    - Tapping `[data-testid="mobile-palette-toggle"]` opens the Palette BottomSheet.
    - Typing in `[data-testid="palette-search"]` filters blocks and selecting a block updates `session.block`.
    - No page horizontal scroll (`scrollWidth - clientWidth <= 1`).

---

## 6. Caveats

1. **MB4 Touch Drawing Independence**:
   MB3 implements the layout shell, toolbars, bottom sheets, and panel hosting. The underlying touch drawing pipeline inside `EditSession` (offset reticle, brush strokes, long-press pick) is specified for MB4. In MB3, tools can be chosen, palette/state sheets opened, and camera gestures used, but drawing on canvas via touch remains gated until MB4.
2. **Fly Mode on Coarse Devices**:
   Per Plan Decision 2, Fly camera mode is hidden on touch devices because Fly requires keyboard + pointer lock. Orbit remains the touch camera controller.
3. **Vitest `app_template_missing` Notice**:
   When Vitest runs at monorepo root, SvelteKit emits an informational warning `app_template_missing: src/app.html does not exist` for root workspace context, but all 52 test files pass. This is normal and expected.

---

## 7. Conclusion

The architectural design for Milestone MB3 provides a clean, responsive mobile editing shell that unlocks touch editing while keeping the desktop editing experience 100% pixel- and test-identical. By retaining a single canvas instance, hoisting existing panel components into draggable bottom sheets with snap points and `visualViewport` keyboard handling, and implementing thumb-zone toolbars with >= 48px targets, all requirements of `mobile-editor-plan.md` §2.1 & §4.3 are satisfied.

---

## 8. Verification Method

To independently verify the implementation:
1. **Unit and Component Tests**:

   ```bash
   pnpm test
   ```

   All 52 test files (including gesture suites, contrast, snapshot, and codecs) must pass.
2. **Mobile Touch E2E Test Suite**:

   ```bash
   pnpm test:touch
   ```

   Verifies headless Chromium touch emulation (390 × 844 at DPR 3), confirming bottom toolbar presence, touch target sizes (>= 44px), bottom sheet drag/snap, palette search, and zero horizontal scroll.
3. **Desktop Regression E2E Suite**:

   ```bash
   node apps/web/test/e2e.ts
   ```

   Confirms desktop 3-column layout, mouse-and-keyboard editing, tool operations, aside controls, and export download pass without regression at 1200 × 900.
4. **Contrast Suite**:

   ```bash
   pnpm --filter @voxwright/web test apps/web/test/contrast.test.ts
   ```

   Confirms all text/background colour pairs across the new mobile toolbars, bottom sheets, and controls meet WCAG AA contrast (>= 4.5:1).
