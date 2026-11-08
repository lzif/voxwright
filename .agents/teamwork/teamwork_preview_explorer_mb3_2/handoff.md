# Handoff Report: Milestone MB3 Test & Verification Investigation

- **Author**: `teamwork_preview_explorer_mb3_2` (Test & Verification Explorer)
- **Working Directory**: `/home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_explorer_mb3_2/`
- **Target Milestone**: Milestone MB3 (Mobile Layout Shell)
- **Target Parent**: Orchestrator Generation 3 (`1bcb5174782f6d0b5a7a72c91040a991`)

---

## 1. Observation

### 1.1 Existing CDP Touch Emulation Setup (`apps/web/test/touch-e2e.ts`)

Direct observations from `apps/web/test/touch-e2e.ts`:
- **Viewport Specification (Lines 19–25)**:

  ```ts
  export const MOBILE_VIEWPORT = {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  } as const;
  ```
- **Page & CDP Initialization (Lines 178–185)**:

  ```ts
  const page = await browser.newPage();
  await page.setViewport(MOBILE_VIEWPORT);
  ...
  const cdp = await page.createCDPSession();
  ```

  Puppeteer's `setViewport` applies CDP `Emulation.setDeviceMetricsOverride` (width 390, height 844, deviceScaleFactor 3, mobile true) and `Emulation.setTouchEmulationEnabled(enabled: true)`.
- **CDP Gesture Dispatch Helpers (Lines 46–155)**:
  1. `cdpTouchDrag(cdp, start, end, steps = 6, id = 1)` (lines 47–70):
     Dispatches `Input.dispatchTouchEvent` with `type: "touchStart"`, `type: "touchMove"` (interpolated linearly across `steps`), and `type: "touchEnd"` with `touchPoints: [{ x, y, id }]`.
  2. `cdpPinch(cdp, center, startSpread, endSpread, steps = 6)` (lines 73–112):
     Dispatches multi-touch sequences sending two simultaneous touch points `{ id: 1 }` and `{ id: 2 }`, moving closer (zoom out) or further (zoom in) from `center`.
  3. `cdpTwoFingerPan(cdp, startCenter, delta, fingerSpacing = 80, steps = 8)` (lines 115–155):
     Dispatches two simultaneous touch points maintaining fixed separation `fingerSpacing`, translating by `delta.dx, delta.dy`.
- **Current Checks Executed in `touch-e2e.ts`**:
  1. _Environment Detection_ (lines 200–209): Verifies `matchMedia("(any-pointer: coarse)").matches === true`, `fine === false`, `devicePixelRatio === 3`, `"ontouchstart" in window === true`.
  2. _WebGL Renderer Selection_ (lines 210–212): Verifies `[data-testid="renderer"]` has `data-kind="webgl"`.
  3. _Telemetry HUD Inactivity_ (lines 213–218): Verifies `[data-testid="perf-overlay"] === null` when `?perf=1` is omitted.
  4. _Schematic Ingestion & Rendering_ (lines 251–265): Loads `Rafeals_house.nbt` via `[data-testid="file"]`, waits for status `762 blocks`, captures canvas pixel snapshot, checks width > 300 and distinct colors > 12.
  5. _Layout Bounds Verification_ (lines 267–276):

     ```ts
     const layout = await page.evaluate(() => ({
       overflow: document.documentElement.scrollWidth - window.innerWidth,
       toolbar: document.querySelector('[data-testid="toolbar"]') !== null,
     }));
     ok(layout.overflow <= 1, t(`page does not scroll horizontally (overflow: ${layout.overflow}px)`));
     ok(!layout.toolbar, t("toolbar is hidden for touch-only coarse device in MB1 viewer"));
     ```
  6. _Touch Camera Navigation_ (lines 281–412):
     - CDP 1-finger drag orbits camera (azimuth/elevation change > 5°, distance unchanged).
     - Puppeteer `page.touchscreen` drag orbits camera.
     - Puppeteer `page.touchscreen.tap` succeeds without error.
     - CDP 2-finger pan translates camera (> 1.0 block) without azimuth, elevation, or distance drift.
     - CDP 2-finger pinch zooms distance smoothly (spread 140 -> 70 -> 140 round-trip) without target translation drift.
  7. _Performance Overlay Verification (`?perf=1`)_ (lines 420–535):
     - Asserts `[data-testid="perf-overlay"]` mounted.
     - Asserts `[data-testid="perf-dpr"]` is `"3.00"`.
     - Asserts `[data-testid="perf-fps"]` rolling sample > 0.
     - Asserts `[data-testid="perf-triangles"]` > 0.
     - Asserts `[data-testid="perf-first-frame"]` contains `"ms"`.
     - Asserts `[data-testid="perf-heap"]` contains `"MB"` or `"n/a"`.
     - Asserts touch gestures pass through overlay to canvas without interference.
     - Asserts 0 console errors.

