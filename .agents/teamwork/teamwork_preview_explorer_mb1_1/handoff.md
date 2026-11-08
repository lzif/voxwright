# Handoff Report: FEAT-MB1-01 Mobile Touch E2E Test Suite Harness

## 1. Observation

### Codebase & Harness Analysis

- **`apps/web/test/e2e.ts`** (607 lines):
  - Primary desktop E2E runner. Serves the built site via `serveSite()` from `apps/web/test/site.ts`.
  - Discovers Chromium executable via `findChromium(values.chromium)` in `apps/web/test/site.ts:21-32`.
  - Launches headless Chromium with software WebGL2 via SwiftShader flags:
    `["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]` (`site.ts:62-70`).
  - Sets desktop viewport: `page.setViewport({ width: 1200, height: 900 })` (line 54).
  - Drives two browser suites: WebGL2 GPU path (`suite(true)`) and CPU fallback path (`suite(false)`).
  - Invokes `editorSuite` (`apps/web/test/editor-suite.ts`, 1224 lines) for mouse/keyboard editing workflows (M3).
  - Invokes `m4Suite` (`apps/web/test/m4-suite.ts`, 1147 lines) for autosave, user packs, a11y, and a basic phone layout assertion (lines 1058–1102).
  - Execution result on this machine: `node apps/web/test/e2e.ts` executed with exit code 0 and **`338 checks passed`**.
- **`apps/web/test/m4-suite.ts:1058-1102`**:
  - Tests phone viewport layout:

    ```typescript
    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    ```
  - Directly tests:

    ```typescript
    const m = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      coarse: matchMedia("(any-pointer: coarse)").matches,
      fine: matchMedia("(any-pointer: fine)").matches,
      toolbar: document.querySelector('[data-testid="toolbar"]') !== null,
      canvasW: (document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement).clientWidth,
      footer: document.querySelector('[data-testid="footer"]') !== null,
    }));
    ```
  - Asserts that for a touch-only device in M4:
    `if (m.coarse && !m.fine) ok(!m.toolbar, t("a touch-only device gets the viewer without the editor"));`
- **`apps/web/src/routes/+page.svelte:638-644`**:
  - Coarse pointer editing gate:

    ```typescript
    const coarse = window.matchMedia("(any-pointer: coarse)");
    const fine = window.matchMedia("(any-pointer: fine)");
    const syncPointer = (): void => {
      canEdit = fine.matches || !coarse.matches;
    };
    ```
  - Confirms that in Milestone MB1, the web application operates strictly as a **mobile viewer** when visited from a touch-only device (`canEdit = false` until Milestone MB3 removes this gate).
- **`packages/render/src/webgl/renderer.ts:806-873`**:
  - WebglRenderer attaches pointer listeners (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) directly to the canvas (`lines 806-868`).
  - Pointer tracking: `this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })`.
  - When 1 pointer drag is received (`d.button === 0 && !d.shift`), it rotates the orbit camera: `this.orbit.rotate(dx, dy)`.
  - When 2 pointers are tracked, it computes pinch spread `Math.hypot(a.x - b.x, a.y - b.y)` and calls `this.orbit.zoom(this.pinch / spread)`.
- **`apps/web/src/lib/editor-session.svelte.ts:290-295`**:
  - When touch events arrive, `EditSession.onPointerDown` returns early without stopping propagation:
    `if (e.pointerType === "touch" || e.button !== 0 || e.shiftKey || e.altKey) return;`
  - This allows touch events to reach `WebglRenderer` cleanly in viewer mode.

### Live Headless Chromium Touch Emulation Experiment

- Command executed:
  `node -e '...'` driving `puppeteer-core` with viewport:
  `{ width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true }`.
