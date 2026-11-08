// SPDX-License-Identifier: AGPL-3.0-only

// Touch-emulated end-to-end check in headless Chromium (FEAT-MB1-01):
// Serves the built site, emulates a mobile viewport (390 x 844, DPR 3, touch-enabled),
// opens the Rafeals_house fixture, verifies touch orbit, pinch zoom, and tap gestures,
// and asserts ?perf=1 telemetry overlay presence and metrics (FEAT-MB1-02).
// The second suite (MB4) edits the same fixture with real touch events: Place, Replace, Erase and
// Pick through the offset cursor, strokes, second-finger and drag-off cancels, long press.
// The third suite (MB5) makes lines, rectangles and selections by touch alone: two taps and the check
// mark, the nudge pad, the selection's face steppers, the confirm setting and the paste ghost.
// The fourth suite (MB6) inspects blocks by tap, changes their state through chips and switches,
// works the selection sheet and its move pad, and exercises the hotbar; its exit check is a whole
// edit session by touch whose exported file equals the same edits made through the desktop path.
// The fifth suite (camera conveniences) checks double tap to focus, Zoom in here on the nudge pad, and
// the two-finger twist with its setting.
// The sixth suite (MB7) checks the Quality setting, dynamic resolution while a gesture moves the view,
// and the limits of a touch-only device (two mesher workers, a 16 MB undo history).
// The seventh suite (MB8) checks the undo toast, haptics, the optional multi-finger shortcuts, the
// left-handed mirror, the first-run walkthrough, the buttons that stand in for gestures, the touch help,
// and axe-core on the whole page in every mobile state, with the focus order of the sheets.
// Run after `pnpm --filter @voxwright/web build`:
//
//   node test/touch-e2e.ts [--shots <dir>] [--chromium <path>]
//     [--only viewer|placement|two-point|selection-state|camera|quality|polish]

import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { readLitematic, type Volume } from "@voxwright/core";
import puppeteer, {
  type Browser,
  type CDPSession,
  type ElementHandle,
  type KeyInput,
  type Page,
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
    /** Run one suite only while working on it: viewer, placement, two-point, selection-state, camera, quality or polish. */
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

/**
 * A page of `browser` on which the mobile layout's first-run card (MB8) is marked as seen before the
 * page's own scripts run, so it does not sit over the picture in the suites that are about something
 * else. The `polish` suite opens its pages with plain `browser.newPage()` to see the card.
 */
async function newPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    try {
      if (localStorage.getItem("voxwright.touchintro") === null) {
        localStorage.setItem("voxwright.touchintro", "done");
      }
    } catch {
      // storage blocked: nothing to mark
    }
  });
  return page;
}

/**
 * Makes `navigator.hardwareConcurrency` read `cores` on every document of `page` (reloads included),
 * so a check on the mesher worker count says the same on a 2-core CI runner as on a big machine.
 * The renderer's default is `cores - 1` clamped to 1..4 and a touch-only page caps it at 2.
 */
async function pinCores(page: Page, cores: number): Promise<void> {
  await page.evaluateOnNewDocument((n) => {
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { get: () => n });
  }, cores);
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

/**
 * Helper: two fingers on opposite sides of `center` turn like a dial by `degrees` (positive:
 * clockwise on the screen) while their distance goes from `2 * radius` to `2 * endRadius`. The
 * coordinates are fractional: rounding them would add a pinch of a pixel or two to every step. The
 * last event releases every finger with an empty list: listing the fingers there leaves a touch
 * behind in Chromium's emulation, and the next tap of the test then produces no click.
 */