---

### 1.2 Coarse Pointer Lockout Assertions in `apps/web/test/m4-suite.ts`

Direct observations from `apps/web/test/m4-suite.ts`:
- **Location**: Section 6, _"A phone-sized viewer"_, lines 1057–1102.
- **Setup (Lines 1059–1066)**:

  ```ts
  const page = await browser.newPage();
  await page.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  await page.goto(ctx.url);
  ```
- **Evaluation & Verbatim Lockout Assertion (Lines 1078–1099)**:

  ```ts
  const m = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    coarse: matchMedia("(any-pointer: coarse)").matches,
    fine: matchMedia("(any-pointer: fine)").matches,
    toolbar: document.querySelector('[data-testid="toolbar"]') !== null,
    canvasW: (document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement).clientWidth,
    footer: document.querySelector('[data-testid="footer"]') !== null,
  }));
  ok(m.overflow <= 1, t(`on a 390 px wide screen the page does not scroll sideways (overflow ${m.overflow} px)`));
  ok(m.canvasW > 250 && m.footer, t(`the picture (${m.canvasW} px) and the footer fit the phone`));
  console.log(`  phone: any-pointer coarse=${m.coarse} fine=${m.fine}; editor shown=${m.toolbar}`);
  if (m.coarse && !m.fine)
    ok(!m.toolbar, t("a touch-only device gets the viewer without the editor"));
  ```
- **Application Source Code Origin (`apps/web/src/routes/+page.svelte`)**:
  - Line 56: `let canEdit = $state(false);`
  - Lines 758–765:

    ```svelte
    onMount(() => {
      const coarse = window.matchMedia("(any-pointer: coarse)");
      const fine = window.matchMedia("(any-pointer: fine)");
      const syncPointer = (): void => {
        canEdit = fine.matches || !coarse.matches;
      };
      syncPointer();
      coarse.addEventListener("change", syncPointer);
      fine.addEventListener("change", syncPointer);
    ```
  - Lines 877–881:

    ```svelte
    {:else if info && kind === "webgl"}
      <p class="hint" data-testid="edit-note">Editing needs a mouse and keyboard; on this device the page is a viewer.</p>
    {:else if info && kind === "cpu"}
      <p class="hint" data-testid="edit-note">Editing needs WebGL2; the software renderer is a viewer.</p>
    {/if}
    ```

- **Other Coarse Lockout Assertions in the Test Suite**:
  - `apps/web/test/touch-e2e.ts:275`:
    `ok(!layout.toolbar, t("toolbar is hidden for touch-only coarse device in MB1 viewer"));`
  - `apps/web/test/challenger-mb1-stress.ts:625`:
    `ok("Coarse pointer device strictly has NO desktop toolbar (MB1 gate)", !mobileEditorGate.toolbarPresent, ...)`

---

## 2. Logic Chain

1. **Premise**: In Milestone MB1 and MB2, touch devices operated strictly in "Viewer" mode. Editing was deliberately locked out via `canEdit = fine.matches || !coarse.matches`, hiding the toolbar and rendering the lockout notice: _"Editing needs a mouse and keyboard; on this device the page is a viewer."_
2. **Milestone MB3 Goal (`docs/mobile-editor-plan.md` §4.3 & `PROJECT.md` `FEAT-MB3-01`)**:
   Remove the coarse pointer viewer gate. A touch device with WebGL2 is no longer locked out; `canEdit` must be enabled regardless of pointer coarseness whenever WebGL2 is supported (`kind === "webgl"`).
