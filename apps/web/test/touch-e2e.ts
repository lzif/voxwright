// SPDX-License-Identifier: AGPL-3.0-only

// Touch-emulated end-to-end check in headless Chromium (FEAT-MB1-01):
// Serves the built site, emulates a mobile viewport (390 x 844, DPR 3, touch-enabled),
// opens the Rafeals_house fixture, verifies touch orbit, pinch zoom, and tap gestures,
// and asserts ?perf=1 telemetry overlay presence and metrics (FEAT-MB1-02).
// Run after `pnpm --filter @voxwright/web build`:
//
//   node test/touch-e2e.ts [--shots <dir>] [--chromium <path>]

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import puppeteer, { type CDPSession, type ElementHandle } from "puppeteer-core";
import { chromiumArgs, findChromium, serveSite } from "./site.ts";
import type { Pose, Vox } from "./vox.ts";

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
        searchBox.height >= 44,
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

try {
  await touchViewerSuite();
} finally {
  server.close();
}

console.log(checks.map((c) => `  ok  ${c}`).join("\n"));
console.log(`${checks.length} checks passed`);