export async function cdpTwist(
  cdp: CDPSession,
  center: { x: number; y: number },
  radius: number,
  degrees: number,
  steps = 12,
  endRadius = radius,
): Promise<void> {
  const RAD = Math.PI / 180;
  const fingers = (deg: number, r: number) => [
    { x: center.x + Math.cos(deg * RAD) * r, y: center.y + Math.sin(deg * RAD) * r, id: 1 },
    { x: center.x - Math.cos(deg * RAD) * r, y: center.y - Math.sin(deg * RAD) * r, id: 2 },
  ];
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: fingers(0, radius),
  });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: fingers((degrees * i) / steps, radius + ((endRadius - radius) * i) / steps),
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
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
    const page = await newPage(browser);
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
    const desktopPage = await newPage(browser);
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
    const perfPage = await newPage(browser);
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
    const page = await newPage(browser);
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
    const page = await newPage(browser);
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
      corner.w >= 47.99 && corner.h >= 47.99 && /^A B: corner B is active/.test(corner.name ?? ""),
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
      ["west", "east", "bottom", "top", "north", "south"].every((f) => {
        const label = f[0]?.toUpperCase() + f.slice(1);
        return (
          stepperNames.has(`+1 ${label}: grow the ${f} face by one block`) &&
          stepperNames.has(`−1 ${label}: shrink the ${f} face by one block`)
        );
      }),
      t(
        "named +1 / −1 and the face first, then Grow / Shrink, for West, East, Bottom, Top, North and South",
      ),
    );
    ok(
      stepper.every((b, i) => b.name.startsWith(i % 2 === 0 ? "+1" : "−1")) &&
        (await page.$$eval('[data-testid="face-steppers"] button', (els) =>
          els.every((el, i) => (el.textContent ?? "").trim() === (i % 2 === 0 ? "+1" : "−1")),
        )),
      t("each accessible name starts with the visible text of its button (WCAG 2.5.3)"),
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
    // MB6: Paste also closes the sheet, so the picture is free for the tap (it used to stay open)
    await page.waitForFunction(
      () => document.querySelector('[data-testid="bottom-sheet"]') === null,
      { timeout: 5000 },
    );
    ok(true, t("and closes the selection sheet, so the picture is free for the tap"));
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

const axeSource = readFileSync(
  createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
  "utf8",
);

const AIR_BLOCK = "minecraft:air";
/** Block strings of every cell that holds something other than air, as "x,y,z" to block. */
function cellsOf(volume: Volume): Map<string, string> {
  const out = new Map<string, string>();
  volume.eachCell((x, y, z, idx) => {
    const block = volume.palette[idx] as string;
    if (block !== AIR_BLOCK) out.set(`${x},${y},${z}`, block);
  });
  return out;
}

/** The coordinates whose block differs between two snapshots. */
function diff(a: Map<string, string>, b: Map<string, string>): string[] {
  const keys = new Set([...a.keys(), ...b.keys()]);
  return [...keys].filter((k) => a.get(k) !== b.get(k)).sort();
}

/**
 * MB6: selection actions and block state by touch. One mobile page walks the pieces (tap to inspect
 * in View, the state sheet, the selection sheet and its move pad, the hotbar), then the exit
 * criterion: a box is selected, filled, copied, pasted, rotated, a stairs block's facing and a
 * door's open state are changed, and the file exported, all by touch (typing only in the palette's
 * search); a second, desktop-layout page makes the same edits through the session API and the
 * mouse and exports too, and the two downloaded files must hold exactly the same cells.
 */
export async function touchSelectionStateSuite(): Promise<void> {
  const t = (what: string): string => `[touch-mb6] ${what}`;
  const downloads = await mkdtemp(join(tmpdir(), "voxwright-mb6-"));
  const browser = await puppeteer.launch({
    executablePath: chromium,
    headless: true,
    args: chromiumArgs(true),
  });
  const DOOR = "minecraft:oak_door[facing=north,half=lower,hinge=left,open=false,powered=false]";
  const SIGN = "minecraft:oak_sign[rotation=3,waterlogged=false]";
  const RECENT_KEY = "voxwright.recentblocks";
  const FAVORITE_KEY = "voxwright.favoriteblocks";
  /** The edits of the exit criterion, as cells; both paths use the same ones. */
  const BOX_A: Vec3 = [6, 7, 3];
  const BOX_B: Vec3 = [6, 7, 5];
  const PASTE_ON: Vec3 = [11, 7, 6]; // the paste tool puts the origin next to the face tapped: (11, 8, 6)
  const STAIRS_AT: Vec3 = [3, 6, 5];
  const DOOR_ON: Vec3 = [10, 4, 2]; // a tap with Place puts the door above this block: (10, 5, 2)
  const DOOR_AT: Vec3 = [10, 5, 2];
  try {
    const page = await newPage(browser);
    await page.setViewport(MOBILE_VIEWPORT);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("dialog", (d) => void d.accept()); // the unsaved-edits prompts of the reloads below
    const cdp = await page.createCDPSession();
    const mobileDownloads = join(downloads, "mobile");
    await mkdir(mobileDownloads);
    await cdp.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: mobileDownloads,
      eventsEnabled: true,
    });

    // -- helpers that talk to the page (as in the other suites) ---------------------------------
    const tapButton = async (selector: string): Promise<void> => {
      await page.evaluate((sel) => {
        document.querySelector(sel)?.scrollIntoView({ inline: "center", block: "center" });
      }, selector);
      const el = await page.$(selector);
      const box = el === null ? null : await el.boundingBox();
      if (box === null) throw new Error(`no box for ${selector}`);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(150);
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
    const cellAt = (p: readonly number[]): Promise<string | undefined> =>
      page.evaluate(
        (x, y, z) => (window.__voxwright as Vox).volume().get(x, y, z),
        p[0] as number,
        p[1] as number,
        p[2] as number,
      );
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
    const below = (p: { x: number; y: number }): { x: number; y: number } => ({
      x: Math.round(p.x),
      y: Math.round(p.y + OFFSET),
    });
    const key = (p: readonly number[]): string => p.join(",");

    /** What the session holds, as the tests read it. */
    const mb = (): Promise<{
      tool: string;
      block: string;
      inspected: Vec3 | null;
      inspectedBlock: string | null;
      pending: NonNullable<SessionView["pending"]> | null;
      selection: SessionView["selection"];
      message: string;
      error: string;
      undoCount: number;
      clipboardCells: number;
    }> =>
      page.evaluate(() => {
        const s = (window.__voxwright as Vox).session();
        if (s === null) throw new Error("no editor session");
        return JSON.parse(
          JSON.stringify({
            tool: s.tool,
            block: s.block,
            inspected: s.inspected,
            inspectedBlock: s.inspectedBlock,
            pending: s.pending,
            selection: s.selection,
            message: s.message,
            error: s.error,
            undoCount: s.undoCount,
            clipboardCells: s.clipboardCells,
          }),
        );
      });
    const armTool = async (id: string): Promise<void> => {
      await tapButton(`[data-testid="tool-${id}"]`);
      ok((await mb()).tool === id, t(`the ${id} tool is armed from the bottom toolbar`));
    };
    /** A tap whose offset cursor lands on a page point; the finger must be over the canvas. */
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
    const disabled = (sel: string): Promise<boolean> =>
      page.$eval(sel, (el) => (el as HTMLButtonElement).disabled);
    const confirm = (): Promise<void> => tapButton('[data-testid="confirm"]');
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
    const sheetOpen = async (): Promise<boolean> =>
      (await page.$('[data-testid="bottom-sheet"]')) !== null;
    const uiMessage = (): Promise<string> =>
      page.evaluate(
        () =>
          (
            document.querySelector('[data-testid="edit-message"]') ??
            document.querySelector('[data-testid="edit-error"]')
          )?.textContent?.trim() ?? "",
      );
    const box = async (
      selector: string,
    ): Promise<{ x: number; y: number; w: number; h: number; right: number; bottom: number }> =>
      page.$eval(selector, (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
      });
    const attr = (selector: string, name: string): Promise<string | null> =>
      page.$eval(selector, (el, n) => el.getAttribute(n), name);
    const exists = async (selector: string): Promise<boolean> => (await page.$(selector)) !== null;
    const setAzimuth = async (azimuth: number): Promise<void> => {
      await page.evaluate((az) => {
        (window.__voxwright as Vox).renderer.setOrbit({ azimuth: az });
      }, azimuth);
      await settleFrames();
      await sleep(150);
    };
    /** The sheet as a person sees it: nothing smaller than 44 px to press, nothing wider than the screen. */
    const sheetLayout = (): Promise<{
      small: string[];
      pressable: number;
      docWidth: number;
      contentScrollWidth: number;
      contentClientWidth: number;
      viewport: number;
    }> =>
      page.evaluate(() => {
        const sheet = document.querySelector('[data-testid="bottom-sheet"]') as HTMLElement;
        const content = document.querySelector(
          '[data-testid="bottom-sheet-content"]',
        ) as HTMLElement;
        const small: string[] = [];
        let pressable = 0;
        for (const el of sheet.querySelectorAll(
          'button, [role="switch"], input[type="text"], input[type="number"], input[type="search"]',
        )) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          pressable++;
          if (r.width < 43.99 || r.height < 43.99) {
            small.push(
              `${el.getAttribute("data-testid") ?? el.getAttribute("aria-label") ?? el.textContent?.trim()}: ${r.width.toFixed(1)}x${r.height.toFixed(1)}`,
            );
          }
        }
        return {
          small,
          pressable,
          docWidth: document.documentElement.scrollWidth,
          contentScrollWidth: content.scrollWidth,
          contentClientWidth: content.clientWidth,
          viewport: window.innerWidth,
        };
      });
    const checkLayout = async (label: string): Promise<void> => {
      const l = await sheetLayout();
      ok(
        l.docWidth <= l.viewport && l.contentScrollWidth <= l.contentClientWidth,
        t(
          `${label}: no horizontal scroll at ${l.viewport}px (page ${l.docWidth}, sheet ${l.contentScrollWidth}/${l.contentClientWidth})`,
        ),
      );
      ok(
        l.small.length === 0 && l.pressable > 0,
        t(
          `${label}: all ${l.pressable} controls are at least 44 x 44 px${l.small.length ? ` (too small: ${l.small.join("; ")})` : ""}`,
        ),
      );
    };
    /** axe-core on one part of the page: the rules it breaks, with the first elements. */
    const axeOn = async (selector: string): Promise<string[]> => {
      await page.evaluate(axeSource);
      return page.evaluate(async (sel) => {
        const axe = (
          window as unknown as {
            axe: {
              run(
                ctx: object,
                options: object,
              ): Promise<{ violations: { id: string; nodes: { target: unknown[] }[] }[] }>;
            };
          }
        ).axe;
        const root = document.querySelector(sel);
        if (root === null) return [`nothing matches ${sel}`];
        // No rule is switched off and nothing is left out (MB8 fixed the two findings earlier
        // milestones had excluded: the sheet's own <header> and the face steppers' names).
        const r = await axe.run({ include: [root] }, { resultTypes: ["violations"] });
        return r.violations.map(
          (v) =>
            `${v.id} (${v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(" "))
              .join(" | ")})`,
        );
      }, selector);
    };
    const axeClean = async (label: string, selector: string): Promise<void> => {
      const found = await axeOn(selector);
      ok(
        found.length === 0,
        t(`axe-core finds no violations in ${label}${found.length ? `: ${found.join("; ")}` : ""}`),
      );
    };
    const undoAll = async (): Promise<void> => {
      await page.evaluate(() => {
        const s = (window.__voxwright as Vox).session() as NonNullable<ReturnType<Vox["session"]>>;
        while (s.canUndo) s.undo();
      });
      await settleFrames();
    };
    const stored = (k: string): Promise<string | null> =>
      page.evaluate((name) => localStorage.getItem(name), k);
    /** The palette: type a query (the one place typing is allowed) and choose the entry, or the typed block. */
    const chooseViaPalette = async (query: string, block: string): Promise<void> => {
      await openSheet("active-block-swatch");
      await page.type('[data-testid="palette-search"]', query);
      await sleep(250);
      const entry = `[data-testid="palette-list"] li button.entry[data-block="${block}"]`;
      await tapButton((await exists(entry)) ? entry : '[data-testid="palette-use-typed"]');
      await closeSheet();
    };

    // -- setup ----------------------------------------------------------------------------------
    await page.goto(url);
    await startUp();
    await openFixture();
    const home = await pose();
    ok(home.azimuth === 45, t("the camera starts at azimuth 45"));
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

    // =========================================================================
    // Tap to inspect in View
    // =========================================================================
    ok((await mb()).tool === "navigate", t("the editor starts in View"));
    ok(
      (await mb()).inspected === null && !(await exists('[data-testid="state-chip"]')),
      t("nothing is inspected and there is no Edit state chip yet"),
    );
    const stairs = topAt(...STAIRS_AT);
    ok(
      stairs.block.startsWith("minecraft:stone_brick_stairs["),
      t(`a stairs block: ${stairs.block}`),
    );
    await tapAt(stairs.pt.x, stairs.pt.y); // the finger itself: View has no offset cursor
    const insp1 = await mb();
    ok(
      insp1.inspected !== null && key(insp1.inspected) === key(STAIRS_AT),
      t(`a tap in View inspects the block under the finger (${JSON.stringify(insp1.inspected)})`),
    );
    ok(
      insp1.undoCount === 0 && (await changed(original)).length === 0 && insp1.pending === null,
      t("and changes nothing: no cell, no undo step, nothing pending"),
    );
    ok(
      (await page.$eval('[data-testid="hover"]', (el) => el.textContent?.trim())) ===
        `[${STAIRS_AT.join(", ")}]`,
      t("the readout line names the cell"),
    );
    ok(
      (await page.$eval('[data-testid="cell-block"]', (el) => el.textContent?.trim())) ===
        stairs.block.replace("minecraft:", ""),
      t("and the block"),
    );
    const chip = await box('[data-testid="state-chip"]');
    const readoutRow = await box('[data-testid="live-cell-readout"]');
    const toolbarBox = await box('[data-testid="toolbar"]');
    ok(
      chip.w >= 43.99 && chip.h >= 43.99,
      t(`the Edit state chip is at least 44 px (${chip.w.toFixed(0)} x ${chip.h.toFixed(0)})`),
    );
    ok(
      chip.bottom <= toolbarBox.y + 1 && readoutRow.bottom <= toolbarBox.y + 1,
      t("the chip sits in the readout line above the toolbar and does not cover it"),
    );
    ok(
      (await attr('[data-testid="state-chip"]', "aria-label"))?.includes("stone_brick_stairs") ===
        true,
      t("its accessible name names the block"),
    );
    await axeClean("the readout line with the Edit state chip", '[data-testid="bottom-toolbar"]');
    // Empty space clears it
    const sky = { x: 30, y: 130 };
    ok(
      (await page.evaluate(
        (p) => (window.__voxwright as Vox).session()?.pick(p.x, p.y) ?? null,
        sky,
      )) === null,
      t("(the point chosen for the empty tap is over no block)"),
    );
    await tapAt(sky.x, sky.y);
    const insp2 = await mb();
    ok(
      insp2.inspected === null && !(await exists('[data-testid="state-chip"]')),
      t("a tap on empty space clears it, and the chip goes"),
    );
    // An orbit that ends over a block, a pinch and a pan do not inspect
    await cdpTouchDrag(cdp, { x: 300, y: 340 }, { x: 250, y: 330 }, 8);
    await sleep(250);
    await restoreCamera();
    ok((await mb()).inspected === null, t("an orbit drag that ends over a block does not inspect"));
    await cdpPinch(cdp, { x: 200, y: 400 }, 80, 140, 8);
    await sleep(250);
    await restoreCamera();
    ok((await mb()).inspected === null, t("a pinch does not inspect"));
    await cdpTwoFingerPan(cdp, { x: 195, y: 400 }, { dx: 30, dy: 20 }, 80, 6);
    await sleep(250);
    await restoreCamera();
    ok((await mb()).inspected === null, t("a two-finger pan does not inspect"));
    // A long press in View picks (and inspects) instead of just inspecting
    const holdFinger = await page.touchscreen.touchStart(stairs.pt.x, stairs.pt.y);
    await sleep(700);
    await holdFinger.end();
    await sleep(250);
    const held = await mb();
    ok(
      held.block === (stairs.block.split("{")[0] as string) &&
        held.inspected !== null &&
        key(held.inspected) === key(STAIRS_AT),
      t(`a long press in View still picks the block (${held.block}) and inspects it`),
    );
    await tapAt(sky.x, sky.y);

    // =========================================================================
    // The chip opens the state sheet
    // =========================================================================
    await tapAt(stairs.pt.x, stairs.pt.y);
    await tapButton('[data-testid="state-chip"]');
    await page.waitForSelector('[data-testid="bottom-sheet"]', { timeout: 5000 });
    await sleep(350);
    ok(
      (await page.$eval('[data-testid="bottom-sheet"]', (el) => el.getAttribute("aria-label"))) ===
        "Block State",
      t("tapping the chip opens the Block State sheet"),
    );
    ok(
      (await page.$eval('[data-testid="blockstate-name"]', (el) => el.textContent?.trim())) ===
        `stone_brick_stairs at ${STAIRS_AT.join(", ")}`,
      t("which names the inspected block and its cell"),
    );
    ok(
      !(await exists("datalist")) && !(await exists('[data-testid="blockstate"] select')),
      t("no <datalist> and no <select> in the touch sheet"),
    );
    const chips = async (
      prop: string,
    ): Promise<{ value: string; pressed: boolean; h: number; w: number }[]> =>
      page.$$eval(`[data-testid="prop-${prop}"] button`, (els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return {
            value: el.textContent?.trim() ?? "",
            pressed: el.getAttribute("aria-pressed") === "true",
            h: r.height,
            w: r.width,
          };
        }),
      );
    const currentStairs = async (): Promise<string> => (await cellAt(STAIRS_AT)) as string;
    const facingOf = async (): Promise<string> =>
      /facing=(\w+)/.exec(await currentStairs())?.[1] as string;
    const startFacing = await facingOf();
    const facingChips = await chips("facing");
    ok(
      facingChips.map((c) => c.value).join() === "north,east,south,west" &&
        facingChips
          .filter((c) => c.pressed)
          .map((c) => c.value)
          .join() === startFacing,
      t(
        `facing is four chips, north east south west, with the current one (${startFacing}) pressed`,
      ),
    );
    ok(
      facingChips.every((c) => c.h >= 43.99 && c.w >= 43.99),
      t("each chip is at least 44 x 44 px"),
    );
    const halfChips = await chips("half");
    ok(
      halfChips.map((c) => c.value).join() === "top,bottom",
      t(`half is two chips (${halfChips.map((c) => c.value).join()})`),
    );
    const shapeChips = await chips("shape");
    ok(shapeChips.length === 5, t(`shape is five chips that wrap (${shapeChips.length})`));
    ok(
      (await page.$eval('[data-testid="prop-waterlogged"]', (el) => el.getAttribute("role"))) ===
        "switch" && (await attr('[data-testid="prop-waterlogged"]', "aria-checked")) === "false",
      t("waterlogged is a switch (role=switch) that is off"),
    );
    await checkLayout("the state sheet of a stairs block");
    await axeClean("the state sheet of a stairs block", '[data-testid="bottom-sheet"]');

    // A chip applies at once, as one undo step
    const target = startFacing === "north" ? "south" : "north";
    const beforeFacing = await mb();
    await tapButton(`[data-testid="prop-facing-${target}"]`);
    ok((await facingOf()) === target, t(`the ${target} chip sets facing=${target}`));
    ok((await mb()).undoCount === beforeFacing.undoCount + 1, t("and is one undo step"));
    ok(
      (await attr(`[data-testid="prop-facing-${target}"]`, "aria-pressed")) === "true" &&
        (await attr(`[data-testid="prop-facing-${startFacing}"]`, "aria-pressed")) === "false",
      t("the pressed chip moves"),
    );
    await tapButton(`[data-testid="prop-facing-${target}"]`);
    ok(
      (await mb()).undoCount === beforeFacing.undoCount + 1,
      t("tapping the chip that is already on adds no undo step"),
    );
    await tapButton('[data-testid="prop-half-top"]');
    await tapButton('[data-testid="prop-half-bottom"]');
    ok(
      (await mb()).undoCount === beforeFacing.undoCount + 3 &&
        (await currentStairs()).includes("half=bottom"),
      t("two more taps on the half chips: two more undo steps"),
    );
    // The switch
    await tapButton('[data-testid="prop-waterlogged"]');
    ok(
      (await currentStairs()).includes("waterlogged=true") &&
        (await attr('[data-testid="prop-waterlogged"]', "aria-checked")) === "true",
      t("a tap on the waterlogged switch turns it on"),
    );
    ok((await mb()).undoCount === beforeFacing.undoCount + 4, t("as one undo step"));
    await tapButton('[data-testid="prop-waterlogged"]');
    ok(
      (await currentStairs()).includes("waterlogged=false") &&
        (await attr('[data-testid="prop-waterlogged"]', "aria-checked")) === "false",
      t("and a second tap turns it off again"),
    );
    ok(
      (
        (await page.$eval('[data-testid="sheet-message"]', (el) => el.textContent?.trim())) ?? ""
      ).includes("changed"),
      t("the sheet says what it did on a status line of its own, as the readout is under it"),
    );

    // Rotate block
    ok(await exists('[data-testid="rotate-block"]'), t("a stairs block has a Rotate block button"));
    const rb = await box('[data-testid="rotate-block"]');
    ok(rb.h >= 47.99, t(`which is at least 48 px tall (${rb.h.toFixed(0)})`));
    await tapButton(`[data-testid="prop-facing-north"]`);
    const seen: string[] = [];
    const undoBeforeRotate = (await mb()).undoCount;
    for (let i = 0; i < 4; i++) {
      await tapButton('[data-testid="rotate-block"]');
      seen.push(await facingOf());
    }
    ok(
      seen.join() === "east,south,west,north",
      t(`Rotate block cycles facing clockwise: north to ${seen.join(" to ")}`),
    );
    ok((await mb()).undoCount === undoBeforeRotate + 4, t("and every press is one undo step"));
    ok(
      (await attr('[data-testid="prop-facing-north"]', "aria-pressed")) === "true",
      t("the chips follow the rotation"),
    );

    // Other...
    ok(
      !(await exists('[data-testid="prop-other"]')),
      t("the free-text fields are hidden at first"),
    );
    ok(
      (await attr('[data-testid="prop-other-toggle"]', "aria-expanded")) === "false",
      t("behind an Other... button that says it is collapsed"),
    );
    await tapButton('[data-testid="prop-other-toggle"]');
    ok(
      (await attr('[data-testid="prop-other-toggle"]', "aria-expanded")) === "true" &&
        (await exists('[data-testid="prop-other-facing"]')) &&
        (await exists('[data-testid="prop-new-key"]')),
      t("Other... reveals a text field per property and the new-property row"),
    );
    ok(!(await exists("datalist")), t("and still no <datalist>"));
    await checkLayout("the state sheet with Other... open");
    await axeClean("the state sheet with Other... open", '[data-testid="bottom-sheet"]');
    const undoBeforeAdd = (await mb()).undoCount;
    await page.type('[data-testid="prop-new-key"]', "mood");
    await page.type('[data-testid="prop-new-value"]', "calm");
    await tapButton('[data-testid="prop-add"]');
    ok(
      (await currentStairs()).includes("mood=calm") && (await mb()).undoCount === undoBeforeAdd + 1,
      t("a new property can be added behind Other... (one undo step)"),
    );
    await closeSheet();

    // Numeric properties and a door, placed with the session (the sheet is what is under test)
    await page.evaluate(
      (sign, door) => {
        const s = (window.__voxwright as Vox).session() as NonNullable<ReturnType<Vox["session"]>>;
        s.placeAt([4, 8, 6], sign);
        s.placeAt([2, 8, 7], door);
        s.inspected = [4, 8, 6];
      },
      SIGN,
      DOOR,
    );
    await openSheet("mobile-state-toggle");
    ok(
      (await page.$eval('[data-testid="prop-rotation-value"]', (el) => el.textContent?.trim())) ===
        "3",
      t("rotation (0 to 15) is a stepper that shows its value, 3"),
    );
    ok(
      (await exists('[data-testid="prop-rotation-dec"]')) &&
        (await exists('[data-testid="prop-rotation-inc"]')) &&
        (await chips("rotation")).length === 2,
      t("with a minus and a plus, not sixteen chips"),
    );
    const signNow = async (): Promise<string> => (await cellAt([4, 8, 6])) as string;
    await tapButton('[data-testid="prop-rotation-inc"]');
    ok((await signNow()).includes("rotation=4"), t("+ makes it 4"));
    await tapButton('[data-testid="prop-rotation-dec"]');
    await tapButton('[data-testid="prop-rotation-dec"]');
    ok((await signNow()).includes("rotation=2"), t("and two - make it 2"));
    await page.evaluate(() => {
      (window.__voxwright as Vox).session()?.setProperty("rotation", "0");
    });
    ok(await disabled('[data-testid="prop-rotation-dec"]'), t("at 0 the - is disabled"));
    await page.evaluate(() => {
      (window.__voxwright as Vox).session()?.setProperty("rotation", "15");
    });
    ok(await disabled('[data-testid="prop-rotation-inc"]'), t("at 15 the + is disabled"));
    ok(
      !(await exists('[data-testid="rotate-block"]')),
      t("a sign has no Rotate block (no facing or axis)"),
    );
    await checkLayout("the state sheet of a sign");
    await axeClean("the state sheet of a sign (stepper)", '[data-testid="bottom-sheet"]');
    await closeSheet();
    // The door
    await page.evaluate(() => {
      const s = (window.__voxwright as Vox).session() as NonNullable<ReturnType<Vox["session"]>>;
      s.inspected = [2, 8, 7];
    });
    await openSheet("mobile-state-toggle");
    ok(
      (await attr('[data-testid="prop-open"]', "role")) === "switch" &&
        (await attr('[data-testid="prop-open"]', "aria-checked")) === "false",
      t("a door's open is a switch that is off"),
    );
    const undoBeforeDoor = (await mb()).undoCount;
    await tapButton('[data-testid="prop-open"]');
    ok(
      ((await cellAt([2, 8, 7])) as string).includes("open=true") &&
        (await attr('[data-testid="prop-open"]', "aria-checked")) === "true" &&
        (await mb()).undoCount === undoBeforeDoor + 1,
      t("one tap opens the door, as one undo step"),
    );
    const doorHalf = await chips("half");
    ok(
      doorHalf.map((c) => c.value).join() === "upper,lower",
      t(`a door's half is two chips (${doorHalf.map((c) => c.value).join()})`),
    );
    await checkLayout("the state sheet of a door");
    await closeSheet();
    await undoAll();
    ok(
      (await changed(original)).length === 0 && (await mb()).undoCount === 0,
      t("every one of those edits undoes: the cells equal the file as opened"),
    );

    // =========================================================================
    // The selection sheet on touch
    // =========================================================================
    await armTool("select");
    const selA = topAt(...BOX_A);
    const selB = topAt(...BOX_B);
    await tapCursorAt(selA.pt);
    await tapCursorAt(selB.pt);
    await confirm();
    ok(
      (await mb()).selection !== null && key((await mb()).selection?.min ?? []) === key(BOX_A),
      t("a box is selected by two taps and the check mark"),
    );
    await openSheet("mobile-selection-toggle");
    await tapButton('[data-testid="face-east-grow"]');
    ok(key((await mb()).selection?.max ?? []) === "7,7,5", t("East +1 widens it to 2 x 1 x 3"));
    const names = await page.$$eval(
      '[data-testid="selection-panel"] button, [data-testid="coords-panel"] button',
      (els) =>
        els.map((el) => ({
          id: el.getAttribute("data-testid") ?? "",
          text: el.textContent?.trim() ?? "",
          h: el.getBoundingClientRect().height,
        })),
    );
    const need = [
      "fill",
      "replace",
      "copy",
      "paste",
      "rotate-ccw",
      "rotate-cw",
      "mirror-x",
      "mirror-z",
      "select-all",
      "select-none",
    ];
    ok(
      need.every((id) => names.some((n) => n.id === id && n.h >= 43.99)),
      t(
        `Fill, Replace, Copy, Paste, Rotate both ways, Mirror both ways, Select all and Clear are all there and at least 44 px (${need
          .map((id) => `${id} ${names.find((n) => n.id === id)?.h.toFixed(0)}`)
          .join(", ")})`,
      ),
    );
    ok(
      ["fill", "replace", "copy", "paste"].every(
        (id) => (names.find((n) => n.id === id)?.h ?? 0) >= 47.99,
      ),
      t("the main actions (Fill, Replace, Copy, Paste) are 48 px"),
    );
    ok(
      names.find((n) => n.id === "replace-use")?.text === "Use inspected block",
      t("Replace has a Use inspected block button on touch"),
    );
    ok(
      !(await exists('[data-testid="move"]')) &&
        !(await exists('[data-testid="move-x"]')) &&
        (await exists('[data-testid="move-pad"]')),
      t("the typed move offsets are gone; the move pad is there"),
    );
    // Order: actions come before the typed coordinates and typed corners
    const order = await page.evaluate(() => {
      const y = (sel: string): number =>
        (document.querySelector(sel) as HTMLElement).getBoundingClientRect().top;
      return {
        fill: y('[data-testid="fill"]'),
        copy: y('[data-testid="copy"]'),
        pad: y('[data-testid="move-pad"]'),
        corners: y('[data-testid="sel-min-x"]'),
        coords: y('[data-testid="at-set"]'),
      };
    });
    ok(
      order.fill < order.pad &&
        order.pad < order.copy &&
        order.copy < order.corners &&
        order.corners < order.coords,
      t("the actions come first; the typed corners and the typed block position are below them"),
    );
    await checkLayout("the selection sheet");
    await axeClean("the selection sheet", '[data-testid="bottom-sheet"]');

    // Use inspected block
    await page.evaluate(() => {
      (window.__voxwright as Vox).session()!.inspected = null;
    });
    ok(
      await disabled('[data-testid="replace-use"]'),
      t("Use inspected block is disabled while nothing is inspected"),
    );
    await page.evaluate((p) => {
      (window.__voxwright as Vox).session()!.inspected = p;
    }, STAIRS_AT);
    ok(
      !(await disabled('[data-testid="replace-use"]')),
      t("and enabled once a block is inspected"),
    );
    await tapButton('[data-testid="replace-use"]');
    ok(
      (await page.$eval('[data-testid="replace-from"]', (el) => (el as HTMLInputElement).value)) ===
        stairs.block,
      t("it fills the block to replace from the inspected block"),
    );
    ok(
      (await page.$eval('[data-testid="replace-from"]', (el) => (el as HTMLInputElement).type)) ===
        "text",
      t("and typing stays possible"),
    );

    // Copy says how many
    await tapButton('[data-testid="copy"]');
    ok(
      (await mb()).message === "Copied 6 blocks" && (await mb()).clipboardCells === 6,
      t(`Copy says how many blocks it copied (${(await mb()).message})`),
    );
    ok(
      (await page.$eval('[data-testid="sheet-message"]', (el) => el.textContent?.trim())) ===
        "Copied 6 blocks",
      t("on the sheet's own status line, since the readout is under the sheet"),
    );
    ok((await uiMessage()) === "Copied 6 blocks", t("and in the message line above the toolbar"));

    // The move pad
    const expectedPad = (az: number) => {
      const r = (az * Math.PI) / 180;
      const fx = -Math.sin(r);
      const fz = Math.cos(r);
      const rx = -Math.cos(r);
      const rz = -Math.sin(r);
      const onZ = Math.abs(fz) >= Math.abs(fx) - 1e-9;
      return {
        away: onZ ? { axis: 2, step: Math.sign(fz) } : { axis: 0, step: Math.sign(fx) },
        right: onZ ? { axis: 0, step: Math.sign(rx) } : { axis: 2, step: Math.sign(rz) },
      };
    };
    const padArrow = async (
      id: string,
    ): Promise<{ axis: number; step: number; w: number; h: number }> =>
      page.$eval(`[data-testid="move-${id}"]`, (el) => {
        const r = el.getBoundingClientRect();
        return {
          axis: Number((el as HTMLElement).dataset.axis),
          step: Number((el as HTMLElement).dataset.step),
          w: r.width,
          h: r.height,
        };
      });
    const selNow = async (): Promise<{ min: Vec3; max: Vec3 }> =>
      (await mb()).selection as { min: Vec3; max: Vec3 };
    const sameBlocksMoved = async (
      before: Map<string, string>,
      from: { min: Vec3; max: Vec3 },
      d: Vec3,
    ): Promise<boolean> => {
      const now = await cells();
      for (let x = from.min[0]; x <= from.max[0]; x++)
        for (let y = from.min[1]; y <= from.max[1]; y++)
          for (let z = from.min[2]; z <= from.max[2]; z++) {
            const was = before.get(`${x},${y},${z}`);
            if (was !== undefined && now.get(`${x + d[0]},${y + d[1]},${z + d[2]}`) !== was)
              return false;
          }
      return true;
    };
    await closeSheet();
    for (const az of [0, 90]) {
      await setAzimuth(az);
      await openSheet("mobile-selection-toggle");
      const want = expectedPad(az);
      const away = await padArrow("away");
      const right = await padArrow("right");
      ok(
        away.axis === want.away.axis &&
          away.step === want.away.step &&
          right.axis === want.right.axis &&
          right.step === want.right.step,
        t(
          `at azimuth ${az} Away moves ${"xyz"[away.axis]}${away.step > 0 ? "+" : "-"} and Right ${"xyz"[right.axis]}${right.step > 0 ? "+" : "-"}, as the camera sees it`,
        ),
      );
      ok(
        [
          away,
          right,
          await padArrow("left"),
          await padArrow("toward"),
          await padArrow("up"),
          await padArrow("down"),
        ].every((a) => a.w >= 47.99 && a.h >= 47.99),
        t("the six arrows are 48 px"),
      );
      for (const id of ["away", "right", "toward", "left", "up", "down"] as const) {
        const a = await padArrow(id);
        const before = await cells();
        const sel0 = await selNow();
        const undo0 = (await mb()).undoCount;
        await tapButton(`[data-testid="move-${id}"]`);
        const sel1 = await selNow();
        const d: Vec3 = [0, 0, 0];
        d[a.axis] = a.step;
        const expectMin = sel0.min.map((v, i) => v + (d[i] as number));
        ok(
          key(sel1.min) === key(expectMin) && (await mb()).undoCount === undo0 + 1,
          t(
            `azimuth ${az}, ${id}: the selection moves one along ${"xyz"[a.axis]} by ${a.step}, as one undo step (${key(sel0.min)} to ${key(sel1.min)})`,
          ),
        );
        ok(
          await sameBlocksMoved(before, sel0, d),
          t(`azimuth ${az}, ${id}: and the blocks moved with it`),
        );
        // put it back for the next arrow
        await page.evaluate((box0) => {
          const s = (window.__voxwright as Vox).session()!;
          s.undo();
          s.setSelection(box0);
        }, sel0);
        await sleep(100);
      }
      await closeSheet();
    }
    // x8
    await setAzimuth(0);
    await openSheet("mobile-selection-toggle");
    ok(
      (await attr('[data-testid="move-big"]', "aria-pressed")) === "false",
      t("the x8 toggle starts off"),
    );
    await tapButton('[data-testid="move-big"]');
    ok((await attr('[data-testid="move-big"]', "aria-pressed")) === "true", t("and turns on"));
    const sel8 = await selNow();
    const before8 = await cells();
    const undo8 = (await mb()).undoCount;
    const leftArrow = await padArrow("left");
    await tapButton('[data-testid="move-left"]');
    const sel8b = await selNow();
    const d8: Vec3 = [0, 0, 0];
    d8[leftArrow.axis] = leftArrow.step * 8;
    ok(
      key(sel8b.min) === key(sel8.min.map((v, i) => v + (d8[i] as number))) &&
        (await mb()).undoCount === undo8 + 1,
      t(
        `with x8 one press moves the selection 8 blocks (${key(sel8.min)} to ${key(sel8b.min)}) as one undo step`,
      ),
    );
    ok(await sameBlocksMoved(before8, sel8, d8), t("and the blocks arrive 8 blocks over"));
    await page.evaluate((box0) => {
      const s = (window.__voxwright as Vox).session()!;
      s.undo();
      s.setSelection(box0);
    }, sel8);
    await tapButton('[data-testid="move-big"]');
    // Holding repeats
    const arrowBox = await box('[data-testid="move-up"]');
    const sheetTop = await box('[data-testid="bottom-sheet"]');
    ok(arrowBox.y > sheetTop.y, t("(the up arrow is inside the sheet)"));
    const undoHold = (await mb()).undoCount;
    const holdBtn = await page.touchscreen.touchStart(
      arrowBox.x + arrowBox.w / 2,
      arrowBox.y + arrowBox.h / 2,
    );
    await sleep(950);
    await holdBtn.end();
    await sleep(200);
    const heldSteps = (await mb()).undoCount - undoHold;
    ok(heldSteps >= 3, t(`holding Up repeats: ${heldSteps} steps, each one undo step`));
    await undoAll();
    // Back to the state before the pad
    ok((await changed(original)).length === 0, t("undoing the moves restores every cell"));
    await closeSheet();
    await restoreCamera();

    // Paste closes the sheet
    await openSheet("mobile-selection-toggle");
    ok(!(await disabled('[data-testid="paste"]')), t("Paste is enabled after a Copy"));
    await tapButton('[data-testid="paste"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="bottom-sheet"]') === null,
      { timeout: 5000 },
    );
    ok(
      (await mb()).tool === "paste" && !(await sheetOpen()),
      t("Paste arms the Paste tool and closes the sheet, so the picture is free for the tap"),
    );
    await tapCursorAt(topAt(...PASTE_ON).pt);
    ok(
      (await mb()).pending?.kind === "paste" && key((await mb()).pending?.at ?? []) === "11,8,6",
      t("the next tap sets the paste origin"),
    );
    await tapButton('[data-testid="cancel"]');
    ok((await mb()).pending === null, t("and the cross drops it"));
    await armTool("navigate");

    // =========================================================================
    // The hotbar: recents, favourites, storage
    // =========================================================================
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await startUp();
    await openFixture();
    ok(
      !(await exists('[data-testid="hotbar-compact"]')),
      t("with nothing chosen yet the quick row is not shown"),
    );
    await openSheet("active-block-swatch");
    ok(
      (await exists('[data-testid="hotbar"]')) && (await exists('[data-testid="hotbar-empty"]')),
      t("the palette sheet has a hotbar row above the search, with a hint while it is empty"),
    );
    const hbY = (await box('[data-testid="hotbar"]')).y;
    const searchY = (await box('[data-testid="palette-search"]')).y;
    ok(hbY < searchY, t("the hotbar is above the search field"));
    await page.type('[data-testid="palette-search"]', "bricks");
    await sleep(250);
    const rowOf = (block: string): string =>
      `[data-testid="palette-list"] li button.entry[data-block="${block}"]`;
    const starOf = (block: string): string =>
      `[data-testid="palette-list"] li button.star[data-block="${block}"]`;
    ok(await exists(rowOf("minecraft:stone_bricks")), t("the build's blocks are listed"));
    const star = await box(starOf("minecraft:stone_bricks"));
    ok(
      star.w >= 43.99 && star.h >= 43.99,
      t(`each row has a star of at least 44 px (${star.w.toFixed(0)} x ${star.h.toFixed(0)})`),
    );
    ok(
      (await attr(starOf("minecraft:stone_bricks"), "aria-label")) === "Favourite stone_bricks" &&
        (await attr(starOf("minecraft:stone_bricks"), "aria-pressed")) === "false",
      t("named Favourite stone_bricks, with aria-pressed"),
    );
    await tapButton(rowOf("minecraft:stone_bricks"));
    await tapButton(rowOf("minecraft:deepslate_bricks"));
    ok(
      (await stored(RECENT_KEY)) ===
        JSON.stringify(["minecraft:deepslate_bricks", "minecraft:stone_bricks"]),
      t(`choosing blocks in the palette records them, newest first (${await stored(RECENT_KEY)})`),
    );
    ok(await sheetOpen(), t("choosing a block closes nothing"));
    const hotChips = async (): Promise<
      { block: string; favorite: boolean; h: number; label: string; pressed: boolean }[]
    > =>
      page.$$eval('[data-testid="hotbar-chip"]', (els) =>
        els.map((el) => ({
          block: el.getAttribute("data-block") ?? "",
          favorite: el.getAttribute("data-favorite") === "true",
          h: el.getBoundingClientRect().height,
          label: el.getAttribute("aria-label") ?? "",
          pressed: el.getAttribute("aria-pressed") === "true",
        })),
      );
    const hc = await hotChips();
    ok(
      hc.map((c) => c.block).join() === "minecraft:deepslate_bricks,minecraft:stone_bricks" &&
        hc.every((c) => c.h >= 43.99 && c.label === c.block),
      t(
        "the hotbar shows them as chips of 44 px or more, with the full name as the accessible name",
      ),
    );
    ok(
      (await page.$eval('[data-testid="hotbar-chip"]', (el) => el.textContent?.trim())) ===
        "deepslate_bricks",
      t("and the short name as the text"),
    );
    await tapButton('[data-testid="hotbar-chip"][data-block="minecraft:stone_bricks"]');
    ok(
      (await mb()).block === "minecraft:stone_bricks" &&
        (await stored(RECENT_KEY)) ===
          JSON.stringify(["minecraft:stone_bricks", "minecraft:deepslate_bricks"]) &&
        (await sheetOpen()),
      t("a tap on a hotbar chip chooses the block, moves it to the front, and closes nothing"),
    );
    // Stars
    await tapButton(starOf("minecraft:deepslate_bricks"));
    ok(
      (await attr(starOf("minecraft:deepslate_bricks"), "aria-pressed")) === "true" &&
        (await stored(FAVORITE_KEY)) === JSON.stringify(["minecraft:deepslate_bricks"]),
      t(`a star toggles and is stored (${await stored(FAVORITE_KEY)})`),
    );
    const hc2 = await hotChips();
    ok(
      hc2[0]?.block === "minecraft:deepslate_bricks" && hc2[0].favorite && hc2.length === 2,
      t("the favourite leads the hotbar, shown once"),
    );
    await checkLayout("the palette sheet with the hotbar");
    await axeClean("the palette sheet with the hotbar and stars", '[data-testid="bottom-sheet"]');
    await closeSheet();
    // The quick row over the picture
    const compact = await box('[data-testid="hotbar-compact"]');
    const readoutNow = await box('[data-testid="live-cell-readout"]');
    const cluster = await box('[data-testid="thumb-cluster"]');
    ok(
      compact.bottom <= readoutNow.y && compact.right <= cluster.x && compact.x >= 0,
      t(
        `the quick row sits above the readout line and left of the thumb cluster (right ${compact.right.toFixed(0)}, cluster ${cluster.x.toFixed(0)}, bottom ${compact.bottom.toFixed(0)}, readout top ${readoutNow.y.toFixed(0)})`,
      ),
    );
    const compactChips = await page.$$eval('[data-testid="hotbar-compact-chip"]', (els) =>
      els.map((el) => el.getBoundingClientRect().height),
    );
    ok(
      compactChips.length === 2 && compactChips.every((h) => h >= 43.99),
      t("its chips are at least 44 px"),
    );
    ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      t("and the page does not scroll sideways"),
    );
    await axeClean("the quick row", '[data-testid="hotbar-compact"]');
    await tapButton('[data-testid="hotbar-compact-chip"][data-block="minecraft:stone_bricks"]');
    ok(
      (await mb()).block === "minecraft:stone_bricks" && !(await sheetOpen()),
      t("a tap on a quick chip chooses the block and opens nothing"),
    );
    // Pick, long press and the cap of eight
    await armTool("eyedropper");
    const spruce = all.find((c) => c.block.startsWith("minecraft:spruce_planks")) ?? null;
    const pickFrom = spruce ?? topAt(10, 4, 3);
    await tapCursorAt(pickFrom.pt);
    const afterPick = JSON.parse((await stored(RECENT_KEY)) ?? "[]") as string[];
    ok(
      afterPick[0] === (await mb()).block && !afterPick[0]?.includes("{"),
      t(`the Pick tool records the block it picked (${afterPick[0]})`),
    );
    await armTool("navigate");
    const lp = topAt(8, 6, 3);
    const lpHold = await page.touchscreen.touchStart(lp.pt.x, lp.pt.y);
    await sleep(700);
    await lpHold.end();
    await sleep(250);
    const afterLong = JSON.parse((await stored(RECENT_KEY)) ?? "[]") as string[];
    ok(
      afterLong[0] === (await mb()).block && afterLong[0] === lp.block,
      t(`a long press records the block it picked (${afterLong[0]})`),
    );
    await openSheet("active-block-swatch");
    const blocksListed = await page.$$eval('[data-testid="palette-list"] li button.entry', (els) =>
      els.slice(0, 12).map((el) => el.getAttribute("data-block") ?? ""),
    );
    for (const b of blocksListed.slice(0, 10)) {
      await tapButton(`[data-testid="palette-list"] li button.entry[data-block="${b}"]`);
    }
    const eight = JSON.parse((await stored(RECENT_KEY)) ?? "[]") as string[];
    ok(
      eight.length === 8 && new Set(eight).size === 8 && eight[0] === blocksListed[9],
      t(`the recents keep the last 8 distinct blocks (${eight.length})`),
    );
    await tapButton(starOf("minecraft:spruce_planks"));
    const favs = JSON.parse((await stored(FAVORITE_KEY)) ?? "[]") as string[];
    await closeSheet();

    // A star survives a reload; so do the recents
    await page.reload();
    await startUp();
    await openFixture();
    const compactAfter = await page.$$eval('[data-testid="hotbar-compact-chip"]', (els) =>
      els.map((el) => ({
        block: el.getAttribute("data-block") ?? "",
        favorite: el.getAttribute("data-favorite") === "true",
      })),
    );
    ok(
      compactAfter.slice(0, favs.length).every((c, i) => c.favorite && c.block === favs[i]) &&
        favs.includes("minecraft:deepslate_bricks"),
      t(`after a reload the starred blocks lead the quick row (${favs.length} starred)`),
    );
    ok(
      compactAfter.length === new Set([...favs, ...eight]).size,
      t(`followed by the recent ones (${compactAfter.length} chips)`),
    );
    await openSheet("active-block-swatch");
    await page.type('[data-testid="palette-search"]', "deepslate_bricks");
    await sleep(250);
    ok(
      (await attr(starOf("minecraft:deepslate_bricks"), "aria-pressed")) === "true",
      t("and the palette still shows the star as on"),
    );
    await closeSheet();
    // Left-handed: the quick row goes to the other side of the screen with the thumb cluster
    await page.evaluate(() => localStorage.setItem("voxwright.lefthanded", "true"));
    await page.reload();
    await startUp();
    await openFixture();
    const lhCompact = await box('[data-testid="hotbar-compact"]');
    const lhCluster = await box('[data-testid="thumb-cluster"]');
    ok(
      lhCluster.right < 195 && lhCompact.x >= lhCluster.right && lhCompact.right <= 390,
      t(
        `left-handed: the quick row is right of the thumb cluster (cluster to ${lhCluster.right.toFixed(0)}, row ${lhCompact.x.toFixed(0)} to ${lhCompact.right.toFixed(0)})`,
      ),
    );
    ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      t("and the page still does not scroll sideways"),
    );
    await page.evaluate(() => localStorage.removeItem("voxwright.lefthanded"));
    // A corrupt stored value is ignored
    await page.evaluate(
      (r, f) => {
        localStorage.setItem(r, "{{ not json");
        localStorage.setItem(
          f,
          JSON.stringify(Array.from({ length: 5000 }, (_, i) => `minecraft:block_${i}`)),
        );
      },
      RECENT_KEY,
      FAVORITE_KEY,
    );
    await page.reload();
    await startUp();
    await openFixture();
    ok(
      !(await exists('[data-testid="hotbar-compact"]')),
      t(
        "a damaged recents value and an oversized favourites value are ignored: the quick row is empty",
      ),
    );
    await chooseViaPalette("stone_bricks", "minecraft:stone_bricks");
    ok(
      (await stored(RECENT_KEY)) === JSON.stringify(["minecraft:stone_bricks"]),
      t("and the next choice replaces the damaged value"),
    );
    await page.evaluate(() => localStorage.clear());

    // =========================================================================
    // The exit criterion, by touch alone
    // =========================================================================
    await page.reload();
    await startUp();
    await openFixture();
    await restoreCamera();
    const fresh = await cells();
    ok(
      fresh.size === original.size && (await changed(original)).length === 0,
      t("a fresh page holds the file as it was"),
    );
    // 1. choose gold in the palette (typing in its search is the one allowed use of the keyboard)
    await chooseViaPalette("gold_block", GOLD);
    ok((await mb()).block === GOLD, t("gold is chosen through the palette search"));
    // 2. select a box: two corners and the check mark, then East +1
    await armTool("select");
    await tapCursorAt(topAt(...BOX_A).pt);
    await tapCursorAt(topAt(...BOX_B).pt);
    await confirm();
    await openSheet("mobile-selection-toggle");
    await tapButton('[data-testid="face-east-grow"]');
    const boxSel = (await mb()).selection;
    ok(
      boxSel !== null && key(boxSel.min) === key(BOX_A) && key(boxSel.max) === "7,7,5",
      t(`the box is x 6-7, y 7, z 3-5 (${JSON.stringify(boxSel)})`),
    );
    // 3. Fill
    await tapButton('[data-testid="fill"]');
    const filled = await changed(original);
    ok(
      filled.length === 6 && (await cellAt([7, 7, 4])) === GOLD,
      t(`Fill turns the 6 blocks of the box to gold (${filled.length} cells changed)`),
    );
    ok((await mb()).undoCount === 1, t("as one undo step"));
    // 4. Copy, Paste elsewhere
    await tapButton('[data-testid="copy"]');
    ok((await mb()).clipboardCells === 6, t("Copy takes the 6 gold blocks"));
    await tapButton('[data-testid="paste"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="bottom-sheet"]') === null,
      { timeout: 5000 },
    );
    await tapCursorAt(topAt(...PASTE_ON).pt);
    ok(
      (await mb()).pending?.kind === "paste" && key((await mb()).pending?.at ?? []) === "11,8,6",
      t("a tap sets the paste origin at 11,8,6"),
    );
    await confirm();
    const pasted = await mb();
    ok(
      pasted.pending === null &&
        pasted.undoCount === 2 &&
        key(pasted.selection?.min ?? []) === "11,8,6" &&
        key(pasted.selection?.max ?? []) === "12,8,8" &&
        (await cellAt([12, 8, 8])) === GOLD,
      t(
        `the check mark pastes it as one undo step; the pasted box is selected (${JSON.stringify(pasted.selection)})`,
      ),
    );
    // 5. Rotate
    await openSheet("mobile-selection-toggle");
    await tapButton('[data-testid="rotate-cw"]');
    const rotated = await mb();
    ok(
      rotated.undoCount === 3 && rotated.selection !== null,
      t(`Rotate turns the pasted box (${JSON.stringify(rotated.selection)}), one undo step`),
    );
    await closeSheet();
    // 6. Flip a stairs block's facing through its chips
    await armTool("navigate");
    const flipTo = target;
    await tapAt(stairs.pt.x, stairs.pt.y);
    await tapButton('[data-testid="state-chip"]');
    await page.waitForSelector('[data-testid="blockstate"]', { timeout: 5000 });
    await sleep(350);
    await tapButton(`[data-testid="prop-facing-${flipTo}"]`);
    ok(
      ((await cellAt(STAIRS_AT)) as string).includes(`facing=${flipTo}`) &&
        (await mb()).undoCount === 4,
      t(`the stairs at ${STAIRS_AT.join(",")} faces ${flipTo} through its chips`),
    );
    await closeSheet();
    // 7. A door: placed by touch (the fixture's doors are inside the house, out of reach of a tap),
    //    chosen through the palette's search, then opened with its switch
    await chooseViaPalette(DOOR.replace("minecraft:", ""), DOOR);
    await armTool("place");
    await tapCursorAt(topAt(...DOOR_ON).pt);
    ok(
      (await cellAt(DOOR_AT)) === DOOR && (await mb()).undoCount === 5,
      t(`a tap with Place puts the door at ${DOOR_AT.join(",")} (one undo step)`),
    );
    await armTool("navigate");
    const doorPt = await page.evaluate(
      (x, y, z) => (window.__voxwright as Vox).renderer.clientFromWorld(x + 0.5, y + 0.5, z + 0.5),
      DOOR_AT[0],
      DOOR_AT[1],
      DOOR_AT[2],
    );
    if (doorPt === null) throw new Error("the door is behind the camera");
    await tapAt(doorPt.x, doorPt.y);
    ok(
      key((await mb()).inspected ?? []) === key(DOOR_AT),
      t(`a tap in View inspects the door (${JSON.stringify((await mb()).inspected)})`),
    );
    await tapButton('[data-testid="state-chip"]');
    await page.waitForSelector('[data-testid="blockstate"]', { timeout: 5000 });
    await sleep(350);
    await tapButton('[data-testid="prop-open"]');
    ok(
      ((await cellAt(DOOR_AT)) as string).includes("open=true") && (await mb()).undoCount === 6,
      t("its open switch turns the door open"),
    );
    await closeSheet();
    // 8. Export from the Menu sheet
    await tapButton('[data-testid="mobile-menu-btn"]');
    await page.waitForSelector('[data-testid="mobile-convert"]', { timeout: 5000 });
    await sleep(350);
    ok(
      (await page.$eval(
        '[data-testid="mobile-format"]',
        (el) => (el as HTMLSelectElement).value,
      )) === "litematic",
      t("the Menu's export format is .litematic"),
    );
    await tapButton('[data-testid="mobile-convert"]');
    const exportedName = "Rafeals_house-edited.litematic";
    const deadline = Date.now() + 30000;
    while (!readdirSync(mobileDownloads).includes(exportedName) && Date.now() < deadline)
      await sleep(200);
    ok(readdirSync(mobileDownloads).includes(exportedName), t(`Export downloads ${exportedName}`));
    await sleep(500);
    const fromTouch = await readLitematic(
      new Uint8Array(await readFile(join(mobileDownloads, exportedName))),
      { keepAir: true },
    );
    const touchCells = cellsOf(fromTouch.volume);
    const liveCells = await cells();
    ok(
      diff(touchCells, liveCells).length === 0,
      t(`the exported file holds exactly the cells of the edited page (${touchCells.size} blocks)`),
    );
    ok(
      diff(touchCells, fresh).length > 10,
      t(`and ${diff(touchCells, fresh).length} cells differ from the file as opened`),
    );
    await closeSheet();
    const touchBounds = key((fromTouch.volume.placedBounds() ?? []).flat());
    const touchVersion = fromTouch.meta.dataVersion;
    ok(
      errors.length === 0,
      t(`no console errors on the touch page${errors.length ? `: ${errors.join(" | ")}` : ""}`),
    );
    await page.close();

    // =========================================================================
    // The same edits through the desktop path, in a desktop-layout page
    // =========================================================================
    const desk = await newPage(browser);
    await desk.setViewport({ width: 1440, height: 900 });
    desk.on("pageerror", (e) => errors.push(String(e)));
    desk.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    desk.on("dialog", (d) => void d.accept());
    const deskDownloads = join(downloads, "desktop");
    await mkdir(deskDownloads);
    const deskCdp = await desk.createCDPSession();
    await deskCdp.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: deskDownloads,
      eventsEnabled: true,
    });
    await desk.goto(url);
    await desk.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 30000 },
    );
    await sleep(600);
    if ((await desk.$('[data-testid="restore-dialog"][open]')) !== null) {
      await desk.click('[data-testid="discard"]');
    }
    const deskInput = (await desk.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await deskInput.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await desk.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 60000 },
    );
    await desk.evaluate(() => window.__voxwright?.renderer.whenIdle());
    ok(
      (await desk.$('[data-testid="toolbar"]')) !== null &&
        (await desk.$('[data-testid="bottom-toolbar"]')) === null,
      t("the desktop page has the desktop layout (side panels, no bottom toolbar)"),
    );
    // The edits, through the session API the desktop panels call, and the mouse for the paste
    await desk.evaluate(
      (gold, a, b) => {
        const s = (window.__voxwright as Vox).session() as NonNullable<ReturnType<Vox["session"]>>;
        s.block = gold;
        s.setSelection({ min: a as [number, number, number], max: b as [number, number, number] });
        s.fill();
        s.copy();
        s.setTool("paste");
      },
      GOLD,
      BOX_A,
      [7, 7, 5],
    );
    const pastePt = await desk.evaluate(
      (x, y, z) => {
        const v = window.__voxwright as Vox;
        const pt = v.renderer.clientFromWorld(x + 0.5, y + 1, z + 0.5);
        const hit = pt === null ? null : v.session()?.pick(pt.x, pt.y);
        return pt === null || hit === null || hit === undefined || hit.position[1] !== y
          ? null
          : pt;
      },
      PASTE_ON[0],
      PASTE_ON[1],
      PASTE_ON[2],
    );
    if (pastePt === null) throw new Error("the paste target is not reachable on the desktop page");
    await desk.mouse.click(pastePt.x, pastePt.y);
    await sleep(200);
    const deskPasted = await desk.evaluate(() => {
      const s = (window.__voxwright as Vox).session() as NonNullable<ReturnType<Vox["session"]>>;
      return JSON.parse(JSON.stringify({ selection: s.selection, tool: s.tool }));
    });
    ok(
      key(deskPasted.selection?.min ?? []) === "11,8,6" && deskPasted.tool === "select",
      t(`the mouse paste lands at 11,8,6 (${JSON.stringify(deskPasted.selection)})`),
    );
    await desk.evaluate(
      (door, doorAt, stairsAt, facing) => {
        const s = (window.__voxwright as Vox).session() as NonNullable<ReturnType<Vox["session"]>>;
        s.rotate("CLOCKWISE_90");
        s.inspected = stairsAt as [number, number, number];
        s.setProperty("facing", facing);
        s.placeAt(doorAt as [number, number, number], door);
        s.inspected = doorAt as [number, number, number];
        s.setProperty("open", "true");
      },
      DOOR,
      DOOR_AT,
      STAIRS_AT,
      flipTo,
    );
    await desk.evaluate(() => window.__voxwright?.renderer.whenIdle());
    await desk.select('[data-testid="format"]', "litematic");
    await desk.click('[data-testid="convert"]');
    const deadline2 = Date.now() + 30000;
    while (!readdirSync(deskDownloads).includes(exportedName) && Date.now() < deadline2)
      await sleep(200);
    ok(readdirSync(deskDownloads).includes(exportedName), t("the desktop page exports too"));
    await sleep(500);
    const fromDesk = await readLitematic(
      new Uint8Array(await readFile(join(deskDownloads, exportedName))),
      { keepAir: true },
    );
    const deskCells = cellsOf(fromDesk.volume);
    const unequal = diff(touchCells, deskCells);
    ok(
      unequal.length === 0 && touchCells.size === deskCells.size,
      t(
        `THE EXIT CRITERION: the file exported by touch has exactly the same cells as the desktop path's (${touchCells.size} blocks, ${unequal.length} differ${unequal.length ? `: ${unequal.slice(0, 5).join(" ")}` : ""})`,
      ),
    );
    ok(
      key((fromDesk.volume.placedBounds() ?? []).flat()) === touchBounds &&
        fromDesk.meta.dataVersion === touchVersion,
      t("and the same size and position, and the same data version"),
    );
    ok(
      errors.length === 0,
      t(`no console errors on either page${errors.length ? `: ${errors.join(" | ")}` : ""}`),
    );
    await desk.close();
  } finally {
    await browser.close();
    await rm(downloads, { recursive: true, force: true });
  }
}