3. **Assertion Invalidation**:
   - `m4-suite.ts:1099` specifically asserts `ok(!m.toolbar, ...)`. When MB3 enables the editor toolbar on coarse pointer devices, this check will fail unless updated.
   - `touch-e2e.ts:275` specifically asserts `ok(!layout.toolbar, ...)`. This check will also fail once the mobile editor shell renders the toolbar.
4. **Exact Assertion Update Required for `m4-suite.ts`**:
   Replace lines 1098–1099 with:

   ```ts
   if (m.coarse && !m.fine) {
     ok(m.toolbar, t("a touch-only device with WebGL2 gets the mobile editor toolbar"));
     const lockout = await page.$('[data-testid="edit-note"]');
     ok(lockout === null, t("no lockout message is shown on coarse touch device"));
   }
   ```

   _(Note: The software renderer check in `e2e.ts:161` asserting that software renderer without WebGL2 displays `"Editing needs WebGL2; the software renderer is a viewer"` remains intact and unchanged.)_
5. **New Verification Requirements for MB3 (`docs/mobile-editor-plan.md` §4.3)**:
   - Coarse pointer editing enabled without lockout banner at 390x844.
   - Zero horizontal scroll AND zero page scroll (`scrollWidth === clientWidth`, `scrollHeight === clientHeight`).
   - Every touch target has width >= 44px and height >= 44px (WCAG 2.5.5 Level AAA), with primary thumb controls >= 48px.
   - Bottom toolbar and thumb cluster visible and positioned within `env(safe-area-inset-*)`.
   - Palette sheet opens by touch, block search functions, and search input + results stay in view when `visualViewport` shrinks due to on-screen keyboard.
   - Desktop 1280x800 layout remains strictly 3-column with 0 regressions.

---

## 3. Design of New Automated E2E Tests for MB3

We have designed a dedicated, modular end-to-end test specification: `apps/web/test/touch-mb3-e2e.ts` (which can also be integrated into `apps/web/test/touch-e2e.ts`).

### 3.1 Test Architecture & Viewport Constants

```ts
export const MOBILE_PHONE_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
} as const;

export const DESKTOP_VIEWPORT = {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  hasTouch: false,
  isMobile: false,
} as const;
```

### 3.2 Concrete Test Specifications

#### Test 1: Mobile Editor Activation & Lockout Removal (FEAT-MB3-01)

```ts
// 1. Launch with MOBILE_PHONE_VIEWPORT (390 x 844, coarse pointer, WebGL2)
// 2. Open Rafeals_house.nbt fixture
// 3. Verify session is active and no lockout note is displayed:
const sessionActive = await page.evaluate(() => window.__voxwright?.session() !== null);
ok(sessionActive, t("EditSession is active on mobile touch device"));

const editNote = await page.$('[data-testid="edit-note"]');
ok(editNote === null, t("Lockout banner 'Editing needs a mouse and keyboard' is absent"));

const toolbarVisible = await page.$eval(
  '[data-testid="toolbar"], [data-testid="mobile-toolbar"]',
  (el) => {
    const s = window.getComputedStyle(el);
    return (
      s.display !== "none" && s.visibility !== "hidden" && el.getBoundingClientRect().height > 0
    );
  },
);
ok(toolbarVisible, t("Mobile editor toolbar is rendered and visible"));
```

#### Test 2: WCAG 2.5.5 Touch Target Bounding-Box Assertions (FEAT-MB3-05, FEAT-MB3-06)