- Results observed directly:
  1. Environment detection:
     `matchMedia("(any-pointer: coarse)").matches === true`
     `matchMedia("(any-pointer: fine)").matches === false`
     `devicePixelRatio === 3`
     `"ontouchstart" in window === true`
  2. Opening fixture `/home/antigravity/lzif/voxwright/fixtures/real/rafeals-house/Rafeals_house.nbt`:
     Status resolved to: `Rafeals_house.nbt: 14 × 8 × 14, 762 blocks`
     Canvas bounding box: `{ x: 19.1875, y: 434.109375, height: 609.671875, width: 353.625 }`
     Initial camera pose:
     `{ position: [19.987, 16.861, -5.987], azimuth: 45, elevation: 35, mode: "orbit", distance: 22.422 }`
  3. Single-finger touch orbit via CDP `Input.dispatchTouchEvent`:
     - Dispatched `touchStart` at `(cx, cy)`
     - Dispatched `touchMove` at `(cx + 100, cy + 30)`
     - Dispatched `touchEnd` with `touchPoints: []`
     - Post-CDP pose: `azimuth: 85, elevation: 47` (camera rotated +40° azimuth, +12° elevation).
  4. Single-finger touch orbit via Puppeteer `page.touchscreen`:
     - `await page.touchscreen.touchStart(cx, cy)`
     - `await page.touchscreen.touchMove(cx + 80, cy - 20)`
     - `await page.touchscreen.touchEnd()`
     - Post-touchscreen pose: `azimuth: 117, elevation: 39`.
  5. Tap via Puppeteer:
     - `await page.touchscreen.tap(cx, cy)` succeeded with no errors.
  6. Two-finger pinch zoom via CDP `Input.dispatchTouchEvent`:
     - Dispatched 2 touches spread 80px apart (`cx - 40`, `cx + 40`) and moved to 40px apart (`cx - 20`, `cx + 20`).
     - Distance changed from `22.422` to `44.844` (camera smoothly zoomed out by factor 2.0).

---

## 2. Logic Chain

1. **Isolation of Existing Desktop Tests (Constraint 4)**:
   - `apps/web/test/e2e.ts` is the established regression suite passing 338 checks.
   - Any modification to `e2e.ts` risks breaking desktop CI or altering test timings.
   - Creating a dedicated harness `apps/web/test/touch-e2e.ts` (as specified in `PROJECT.md` line 29, 91 and `docs/mobile-editor-plan.md` §4.1) guarantees that `e2e.ts` remains 100% untouched and passing while providing a clean, purpose-built runner for mobile touch emulation.

2. **Viewport & Emulation Configuration**:
   - `PROJECT.md` and the user specification require:
     `{ width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true }`.
   - Applying this configuration to `page.setViewport()` activates Chromium's mobile emulation:
     - Enables touch event generation (`window.TouchEvent`, `ontouchstart`).
     - Configures CSS media queries so `any-pointer: coarse` evaluates to `true` and `any-pointer: fine` evaluates to `false`.
     - Scales device pixel ratio to `3.0`, accurately modeling high-density mobile screens (e.g. iPhone 12/13/14/15/16 Pro series, high-DPR Android devices).

3. **Touch Event Dispatch Mechanisms**:
   - Both CDP `Input.dispatchTouchEvent` and Puppeteer's high-level `page.touchscreen` API (`touchStart`, `touchMove`, `touchEnd`, `tap`) are fully operational in headless Chromium with SwiftShader.
   - CDP `Input.dispatchTouchEvent` provides low-level multi-touch control (essential for two-finger pinch zoom, pan, and multi-touch gestures).
   - `page.touchscreen.tap` provides standard DOM touch tap emulation.
   - Providing reusable helpers in `touch-e2e.ts` for both single-touch drag, multi-touch pinch, and tap allows tests to be written concisely and clearly across all mobile milestones (MB1 through MB8).

4. **Viewer Verification in Milestone MB1**:
   - In MB1, editing on touch is intentionally locked (`canEdit === false`).
   - The test must verify:
     a) File upload opens the `Rafeals_house.nbt` fixture and reports `762 blocks`.
     b) Layout fits within 390px viewport without horizontal page overflow.
     c) Toolbar is omitted (`data-testid="toolbar"` is null) and WebGL2 viewer status is preserved.
     d) Touch orbit via CDP and `page.touchscreen` rotates the camera pose and updates the canvas hash.
     e) Touch pinch zoom alters camera distance.
     f) Zero unhandled console errors occur.
     g) The `?perf=1` overlay telemetry parameter can be opened without errors (paving the way for FEAT-MB1-02).

