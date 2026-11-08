// SPDX-License-Identifier: AGPL-3.0-only

// Empirical Stress & Adversarial Test Harness for Milestone MB3 (Mobile Layout Shell):
// Tests:
// 1. Multi-viewport dimension stress across 7 viewports:
//    - 320x568 (iPhone SE 1st gen)
//    - 360x640 (Galaxy S5 / budget Android)
//    - 390x844 (iPhone 12/13/14)
//    - 412x915 (Pixel 7)
//    - 768x1024 (iPad portrait)
//    - 1024x768 (iPad landscape touch)
//    - 1280x800 (Desktop)
// 2. Strict overflow assertions across all touch viewports:
//    - scrollWidth === clientWidth (0 horizontal overflow)
//    - scrollHeight === clientHeight (0 unwanted vertical scroll)
//    - window.scrollX === 0 and window.scrollY === 0
//    - In both initial state (welcome screen) and active editor state
// 3. WCAG 2.5.5 touch target size enforcement (all interactive elements >= 44x44px and primary >= 48x48px)
//    across all touch viewports.
// 4. Rapid layout mode toggles (Auto -> Mobile -> Desktop -> Auto repeated 10x):
//    - Assert WebGL canvas element is preserved (not unmounted/re-created)
//    - Assert WebGL context is NOT lost (no webglcontextlost event, gl.isContextLost() === false)
//    - Assert zero unhandled exceptions or DOM crashes
//    - Assert rendering and camera orbit remain functional after toggling
// 5. Drag sheet snap transitions, drag physics, and fling calculations:
//    - Snap point positioning (peek, half, full, closed)
//    - Drag handle physics via pointer capture and touchscreen drag
//    - Fling down with velocity > 0.45 px/ms (full -> half -> peek -> closed)
//    - Backdrop dismiss and Escape key dismiss
//    - visualViewport resize / virtual keyboard offset handling (450px)
// 6. Ergonomic controls & Left-handed layout mirroring

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type CDPSession, type ElementHandle, type Page } from "puppeteer-core";
import { chromiumArgs, findChromium, serveSite } from "./site.ts";
import type { TouchPose } from "./touch-e2e.ts";
import type { Vox } from "./vox.ts";

const fixtures = fileURLToPath(new URL("../../../fixtures/real/rafeals-house/", import.meta.url));
const chromium = findChromium();
const { url, plainUrl, server } = await serveSite();

interface CheckResult {
  suite: string;
  name: string;
  status: "PASS" | "FAIL";
  details?: string;
}

const results: CheckResult[] = [];

function check(suite: string, name: string, condition: boolean, details?: string): void {
  const status = condition ? "PASS" : "FAIL";
  results.push({ suite, name, status, details });
  const prefix = status === "PASS" ? "  ok " : "  FAIL ";
  const detailStr = details ? ` (${details})` : "";
  console.log(`${prefix} [${suite}] ${name}${detailStr}`);
  if (!condition) {
    console.error(`       ASSERTION FAILED: ${name} [${details || ""}]`);
  }
}