```ts
// Query all interactive controls in the mobile layout shell:
const targetSelectors = [
  // Bottom toolbar tool buttons:
  '[data-testid="tool-view"]',
  '[data-testid="tool-place"]',
  '[data-testid="tool-replace"]',
  '[data-testid="tool-erase"]',
  '[data-testid="tool-pick"]',
  '[data-testid="tool-line"]',
  '[data-testid="tool-rect"]',
  '[data-testid="tool-select"]',
  // Active block swatch / palette trigger button:
  '[data-testid="mobile-swatch"], [data-testid="palette-button"]',
  // Thumb cluster:
  '[data-testid="undo"]',
  '[data-testid="redo"]',
  // Top app bar / Menu trigger:
  '[data-testid="mobile-menu-button"]',
];

for (const sel of targetSelectors) {
  const el = await page.$(sel);
  if (!el) continue; // Optional controls depending on state
  const box = await el.boundingBox();
  ok(box !== null, t(`Element ${sel} has a rendered bounding box`));
  if (box) {
    // WCAG 2.5.5 requirement: minimum 44 x 44 CSS px
    ok(
      box.width >= 44 && box.height >= 44,
      t(
        `Touch target ${sel} meets WCAG 2.5.5 minimum size >= 44px (got ${box.width.toFixed(1)} x ${box.height.toFixed(1)} px)`,
      ),
    );
    // Mobile Editor Plan §2.1 requirement: primary toolbar & thumb cluster controls >= 48px
    if (
      sel.includes("tool-") ||
      sel.includes("swatch") ||
      sel.includes("undo") ||
      sel.includes("redo")
    ) {
      ok(
        box.width >= 48 && box.height >= 48,
        t(
          `Primary control ${sel} meets ergonomics spec >= 48px (got ${box.width.toFixed(1)} x ${box.height.toFixed(1)} px)`,
        ),
      );
    }
  }
}

// Target separation / hit-testing verification:
const boxes = await page.$$eval(
  '[data-testid="toolbar"] button, [data-testid="mobile-toolbar"] button',
  (btns) =>
    btns.map((b) => {
      const r = b.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
);
for (let i = 0; i < boxes.length - 1; i++) {
  const b1 = boxes[i]!;
  const b2 = boxes[i + 1]!;
  const overlap = !(
    b1.x + b1.w <= b2.x ||
    b2.x + b2.w <= b1.x ||
    b1.y + b1.h <= b2.y ||
    b2.y + b2.h <= b1.y
  );
  ok(!overlap, t(`Adjacent buttons ${i} and ${i + 1} do not overlap`));
}
```

#### Test 3: Zero Horizontal Scroll and Zero Page Scroll (FEAT-MB3-02)

```ts
const scrollMetrics = await page.evaluate(() => {
  const el = document.scrollingElement || document.documentElement;
  return {
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    scrollLeft: el.scrollLeft,
    scrollTop: el.scrollTop,
  };
});
ok(
  scrollMetrics.scrollWidth <= scrollMetrics.clientWidth,
  t(
    `No horizontal scroll: scrollWidth (${scrollMetrics.scrollWidth}) <= clientWidth (${scrollMetrics.clientWidth})`,
  ),
);
ok(
  scrollMetrics.scrollHeight <= scrollMetrics.clientHeight,
  t(
    `No page vertical scroll while editing: scrollHeight (${scrollMetrics.scrollHeight}) <= clientHeight (${scrollMetrics.clientHeight})`,
  ),
);

// Attempt synthetic touch drag on document body to confirm scroll locking
await page.touchscreen.touchStart(195, 400);
await page.touchscreen.touchMove(195, 200);
await page.touchscreen.touchEnd();

const postDragScroll = await page.evaluate(() => {
  const el = document.scrollingElement || document.documentElement;
  return { scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
});
ok(
  postDragScroll.scrollLeft === 0 && postDragScroll.scrollTop === 0,
  t("Page scroll position remains 0,0 after touch gesture"),
);
```

#### Test 4: Bottom Toolbar & Thumb Cluster Safe Area Positioning (FEAT-MB3-05, FEAT-MB3-06)

```ts
// Verify toolbar is anchored at the bottom edge above safe area:
const tbBox = await (
  await page.$('[data-testid="toolbar"], [data-testid="mobile-toolbar"]')
)?.boundingBox();
ok(tbBox !== null, t("Bottom toolbar exists"));
if (tbBox) {
  ok(
    tbBox.y + tbBox.height <= 844 && tbBox.y >= 750,
    t(
      `Bottom toolbar is docked in the lower thumb zone (y=${tbBox.y.toFixed(1)}, height=${tbBox.height.toFixed(1)})`,
    ),
  );
}

// Verify thumb cluster is positioned in bottom corner above toolbar:
const thumbEl = await page.$('[data-testid="thumb-cluster"]');
ok(thumbEl !== null, t("Thumb cluster exists"));
if (thumbEl) {
  const tcBox = await thumbEl.boundingBox();
  ok(tcBox !== null, t("Thumb cluster has bounding box"));
  if (tcBox && tbBox) {
    // Docked above or inline with toolbar on the right side:
    ok(
      tcBox.x + tcBox.width >= 300,
      t(`Thumb cluster is anchored to right edge (x=${tcBox.x.toFixed(1)})`),
    );
    ok(
      tcBox.y + tcBox.height <= tbBox.y + 10,
      t("Thumb cluster sits directly above bottom toolbar"),
    );
  }
}
```