---

## 3. Caveats

1. **SwiftShader Software Emulation**:
   - The dev environment runs headless Chromium using SwiftShader software WebGL2 (Vulkan CPU rasterizer). Performance numbers (FPS, frame time) reflect CPU software rendering, not real mobile GPU hardware. Real mobile GPU numbers belong in `docs/phone-test-checklist.md` and benchmark logs (FEAT-MB1-03, FEAT-MB1-04).
2. **Coarse Pointer Gate Lifecycle**:
   - Milestone MB1 preserves `!canEdit` on coarse pointers (`!m.toolbar`). In Milestone MB3 (`FEAT-MB3-01`), the coarse pointer gate will be removed and mobile layout components will be mounted. `touch-e2e.ts` is structured so the MB1 viewer assertions can be smoothly extended into MB3+ layout and MB4+ touch editing tests.

---

## 4. Conclusion & Actionable Worker Plan

The Worker should implement the standalone touch E2E test harness at `apps/web/test/touch-e2e.ts` and add `"test:touch": "node test/touch-e2e.ts"` to `apps/web/package.json`.

### Exact Worker Implementation Plan

#### File 1: Create `apps/web/test/touch-e2e.ts`

```typescript
// SPDX-License-Identifier: AGPL-3.0-only

// Touch-emulated end-to-end check in headless Chromium (FEAT-MB1-01):
// Serves the built site, emulates a mobile viewport (390 x 844, DPR 3, touch-enabled),
// opens the Rafeals_house fixture, and verifies touch orbit, pinch zoom, and tap gestures.
// Run after `pnpm --filter @voxwright/web build`:
//
//   node test/touch-e2e.ts [--shots <dir>] [--chromium <path>]

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parseArgs } from "node:util";
import puppeteer, { type CDPSession, type ElementHandle, type Page } from "puppeteer-core";
import { chromiumArgs, findChromium, serveSite } from "./site.ts";
import type { Pose, Vox } from "./vox.ts";

export const MOBILE_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
} as const;

const { values } = parseArgs({
  options: { shots: { type: "string" }, chromium: { type: "string" } },
});

const fixtures = fileURLToPath(new URL("../../../fixtures/real/rafeals-house/", import.meta.url));
const chromium = findChromium(values.chromium);
if (values.shots) mkdirSync(values.shots, { recursive: true });
const { url, server } = await serveSite();

const checks: string[] = [];
export const ok = (cond: unknown, what: string): void => {
  if (!cond) throw new Error(`FAILED: ${what}`);
  checks.push(what);
};

export interface TouchPoint {
  x: number;
  y: number;
  id?: number;
}

/** Helper: dispatch a multi-step touch drag gesture via CDP Input.dispatchTouchEvent */
export async function cdpTouchDrag(
  cdp: CDPSession,
  start: { x: number; y: number },
  end: { x: number; y: number },
  steps = 6,
  id = 1,
): Promise<void> {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: start.x, y: start.y, id }],
  });
  for (let i = 1; i <= steps; i++) {
    const x = Math.round(start.x + ((end.x - start.x) * i) / steps);
    const y = Math.round(start.y + ((end.y - start.y) * i) / steps);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y, id }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

/** Helper: dispatch a two-finger pinch gesture via CDP Input.dispatchTouchEvent */
export async function cdpPinch(
  cdp: CDPSession,
  center: { x: number; y: number },
  startSpread: number,
  endSpread: number,
  steps = 6,
): Promise<void> {
  const p1Start = { x: Math.round(center.x - startSpread / 2), y: center.y };
  const p2Start = { x: Math.round(center.x + startSpread / 2), y: center.y };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: p1Start.x, y: p1Start.y, id: 1 },
      { x: p2Start.x, y: p2Start.y, id: 2 },
    ],
  });
  for (let i = 1; i <= steps; i++) {
    const spread = startSpread + ((endSpread - startSpread) * i) / steps;
    const p1 = { x: Math.round(center.x - spread / 2), y: center.y };
    const p2 = { x: Math.round(center.x + spread / 2), y: center.y };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: p1.x, y: p1.y, id: 1 },
        { x: p2.x, y: p2.y, id: 2 },
      ],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

export async function touchViewerSuite(): Promise<void> {
  const t = (what: string): string => `[touch-viewer] ${what}`;
  const browser = await puppeteer.launch({
    executablePath: chromium,
    headless: true,
    args: chromiumArgs(true),
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(MOBILE_VIEWPORT);

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    const cdp = await page.createCDPSession();

    await page.goto(url);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 30000 },
    );

    // 1. Check touch environment & media queries
    const env = await page.evaluate(() => ({
      coarse: matchMedia("(any-pointer: coarse)").matches,
      fine: matchMedia("(any-pointer: fine)").matches,
      dpr: window.devicePixelRatio,
      hasTouch: "ontouchstart" in window,
    }));
    ok(env.coarse && !env.fine, t("browser reports coarse pointer and no fine pointer"));
    ok(env.dpr === 3, t("devicePixelRatio is 3"));
    ok(env.hasTouch, t("touch events supported on window"));

    const kind = await page.$eval('[data-testid="renderer"]', (e) => e.getAttribute("data-kind"));
    ok(kind === "webgl", t("the mobile viewer selects the WebGL renderer"));

    const settle = async (): Promise<void> => {
      await page.evaluate(() => window.__voxwright?.renderer.whenIdle());
    };
    const pose = (): Promise<Pose> =>
      page.evaluate(() => (window.__voxwright as Vox).renderer.getPose());

    const picture = (): Promise<{ w: number; h: number; distinct: number; hash: string }> =>
      page.evaluate(() => {
        const c = document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement;
        let w: number;
        let h: number;
        let d: Uint8ClampedArray;
        const shot = window.__voxwright?.renderer.capture();
        if (shot) {
          [w, h, d] = [shot.width, shot.height, shot.rgba];
        } else {
          [w, h] = [c.width, c.height];
          d = c.getContext("2d")?.getImageData(0, 0, w, h).data as Uint8ClampedArray;
        }
        const seen = new Set<number>();
        for (let i = 0; i < d.length; i += 4 * 17)
          seen.add((d[i] as number) * 65536 + (d[i + 1] as number) * 256 + (d[i + 2] as number));
        let hash = 0;
        for (let i = 0; i < d.length; i += 4)
          hash = (hash * 31 + (d[i] as number) + (d[i + 1] as number) * 3) | 0;
        return { w, h, distinct: seen.size, hash: String(hash) };
      });

    // 2. Open Rafeals_house fixture
    const input = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await input.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await page.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 60000 },
    );
    await settle();

    const pic0 = await picture();
    ok(
      pic0.w > 300 && pic0.distinct > 12,
      t(`the schematic opens and renders (${pic0.w}x${pic0.h}, ${pic0.distinct} colours)`),
    );

    // Verify mobile layout bounds (no horizontal scroll)
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      toolbar: document.querySelector('[data-testid="toolbar"]') !== null,
    }));
    ok(
      layout.overflow <= 1,
      t(`page does not scroll horizontally (overflow: ${layout.overflow}px)`),
    );
    ok(!layout.toolbar, t("toolbar is hidden for touch-only coarse device in MB1 viewer"));

    if (values.shots)
      await page.screenshot({ path: join(values.shots, "mobile-viewer-initial.png") });

    // 3. Touch Orbit via CDP Input.dispatchTouchEvent
    const canvasBox = (await (await page.$('[data-testid="canvas"]'))!.boundingBox())!;
    const cx = Math.round(canvasBox.x + canvasBox.width / 2);
    const cy = Math.round(canvasBox.y + canvasBox.height / 2);

    const pose0 = await pose();
    await cdpTouchDrag(cdp, { x: cx, y: cy }, { x: cx + 120, y: cy + 40 });
    await settle();
    const pose1 = await pose();
    const pic1 = await picture();
    ok(
      Math.abs(pose1.azimuth - pose0.azimuth) > 5 ||
        Math.abs(pose1.elevation - pose0.elevation) > 5,
      t(
        `CDP touch drag orbits camera (azimuth ${pose0.azimuth.toFixed(1)} -> ${pose1.azimuth.toFixed(1)}, elevation ${pose0.elevation.toFixed(1)} -> ${pose1.elevation.toFixed(1)})`,
      ),
    );
    ok(pic1.hash !== pic0.hash, t("CDP touch orbit updates rendered picture hash"));

    // 4. Touch Orbit via Puppeteer page.touchscreen
    await page.touchscreen.touchStart(cx, cy);
    await page.touchscreen.touchMove(cx - 80, cy - 30);
    await page.touchscreen.touchEnd();
    await settle();
    const pose2 = await pose();
    const pic2 = await picture();
    ok(
      Math.abs(pose2.azimuth - pose1.azimuth) > 5 ||
        Math.abs(pose2.elevation - pose1.elevation) > 5,
      t(
        `page.touchscreen drag turns the view (azimuth ${pose1.azimuth.toFixed(1)} -> ${pose2.azimuth.toFixed(1)})`,
      ),
    );
    ok(pic2.hash !== pic1.hash, t("touchscreen drag updates canvas picture"));

    // 5. Touch Tap via Puppeteer page.touchscreen.tap
    await page.touchscreen.tap(cx, cy);
    await settle();
    ok(true, t("page.touchscreen.tap succeeds without error"));

    // 6. Two-finger pinch zoom via CDP
    const distBefore = pose2.distance;
    await cdpPinch(cdp, { x: cx, y: cy }, 100, 50); // fingers move closer -> zooms out
    await settle();
    const pose3 = await pose();
    ok(
      pose3.distance > distBefore * 1.5,
      t(
        `two-finger pinch changes camera distance (${distBefore.toFixed(1)} -> ${pose3.distance.toFixed(1)})`,
      ),
    );

    if (values.shots)
      await page.screenshot({ path: join(values.shots, "mobile-viewer-orbited.png") });

    ok(
      errors.length === 0,
      t(
        `no console errors throughout mobile touch run${errors.length ? `: ${errors.join(" | ")}` : ""}`,
      ),
    );
  } finally {
    await browser.close();
  }
}

try {
  await touchViewerSuite();
} finally {
  server.close();
}

console.log(checks.map((c) => `  ok  ${c}`).join("\n"));
console.log(`${checks.length} checks passed`);
```

