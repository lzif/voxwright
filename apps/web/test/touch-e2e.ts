// SPDX-License-Identifier: AGPL-3.0-only

// Touch-emulated end-to-end check in headless Chromium (FEAT-MB1-01):
// Serves the built site, emulates a mobile viewport (390 x 844, DPR 3, touch-enabled),
// opens the Rafeals_house fixture, verifies touch orbit, pinch zoom, and tap gestures,
// and asserts ?perf=1 telemetry overlay presence and metrics (FEAT-MB1-02).
// The second suite (MB4) edits the same fixture with real touch events: Place, Replace, Erase and
// Pick through the offset cursor, strokes, second-finger and drag-off cancels, long press.
// Run after `pnpm --filter @voxwright/web build`:
//
//   node test/touch-e2e.ts [--shots <dir>] [--chromium <path>]

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import puppeteer, {
  type CDPSession,
  type ElementHandle,
  type KeyInput,
  type TouchHandle,
} from "puppeteer-core";
import { chromiumArgs, findChromium, serveSite } from "./site.ts";
import type { PickedBlock, Pose, SessionView, Vox } from "./vox.ts";

export const MOBILE_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
} as const;

export interface TouchPose extends Pose {
  distance: number;
}

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
    touchPoints: [{ x: end.x, y: end.y, id }],
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
  let lastSpread = startSpread;
  for (let i = 1; i <= steps; i++) {
    const spread = startSpread + ((endSpread - startSpread) * i) / steps;
    lastSpread = spread;
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
  const lastP1 = { x: Math.round(center.x - lastSpread / 2), y: center.y };
  const lastP2 = { x: Math.round(center.x + lastSpread / 2), y: center.y };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [
      { x: lastP1.x, y: lastP1.y, id: 1 },
      { x: lastP2.x, y: lastP2.y, id: 2 },
    ],
  });
}

/** Helper: dispatch a two-finger pan gesture via CDP Input.dispatchTouchEvent */
export async function cdpTwoFingerPan(
  cdp: CDPSession,
  startCenter: { x: number; y: number },
  delta: { dx: number; dy: number },
  fingerSpacing = 80,
  steps = 8,
): Promise<void> {
  const p1Start = { x: Math.round(startCenter.x - fingerSpacing / 2), y: startCenter.y };
  const p2Start = { x: Math.round(startCenter.x + fingerSpacing / 2), y: startCenter.y };

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: p1Start.x, y: p1Start.y, id: 1 },
      { x: p2Start.x, y: p2Start.y, id: 2 },
    ],
  });

  for (let i = 1; i <= steps; i++) {
    const curDx = Math.round((delta.dx * i) / steps);
    const curDy = Math.round((delta.dy * i) / steps);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: p1Start.x + curDx, y: p1Start.y + curDy, id: 1 },
        { x: p2Start.x + curDx, y: p2Start.y + curDy, id: 2 },
      ],
    });
  }

  const p1End = { x: p1Start.x + delta.dx, y: p1Start.y + delta.dy };
  const p2End = { x: p2Start.x + delta.dx, y: p2Start.y + delta.dy };

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [
      { x: p1End.x, y: p1End.y, id: 1 },
      { x: p2End.x, y: p2End.y, id: 2 },
    ],
  });
}

