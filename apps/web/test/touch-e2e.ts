// SPDX-License-Identifier: AGPL-3.0-only

// Touch-emulated end-to-end check in headless Chromium (FEAT-MB1-01):
// Serves the built site, emulates a mobile viewport (390 x 844, DPR 3, touch-enabled),
// opens the Rafeals_house fixture, verifies touch orbit, pinch zoom, and tap gestures,
// and asserts ?perf=1 telemetry overlay presence and metrics (FEAT-MB1-02).
// The second suite (MB4) edits the same fixture with real touch events: Place, Replace, Erase and
// Pick through the offset cursor, strokes, second-finger and drag-off cancels, long press.
// The third suite (MB5) makes lines, rectangles and selections by touch alone: two taps and the check
// mark, the nudge pad, the selection's face steppers, the confirm setting and the paste ghost.
// Run after `pnpm --filter @voxwright/web build`:
//
//   node test/touch-e2e.ts [--shots <dir>] [--chromium <path>] [--only viewer|placement|two-point]

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
  options: {
    shots: { type: "string" },
    chromium: { type: "string" },
    /** Run one suite only while working on it: viewer, placement or two-point. */
    only: { type: "string" },
  },
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
    // The one tool that keeps one-finger orbit: View (Line, Rectangle, Select and Paste took a
    // finger in MB5; their checks are in touchTwoPointSuite)
    // =========================================================================
    for (const id of ["navigate"]) {
      await armTool(id);
      const p0 = await pose();
      const orbitFinger = await dragThrough(line({ x: 200, y: 300 }, { x: 290, y: 340 }, 4));
      await orbitFinger.end();
      await sleep(200);
      const p1 = await pose();
      ok(
        Math.abs(p1.azimuth - p0.azimuth) > 5 || Math.abs(p1.elevation - p0.elevation) > 5,
        t(
          `with View one finger still orbits (azimuth ${p0.azimuth.toFixed(1)} -> ${p1.azimuth.toFixed(1)})`,
        ),
      );
      ok(
        (await changed(original)).length === 0 &&
          (await state()).undoCount === 0 &&
          (await state()).reticle === null,
        t("View drag edits nothing and shows no cursor"),
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

/**
 * MB5: the armed cell, the nudge pad and the two-corner tools, by touch alone. A line, a hollow
 * rectangle and a selection are made with taps, the pad, the check mark and the face steppers; the
 * cells are judged by reading the page's volume. A fresh browser, so the settings the earlier suite
 * left in local storage do not matter.
 */
export async function touchTwoPointSuite(): Promise<void> {
  const t = (what: string): string => `[touch-mb5] ${what}`;
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
    page.on("dialog", (d) => void d.accept()); // the unsaved-edits prompts of the reloads below

    // -- helpers that talk to the page (as in the placement suite) -------------------------------
    const tapButton = async (selector: string): Promise<void> => {
      await page.evaluate((sel) => {
        // The middle of its scroller: a half-height sheet is taller than the screen, so "nearest" may leave it below the fold.
        document.querySelector(sel)?.scrollIntoView({ inline: "center", block: "center" });
      }, selector);
      const el = await page.$(selector);
      const box = el === null ? null : await el.boundingBox();
      if (box === null) throw new Error(`no box for ${selector}`);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(120);
    };
    const startUp = async (): Promise<void> => {
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="status"]')
            ?.textContent?.startsWith("open a schematic"),
        { timeout: 30000 },
      );
      await sleep(600); // a returning visit's restore prompt comes a moment after the viewer is ready
      if ((await page.$('[data-testid="restore-dialog"][open]')) !== null) {
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
    const pose = (): Promise<TouchPose> =>
      page.evaluate(() =>
        (
          window.__voxwright as unknown as { renderer: { getPose(): TouchPose } }
        ).renderer.getPose(),
      );
    const worldToPage = (x: number, y: number, z: number): Promise<{ x: number; y: number }> =>
      page.evaluate(
        (a, b, c) => {
          const pt = (window.__voxwright as Vox).renderer.clientFromWorld(a, b, c);
          if (pt === null) throw new Error("point is behind the camera");
          return pt;
        },
        x,
        y,
        z,
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
    const tapAt = async (x: number, y: number): Promise<void> => {
      const finger = await page.touchscreen.touchStart(x, y);
      await sleep(50);
      await finger.end();
      await sleep(200);
    };
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
    const line = (a: { x: number; y: number }, b: { x: number; y: number }, steps: number) =>
      Array.from({ length: steps + 1 }, (_, i) => ({
        x: Math.round(a.x + ((b.x - a.x) * i) / steps),
        y: Math.round(a.y + ((b.y - a.y) * i) / steps),
      }));
    const below = (p: { x: number; y: number }): { x: number; y: number } => ({
      x: Math.round(p.x),
      y: Math.round(p.y + OFFSET),
    });
    const key = (p: readonly number[]): string => p.join(",");

    /** What the session holds, as the tests read it. */
    const mb = (): Promise<{
      tool: string;
      pending: NonNullable<SessionView["pending"]> | null;
      selection: SessionView["selection"];
      message: string;
      error: string;
      readout: string;
      undoCount: number;
      hollow: boolean;
      confirmPlacement: boolean;
      block: string;
      reticle: SessionView["reticle"];
    }> =>
      page.evaluate(() => {
        const s = (window.__voxwright as Vox).session();
        if (s === null) throw new Error("no editor session");
        return JSON.parse(
          JSON.stringify({
            tool: s.tool,
            pending: s.pending,
            selection: s.selection,
            message: s.message,
            error: s.error,
            readout: s.pendingReadout,
            undoCount: s.undoCount,
            hollow: s.hollow,
            confirmPlacement: s.confirmPlacement,
            block: s.block,
            reticle: s.reticle,
          }),
        );
      });
    const armTool = async (id: string): Promise<void> => {
      await tapButton(`[data-testid="tool-${id}"]`);
      ok((await mb()).tool === id, t(`the ${id} tool is armed from the bottom toolbar`));
    };
    /** A tap whose cursor lands on a page point; the finger must be over the canvas, not under the pad or the toolbar. */
    const tapCursorAt = async (pt: { x: number; y: number }): Promise<void> => {
      const f = below(pt);
      const over = await page.evaluate(
        (x, y) => document.elementFromPoint(x, y)?.getAttribute("data-testid") ?? null,
        f.x,
        f.y,
      );
      if (over !== "canvas") throw new Error(`the finger point ${f.x},${f.y} is over ${over}`);
      await tapAt(f.x, f.y);
    };
    const tapTop = (c: Top): Promise<void> => tapCursorAt(c.pt);
    const disabled = (sel: string): Promise<boolean> =>
      page.$eval(sel, (el) => (el as HTMLButtonElement).disabled);
    const padVisible = async (): Promise<boolean> =>
      (await page.$('[data-testid="nudge-pad"]')) !== null;
    const confirm = (): Promise<void> => tapButton('[data-testid="confirm"]');
    const cancel = (): Promise<void> => tapButton('[data-testid="cancel"]');
    const undo = (): Promise<void> => tapButton('[data-testid="undo"]');
    /** The pad's arrows as the page draws them: the world axis each moves along and its box. */
    const pad = (): Promise<
      Record<
        string,
        { axis: number; step: number; x: number; y: number; w: number; h: number; name: string }
      >
    > =>
      page.evaluate(() =>
        Object.fromEntries(
          ["away", "toward", "left", "right", "up", "down"].map((id) => {
            const el = document.querySelector(`[data-testid="nudge-${id}"]`) as HTMLElement;
            const r = el.getBoundingClientRect();
            return [
              id,
              {
                axis: Number(el.dataset.axis),
                step: Number(el.dataset.step),
                x: r.x,
                y: r.y,
                w: r.width,
                h: r.height,
                name: el.getAttribute("aria-label") ?? "",
              },
            ];
          }),
        ),
      );
    /** The arrow that moves along an axis in a direction, by the page's own data. */
    const arrowFor = async (axis: 0 | 1 | 2, step: 1 | -1): Promise<string> => {
      const found = Object.entries(await pad()).find(([, v]) => v.axis === axis && v.step === step);
      if (found === undefined) throw new Error(`no arrow moves along axis ${axis} by ${step}`);
      return found[0];
    };
    const nudge = async (axis: 0 | 1 | 2, step: 1 | -1): Promise<void> => {
      await tapButton(`[data-testid="nudge-${await arrowFor(axis, step)}"]`);
    };
    const openSheet = async (toggle: string): Promise<void> => {
      await tapButton(`[data-testid="${toggle}"]`);
      await page.waitForSelector('[data-testid="bottom-sheet"]', { timeout: 5000 });
      await sleep(350);
    };
    const closeSheet = async (): Promise<void> => {
      await tapButton('[data-testid="bottom-sheet-close"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="bottom-sheet"]') === null,
        { timeout: 5000 },
      );
    };
    const uiMessage = (): Promise<string> =>
      page.evaluate(
        () =>
          (
            document.querySelector('[data-testid="edit-message"]') ??
            document.querySelector('[data-testid="edit-error"]')
          )?.textContent?.trim() ?? "",
      );
    const readoutText = (): Promise<string> =>
      page.evaluate(
        () => document.querySelector('[data-testid="pending-readout"]')?.textContent?.trim() ?? "",
      );

    // -- setup ----------------------------------------------------------------------------------
    await page.goto(url);
    await startUp();
    await openFixture();
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
    const original = await cells();
    const all = await tops();
    const topAt = (x: number, y: number, z: number): Top => {
      const found = all.find((c) => c.pos[0] === x && c.pos[1] === y && c.pos[2] === z);
      if (found === undefined) throw new Error(`no reachable top face at ${x},${y},${z}`);
      return found;
    };
    await setBlock(GOLD); // a block no cell of the fixture holds, so every drawn cell shows as changed
    ok(home.azimuth === 45, t("the camera starts at azimuth 45"));

    // ✓ and ✕ do nothing while nothing is pending, and say so
    ok(
      (await disabled('[data-testid="confirm"]')) && (await disabled('[data-testid="cancel"]')),
      t("with nothing pending the check mark and the cross are disabled"),
    );
    ok(!(await padVisible()), t("and the nudge pad is not shown"));

    // =========================================================================
    // A 5-block line by touch alone: two taps, the check mark, one Undo
    // =========================================================================
    await armTool("line");
    const lineA = topAt(6, 7, 3);
    const lineB = topAt(6, 7, 7);
    await tapTop(lineA);
    const afterA = await mb();
    ok(
      afterA.pending?.kind === "line" &&
        key(afterA.pending.a ?? []) === "6,8,3" &&
        afterA.pending.b === null &&
        afterA.pending.active === "a",
      t(`the first tap sets corner A next to the face (${JSON.stringify(afterA.pending)})`),
    );
    ok(
      (await changed(original)).length === 0 && afterA.undoCount === 0,
      t("a tap changes no cell and adds no history entry"),
    );
    ok(await padVisible(), t("the nudge pad appears once something is pending"));
    ok(
      !(await disabled('[data-testid="confirm"]')) && !(await disabled('[data-testid="cancel"]')),
      t("and the check mark and the cross are enabled"),
    );
    ok(
      (await readoutText()).startsWith("▸A 6,8,3"),
      t(`the readout above the toolbar names corner A (${await readoutText()})`),
    );
    ok(
      (await uiMessage()) === "Corner A set at 6, 8, 3",
      t(`the message line announces it (${await uiMessage()})`),
    );
    await tapTop(lineB);
    const afterB = await mb();
    ok(
      afterB.pending?.kind === "line" &&
        key(afterB.pending.b ?? []) === "6,8,7" &&
        afterB.pending.active === "b",
      t(`the second tap sets corner B (${JSON.stringify(afterB.pending)})`),
    );
    ok(
      (await readoutText()) === "A 6,8,3 ▸B 6,8,7 · 1×1×5",
      t(`the readout shows both corners and the size (${await readoutText()})`),
    );
    ok((await changed(original)).length === 0, t("still no cell has changed"));
    await confirm();
    const lineCells = await changed(original);
    const lineAfter = await cells();
    ok(
      lineCells.join(" ") === "6,8,3 6,8,4 6,8,5 6,8,6 6,8,7" &&
        lineCells.every((k) => lineAfter.get(k) === GOLD),
      t(`the check mark draws the 5-block line, z = 3 to 7 (${lineCells.join(" ")})`),
    );
    const afterLine = await mb();
    ok(afterLine.undoCount === 1, t("the line is one undo step"));
    ok(
      afterLine.pending === null && !(await padVisible()),
      t("the pending action and the pad are gone"),
    );
    ok(
      afterLine.message === "line: 5 blocks changed",
      t(`the message line says what happened (${afterLine.message})`),
    );
    await undo();
    ok(
      (await changed(original)).length === 0 && (await mb()).undoCount === 0,
      t("one tap on Undo removes the whole line"),
    );

    // =========================================================================
    // The nudge pad: the arrows' meaning, 48px targets, names, nudging B by one, hold to repeat
    // =========================================================================
    await tapTop(lineA);
    await tapTop(lineB);
    const arrows = await pad();
    ok(
      Object.values(arrows).every((a) => a.w >= 47.99 && a.h >= 47.99),
      t(
        `the six arrows are at least 48 x 48 px (${Object.entries(arrows)
          .map(([n, a]) => `${n} ${a.w}x${a.h}`)
          .join(", ")})`,
      ),
    );
    ok(
      Object.values(arrows).every((a) => a.name.length > 3) &&
        new Set(Object.values(arrows).map((a) => a.name)).size === 6,
      t("each has its own accessible name"),
    );
    const corner = await page.$eval('[data-testid="nudge-corner"]', (el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, name: el.getAttribute("aria-label") };
    });
    ok(
      corner.w >= 47.99 && corner.h >= 47.99 && /Corner B is active/.test(corner.name ?? ""),
      t(`so does the A / B toggle (${corner.name})`),
    );
    // At azimuth 45 (a tie) away is +z and right is -x; the other four follow.
    const mapped = Object.fromEntries(
      Object.entries(arrows).map(([n, a]) => [n, `${a.axis}${a.step > 0 ? "+" : "-"}`]),
    );
    ok(
      JSON.stringify(mapped) ===
        JSON.stringify({
          away: "2+",
          toward: "2-",
          left: "0+",
          right: "0-",
          up: "1+",
          down: "1-",
        }),
      t(`at azimuth 45 the arrows are away +z, right -x, up +y (${JSON.stringify(mapped)})`),
    );
    // Turn the camera: the mapping follows it live, with the pad still open.
    await page.evaluate(() => (window.__voxwright as Vox).renderer.setOrbit({ azimuth: 90 }));
    await settleFrames();
    const turned90 = await pad();
    ok(
      turned90.away?.axis === 0 &&
        turned90.away.step === -1 &&
        turned90.right?.axis === 2 &&
        turned90.right.step === -1,
      t("with the camera turned to azimuth 90, away is -x and right is -z"),
    );
    await page.evaluate(() => (window.__voxwright as Vox).renderer.setOrbit({ azimuth: 200 }));
    await settleFrames();
    const turned200 = await pad();
    ok(
      turned200.away?.axis === 2 &&
        turned200.away.step === -1 &&
        turned200.right?.axis === 0 &&
        turned200.right.step === 1,
      t("and at azimuth 200 away is -z and right is +x"),
    );
    await restoreCamera();

    // Nudge B one cell further along the line: exactly one more cell
    await nudge(2, 1);
    const nudged = await mb();
    ok(
      key(nudged.pending?.b ?? []) === "6,8,8" && key(nudged.pending?.a ?? []) === "6,8,3",
      t(`the arrow moves corner B by one cell (${JSON.stringify(nudged.pending?.b)})`),
    );
    ok(
      (await readoutText()) === "A 6,8,3 ▸B 6,8,8 · 1×1×6" &&
        nudged.message === "Corner B moved to 6, 8, 8" &&
        (await uiMessage()) === nudged.message,
      t(`the readout and the message line follow the nudge (${await readoutText()})`),
    );
    ok((await changed(original)).length === 0, t("a nudge changes no cell"));
    await confirm();
    ok(
      (await changed(original)).length === 6 && (await mb()).undoCount === 1,
      t("nudging B by +1 makes the line 6 blocks instead of 5, still one undo step"),
    );
    await undo();
    await tapTop(lineA);
    await tapTop(lineB);
    await nudge(2, -1);
    await confirm();
    ok((await changed(original)).length === 4, t("nudging B by -1 makes it 4 blocks"));
    await undo();
    ok((await changed(original)).length === 0, t("and Undo removes it"));

    // The A / B toggle: the arrows then move corner A
    await tapTop(lineA);
    await tapTop(lineB);
    await tapButton('[data-testid="nudge-corner"]');
    ok(
      (await mb()).pending?.active === "a" &&
        (await page.$eval('[data-testid="nudge-corner"]', (el) =>
          el.getAttribute("data-corner"),
        )) === "a",
      t("the A / B toggle makes A the corner the pad moves"),
    );
    await nudge(2, -1);
    const movedA = await mb();
    ok(
      key(movedA.pending?.a ?? []) === "6,8,2" && key(movedA.pending?.b ?? []) === "6,8,7",
      t(`the arrow moves A and leaves B (${JSON.stringify(movedA.pending)})`),
    );
    await confirm();
    ok((await changed(original)).length === 6, t("A moved one cell out: the line is 6 blocks"));
    await undo();

    // Holding an arrow repeats: once at once, then after 400 ms every 100 ms, and stops on release
    await tapTop(lineA);
    await tapTop(lineB);
    const holdBox = await page.$eval(`[data-testid="nudge-${await arrowFor(2, 1)}"]`, (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const bZ = (): Promise<number> => mb().then((s) => (s.pending?.b ?? [0, 0, -1])[2] as number);
    const held = await page.touchscreen.touchStart(holdBox.x, holdBox.y);
    await sleep(250);
    ok((await bZ()) === 8, t("a press moves the corner once at once, and not again before 400 ms"));
    await sleep(1150); // about 1400 ms held: one step, then about (1400 - 400) / 100 more
    const whileHeld = await bZ();
    ok(
      whileHeld >= 12 && whileHeld <= 19,
      t(`held on it keeps moving, about every 100 ms after the first 400 (z = ${whileHeld})`),
    );
    await held.end();
    await sleep(100);
    const atRelease = await bZ();
    await sleep(500);
    ok((await bZ()) === atRelease, t("and stops when the finger lifts"));
    await cancel();
    ok((await mb()).pending === null, t("the cross cancels it"));
    ok((await changed(original)).length === 0, t("and nothing was drawn"));

    // =========================================================================
    // Dragging a corner, and a second finger during the drag
    // =========================================================================
    await tapTop(lineA);
    await tapTop(lineB);
    const p0 = await pose();
    const dragPath = line(below(lineB.pt), below(topAt(6, 7, 11).pt), 4);
    const dragger = await dragThrough(dragPath.slice(0, 4));
    const midDrag = await mb();
    ok(
      key(midDrag.pending?.b ?? []) !== "6,8,7" &&
        midDrag.reticle !== null &&
        key(midDrag.pending?.a ?? []) === "6,8,3",
      t(
        `a one-finger drag moves corner B live with the cursor (${JSON.stringify(midDrag.pending?.b)})`,
      ),
    );
    ok(
      Math.abs((await pose()).azimuth - p0.azimuth) < 0.01,
      t("and the view does not turn while it does"),
    );
    // A second finger: the corner goes back, the pending action stays, the camera takes the gesture
    const second = await page.touchscreen.touchStart(300, 560);
    await sleep(250);
    const afterSecond = await mb();
    ok(
      afterSecond.pending?.kind === "line" &&
        key(afterSecond.pending.b ?? []) === "6,8,7" &&
        key(afterSecond.pending.a ?? []) === "6,8,3",
      t(
        `a second finger puts corner B back where it was before the drag (${JSON.stringify(afterSecond.pending?.b)})`,
      ),
    );
    ok(await padVisible(), t("and the pending action, with its pad, stays"));
    await second.end();
    await dragger.end();
    await sleep(300);
    const afterBoth = await mb();
    ok(
      key(afterBoth.pending?.b ?? []) === "6,8,7" && (await changed(original)).length === 0,
      t("lifting both fingers adds nothing: no corner moved, no cell drawn"),
    );
    await restoreCamera();
    // A drag that is allowed to finish leaves the corner where the finger lifted
    const dragger2 = await dragThrough(dragPath);
    await dragger2.end();
    await sleep(300);
    const dragged = await mb();
    ok(
      key(dragged.pending?.b ?? []) === "6,8,11" &&
        key(dragged.pending?.a ?? []) === "6,8,3" &&
        dragged.reticle === null,
      t(`lifting leaves corner B where the cursor was (${JSON.stringify(dragged.pending?.b)})`),
    );
    await cancel();

    // A drag with nothing pending sets A where the finger lifts, and the view does not orbit
    const p1 = await pose();
    const startDrag = await dragThrough(line(below(lineA.pt), below(topAt(6, 7, 5).pt), 4));
    ok(
      (await mb()).pending === null,
      t("a drag before corner A exists arms nothing while it runs"),
    );
    await startDrag.end();
    await sleep(300);
    const lifted = await mb();
    ok(
      key(lifted.pending?.a ?? []) === "6,8,5" && lifted.pending?.b === null,
      t(`and sets A where the finger lifts (${JSON.stringify(lifted.pending?.a)})`),
    );
    ok(
      Math.abs((await pose()).azimuth - p1.azimuth) < 0.01 &&
        Math.abs((await pose()).elevation - p1.elevation) < 0.01,
      t("with Line armed one finger no longer orbits the view"),
    );
    await cancel();

    // =========================================================================
    // The pending action survives camera gestures
    // =========================================================================
    await tapTop(lineA);
    await tapTop(lineB);
    const pendingBefore = (await mb()).pending;
    const dist0 = (await pose()).distance;
    const g1 = await page.touchscreen.touchStart(140, 420);
    const g2 = await page.touchscreen.touchStart(250, 420);
    await sleep(100);
    for (let i = 1; i <= 4; i++) {
      await g1.move(140 - i * 15, 420);
      await g2.move(250 + i * 15, 420);
      await sleep(90);
    }
    ok((await pose()).distance < dist0 * 0.8, t("a pinch zooms the view while a line is pending"));
    await g2.end();
    await sleep(150);
    // The finger left down orbits (from where it is) and still leaves the pending action alone
    const azBefore = (await pose()).azimuth;
    await g1.move(140 - 60 + 40, 420 + 30);
    await sleep(120);
    await g1.move(140 - 60 + 90, 420 + 40);
    await sleep(150);
    await g1.end();
    await sleep(250);
    ok(
      Math.abs((await pose()).azimuth - azBefore) > 2,
      t("the finger left down after the pinch turns the view"),
    );
    const afterPinch = await mb();
    ok(
      JSON.stringify(afterPinch.pending) === JSON.stringify(pendingBefore) &&
        (await padVisible()) &&
        !(await disabled('[data-testid="confirm"]')),
      t("the pinch and the orbit left the pending action, the pad and the check mark as they were"),
    );
    const t1 = await page.touchscreen.touchStart(140, 420);
    const t2 = await page.touchscreen.touchStart(250, 420);
    await sleep(100);
    const panPose = await pose();
    for (let i = 1; i <= 4; i++) {
      await t1.move(140, 420 + i * 12);
      await t2.move(250, 420 + i * 12);
      await sleep(90);
    }
    await t2.end();
    await t1.end();
    await sleep(250);
    const panned = await pose();
    ok(
      Math.hypot(...(panned.position.map((v, i) => v - (panPose.position[i] as number)) as Vec3)) >
        0.1,
      t("a two-finger pan moves the view"),
    );
    ok(
      JSON.stringify((await mb()).pending) === JSON.stringify(pendingBefore),
      t("and the pending action is still the same"),
    );
    await restoreCamera();
    // The corners are the same cells after the camera came back: the confirm draws the same line
    await confirm();
    ok(
      (await changed(original)).length === 5 && (await mb()).undoCount === 1,
      t("and its confirm still draws the 5-block line"),
    );
    await undo();

    // Switching tool clears it
    await tapTop(lineA);
    await armTool("rectangle");
    ok(
      (await mb()).pending === null && !(await padVisible()),
      t("switching tool clears the pending action"),
    );

    // =========================================================================
    // A hollow 4 x 3 rectangle: taps, the Hollow toggle, the check mark
    // =========================================================================
    await tapTop(lineA); // corner A next to the ridge: (6, 8, 3), plane y = 8
    const rectState = await mb();
    ok(
      rectState.pending?.kind === "rectangle" &&
        key(rectState.pending.a ?? []) === "6,8,3" &&
        rectState.pending.axis === 1,
      t(`the first tap sets corner A and the plane (${JSON.stringify(rectState.pending)})`),
    );
    const hollowOn = (): Promise<boolean> =>
      page.$eval(
        '[data-testid="nudge-hollow"]',
        (el) => el.getAttribute("aria-pressed") === "true",
      );
    ok(
      (await page.$('[data-testid="nudge-hollow"]')) !== null,
      t("a rectangle's pad has a Hollow toggle"),
    );
    ok(!(await hollowOn()), t("which starts off"));
    await tapButton('[data-testid="nudge-hollow"]');
    ok((await mb()).hollow && (await hollowOn()), t("and turns the hollow setting on"));
    // B over empty space on A's plane: cell (9, 8, 5), the far corner of a 4 x 3 rectangle
    const rectBPt = await worldToPage(9.5, 8, 5.5);
    await tapCursorAt(rectBPt);
    const rectB = await mb();
    ok(
      key(rectB.pending?.b ?? []) === "9,8,5",
      t(
        `the second tap sets B on A's plane, over empty space (${JSON.stringify(rectB.pending?.b)})`,
      ),
    );
    ok(
      (await readoutText()) === "A 6,8,3 ▸B 9,8,5 · 4×1×3",
      t(`the readout says 4 x 1 x 3 (${await readoutText()})`),
    );
    await confirm();
    const rectCells = await changed(original);
    const outline = new Set<string>();
    for (let x = 6; x <= 9; x++)
      for (let z = 3; z <= 5; z++)
        if (x === 6 || x === 9 || z === 3 || z === 5) outline.add(`${x},8,${z}`);
    ok(
      outline.size === 10 && rectCells.length === 10 && rectCells.every((k) => outline.has(k)),
      t(`the hollow 4 x 3 rectangle is its 10-cell outline (${rectCells.join(" ")})`),
    );
    const hollowCells = await cells();
    ok(!hollowCells.has("7,8,4") && !hollowCells.has("8,8,4"), t("and its inside is empty"));
    ok((await mb()).undoCount === 1, t("it is one undo step"));
    await undo();
    ok((await changed(original)).length === 0, t("one tap on Undo removes it"));

    // Nudging the whole rectangle along its normal: one layer up
    await tapTop(lineA);
    await tapCursorAt(rectBPt);
    await nudge(1, 1);
    const lifted2 = await mb();
    ok(
      key(lifted2.pending?.a ?? []) === "6,9,3" && key(lifted2.pending?.b ?? []) === "9,9,5",
      t(
        `an Up nudge moves both corners one layer (${JSON.stringify([lifted2.pending?.a, lifted2.pending?.b])})`,
      ),
    );
    await nudge(0, 1);
    ok(
      key((await mb()).pending?.b ?? []) === "10,9,5" &&
        key((await mb()).pending?.a ?? []) === "6,9,3",
      t("a sideways nudge moves one corner only: the rectangle stays flat"),
    );
    await confirm();
    const risen = await changed(original);
    ok(
      risen.length === 12 && risen.every((k) => k.split(",")[1] === "9"),
      t(`the hollow 5 x 3 rectangle is on layer 9: its 12-cell outline (${risen.length} cells)`),
    );
    await undo();
    // Hollow off: a filled rectangle
    await tapTop(lineA);
    await tapButton('[data-testid="nudge-hollow"]');
    ok(!(await mb()).hollow, t("the Hollow toggle turns it off again"));
    await tapCursorAt(rectBPt);
    await confirm();
    ok(
      (await changed(original)).length === 12,
      t("with Hollow off the rectangle is filled: 12 cells"),
    );
    await undo();

    // =========================================================================
    // A 3 x 3 x 3 selection: two taps, then the face steppers
    // =========================================================================
    await armTool("select");
    await tapTop(topAt(6, 7, 3));
    const selA = await mb();
    ok(
      selA.pending?.kind === "select" && key(selA.pending.a ?? []) === "6,7,3",
      t(`Select's first tap uses the block itself (${JSON.stringify(selA.pending?.a)})`),
    );
    await tapTop(topAt(6, 7, 5));
    const selB = await mb();
    ok(
      key(selB.pending?.b ?? []) === "6,7,5" &&
        key(selB.selection?.min ?? []) === "6,7,3" &&
        key(selB.selection?.max ?? []) === "6,7,5",
      t("the second tap sets B and the selection box is drawn between them"),
    );
    await confirm();
    ok(
      (await mb()).message === "Selected 1 × 1 × 3" && (await mb()).pending === null,
      t(`the check mark selects them (${(await mb()).message})`),
    );
    ok((await mb()).undoCount === 0, t("a selection is not an edit: no undo step"));
    await openSheet("mobile-selection-toggle");
    const sizeText = (): Promise<string> =>
      page.$eval('[data-testid="selection-size"]', (el) => el.textContent?.trim() ?? "");
    ok(
      (await sizeText()) === "1 × 1 × 3 blocks",
      t(`the selection sheet reads the size (${await sizeText()})`),
    );
    const stepper = await page.$$eval('[data-testid="face-steppers"] button', (els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height, name: el.getAttribute("aria-label") ?? "" };
      }),
    );
    ok(
      stepper.length === 12 && stepper.every((b) => b.w >= 47.99 && b.h >= 47.99 && b.name !== ""),
      t(`there are 12 steppers, two per face, each 48px with a name (${stepper.length})`),
    );
    const stepperNames = new Set(stepper.map((b) => b.name));
    ok(
      ["west", "east", "bottom", "top", "north", "south"].every(
        (f) =>
          stepperNames.has(`Grow the ${f} face by one block`) &&
          stepperNames.has(`Shrink the ${f} face by one block`),
      ),
      t("named Grow / Shrink for West, East, Bottom, Top, North and South"),
    );
    const tapStep = (id: string): Promise<void> => tapButton(`[data-testid="${id}"]`);
    await tapStep("face-west-grow");
    await tapStep("face-east-grow");
    ok(
      (await sizeText()) === "3 × 1 × 3 blocks",
      t(`West +1 and East +1 make it 3 wide (${await sizeText()})`),
    );
    await tapStep("face-top-grow");
    ok((await sizeText()) === "3 × 2 × 3 blocks", t("Top +1 adds a layer above"));
    await tapStep("face-top-grow");
    ok((await sizeText()) === "3 × 3 × 3 blocks", t("and another: 3 x 3 x 3"));
    const sel3 = (await mb()).selection;
    ok(
      sel3 !== null && key(sel3.min) === "5,7,3" && key(sel3.max) === "7,9,5",
      t(`the selection box is x 5-7, y 7-9, z 3-5 (${JSON.stringify(sel3)})`),
    );
    ok(
      (await mb()).undoCount === 0 && (await changed(original)).length === 0,
      t("the steppers are not undo steps and change no cell"),
    );
    await tapStep("face-bottom-shrink");
    await tapStep("face-north-shrink");
    ok(
      (await sizeText()) === "3 × 2 × 2 blocks",
      t(`-1 takes a layer off a face (${await sizeText()}; ${(await mb()).error})`),
    );
    await tapStep("face-bottom-grow");
    await tapStep("face-north-grow");
    ok((await sizeText()) === "3 × 3 × 3 blocks", t("and +1 puts it back: 3 x 3 x 3 again"));
    // A face cannot pass the opposite one
    await tapStep("face-south-shrink");
    await tapStep("face-south-shrink");
    ok((await sizeText()) === "3 × 3 × 1 blocks", t("two Shrinks leave one layer"));
    await tapStep("face-south-shrink");
    ok(
      (await sizeText()) === "3 × 3 × 1 blocks" && /at least one block/.test((await mb()).error),
      t(`and no further: a face cannot pass the opposite one (${(await mb()).error})`),
    );
    await tapStep("face-south-grow");
    await tapStep("face-south-grow");
    ok((await sizeText()) === "3 × 3 × 3 blocks", t("back to 3 x 3 x 3"));

    // Copy it and paste it: the paste ghost
    await tapButton('[data-testid="copy"]');
    ok(
      (await mb()).message.startsWith("Copied"),
      t(`Copy takes the selection (${(await mb()).message})`),
    );
    await tapButton('[data-testid="paste"]');
    ok((await mb()).tool === "paste", t("Paste arms the paste tool"));
    await closeSheet();
    const clipCells = await page.evaluate(
      () => (window.__voxwright as Vox).session()?.clipboardCells ?? 0,
    );
    ok(clipCells > 0, t(`the clipboard holds ${clipCells} blocks`));
    const source = new Map<string, string>();
    for (const [k, v] of await cells()) {
      const [x, y, z] = k.split(",").map(Number) as Vec3;
      if (x >= 5 && x <= 7 && y >= 7 && y <= 9 && z >= 3 && z <= 5)
        source.set(`${x - 5},${y - 7},${z - 3}`, v);
    }
    ok(source.size === clipCells, t(`it is the non-air blocks of that box (${source.size})`));
    await tapTop(topAt(11, 7, 6)); // the paste origin is the cell next to the face: (11, 8, 6)
    const pasteState = await mb();
    ok(
      pasteState.pending?.kind === "paste" && key(pasteState.pending.at ?? []) === "11,8,6",
      t(`a tap arms the paste origin (${JSON.stringify(pasteState.pending)})`),
    );
    ok(
      (await readoutText()) === "Paste at 11,8,6 · 3×3×3" && (await padVisible()),
      t(`the readout names the origin and the size, and the pad is shown (${await readoutText()})`),
    );
    ok((await changed(original)).length === 0, t("nothing is pasted yet"));
    await nudge(1, 1);
    await nudge(2, 1);
    const pasteMoved = await mb();
    ok(
      key(pasteMoved.pending?.at ?? []) === "11,9,7",
      t(`the pad moves the origin (${JSON.stringify(pasteMoved.pending?.at)})`),
    );
    await confirm();
    const pasted = await changed(original);
    const nowCells = await cells();
    const expectedPaste = new Set(
      [...source.keys()].map((k) => {
        const [x, y, z] = k.split(",").map(Number) as Vec3;
        return `${x + 11},${y + 9},${z + 7}`;
      }),
    );
    ok(
      pasted.length === expectedPaste.size &&
        pasted.every((k) => expectedPaste.has(k)) &&
        [...source].every(([k, v]) => {
          const [x, y, z] = k.split(",").map(Number) as Vec3;
          return nowCells.get(`${x + 11},${y + 9},${z + 7}`) === v;
        }),
      t(`the check mark pastes the copied blocks at the nudged origin (${pasted.length} cells)`),
    );
    ok(
      (await mb()).undoCount === 1 && (await mb()).pending === null,
      t("the paste is one undo step"),
    );
    await undo();
    ok((await changed(original)).length === 0, t("and one Undo removes it"));
    // Cancel pastes nothing
    await page.evaluate(() => (window.__voxwright as Vox).session()?.setTool("paste"));
    await tapTop(topAt(11, 7, 6));
    ok((await mb()).pending?.kind === "paste", t("a tap arms the paste origin again"));
    await cancel();
    ok(
      (await changed(original)).length === 0 && (await mb()).pending === null,
      t("the cross pastes nothing"),
    );

    // =========================================================================
    // Limits: a nudge outside the visible layers is refused with a message
    // =========================================================================
    await armTool("line");
    await tapTop(lineA);
    await page.evaluate(() => (window.__voxwright as Vox).session()?.setSlice({ y0: 0, y1: 8 }));
    await nudge(1, 1);
    const refused = await mb();
    ok(
      key(refused.pending?.a ?? []) === "6,8,3" && /Layer 9.*0 to 8/.test(refused.error),
      t(`a step above the top visible layer is refused, nothing moves (${refused.error})`),
    );
    ok((await uiMessage()) === refused.error, t("and the message line shows why"));
    await page.evaluate(() => (window.__voxwright as Vox).session()?.setSlice(null));
    await cancel();

    // =========================================================================
    // Left-handed: the pad mirrors with the thumb cluster
    // =========================================================================
    await tapTop(lineA);
    const clusterBox = (): Promise<{ x: number; right: number; y: number }> =>
      page.$eval('[data-testid="thumb-cluster"]', (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, right: r.right, y: r.y };
      });
    const padBox = (): Promise<{ x: number; right: number; y: number; bottom: number }> =>
      page.$eval('[data-testid="nudge-pad"]', (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, right: r.right, y: r.y, bottom: r.bottom };
      });
    const rh = { cluster: await clusterBox(), pad: await padBox() };
    ok(
      rh.pad.right <= rh.cluster.x && rh.cluster.x > 195,
      t(
        `right-handed: the pad is left of the thumb cluster, not overlapping it (pad ${Math.round(rh.pad.x)}-${Math.round(rh.pad.right)}, cluster from ${Math.round(rh.cluster.x)})`,
      ),
    );
    await cancel();
    const toggleLeftHanded = async (): Promise<void> => {
      await tapButton('[data-testid="mobile-menu-btn"]');
      await page.waitForSelector('[data-testid="left-handed-toggle"] input', { timeout: 5000 });
      await page.$eval('[data-testid="left-handed-toggle"] input', (el) =>
        el.scrollIntoView({ block: "center" }),
      );
      await sleep(300);
      await tapButton('[data-testid="left-handed-toggle"] input');
      await closeSheet();
    };
    await toggleLeftHanded();
    await tapTop(lineA);
    const lh = { cluster: await clusterBox(), pad: await padBox() };
    ok(
      lh.pad.x >= lh.cluster.right && lh.cluster.right < 195 && lh.pad.right < 390,
      t(
        `left-handed: the pad is right of the thumb cluster on the left (pad ${Math.round(lh.pad.x)}-${Math.round(lh.pad.right)}, cluster to ${Math.round(lh.cluster.right)})`,
      ),
    );
    const lhArrows = await pad();
    ok(
      Object.values(lhArrows).every((a) => a.w >= 47.99 && a.h >= 47.99),
      t("and the arrows are still at least 48 x 48 px"),
    );
    // Neither the pad nor the thumb cluster covers the readout line or the toolbar
    const toolbarTop = await page.$eval(
      '[data-testid="bottom-toolbar"]',
      (el) => el.getBoundingClientRect().top,
    );
    ok(
      lh.pad.bottom <= toolbarTop && lh.cluster.y + 104 <= toolbarTop,
      t("and neither the pad nor the thumb cluster covers the readout line above the toolbar"),
    );
    await cancel();
    await toggleLeftHanded();

    // =========================================================================
    // Confirm each placement (Menu > Settings): off by default, kept per browser
    // =========================================================================
    const CONFIRM_KEY = "voxwright.confirmplace";
    const confirmBox = '[data-testid="confirm-place-toggle"] input';
    const stored = (): Promise<string | null> =>
      page.evaluate((k) => localStorage.getItem(k), CONFIRM_KEY);
    const openMenu = async (): Promise<void> => {
      await tapButton('[data-testid="mobile-menu-btn"]');
      await page.waitForSelector(confirmBox, { timeout: 5000 });
      await page.$eval(confirmBox, (el) => el.scrollIntoView({ block: "center" }));
      await sleep(300);
    };
    await openMenu();
    const label = await page.$eval('[data-testid="confirm-place-toggle"]', (el) =>
      el.textContent?.trim(),
    );
    const checkBoxHeight = await page.$eval(
      '[data-testid="confirm-place-toggle"]',
      (el) => el.getBoundingClientRect().height,
    );
    ok(
      label === "Confirm each placement",
      t(`the Settings section has a "Confirm each placement" checkbox (${label})`),
    );
    ok(checkBoxHeight >= 43.99, t(`it is at least 44px tall (${checkBoxHeight})`));
    ok(
      !(await page.$eval(confirmBox, (el) => (el as HTMLInputElement).checked)) &&
        (await stored()) === null &&
        !(await mb()).confirmPlacement,
      t("it starts off, and nothing is stored until it is changed"),
    );
    await tapButton(confirmBox);
    ok(
      (await page.$eval(confirmBox, (el) => (el as HTMLInputElement).checked)) &&
        (await stored()) === "true" &&
        (await mb()).confirmPlacement,
      t("turning it on stores it and the open session follows at once"),
    );
    await closeSheet();

    // Place: a tap arms the cell, the pad nudges it, the check mark places exactly one block
    await armTool("place");
    await setBlock(GOLD);
    const placeTarget = topAt(6, 7, 6);
    await tapTop(placeTarget);
    const armed = await mb();
    ok(
      armed.pending?.kind === "cell" &&
        armed.pending.tool === "place" &&
        key(armed.pending.cell ?? []) === "6,8,6",
      t(`with the setting on a Place tap only arms the cell (${JSON.stringify(armed.pending)})`),
    );
    ok(
      (await changed(original)).length === 0 && armed.undoCount === 0 && (await padVisible()),
      t("nothing is placed, and the pad is shown"),
    );
    ok(
      (await readoutText()) === "Place 6,8,6 gold_block",
      t(`the readout names the cell and the block (${await readoutText()})`),
    );
    ok(
      (await page.$('[data-testid="nudge-corner"]')) === null,
      t("a single cell has no A / B toggle"),
    );
    await nudge(1, 1);
    await confirm();
    ok(
      (await changed(original)).join(" ") === "6,9,6" && (await cells()).get("6,9,6") === GOLD,
      t(
        `the check mark places one block, at the nudged cell (${(await changed(original)).join(" ")})`,
      ),
    );
    ok((await mb()).undoCount === 1, t("as one undo step"));
    await undo();
    // The cross places none
    await tapTop(placeTarget);
    await cancel();
    ok(
      (await changed(original)).length === 0 &&
        (await mb()).pending === null &&
        (await mb()).undoCount === 0,
      t("the cross places none"),
    );
    // A drag paints nothing; the lift arms the cell under the cursor
    const sweep = await dragThrough(line(below(topAt(6, 7, 3).pt), below(topAt(6, 7, 7).pt), 4));
    ok(
      (await changed(original)).length === 0,
      t("a drag in confirm mode paints nothing while it runs"),
    );
    await sweep.end();
    await sleep(300);
    const lifted3 = await mb();
    ok(
      (await changed(original)).length === 0 &&
        lifted3.pending?.kind === "cell" &&
        key(lifted3.pending.cell ?? []) === "6,8,7",
      t(`and the lift arms the cell under the cursor (${JSON.stringify(lifted3.pending)})`),
    );
    await cancel();
    // Replace and Erase wait too
    await armTool("paint");
    await tapTop(placeTarget);
    ok(
      (await changed(original)).length === 0 &&
        (await readoutText()).startsWith("Replace 6,7,6 stone_bricks"),
      t(`Replace arms the block under the cursor (${await readoutText()})`),
    );
    await confirm();
    ok(
      (await changed(original)).join(" ") === "6,7,6" && (await cells()).get("6,7,6") === GOLD,
      t("and the check mark replaces it"),
    );
    await undo();
    await armTool("erase");
    await tapTop(placeTarget);
    await confirm();
    ok(
      (await changed(original)).join(" ") === "6,7,6" && !(await cells()).has("6,7,6"),
      t("Erase waits for the check mark, then removes the block"),
    );
    await undo();
    // Long press still picks without touching the armed cell
    await armTool("place");
    await tapTop(placeTarget);
    const armedBefore = (await mb()).pending;
    const f = below(topAt(6, 7, 4).pt);
    const hold = await page.touchscreen.touchStart(f.x, f.y);
    await sleep(750);
    await hold.end();
    await sleep(250);
    const afterHold = await mb();
    ok(
      afterHold.block === topAt(6, 7, 4).block &&
        JSON.stringify(afterHold.pending) === JSON.stringify(armedBefore),
      t(`a long press picks the block (${afterHold.block}) and leaves the armed cell`),
    );
    await cancel();
    await setBlock(GOLD);

    // The setting survives a reload and reaches a new session
    await page.reload();
    await startUp();
    await openFixture();
    ok(
      (await mb()).confirmPlacement,
      t("after a reload a new session starts with Confirm each placement on"),
    );
    await openMenu();
    ok(
      await page.$eval(confirmBox, (el) => (el as HTMLInputElement).checked),
      t("and the checkbox shows it"),
    );
    // Off again: back to MB4's behaviour (a tap places at once)
    await tapButton(confirmBox);
    ok(
      !(await page.$eval(confirmBox, (el) => (el as HTMLInputElement).checked)) &&
        (await stored()) === "false" &&
        !(await mb()).confirmPlacement,
      t("turning it off stores false and the session follows"),
    );
    await closeSheet();
    await restoreCamera();
    const fresh = await cells();
    await armTool("place");
    await setBlock(GOLD);
    await tapTop(placeTarget);
    ok(
      (await changed(fresh)).join(" ") === "6,8,6" &&
        (await mb()).pending === null &&
        (await mb()).undoCount === 1,
      t("with it off a tap places at once, as in MB4"),
    );
    await undo();
    await page.reload();
    await startUp();
    await openFixture();
    ok(!(await mb()).confirmPlacement, t("and after a reload it stays off"));

    if (values.shots) {
      await page.screenshot({ path: join(values.shots, "mobile-two-point-final.png") });
    }
    ok(
      errors.length === 0,
      t(
        `no console errors throughout the two-corner run${errors.length ? `: ${errors.join(" | ")}` : ""}`,
      ),
    );
  } finally {
    await browser.close();
  }
}

try {
  if (values.only === undefined || values.only === "viewer") await touchViewerSuite();
  if (values.only === undefined || values.only === "placement") await touchPlacementSuite();
  if (values.only === undefined || values.only === "two-point") await touchTwoPointSuite();
} finally {
  server.close();
}

console.log(checks.map((c) => `  ok  ${c}`).join("\n"));
console.log(`${checks.length} checks passed`);