/**
 * Camera conveniences: a double tap in View focuses the camera on the block under the finger, "Zoom
 * in here" on the nudge pad does the same for the armed cell, and a two-finger twist turns the view
 * (with a setting). Real touch events over CDP; the camera is judged by reading the renderer's pose.
 */
export async function touchCameraSuite(): Promise<void> {
  const t = (what: string): string => `[touch-camera] ${what}`;
  const browser = await puppeteer.launch({
    executablePath: chromium,
    headless: true,
    args: chromiumArgs(true),
  });
  const TWIST_KEY = "voxwright.twist";
  try {
    const page = await newPage(browser);
    await page.setViewport(MOBILE_VIEWPORT);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("dialog", (d) => void d.accept());
    const cdp = await page.createCDPSession();

    // -- helpers that talk to the page (as in the other suites) ---------------------------------
    const tapButton = async (selector: string): Promise<void> => {
      await page.evaluate((sel) => {
        document.querySelector(sel)?.scrollIntoView({ inline: "center", block: "center" });
      }, selector);
      const el = await page.$(selector);
      let box = el === null ? null : await el.boundingBox();
      // The toolbar may still be scrolling the button into view: a tap on a moving button is no click.
      for (let i = 0; el !== null && i < 30; i++) {
        await sleep(40);
        const next = await el.boundingBox();
        const still = next !== null && box !== null && next.x === box.x && next.y === box.y;
        box = next;
        if (still) break;
      }
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
      await sleep(600);
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
    const settleFrames = async (): Promise<void> => {
      await sleep(150);
      await page.evaluate(() => window.__voxwright?.renderer.whenIdle());
    };
    const state = (): Promise<{
      tool: string;
      inspected: Vec3 | null;
      pending: NonNullable<SessionView["pending"]> | null;
      message: string;
      undoCount: number;
    }> =>
      page.evaluate(() => {
        const s = (window.__voxwright as Vox).session();
        if (s === null) throw new Error("no editor session");
        return JSON.parse(
          JSON.stringify({
            tool: s.tool,
            inspected: s.inspected,
            pending: s.pending,
            message: s.message,
            undoCount: s.undoCount,
          }),
        );
      });
    /** Long enough since the last tap that the next one cannot pair with it. */
    const rest = (): Promise<void> => sleep(400);
    /**
     * After a multi-finger gesture Chromium turns the next tap into a click only after a moment (a tap
     * a few hundred ms later is delivered as pointer events but gets no click), so every gesture below
     * ends with this wait before a test taps a button again.
     */
    const calm = (): Promise<void> => sleep(700);
    const twist = async (
      center: { x: number; y: number },
      radius: number,
      degrees: number,
      steps = 12,
      endRadius = radius,
    ): Promise<void> => {
      await cdpTwist(cdp, center, radius, degrees, steps, endRadius);
      await calm();
    };
    /** One tap: the finger is down for 40 ms; nothing waits after it. */
    const quickTap = async (x: number, y: number): Promise<void> => {
      const finger = await page.touchscreen.touchStart(x, y);
      await sleep(40);
      await finger.end();
    };
    /** Two taps `gap` ms apart (lift to landing, plus the round trips of the test harness). */
    const doubleTap = async (
      a: { x: number; y: number },
      b: { x: number; y: number },
      gap = 80,
    ): Promise<void> => {
      await rest();
      await quickTap(a.x, a.y);
      await sleep(gap);
      await quickTap(b.x, b.y);
      await settleFrames();
    };
    const tapAt = async (x: number, y: number): Promise<void> => {
      await quickTap(x, y);
      await sleep(220);
    };
    const below = (p: { x: number; y: number }): { x: number; y: number } => ({
      x: Math.round(p.x),
      y: Math.round(p.y + OFFSET),
    });
    const targetOf = (p: TouchPose): Vec3 => computeTarget(p);
    const near = (a: readonly number[], b: readonly number[], tol: number): boolean =>
      a.every((v, i) => Math.abs(v - (b[i] as number)) <= tol);
    const fmt = (v: readonly number[]): string => `(${v.map((n) => n.toFixed(2)).join(", ")})`;
    const wrap = (deg: number): number => ((((deg + 180) % 360) + 360) % 360) - 180;
    const armTool = async (id: string): Promise<void> => {
      await tapButton(`[data-testid="tool-${id}"]`);
      ok((await state()).tool === id, t(`the ${id} tool is armed from the bottom toolbar`));
    };
    const canvasCenter = async (): Promise<{ x: number; y: number }> => {
      const box = await (await page.$('[data-testid="canvas"]'))?.boundingBox();
      if (!box) throw new Error("no canvas");
      return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
    };
    const emptySpot = (): Promise<{ x: number; y: number }> =>
      page.evaluate(() => {
        const s = (window.__voxwright as Vox).session() as NonNullable<ReturnType<Vox["session"]>>;
        for (const [x, y] of [
          [30, 130],
          [360, 130],
          [30, 640],
          [360, 640],
          [195, 120],
        ] as const) {
          if (
            s.pick(x, y) === null &&
            document.elementFromPoint(x, y)?.getAttribute("data-testid") === "canvas"
          )
            return { x, y };
        }
        throw new Error("no empty spot on the canvas");
      });
    const openMenu = async (): Promise<void> => {
      await tapButton('[data-testid="mobile-menu-btn"]');
      await page.waitForSelector('[data-testid="twist-toggle"] input', { timeout: 5000 });
      await page.$eval('[data-testid="twist-toggle"] input', (el) =>
        el.scrollIntoView({ block: "center" }),
      );
      await sleep(300);
    };
    const closeSheet = async (): Promise<void> => {
      await tapButton('[data-testid="bottom-sheet-close"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="bottom-sheet"]') === null,
        { timeout: 5000 },
      );
    };
    const twistBox = '[data-testid="twist-toggle"] input';
    const twistStored = (): Promise<string | null> =>
      page.evaluate((k) => localStorage.getItem(k), TWIST_KEY);

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
        targetOf(home),
      );
      await settleFrames();
    };
    const all = await tops();
    const topAt = (x: number, y: number, z: number): Top => {
      const found = all.find((c) => c.pos[0] === x && c.pos[1] === y && c.pos[2] === z);
      if (found === undefined) throw new Error(`no reachable top face at ${x},${y},${z}`);
      return found;
    };
    ok(
      home.azimuth === 45 && home.distance > 8 && (await state()).tool === "navigate",
      t(
        `View is the tool and the camera starts at azimuth 45, distance ${home.distance.toFixed(1)}`,
      ),
    );

    // =========================================================================
    // Double tap in View focuses the camera
    // =========================================================================
    const aim = topAt(6, 7, 6);
    const centreOf = (c: Top): Vec3 => [c.pos[0] + 0.5, c.pos[1] + 0.5, c.pos[2] + 0.5];
    const p0 = await pose();
    await rest();
    await quickTap(aim.pt.x, aim.pt.y);
    await settleFrames();
    const afterOne = await state();
    const p1 = await pose();
    ok(
      afterOne.inspected !== null &&
        near(afterOne.inspected, aim.pos, 0) &&
        near(targetOf(p1), targetOf(p0), 0.01) &&
        Math.abs(p1.distance - p0.distance) < 0.01,
      t("one tap inspects the block and does not touch the camera"),
    );
    await doubleTap(aim.pt, { x: aim.pt.x + 3, y: aim.pt.y + 2 }, 80);
    const p2 = await pose();
    const target2 = targetOf(p2);
    ok(
      near(target2, centreOf(aim), 0.02),
      t(
        `a double tap moves the orbit target to the centre of the tapped block (${fmt(target2)} vs ${fmt(centreOf(aim))})`,
      ),
    );
    ok(
      Math.abs(p2.distance - p0.distance / 2) < 0.02,
      t(`and halves the orbit distance (${p0.distance.toFixed(2)} -> ${p2.distance.toFixed(2)})`),
    );
    ok(
      Math.abs(p2.azimuth - p0.azimuth) < 0.05 && Math.abs(p2.elevation - p0.elevation) < 0.05,
      t("the view direction stays"),
    );
    const afterTwo = await state();
    ok(
      afterTwo.inspected !== null &&
        near(afterTwo.inspected, aim.pos, 0) &&
        afterTwo.undoCount === 0,
      t("the block stays inspected and nothing was edited"),
    );

    // Progressive zoom: each double tap halves again, down to 4 and no further
    let last = p2;
    let steps = 1;
    while (last.distance > 4.5 && steps < 8) {
      const at = await worldToPage(aim.pos[0] + 0.5, aim.pos[1] + 1, aim.pos[2] + 0.5);
      await doubleTap(at, at, 80);
      const now = await pose();
      const want = Math.max(4, last.distance / 2);
      ok(
        Math.abs(now.distance - want) < 0.02,
        t(
          `double tap ${steps + 1} halves again (${last.distance.toFixed(2)} -> ${now.distance.toFixed(2)}, wanted ${want.toFixed(2)})`,
        ),
      );
      last = now;
      steps++;
    }
    ok(
      Math.abs(last.distance - 4) < 0.02,
      t(`the zoom stops at 4 blocks (${last.distance.toFixed(2)})`),
    );
    const floorAt = await worldToPage(aim.pos[0] + 0.5, aim.pos[1] + 1, aim.pos[2] + 0.5);
    await doubleTap(floorAt, floorAt, 80);
    const floored = await pose();
    ok(
      Math.abs(floored.distance - 4) < 0.02 && near(targetOf(floored), centreOf(aim), 0.02),
      t(`one more double tap does not go below 4 (${floored.distance.toFixed(2)})`),
    );

    // A double tap elsewhere moves the target to that block
    await restoreCamera();
    const other = (await tops()).find((c) => c.pos[0] === 3 && c.pos[2] === 5);
    if (other === undefined) throw new Error("no block at x=3, z=5");
    await doubleTap(other.pt, other.pt, 80);
    const pOther = await pose();
    ok(
      near(targetOf(pOther), centreOf(other), 0.02) &&
        Math.abs(pOther.distance - home.distance / 2) < 0.02,
      t(
        `and from home again it focuses on another block (${other.pos.join(",")}) at half the distance`,
      ),
    );

    // Empty space: nothing happens
    await restoreCamera();
    const empty = await emptySpot();
    const pe0 = await pose();
    await doubleTap(empty, empty, 80);
    const pe1 = await pose();
    ok(
      near(pe1.position, pe0.position, 0.001) &&
        Math.abs(pe1.distance - pe0.distance) < 0.001 &&
        (await state()).inspected === null,
      t("a double tap on empty space does nothing"),
    );

    // A slow second tap is two single taps
    await restoreCamera();
    const slow0 = await pose();
    await rest();
    await quickTap(aim.pt.x, aim.pt.y);
    await sleep(500);
    await quickTap(aim.pt.x, aim.pt.y);
    await settleFrames();
    const slow1 = await pose();
    ok(
      near(slow1.position, slow0.position, 0.001) &&
        Math.abs(slow1.distance - slow0.distance) < 0.001,
      t("a second tap more than 300 ms after the first does not focus"),
    );
    ok((await state()).inspected !== null, t("and it inspects like any tap"));

    // Two taps far apart are two single taps
    await restoreCamera();
    const far0 = await pose();
    const aim2 = topAt(3, 6, 5);
    await doubleTap(aim.pt, aim2.pt, 80);
    const far1 = await pose();
    ok(
      Math.hypot(aim.pt.x - aim2.pt.x, aim.pt.y - aim2.pt.y) > 24 &&
        near(far1.position, far0.position, 0.001),
      t("taps more than 24 px apart do not focus"),
    );

    // An orbit between two taps breaks the pair
    await restoreCamera();
    await rest();
    await quickTap(aim.pt.x, aim.pt.y);
    await sleep(40);
    const dragger = await page.touchscreen.touchStart(aim.pt.x, aim.pt.y);
    await dragger.move(aim.pt.x + 14, aim.pt.y);
    await dragger.end();
    const orbitedFrom = await pose();
    await quickTap(aim.pt.x + 14, aim.pt.y);
    await settleFrames();
    const orbited = await pose();
    ok(
      Math.abs(orbited.distance - orbitedFrom.distance) < 0.001,
      t("an orbit between two quick taps breaks the pair"),
    );

    // With a tool armed, two quick taps are the tool's: the camera does not move
    await restoreCamera();
    await armTool("select");
    const tool0 = await pose();
    const cursor = below(aim.pt);
    await doubleTap(cursor, cursor, 80);
    const tool1 = await pose();
    const toolState = await state();
    ok(
      near(tool1.position, tool0.position, 0.001) &&
        Math.abs(tool1.distance - tool0.distance) < 0.001,
      t("two quick taps with Select armed do not focus the camera"),
    );
    ok(
      toolState.pending?.kind === "select" &&
        toolState.pending.b !== null &&
        toolState.undoCount === 0,
      t(`they are the tool's: corners A and B are set (${JSON.stringify(toolState.pending)})`),
    );
    await tapButton('[data-testid="cancel"]');
    await armTool("navigate");

    // =========================================================================
    // Zoom in here on the nudge pad
    // =========================================================================
    await restoreCamera();
    ok(
      (await page.$('[data-testid="nudge-zoom"]')) === null,
      t("the button is not there with nothing pending"),
    );
    await armTool("select");
    await tapAt(below(aim.pt).x, below(aim.pt).y);
    const armedA = (await state()).pending;
    ok(
      armedA?.kind === "select" &&
        armedA.a !== undefined &&
        near(armedA.a, aim.pos, 0) &&
        armedA.b === null,
      t(`a tap sets corner A (${JSON.stringify(armedA)})`),
    );
    const zoom = await page.$eval('[data-testid="nudge-zoom"]', (el) => {
      const r = el.getBoundingClientRect();
      return {
        w: r.width,
        h: r.height,
        name: el.getAttribute("aria-label"),
        text: el.textContent?.trim(),
      };
    });
    ok(
      zoom.w >= 47.99 && zoom.h >= 47.99,
      t(`the Zoom button is at least 48 x 48 px (${zoom.w} x ${zoom.h})`),
    );
    ok(
      zoom.name === "Zoom to the armed cell" && zoom.text === "Zoom",
      t(`its accessible name is "${zoom.name}" and it reads "${zoom.text}"`),
    );
    const noOverlap = await page.evaluate(() => {
      const z = (
        document.querySelector('[data-testid="nudge-zoom"]') as HTMLElement
      ).getBoundingClientRect();
      return [...document.querySelectorAll('[data-testid^="nudge-"]')]
        .filter(
          (el) =>
            el.getAttribute("data-testid") !== "nudge-zoom" &&
            el.getAttribute("data-testid") !== "nudge-pad",
        )
        .every((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.right <= z.left + 0.5 ||
            r.left >= z.right - 0.5 ||
            r.bottom <= z.top + 0.5 ||
            r.top >= z.bottom - 0.5
          );
        });
    });
    ok(noOverlap, t("and it overlaps no other button of the pad"));
    const z0 = await pose();
    await tapButton('[data-testid="nudge-zoom"]');
    await settleFrames();
    const z1 = await pose();
    ok(
      near(targetOf(z1), [aim.pos[0] + 0.5, aim.pos[1] + 0.5, aim.pos[2] + 0.5], 0.02) &&
        Math.abs(z1.distance - z0.distance / 2) < 0.02,
      t(
        `Zoom in here puts corner A in the middle and halves the distance (${fmt(targetOf(z1))}, ${z0.distance.toFixed(2)} -> ${z1.distance.toFixed(2)})`,
      ),
    );
    const afterZoom = await state();
    ok(
      afterZoom.pending?.kind === "select" &&
        afterZoom.undoCount === 0 &&
        afterZoom.message.startsWith("Zoomed in on "),
      t(
        `the pending corner stays, nothing is edited and the message line says so (${afterZoom.message})`,
      ),
    );
    // Nudge the corner up one block: the next zoom follows it
    await tapButton('[data-testid="nudge-up"]');
    await tapButton('[data-testid="nudge-zoom"]');
    await settleFrames();
    const z2 = await pose();
    ok(
      near(targetOf(z2), [aim.pos[0] + 0.5, aim.pos[1] + 1.5, aim.pos[2] + 0.5], 0.02),
      t(
        `after nudging the corner up one block, the next zoom is on its new cell (${fmt(targetOf(z2))})`,
      ),
    );
    ok(
      Math.abs(z2.distance - Math.min(z1.distance, Math.max(4, z1.distance / 2))) < 0.02,
      t(`and halves again, to at least 4 (${z2.distance.toFixed(2)})`),
    );
    // Two corners: Zoom follows the active one
    await tapButton('[data-testid="cancel"]');
    await restoreCamera();
    await tapAt(below(topAt(6, 7, 3).pt).x, below(topAt(6, 7, 3).pt).y);
    const cornerB = topAt(6, 7, 7);
    await tapAt(below(cornerB.pt).x, below(cornerB.pt).y);
    const both = (await state()).pending;
    ok(
      both?.kind === "select" && both.b !== null && both.active === "b",
      t(`B is set and active (${JSON.stringify(both)})`),
    );
    await tapButton('[data-testid="nudge-zoom"]');
    await settleFrames();
    const zb = await pose();
    ok(
      near(targetOf(zb), [6.5, 7.5, 7.5], 0.02),
      t(`with B active the zoom is on corner B (${fmt(targetOf(zb))})`),
    );
    await tapButton('[data-testid="nudge-corner"]');
    await tapButton('[data-testid="nudge-zoom"]');
    await settleFrames();
    const za = await pose();
    ok(
      near(targetOf(za), [6.5, 7.5, 3.5], 0.02),
      t(`and after switching to A it is on corner A (${fmt(targetOf(za))})`),
    );
    await tapButton('[data-testid="cancel"]');
    await armTool("navigate");
    await restoreCamera();

    // =========================================================================
    // Two-finger twist
    // =========================================================================
    const centre = await canvasCenter();
    const RADIUS = 50;
    const setElevation = async (deg: number): Promise<void> => {
      await page.evaluate(
        (e) => (window.__voxwright as Vox).renderer.setOrbit({ elevation: e }),
        deg,
      );
      await settleFrames();
    };
    /** The angle of the on-screen line between two world points on the same level, y down (clockwise is positive). */
    const screenAngle = async (around: Vec3): Promise<number> => {
      const a = await worldToPage(around[0] - 6, around[1], around[2]);
      const b = await worldToPage(around[0] + 6, around[1], around[2]);
      return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    };

    // The menu has the setting, on, and nothing is stored until it changes
    await openMenu();
    const twistLabel = await page.$eval('[data-testid="twist-toggle"]', (el) => ({
      text: el.textContent?.trim() ?? "",
      h: el.getBoundingClientRect().height,
    }));
    ok(
      twistLabel.text === "Twist with two fingers to turn",
      t(`Menu, Settings has "${twistLabel.text}"`),
    );
    ok(twistLabel.h >= 43.99, t(`it is at least 44 px tall (${twistLabel.h})`));
    ok(
      (await page.$eval(twistBox, (el) => (el as HTMLInputElement).checked)) &&
        (await twistStored()) === null,
      t("it starts on, and nothing is stored until it is changed"),
    );
    await closeSheet();

    const a0 = await pose();
    await twist(centre, RADIUS, 40);
    await settleFrames();
    const a1 = await pose();
    ok(
      Math.abs(wrap(a1.azimuth - a0.azimuth) - -30) < 1,
      t(
        `a 40 degree clockwise twist turns the azimuth by -30, the 10 degree dead zone is not made up (${a0.azimuth.toFixed(1)} -> ${a1.azimuth.toFixed(1)})`,
      ),
    );
    ok(
      Math.abs(a1.elevation - a0.elevation) < 0.05 &&
        Math.abs(a1.distance - a0.distance) / a0.distance < 0.02 &&
        near(targetOf(a1), targetOf(a0), 0.1),
      t("a pure twist leaves the tilt, the distance and the target alone"),
    );

    // The build turns the way the fingers turn: look straight down and measure on the screen
    await restoreCamera();
    await setElevation(89);
    const top0 = await pose();
    const around = targetOf(top0);
    const ang0 = await screenAngle(around);
    await twist(centre, RADIUS, 40);
    await settleFrames();
    const top1 = await pose();
    const ang1 = await screenAngle(targetOf(top1));
    ok(
      Math.abs(wrap(ang1 - ang0) - 30) < 3,
      t(
        `seen from above, the build turns clockwise on the screen, with the fingers (${wrap(ang1 - ang0).toFixed(1)} degrees for a 40 degree twist)`,
      ),
    );
    await twist(centre, RADIUS, -40);
    await settleFrames();
    const top2 = await pose();
    const ang2 = await screenAngle(targetOf(top2));
    ok(
      Math.abs(wrap(ang2 - ang1) - -30) < 3 && Math.abs(wrap(top2.azimuth - top1.azimuth) - 30) < 1,
      t(
        `and a counter-clockwise twist turns it back (${wrap(ang2 - ang1).toFixed(1)} degrees, azimuth ${top1.azimuth.toFixed(1)} -> ${top2.azimuth.toFixed(1)})`,
      ),
    );
    await restoreCamera();

    // The dead zone
    const d0 = await pose();
    await twist(centre, RADIUS, 5);
    await settleFrames();
    const d1 = await pose();
    ok(
      Math.abs(d1.azimuth - d0.azimuth) < 0.05 && Math.abs(d1.distance - d0.distance) < 0.05,
      t(
        `a 5 degree twist does not turn the view (${d0.azimuth.toFixed(2)} -> ${d1.azimuth.toFixed(2)})`,
      ),
    );
    await twist(centre, RADIUS, -9);
    await settleFrames();
    ok(
      Math.abs((await pose()).azimuth - d0.azimuth) < 0.05,
      t("nor does a 9 degree one the other way"),
    );
    await twist(centre, RADIUS, 20);
    await settleFrames();
    const d2 = await pose();
    ok(
      Math.abs(wrap(d2.azimuth - d0.azimuth) - -10) < 1,
      t(
        `a 20 degree twist turns it by 10, what lies beyond the dead zone (${wrap(d2.azimuth - d0.azimuth).toFixed(1)})`,
      ),
    );
    await restoreCamera();

    // Pinch and pan go on during a twist
    const c0 = await pose();
    await twist(centre, RADIUS, 40, 12, 90);
    await settleFrames();
    const c1 = await pose();
    ok(
      Math.abs(wrap(c1.azimuth - c0.azimuth) - -30) < 2,
      t(
        `a 40 degree twist that also spreads the fingers still turns the view by 30 (${wrap(c1.azimuth - c0.azimuth).toFixed(1)})`,
      ),
    );
    ok(
      c1.distance / c0.distance > 0.4 && c1.distance / c0.distance < 0.7,
      t(
        `and still zooms in (${c0.distance.toFixed(1)} -> ${c1.distance.toFixed(1)}, fingers 100 -> 180 px apart)`,
      ),
    );
    await restoreCamera();
    const v0 = await pose();
    await cdpTwoFingerPan(cdp, centre, { dx: 0, dy: -120 });
    await calm();
    await settleFrames();
    const v1 = await pose();
    ok(
      Math.abs(v1.azimuth - v0.azimuth) < 0.05 &&
        Math.abs(v1.elevation - v0.elevation) < 0.05 &&
        Math.hypot(...(targetOf(v1).map((n, i) => n - (targetOf(v0)[i] as number)) as Vec3)) > 0.5,
      t("a two-finger vertical drag is still a pan: no turn, no tilt, the target moves"),
    );
    await restoreCamera();

    // A twist with a touch tool armed and something pending turns the view and leaves the pending action
    await armTool("line");
    await tapAt(below(aim.pt).x, below(aim.pt).y);
    const pendBefore = JSON.stringify((await state()).pending);
    const l0 = await pose();
    await twist(centre, RADIUS, 40);
    await settleFrames();
    const l1 = await pose();
    ok(
      Math.abs(wrap(l1.azimuth - l0.azimuth) - -30) < 1 &&
        JSON.stringify((await state()).pending) === pendBefore &&
        (await state()).undoCount === 0,
      t("with Line armed and corner A set, a twist turns the view and changes nothing pending"),
    );
    await tapButton('[data-testid="cancel"]');
    await armTool("navigate");
    await restoreCamera();

    // Off: stored, applied at once, and a pinch still works
    await openMenu();
    await tapButton(twistBox);
    ok(
      !(await page.$eval(twistBox, (el) => (el as HTMLInputElement).checked)) &&
        (await twistStored()) === "false",
      t("turning it off stores false"),
    );
    await closeSheet();
    const o0 = await pose();
    await twist(centre, RADIUS, 40, 12, 90);
    await settleFrames();
    const o1 = await pose();
    ok(
      Math.abs(o1.azimuth - o0.azimuth) < 0.05,
      t(
        `with it off a twist does not turn the view (${o0.azimuth.toFixed(2)} -> ${o1.azimuth.toFixed(2)})`,
      ),
    );
    ok(
      o1.distance / o0.distance > 0.4 && o1.distance / o0.distance < 0.7,
      t("but pinch still zooms in the same gesture"),
    );
    await restoreCamera();

    // It survives a reload
    await page.reload();
    await startUp();
    await openFixture();
    await openMenu();
    ok(
      !(await page.$eval(twistBox, (el) => (el as HTMLInputElement).checked)),
      t("after a reload the checkbox still shows it off"),
    );
    await closeSheet();
    const r0 = await pose();
    await twist(centre, RADIUS, 40);
    await settleFrames();
    ok(Math.abs((await pose()).azimuth - r0.azimuth) < 0.05, t("and the twist is still off"));

    // On again
    await openMenu();
    await tapButton(twistBox);
    ok(
      (await page.$eval(twistBox, (el) => (el as HTMLInputElement).checked)) &&
        (await twistStored()) === "true",
      t("turning it on stores true"),
    );
    await closeSheet();
    const n0 = await pose();
    await twist(centre, RADIUS, -40);
    await settleFrames();
    const n1 = await pose();
    ok(
      Math.abs(wrap(n1.azimuth - n0.azimuth) - 30) < 1,
      t(
        `and the twist turns the view again (${n0.azimuth.toFixed(1)} -> ${n1.azimuth.toFixed(1)})`,
      ),
    );

    ok(
      errors.length === 0,
      t(`no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`),
    );
  } finally {
    await browser.close();
  }
}

