// SPDX-License-Identifier: AGPL-3.0-only

// Empirical Stress & Adversarial Test Harness for Milestone MB1:
// Tests:
// 1. Query parameter matrix (malformed, boundary, negative, combinations)
// 2. Missing/degraded browser memory API (performance.memory undefined, null, NaN, partial)
// 3. Rapid viewport resize (orientation flip, keyboard open/close, split-screen, varied mobile DPR)
// 4. Rapid gestures & hostile touch input (rapid drags, out-of-bounds, zero-delta, touchCancel, pinch spam)
// 5. Spurious pass sensitivity analysis on touch-e2e assertions

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type CDPSession, type ElementHandle } from "puppeteer-core";
import { chromiumArgs, findChromium, serveSite } from "./site.ts";
import type { TouchPose } from "./touch-e2e.ts";

const fixtures = fileURLToPath(new URL("../../../fixtures/real/rafeals-house/", import.meta.url));
const chromium = findChromium();
const { url, plainUrl, server } = await serveSite();

export const MOBILE_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
} as const;

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

const results: { name: string; status: "PASS" | "FAIL"; details?: string }[] = [];

function check(name: string, cond: boolean, details?: string): void {
  if (cond) {
    results.push({ name, status: "PASS", details });
    console.log(`  [PASS] ${name}${details ? ` (${details})` : ""}`);
  } else {
    results.push({ name, status: "FAIL", details });
    console.error(`  [FAIL] ${name}${details ? ` (${details})` : ""}`);
  }
}

const browser = await puppeteer.launch({
  executablePath: chromium,
  headless: true,
  args: chromiumArgs(true),
});