function computeTarget(p: TouchPose): [number, number, number] {
  const RAD = Math.PI / 180;
  const dx = -Math.sin(p.azimuth * RAD) * Math.cos(p.elevation * RAD);
  const dy = -Math.sin(p.elevation * RAD);
  const dz = Math.cos(p.azimuth * RAD) * Math.cos(p.elevation * RAD);
  return [
    p.position[0] + dx * p.distance,
    p.position[1] + dy * p.distance,
    p.position[2] + dz * p.distance,
  ];
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

    // =========================================================================
    // PART 1: Mobile Viewer Mode & Inactive Perf Overlay (without ?perf=1)
    // =========================================================================
    await page.goto(url);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 30000 },
    );

    // 1. Check phone environment detection & media queries
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

    // Check perf overlay is absent when ?perf=1 is omitted
    const overlayAbsent = await page.evaluate(
      () => document.querySelector('[data-testid="perf-overlay"]') === null,
    );
    ok(overlayAbsent, t("perf overlay is inactive and unmounted without ?perf=1"));

    const settle = async (): Promise<void> => {
      await page.evaluate(() => window.__voxwright?.renderer.whenIdle());
    };
    const pose = (): Promise<TouchPose> =>
      page.evaluate(() =>
        (
          window.__voxwright as unknown as { renderer: { getPose(): TouchPose } }
        ).renderer.getPose(),
      );

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

    // Verify mobile layout bounds (no horizontal scroll and no document vertical scroll)
    const layout = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      const main = document.querySelector("main");
      const session = (window as unknown as { __voxwright?: Vox }).__voxwright?.session();
      const mq = window.matchMedia("(min-width: 1000px) and (pointer: fine)");
      const mqCoarse = window.matchMedia("(any-pointer: coarse)");
      const mqFine = window.matchMedia("(any-pointer: fine)");
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        overflowY: el.scrollHeight - window.innerHeight,
        toolbar: document.querySelector('[data-testid="toolbar"]') !== null,
        sessionActive: session !== null,
        mainClasses: main?.className,
        mainHeight: main?.offsetHeight,
        mainScrollHeight: main?.scrollHeight,
        mqMatches: mq.matches,
        mqCoarse: mqCoarse.matches,
        mqFine: mqFine.matches,
        windowInnerWidth: window.innerWidth,
        windowInnerHeight: window.innerHeight,
        topAppBarPresent: document.querySelector('[data-testid="top-app-bar"]') !== null,
        stageClasses: document.querySelector(".stage")?.className,
      };
    });
    ok(
      layout.overflow <= 1,
      t(`page does not scroll horizontally (overflow: ${layout.overflow}px)`),
    );
    ok(
      layout.overflowY <= 1,
      t(`page has no document vertical scroll while editing (overflow: ${layout.overflowY}px)`),
    );
    ok(layout.toolbar, t("toolbar is present for coarse device in MB3 mobile editor"));

    // Verify touch targets >= 44px (WCAG 2.5.5) and primary controls >= 48px
    const touchTargetSelectors = [
      '[data-testid="tool-navigate"]',
      '[data-testid="tool-place"]',
      '[data-testid="tool-paint"]',
      '[data-testid="tool-erase"]',
      '[data-testid="tool-eyedropper"]',
      '[data-testid="tool-line"]',
      '[data-testid="tool-rectangle"]',
      '[data-testid="tool-select"]',
      '[data-testid="active-block-swatch"]',
      '[data-testid="undo"]',
      '[data-testid="redo"]',
      '[data-testid="cancel"]',
      '[data-testid="confirm"]',
      '[data-testid="mobile-menu-btn"]',
    ];
    for (const sel of touchTargetSelectors) {
      const el = await page.$(sel);
      ok(el !== null, t(`touch target element ${sel} exists`));
      if (el) {
        const box = await el.boundingBox();
        ok(box !== null, t(`touch target ${sel} has a bounding box`));
        if (box) {
          ok(
            box.width >= 44 && box.height >= 44,
            t(
              `touch target ${sel} meets WCAG 2.5.5 >= 44px (got ${box.width.toFixed(1)}x${box.height.toFixed(1)}px)`,
            ),
          );
          ok(
            box.width >= 48 && box.height >= 48,
            t(
              `touch target ${sel} meets ergonomics spec >= 48px (got ${box.width.toFixed(1)}x${box.height.toFixed(1)}px)`,
            ),
          );
        }
      }
    }

    if (values.shots) {
      await page.screenshot({ path: join(values.shots, "mobile-viewer-initial.png") });
    }

    // 3. Touch Orbit via CDP Input.dispatchTouchEvent
    const canvasEl = await page.$('[data-testid="canvas"]');
    if (!canvasEl) throw new Error("canvas element not found");
    const canvasBox = await canvasEl.boundingBox();
    if (!canvasBox) throw new Error("canvas bounding box not found");
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
    ok(
      Math.abs(pose1.distance - pose0.distance) < 0.05,
      t("1-finger touch orbit preserves camera distance without scaling"),
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

    // 6. Two-Finger Pan via CDP (FEAT-MB2-05: Translation without rotation)
    const panPoseBefore = await pose();
    const panPicBefore = await picture();
    await cdpTwoFingerPan(cdp, { x: cx, y: cy }, { dx: 120, dy: -60 });
    await settle();
    const panPoseAfter = await pose();
    const panPicAfter = await picture();

    ok(
      Math.abs(panPoseAfter.azimuth - panPoseBefore.azimuth) < 0.05,
      t("2-finger pan causes zero azimuth rotation"),
    );
    ok(
      Math.abs(panPoseAfter.elevation - panPoseBefore.elevation) < 0.05,
      t("2-finger pan causes zero elevation rotation"),
    );
    ok(
      Math.abs(panPoseAfter.distance - panPoseBefore.distance) < 0.05,
      t("2-finger pan preserves exact camera distance"),
    );
    const translationDist = Math.hypot(
      panPoseAfter.position[0] - panPoseBefore.position[0],
      panPoseAfter.position[1] - panPoseBefore.position[1],
      panPoseAfter.position[2] - panPoseBefore.position[2],
    );
    ok(
      translationDist > 1.0,
      t(`2-finger pan translates camera in 3D space (moved ${translationDist.toFixed(2)} blocks)`),
    );
    ok(panPicAfter.hash !== panPicBefore.hash, t("2-finger pan updates rendered canvas image"));

    // 7. Two-Finger Pinch Zoom via CDP (Without drift or jumps)
    const zoomPose0 = await pose();
    const target0 = computeTarget(zoomPose0);

    // Zoom out (fingers move closer: spread 140 -> 70, ~2.0x distance)
    await cdpPinch(cdp, { x: cx, y: cy }, 140, 70);
    await settle();
    const zoomPose1 = await pose();
    const target1 = computeTarget(zoomPose1);

    ok(
      zoomPose1.distance > zoomPose0.distance * 1.8 &&
        zoomPose1.distance < zoomPose0.distance * 2.2,
      t(
        `two-finger pinch-in smoothly zooms out by ~2.0x (${zoomPose0.distance.toFixed(1)} -> ${zoomPose1.distance.toFixed(1)})`,
      ),
    );
    ok(
      Math.abs(zoomPose1.azimuth - zoomPose0.azimuth) < 0.05,
      t("pinch zoom produces no azimuth drift"),
    );
    ok(
      Math.abs(zoomPose1.elevation - zoomPose0.elevation) < 0.05,
      t("pinch zoom produces no elevation drift"),
    );
    const targetDrift = Math.hypot(
      target1[0] - target0[0],
      target1[1] - target0[1],
      target1[2] - target0[2],
    );
    ok(
      targetDrift < 0.1,
      t(`pinch zoom causes no target translation drift (drift: ${targetDrift.toFixed(3)})`),
    );

    // Reverse Zoom In (fingers move apart: spread 70 -> 140, ~0.5x distance)
    await cdpPinch(cdp, { x: cx, y: cy }, 70, 140);
    await settle();
    const zoomPose2 = await pose();
    ok(
      Math.abs(zoomPose2.distance - zoomPose0.distance) / zoomPose0.distance < 0.1,
      t(
        `two-finger pinch-out zooms back in to original distance (${zoomPose1.distance.toFixed(1)} -> ${zoomPose2.distance.toFixed(1)}, baseline ${zoomPose0.distance.toFixed(1)})`,
      ),
    );
    ok(
      Math.abs(zoomPose2.azimuth - zoomPose0.azimuth) < 0.05,
      t("round-trip pinch zoom preserves azimuth"),
    );
    ok(
      Math.abs(zoomPose2.elevation - zoomPose0.elevation) < 0.05,
      t("round-trip pinch zoom preserves elevation"),
    );

    if (values.shots) {
      await page.screenshot({ path: join(values.shots, "mobile-viewer-orbited.png") });
    }

    // =========================================================================
    // PART 1B: MB3 Mobile Sheet & Desktop Regression Verification
    // =========================================================================

    // 1. Open Palette bottom sheet by tapping active block swatch
    const swatchEl = await page.$('[data-testid="active-block-swatch"]');
    ok(swatchEl !== null, t("active block swatch button exists"));
    if (!swatchEl) throw new Error("swatch element missing");
    const sBox = await swatchEl.boundingBox();
    ok(sBox !== null, t("active block swatch button has a bounding box"));
    if (!sBox) throw new Error("swatch bounding box missing");
    await page.touchscreen.tap(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);

    await page.waitForFunction(
      () => {
        const sheet = document.querySelector('[data-testid="bottom-sheet"]');
        const palette = document.querySelector('[data-testid="palette"]');
        return sheet !== null && palette !== null;
      },
      { timeout: 10000 },
    );
    ok(true, t("Palette bottom sheet opens when tapping block swatch"));

    // 2. Filter palette with search input and verify touch target sizes
    const searchInput = await page.$('[data-testid="palette-search"]');
    ok(searchInput !== null, t("palette search input is present"));
    if (!searchInput) throw new Error("search input missing");

    const searchBox = await searchInput.boundingBox();
    ok(searchBox !== null, t("palette search input has a bounding box"));
    if (searchBox) {
      ok(
        searchBox.height >= 43.99, // a 44px box can measure 43.9999 at a fractional device ratio
        t(
          `palette search input meets WCAG 2.5.5 >= 44px (height: ${searchBox.height.toFixed(1)}px)`,
        ),
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

    await page.waitForFunction(
      () => {
        const items = document.querySelectorAll('[data-testid="palette-list"] li button');
        return items.length > 0 && Array.from(items).some((b) => b.textContent?.includes("stone"));
      },
      { timeout: 10000 },
    );
    ok(true, t("palette list filtered to stone blocks"));

    const firstEntry = await page.$('[data-testid="palette-list"] li button');
    ok(firstEntry !== null, t("first palette entry button is present"));
    if (firstEntry) {
      const entryBox = await firstEntry.boundingBox();
      ok(entryBox !== null, t("first palette entry button has a bounding box"));
      if (entryBox) {
        ok(
          entryBox.height >= 48,
          t(
            `palette entry meets ergonomics spec >= 48px (height: ${entryBox.height.toFixed(1)}px)`,
          ),
        );
      }
    }

    // 3. Emulate software keyboard by resizing visualViewport (844 -> 450)
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 450,
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
    const stoneBtn = await page.$('[data-testid="palette-list"] li button[data-block*="stone"]');
    ok(stoneBtn !== null, t("stone block button exists in filtered list"));
    if (stoneBtn) {
      const bBox = await stoneBtn.boundingBox();
      if (bBox) {
        await page.touchscreen.tap(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2);
        const chosen = await page.evaluate(
          () => (window as unknown as { __voxwright?: Vox }).__voxwright?.session()?.block,
        );
        ok(
          chosen?.includes("stone"),
          t(`tapping palette entry sets session block (got: ${chosen})`),
        );
      }
    }

    // Restore viewport metrics
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));

    // 5. Close sheet via close button
    const closeBtn = await page.$('[data-testid="bottom-sheet-close"]');
    if (closeBtn) {
      const cBox = await closeBtn.boundingBox();
      if (cBox) {
        await page.touchscreen.tap(cBox.x + cBox.width / 2, cBox.y + cBox.height / 2);
        await page.waitForFunction(
          () => document.querySelector('[data-testid="bottom-sheet"]') === null,
          { timeout: 5000 },
        );
        ok(true, t("Palette bottom sheet closes on close button tap"));
      }
    }

    // 6. Desktop 1280x800 layout verification (zero regressions)
    const desktopPage = await browser.newPage();
    try {
      await desktopPage.setViewport({ width: 1280, height: 800 });
      await desktopPage.goto(url);
      await desktopPage.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="status"]')
            ?.textContent?.startsWith("open a schematic"),
        { timeout: 30000 },
      );
      const dInput = (await desktopPage.$(
        '[data-testid="file"]',
      )) as ElementHandle<HTMLInputElement>;
      await dInput.uploadFile(join(fixtures, "Rafeals_house.nbt"));
      await desktopPage.waitForFunction(
        () => document.querySelector('[data-testid="status"]')?.textContent?.includes("blocks"),
        { timeout: 60000 },
      );
      await desktopPage.evaluate(() =>
        (window as unknown as { __voxwright?: Vox }).__voxwright?.renderer.whenIdle(),
      );

      const stageColumns = await desktopPage.$eval(
        ".stage.editable",
        (el) => window.getComputedStyle(el).gridTemplateColumns,
      );
      const tracks = stageColumns.trim().split(/\s+/);
      ok(
        tracks.length === 3,
        t(`Desktop 1280x800 layout maintains 3-column grid (computed: ${stageColumns})`),
      );

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
        t("Desktop side column contains BlockPalette, BlockStatePanel, and SelectionPanel"),
      );

      const desktopTb = await desktopPage.$('[data-testid="toolbar"]');
      ok(desktopTb !== null, t("Desktop toolbar is present above canvas"));

      const mobileElsInactive = await desktopPage.evaluate(() => {
        const topBar = document.querySelector('[data-testid="top-app-bar"]');
        const thumb = document.querySelector('[data-testid="thumb-cluster"]');
        return topBar === null && thumb === null;
      });
      ok(mobileElsInactive, t("Mobile top bar and thumb cluster are absent in desktop mode"));
      ok(
        (await desktopPage.$('[data-testid="cursor-offset-input"]')) === null,
        t("the Cursor distance control is not in the desktop layout"),
      );
    } finally {
      await desktopPage.close();
    }

    // =========================================================================
    // PART 2: ?perf=1 Telemetry Overlay Presence & Metrics Verification
    // =========================================================================
    const perfPage = await browser.newPage();
    await perfPage.setViewport(MOBILE_VIEWPORT);
    perfPage.on("pageerror", (e) => errors.push(String(e)));
    perfPage.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const perfCdp = await perfPage.createCDPSession();

    const perfUrl = `${url}&perf=1`;
    await perfPage.goto(perfUrl);
    await perfPage.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 30000 },
    );

    // Verify overlay presence
    await perfPage.waitForSelector('[data-testid="perf-overlay"]', { timeout: 10000 });
    ok(true, t("?perf=1 navigates and mounts the perf-overlay HUD"));

    // DPR check
    const dprText = await perfPage.$eval('[data-testid="perf-dpr"]', (el) =>
      el.textContent?.trim(),
    );
    ok(dprText === "3.00", t(`perf overlay reports DPR 3.00 (got: ${dprText})`));

    // Wait for rolling FPS sampling interval (>= 250ms)
    await perfPage.waitForFunction(
      () => {
        const text = document.querySelector('[data-testid="perf-fps"]')?.textContent ?? "";
        const m = parseInt(text, 10);
        return !Number.isNaN(m) && m > 0;
      },
      { timeout: 10000 },
    );
    const fpsText = await perfPage.$eval('[data-testid="perf-fps"]', (el) =>
      el.textContent?.trim(),
    );
    ok(true, t(`perf overlay reports active rolling FPS (${fpsText})`));

    // Open schematic on perf page and verify scene metrics
    const perfInput = (await perfPage.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await perfInput.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await perfPage.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 60000 },
    );
    const perfSettle = async (): Promise<void> => {
      await perfPage.evaluate(() => window.__voxwright?.renderer.whenIdle());
    };
    const perfPose = (): Promise<TouchPose> =>
      perfPage.evaluate(() =>
        (
          window.__voxwright as unknown as { renderer: { getPose(): TouchPose } }
        ).renderer.getPose(),
      );
    await perfSettle();

    // Verify triangles > 0
    await perfPage.waitForFunction(
      () => {
        const txt = document.querySelector('[data-testid="perf-triangles"]')?.textContent ?? "";
        const n = parseInt(txt.replace(/,/g, ""), 10);
        return !Number.isNaN(n) && n > 0;
      },
      { timeout: 10000 },
    );
    const trianglesText = await perfPage.$eval('[data-testid="perf-triangles"]', (el) =>
      el.textContent?.trim(),
    );
    ok(true, t(`perf overlay displays scene triangles (${trianglesText})`));

    // Verify first frame latency is populated
    await perfPage.waitForFunction(
      () => {
        const txt = document.querySelector('[data-testid="perf-first-frame"]')?.textContent ?? "";
        return txt.includes("ms");
      },
      { timeout: 10000 },
    );
    const firstFrameText = await perfPage.$eval('[data-testid="perf-first-frame"]', (el) =>
      el.textContent?.trim(),
    );
    ok(true, t(`perf overlay displays first full frame latency (${firstFrameText})`));

    // Verify JS Heap metric (Chromium provides performance.memory)
    const heapText = await perfPage.$eval('[data-testid="perf-heap"]', (el) =>
      el.textContent?.trim(),
    );
    ok(
      heapText !== undefined && (heapText.includes("MB") || heapText === "n/a"),
      t(`perf overlay displays JS heap memory (${heapText})`),
    );

    // Verify pointer-events pass through overlay
    const perfCanvasEl = await perfPage.$('[data-testid="canvas"]');
    if (!perfCanvasEl) throw new Error("perf canvas element not found");
    const pBox = await perfCanvasEl.boundingBox();
    if (!pBox) throw new Error("perf canvas bounding box not found");
    const pcx = Math.round(pBox.x + pBox.width / 2);
    const pcy = Math.round(pBox.y + pBox.height / 2);

    const perfPose0 = await perfPose();
    await cdpTouchDrag(perfCdp, { x: pcx, y: pcy }, { x: pcx + 80, y: pcy + 40 });
    await perfSettle();
    const perfPose1 = await perfPose();
    ok(
      Math.abs(perfPose1.azimuth - perfPose0.azimuth) > 5 ||
        Math.abs(perfPose1.elevation - perfPose0.elevation) > 5,
      t("touch gestures pass cleanly through the overlay to canvas"),
    );

    if (values.shots) {
      await perfPage.screenshot({ path: join(values.shots, "mobile-perf-overlay.png") });
    }

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

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