/**
 * MB7, the phone performance pass: the Quality setting (Auto / High / Low) and what it does to the
 * pixel ratio, dynamic resolution while a touch gesture moves the view, and the limits of a touch-only
 * device (two mesher workers, a 16 MB undo history), read from the `?perf=1` overlay and from the
 * renderer. The desktop page keeps its defaults. The worker counts depend on the core count, so each
 * page pins `navigator.hardwareConcurrency` (8 cores for the phone and the desktop, 2 for a small
 * phone) and the test says the same on any machine. Antialiasing cannot be told apart here: the VM's
 * software WebGL starts without it in every mode.
 */
export async function touchQualitySuite(): Promise<void> {
  const t = (what: string): string => `[touch-quality] ${what}`;
  const browser = await puppeteer.launch({
    executablePath: chromium,
    headless: true,
    args: chromiumArgs(true),
  });
  const KEY = "voxwright.quality";
  const MB = 1024 * 1024;
  try {
    const page = await newPage(browser);
    // The worker counts below are a function of the core count: pin it (8 cores here, so the
    // renderer's own default is 4 and the touch cap of 2 is what applies).
    await pinCores(page, 8);
    await page.setViewport(MOBILE_VIEWPORT);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("dialog", (d) => void d.accept());
    const cdp = await page.createCDPSession();

    // -- helpers that talk to the page (as in the other suites) ---------------------------------
    const tapButton = async (selector: string): Promise<void> => {
      await page.evaluate((sel) => {
        document.querySelector(sel)?.scrollIntoView({ inline: "center", block: "center" });
      }, selector);
      const el = await page.$(selector);
      let box = el === null ? null : await el.boundingBox();
      for (let i = 0; el !== null && i < 30; i++) {
        await sleep(40);
        const next = await el.boundingBox();
        const still = next !== null && box !== null && next.x === box.x && next.y === box.y;
        box = next;
        if (still) break;
      }
      if (box === null) throw new Error(`no box for ${selector}`);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(150);
    };
    const startUp = async (p: typeof page): Promise<void> => {
      await p.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="status"]')
            ?.textContent?.startsWith("open a schematic"),
        { timeout: 30000 },
      );
      await sleep(600);
      if ((await p.$('[data-testid="restore-dialog"][open]')) !== null) {
        await p.click('[data-testid="discard"]');
        await p.waitForFunction(
          () => !document.querySelector('[data-testid="restore-dialog"][open]'),
        );
      }
    };
    const openFixture = async (p: typeof page): Promise<void> => {
      const file = (await p.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
      await file.uploadFile(join(fixtures, "Rafeals_house.nbt"));
      await p.waitForFunction(
        () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
        { timeout: 60000 },
      );
      await p.evaluate(() => window.__voxwright?.renderer.whenIdle());
    };
    /** The renderer's pixel ratio and the canvas's drawing buffer against its CSS width. */
    const buffer = (p: typeof page): Promise<{ ratio: number; width: number; css: number }> =>
      p.evaluate(() => {
        const c = document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement;
        return {
          ratio: (window.__voxwright as Vox).renderer.getPixelRatio(),
          width: c.width,
          css: c.clientWidth,
        };
      });
    const overlay = (p: typeof page, id: string): Promise<string> =>
      p.$eval(`[data-testid="${id}"]`, (el) => el.textContent?.trim() ?? "");
    const overlayIs = async (p: typeof page, id: string, text: string): Promise<boolean> => {
      try {
        await p.waitForFunction(
          (sel, want) =>
            document.querySelector(sel)?.textContent?.trim().replace(/\s+/g, " ") === want,
          { timeout: 3000 },
          `[data-testid="${id}"]`,
          text,
        );
        return true;
      } catch {
        return false;
      }
    };
    /** Record every call of renderer.setPixelRatio from now on. */
    const watchRatio = (p: typeof page): Promise<void> =>
      p.evaluate(() => {
        const r = (window.__voxwright as Vox).renderer;
        const w = window as unknown as { __ratios: number[]; __orig?: (v: number) => void };
        w.__ratios = [];
        if (w.__orig === undefined) w.__orig = r.setPixelRatio.bind(r);
        const orig = w.__orig;
        r.setPixelRatio = (v: number) => {
          w.__ratios.push(v);
          orig(v);
        };
      });
    const ratioLog = (p: typeof page): Promise<number[]> =>
      p.evaluate(() => (window as unknown as { __ratios: number[] }).__ratios.slice());
    const resetLog = (p: typeof page): Promise<void> =>
      p.evaluate(() => {
        (window as unknown as { __ratios: number[] }).__ratios = [];
      });
    const stored = (p: typeof page): Promise<string | null> =>
      p.evaluate((k) => localStorage.getItem(k), KEY);
    /** After a multi-finger gesture Chromium turns the next tap into a click only after a moment. */
    const calm = (): Promise<void> => sleep(700);
    const openMenu = async (): Promise<void> => {
      await tapButton('[data-testid="mobile-menu-btn"]');
      await page.waitForSelector('[data-testid="quality-seg"]', { timeout: 5000 });
      await page.$eval('[data-testid="quality-seg"]', (el) =>
        el.scrollIntoView({ block: "center" }),
      );
      await sleep(300);
    };
    const closeSheet = async (): Promise<void> => {
      await tapButton('[data-testid="bottom-sheet-close"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="bottom-sheet"]') === null,
        { timeout: 5000 },
      );
    };
    const choose = async (mode: "auto" | "high" | "low"): Promise<void> => {
      await openMenu();
      await tapButton(`[data-testid="quality-${mode}"]`);
    };
    const pressed = (mode: string): Promise<boolean> =>
      page.$eval(
        `[data-testid="quality-${mode}"]`,
        (el) => el.getAttribute("aria-pressed") === "true",
      );
    const reloadHint = async (): Promise<boolean> =>
      (await page.$('[data-testid="quality-reload-hint"]')) !== null;
    const centre = async (): Promise<{ x: number; y: number }> => {
      const box = await (await page.$('[data-testid="canvas"]'))?.boundingBox();
      if (!box) throw new Error("no canvas");
      return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
    };
    /** Two fingers go down, spread apart for a while, and `during` runs with them still down. */
    const heldPinch = async (during: () => Promise<void>): Promise<void> => {
      const c = await centre();
      const at = (spread: number) => [
        { x: c.x - spread / 2, y: c.y, id: 1 },
        { x: c.x + spread / 2, y: c.y, id: 2 },
      ];
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(100) });
      for (let i = 1; i <= 6; i++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: at(100 + i * 12),
        });
      }
      await during();
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await calm();
    };

    // -- a touch-only phone: Auto by default ---------------------------------------------------
    await page.goto(`${url}&perf=1`);
    await startUp(page);
    await openFixture(page);
    const start = await buffer(page);
    ok(
      start.ratio === 2 && start.width === start.css * 2,
      t(
        `at DPR 3 the idle ratio is 2 (renderer ${start.ratio}, buffer ${start.width} px for ${start.css} CSS px)`,
      ),
    );
    ok((await stored(page)) === null, t("nothing is stored until the setting is changed"));
    ok(
      (await overlayIs(page, "perf-dpr", "3.00")) &&
        (await overlayIs(page, "perf-ratio", "2.00")) &&
        (await overlayIs(page, "perf-quality", "auto")),
      t("the perf overlay shows DPR 3.00, ratio 2.00 and quality auto"),
    );
    const facts = await page.evaluate(() => {
      const v = window.__voxwright as Vox;
      return {
        workers: v.renderer.getWorkerCount(),
        cores: navigator.hardwareConcurrency,
        history: (v.session() as NonNullable<ReturnType<Vox["session"]>>).historyBytes,
        maxBytes: (v.session() as unknown as { editor: { history: { maxBytes: number } } }).editor
          .history.maxBytes,
      };
    });
    ok(
      facts.cores === 8 && facts.workers === 2,
      t(
        `a touch-only page with 8 cores runs 2 mesher workers (the desktop default would be 4; workers: ${facts.workers}, cores: ${facts.cores})`,
      ),
    );
    ok(
      facts.history === 16 * MB && facts.maxBytes === 16 * MB,
      t(`and keeps an undo history of 16 MB (${facts.history / MB} MB)`),
    );
    ok(
      (await overlayIs(page, "perf-workers", "2")) &&
        (await overlayIs(page, "perf-history", "16 MB")),
      t("the overlay shows 2 workers and a 16 MB history cap"),
    );

    // The menu: three segments of at least 44 px, Auto pressed, the hint, no reload note
    await openMenu();
    const seg = await page.evaluate(() =>
      ["auto", "high", "low"].map((m) => {
        const el = document.querySelector(`[data-testid="quality-${m}"]`) as HTMLElement;
        const r = el.getBoundingClientRect();
        return {
          m,
          w: r.width,
          h: r.height,
          text: el.textContent?.trim(),
          on: el.getAttribute("aria-pressed"),
        };
      }),
    );
    ok(
      seg.every((s) => s.h >= 43.99 && s.w >= 43.99) &&
        seg.map((s) => s.text).join() === "Auto,High,Low",
      t(
        `Menu, Settings has Auto, High and Low, each at least 44 px (${seg.map((s) => `${s.m} ${s.w}x${s.h}`).join(", ")})`,
      ),
    );
    ok(
      seg[0]?.on === "true" && seg[1]?.on === "false" && seg[2]?.on === "false",
      t("Auto is pressed at the start"),
    );
    const hint = await page.$eval('[data-testid="quality-hint"]', (el) => el.textContent ?? "");
    ok(
      /anti-aliasing/i.test(hint) && /next time/i.test(hint) && !(await reloadHint()),
      t(
        "the hint says anti-aliasing takes effect the next time the page loads, and no reload note shows yet",
      ),
    );
    await closeSheet();

    // -- Auto: the ratio drops while a gesture moves the view and comes back 200 ms after it stops
    await watchRatio(page);
    await heldPinch(async () => {
      const mid = await buffer(page);
      ok(
        mid.ratio === 1 && mid.width === mid.css,
        t(`Auto: during a pinch the ratio is 1 (buffer ${mid.width} px for ${mid.css} CSS px)`),
      );
      await sleep(500); // the fingers stay down and still
      const settled = await buffer(page);
      ok(
        settled.ratio === 2 && settled.width === settled.css * 2,
        t("and 200 ms after the last movement it is back to 2, with the fingers still down"),
      );
    });
    ok(
      JSON.stringify(await ratioLog(page)) === "[1,2]",
      t(
        `one resize when the pinch started and one when it settled (${JSON.stringify(await ratioLog(page))})`,
      ),
    );

    await resetLog(page);
    const c0 = await centre();
    const finger = await page.touchscreen.touchStart(c0.x, c0.y);
    for (let i = 1; i <= 6; i++) {
      await finger.move(c0.x + i * 15, c0.y + i * 5);
      await sleep(20);
    }
    ok((await buffer(page)).ratio === 1, t("Auto: during a one-finger orbit the ratio is 1"));
    await finger.end();
    await sleep(450);
    ok(
      (await buffer(page)).ratio === 2 && JSON.stringify(await ratioLog(page)) === "[1,2]",
      t(
        `and back to 2 after it, with one resize each way (${JSON.stringify(await ratioLog(page))})`,
      ),
    );

    for (const [what, run] of [
      ["a two-finger pan", () => cdpTwoFingerPan(cdp, c0, { dx: 40, dy: -30 })],
      ["a twist", () => cdpTwist(cdp, c0, 50, 40)],
    ] as const) {
      await resetLog(page);
      await run();
      await sleep(450);
      ok(
        JSON.stringify(await ratioLog(page)) === "[1,2]" && (await buffer(page)).ratio === 2,
        t(`Auto: ${what} drops the ratio to 1 once and brings it back once`),
      );
      await calm();
    }

    await resetLog(page);
    await tapButton('[data-testid="tool-navigate"]');
    const tapAt = await centre();
    await page.touchscreen.tap(tapAt.x, tapAt.y);
    await sleep(450);
    ok((await ratioLog(page)).length === 0, t("a tap does not move the view and changes nothing"));

    // -- High: always sharp ---------------------------------------------------------------------
    await choose("high");
    ok(
      (await pressed("high")) && !(await pressed("auto")) && (await stored(page)) === "high",
      t("High is pressed and stored"),
    );
    ok(
      !(await reloadHint()),
      t("going from Auto to High needs no reload note: antialiasing is the same"),
    );
    await closeSheet();
    await resetLog(page);
    await heldPinch(async () => {
      const mid = await buffer(page);
      ok(mid.ratio === 2 && mid.width === mid.css * 2, t("High: the ratio stays 2 during a pinch"));
    });
    ok((await ratioLog(page)).length === 0, t("and is never resized by a gesture"));
    ok(await overlayIs(page, "perf-quality", "high"), t("the overlay shows quality high"));

    // -- Low: ratio 1 at once, antialiasing waits for a reload -----------------------------------
    await resetLog(page);
    await choose("low");
    const low = await buffer(page);
    ok(
      low.ratio === 1 && low.width === low.css && JSON.stringify(await ratioLog(page)) === "[1]",
      t(`Low: the ratio is 1 at once (buffer ${low.width} px for ${low.css} CSS px), one resize`),
    );
    ok((await pressed("low")) && (await stored(page)) === "low", t("Low is pressed and stored"));
    ok(
      await reloadHint(),
      t("and the menu says anti-aliasing changes the next time the page loads"),
    );
    const hintText = await page.$eval(
      '[data-testid="quality-reload-hint"]',
      (el) => el.textContent ?? "",
    );
    ok(/next time the page loads/.test(hintText), t(`(${hintText.trim()})`));
    await closeSheet();
    ok(
      (await overlayIs(page, "perf-ratio", "1.00")) &&
        (await overlayIs(page, "perf-quality", "low")),
      t("the overlay shows ratio 1.00 and quality low"),
    );
    await resetLog(page);
    await heldPinch(async () => {
      ok((await buffer(page)).ratio === 1, t("Low: the ratio stays 1 during a pinch"));
    });
    ok((await ratioLog(page)).length === 0, t("and is never resized by a gesture"));

    // Back to Auto: the hint goes (the renderer was created with the default antialiasing)
    await resetLog(page);
    await choose("auto");
    ok(
      (await buffer(page)).ratio === 2 &&
        JSON.stringify(await ratioLog(page)) === "[2]" &&
        !(await reloadHint()),
      t("Auto again: the ratio is 2 at once and the reload note is gone"),
    );
    await closeSheet();

    // -- Low survives a reload, and from then on antialiasing is the page's own -------------------
    await choose("low");
    await closeSheet();
    await page.reload();
    await startUp(page);
    await openFixture(page);
    const afterReload = await buffer(page);
    ok(
      afterReload.ratio === 1 && afterReload.width === afterReload.css,
      t("after a reload Low is in force from the first frame (ratio 1)"),
    );
    ok(
      (await overlayIs(page, "perf-quality", "low")) &&
        (await overlayIs(page, "perf-ratio", "1.00")),
      t("and the overlay shows it"),
    );
    await openMenu();
    ok(
      (await pressed("low")) && !(await reloadHint()),
      t("the menu shows Low pressed and no reload note: the page was created with it"),
    );
    await tapButton('[data-testid="quality-high"]');
    ok(
      (await reloadHint()) && (await buffer(page)).ratio === 2,
      t(
        "choosing High now shows the reload note (antialiasing was off) and the ratio is 2 at once",
      ),
    );
    await closeSheet();
    await page.reload();
    await startUp(page);
    await openFixture(page);
    const high = await buffer(page);
    ok(
      high.ratio === 2 &&
        (await stored(page)) === "high" &&
        (await overlayIs(page, "perf-quality", "high")),
      t("High survives a reload too (ratio 2)"),
    );
    await page.evaluate((k) => localStorage.setItem(k, "bogus"), KEY);
    await page.reload();
    await startUp(page);
    await openFixture(page);
    ok(
      (await overlayIs(page, "perf-quality", "auto")) && (await buffer(page)).ratio === 2,
      t("a stored value that is not auto, high or low reads as Auto"),
    );

    // -- the desktop page keeps the defaults ------------------------------------------------------
    const desk = await newPage(browser);
    try {
      await pinCores(desk, 8);
      desk.on("pageerror", (e) => errors.push(String(e)));
      await desk.setViewport({ width: 1280, height: 800, deviceScaleFactor: 3 });
      await desk.goto(`${url}&perf=1`);
      await startUp(desk);
      await openFixture(desk);
      const d = await desk.evaluate(() => {
        const v = window.__voxwright as Vox;
        const c = document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement;
        return {
          ratio: v.renderer.getPixelRatio(),
          workers: v.renderer.getWorkerCount(),
          cores: navigator.hardwareConcurrency,
          history: (v.session() as NonNullable<ReturnType<Vox["session"]>>).historyBytes,
          width: c.width,
          css: c.clientWidth,
        };
      });
      ok(
        d.cores === 8 && d.workers === 4,
        t(
          `the desktop page keeps the default worker count, 4 with 8 cores (workers: ${d.workers}, cores: ${d.cores})`,
        ),
      );
      ok(d.history === 64 * MB, t(`and the 64 MB undo history (${d.history / MB} MB)`));
      ok(
        d.ratio === 2 && d.width === d.css * 2,
        t(`and the device's ratio, at most 2 (DPR 3 gives ${d.ratio})`),
      );
      ok(
        (await overlayIs(desk, "perf-workers", "4")) &&
          (await overlayIs(desk, "perf-history", "64 MB")) &&
          (await overlayIs(desk, "perf-quality", "auto")),
        t("the overlay shows them on the desktop page"),
      );
      ok(
        (await desk.$('[data-testid="quality-setting"]')) === null,
        t("the desktop layout has no Quality setting"),
      );
      await watchRatio(desk);
      const box = await (await desk.$('[data-testid="canvas"]'))?.boundingBox();
      if (!box) throw new Error("no desktop canvas");
      await desk.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await desk.mouse.down();
      await desk.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 8 });
      await desk.mouse.up();
      await sleep(450);
      ok(
        (await ratioLog(desk)).length === 0 && (await buffer(desk)).ratio === 2,
        t("a mouse orbit never changes the ratio"),
      );
    } finally {
      await desk.close();
    }

    // -- a two-core phone: min(2, 2 - 1) is one worker ---------------------------------------------
    const small = await newPage(browser);
    try {
      await pinCores(small, 2);
      small.on("pageerror", (e) => errors.push(String(e)));
      await small.setViewport(MOBILE_VIEWPORT);
      await small.goto(`${url}&perf=1`);
      await startUp(small);
      await openFixture(small);
      const s = await small.evaluate(() => {
        const v = window.__voxwright as Vox;
        return {
          workers: v.renderer.getWorkerCount(),
          cores: navigator.hardwareConcurrency,
          history: (v.session() as NonNullable<ReturnType<Vox["session"]>>).historyBytes,
        };
      });
      ok(
        s.cores === 2 && s.workers === 1,
        t(
          `a touch-only page with 2 cores runs 1 mesher worker (workers: ${s.workers}, cores: ${s.cores})`,
        ),
      );
      ok(
        s.history === 16 * MB &&
          (await overlayIs(small, "perf-workers", "1")) &&
          (await overlayIs(small, "perf-history", "16 MB")),
        t("the overlay shows 1 worker and the 16 MB history cap"),
      );
    } finally {
      await small.close();
    }

    ok(
      errors.length === 0,
      t(`no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`),
    );
  } finally {
    await browser.close();
  }
}