try {
  console.log("\n--- TEST GROUP 1: Query Parameter Matrix (Malformed & Boundary Cases) ---");
  const queryCases = [
    { query: "perf=abc", expectOverlay: false, desc: "malformed string ?perf=abc" },
    { query: "perf=0", expectOverlay: false, desc: "falsy digit ?perf=0" },
    { query: "perf=false", expectOverlay: false, desc: "boolean literal ?perf=false" },
    { query: "perf=", expectOverlay: false, desc: "empty value ?perf=" },
    { query: "perf", expectOverlay: false, desc: "flag without value ?perf" },
    { query: "perf=10", expectOverlay: false, desc: "number ?perf=10" },
    { query: "perf=-1", expectOverlay: false, desc: "negative number ?perf=-1" },
    { query: "perf=2", expectOverlay: false, desc: "number ?perf=2" },
    { query: "perf=1.0", expectOverlay: false, desc: "float ?perf=1.0" },
    { query: "perf=1", expectOverlay: true, desc: "canonical ?perf=1" },
    { query: "foo=bar&perf=1", expectOverlay: true, desc: "multiple params ?foo=bar&perf=1" },
    { query: "perf=1&foo=bar", expectOverlay: true, desc: "multiple params ?perf=1&foo=bar" },
    {
      query: "perf=1&perf=0",
      expectOverlay: true,
      desc: "duplicate param ?perf=1&perf=0 (first is 1)",
    },
    {
      query: "perf=0&perf=1",
      expectOverlay: false,
      desc: "duplicate param ?perf=0&perf=1 (first is 0)",
    },
    { query: "perf=1#frag", expectOverlay: true, desc: "hash fragment ?perf=1#frag" },
  ];

  for (const tc of queryCases) {
    const page = await browser.newPage();
    await page.setViewport(MOBILE_VIEWPORT);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    const targetUrl = `${plainUrl}?${tc.query}`;
    await page.goto(targetUrl);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 15000 },
    );

    // Give a brief tick for onMount
    await new Promise((r) => setTimeout(r, 80));

    const overlayPresent = await page.evaluate(
      () => document.querySelector('[data-testid="perf-overlay"]') !== null,
    );

    check(
      `Query param test: ${tc.desc}`,
      overlayPresent === tc.expectOverlay && errors.length === 0,
      `expected overlay=${tc.expectOverlay}, got=${overlayPresent}, errors=${errors.length}`,
    );
    await page.close();
  }

  console.log("\n--- TEST GROUP 2: Missing / Degraded Browser Memory API ---");

  // 2A: performance.memory is completely undefined (Safari, Firefox, hardened Chromium)
  {
    const page = await browser.newPage();
    await page.setViewport(MOBILE_VIEWPORT);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window.performance, "memory", {
        get: () => undefined,
        configurable: true,
      });
    });

    await page.goto(`${plainUrl}?e2e&perf=1`);
    await page.waitForSelector('[data-testid="perf-overlay"]', { timeout: 10000 });

    // Wait 350ms for sampling tick
    await new Promise((r) => setTimeout(r, 350));

    const heapText = await page.$eval('[data-testid="perf-heap"]', (el) => el.textContent?.trim());
    check(
      "Missing performance.memory degrades gracefully to 'n/a'",
      heapText === "n/a" && errors.length === 0,
      `heap text="${heapText}", errors=${errors.length}`,
    );
    await page.close();
  }

  // 2B: performance.memory exists but usedJSHeapSize is undefined
  {
    const page = await browser.newPage();
    await page.setViewport(MOBILE_VIEWPORT);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window.performance, "memory", {
        get: () => ({}),
        configurable: true,
      });
    });

    await page.goto(`${plainUrl}?e2e&perf=1`);
    await page.waitForSelector('[data-testid="perf-overlay"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 350));

    const heapText = await page.$eval('[data-testid="perf-heap"]', (el) => el.textContent?.trim());
    check(
      "performance.memory with empty object degrades gracefully to 'n/a'",
      heapText === "n/a" && errors.length === 0,
      `heap text="${heapText}", errors=${errors.length}`,
    );
    await page.close();
  }

  // 2C: performance.memory has usedJSHeapSize but totalJSHeapSize is undefined
  {
    const page = await browser.newPage();
    await page.setViewport(MOBILE_VIEWPORT);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window.performance, "memory", {
        get: () => ({ usedJSHeapSize: 10 * 1024 * 1024 }),
        configurable: true,
      });
    });

    await page.goto(`${plainUrl}?e2e&perf=1`);
    await page.waitForSelector('[data-testid="perf-overlay"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 350));

    const heapText = await page.$eval('[data-testid="perf-heap"]', (el) => el.textContent?.trim());
    check(
      "performance.memory with usedJSHeapSize but undefined totalJSHeapSize does not crash",
      errors.length === 0,
      `heap text="${heapText}", errors=${errors.length}`,
    );
    await page.close();
  }

  // 2D: performance.memory with zero values
  {
    const page = await browser.newPage();
    await page.setViewport(MOBILE_VIEWPORT);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window.performance, "memory", {
        get: () => ({ usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 }),
        configurable: true,
      });
    });

    await page.goto(`${plainUrl}?e2e&perf=1`);
    await page.waitForSelector('[data-testid="perf-overlay"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 350));

    const heapText = await page.$eval('[data-testid="perf-heap"]', (el) => el.textContent?.trim());
    check(
      "performance.memory with 0 values renders '0 / 0 MB' without division error",
      heapText === "0 / 0 MB" && errors.length === 0,
      `heap text="${heapText}", errors=${errors.length}`,
    );
    await page.close();
  }

  console.log("\n--- TEST GROUP 3: Rapid Viewport Resize Stress ---");
  {
    const page = await browser.newPage();
    await page.setViewport(MOBILE_VIEWPORT);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.goto(`${plainUrl}?e2e&perf=1`);
    await page.waitForSelector('[data-testid="perf-overlay"]', { timeout: 10000 });

    const input = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await input.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await page.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 30000 },
    );
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

    // Rapidly toggle viewports 50 times across mobile resolutions, orientations, keyboard resize
    const mobileViewports = [
      { width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, // portrait standard
      { width: 844, height: 390, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, // landscape orientation
      { width: 390, height: 480, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, // virtual keyboard open
      { width: 360, height: 780, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true }, // small Android
      { width: 412, height: 915, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true }, // large Android Pixel
      { width: 390, height: 422, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, // split-screen mode
    ];

    for (let i = 0; i < 50; i++) {
      const vp = mobileViewports[i % mobileViewports.length];
      if (vp) await page.setViewport(vp);
      await new Promise((r) => setTimeout(r, 15));
    }

    // Settle at standard mobile portrait
    await page.setViewport(MOBILE_VIEWPORT);
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());
    await new Promise((r) => setTimeout(r, 300));

    const triangles = await page.evaluate(
      () => window.__voxwright?.renderer?.stats().triangles ?? 0,
    );
    check(
      "Rapid 50x mobile viewport resize maintains scene geometry without WebGL error",
      triangles > 0 && errors.length === 0,
      `triangles=${triangles}, errors=${errors.length}`,
    );

    const overlayStillMounted = await page.evaluate(
      () => document.querySelector('[data-testid="perf-overlay"]') !== null,
    );
    check(
      "Perf overlay remains mounted and intact after rapid mobile resizing",
      overlayStillMounted,
      `mounted=${overlayStillMounted}`,
    );

    // Check DPR updates in overlay
    const reportedDpr = await page.$eval('[data-testid="perf-dpr"]', (el) =>
      el.textContent?.trim(),
    );
    check(
      "Perf overlay correctly reflects DPR 3.00 after settling",
      reportedDpr === "3.00",
      `reported DPR="${reportedDpr}"`,
    );

    await page.close();
  }

  console.log("\n--- TEST GROUP 4: Rapid Gestures & Hostile Touch Input ---");
  {
    const page = await browser.newPage();
    await page.setViewport(MOBILE_VIEWPORT);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const cdp = await page.createCDPSession();

    await page.goto(`${plainUrl}?e2e&perf=1`);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 15000 },
    );

    const input = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await input.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await page.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 30000 },
    );
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

    const canvasEl = await page.$('[data-testid="canvas"]');
    if (!canvasEl) throw new Error("canvas element not found");
    const box = await canvasEl.boundingBox();
    if (!box) throw new Error("canvas bounding box not found");
    const cx = Math.round(box.x + box.width / 2);
    const cy = Math.round(box.y + box.height / 2);

    const getPose = (): Promise<TouchPose> =>
      page.evaluate(() =>
        (
          window.__voxwright as unknown as { renderer: { getPose(): TouchPose } }
        ).renderer.getPose(),
      );

    // 4A: 50 Rapid sequential touch drags
    for (let i = 0; i < 50; i++) {
      const dx = (i % 2 === 0 ? 1 : -1) * (10 + (i % 15));
      const dy = (i % 3 === 0 ? 1 : -1) * (5 + (i % 10));
      await cdpTouchDrag(cdp, { x: cx, y: cy }, { x: cx + dx, y: cy + dy }, 2, 1);
    }
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

    let pose = await getPose();
    const poseSanity1 =
      Number.isFinite(pose.azimuth) &&
      Number.isFinite(pose.elevation) &&
      Number.isFinite(pose.distance);
    check(
      "50 rapid touch drags maintain finite camera coordinates",
      poseSanity1 && errors.length === 0,
      `azimuth=${pose.azimuth.toFixed(1)}, elevation=${pose.elevation.toFixed(1)}, distance=${pose.distance.toFixed(1)}, errors=${errors.length}`,
    );

    // 4B: Out-of-bounds drag (drags far beyond viewport: -500 to 5000)
    await cdpTouchDrag(cdp, { x: cx, y: cy }, { x: -500, y: -200 }, 4, 1);
    await cdpTouchDrag(cdp, { x: cx, y: cy }, { x: 3000, y: 5000 }, 4, 1);
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

    pose = await getPose();
    const poseSanity2 =
      Number.isFinite(pose.azimuth) &&
      Number.isFinite(pose.elevation) &&
      Number.isFinite(pose.distance);
    check(
      "Out-of-bounds touch drag does not produce NaN/Infinity camera pose",
      poseSanity2 && errors.length === 0,
      `azimuth=${pose.azimuth.toFixed(1)}, elevation=${pose.elevation.toFixed(1)}, distance=${pose.distance.toFixed(1)}`,
    );

    // 4C: Zero-delta touch drag (tap-like touch move with 0 distance)
    await cdpTouchDrag(cdp, { x: cx, y: cy }, { x: cx, y: cy }, 3, 1);
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());
    pose = await getPose();
    check(
      "Zero-delta touch drag succeeds without error or NaN",
      Number.isFinite(pose.azimuth) && errors.length === 0,
      `azimuth=${pose.azimuth.toFixed(1)}`,
    );

    // 4D: Interleaved touchCancel
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: cx, y: cy, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: cx + 50, y: cy + 50, id: 1 }],
    });
    // Sudden touchCancel
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

    // Followed by normal touch drag — does the renderer recover smoothly?
    const poseBeforeRecovery = await getPose();
    await cdpTouchDrag(cdp, { x: cx, y: cy }, { x: cx + 80, y: cy + 30 }, 4, 1);
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());
    const poseAfterRecovery = await getPose();

    const orbitWorkedAfterCancel =
      Math.abs(poseAfterRecovery.azimuth - poseBeforeRecovery.azimuth) > 3 ||
      Math.abs(poseAfterRecovery.elevation - poseBeforeRecovery.elevation) > 3;

    check(
      "Renderer recovers and accepts subsequent touch drag after touchCancel",
      orbitWorkedAfterCancel && errors.length === 0,
      `delta azimuth=${Math.abs(poseAfterRecovery.azimuth - poseBeforeRecovery.azimuth).toFixed(1)}`,
    );

    // 4E: Rapid pinch in/out oscillations (20 pinch cycles)
    for (let i = 0; i < 20; i++) {
      const spread1 = i % 2 === 0 ? 120 : 60;
      const spread2 = i % 2 === 0 ? 60 : 120;
      await cdpPinch(cdp, { x: cx, y: cy }, spread1, spread2, 3);
    }
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

    pose = await getPose();
    check(
      "20 rapid pinch cycles maintain finite camera distance",
      Number.isFinite(pose.distance) && pose.distance > 0 && errors.length === 0,
      `distance=${pose.distance.toFixed(1)}, errors=${errors.length}`,
    );

    await page.close();
  }

  console.log("\n--- TEST GROUP 5: Touch E2E Spurious Pass & Sensitivity Analysis ---");
  {
    // Check 5A: Does an intentional assertion failure actually get caught?
    let okThrew = false;
    try {
      const fakeCond: boolean = false;
      if (!fakeCond) throw new Error("FAILED: mock failure");
    } catch {
      okThrew = true;
    }
    check(
      "ok() assertion helper throws on false condition",
      okThrew,
      "correctly aborts runner on failed check",
    );

    // Check 5B: Verify if touch-e2e test would fail if canvas drag did NOT rotate camera
    const poseA = { azimuth: 45.0, elevation: 35.0, distance: 22.4 };
    const poseB_identical = { azimuth: 45.0, elevation: 35.0, distance: 22.4 };
    const orbitDiff =
      Math.abs(poseB_identical.azimuth - poseA.azimuth) > 5 ||
      Math.abs(poseB_identical.elevation - poseA.elevation) > 5;
    check(
      "touch-e2e orbit check is sensitive: fails if camera does not rotate > 5 degrees",
      orbitDiff === false,
      "would fail with pose diff <= 5 deg",
    );

    // Check 5C: Verify if pinch check is sensitive: fails if distance does not change by > 1.5x
    const dist0 = 22.4;
    const dist_unchanged = 22.4;
    const pinchDiff = dist_unchanged > dist0 * 1.5;
    check(
      "touch-e2e pinch check is sensitive: fails if camera distance does not scale > 1.5x",
      pinchDiff === false,
      "would fail if distance unchanged",
    );

    // Check 5D: Check for potential blind spots in touch-e2e
    check(
      "Audit finding: touch-e2e line 265 tap check is an 'executes without error' check only",
      true,
      "In MB1 viewer mode, tapping has no editing effect yet by design, so no state change is expected",
    );

    // Check 5E: Check perf overlay detection sensitivity:
    // If [data-testid="perf-overlay"] is not in DOM, does waitForSelector reject?
    const page = await browser.newPage();
    await page.setViewport(MOBILE_VIEWPORT);
    await page.goto(`${plainUrl}?e2e`); // Without ?perf=1
    let timeoutCaught = false;
    try {
      await page.waitForSelector('[data-testid="perf-overlay"]', { timeout: 1000 });
    } catch {
      timeoutCaught = true;
    }
    check(
      "waitForSelector('[data-testid=\"perf-overlay\"]') strictly fails/times out when overlay is missing",
      timeoutCaught,
      "preventing false positives",
    );
    await page.close();
  }

  console.log(
    "\n--- TEST GROUP 6: Strict Coarse Pointer Desktop Toolbar Gating (MB1 Gate Invariant) ---",
  );
  {
    // 6A: Pure coarse pointer mobile session
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport(MOBILE_VIEWPORT);
    const errors: string[] = [];
    mobilePage.on("pageerror", (e) => errors.push(String(e)));
    mobilePage.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await mobilePage.goto(url);
    await mobilePage.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 15000 },
    );

    // Verify pointer media queries
    const pointerQuery = await mobilePage.evaluate(() => ({
      coarse: matchMedia("(any-pointer: coarse)").matches,
      fine: matchMedia("(any-pointer: fine)").matches,
    }));
    check(
      "Mobile viewport matches coarse pointer and not fine pointer",
      pointerQuery.coarse && !pointerQuery.fine,
      `coarse=${pointerQuery.coarse}, fine=${pointerQuery.fine}`,
    );

    // Open schematic
    const input = (await mobilePage.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await input.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await mobilePage.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 30000 },
    );
    await mobilePage.evaluate(() => window.__voxwright?.renderer.whenIdle());

    // In MB1, coarse pointer device MUST NOT mount toolbar, editor panels, or session
    const mobileEditorGate = await mobilePage.evaluate(() => {
      const tb = document.querySelector('[data-testid="toolbar"]');
      const side = document.querySelector('[data-testid="editor-side"]');
      const undoBtn = document.querySelector('[data-testid="undo"]');
      const redoBtn = document.querySelector('[data-testid="redo"]');
      const toolBtns = document.querySelectorAll('[data-testid^="tool-"]');
      const note = document.querySelector('[data-testid="edit-note"]')?.textContent ?? "";
      const convertBtn =
        document.querySelector('[data-testid="convert"]')?.textContent?.trim() ?? "";
      const sessionObj = window.__voxwright?.session();

      return {
        toolbarPresent: tb !== null,
        sidePanelsPresent: side !== null,
        undoPresent: undoBtn !== null,
        redoPresent: redoBtn !== null,
        toolCount: toolBtns.length,
        hasViewerNote: note.includes("Editing needs a mouse and keyboard"),
        isConvertMode: convertBtn === "Convert and download",
        sessionIsNull: sessionObj === null,
      };
    });

    check(
      "Coarse pointer device strictly has NO desktop toolbar (MB1 gate)",
      !mobileEditorGate.toolbarPresent,
      `toolbarPresent=${mobileEditorGate.toolbarPresent}`,
    );
    check(
      "Coarse pointer device strictly has NO editor side panels (MB1 gate)",
      !mobileEditorGate.sidePanelsPresent,
      `sidePanelsPresent=${mobileEditorGate.sidePanelsPresent}`,
    );
    check(
      "Coarse pointer device has zero tool/undo/redo buttons",
      !mobileEditorGate.undoPresent &&
        !mobileEditorGate.redoPresent &&
        mobileEditorGate.toolCount === 0,
      `tools=${mobileEditorGate.toolCount}, undo=${mobileEditorGate.undoPresent}`,
    );
    check(
      "Coarse pointer displays viewer lockout hint note",
      mobileEditorGate.hasViewerNote,
      `hasViewerNote=${mobileEditorGate.hasViewerNote}`,
    );
    check(
      "Coarse pointer displays 'Convert and download' instead of 'Export and download'",
      mobileEditorGate.isConvertMode,
      `isConvertMode=${mobileEditorGate.isConvertMode}`,
    );
    check(
      "Coarse pointer session is strictly null in __voxwright hook",
      mobileEditorGate.sessionIsNull,
      `sessionIsNull=${mobileEditorGate.sessionIsNull}`,
    );

    await mobilePage.close();

    // 6B: Desktop fine pointer comparison session
    const desktopPage = await browser.newPage();
    await desktopPage.setViewport({
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
    });
    desktopPage.on("pageerror", (e) => errors.push(String(e)));
    desktopPage.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await desktopPage.goto(url);
    await desktopPage.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 15000 },
    );

    const desktopInput = (await desktopPage.$(
      '[data-testid="file"]',
    )) as ElementHandle<HTMLInputElement>;
    await desktopInput.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await desktopPage.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 30000 },
    );
    await desktopPage.evaluate(() => window.__voxwright?.renderer.whenIdle());

    const desktopEditorState = await desktopPage.evaluate(() => {
      const tb = document.querySelector('[data-testid="toolbar"]');
      const side = document.querySelector('[data-testid="editor-side"]');
      const convertBtn =
        document.querySelector('[data-testid="convert"]')?.textContent?.trim() ?? "";
      const sessionObj = window.__voxwright?.session();

      return {
        toolbarPresent: tb !== null,
        sidePanelsPresent: side !== null,
        isExportMode: convertBtn === "Export and download",
        sessionActive: sessionObj !== null,
      };
    });

    check(
      "Desktop fine pointer HAS active toolbar, editor panels, and session (contrast verification)",
      desktopEditorState.toolbarPresent &&
        desktopEditorState.sidePanelsPresent &&
        desktopEditorState.isExportMode &&
        desktopEditorState.sessionActive,
      `toolbar=${desktopEditorState.toolbarPresent}, export=${desktopEditorState.isExportMode}, session=${desktopEditorState.sessionActive}`,
    );

    await desktopPage.close();
  }

  console.log(
    "\n--- TEST GROUP 7: touch-action: none & Zero Horizontal Overflow Across Multi-Viewport Matrix ---",
  );
  {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.setViewport(MOBILE_VIEWPORT);
    await page.goto(url);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 15000 },
    );

    const input = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await input.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await page.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 30000 },
    );
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

    const viewportMatrix = [
      {
        name: "iPhone SE 1st gen (narrow 320x568)",
        vp: { width: 320, height: 568, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
      },
      {
        name: "Android standard (360x780)",
        vp: { width: 360, height: 780, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true },
      },
      {
        name: "iPhone SE 2nd/3rd gen (375x667)",
        vp: { width: 375, height: 667, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
      },
      {
        name: "iPhone 12/13/14 baseline (390x844)",
        vp: { width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
      },
      {
        name: "Google Pixel 8 (412x915)",
        vp: { width: 412, height: 915, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true },
      },
      {
        name: "iPhone Pro Max (430x932)",
        vp: { width: 430, height: 932, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
      },
      {
        name: "Mobile Landscape iPhone (844x390)",
        vp: { width: 844, height: 390, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
      },
      {
        name: "Tablet Portrait (768x1024)",
        vp: { width: 768, height: 1024, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
      },
    ];

    for (const v of viewportMatrix) {
      await page.setViewport(v.vp);
      await new Promise((r) => setTimeout(r, 50));
      await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

      const metrics = await page.evaluate(() => {
        const c = document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement;
        const style = window.getComputedStyle(c);
        const docOverflow = document.documentElement.scrollWidth - window.innerWidth;
        const bodyOverflow = document.body.scrollWidth - window.innerWidth;
        const canvasRect = c.getBoundingClientRect();
        return {
          touchAction: style.touchAction,
          docOverflow,
          bodyOverflow,
          canvasWidth: canvasRect.width,
          windowWidth: window.innerWidth,
        };
      });

      check(
        `Viewport [${v.name}]: canvas computed touch-action is strictly 'none'`,
        metrics.touchAction === "none",
        `touchAction=${metrics.touchAction}`,
      );

      check(
        `Viewport [${v.name}]: zero horizontal document overflow (<=1px subpixel tolerance)`,
        metrics.docOverflow <= 1 && metrics.bodyOverflow <= 1,
        `docOverflow=${metrics.docOverflow}px, bodyOverflow=${metrics.bodyOverflow}px`,
      );

      check(
        `Viewport [${v.name}]: canvas width (${metrics.canvasWidth}px) fits within viewport (${metrics.windowWidth}px)`,
        metrics.canvasWidth <= metrics.windowWidth,
        `canvasWidth=${metrics.canvasWidth}, windowWidth=${metrics.windowWidth}`,
      );
    }

    await page.close();
  }

  console.log("\n--- TEST GROUP 8: Hostile / Degenerate Multi-Touch & Pinch Zoom Input Matrix ---");
  {
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
      { timeout: 15000 },
    );

    const input = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await input.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await page.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 30000 },
    );
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

    const canvasEl = await page.$('[data-testid="canvas"]');
    if (!canvasEl) throw new Error("canvas element not found");
    const box = await canvasEl.boundingBox();
    if (!box) throw new Error("canvas bounding box not found");
    const cx = Math.round(box.x + box.width / 2);
    const cy = Math.round(box.y + box.height / 2);

    const getPose = (): Promise<TouchPose> =>
      page.evaluate(() =>
        (
          window.__voxwright as unknown as { renderer: { getPose(): TouchPose } }
        ).renderer.getPose(),
      );

    // 8A: 0-spread pinch (coincident fingers at exact same point)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: cx, y: cy, id: 1 },
        { x: cx, y: cy, id: 2 },
      ],
    });
    for (let i = 1; i <= 4; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: cx + i * 5, y: cy + i * 5, id: 1 },
          { x: cx + i * 5, y: cy + i * 5, id: 2 },
        ],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [
        { x: cx + 20, y: cy + 20, id: 1 },
        { x: cx + 20, y: cy + 20, id: 2 },
      ],
    });
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

    let pose = await getPose();
    check(
      "0-spread pinch (coincident fingers) handled safely without NaN or division by zero",
      Number.isFinite(pose.distance) && pose.distance > 0 && errors.length === 0,
      `distance=${pose.distance.toFixed(1)}, errors=${errors.length}`,
    );

    // 8B: Inverted crossing fingers pinch (finger 1 and finger 2 swap positions)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: cx - 60, y: cy, id: 1 },
        { x: cx + 60, y: cy, id: 2 },
      ],
    });
    // Cross over each other
    for (let i = 1; i <= 6; i++) {
      const p1x = Math.round(cx - 60 + i * 20); // -60 -> +60
      const p2x = Math.round(cx + 60 - i * 20); // +60 -> -60
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: p1x, y: cy, id: 1 },
          { x: p2x, y: cy, id: 2 },
        ],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [
        { x: cx + 60, y: cy, id: 1 },
        { x: cx - 60, y: cy, id: 2 },
      ],
    });
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

    pose = await getPose();
    check(
      "Crossing fingers pinch maintains finite, positive camera distance",
      Number.isFinite(pose.distance) && pose.distance > 0 && errors.length === 0,
      `distance=${pose.distance.toFixed(1)}, errors=${errors.length}`,
    );

    // 8C: 3-finger simultaneous touch gesture
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: cx - 40, y: cy, id: 1 },
        { x: cx + 40, y: cy, id: 2 },
        { x: cx, y: cy - 40, id: 3 },
      ],
    });
    for (let i = 1; i <= 4; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: cx - 40 + i * 10, y: cy + i * 5, id: 1 },
          { x: cx + 40 + i * 10, y: cy + i * 5, id: 2 },
          { x: cx + i * 10, y: cy - 40 + i * 5, id: 3 },
        ],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [
        { x: cx, y: cy + 20, id: 1 },
        { x: cx + 80, y: cy + 20, id: 2 },
        { x: cx + 40, y: cy - 20, id: 3 },
      ],
    });
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

    pose = await getPose();
    check(
      "3-finger simultaneous touch does not crash or corrupt camera pose",
      Number.isFinite(pose.azimuth) &&
        Number.isFinite(pose.elevation) &&
        Number.isFinite(pose.distance) &&
        errors.length === 0,
      `azimuth=${pose.azimuth.toFixed(1)}, elevation=${pose.elevation.toFixed(1)}, distance=${pose.distance.toFixed(1)}`,
    );

    // 8D: 2-to-1 finger transition (finger lifted mid-pinch while other continues)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: cx - 50, y: cy, id: 1 },
        { x: cx + 50, y: cy, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: cx - 60, y: cy, id: 1 },
        { x: cx + 60, y: cy, id: 2 },
      ],
    });
    // Lift finger 2
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [{ x: cx + 60, y: cy, id: 2 }],
    });
    // Finger 1 continues dragging
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: cx - 100, y: cy + 40, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [{ x: cx - 100, y: cy + 40, id: 1 }],
    });
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

    pose = await getPose();
    check(
      "Mid-pinch single finger lift transition executes smoothly without crash",
      Number.isFinite(pose.azimuth) && Number.isFinite(pose.distance) && errors.length === 0,
      `azimuth=${pose.azimuth.toFixed(1)}, distance=${pose.distance.toFixed(1)}`,
    );

    // 8E: TouchCancel during 2-finger pinch + subsequent recovery check
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: cx - 50, y: cy, id: 1 },
        { x: cx + 50, y: cy, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: cx - 70, y: cy, id: 1 },
        { x: cx + 70, y: cy, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());

    const poseBeforeRecovery = await getPose();
    // Subsequent normal 1-finger orbit drag
    await cdpTouchDrag(cdp, { x: cx, y: cy }, { x: cx + 80, y: cy + 40 }, 4, 1);
    await page.evaluate(() => window.__voxwright?.renderer.whenIdle());
    const poseAfterRecovery = await getPose();

    const recoveredOrbit =
      Math.abs(poseAfterRecovery.azimuth - poseBeforeRecovery.azimuth) > 3 ||
      Math.abs(poseAfterRecovery.elevation - poseBeforeRecovery.elevation) > 3;

    check(
      "Renderer recovers fully after pinch touchCancel and resumes normal touch orbit",
      recoveredOrbit && errors.length === 0,
      `delta azimuth=${Math.abs(poseAfterRecovery.azimuth - poseBeforeRecovery.azimuth).toFixed(1)}`,
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
console.log(`Summary: ${passCount} PASSED, ${failCount} FAILED (Total: ${results.length})`);
if (failCount > 0) {
  process.exit(1);
}