#### File 2: Update `apps/web/package.json`

Add script:
```json
"test:touch": "node test/touch-e2e.ts"
```

---

## 5. Verification Method

1. **Verify Touch E2E Test Suite**:
   Execute the new touch test suite from workspace root or `apps/web`:

   ```bash
   pnpm --filter @voxwright/web build
   node apps/web/test/touch-e2e.ts
   ```

   **Expected Outcome**: All 13+ touch checks pass (`[touch-viewer]` checks for coarse pointer detection, 390x844 viewport, DPR 3, Rafeals_house opening, CDP touch orbit, touchscreen drag, touchscreen tap, CDP two-finger pinch zoom, zero console errors).

2. **Verify Desktop Tests Unaffected**:
   Execute existing desktop suite:

   ```bash
   node apps/web/test/e2e.ts
   ```

   **Expected Outcome**: Exact same 338 checks pass with 0 errors.

3. **Verify Typecheck and Lint**:

   ```bash
   pnpm --filter @voxwright/web run typecheck
   pnpm run check
   ```

   **Expected Outcome**: 0 errors.

### Invalidation Conditions

- If `page.setViewport` fails to set `(any-pointer: coarse)` in Chromium.
- If CDP `Input.dispatchTouchEvent` does not fire pointer events on the canvas.
- If changes inadvertently modify `apps/web/test/e2e.ts`.