/**
 * MB8, polish and accessibility: the undo toast, the haptics, the optional multi-finger shortcuts, the
 * left-handed mirror of every floating control, the first-run walkthrough, the buttons that stand in
 * for gestures, the touch help, and axe-core on the whole page in every mobile state (no rule
 * switched off, nothing excluded), with the focus order of the sheets. Real touch events over CDP;
 * `navigator.vibrate` is replaced by a recorder before the page's scripts run.
 */
export async function touchPolishSuite(): Promise<void> {
  const t = (what: string): string => `[touch-polish] ${what}`;
  const downloads = await mkdtemp(join(tmpdir(), "voxwright-mb8-"));
  const browser = await puppeteer.launch({
    executablePath: chromium,
    headless: true,
    args: chromiumArgs(true),
  });
  const INTRO_KEY = "voxwright.touchintro";
  const HAPTICS_KEY = "voxwright.haptics";
  const TWO_KEY = "voxwright.twofingerundo";
  const THREE_KEY = "voxwright.threefingerredo";
  const LEFT_KEY = "voxwright.lefthanded";
  const VIEW_W = MOBILE_VIEWPORT.width;
  type Rect = { x: number; y: number; w: number; h: number; right: number; bottom: number };
  try {
    // A plain page: the first-run card is shown to it, as to a first visit.
    const page = await browser.newPage();
    await page.setViewport(MOBILE_VIEWPORT);
    await page.evaluateOnNewDocument(() => {
      const w = window as unknown as { __vibes: number[] };
      w.__vibes = [];
      (navigator as unknown as { vibrate: (p: number) => boolean }).vibrate = (p: number) => {
        w.__vibes.push(p);
        return true;
      };
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("dialog", (d) => void d.accept());
    const cdp = await page.createCDPSession();
    await cdp.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloads,
      eventsEnabled: true,
    });

    // -- helpers that talk to the page (as in the other suites) ---------------------------------
    const tapButton = async (selector: string): Promise<void> => {
      await page.evaluate((sel) => {
        document.querySelector(sel)?.scrollIntoView({ inline: "center", block: "center" });
      }, selector);
      const el = await page.$(selector);
      let b = el === null ? null : await el.boundingBox();
      for (let i = 0; el !== null && i < 30; i++) {
        await sleep(40);
        const next = await el.boundingBox();
        const still = next !== null && b !== null && next.x === b.x && next.y === b.y;
        b = next;
        if (still) break;
      }
      if (b === null) throw new Error(`no box for ${selector}`);
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await sleep(150);
    };
    const startUp = async (): Promise<void> => {
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="status"]')
            ?.textContent?.startsWith("open a schematic"),
        { timeout: 30000 },
      );
      await sleep(600);
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
      await sleep(200);
    };
    const reload = async (): Promise<void> => {
      await page.reload();
      await startUp();
      await openFixture();
    };
    const settleFrames = async (): Promise<void> => {
      await sleep(150);
      await page.evaluate(() => window.__voxwright?.renderer.whenIdle());
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
    interface Snap {
      tool: string;
      block: string;
      undoCount: number;
      canUndo: boolean;
      canRedo: boolean;
      message: string;
      error: string;
      inspected: Vec3 | null;
      pending: NonNullable<SessionView["pending"]> | null;
      lastChange: SessionView["lastChange"];
    }
    const state = (): Promise<Snap> =>
      page.evaluate(() => {
        const s = (window.__voxwright as Vox).session();
        if (s === null) throw new Error("no editor session");
        return JSON.parse(
          JSON.stringify({
            tool: s.tool,
            block: s.block,
            undoCount: s.undoCount,
            canUndo: s.canUndo,
            canRedo: s.canRedo,
            message: s.message,
            error: s.error,
            inspected: s.inspected,
            pending: s.pending,
            lastChange: s.lastChange,
          }),
        ) as Snap;
      });
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
    const setBlock = (block: string): Promise<void> =>
      page.evaluate((b) => {
        (window.__voxwright as Vox).session()!.chooseBlock(b); // as the palette does: the quick row learns it
      }, block);
    const quickTap = async (x: number, y: number): Promise<void> => {
      const finger = await page.touchscreen.touchStart(x, y);
      await sleep(40);
      await finger.end();
    };
    const tapAt = async (x: number, y: number): Promise<void> => {
      await quickTap(x, y);
      await sleep(220);
    };
    const below = (p: { x: number; y: number }): { x: number; y: number } => ({
      x: Math.round(p.x),
      y: Math.round(p.y + OFFSET),
    });
    /** After a multi-finger gesture Chromium turns the next tap into a click only after a moment. */
    const calm = (): Promise<void> => sleep(700);
    /** Fingers down together for `hold` ms, then all up. */
    const multiTap = async (points: { x: number; y: number }[], hold = 60): Promise<void> => {
      const tp = points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 }));
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp });
      await sleep(hold);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await calm();
    };
    const box = (sel: string): Promise<Rect> =>
      page.$eval(sel, (el) => {
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom };
      });
    const exists = async (sel: string): Promise<boolean> => (await page.$(sel)) !== null;
    const overlaps = (a: Rect, b: Rect): boolean =>
      a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
    const stored = (k: string): Promise<string | null> =>
      page.evaluate((name) => localStorage.getItem(name), k);
    const vibes = (): Promise<number[]> =>
      page.evaluate(() => (window as unknown as { __vibes: number[] }).__vibes.slice());
    const clearVibes = (): Promise<void> =>
      page.evaluate(() => {
        (window as unknown as { __vibes: number[] }).__vibes.length = 0;
      });
    const text = (sel: string): Promise<string> =>
      page.$eval(sel, (el) => (el.textContent ?? "").replace(/\s+/g, " ").trim());
    const attr = (sel: string, name: string): Promise<string | null> =>
      page.$eval(sel, (el, n) => el.getAttribute(n), name);
    const openMenu = async (): Promise<void> => {
      await tapButton('[data-testid="mobile-menu-btn"]');
      await page.waitForSelector('[data-testid="menu-sheet"]', { timeout: 5000 });
      await sleep(300);
    };
    const closeSheet = async (): Promise<void> => {
      await tapButton('[data-testid="bottom-sheet-close"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="bottom-sheet"]') === null,
        { timeout: 5000 },
      );
    };
    /** Tap a checkbox in the menu (opening the menu and closing it again). */
    const setMenuCheckbox = async (testid: string, on: boolean): Promise<void> => {
      await openMenu();
      const sel = `[data-testid="${testid}"] input`;
      const now = await page.$eval(sel, (el) => (el as HTMLInputElement).checked);
      if (now !== on) await tapButton(sel);
      await closeSheet();
    };
    const sheetRect = (): Promise<Rect> => box('[data-testid="bottom-sheet"]');
    /** Put everything away: no sheet, no pending, View, nothing to undo. */
    const reset = async (): Promise<void> => {
      if (await exists('[data-testid="bottom-sheet"]')) await closeSheet();
      await page.evaluate(() => {
        const s = (window.__voxwright as Vox).session()!;
        const raw = s as unknown as { cancelPending(): void };
        raw.cancelPending();
        s.setSelection(null);
        s.setTool("navigate");
        while (s.canUndo) s.undo();
      });
      await settleFrames();
    };

    // -- axe on the whole page, and the other checks every state gets ---------------------------
    const axeSource = readFileSync(
      createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
      "utf8",
    );
    const axeWhole = async (): Promise<{ violations: string[]; incomplete: number }> => {
      await page.evaluate(axeSource);
      return page.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: {
              run(
                ctx: object,
                options: object,
              ): Promise<{
                violations: { id: string; nodes: { target: unknown[] }[] }[];
                incomplete: unknown[];
              }>;
            };
          }
        ).axe;
        const r = await axe.run(document, { resultTypes: ["violations", "incomplete"] });
        return {
          violations: r.violations.map(
            (v) =>
              `${v.id} (${v.nodes
                .slice(0, 3)
                .map((n) => n.target.join(" "))
                .join(" | ")})`,
          ),
          incomplete: r.incomplete.length,
        };
      });
    };
    /** Whole-page axe-core with every rule on, no horizontal scroll at 390 px, and a name on every control. */
    const stateIsClean = async (label: string): Promise<void> => {
      const r = await axeWhole();
      ok(
        r.violations.length === 0,
        t(
          `axe-core finds no violations on the whole page: ${label}${r.violations.length ? ` -- ${r.violations.join("; ")}` : ""}`,
        ),
      );
      const wide = await page.evaluate(() => {
        const sheet = document.querySelector('[data-testid="bottom-sheet-content"]');
        return {
          doc: document.documentElement.scrollWidth,
          view: window.innerWidth,
          sheet: sheet === null ? 0 : sheet.scrollWidth - sheet.clientWidth,
        };
      });
      ok(
        wide.doc <= wide.view && wide.sheet <= 0,
        t(
          `${label}: no horizontal scroll at ${wide.view} px (page ${wide.doc}, sheet +${wide.sheet})`,
        ),
      );
      const unnamed = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>(
          'button, [role="button"], [role="switch"], input:not([type="hidden"]), select, textarea',
        )) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          if (el.closest('[aria-hidden="true"]') !== null) continue; // out of the accessibility tree
          const labelled = el.getAttribute("aria-labelledby");
          const byRef =
            labelled !== null
              ? labelled
                  .split(/\s+/)
                  .map((id) => document.getElementById(id)?.textContent ?? "")
                  .join(" ")
              : "";
          const labels = (el as HTMLInputElement).labels;
          const byLabel = labels && labels.length > 0 ? (labels[0]?.textContent ?? "") : "";
          const name = (
            el.getAttribute("aria-label") ||
            byRef ||
            byLabel ||
            el.textContent ||
            el.getAttribute("title") ||
            ""
          ).trim();
          if (name === "") out.push(el.getAttribute("data-testid") ?? el.tagName.toLowerCase());
        }
        return out;
      });
      ok(
        unnamed.length === 0,
        t(`${label}: every control has a name${unnamed.length ? ` (${unnamed.join(", ")})` : ""}`),
      );
    };

    // -- setup: a first visit ---------------------------------------------------------------------
    await page.goto(url);
    await startUp();
    await openFixture();
    const home = await pose();
    const homeTarget = computeTarget(home);
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
        homeTarget,
      );
      await settleFrames();
    };
    const all = await tops();
    const canvasBox = await box('[data-testid="canvas"]');
    /** Cells whose top a tap can reach with the cursor 64 px above the finger, well clear of the controls. */
    const reachable = all
      .filter((c) => {
        const f = below(c.pt);
        return f.y > 330 && f.y < 560 && f.x > 40 && f.x < 350 && c.pt.y > 250;
      })
      .sort(
        (a, b) => Math.hypot(a.pt.x - 195, a.pt.y - 420) - Math.hypot(b.pt.x - 195, b.pt.y - 420),
      );
    const spread: Top[] = [];
    for (const c of reachable) {
      if (spread.every((o) => Math.hypot(o.pt.x - c.pt.x, o.pt.y - c.pt.y) > 36)) spread.push(c);
      if (spread.length >= 8) break;
    }
    ok(spread.length >= 6, t(`the fixture has ${spread.length} well-spaced cells to tap`));
    ok(canvasBox.w === VIEW_W, t("the canvas fills the 390 px viewport"));

    // ==== 1. the first-run walkthrough ===========================================================
    ok(await exists('[data-testid="touch-intro"]'), t("a first visit shows the quick start card"));
    const steps = await page.$$eval('[data-testid="touch-intro"] li', (els) =>
      els.map((el) => ({
        text: (el.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/^(Done|To do): /, ""),
        done: el.getAttribute("data-done"),
      })),
    );
    ok(
      steps.length === 3 &&
        steps[0]?.text === "Choose Place and tap the picture" &&
        steps[1]?.text === "Tap Undo" &&
        steps[2]?.text === "Open Menu and Export" &&
        steps.every((s) => s.done === "false"),
      t("it has the three steps, none done"),
    );
    ok(
      (await text('[data-testid="touch-intro-count"]')) === "0 of 3 done",
      t("and says 0 of 3 done"),
    );
    const intro = await box('[data-testid="touch-intro"]');
    const topBar = await box('[data-testid="top-app-bar"]');
    const barBottom = await box('[data-testid="bottom-toolbar"]');
    const cluster = await box('[data-testid="thumb-cluster"]');
    const menuBtn = await box('[data-testid="mobile-menu-btn"]');
    const toolBtns = await page.$$eval('[data-testid="toolbar"] button', (els) =>
      els.map((el) => {
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom };
      }),
    );
    ok(
      intro.y >= topBar.bottom - 0.5 &&
        !overlaps(intro, barBottom) &&
        !overlaps(intro, cluster) &&
        !overlaps(intro, menuBtn) &&
        toolBtns.every((b) => !overlaps(intro, b)),
      t(
        `the card (y ${intro.y.toFixed(0)}-${intro.bottom.toFixed(0)}) covers none of the controls it points at: the Menu button, the tools, Undo`,
      ),
    );
    ok(
      !(await exists('[data-testid="bottom-sheet-backdrop"]')) &&
        (await page.evaluate(
          () => document.elementFromPoint(195, 420)?.getAttribute("data-testid") === "canvas",
        )),
      t("it has no backdrop: the picture under the screen's middle still gets the touch"),
    );
    const closeBtn = await box('[data-testid="touch-intro-close"]');
    ok(
      closeBtn.w >= 43.99 && closeBtn.h >= 43.99,
      t(`its close button is at least 44 px (${closeBtn.w.toFixed(0)} x ${closeBtn.h.toFixed(0)})`),
    );
    ok(
      (await attr('[data-testid="touch-intro-close"]', "aria-label")) === "Close the quick start",
      t("and has a name"),
    );
    await stateIsClean("the walkthrough shown");

    // Step 1: choose Place and tap the picture
    await tapButton('[data-testid="tool-place"]');
    await setBlock(GOLD);
    const cell1 = spread[0] as Top;
    const before1 = await cells();
    await clearVibes();
    await tapAt(below(cell1.pt).x, below(cell1.pt).y);
    const s1 = await state();
    const diff1 = await changed(before1);
    ok(
      s1.undoCount === 1 && diff1.length === 1,
      t(`a tap with Place changes one block (${diff1.length})`),
    );
    ok(
      (await attr('[data-testid="touch-intro"] li[data-step="edit"]', "data-done")) === "true" &&
        (await attr('[data-testid="touch-intro"] li[data-step="undo"]', "data-done")) === "false" &&
        (await text('[data-testid="touch-intro-count"]')) === "1 of 3 done",
      t("the first step ticks itself: 1 of 3 done"),
    );

    // The toast that follows, and where it is
    ok(
      (await attr('[data-testid="undo-toast"]', "data-shown")) === "true" &&
        (await text('[data-testid="undo-toast-text"]')) === "Placed 1 block",
      t('the toast says "Placed 1 block"'),
    );
    ok(
      s1.lastChange?.count === 1 && s1.lastChange.count === diff1.length,
      t("and its count is the number of blocks the command changed"),
    );
    ok(
      (await attr('[data-testid="undo-toast-text"]', "role")) === "status",
      t("the words are in a role=status region"),
    );
    const toast = await box('[data-testid="undo-toast"]');
    const readout = await box('[data-testid="bottom-toolbar"]');
    const hotbar = (await exists('[data-testid="hotbar-compact"]'))
      ? await box('[data-testid="hotbar-compact"]')
      : null;
    const cluster2 = await box('[data-testid="thumb-cluster"]');
    ok(
      toast.y >= topBar.bottom &&
        !overlaps(toast, cluster2) &&
        !overlaps(toast, readout) &&
        (hotbar === null || !overlaps(toast, hotbar)) &&
        !overlaps(toast, intro) &&
        toast.bottom < cluster2.y,
      t(
        `the toast (y ${toast.y.toFixed(0)}-${toast.bottom.toFixed(0)}) is under the top bar and covers neither the thumb cluster, the readout line, the toolbar nor the walkthrough card`,
      ),
    );
    const undoBtn = await box('[data-testid="undo-toast-undo"]');
    ok(
      undoBtn.h >= 47.99 && undoBtn.w >= 47.99,
      t(`the toast's Undo is at least 48 px (${undoBtn.w.toFixed(0)} x ${undoBtn.h.toFixed(0)})`),
    );
    ok(
      (await vibes()).join() === "10",
      t(`one commit buzzed the phone for 10 ms (${(await vibes()).join(",")})`),
    );
    await stateIsClean("the toast and the walkthrough shown together");

    // Step 2: tap Undo (the thumb cluster's)
    await tapButton('[data-testid="undo"]');
    const s2 = await state();
    ok(s2.undoCount === 0 && (await changed(before1)).length === 0, t("Undo takes the block away"));
    ok(
      (await attr('[data-testid="touch-intro"] li[data-step="undo"]', "data-done")) === "true" &&
        (await text('[data-testid="touch-intro-count"]')) === "2 of 3 done",
      t("the second step ticks itself: 2 of 3 done"),
    );
    ok(
      (await attr('[data-testid="undo-toast"]', "data-shown")) === "false" &&
        (await text('[data-testid="undo-toast-text"]')) === "",
      t("the toast is gone once the entry was undone another way"),
    );
    ok((await vibes()).join() === "10", t("undo does not buzz"));

    // Step 3: open the menu and export
    await openMenu();
    ok(
      (await attr('[data-testid="touch-intro"] li[data-step="export"]', "data-done")) === "false",
      t("the card is still behind the menu with the third step undone"),
    );
    await tapButton('[data-testid="mobile-convert"]');
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="touch-intro"] li[data-step="export"]')
          ?.getAttribute("data-done") === "true" ||
        document.querySelector('[data-testid="touch-intro"]') === null,
      { timeout: 15000 },
    );
    ok(true, t("exporting ticks the third step"));
    await page.waitForFunction(
      () => document.querySelector('[data-testid="touch-intro"]') === null,
      {
        timeout: 5000,
      },
    );
    ok(
      (await stored(INTRO_KEY)) === "done",
      t("with all three done the card closes by itself and the browser remembers it"),
    );
    await closeSheet();
    await reload();
    ok(
      !(await exists('[data-testid="touch-intro"]')),
      t("after a reload the card does not come back"),
    );

    // Show tips brings it back; closing it with the button is remembered too
    await openMenu();
    await tapButton('[data-testid="show-tips"]');
    await sleep(200);
    ok(
      (await exists('[data-testid="touch-intro"]')) &&
        !(await exists('[data-testid="bottom-sheet"]')) &&
        (await text('[data-testid="touch-intro-count"]')) === "0 of 3 done",
      t('"Show tips" in the menu shows the card again with every step to do, and closes the menu'),
    );
    await tapButton('[data-testid="touch-intro-close"]');
    ok(
      !(await exists('[data-testid="touch-intro"]')) && (await stored(INTRO_KEY)) === "done",
      t("the close button closes it"),
    );
    await page.evaluate((k) => localStorage.removeItem(k), INTRO_KEY);
    await reload();
    ok(await exists('[data-testid="touch-intro"]'), t("without the stored mark it shows again"));
    await tapButton('[data-testid="touch-intro-close"]');
    await reload();
    ok(
      !(await exists('[data-testid="touch-intro"]')),
      t("and a card closed with its button stays closed after a reload"),
    );

    // ==== 2. the undo toast ======================================================================
    await clearVibes();
    await tapButton('[data-testid="tool-place"]');
    await setBlock(GOLD);
    const before2 = await cells();
    const cellA = spread[1] as Top;
    const cellB = spread[2] as Top;
    await tapAt(below(cellA.pt).x, below(cellA.pt).y);
    const firstId = (await state()).lastChange?.id ?? -1;
    await tapAt(below(cellB.pt).x, below(cellB.pt).y);
    const s3 = await state();
    ok(
      s3.undoCount === 2 && (s3.lastChange?.id ?? -1) > firstId,
      t("a second edit replaces the toast: it is the newest entry's"),
    );
    ok(
      (await page.$$('[data-testid="undo-toast-undo"]')).length === 1,
      t("there is one toast with one Undo"),
    );
    await tapButton('[data-testid="undo-toast-undo"]');
    const s4 = await state();
    const diff4 = await changed(before2);
    ok(
      s4.undoCount === 1 &&
        diff4.length === 1 &&
        diff4[0] === `${cellA.pos[0]},${cellA.pos[1] + 1},${cellA.pos[2]}`,
      t(`the toast's Undo takes back only the newest edit; the first stays (${diff4.join(" ")})`),
    );
    ok(
      (await attr('[data-testid="undo-toast"]', "data-shown")) === "false" &&
        s4.lastChange === null,
      t("and the toast is gone afterwards"),
    );
    ok(
      (await vibes()).join() === "10,10",
      t(`two commits buzzed twice, the Undo did not (${(await vibes()).join(",")})`),
    );

    // A stale toast cannot undo the wrong entry
    const cellC = spread[3] as Top;
    await tapAt(below(cellC.pt).x, below(cellC.pt).y);
    const idC = (await state()).lastChange?.id ?? -1;
    const staleUndone = await page.evaluate((id) => {
      const s = (window.__voxwright as Vox).session() as unknown as {
        undoChange(i: number): boolean;
        undo(): void;
      };
      s.undo(); // the thumb cluster
      return s.undoChange(id);
    }, idC);
    ok(
      staleUndone === false && (await state()).undoCount === 1,
      t("a toast whose entry was already undone cannot undo the one before it"),
    );
    await reset();

    // The count is what the command changed: a stroke, a line
    const run = ((): [Top, Top] | null => {
      for (const a of all) {
        const row = [1, 2, 3].map((d) =>
          all.find(
            (c) => c.pos[0] === a.pos[0] + d && c.pos[1] === a.pos[1] && c.pos[2] === a.pos[2],
          ),
        );
        if (row.every((c) => c !== undefined)) {
          const b = row[2] as Top;
          const f = below(a.pt);
          const g = below(b.pt);
          if (
            Math.min(f.y, g.y) > 200 &&
            Math.max(f.y, g.y) < 620 &&
            Math.min(f.x, g.x) > 20 &&
            Math.max(f.x, g.x) < 370
          )
            return [a, b];
        }
      }
      return null;
    })();
    ok(run !== null, t("the fixture has a straight run of four tops to paint along"));
    if (run !== null) {
      await tapButton('[data-testid="tool-place"]');
      await setBlock(GOLD);
      const beforeS = await cells();
      const f = below(run[0].pt);
      const g = below(run[1].pt);
      await cdpTouchDrag(cdp, f, g, 10);
      await sleep(300);
      const sS = await state();
      const dS = await changed(beforeS);
      ok(
        sS.undoCount === 1 &&
          sS.lastChange !== null &&
          sS.lastChange.count === dS.length &&
          dS.length >= 2,
        t(
          `a stroke is one entry and the toast counts what it changed (${sS.lastChange?.text}, ${dS.length} cells)`,
        ),
      );
      ok(
        (await text('[data-testid="undo-toast-text"]')) === `Placed ${dS.length} blocks`,
        t("and says so"),
      );
      const shownBefore = await attr('[data-testid="undo-toast"]', "data-shown");
      await tapButton('[data-testid="undo-toast-undo"]');
      const left = await changed(beforeS);
      ok(
        left.length === 0,
        t(
          `one press of the toast's Undo takes the whole stroke back (toast shown ${shownBefore}, ${left.length} cells left: ${left.join(" ")}, undo steps ${(await state()).undoCount})`,
        ),
      );
    }
    await reset();
    {
      await tapButton('[data-testid="tool-line"]');
      await setBlock(GOLD);
      const beforeL = await cells();
      const a = spread[4] as Top;
      const b = spread[5] as Top;
      await tapAt(below(a.pt).x, below(a.pt).y);
      await tapAt(below(b.pt).x, below(b.pt).y);
      await tapButton('[data-testid="confirm"]');
      const sL = await state();
      const dL = await changed(beforeL);
      ok(
        sL.lastChange?.label === "line" &&
          sL.lastChange.count === dL.length &&
          /^Drew a line of \d+ blocks$/.test(await text('[data-testid="undo-toast-text"]')),
        t(
          `a confirmed line says "${sL.lastChange?.text}" and its count (${sL.lastChange?.count}) is the ${dL.length} cells that changed`,
        ),
      );
      // the pad and the toast together: no overlap
      await tapAt(below(spread[6]!.pt).x, below(spread[6]!.pt).y); // line armed again: corner A
      await sleep(150);
      const withPad =
        (await exists('[data-testid="nudge-pad"]')) && (await state()).pending !== null;
      const t2 = await box('[data-testid="undo-toast"]');
      const shown = (await attr('[data-testid="undo-toast"]', "data-shown")) === "true";
      if (withPad && shown) {
        const pad = await box('[data-testid="nudge-pad"]');
        const cl = await box('[data-testid="thumb-cluster"]');
        const ro = await box('[data-testid="bottom-toolbar"]');
        ok(
          !overlaps(t2, pad) && !overlaps(t2, cl) && !overlaps(t2, ro),
          t(
            "with the nudge pad up too, the toast covers neither the pad, the cluster nor the toolbar",
          ),
        );
        await stateIsClean("something pending with the toast shown");
      } else {
        ok(false, t(`the pad and the toast were up together (pad ${withPad}, toast ${shown})`));
      }
    }
    await reset();

    // The toast leaves by itself after about four seconds
    await tapButton('[data-testid="tool-place"]');
    await setBlock(GOLD);
    await tapAt(below((spread[7] as Top).pt).x, below((spread[7] as Top).pt).y);
    ok((await attr('[data-testid="undo-toast"]', "data-shown")) === "true", t("a toast is up"));
    await sleep(3000);
    ok(
      (await attr('[data-testid="undo-toast"]', "data-shown")) === "true",
      t("it is still up after 3 s"),
    );
    await sleep(1500);
    ok(
      (await attr('[data-testid="undo-toast"]', "data-shown")) === "false" &&
        (await state()).undoCount === 1,
      t("and gone after about 4 s, with the edit kept"),
    );
    // It does not take the focus
    const focusBefore = await page.evaluate(() => document.activeElement?.tagName ?? "");
    await tapAt(below((spread[0] as Top).pt).x, below((spread[0] as Top).pt).y);
    const focusAfter = await page.evaluate(() => document.activeElement?.tagName ?? "");
    ok(focusBefore === focusAfter, t(`showing a toast does not move the focus (${focusBefore})`));
    // Reduced motion
    const anim = (): Promise<string> =>
      page.$eval('[data-testid="undo-toast"]', (el) => getComputedStyle(el).animationName);
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
    await tapAt(below((spread[1] as Top).pt).x, below((spread[1] as Top).pt).y);
    const withMotion = await anim();
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await tapAt(below((spread[2] as Top).pt).x, below((spread[2] as Top).pt).y);
    const reduced = await anim();
    ok(
      withMotion !== "none" && reduced === "none",
      t(`the toast slides in only without reduced motion (${withMotion} / ${reduced})`),
    );
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
    await reset();

    // ==== 3. haptics =============================================================================
    await openMenu();
    ok(
      (await page.$eval(
        '[data-testid="haptics-input"]',
        (el) => (el as HTMLInputElement).checked,
      )) === true && (await stored(HAPTICS_KEY)) === null,
      t('"Vibrate on edits" is on by default and nothing is stored yet'),
    );
    ok(
      (await text('[data-testid="haptics-toggle"]')).includes("Vibrate on edits"),
      t("it is named in the menu's Settings"),
    );
    await closeSheet();
    await tapButton('[data-testid="tool-line"]');
    await setBlock(GOLD);
    await clearVibes();
    await tapAt(below((spread[0] as Top).pt).x, below((spread[0] as Top).pt).y);
    await tapButton('[data-testid="cancel"]');
    ok(
      (await vibes()).join() === "20",
      t(`cancelling a pending line buzzes for 20 ms (${(await vibes()).join(",")})`),
    );
    await clearVibes();
    await tapAt(below((spread[0] as Top).pt).x, below((spread[0] as Top).pt).y);
    await tapAt(below((spread[1] as Top).pt).x, below((spread[1] as Top).pt).y);
    await tapButton('[data-testid="confirm"]');
    ok(
      (await vibes()).join() === "10",
      t(`confirming it buzzes for 10 ms (${(await vibes()).join(",")})`),
    );
    await reset();
    // a refused nudge: only the layer above the cell is visible, so Down is refused
    await tapButton('[data-testid="tool-line"]');
    await tapAt(below((spread[3] as Top).pt).x, below((spread[3] as Top).pt).y);
    await page.evaluate(
      (y) => {
        (window.__voxwright as Vox).session()!.setSlice({ y0: y, y1: y });
      },
      (spread[3] as Top).pos[1] + 1,
    );
    await clearVibes();
    await tapButton('[data-testid="nudge-down"]');
    const refused = await state();
    ok(
      refused.error !== "" && (await vibes()).join() === "20",
      t(
        `a refused nudge buzzes for 20 ms and says why (${(await vibes()).join(",")}: ${refused.error})`,
      ),
    );
    await page.evaluate(() => {
      (window.__voxwright as Vox).session()!.setSlice(null);
    });
    await reset();

    // off: nothing buzzes, and it is remembered
    await setMenuCheckbox("haptics-toggle", false);
    ok((await stored(HAPTICS_KEY)) === "false", t("turning it off is stored as false"));
    await tapButton('[data-testid="tool-place"]');
    await setBlock(GOLD);
    await clearVibes();
    await tapAt(below((spread[0] as Top).pt).x, below((spread[0] as Top).pt).y);
    ok(
      (await state()).undoCount === 1 && (await vibes()).length === 0,
      t("with it off an edit does not buzz"),
    );
    await reload();
    await openMenu();
    ok(
      (await page.$eval(
        '[data-testid="haptics-input"]',
        (el) => (el as HTMLInputElement).checked,
      )) === false,
      t("and it stays off after a reload"),
    );
    await closeSheet();
    await setMenuCheckbox("haptics-toggle", true);
    await tapButton('[data-testid="tool-place"]');
    await setBlock(GOLD);
    await clearVibes();
    await tapAt(below((spread[0] as Top).pt).x, below((spread[0] as Top).pt).y);
    ok((await vibes()).join() === "10", t("turned on again, an edit buzzes"));
    // A browser that refuses or throws changes nothing
    await page.evaluate(() => {
      (navigator as unknown as { vibrate: () => never }).vibrate = () => {
        throw new Error("vibrate blocked");
      };
    });
    const errorsBefore = errors.length;
    await tapAt(below((spread[1] as Top).pt).x, below((spread[1] as Top).pt).y);
    ok(
      (await state()).undoCount === 2 && errors.length === errorsBefore,
      t("a vibrate that throws neither stops the edit nor raises an error"),
    );
    await page.evaluate(() => {
      delete (navigator as unknown as { vibrate?: unknown }).vibrate;
      Object.defineProperty(navigator, "vibrate", { value: undefined, configurable: true });
    });
    await tapAt(below((spread[2] as Top).pt).x, below((spread[2] as Top).pt).y);
    ok(
      (await state()).undoCount === 3 && errors.length === errorsBefore,
      t("and a browser without vibrate is fine too"),
    );
    await page.evaluate(() => {
      (navigator as unknown as { vibrate: (p: number) => boolean }).vibrate = (p: number) => {
        (window as unknown as { __vibes: number[] }).__vibes.push(p);
        return true;
      };
    });
    await reset();

    // ==== 4. the multi-finger shortcuts ==============================================================
    const openMenuSettings = async (): Promise<void> => {
      await openMenu();
      await page.$eval('[data-testid="two-finger-undo-toggle"]', (el) =>
        el.scrollIntoView({ block: "center" }),
      );
      await sleep(200);
    };
    await openMenuSettings();
    ok(
      (await page.$eval(
        '[data-testid="two-finger-undo-input"]',
        (el) => (el as HTMLInputElement).checked,
      )) === false &&
        (await page.$eval(
          '[data-testid="three-finger-redo-input"]',
          (el) => (el as HTMLInputElement).checked,
        )) === false &&
        (await stored(TWO_KEY)) === null &&
        (await stored(THREE_KEY)) === null,
      t("both shortcuts are off by default"),
    );
    ok(
      (await text('[data-testid="two-finger-undo-toggle"]')) === "Two-finger tap undoes" &&
        (await text('[data-testid="three-finger-redo-toggle"]')) === "Three-finger tap redoes",
      t('they are named "Two-finger tap undoes" and "Three-finger tap redoes"'),
    );
    await closeSheet();
    const mid = { x: 195, y: 430 };
    const two = [
      { x: 150, y: 430 },
      { x: 240, y: 430 },
    ];
    const three = [
      { x: 120, y: 430 },
      { x: 195, y: 430 },
      { x: 270, y: 430 },
    ];
    await tapButton('[data-testid="tool-place"]');
    await setBlock(GOLD);
    await tapAt(below((spread[0] as Top).pt).x, below((spread[0] as Top).pt).y);
    ok((await state()).undoCount === 1, t("one block placed to undo"));
    await multiTap(two);
    ok((await state()).undoCount === 1, t("off: a two-finger tap does nothing"));
    await page.evaluate(() => (window.__voxwright as Vox).session()!.undo());
    await multiTap(three);
    ok(
      (await state()).canRedo === true && (await state()).undoCount === 0,
      t("off: a three-finger tap does nothing"),
    );
    await page.evaluate(() => (window.__voxwright as Vox).session()!.redo());

    await setMenuCheckbox("two-finger-undo-toggle", true);
    ok(
      (await stored(TWO_KEY)) === "true" && (await stored(THREE_KEY)) === null,
      t("turning on the two-finger shortcut is stored, the other stays off"),
    );
    await multiTap(two);
    ok(
      (await state()).undoCount === 0 && (await state()).canRedo,
      t("on: a two-finger tap undoes"),
    );
    await multiTap(three);
    ok(
      (await state()).undoCount === 0,
      t("the two-finger setting does not make three fingers redo"),
    );
    await setMenuCheckbox("three-finger-redo-toggle", true);
    await multiTap(three);
    ok(
      (await state()).undoCount === 1 && (await state()).canRedo === false,
      t("on: a three-finger tap redoes"),
    );
    // A two-finger tap during a tool gesture never also places a block
    const beforeT = await cells();
    const f0 = below((spread[3] as Top).pt);
    const second = { x: Math.min(350, f0.x + 90), y: f0.y };
    const finger1 = await page.touchscreen.touchStart(f0.x, f0.y);
    await sleep(80); // the tool's gesture has begun: the cursor shows
    const reticleSeen = await page.evaluate(
      () => (window.__voxwright as Vox).session()?.reticle !== null,
    );
    const finger2 = await page.touchscreen.touchStart(second.x, second.y);
    await sleep(40);
    await finger2.end();
    await finger1.end();
    await calm();
    const afterT = await state();
    const dT = await changed(beforeT);
    ok(reticleSeen, t("(Place's cursor was showing when the second finger landed)"));
    ok(
      afterT.undoCount === 0 &&
        !dT.some(
          (k) =>
            k ===
            `${(spread[3] as Top).pos[0]},${(spread[3] as Top).pos[1] + 1},${(spread[3] as Top).pos[2]}`,
        ),
      t(
        `a two-finger tap that began on Place undoes and places nothing at the cursor (undo steps ${afterT.undoCount}, changed ${dT.join(" ")})`,
      ),
    );
    // In View too
    await page.evaluate(() => {
      const s = (window.__voxwright as Vox).session()!;
      s.setTool("place");
      s.placeAt([0, 0, 0], "minecraft:gold_block");
      s.setTool("navigate");
    });
    const undoBefore = (await state()).undoCount;
    await multiTap(two);
    ok((await state()).undoCount === undoBefore - 1, t("and in View a two-finger tap undoes too"));
    // moving fingers is not a tap
    const undoNow = (await state()).undoCount;
    await cdpTwoFingerPan(cdp, mid, { dx: 0, dy: 80 }, 80, 8);
    await calm();
    ok(
      (await state()).undoCount === undoNow,
      t("two fingers that move are a pan and undo nothing"),
    );
    await setMenuCheckbox("two-finger-undo-toggle", false);
    await setMenuCheckbox("three-finger-redo-toggle", false);
    ok(
      (await stored(TWO_KEY)) === "false" && (await stored(THREE_KEY)) === "false",
      t("turning them off again is stored"),
    );
    await reset();

    // ==== 5. left-handed: every floating control mirrors ===================================================
    await tapButton('[data-testid="tool-place"]');
    await setBlock(GOLD);
    await tapAt(below((spread[0] as Top).pt).x, below((spread[0] as Top).pt).y); // fills the quick row and shows a toast
    const rightHand = {
      cluster: await box('[data-testid="thumb-cluster"]'),
      toast: await box('[data-testid="undo-toast"]'),
      hotbar: await box('[data-testid="hotbar-compact"]'),
    };
    ok(
      rightHand.cluster.x > VIEW_W / 2 &&
        rightHand.toast.right > VIEW_W - 20 &&
        rightHand.hotbar.x < 20 &&
        rightHand.hotbar.right <= rightHand.cluster.x,
      t(
        "right-handed: the cluster and the toast sit on the right, the quick row on the left of the cluster",
      ),
    );
    await tapButton('[data-testid="tool-line"]');
    await tapAt(below((spread[2] as Top).pt).x, below((spread[2] as Top).pt).y);
    const padRight = await box('[data-testid="nudge-pad"]');
    ok(
      padRight.x > 0 && padRight.right <= (await box('[data-testid="thumb-cluster"]')).x,
      t("right-handed: the pad is left of the cluster"),
    );
    await reset();
    await setMenuCheckbox("left-handed-toggle", true);
    ok((await stored(LEFT_KEY)) === "true", t("the left-handed setting is stored"));
    await tapButton('[data-testid="tool-place"]');
    await setBlock(GOLD);
    await tapAt(below((spread[0] as Top).pt).x, below((spread[0] as Top).pt).y);
    const leftHand = {
      cluster: await box('[data-testid="thumb-cluster"]'),
      toast: await box('[data-testid="undo-toast"]'),
      hotbar: await box('[data-testid="hotbar-compact"]'),
      undo: await box('[data-testid="undo-toast-undo"]'),
      text: await box('[data-testid="undo-toast-text"]'),
    };
    ok(
      leftHand.cluster.right < VIEW_W / 2 &&
        Math.abs(leftHand.cluster.x - (VIEW_W - rightHand.cluster.right)) < 1.5,
      t("left-handed: the thumb cluster is the mirror image"),
    );
    ok(
      leftHand.toast.x < 20 && Math.abs(leftHand.toast.x - (VIEW_W - rightHand.toast.right)) < 1.5,
      t("left-handed: the toast is at the left edge, mirrored"),
    );
    ok(
      leftHand.undo.right <= leftHand.text.x + 0.5 || leftHand.undo.x < leftHand.text.x,
      t("and its Undo button is on the outer, thumb side"),
    );
    ok(
      leftHand.hotbar.right > VIEW_W - 20 && leftHand.hotbar.x >= leftHand.cluster.right,
      t("left-handed: the quick row is right of the cluster, against the right edge"),
    );
    await tapButton('[data-testid="tool-line"]');
    await tapAt(below((spread[2] as Top).pt).x, below((spread[2] as Top).pt).y);
    const padLeft = await box('[data-testid="nudge-pad"]');
    const clusterL = await box('[data-testid="thumb-cluster"]');
    ok(
      padLeft.x >= clusterL.right && Math.abs(padLeft.x - (VIEW_W - padRight.right)) < 1.5,
      t("left-handed: the nudge pad is right of the cluster, mirrored"),
    );
    await reset();
    await setMenuCheckbox("left-handed-toggle", false);

    // ==== 6. buttons for the gestures ================================================================
    await restoreCamera();
    // Zoom in the readout line = the double tap
    const target = all.find(
      (c) => c.pt.y > 300 && c.pt.y < 560 && c.pt.x > 60 && c.pt.x < 330,
    ) as Top;
    await reset();
    await restoreCamera();
    const doubleTapHere = async (): Promise<TouchPose> => {
      await sleep(400);
      await quickTap(target.pt.x, target.pt.y);
      await sleep(80);
      await quickTap(target.pt.x, target.pt.y);
      await settleFrames();
      return pose();
    };
    const byGesture = await doubleTapHere();
    await restoreCamera();
    await sleep(400);
    await tapAt(target.pt.x, target.pt.y); // View: tap inspects
    ok(
      (await state()).inspected?.join() === target.pos.join() &&
        (await exists('[data-testid="zoom-chip"]')),
      t("tapping a block in View shows the Zoom button in the readout line"),
    );
    const zoomChip = await box('[data-testid="zoom-chip"]');
    ok(
      zoomChip.w >= 43.99 &&
        zoomChip.h >= 43.99 &&
        (await attr('[data-testid="zoom-chip"]', "aria-label")) === "Zoom to this block",
      t(
        `it is at least 44 px (${zoomChip.w.toFixed(0)} x ${zoomChip.h.toFixed(0)}) and named "Zoom to this block"`,
      ),
    );
    ok(
      (await text('[data-testid="zoom-chip"]')) === "Zoom",
      t("and its visible text is in its name"),
    );
    const readoutBox = await box('[data-testid="bottom-toolbar"]');
    ok(
      zoomChip.bottom <= (await box('[data-testid="toolbar"]')).y + 1 && zoomChip.y >= readoutBox.y,
      t("it sits in the readout line above the toolbar"),
    );
    await restoreCamera();
    await tapAt(target.pt.x, target.pt.y);
    await tapButton('[data-testid="zoom-chip"]');
    await settleFrames();
    const byButton = await pose();
    const tg = computeTarget(byGesture);
    const tb = computeTarget(byButton);
    ok(
      Math.hypot(tg[0] - tb[0], tg[1] - tb[1], tg[2] - tb[2]) < 0.05 &&
        Math.abs(byGesture.distance - byButton.distance) < 0.05 &&
        Math.abs(byButton.distance - home.distance / 2) < 0.05 &&
        Math.hypot(
          tb[0] - (target.pos[0] + 0.5),
          tb[1] - (target.pos[1] + 0.5),
          tb[2] - (target.pos[2] + 0.5),
        ) < 0.05,
      t(
        `the Zoom button focuses exactly as a double tap does: target ${tb.map((v) => v.toFixed(2)).join(", ")}, distance ${byButton.distance.toFixed(2)}`,
      ),
    );
    ok(
      (await state()).message === `Zoomed in on ${target.pos.join(", ")}`,
      t("and says what it did"),
    );
    // with a tool armed (a gesture would be the tool's)
    await restoreCamera();
    await tapButton('[data-testid="tool-erase"]');
    await tapButton('[data-testid="zoom-chip"]');
    await settleFrames();
    ok(
      Math.abs((await pose()).distance - home.distance / 2) < 0.05,
      t("with a tool armed the button still zooms (a double tap would be the tool's)"),
    );
    await reset();
    await restoreCamera();

    // Centre on the build = what a pan is for
    await page.evaluate((h) => {
      (window.__voxwright as Vox).renderer.setOrbit({
        target: [h[0] + 6, h[1] + 3, h[2] - 5],
        distance: 6,
      });
    }, homeTarget);
    await settleFrames();
    const away = computeTarget(await pose());
    await openMenu();
    await tapButton('[data-testid="mobile-centre"]');
    await settleFrames();
    const centred = await pose();
    const ct = computeTarget(centred);
    ok(
      Math.hypot(away[0] - homeTarget[0], away[1] - homeTarget[1], away[2] - homeTarget[2]) > 5 &&
        Math.hypot(ct[0] - homeTarget[0], ct[1] - homeTarget[1], ct[2] - homeTarget[2]) < 0.5 &&
        Math.abs(centred.distance - home.distance) < 1,
      t(
        `"Centre on the build" moves the target back to the middle of the build (from ${away.map((v) => v.toFixed(1)).join(", ")} to ${ct.map((v) => v.toFixed(1)).join(", ")})`,
      ),
    );
    ok(
      Math.abs(centred.azimuth - home.azimuth) < 0.5 &&
        Math.abs(centred.elevation - home.elevation) < 0.5,
      t("and leaves the turn and the tilt alone"),
    );
    const centreBtn = await box('[data-testid="mobile-centre"]');
    ok(centreBtn.h >= 47.99, t("the button is at least 48 px tall"));
    // The sliders and the zoom buttons
    await page.$eval('[data-testid="mobile-azimuth"]', (el) => {
      const input = el as HTMLInputElement;
      input.value = "200";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await sleep(150);
    ok(
      Math.abs((await pose()).azimuth - 200) < 1,
      t("the Turn slider turns the view (what a twist or a one-finger orbit does)"),
    );
    await page.$eval('[data-testid="mobile-elevation"]', (el) => {
      const input = el as HTMLInputElement;
      input.value = "20";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await sleep(150);
    ok(Math.abs((await pose()).elevation - 20) < 1, t("the Tilt slider tilts it"));
    const d0 = (await pose()).distance;
    await tapButton('[data-testid="mobile-zoom-in"]');
    const d1 = (await pose()).distance;
    await tapButton('[data-testid="mobile-zoom-out"]');
    await tapButton('[data-testid="mobile-zoom-out"]');
    const d2 = (await pose()).distance;
    ok(
      d1 < d0 && d2 > d1 && Math.abs(d1 - d0 / 1.2) < 0.05,
      t("Zoom in and Zoom out do what a pinch does"),
    );
    await closeSheet();
    await restoreCamera();
    // Pick tool = long press
    const pickTarget = spread[0] as Top;
    await tapButton('[data-testid="tool-eyedropper"]');
    await setBlock("minecraft:stone");
    await tapAt(below(pickTarget.pt).x, below(pickTarget.pt).y);
    ok(
      (await state()).block === (pickTarget.block.split("{")[0] as string),
      t(
        `the Pick tool chooses the block under the cursor (${(await state()).block}), as a long press does`,
      ),
    );
    await reset();
    // Undo and Redo buttons = the multi-finger taps
    const ur = [await box('[data-testid="undo"]'), await box('[data-testid="redo"]')];
    ok(
      ur.every((b) => b.w >= 47.99 && b.h >= 47.99),
      t("Undo and Redo are 48 px buttons, the stand-ins for the two- and three-finger taps"),
    );
    // The sheet's handle: tap or Enter instead of the drag
    await tapButton('[data-testid="mobile-menu-btn"]');
    await page.waitForSelector('[data-testid="menu-sheet"]');
    await sleep(350);
    const top0 = (await sheetRect()).y;
    await tapButton('[data-testid="bottom-sheet-handle"]');
    await sleep(350);
    const top1 = (await sheetRect()).y;
    await tapButton('[data-testid="bottom-sheet-handle"]');
    await sleep(350);
    const top2 = (await sheetRect()).y;
    ok(
      top1 < top0 - 100 && Math.abs(top2 - top0) < 2,
      t(
        `a tap on the sheet's handle switches it between half and full height (${top0.toFixed(0)} -> ${top1.toFixed(0)} -> ${top2.toFixed(0)})`,
      ),
    );
    await page.focus('[data-testid="bottom-sheet-handle"]');
    await page.keyboard.press("Enter");
    await sleep(350);
    const top3 = (await sheetRect()).y;
    ok(top3 < top0 - 100, t("and so does Enter on it from a keyboard"));
    ok(
      (await attr('[data-testid="bottom-sheet-handle"]', "aria-expanded")) === "true",
      t("which it announces with aria-expanded"),
    );
    await closeSheet();

    // ==== 7. the touch help ===========================================================================
    await openMenu();
    const help = await text('[data-testid="touch-help"]');
    ok(
      /finger/.test(help) && /tap/i.test(help) && /Undo/.test(help) && /export/i.test(help),
      t("the menu has a help text about fingers, taps, buttons and export"),
    );
    ok(
      !/\b(click|mouse|Ctrl|Alt|Shift|right button|scroll|key)\b/i.test(help),
      t("and it names no mouse, key or click"),
    );
    ok(
      !(await exists('[data-testid="edit-help"]')),
      t("the desktop help (edit-help) is not in the mobile layout"),
    );
    const titles = await page.$$eval('[data-testid="toolbar"] [data-tool]', (els) =>
      els.map((el) => el.getAttribute("title") ?? ""),
    );
    ok(
      titles.length === 8 && titles.every((x) => x !== "" && !/click|ctrl|\(\w\)$/i.test(x)),
      t(`the tool tooltips speak of taps, with no click and no key (${titles.length})`),
    );
    await closeSheet();

    // ==== 8. axe-core on the whole page in the mobile states, and the focus order ======================
    await reset();
    await restoreCamera();
    await stateIsClean("editing, idle");

    // palette sheet
    await tapButton('[data-testid="active-block-swatch"]');
    await page.waitForSelector('[data-testid="bottom-sheet"]');
    await sleep(350);
    await stateIsClean("the palette sheet open");
    // block-state sheet (a stairs block)
    await closeSheet();
    const stairs = all.find(
      (c) =>
        c.block.includes("stairs") && c.pt.y > 260 && c.pt.y < 560 && c.pt.x > 40 && c.pt.x < 350,
    ) as Top | undefined;
    ok(stairs !== undefined, t("the fixture has a stairs block in reach"));
    if (stairs !== undefined) {
      await tapAt(stairs.pt.x, stairs.pt.y);
      await tapButton('[data-testid="state-chip"]');
      await page.waitForSelector('[data-testid="bottom-sheet"]');
      await sleep(350);
      await stateIsClean("the block-state sheet open");
      await closeSheet();
    }
    await reset();
    // selection sheet with the face steppers
    await tapButton('[data-testid="tool-select"]');
    await tapAt(below((spread[0] as Top).pt).x, below((spread[0] as Top).pt).y);
    await tapAt(below((spread[1] as Top).pt).x, below((spread[1] as Top).pt).y);
    await tapButton('[data-testid="confirm"]');
    await tapButton('[data-testid="mobile-selection-toggle"]');
    await page.waitForSelector('[data-testid="face-steppers"]');
    await sleep(350);
    ok(
      (await page.$$('[data-testid="face-steppers"] button')).length === 12,
      t("the selection sheet shows the face steppers"),
    );
    await stateIsClean("the selection sheet open, with the face steppers");
    await closeSheet();
    // something pending (the pad)
    await reset();
    await tapButton('[data-testid="tool-rectangle"]');
    await setBlock(GOLD);
    await tapAt(below((spread[4] as Top).pt).x, below((spread[4] as Top).pt).y);
    ok(
      await exists('[data-testid="nudge-pad"]'),
      t("a rectangle's first corner brings up the pad"),
    );
    await sleep(4500); // let any toast go: this state is the pad alone
    await stateIsClean(
      "something pending, the nudge pad shown (a rectangle, with the Hollow toggle)",
    );
    await reset();
    // the menu
    await openMenu();
    await stateIsClean("the menu sheet open");
    await closeSheet();
    // the walkthrough and the toast were checked above, in the states they showed in

    // focus order in the sheets
    const focusOrder = async (
      label: string,
      opts: { visual: boolean; max?: number },
    ): Promise<void> => {
      const info = await page.evaluate(() => {
        const dlg = document.querySelector('[data-testid="bottom-sheet"]') as HTMLElement;
        const content = dlg.querySelector('[data-testid="bottom-sheet-content"]') as HTMLElement;
        content.scrollTop = 0;
        const sel = "button, [href], input, select, textarea, [tabindex]";
        const list = [...dlg.querySelectorAll<HTMLElement>(sel)].filter((el) => {
          if (el === dlg || el.hasAttribute("disabled")) return false;
          if (el.getAttribute("tabindex") === "-1") return false;
          const cs = getComputedStyle(el);
          // Not drawn at all (a parent is display: none) means Tab skips it.
          if (el.getClientRects().length === 0 || cs.visibility === "hidden") return false;
          if ((el as HTMLInputElement).type === "hidden") return false;
          return true;
        });
        const rows = list.map((el, i) => {
          el.setAttribute("data-fo", String(i));
          const ref = el.getBoundingClientRect().width <= 2 ? (el.closest("label") ?? el) : el;
          const r = ref.getBoundingClientRect();
          return {
            cy: r.top + r.height / 2,
            left: r.left,
            name: el.getAttribute("data-testid") ?? el.tagName,
          };
        });
        return { rows, active: document.activeElement === dlg };
      });
      ok(info.active, t(`${label}: focus is in the sheet when it opens`));
      const n = Math.min(info.rows.length, opts.max ?? info.rows.length);
      const seen: number[] = [];
      for (let i = 0; i < n; i++) {
        await page.keyboard.press("Tab");
        seen.push(
          await page.evaluate(() => {
            const a = document.activeElement;
            const v = a?.getAttribute("data-fo");
            return v === null || v === undefined ? -1 : Number(v);
          }),
        );
      }
      ok(
        seen.every((v, i) => v === i),
        t(
          `${label}: Tab visits all ${n} controls in order, handle and close button first (${seen.join(",") === seen.map((_, i) => i).join(",") ? "in order" : seen.join(",")})`,
        ),
      );
      ok(
        info.rows[0]?.name === "bottom-sheet-handle" && info.rows[1]?.name === "bottom-sheet-close",
        t(`${label}: the first two stops are the handle and the close button`),
      );
      if (opts.visual) {
        const bad: string[] = [];
        for (let i = 1; i < n; i++) {
          const a = info.rows[i - 1] as { cy: number; left: number; name: string };
          const b = info.rows[i] as { cy: number; left: number; name: string };
          const lower = b.cy >= a.cy - 8;
          const sameRow = Math.abs(b.cy - a.cy) <= 24;
          if (!(lower && (!sameRow || b.left >= a.left - 2))) bad.push(`${a.name} -> ${b.name}`);
        }
        ok(
          bad.length === 0,
          t(
            `${label}: the tab order is the visual order, top to bottom and left to right${bad.length ? ` (out of order: ${bad.join("; ")})` : ""}`,
          ),
        );
      }
    };
    await openMenu();
    await focusOrder("menu sheet", { visual: true });
    await page.keyboard.press("Escape");
    await sleep(300);
    ok(
      !(await exists('[data-testid="bottom-sheet"]')) &&
        (await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))) ===
          "mobile-menu-btn",
      t("Escape closes the sheet and the focus goes back to the Menu button"),
    );
    // selection sheet
    await page.evaluate(() => {
      const s = (window.__voxwright as Vox).session()!;
      s.setSelection({ min: [2, 5, 2], max: [4, 6, 3] });
    });
    await tapButton('[data-testid="mobile-selection-toggle"]');
    await page.waitForSelector('[data-testid="face-steppers"]');
    await sleep(350);
    await focusOrder("selection sheet", { visual: true });
    await closeSheet();
    // state sheet
    if (stairs !== undefined) {
      await tapAt(stairs.pt.x, stairs.pt.y);
      await tapButton('[data-testid="state-chip"]');
      await page.waitForSelector('[data-testid="bottom-sheet"]');
      await sleep(350);
      await focusOrder("block-state sheet", { visual: true });
      await closeSheet();
    }
    // palette: narrow the list first, then every stop
    await tapButton('[data-testid="active-block-swatch"]');
    await page.waitForSelector('[data-testid="palette-search"]');
    await sleep(350);
    await tapButton('[data-testid="palette-search"]');
    await page.keyboard.type("gold_b");
    await sleep(300);
    await page.evaluate(() => {
      (document.querySelector('[data-testid="bottom-sheet-handle"]') as HTMLElement).focus();
    });
    await page.evaluate(() => {
      (document.querySelector('[data-testid="bottom-sheet"]') as HTMLElement).focus();
    });
    await focusOrder("palette sheet", { visual: false });
    await closeSheet();

    // ==== 9. the desktop layout is not touched ==========================================================
    const desk = await newPage(browser);
    try {
      desk.on("pageerror", (e) => errors.push(String(e)));
      await desk.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
      await desk.goto(url);
      await desk.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="status"]')
            ?.textContent?.startsWith("open a schematic"),
        { timeout: 30000 },
      );
      const input = (await desk.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
      await input.uploadFile(join(fixtures, "Rafeals_house.nbt"));
      await desk.waitForFunction(
        () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
        { timeout: 60000 },
      );
      const helpText = await desk.$eval('[data-testid="edit-help"]', (el) => el.textContent ?? "");
      ok(
        helpText.includes("hold Alt and drag to turn the view") &&
          helpText.includes("Esc cancels") &&
          !(await desk.$('[data-testid="touch-help"]')),
        t("the desktop help text is unchanged and has no touch help"),
      );
      ok(
        (await desk.$('[data-testid="undo-toast"]')) === null &&
          (await desk.$('[data-testid="touch-intro"]')) === null &&
          (await desk.$('[data-testid="top-overlays"]')) === null &&
          (await desk.$('[data-testid="haptics-toggle"]')) === null,
        t("the desktop layout has no toast, no walkthrough and no touch settings"),
      );
      await desk.evaluate(() => {
        const s = (window.__voxwright as Vox).session()!;
        s.placeAt([0, 0, 0], "minecraft:gold_block");
      });
      ok(
        (await desk.evaluate(() => (window.__voxwright as Vox).session()?.lastChange?.text)) ===
          "Placed 1 block" && (await desk.$('[data-testid="undo-toast"]')) === null,
        t("an edit on desktop records the change but shows no toast"),
      );
    } finally {
      await desk.close();
    }

    ok(
      errors.length === 0,
      t(
        `no console errors throughout the polish run${errors.length ? `: ${errors.join(" | ")}` : ""}`,
      ),
    );
  } finally {
    await browser.close();
    await rm(downloads, { recursive: true, force: true });
  }
}

try {
  if (values.only === undefined || values.only === "viewer") await touchViewerSuite();
  if (values.only === undefined || values.only === "placement") await touchPlacementSuite();
  if (values.only === undefined || values.only === "two-point") await touchTwoPointSuite();
  if (values.only === undefined || values.only === "selection-state")
    await touchSelectionStateSuite();
  if (values.only === undefined || values.only === "camera") await touchCameraSuite();
  if (values.only === undefined || values.only === "quality") await touchQualitySuite();
  if (values.only === undefined || values.only === "polish") await touchPolishSuite();
} finally {
  server.close();
}

console.log(checks.map((c) => `  ok  ${c}`).join("\n"));
console.log(`${checks.length} checks passed`);