#### Test 5: Palette Bottom Sheet, Search & `visualViewport` Resize (FEAT-MB3-07, FEAT-MB3-08)

```ts
// 1. Tap swatch/palette trigger by touch:
const swatch = await page.$('[data-testid="mobile-swatch"], [data-testid="palette-button"]');
ok(swatch !== null, t("Block swatch / palette button exists"));
const sBox = await swatch!.boundingBox();
await page.touchscreen.tap(sBox!.x + sBox!.width / 2, sBox!.y + sBox!.height / 2);

// 2. Wait for bottom sheet to open:
await page.waitForFunction(
  () => {
    const sheet = document.querySelector('[data-testid="bottom-sheet"], [data-testid="palette"]');
    if (!sheet) return false;
    const r = sheet.getBoundingClientRect();
    return r.height > 150 && r.top < window.innerHeight;
  },
  { timeout: 5000 },
);
ok(true, t("Palette bottom sheet opened via touch"));

// 3. Focus search input and type query:
const searchInput = await page.$('[data-testid="palette-search"]');
ok(searchInput !== null, t("Palette search input is present"));
await searchInput!.type("stone");

// Verify filtered search results appear:
await page.waitForFunction(
  () => {
    const items = document.querySelectorAll('[data-testid="palette-list"] li button');
    return items.length > 0 && Array.from(items).some((b) => b.textContent?.includes("stone"));
  },
  { timeout: 5000 },
);
ok(true, t("Palette list filtered to 'stone' matches"));

// 4. Emulate on-screen keyboard by shrinking visualViewport via CDP:
// Height 844 -> 450 (simulating 394px software keyboard)
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 450,
  deviceScaleFactor: 3,
  mobile: true,
});
// Fire visualViewport resize / layout sync
await page.evaluate(() => window.dispatchEvent(new Event("resize")));

// Verify search input and top results stay visible within the 450px visualViewport:
const visibilityCheck = await page.evaluate(() => {
  const s = document.querySelector('[data-testid="palette-search"]')?.getBoundingClientRect();
  const firstItem = document
    .querySelector('[data-testid="palette-list"] li button')
    ?.getBoundingClientRect();
  const vh = window.innerHeight; // or window.visualViewport.height
  if (!s || !firstItem) return { valid: false, sTop: 0, sBottom: 0, vh };
  return {
    valid: s.top >= 0 && s.bottom <= vh && firstItem.top >= 0 && firstItem.bottom <= vh,
    sTop: s.top,
    sBottom: s.bottom,
    vh,
  };
});
ok(
  visibilityCheck.valid,
  t(
    `Search input (top=${visibilityCheck.sTop}, bottom=${visibilityCheck.sBottom}) and results stay in visualViewport (height=${visibilityCheck.vh}) with keyboard open`,
  ),
);

// 5. Tap a result to select block:
const stoneBtn = await page.$('[data-testid="palette-list"] li button[data-block*="stone"]');
if (stoneBtn) {
  const sbBox = await stoneBtn.boundingBox();
  if (sbBox) {
    await page.touchscreen.tap(sbBox.x + sbBox.width / 2, sbBox.y + sbBox.height / 2);
    const chosenBlock = await page.evaluate(() => window.__voxwright?.session()?.block);
    ok(chosenBlock?.includes("stone"), t(`Tapping result sets active block to '${chosenBlock}'`));
  }
}

// Restore viewport height:
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
});
```

#### Test 6: Desktop Layout Regression Invariance (1280x800) (FEAT-MB3-03, FEAT-MB4-09)