type Vec3 = [number, number, number];
interface Top {
  pos: Vec3;
  pt: { x: number; y: number };
  block: string;
}

/** How far above the finger the cursor sits by default (`DEFAULT_CURSOR_OFFSET_PX`; the suite checks the page agrees). */
const OFFSET = 64;
const GOLD = "minecraft:gold_block";

/**
 * MB4: touch placement with the offset cursor. Real touch events (Puppeteer's touchscreen over CDP)
 * on a fresh page; cells are judged by reading the page's volume, as the desktop editor suite does.
 */
export async function touchPlacementSuite(): Promise<void> {
  const t = (what: string): string => `[touch-edit] ${what}`;
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

    await page.goto(url);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 30000 },
    );
    const input = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await input.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await page.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 60000 },
    );
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

    // -- helpers that talk to the page ---------------------------------------------------------
    const state = (): Promise<SessionView> =>
      page.evaluate(() => {
        const s = (window.__voxwright as Vox).session();
        if (s === null) throw new Error("no editor session");
        return JSON.parse(
          JSON.stringify({
            tool: s.tool,
            block: s.block,
            hover: s.hover,
            inspected: s.inspected,
            undoCount: s.undoCount,
            canUndo: s.canUndo,
            message: s.message,
            error: s.error,
            reticle: s.reticle,
            cursorOffsetPx: s.cursorOffsetPx,
          }),
        ) as SessionView;
      });
    /** Block strings of every cell that is not air, as "x,y,z" to block. */
    const cells = async (): Promise<Map<string, string>> =>
      new Map(
        await page.evaluate(() => {
          const v = (window.__voxwright as Vox).volume();
          const [lo, hi] = v.placedBounds() as [number[], number[]];
          const out: [string, string][] = [];
          for (let x = lo[0] as number; x <= (hi[0] as number); x++)
            for (let y = lo[1] as number; y <= (hi[1] as number); y++)
              for (let z = lo[2] as number; z <= (hi[2] as number); z++) {
                const b = v.get(x, y, z);
                if (b !== undefined && b !== "minecraft:air") out.push([`${x},${y},${z}`, b]);
              }
          return out;
        }),
      );
    const changed = async (before: Map<string, string>): Promise<string[]> => {
      const now = await cells();
      const keys = new Set([...before.keys(), ...now.keys()]);
      return [...keys].filter((k) => before.get(k) !== now.get(k)).sort();
    };
    /** Cells whose top face a touch reaches, with the page point of that face's centre. */
    const tops = (): Promise<Top[]> =>
      page.evaluate(() => {
        const v = window.__voxwright as Vox;
        const vol = v.volume();
        const s = v.session() as NonNullable<ReturnType<Vox["session"]>>;
        const [lo, hi] = vol.bounds() as [number[], number[]];
        const out: Top[] = [];
        for (let x = lo[0] as number; x <= (hi[0] as number); x++)
          for (let z = lo[2] as number; z <= (hi[2] as number); z++) {
            for (let y = hi[1] as number; y >= (lo[1] as number); y--) {
              const b = vol.get(x, y, z);
              if (b === undefined || b === "minecraft:air") continue;
              const pt = v.renderer.clientFromWorld(x + 0.5, y + 1, z + 0.5);
              const hit = pt === null ? null : s.pick(pt.x, pt.y);
              if (
                pt !== null &&
                hit !== null &&
                hit.position[0] === x &&
                hit.position[1] === y &&
                hit.position[2] === z &&
                hit.normal[1] === 1
              )
                out.push({ pos: [x, y, z], pt, block: b });
              break;
            }
          }
        return out;
      });
    const pickAt = (x: number, y: number): Promise<PickedBlock | null> =>
      page.evaluate((px, py) => (window.__voxwright as Vox).session()?.pick(px, py) ?? null, x, y);
    const pose = (): Promise<TouchPose> =>
      page.evaluate(() =>
        (
          window.__voxwright as unknown as { renderer: { getPose(): TouchPose } }
        ).renderer.getPose(),
      );
    const setBlock = (block: string): Promise<void> =>
      page.evaluate((b) => {
        const s = (window.__voxwright as Vox).session();
        if (s === null) throw new Error("no editor session");
        s.block = b;
      }, block);
    const settleFrames = async (): Promise<void> => {
      await sleep(120);
      await page.evaluate(() => window.__voxwright?.renderer.whenIdle());
    };

    /** Put the camera back where it was when the file opened, so page points keep meaning the same cells. */
    const home = await pose();
    const restoreCamera = async (): Promise<void> => {
      await page.evaluate(
        (p, target) => {
          (window.__voxwright as Vox).renderer.setOrbit({
            azimuth: p.azimuth,
            elevation: p.elevation,
            distance: p.distance,
            target,
          });
        },
        home,
        computeTarget(home),
      );
      await settleFrames();
    };

    /** The shortest signed turn from one azimuth to another, in degrees. */
    const turn = (from: number, to: number): number => ((((to - from) % 360) + 540) % 360) - 180;
    const turned = (a: TouchPose, b: TouchPose): { az: number; el: number } => ({
      az: turn(a.azimuth, b.azimuth),
      el: b.elevation - a.elevation,
    });
    /**
     * A finger still down at `at` after the other finger of a two-finger gesture lifted: it must
     * keep turning the build, from where it is (no jump), and must not pick or paint.
     * `label` names the gesture in the check texts. The finger is lifted at the end.
     */
    const leftoverOrbits = async (
      label: string,
      leftover: TouchHandle,
      at: { x: number; y: number },
    ): Promise<void> => {
      const atLift = await pose();
      const blockBefore = (await state()).block;
      // Held still well past the long-press time: no pick, and the camera does not move.
      await sleep(650);
      const held = await state();
      const heldPose = turned(atLift, await pose());
      ok(
        held.block === blockBefore && held.tool !== "eyedropper" && held.reticle === null,
        t(`${label}: the finger left down, held still, picks nothing and shows no cursor`),
      );
      ok(
        Math.abs(heldPose.az) < 0.01 && Math.abs(heldPose.el) < 0.01,
        t(`${label}: the finger left down does not turn the view while it is still`),
      );
      // The first small move after the lift: 6 px sideways turns the view by 6 px worth, not by
      // the distance the finger travelled since it first landed.
      await leftover.move(at.x + 6, at.y);
      await sleep(150);
      const small = turned(atLift, await pose());
      ok(
        Math.abs(small.az) >= 1.5 && Math.abs(small.az) <= 3.5 && Math.abs(small.el) < 0.5,
        t(
          `${label}: its first 6px move turns the view by about 2.4 degrees, with no jump (azimuth ${small.az.toFixed(2)}, elevation ${small.el.toFixed(2)})`,
        ),
      );
      await leftover.move(at.x + 70, at.y + 50);
      await sleep(120);
      await leftover.move(at.x + 20, at.y - 60);
      await sleep(150);
      await leftover.end();
      await sleep(250);
      const total = turned(atLift, await pose());
      ok(
        Math.abs(total.az) > 5 || Math.abs(total.el) > 5,
        t(
          `${label}: the finger left down turns the view (azimuth ${total.az.toFixed(1)}, elevation ${total.el.toFixed(1)})`,
        ),
      );
    };

    /** Tap a button with a real touch. */
    const tapButton = async (selector: string): Promise<void> => {
      await page.evaluate((sel) => {
        document.querySelector(sel)?.scrollIntoView({ inline: "center", block: "nearest" });
      }, selector);
      const el = await page.$(selector);
      const box = el === null ? null : await el.boundingBox();
      if (box === null) throw new Error(`no box for ${selector}`);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(120);
    };
    const armTool = async (id: string): Promise<void> => {
      await tapButton(`[data-testid="tool-${id}"]`);
      ok((await state()).tool === id, t(`the ${id} tool is armed from the bottom toolbar`));
    };
    const tapAt = async (x: number, y: number): Promise<void> => {
      const finger = await page.touchscreen.touchStart(x, y);
      await sleep(50);
      await finger.end();
      await sleep(200);
    };
    /** A finger put down at the first point and moved through the rest; the caller lifts it. */
    const dragThrough = async (path: { x: number; y: number }[]) => {
      const [first, ...rest] = path as [{ x: number; y: number }, ...{ x: number; y: number }[]];
      const finger = await page.touchscreen.touchStart(first.x, first.y);
      await sleep(80);
      for (const p of rest) {
        await finger.move(p.x, p.y);
        await sleep(90);
      }
      return finger;
    };
    /** Evenly spaced points from a to b, a first. */
    const line = (a: { x: number; y: number }, b: { x: number; y: number }, steps: number) =>
      Array.from({ length: steps + 1 }, (_, i) => ({
        x: Math.round(a.x + ((b.x - a.x) * i) / steps),
        y: Math.round(a.y + ((b.y - a.y) * i) / steps),
      }));
    /** Where a finger goes so that the cursor is on a page point. */
    const below = (p: { x: number; y: number }): { x: number; y: number } => ({
      x: Math.round(p.x),
      y: Math.round(p.y + OFFSET),
    });
    const key = (p: readonly number[]): string => p.join(",");

    // -- setup ----------------------------------------------------------------------------------
    const original = await cells();
    const all = await tops();
    const topAt = (x: number, y: number, z: number): Top => {
      const found = all.find((c) => c.pos[0] === x && c.pos[1] === y && c.pos[2] === z);
      if (found === undefined) throw new Error(`no reachable top face at ${x},${y},${z}`);
      return found;
    };
    // The roof ridge: a run of cells at x = 6, y = 7 that a finger can sweep along.
    const target = topAt(6, 7, 6);
    const targetAdjacent: Vec3 = [6, 8, 6];
    const finger = below(target.pt);
    const underFinger = await pickAt(finger.x, finger.y);
    ok(
      underFinger !== null && key(underFinger.adjacent) !== key(targetAdjacent),
      t(
        `the finger point is over a different cell than the cursor point (${underFinger ? key(underFinger.adjacent) : "nothing"} vs ${key(targetAdjacent)})`,
      ),
    );
    ok(
      (await state()).cursorOffsetPx === OFFSET,
      t(`the cursor sits ${OFFSET}px above the finger`),
    );
    const toolbarTop = await page.$eval(
      '[data-testid="bottom-toolbar"]',
      (el) => el.getBoundingClientRect().top,
    );
    ok(toolbarTop > finger.y + 100, t(`the bottom toolbar starts at y=${Math.round(toolbarTop)}`));

    const undoViaThumb = async (what: string): Promise<void> => {
      await tapButton('[data-testid="undo"]');
      const s = await state();
      ok((await changed(original)).length === 0 && s.undoCount === 0, t(what));
    };

    // =========================================================================
    // Place: tap, offset cursor, drag, undo
    // =========================================================================
    await armTool("place");
    await setBlock("minecraft:stone");

    // A finger held still shows the cursor 64px above it, and the outline is on the cell under the cursor.
    const held = await page.touchscreen.touchStart(finger.x, finger.y);
    await page.waitForFunction(
      () =>
        (window.__voxwright as Vox).session()?.reticle?.hit != null &&
        document.querySelector(".reticle-target") !== null,
      { timeout: 5000 },
    );
    // One evaluation for all of it, well inside the long-press time.
    const during = await page.evaluate(() => {
      const s = (window.__voxwright as Vox).session() as NonNullable<ReturnType<Vox["session"]>>;
      const r = document.querySelector(".reticle-target")?.getBoundingClientRect();
      const overlay = document.querySelector('[data-testid="reticle-overlay"]');
      return {
        reticle: s.reticle && {
          active: s.reticle.active,
          touchX: s.reticle.touchX,
          touchY: s.reticle.touchY,
          reticleX: s.reticle.reticleX,
          reticleY: s.reticle.reticleY,
        },
        hover: s.hover?.position ?? null,
        cx: r ? r.left + r.width / 2 : null,
        cy: r ? r.top + r.height / 2 : null,
        pointerEvents: overlay ? getComputedStyle(overlay).pointerEvents : null,
      };
    });
    ok(
      during.reticle?.active === true &&
        during.reticle.touchX === finger.x &&
        during.reticle.touchY === finger.y &&
        during.reticle.reticleX === finger.x &&
        during.reticle.reticleY === finger.y - OFFSET,
      t(
        `holding a finger shows the cursor ${OFFSET}px above it (${JSON.stringify(during.reticle && [during.reticle.reticleX, during.reticle.reticleY])})`,
      ),
    );
    ok(
      during.hover !== null && key(during.hover) === key(target.pos),
      t("the outline is on the cell under the cursor, not under the finger"),
    );
    ok(
      during.cx !== null &&
        during.cy !== null &&
        Math.abs(during.cx - finger.x) < 1.5 &&
        Math.abs(during.cy - (finger.y - OFFSET)) < 1.5 &&
        during.pointerEvents === "none",
      t(
        `the reticle is drawn at the cursor point and ignores the pointer (${during.cx?.toFixed(1)}, ${during.cy?.toFixed(1)})`,
      ),
    );
    // Held on past the long-press time, the lift is neither a tap nor a stroke.
    await sleep(600);
    await held.end();
    await sleep(200);
    const afterHold = await state();
    ok(
      afterHold.reticle === null && afterHold.hover === null,
      t("lifting the finger removes the cursor and the hover"),
    );
    ok(
      (await changed(original)).length === 0,
      t("a finger held past the long press and lifted changes nothing"),
    );
    await setBlock("minecraft:stone"); // the long press picked the block under the cursor

    await tapAt(finger.x, finger.y);
    const placed = await changed(original);
    const afterTap = await state();
    ok(
      placed.length === 1 && placed[0] === key(targetAdjacent),
      t(
        `tap places exactly one block, at the cursor's cell ${key(targetAdjacent)} (changed: ${placed.join(" ")})`,
      ),
    );
    ok(
      underFinger !== null && !placed.includes(key(underFinger.adjacent)),
      t("the cell under the finger is unchanged"),
    );
    ok(
      (await cells()).get(key(targetAdjacent)) === "minecraft:stone",
      t("the placed block is the chosen block"),
    );
    ok(afterTap.undoCount === 1, t("the tap is one undo step"));
    ok(
      afterTap.message === "place done" && !/ctrl/i.test(afterTap.message),
      t(`the message does not mention Ctrl+Z (got "${afterTap.message}")`),
    );
    ok(afterTap.reticle === null, t("the cursor is gone after the tap"));
    await undoViaThumb("one tap on the thumb cluster's Undo removes the tapped block");

    // Drag: paint along the ridge, with the cursor sweeping x = 6, y = 7, z = 2..8.
    await setBlock(GOLD);
    const from = topAt(6, 7, 2);
    const to = topAt(6, 7, 8);
    const path = line(below(from.pt), below(to.pt), 8);
    const stroke = await dragThrough(path.slice(0, 5));
    const midState = await state();
    const midChanged = await changed(original);
    ok(
      midState.reticle !== null &&
        midState.reticle.reticleY === midState.reticle.touchY - OFFSET &&
        midChanged.length >= 1,
      t(
        `mid-stroke the cursor follows the finger and blocks are already placed (${midChanged.length})`,
      ),
    );
    ok(midState.undoCount === 0, t("a stroke in progress is not yet in the history"));
    for (const p of path.slice(5)) {
      await stroke.move(p.x, p.y);
      await sleep(90);
    }
    await stroke.end();
    await sleep(300);
    const painted = await changed(original);
    const afterDrag = await state();
    const now = await cells();
    ok(
      painted.length >= 3 && painted.every((k) => k.startsWith("6,8,") && now.get(k) === GOLD),
      t(`a drag paints a run of blocks along the surface (${painted.join(" ")})`),
    );
    ok(afterDrag.undoCount === 1, t("the whole stroke is one undo step"));
    ok(
      afterDrag.reticle === null && afterDrag.hover === null,
      t("the cursor and the hover are gone after the stroke"),
    );
    ok(
      !/ctrl/i.test(afterDrag.message),
      t(`the stroke message does not mention Ctrl+Z ("${afterDrag.message}")`),
    );
    await undoViaThumb("one tap on the thumb cluster's Undo removes the whole stroke");

    // =========================================================================
    // Cancels
    // =========================================================================
    // A second finger added mid-stroke reverts it, and the camera takes the gesture.
    const first = below(from.pt);
    const poseBefore = await pose();
    const f1 = await dragThrough(line(first, below(topAt(6, 7, 5).pt), 3));
    ok(
      (await changed(original)).length >= 1,
      t("a stroke is under way before the second finger lands"),
    );
    const f2 = await page.touchscreen.touchStart(300, 560);
    await sleep(250);
    const afterSecond = await state();
    ok(
      (await changed(original)).length === 0 && afterSecond.undoCount === 0,
      t("a second finger mid-stroke leaves the volume unchanged and adds no history entry"),
    );
    ok(
      afterSecond.reticle === null && afterSecond.hover === null,
      t("the cursor is hidden once the second finger lands"),
    );
    await f1.move(first.x - 30, first.y + 40);
    await f2.move(300 - 30, 560 + 40);
    await sleep(150);
    await f1.move(first.x - 60, first.y + 80);
    await f2.move(300 - 60, 560 + 80);
    await sleep(250);
    const poseAfterPan = await pose();
    ok(
      Math.hypot(
        poseAfterPan.position[0] - poseBefore.position[0],
        poseAfterPan.position[1] - poseBefore.position[1],
        poseAfterPan.position[2] - poseBefore.position[2],
      ) > 0.3,
      t("the two fingers pan the camera after the stroke was cancelled"),
    );
    await f2.end();
    await sleep(150);
    // The finger left down turns the view (the gesture began with Place armed) and never paints.
    await leftoverOrbits("Place armed, stroke, second finger", f1, {
      x: first.x - 60,
      y: first.y + 80,
    });
    ok(
      (await changed(original)).length === 0 && (await state()).undoCount === 0,
      t("the finger left down after the second one lifted never paints"),
    );
    await restoreCamera();

    // A pinch with a finger left down.
    const dist0 = (await pose()).distance;
    const g1 = await page.touchscreen.touchStart(140, 420);
    const g2 = await page.touchscreen.touchStart(250, 420);
    await sleep(100);
    for (let i = 1; i <= 4; i++) {
      await g1.move(140 - i * 15, 420);
      await g2.move(250 + i * 15, 420);
      await sleep(90);
    }
    const dist1 = (await pose()).distance;
    ok(
      dist1 < dist0 * 0.8,
      t(`two fingers apart zoom in (${dist0.toFixed(1)} -> ${dist1.toFixed(1)})`),
    );
    await g2.end();
    await sleep(150);
    await leftoverOrbits("Place armed, pinch", g1, { x: 140 - 4 * 15, y: 420 });
    ok(
      (await changed(original)).length === 0 && (await state()).undoCount === 0,
      t("a finger left down after a pinch does not paint"),
    );
    await restoreCamera();

    // Dragging the finger onto the bottom toolbar cancels.
    const down1 = below(from.pt);
    const toToolbar = [
      ...line(down1, { x: down1.x + 20, y: down1.y + 110 }, 3),
      { x: down1.x + 20, y: Math.round(toolbarTop) + 30 },
    ];
    const toolbarFinger = await dragThrough(toToolbar.slice(0, 3));
    const beforeToolbar = await changed(original);
    ok(
      beforeToolbar.length >= 1,
      t("the stroke has painted something before it reaches the toolbar"),
    );
    const toolbarPoint = toToolbar[toToolbar.length - 1] as { x: number; y: number };
    await toolbarFinger.move(toolbarPoint.x, toolbarPoint.y);
    await sleep(250);
    const overToolbar = await state();
    ok(
      (await changed(original)).length === 0 &&
        overToolbar.undoCount === 0 &&
        overToolbar.reticle === null,
      t("dragging the finger onto the bottom toolbar mid-stroke cancels it"),
    );
    await toolbarFinger.end();
    await sleep(250);
    const afterToolbar = await state();
    ok(
      (await changed(original)).length === 0 &&
        afterToolbar.undoCount === 0 &&
        afterToolbar.tool === "place",
      t("lifting the finger on the toolbar commits nothing and presses no button"),
    );

    // The cursor leaving the top of the canvas cancels too (the finger is still over the canvas).
    const topFinger = await dragThrough([...line(down1, { x: down1.x, y: down1.y - 120 }, 3)]);
    ok(
      (await changed(original)).length >= 1,
      t("the stroke has painted something before it leaves the top"),
    );
    await topFinger.move(down1.x, 60); // the cursor is at y = -4
    await sleep(250);
    ok(
      (await changed(original)).length === 0 && (await state()).reticle === null,
      t("the cursor leaving the canvas cancels the stroke"),
    );
    await topFinger.end();
    await sleep(250);
    ok((await changed(original)).length === 0, t("and the lift that follows commits nothing"));

    // =========================================================================
    // Long press
    // =========================================================================
    await setBlock(GOLD);
    const hold = await page.touchscreen.touchStart(finger.x, finger.y);
    await sleep(750);
    const pressed = await state();
    ok(
      pressed.block === target.block && pressed.tool === "place",
      t(
        `a long press picks the block under the cursor and the tool stays Place (${pressed.block})`,
      ),
    );
    ok(
      pressed.message === `Picked ${target.block}` && pressed.reticle === null,
      t(`the Picked message shows and the cursor is gone (${pressed.message})`),
    );
    const swatch = await page.$eval('[data-testid="mobile-palette-toggle"]', (el) =>
      el.textContent?.trim(),
    );
    const swatchAria = await page.$eval('[data-testid="active-block-swatch"]', (el) =>
      el.getAttribute("aria-label"),
    );
    const picked = target.block.replace("minecraft:", "");
    ok(
      swatch === picked && swatchAria?.includes(picked) === true,
      t(`the bottom toolbar shows the picked block (${swatch})`),
    );
    await hold.move(finger.x + 60, finger.y + 40);
    await sleep(150);
    await hold.end();
    await sleep(250);
    ok(
      (await changed(original)).length === 0 && (await state()).undoCount === 0,
      t("after a long press, moving and lifting change nothing"),
    );

    // =========================================================================
    // Replace, Erase and Pick by tap
    // =========================================================================
    await armTool("paint");
    await setBlock(GOLD);
    await tapAt(finger.x, finger.y);
    const replaced = await changed(original);
    ok(
      replaced.length === 1 &&
        replaced[0] === key(target.pos) &&
        (await cells()).get(key(target.pos)) === GOLD,
      t(`Replace by tap turns the cursor's block into the chosen one (${replaced.join(" ")})`),
    );
    ok((await state()).undoCount === 1, t("Replace by tap is one undo step"));
    await undoViaThumb("Undo restores the replaced block");

    await armTool("erase");
    await tapAt(finger.x, finger.y);
    const erased = await changed(original);
    ok(
      erased.length === 1 && erased[0] === key(target.pos) && !(await cells()).has(key(target.pos)),
      t(`Erase by tap removes the cursor's block (${erased.join(" ")})`),
    );
    ok((await state()).undoCount === 1, t("Erase by tap is one undo step"));
    await undoViaThumb("Undo restores the erased block");

    await armTool("eyedropper");
    await setBlock(GOLD);
    await tapAt(finger.x, finger.y);
    const pickTap = await state();
    ok(
      pickTap.block === target.block && pickTap.tool === "place" && pickTap.undoCount === 0,
      t(
        `Pick by tap chooses the cursor's block and switches to Place (${pickTap.block}, ${pickTap.tool})`,
      ),
    );
    ok((await changed(original)).length === 0, t("Pick changes no cell"));

    // A tap with no block under the cursor changes nothing.
    await armTool("place");
    await tapAt(8, 120); // the cursor is at y = 56: sky
    ok(
      (await changed(original)).length === 0 && (await state()).undoCount === 0,
      t("a tap with nothing under the cursor changes nothing"),
    );

    // =========================================================================
    // Tools that keep one-finger orbit
    // =========================================================================
    for (const id of ["navigate", "line"]) {
      await armTool(id);
      const p0 = await pose();
      const orbitFinger = await dragThrough(line({ x: 200, y: 300 }, { x: 290, y: 340 }, 4));
      await orbitFinger.end();
      await sleep(200);
      const p1 = await pose();
      ok(
        Math.abs(p1.azimuth - p0.azimuth) > 5 || Math.abs(p1.elevation - p0.elevation) > 5,
        t(
          `with ${id === "navigate" ? "View" : "Line"} one finger still orbits (azimuth ${p0.azimuth.toFixed(1)} -> ${p1.azimuth.toFixed(1)})`,
        ),
      );
      ok(
        (await changed(original)).length === 0 &&
          (await state()).undoCount === 0 &&
          (await state()).reticle === null,
        t(`${id === "navigate" ? "View" : "Line"} drag edits nothing and shows no cursor`),
      );
    }

    // Under View, a finger left down after a two-finger gesture also keeps turning the build.
    await armTool("navigate");
    await setBlock(GOLD);
    const v1 = await page.touchscreen.touchStart(140, 420);
    const v2 = await page.touchscreen.touchStart(250, 420);
    await sleep(100);
    for (let i = 1; i <= 4; i++) {
      await v1.move(140, 420 + i * 12);
      await v2.move(250, 420 + i * 12);
      await sleep(90);
    }
    await v2.end();
    await sleep(150);
    await leftoverOrbits("View, two-finger pan", v1, { x: 140, y: 420 + 4 * 12 });
    ok(
      (await changed(original)).length === 0 && (await state()).undoCount === 0,
      t("and changes no cell"),
    );
    await restoreCamera();

    // Long press under View picks the block under the finger itself.
    await armTool("navigate");
    await settleFrames();
    const fresh = await tops();
    const viewTarget = fresh.find((c) => c.block === "minecraft:stone_bricks") as Top;
    await setBlock(GOLD);
    const viewHold = await page.touchscreen.touchStart(
      Math.round(viewTarget.pt.x),
      Math.round(viewTarget.pt.y),
    );
    await sleep(750);
    await viewHold.end();
    await sleep(200);
    const viewPick = await state();
    ok(
      viewPick.block === "minecraft:stone_bricks" && viewPick.tool === "navigate",
      t(
        `a long press under View picks the block under the finger and keeps View (${viewPick.block})`,
      ),
    );
    ok((await changed(original)).length === 0, t("and changes no cell"));

    // =========================================================================
    // Cursor distance (Menu > Settings): 0 to 128 px, default 64, kept per browser
    // =========================================================================
    page.on("dialog", (d) => void d.accept()); // the unsaved-edits prompts of the reloads below
    const sliderSel = '[data-testid="cursor-offset-input"]';
    const OFFSET_KEY = "voxwright.cursoroffset";
    const openMenu = async (): Promise<void> => {
      await tapButton('[data-testid="mobile-menu-btn"]');
      await page.waitForSelector(sliderSel, { timeout: 5000 });
      await page.$eval(sliderSel, (el) => el.scrollIntoView({ block: "center" }));
      await sleep(300);
    };
    const closeMenu = async (): Promise<void> => {
      await tapButton('[data-testid="bottom-sheet-close"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="bottom-sheet"]') === null,
        { timeout: 5000 },
      );
    };
    const slider = () =>
      page.evaluate(
        (sel, storeKey) => {
          const el = document.querySelector(sel) as HTMLInputElement;
          const box = el.getBoundingClientRect();
          let stored: string | null;
          try {
            stored = localStorage.getItem(storeKey);
          } catch {
            stored = "unreadable";
          }
          return {
            value: el.value,
            min: el.min,
            max: el.max,
            step: el.step,
            label: el.getAttribute("aria-label"),
            valueText: el.getAttribute("aria-valuetext"),
            readout:
              document.querySelector('[data-testid="cursor-offset-value"]')?.textContent?.trim() ??
              null,
            title:
              document.querySelector('[data-testid="cursor-offset"] .field-label')?.textContent ??
              null,
            height: box.height,
            stored,
          };
        },
        sliderSel,
        OFFSET_KEY,
      );
    const press = async (...keys: KeyInput[]): Promise<void> => {
      await page.focus(sliderSel);
      for (const k of keys) {
        await page.keyboard.press(k);
        await sleep(40);
      }
      await sleep(120);
    };
    /** A page load that is ready for a file; a returning visit's restore prompt is discarded unless `keep`. */
    const startUp = async (keep = false): Promise<void> => {
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="status"]')
            ?.textContent?.startsWith("open a schematic"),
        { timeout: 30000 },
      );
      await sleep(600); // the prompt is offered a moment after the viewer is ready
      if (!keep && (await page.$('[data-testid="restore-dialog"][open]')) !== null) {
        await tapButton('[data-testid="discard"]');
        await page.waitForFunction(
          () => !document.querySelector('[data-testid="restore-dialog"][open]'),
        );
      }
    };
    const openFixture = async (): Promise<void> => {
      const file = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
      await file.uploadFile(join(fixtures, "Rafeals_house.nbt"));
      await page.waitForFunction(
        () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
        { timeout: 60000 },
      );
      await page.evaluate(() => window.__voxwright?.renderer.whenIdle());
    };

    // The page is where the earlier checks left it: put the camera back, Place armed.
    await restoreCamera();
    await armTool("place");
    await setBlock("minecraft:stone");
    await openMenu();
    const initial = await slider();
    ok(
      initial.value === "64" && initial.readout === "64 px" && initial.valueText === "64 px",
      t(`the Cursor distance control starts at 64 px (${initial.value}, "${initial.readout}")`),
    );
    ok(
      initial.min === "0" && initial.max === "128" && initial.step === "8",
      t(
        `it is a range from 0 to 128 in steps of 8 (${initial.min}..${initial.max} by ${initial.step})`,
      ),
    );
    ok(
      initial.label === "Cursor distance above the finger" && initial.title === "Cursor distance",
      t(`it has a visible name and an accessible label (${initial.label})`),
    );
    ok(
      initial.height >= 43.99,
      t(`the control is at least 44px tall (${initial.height.toFixed(1)}px)`),
    );
    ok(initial.stored === null, t("nothing is stored until the setting is changed"));

    await press("Home");
    const atZero = await slider();
    ok(
      atZero.value === "0" && atZero.readout === "0 px" && atZero.stored === "0",
      t(
        `Home sets 0, shows "0 px" and stores it (${atZero.value}, "${atZero.readout}", ${atZero.stored})`,
      ),
    );
    ok((await state()).cursorOffsetPx === 0, t("the open session uses the new distance at once"));
    await press("ArrowRight", "ArrowRight");
    const atSixteen = await slider();
    ok(
      atSixteen.value === "16" && atSixteen.readout === "16 px",
      t(`arrow keys move it one step of 8 (${atSixteen.value})`),
    );
    await press("End");
    ok((await slider()).readout === "128 px", t("End sets 128 px"));
    await press("Home");

    // A real touch on the track moves the thumb.
    const track = await page.$eval(sliderSel, (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top + r.height / 2, w: r.width };
    });
    await page.touchscreen.tap(Math.round(track.x + track.w * 0.75), Math.round(track.y));
    await sleep(200);
    const tapped = await slider();
    ok(
      Number(tapped.value) >= 80 && Number(tapped.value) <= 112 && tapped.stored === tapped.value,
      t(`tapping the track moves the thumb and stores the value (${tapped.value})`),
    );
    ok(
      (await state()).cursorOffsetPx === Number(tapped.value),
      t("the session follows the touch on the slider"),
    );
    await press("Home");
    await closeMenu();

    // 0: the cursor is under the finger, so a tap on a cell's top face places on that cell.
    const direct = { x: Math.round(target.pt.x), y: Math.round(target.pt.y) };
    const hold0 = await page.touchscreen.touchStart(direct.x, direct.y);
    await page.waitForFunction(() => document.querySelector(".reticle-target") !== null, {
      timeout: 5000,
    });
    const at0 = await page.evaluate(() => {
      const s = (window.__voxwright as Vox).session() as NonNullable<ReturnType<Vox["session"]>>;
      const r = document.querySelector(".reticle-target")?.getBoundingClientRect();
      return {
        touchY: s.reticle?.touchY,
        reticleY: s.reticle?.reticleY,
        cx: r ? r.left + r.width / 2 : null,
        cy: r ? r.top + r.height / 2 : null,
        stem: document.querySelector(".reticle-stem") !== null,
        hover: s.hover?.position ?? null,
      };
    });
    ok(
      at0.reticleY === at0.touchY &&
        at0.cx !== null &&
        at0.cy !== null &&
        Math.abs(at0.cx - direct.x) < 1.5 &&
        Math.abs(at0.cy - direct.y) < 1.5,
      t(
        `with distance 0 the cursor is drawn under the finger (${at0.cx?.toFixed(1)}, ${at0.cy?.toFixed(1)})`,
      ),
    );
    ok(!at0.stem, t("and no stem is drawn between the finger and the cursor"));
    ok(
      at0.hover !== null && key(at0.hover) === key(target.pos),
      t("and the outline is on the cell under the finger"),
    );
    await sleep(600); // held past the long press, the lift is neither a tap nor a stroke
    await hold0.end();
    await sleep(200);
    await setBlock("minecraft:stone"); // the long press picked the block under the cursor
    ok((await changed(original)).length === 0, t("and holding the finger there changes nothing"));
    await tapAt(direct.x, direct.y);
    const placed0 = await changed(original);
    ok(
      placed0.length === 1 && placed0[0] === key(targetAdjacent),
      t(`with distance 0 a tap places on the cell under the finger (${placed0.join(" ")})`),
    );
    await undoViaThumb("Undo removes it");

    // 128: the cursor is 128px above the finger.
    await openMenu();
    await press("End");
    ok((await state()).cursorOffsetPx === 128, t("End sets 128 and the session follows"));
    await closeMenu();
    const far = { x: Math.round(target.pt.x), y: Math.round(target.pt.y + 128) };
    const farTarget = await page.evaluate(
      (x, y) => document.elementFromPoint(x, y)?.getAttribute("data-testid") ?? null,
      far.x,
      far.y,
    );
    ok(
      farTarget === "canvas",
      t(`the finger point for distance 128 is over the canvas (${farTarget})`),
    );
    const hold128 = await page.touchscreen.touchStart(far.x, far.y);
    await page.waitForFunction(() => document.querySelector(".reticle-target") !== null, {
      timeout: 5000,
    });
    const at128 = await page.evaluate(() => {
      const r = document.querySelector(".reticle-target")?.getBoundingClientRect();
      return {
        cy: r ? r.top + r.height / 2 : null,
        stem: document.querySelector(".reticle-stem") !== null,
      };
    });
    ok(
      at128.cy !== null && Math.abs(at128.cy - target.pt.y) < 1.5 && at128.stem,
      t(
        `with distance 128 the cursor is drawn 128px above the finger, joined by a stem (${at128.cy?.toFixed(1)})`,
      ),
    );
    await sleep(600);
    await hold128.end();
    await sleep(200);
    await setBlock("minecraft:stone");
    ok((await changed(original)).length === 0, t("and holding the finger there changes nothing"));
    await tapAt(far.x, far.y);
    const placed128 = await changed(original);
    ok(
      placed128.length === 1 && placed128[0] === key(targetAdjacent),
      t(
        `with distance 128 a tap places on the cell 128px above the finger (${placed128.join(" ")})`,
      ),
    );
    await undoViaThumb("Undo removes that one too");

    // The value survives a reload, reaches the session of a restored autosave and of another file.
    await openMenu();
    await press("Home", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight");
    ok((await slider()).readout === "40 px", t("the distance is set to 40 px"));
    await closeMenu();
    await tapAt(Math.round(target.pt.x), Math.round(target.pt.y + 40));
    ok(
      (await changed(original)).join(" ") === key(targetAdjacent),
      t("with distance 40 a tap places 40px above the finger"),
    );
    await page.evaluate(() =>
      (window.__voxwright as unknown as { flushAutosave(): Promise<void> }).flushAutosave(),
    );
    await page.reload();
    await startUp(true);
    await page.waitForSelector('[data-testid="restore-dialog"][open]', { timeout: 15000 });
    await tapButton('[data-testid="restore"]');
    await page.waitForFunction(() => (window.__voxwright as Vox | undefined)?.session() != null, {
      timeout: 30000,
    });
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());
    ok(
      (await state()).cursorOffsetPx === 40 && (await cells()).has(key(targetAdjacent)),
      t(
        `after a reload the restored autosave has a session with the stored distance (${(await state()).cursorOffsetPx})`,
      ),
    );
    await openMenu();
    const reloaded = await slider();
    ok(
      reloaded.value === "40" && reloaded.readout === "40 px" && reloaded.stored === "40",
      t(
        `the control shows the stored distance after a reload (${reloaded.value}, "${reloaded.readout}")`,
      ),
    );
    await closeMenu();
    await page.evaluate(() => {
      (window as unknown as { __before: unknown }).__before = (window.__voxwright as Vox).session();
    });
    await openFixture(); // another file: the unsaved restored edit is given up (the dialog is accepted)
    const another = await page.evaluate(() => {
      const s = (window.__voxwright as Vox).session();
      return {
        fresh: s !== (window as unknown as { __before: unknown }).__before,
        offset: s?.cursorOffsetPx ?? null,
      };
    });
    ok(
      another.fresh && another.offset === 40,
      t(`opening another file starts a session with the same distance (${another.offset})`),
    );

    // A stored value that is absent, not a number or out of range falls back to 64; one off the step is rounded.
    for (const [stored, expected] of [
      ["banana", "64"],
      ["999", "64"],
      ["-8", "64"],
      ["", "64"],
      ["13", "16"],
    ] as const) {
      await page.evaluate((v, k) => localStorage.setItem(k, v), stored, OFFSET_KEY);
      await page.reload();
      await startUp();
      await openMenu();
      const got = await slider();
      ok(
        got.value === expected && got.readout === `${expected} px`,
        t(`a stored value of "${stored}" reads as ${expected} px (${got.value})`),
      );
      await closeMenu();
    }
    await page.evaluate((k) => localStorage.removeItem(k), OFFSET_KEY);
    await page.reload();
    await startUp();
    await openMenu();
    ok((await slider()).readout === "64 px", t("with nothing stored the distance is 64 px"));
    await closeMenu();

    if (values.shots) {
      await page.screenshot({ path: join(values.shots, "mobile-edit-final.png") });
    }
    ok(
      errors.length === 0,
      t(
        `no console errors throughout touch editing${errors.length ? `: ${errors.join(" | ")}` : ""}`,
      ),
    );
  } finally {
    await browser.close();
  }
}

try {
  await touchViewerSuite();
  await touchPlacementSuite();
} finally {
  server.close();
}

console.log(checks.map((c) => `  ok  ${c}`).join("\n"));
console.log(`${checks.length} checks passed`);