async function cdpTouchDrag(
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

const VIEWPORTS = [
  { name: "iPhone SE (1st gen)", width: 320, height: 568, dpr: 2, touch: true, mobile: true },
  { name: "Galaxy S5 / Budget Android", width: 360, height: 640, dpr: 3, touch: true, mobile: true },
  { name: "iPhone 12/13/14", width: 390, height: 844, dpr: 3, touch: true, mobile: true },
  { name: "Pixel 7", width: 412, height: 915, dpr: 2.625, touch: true, mobile: true },
  { name: "iPad Portrait", width: 768, height: 1024, dpr: 2, touch: true, mobile: true },
  { name: "iPad Landscape", width: 1024, height: 768, dpr: 2, touch: true, mobile: true },
  { name: "Desktop HD", width: 1280, height: 800, dpr: 1, touch: false, mobile: false },
] as const;

const browser = await puppeteer.launch({
  executablePath: chromium,
  headless: true,
  args: chromiumArgs(true),
});

try {
  // =========================================================================
  // TEST SUITE 1: Multi-Viewport Dimension Stress & Zero Overflow Matrix
  // =========================================================================
  console.log("\n=== SUITE 1: Multi-Viewport Dimension Stress & Zero Overflow Matrix ===");

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.setViewport({
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.dpr,
      hasTouch: vp.touch,
      isMobile: vp.mobile,
    });

    await page.goto(url);
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="renderer"]')?.getAttribute("data-kind") === "webgl",
      { timeout: 30000 },
    );

    // Initial state: check page overflow before loading schematic
    const initMetrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const el = document.scrollingElement || doc;
      return {
        docScrollWidth: doc.scrollWidth,
        docClientWidth: doc.clientWidth,
        docScrollHeight: doc.scrollHeight,
        docClientHeight: doc.clientHeight,
        elScrollWidth: el.scrollWidth,
        elClientWidth: el.clientWidth,
        elScrollHeight: el.scrollHeight,
        elClientHeight: el.clientHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        isMobile: document.querySelector(".mobile-top-bar") !== null || document.querySelector(".mobile-welcome-card") !== null,
      };
    });

    if (vp.touch) {
      check(
        "Viewport-Stress",
        `[${vp.name} (${vp.width}x${vp.height})] Initial: 0 horizontal overflow (doc scrollWidth <= clientWidth)`,
        initMetrics.docScrollWidth - initMetrics.docClientWidth <= 1,
        `scrollWidth=${initMetrics.docScrollWidth}, clientWidth=${initMetrics.docClientWidth}`,
      );
      check(
        "Viewport-Stress",
        `[${vp.name} (${vp.width}x${vp.height})] Initial: 0 vertical scroll (doc scrollHeight <= clientHeight)`,
        initMetrics.docScrollHeight - initMetrics.docClientHeight <= 1,
        `scrollHeight=${initMetrics.docScrollHeight}, clientHeight=${initMetrics.docClientHeight}`,
      );
      check(
        "Viewport-Stress",
        `[${vp.name} (${vp.width}x${vp.height})] Initial: window scroll positions are zero`,
        initMetrics.scrollX === 0 && initMetrics.scrollY === 0,
        `scrollX=${initMetrics.scrollX}, scrollY=${initMetrics.scrollY}`,
      );
      check(
        "Viewport-Stress",
        `[${vp.name} (${vp.width}x${vp.height})] Initial: adopts mobile shell layout`,
        initMetrics.isMobile,
        `isMobile=${initMetrics.isMobile}`,
      );
    } else {
      check(
        "Viewport-Stress",
        `[${vp.name} (${vp.width}x${vp.height})] Desktop layout adopts 3-column / desktop shell`,
        !initMetrics.isMobile,
        `isMobile=${initMetrics.isMobile}`,
      );
    }

    // Now open schematic fixture
    const fileInput = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await fileInput.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await page.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 60000 },
    );
    await page.evaluate(() => (window as unknown as { __voxwright?: Vox }).__voxwright?.renderer.whenIdle());

    // Active editor state: check page overflow after loading schematic
    const editorMetrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const el = document.scrollingElement || doc;
      const toolbar = document.querySelector('[data-testid="toolbar"]');
      const topBar = document.querySelector('[data-testid="top-app-bar"]');
      const thumb = document.querySelector('[data-testid="thumb-cluster"]');
      return {
        docScrollWidth: doc.scrollWidth,
        docClientWidth: doc.clientWidth,
        docScrollHeight: doc.scrollHeight,
        docClientHeight: doc.clientHeight,
        elScrollWidth: el.scrollWidth,
        elClientWidth: el.clientWidth,
        elScrollHeight: el.scrollHeight,
        elClientHeight: el.clientHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        hasToolbar: toolbar !== null,
        hasTopBar: topBar !== null,
        hasThumb: thumb !== null,
      };
    });

    if (vp.touch) {
      check(
        "Viewport-Stress",
        `[${vp.name} (${vp.width}x${vp.height})] Active: 0 horizontal overflow (scrollWidth <= clientWidth)`,
        editorMetrics.docScrollWidth - editorMetrics.docClientWidth <= 1,
        `scrollWidth=${editorMetrics.docScrollWidth}, clientWidth=${editorMetrics.docClientWidth}`,
      );
      check(
        "Viewport-Stress",
        `[${vp.name} (${vp.width}x${vp.height})] Active: 0 unwanted vertical scroll (scrollHeight <= clientHeight)`,
        editorMetrics.docScrollHeight - editorMetrics.docClientHeight <= 1,
        `scrollHeight=${editorMetrics.docScrollHeight}, clientHeight=${editorMetrics.docClientHeight}`,
      );
      check(
        "Viewport-Stress",
        `[${vp.name} (${vp.width}x${vp.height})] Active: mobile toolbar, top app bar, and thumb cluster mounted`,
        editorMetrics.hasToolbar && editorMetrics.hasTopBar && editorMetrics.hasThumb,
        `toolbar=${editorMetrics.hasToolbar}, topBar=${editorMetrics.hasTopBar}, thumb=${editorMetrics.hasThumb}`,
      );
    } else {
      check(
        "Viewport-Stress",
        `[${vp.name} (${vp.width}x${vp.height})] Active: desktop layout keeps toolbar above canvas without mobile bars`,
        editorMetrics.hasToolbar && !editorMetrics.hasTopBar && !editorMetrics.hasThumb,
        `toolbar=${editorMetrics.hasToolbar}, topBar=${editorMetrics.hasTopBar}, thumb=${editorMetrics.hasThumb}`,
      );
    }

    check(
      "Viewport-Stress",
      `[${vp.name} (${vp.width}x${vp.height})] Zero console or page errors encountered`,
      errors.length === 0,
      `errors=${errors.join("; ")}`,
    );

    await page.close();
  }

  // =========================================================================
  // TEST SUITE 2: WCAG 2.5.5 Touch Target Size Enforcement Across Viewports
  // =========================================================================
  console.log("\n=== SUITE 2: WCAG 2.5.5 Touch Target Size Enforcement ===");

  const touchTargetsToCheck = [
    { id: "mobile-menu-btn", sel: '[data-testid="mobile-menu-btn"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "tool-navigate", sel: '[data-testid="tool-navigate"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "tool-place", sel: '[data-testid="tool-place"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "tool-paint", sel: '[data-testid="tool-paint"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "tool-erase", sel: '[data-testid="tool-erase"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "tool-eyedropper", sel: '[data-testid="tool-eyedropper"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "tool-line", sel: '[data-testid="tool-line"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "tool-rectangle", sel: '[data-testid="tool-rectangle"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "tool-select", sel: '[data-testid="tool-select"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "active-block-swatch", sel: '[data-testid="active-block-swatch"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "mobile-state-toggle", sel: '[data-testid="mobile-state-toggle"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "mobile-selection-toggle", sel: '[data-testid="mobile-selection-toggle"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "undo", sel: '[data-testid="undo"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "redo", sel: '[data-testid="redo"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "cancel", sel: '[data-testid="cancel"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
    { id: "confirm", sel: '[data-testid="confirm"]', minW: 44, minH: 44, reqW: 48, reqH: 48 },
  ];

  for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
    const page = await browser.newPage();
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.dpr,
      hasTouch: true,
      isMobile: true,
    });
    await page.goto(url);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="renderer"]')?.getAttribute("data-kind") === "webgl",
      { timeout: 30000 },
    );
    const fileInput = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await fileInput.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await page.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 60000 },
    );
    await page.evaluate(() => (window as unknown as { __voxwright?: Vox }).__voxwright?.renderer.whenIdle());

    for (const target of touchTargetsToCheck) {
      const el = await page.$(target.sel);
      check(
        "Touch-Targets",
        `[${vp.name}] Target ${target.id} exists in DOM`,
        el !== null,
        `selector=${target.sel}`,
      );
      if (el) {
        const box = await el.boundingBox();
        check(
          "Touch-Targets",
          `[${vp.name}] Target ${target.id} has visible bounding box`,
          box !== null && box.width > 0 && box.height > 0,
        );
        if (box) {
          check(
            "Touch-Targets",
            `[${vp.name}] Target ${target.id} meets WCAG 2.5.5 (>= 44x44px)`,
            box.width >= target.minW && box.height >= target.minH,
            `width=${box.width.toFixed(1)}px, height=${box.height.toFixed(1)}px (min ${target.minW}x${target.minH})`,
          );
          check(
            "Touch-Targets",
            `[${vp.name}] Target ${target.id} meets ergonomics spec (>= 48x48px)`,
            box.width >= target.reqW && box.height >= target.reqH,
            `width=${box.width.toFixed(1)}px, height=${box.height.toFixed(1)}px (req ${target.reqW}x${target.reqH})`,
          );
        }
      }
    }

    await page.close();
  }

  // =========================================================================
  // TEST SUITE 3: Rapid Layout Mode Toggling & WebGL Canvas Preservation
  // =========================================================================
  console.log("\n=== SUITE 3: Rapid Layout Mode Toggling & Canvas Preservation ===");
  {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: true,
    });
    await page.goto(url);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="renderer"]')?.getAttribute("data-kind") === "webgl",
      { timeout: 30000 },
    );
    const fileInput = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await fileInput.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await page.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 60000 },
    );
    await page.evaluate(() => (window as unknown as { __voxwright?: Vox }).__voxwright?.renderer.whenIdle());

    // Setup canvas tracking and webglcontextlost listener
    await page.evaluate(() => {
      const c = document.querySelector('canvas[data-testid="canvas"]') as HTMLCanvasElement;
      (window as unknown as { __initialCanvas: HTMLCanvasElement; __contextLostFired: boolean }).__initialCanvas = c;
      (window as unknown as { __contextLostFired: boolean }).__contextLostFired = false;
      c.addEventListener("webglcontextlost", () => {
        (window as unknown as { __contextLostFired: boolean }).__contextLostFired = true;
      });
    });

    // Perform 10 rapid toggles between Layout modes
    const modeSequence = [
      "mobile",
      "desktop",
      "auto",
      "mobile",
      "desktop",
      "auto",
      "mobile",
      "desktop",
      "mobile",
      "auto",
    ] as const;

    for (let i = 0; i < modeSequence.length; i++) {
      const mode = modeSequence[i]!;
      await page.evaluate((m) => {
        localStorage.setItem("voxwright.layout", m);
        window.dispatchEvent(new StorageEvent("storage", { key: "voxwright.layout", newValue: m }));
        const overrideBtns = Array.from(document.querySelectorAll('[data-testid="layout-override"] button'));
        const btn = overrideBtns.find((b) => b.textContent?.trim().toLowerCase() === m);
        if (btn instanceof HTMLElement) {
          btn.click();
        }
      }, mode as string);

      await new Promise((r) => setTimeout(r, 40));

      const status = await page.evaluate(() => {
        const initial = (window as unknown as { __initialCanvas: HTMLCanvasElement }).__initialCanvas;
        const current = document.querySelector('canvas[data-testid="canvas"]') as HTMLCanvasElement;
        const lost = (window as unknown as { __contextLostFired: boolean }).__contextLostFired;
        const gl = current.getContext("webgl2");
        return {
          isSameCanvas: initial === current,
          contextLostFired: lost,
          isContextLost: gl ? gl.isContextLost() : false,
          hasSession: (window as unknown as { __voxwright?: Vox }).__voxwright?.session() !== null,
        };
      });

      check(
        "Layout-Toggle-Stress",
        `Cycle ${i + 1} (${mode}): Canvas element preserved without unmounting/re-creation`,
        status.isSameCanvas,
      );
      check(
        "Layout-Toggle-Stress",
        `Cycle ${i + 1} (${mode}): Zero webglcontextlost event fired`,
        !status.contextLostFired && !status.isContextLost,
        `contextLostFired=${status.contextLostFired}, isContextLost=${status.isContextLost}`,
      );
    }

    // Return to mobile mode
    await page.evaluate(() => {
      localStorage.setItem("voxwright.layout", "mobile");
    });
    await new Promise((r) => setTimeout(r, 100));
    await page.evaluate(() => (window as unknown as { __voxwright?: Vox }).__voxwright?.renderer.whenIdle());

    const cdp = await page.createCDPSession();
    const canvasEl = await page.$('[data-testid="canvas"]');
    const cBox = (await canvasEl?.boundingBox())!;
    const cx = Math.round(cBox.x + cBox.width / 2);
    const cy = Math.round(cBox.y + cBox.height / 2);

    const poseBefore = await page.evaluate(() => {
      const r = (window as unknown as { __voxwright?: Vox }).__voxwright?.renderer;
      return (r as unknown as { getPose?: () => TouchPose })?.getPose?.() ?? null;
    });

    // Dispatch 1-finger orbit gesture
    await cdpTouchDrag(cdp, { x: cx, y: cy }, { x: cx + 100, y: cy + 40 }, 6, 1);
    await page.evaluate(() => (window as unknown as { __voxwright?: Vox }).__voxwright?.renderer.whenIdle());

    const poseAfter = await page.evaluate(() => {
      const r = (window as unknown as { __voxwright?: Vox }).__voxwright?.renderer;
      return (r as unknown as { getPose?: () => TouchPose })?.getPose?.() ?? null;
    });

    check(
      "Layout-Toggle-Stress",
      "Camera orbit functions normally after rapid layout toggles",
      poseBefore !== null &&
        poseAfter !== null &&
        (Math.abs(poseAfter.azimuth - poseBefore.azimuth) > 5 ||
          Math.abs(poseAfter.elevation - poseBefore.elevation) > 5),
      `deltaAzimuth=${poseBefore && poseAfter ? (poseAfter.azimuth - poseBefore.azimuth).toFixed(1) : "N/A"}`,
    );

    check(
      "Layout-Toggle-Stress",
      "Zero uncaught errors or console exceptions across all 10 layout cycles",
      errors.length === 0,
      `errors=${errors.join("; ")}`,
    );

    await page.close();
  }

  // =========================================================================
  // TEST SUITE 4: BottomSheet Drag Physics, Snap States & Fling Calculations
  // =========================================================================
  console.log("\n=== SUITE 4: BottomSheet Drag Physics, Snap States & Fling Calculations ===");
  {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: true,
    });
    await page.goto(url);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="renderer"]')?.getAttribute("data-kind") === "webgl",
      { timeout: 30000 },
    );
    const fileInput = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await fileInput.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await page.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 60000 },
    );
    await page.evaluate(() => (window as unknown as { __voxwright?: Vox }).__voxwright?.renderer.whenIdle());

    const cdp = await page.createCDPSession();

    // 4A: Open sheet by tapping block swatch
    await page.waitForSelector('[data-testid="active-block-swatch"]', { timeout: 10000 });
    const swatchEl = (await page.$('[data-testid="active-block-swatch"]'))!;
    const sBox = (await swatchEl.boundingBox())!;
    await page.touchscreen.tap(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);

    await page.waitForSelector('[data-testid="bottom-sheet"]', { timeout: 5000 });
    // Allow sheet entrance transition to settle
    await new Promise((r) => setTimeout(r, 350));
    check("Sheet-Physics", "BottomSheet opens when block swatch is tapped", true);

    // Verify handle and close button touch target bounds
    const handleEl = (await page.$('[data-testid="bottom-sheet-handle"]'))!;
    const hBox = (await handleEl.boundingBox())!;
    check(
      "Sheet-Physics",
      "Sheet drag handle meets WCAG touch target height >= 44px",
      hBox.height >= 44,
      `height=${hBox.height.toFixed(1)}px`,
    );

    const closeEl = (await page.$('[data-testid="bottom-sheet-close"]'))!;
    const closeBox = (await closeEl.boundingBox())!;
    check(
      "Sheet-Physics",
      "Sheet close button meets WCAG touch target >= 44x44px",
      closeBox.width >= 44 && closeBox.height >= 44,
      `width=${closeBox.width.toFixed(1)}px, height=${closeBox.height.toFixed(1)}px`,
    );

    const getSheetMetrics = () =>
      page.evaluate(() => {
        const el = document.querySelector('[data-testid="bottom-sheet"]') as HTMLElement;
        if (!el) return { open: false, top: 0, visibleHeight: 0, transform: "" };
        const r = el.getBoundingClientRect();
        return {
          open: true,
          top: Math.round(r.top),
          visibleHeight: Math.round(window.innerHeight - r.top),
          transform: el.style.transform,
        };
      });

    // Initial snap position: half snap (~52% of vh = ~439px)
    const initSheet = await getSheetMetrics();
    check(
      "Sheet-Physics",
      "Initial open position is half snap (~52% vh, visible ~439px)",
      initSheet.visibleHeight >= 430 && initSheet.visibleHeight <= 450,
      `visibleHeight=${initSheet.visibleHeight}px, transform=${initSheet.transform}`,
    );

    // 4B: Drag sheet upward towards full snap
    const hx = Math.round(hBox.x + hBox.width / 2);
    const hy = Math.round(hBox.y + hBox.height / 2);
    await page.touchscreen.touchStart(hx, hy);
    await page.touchscreen.touchMove(hx, hy - 250);
    await page.touchscreen.touchEnd();
    await new Promise((r) => setTimeout(r, 350));

    const fullSheet = await getSheetMetrics();
    check(
      "Sheet-Physics",
      "Dragging handle upward smoothly expands sheet to full snap (~88% vh, visible ~744px)",
      fullSheet.visibleHeight >= 730 && fullSheet.visibleHeight <= 755,
      `visibleHeight=${fullSheet.visibleHeight}px, transform=${fullSheet.transform}`,
    );

    // 4C: Fling down from full snap -> transitions to half snap
    const hBoxFull = (await (await page.$('[data-testid="bottom-sheet-handle"]'))!.boundingBox())!;
    const hxFull = Math.round(hBoxFull.x + hBoxFull.width / 2);
    const hyFull = Math.round(hBoxFull.y + hBoxFull.height / 2);
    await page.touchscreen.touchStart(hxFull, hyFull);
    await page.touchscreen.touchMove(hxFull, hyFull + 200);
    await page.touchscreen.touchEnd();
    await new Promise((r) => setTimeout(r, 350));

    const halfSheet = await getSheetMetrics();
    check(
      "Sheet-Physics",
      "Downwards fling (>0.45 px/ms) from full snaps down to half snap",
      halfSheet.visibleHeight >= 430 && halfSheet.visibleHeight <= 450,
      `visibleHeight=${halfSheet.visibleHeight}px, transform=${halfSheet.transform}`,
    );

    // 4D: Fling down from half snap -> transitions to peek snap
    const hBoxHalf = (await (await page.$('[data-testid="bottom-sheet-handle"]'))!.boundingBox())!;
    const hxHalf = Math.round(hBoxHalf.x + hBoxHalf.width / 2);
    const hyHalf = Math.round(hBoxHalf.y + hBoxHalf.height / 2);
    await page.touchscreen.touchStart(hxHalf, hyHalf);
    await page.touchscreen.touchMove(hxHalf, hyHalf + 200);
    await page.touchscreen.touchEnd();
    await new Promise((r) => setTimeout(r, 350));

    const peekSheet = await getSheetMetrics();
    check(
      "Sheet-Physics",
      "Downwards fling from half snap transitions to peek snap (visible ~160px)",
      peekSheet.visibleHeight >= 150 && peekSheet.visibleHeight <= 170,
      `visibleHeight=${peekSheet.visibleHeight}px, transform=${peekSheet.transform}`,
    );

    // 4E: Fling down from peek snap -> transitions to closed state
    const hBoxPeek = (await (await page.$('[data-testid="bottom-sheet-handle"]'))!.boundingBox())!;
    const hxPeek = Math.round(hBoxPeek.x + hBoxPeek.width / 2);
    const hyPeek = Math.round(hBoxPeek.y + hBoxPeek.height / 2);
    await page.touchscreen.touchStart(hxPeek, hyPeek);
    await page.touchscreen.touchMove(hxPeek, hyPeek + 200);
    await page.touchscreen.touchEnd();
    await new Promise((r) => setTimeout(r, 350));

    const closedSheet = await getSheetMetrics();
    check(
      "Sheet-Physics",
      "Downwards fling from peek snap closes the sheet completely",
      !closedSheet.open,
      `open=${closedSheet.open}`,
    );

    // 4F: Reopen sheet and test Backdrop Dismiss
    await (await page.$('[data-testid="active-block-swatch"]'))!.click();
    await page.waitForSelector('[data-testid="bottom-sheet-backdrop"]', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 350));

    // Tap unobstructed area of backdrop (y=150, above the half-sheet which starts at y=404)
    await page.evaluate(() => {
      const bd = document.querySelector('[data-testid="bottom-sheet-backdrop"]') as HTMLElement;
      bd?.click();
    });
    await new Promise((r) => setTimeout(r, 350));

    const sheetAfterBackdrop = await page.$('[data-testid="bottom-sheet"]');
    check(
      "Sheet-Physics",
      "Tapping backdrop dismisses the bottom sheet to closed state",
      sheetAfterBackdrop === null,
    );

    // 4G: Test Escape Key dismissal
    await (await page.$('[data-testid="active-block-swatch"]'))!.click();
    await page.waitForSelector('[data-testid="bottom-sheet"]', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 350));
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 350));

    const sheetAfterEsc = await page.$('[data-testid="bottom-sheet"]');
    check(
      "Sheet-Physics",
      "Pressing Escape key closes the bottom sheet",
      sheetAfterEsc === null,
    );

    // 4H: Test visualViewport virtual keyboard resize behavior
    await (await page.$('[data-testid="active-block-swatch"]'))!.click();
    await page.waitForSelector('[data-testid="palette-search"]', { timeout: 5000 });

    // Emulate virtual keyboard by resizing visual viewport from 844px to 450px
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
    await new Promise((r) => setTimeout(r, 200));

    const searchVisibleUnderKeyboard = await page.evaluate(() => {
      const searchBox = document.querySelector('[data-testid="palette-search"]')?.getBoundingClientRect();
      const vh = window.visualViewport?.height ?? window.innerHeight;
      return searchBox !== undefined && searchBox.top >= 0 && searchBox.bottom <= vh;
    });
    check(
      "Sheet-Physics",
      "Palette search input remains visible within reduced visualViewport (450px) when keyboard opens",
      searchVisibleUnderKeyboard,
    );

    // Restore viewport metrics
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));

    check(
      "Sheet-Physics",
      "Zero console errors encountered throughout bottom sheet physics suite",
      errors.length === 0,
      `errors=${errors.join("; ")}`,
    );

    await page.close();
  }

  // =========================================================================
  // TEST SUITE 5: Ergonomics, Left-Handed Mode & Toolbar Horizontal Scroll
  // =========================================================================
  console.log("\n=== SUITE 5: Ergonomics, Left-Handed Mode & Toolbar Scroll ===");
  {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: true,
    });
    await page.goto(url);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="renderer"]')?.getAttribute("data-kind") === "webgl",
      { timeout: 30000 },
    );
    const fileInput = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await fileInput.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await page.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 60000 },
    );
    await page.evaluate(() => (window as unknown as { __voxwright?: Vox }).__voxwright?.renderer.whenIdle());

    // 5A: Thumb cluster default right-handed positioning
    const rightThumbBox = (await (await page.$('[data-testid="thumb-cluster"]'))!.boundingBox())!;
    check(
      "Ergonomics",
      "ThumbCluster default position is on the right side of the screen",
      rightThumbBox.x > 390 / 2,
      `x=${rightThumbBox.x.toFixed(1)}px (midpoint 195px)`,
    );

    // 5B: Toggle Left-Handed mode via menu sheet
    const menuBtn = (await page.$('[data-testid="mobile-menu-btn"]'))!;
    await menuBtn.click();
    await page.waitForSelector('[data-testid="left-handed-toggle"] input', { timeout: 5000 });

    const lhCheckbox = (await page.$('[data-testid="left-handed-toggle"] input'))!;
    await lhCheckbox.click();
    // Close menu sheet
    const closeBtn = (await page.$('[data-testid="bottom-sheet-close"]'))!;
    await closeBtn.click();
    await new Promise((r) => setTimeout(r, 200));

    const leftThumbBox = (await (await page.$('[data-testid="thumb-cluster"]'))!.boundingBox())!;
    check(
      "Ergonomics",
      "ThumbCluster mirrors cleanly to the left side in left-handed mode",
      leftThumbBox.x < 390 / 2 && leftThumbBox.x <= 24,
      `x=${leftThumbBox.x.toFixed(1)}px (left threshold <= 24px)`,
    );

    // 5C: Bottom toolbar horizontal scroll test
    const scrollStatus = await page.evaluate(() => {
      const tb = document.querySelector('[data-testid="toolbar"]') as HTMLElement;
      const initialScrollLeft = tb.scrollLeft;
      tb.scrollLeft = 500;
      const maxScrollLeft = tb.scrollLeft;
      const docScrollX = window.scrollX;
      return {
        initialScrollLeft,
        maxScrollLeft,
        docScrollX,
        canScroll: maxScrollLeft > 50,
      };
    });

    check(
      "Ergonomics",
      "Bottom toolbar scrolls horizontally to reveal all tools without causing page scroll",
      scrollStatus.canScroll && scrollStatus.docScrollX === 0,
      `maxScrollLeft=${scrollStatus.maxScrollLeft}px, docScrollX=${scrollStatus.docScrollX}`,
    );

    check(
      "Ergonomics",
      "Zero console errors encountered throughout ergonomics suite",
      errors.length === 0,
      `errors=${errors.join("; ")}`,
    );

    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log("\n=======================================================");
const passCount = results.filter((r) => r.status === "PASS").length;
const failCount = results.filter((r) => r.status === "FAIL").length;
console.log(`Milestone MB3 Stress Test Summary: ${passCount} PASSED, ${failCount} FAILED (Total: ${results.length})`);
if (failCount > 0) {
  process.exit(1);
}