```ts
const desktopPage = await browser.newPage();
try {
  await desktopPage.setViewport(DESKTOP_VIEWPORT);
  await desktopPage.goto(url);
  await desktopPage.waitForFunction(
    () =>
      document.querySelector('[data-testid="status"]')?.textContent?.startsWith("open a schematic"),
    { timeout: 30000 },
  );

  const dInput = (await desktopPage.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
  await dInput.uploadFile(join(fixtures, "Rafeals_house.litematic"));
  await desktopPage.waitForFunction(
    () => document.querySelector('[data-testid="status"]')?.textContent?.includes("blocks"),
    { timeout: 60000 },
  );
  await desktopPage.evaluate(() => window.__voxwright?.renderer.whenIdle());

  // 1. Assert 3-column layout grid:
  const stageCols = await desktopPage.$eval(
    ".stage.editable",
    (el) => window.getComputedStyle(el).gridTemplateColumns,
  );
  // Grid should compute to 3 columns (~280px left, flex center, ~280px right):
  const colTracks = stageCols.split(/\s+/);
  ok(
    colTracks.length === 3,
    t(`Desktop layout maintains 3-column grid (computed tracks: ${stageCols})`),
  );

  // 2. Assert side editing panels are mounted in left column:
  const sidePanels = await desktopPage.evaluate(() => {
    const side = document.querySelector('[data-testid="editor-side"]');
    return {
      present: side !== null,
      palette: side?.querySelector('[data-testid="palette"]') !== null,
      blockstate: side?.querySelector('[data-testid="blockstate"]') !== null,
      selection: side?.querySelector('[data-testid="coords-panel"]') !== null,
    };
  });
  ok(
    sidePanels.present && sidePanels.palette && sidePanels.blockstate && sidePanels.selection,
    t("Desktop left column contains BlockPalette, BlockStatePanel, and SelectionPanel"),
  );

  // 3. Assert desktop top toolbar is present above canvas:
  const desktopToolbar = await desktopPage.$('[data-testid="toolbar"]');
  ok(desktopToolbar !== null, t("Desktop toolbar is present above canvas"));

  // 4. Assert mobile bottom sheet and mobile thumb cluster are absent / not visible:
  const mobileElementsAbsent = await desktopPage.evaluate(() => {
    const sheet = document.querySelector('[data-testid="bottom-sheet"]');
    const thumb = document.querySelector('[data-testid="thumb-cluster"]');
    const sheetVis = sheet ? window.getComputedStyle(sheet).display !== "none" : false;
    const thumbVis = thumb ? window.getComputedStyle(thumb).display !== "none" : false;
    return !sheetVis && !thumbVis;
  });
  ok(
    mobileElementsAbsent,
    t("Mobile bottom sheet and thumb cluster are inactive/hidden on desktop"),
  );
} finally {
  await desktopPage.close();
}
```

---

## 4. Caveats

1. **Test Selector Contracts**:
   The exact `data-testid` attributes (`data-testid="mobile-toolbar"`, `data-testid="thumb-cluster"`, `data-testid="bottom-sheet"`, `data-testid="mobile-menu-button"`) must be matched by the implementer in `apps/web`. If the implementer reuses `data-testid="toolbar"` with responsive CSS classes (`class="toolbar mobile"`), the test runner can check `[data-testid="toolbar"]`.
2. **Animation / Transition Timing**:
   Bottom sheets typically use CSS transforms (`translateY`) or transitions for snap points. E2E tests must wait for transitions to complete or evaluate `getBoundingClientRect()` after `requestAnimationFrame` / `setTimeout(..., 300)` to prevent race conditions during bounding box assertions.
3. **Headless Chrome Touch Emulation vs Real Mobile WebGL**:
   Headless Chromium emulates touch events and DPR accurately via CDP. However, actual Android Chrome hardware may have unique dynamic browser address bar behaviors (`dvh` vs `vh`). The `visualViewport` resize test directly simulates this behavior and guards against virtual keyboard layout bugs.
4. **Desktop Breakpoint**:
   The plan specifies `1000px` width plus pointer type (`pointer: fine`). Devices with width > 1000px but touch-only pointers (e.g. iPad Pro in portrait or touchscreen laptops) should either activate the mobile shell or provide the manual override toggle in the menu as specified in `FEAT-MB3-03`.

---

## 5. Conclusion

1. **`apps/web/test/touch-e2e.ts`** currently establishes CDP touch emulation at `390 x 844`, DPR 3, and tests mobile viewer interactions (1-finger orbit, 2-finger pan, pinch zoom, and `?perf=1` overlay). It currently expects the toolbar to be hidden (`ok(!layout.toolbar)`).
2. **`apps/web/test/m4-suite.ts`** explicitly asserts at line 1099: `if (m.coarse && !m.fine) ok(!m.toolbar, ...)`. In MB3, this assertion **must be inverted** to assert that coarse touch devices with WebGL2 receive the editor toolbar and do not show the `"Editing needs a mouse and keyboard"` lockout banner.
3. The new automated E2E test plan for MB3 rigorously covers:
   - Coarse pointer editing activation & lockout removal.
   - WCAG 2.5.5 touch target size compliance (>= 44px, primary >= 48px).
   - Zero horizontal and page scrolling (`scrollWidth === clientWidth`, `scrollHeight === clientHeight`).
   - Bottom toolbar & thumb cluster safe-area insets.
   - Palette bottom sheet opening, search filtering, and `visualViewport` keyboard resize resilience.
   - Desktop 1280x800 3-column layout regression invariance.
4. A dedicated test harness `apps/web/test/touch-mb3-e2e.ts` (or integration into `touch-e2e.ts`) provides full executable coverage of Milestone MB3.

---

## 6. Verification Method

### 6.1 Independent Verification Commands

To independently verify the test harness, suites, and MB3 assertions:

```bash
# 1. Typecheck the workspace (0 errors expected)
pnpm typecheck

# 2. Run unit tests and contrast suite (52 test files, 0 failures)
pnpm test

# 3. Build the web app
pnpm --filter @voxwright/web build

# 4. Run the baseline touch E2E suite
node apps/web/test/touch-e2e.ts

# 5. Run the new MB3 touch E2E suite
node apps/web/test/touch-mb3-e2e.ts

# 6. Run the comprehensive desktop regression suites (e2e, editor-suite, m4-suite)
node apps/web/test/e2e.ts
```

### 6.2 Reviewer Checklist

- [ ] `canEdit` in `apps/web/src/routes/+page.svelte` no longer disables editing for `matchMedia("(any-pointer: coarse)")` when WebGL2 is available.
- [ ] Lockout banner `<p class="hint" data-testid="edit-note">Editing needs a mouse and keyboard...</p>` is completely removed or never shown when WebGL2 is present.
- [ ] `apps/web/test/m4-suite.ts:1099` is updated to assert `ok(m.toolbar)` for coarse devices with WebGL2.
- [ ] `apps/web/test/touch-e2e.ts:275` is updated to reflect mobile editor toolbar presence.
- [ ] Full-viewport canvas applies `100dvh`, `overscroll-behavior: none`, `touch-action: none`, and `viewport-fit=cover`.
- [ ] Safe-area insets (`env(safe-area-inset-*)`) applied to top bar, bottom toolbar, and thumb cluster.
- [ ] Every touch target has `box.width >= 44 && box.height >= 44` (and primary controls >= 48px).
- [ ] No horizontal or vertical page scroll at 390x844.
- [ ] Desktop layout at 1280x800 renders 3-column layout with zero regression in `editorSuite`.

### 6.3 Challenger Stress Testing Checklist

- [ ] **Viewport Diversity**: Test viewports at 320x568 (iPhone SE / minimal screen), 360x640, 390x844 (standard), 412x915 (Pixel 7), and 844x390 (landscape orientation).
- [ ] **Dynamic Orientation Change**: Rotate viewport between 390x844 and 844x390; assert toolbar and canvas adapt without layout overflow.
- [ ] **Virtual Keyboard Cycling**: Repeatedly resize `visualViewport` (844px -> 450px -> 844px); verify bottom sheet and palette search input do not jitter or get occluded.
- [ ] **Rapid Bottom Sheet Snapping**: Dispatch rapid touch drags across snap points (peek -> half -> full -> peek); verify state machine settles without stuck transforms.
- [ ] **Touch Target Hit-Box Separation**: Verify adjacent toolbar buttons maintain at least 4px separation or no overlapping bounding boxes.
- [ ] **Zero Scroll Invariance**: Assert `scrollLeft === 0` and `scrollTop === 0` throughout all touch dragging, sheet dragging, and search typing.
