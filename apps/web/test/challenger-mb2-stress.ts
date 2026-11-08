// SPDX-License-Identifier: AGPL-3.0-only

// Empirical Stress & Adversarial Test Harness for Milestone MB2
// Tests:
// 1. 2-finger pan along diagonal vectors (all quadrants, varied angles, round-trip, varied initial camera angles)
// 2. 2-finger asymmetric pinch zoom (asymmetric angles, stationary anchor finger, asymmetric velocities, multi-cycle)
// 3. Desktop mouse and keyboard controls invariance (left drag orbit, shift/right pan, wheel zoom, keyboard arrows)
// 4. Pure GestureArbiter mathematical stress (sub-pixel, zero-delta, degraded sequences)

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type CDPSession, type ElementHandle } from "puppeteer-core";
import { GestureArbiter } from "../src/lib/gestures.ts";
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

export const DESKTOP_VIEWPORT = {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  hasTouch: false,
  isMobile: false,
} as const;

const checks: string[] = [];
const failures: string[] = [];
export const ok = (cond: unknown, what: string): void => {
  if (!cond) {
    console.error(`  FAIL  ${what}`);
    failures.push(what);
  } else {
    checks.push(what);
    console.log(`  ok  ${what}`);
  }
};

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

function dist3d(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** General two-finger CDP dispatch: allows any arbitrary path for both fingers */
export async function cdpTwoFingerGeneral(
  cdp: CDPSession,
  p1Start: { x: number; y: number },
  p2Start: { x: number; y: number },
  p1End: { x: number; y: number },
  p2End: { x: number; y: number },
  steps = 10,
): Promise<void> {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: Math.round(p1Start.x), y: Math.round(p1Start.y), id: 1 },
      { x: Math.round(p2Start.x), y: Math.round(p2Start.y), id: 2 },
    ],
  });

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p1x = Math.round(p1Start.x + (p1End.x - p1Start.x) * t);
    const p1y = Math.round(p1Start.y + (p1End.y - p1Start.y) * t);
    const p2x = Math.round(p2Start.x + (p2End.x - p2Start.x) * t);
    const p2y = Math.round(p2Start.y + (p2End.y - p2Start.y) * t);

    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: p1x, y: p1y, id: 1 },
        { x: p2x, y: p2y, id: 2 },
      ],
    });
  }

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [
      { x: Math.round(p1End.x), y: Math.round(p1End.y), id: 1 },
      { x: Math.round(p2End.x), y: Math.round(p2End.y), id: 2 },
    ],
  });
}

/** Two-finger parallel translation pan */
export async function cdpTwoFingerVectorPan(
  cdp: CDPSession,
  startCenter: { x: number; y: number },
  delta: { dx: number; dy: number },
  fingerSpacing = 80,
  spacingAngleDeg = 0,
  steps = 8,
): Promise<void> {
  const rad = (spacingAngleDeg * Math.PI) / 180;
  const halfSpread = fingerSpacing / 2;
  const offX = Math.cos(rad) * halfSpread;
  const offY = Math.sin(rad) * halfSpread;

  const p1Start = { x: startCenter.x - offX, y: startCenter.y - offY };
  const p2Start = { x: startCenter.x + offX, y: startCenter.y + offY };
  const p1End = { x: p1Start.x + delta.dx, y: p1Start.y + delta.dy };
  const p2End = { x: p2Start.x + delta.dx, y: p2Start.y + delta.dy };

  await cdpTwoFingerGeneral(cdp, p1Start, p2Start, p1End, p2End, steps);
}

/** Two-finger pinch along arbitrary angle */
export async function cdpDiagonalPinch(
  cdp: CDPSession,
  center: { x: number; y: number },
  startSpread: number,
  endSpread: number,
  angleDeg = 45,
  steps = 10,
): Promise<void> {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const p1Start = { x: center.x - (startSpread / 2) * cos, y: center.y - (startSpread / 2) * sin };
  const p2Start = { x: center.x + (startSpread / 2) * cos, y: center.y + (startSpread / 2) * sin };
  const p1End = { x: center.x - (endSpread / 2) * cos, y: center.y - (endSpread / 2) * sin };
  const p2End = { x: center.x + (endSpread / 2) * cos, y: center.y + (endSpread / 2) * sin };

  await cdpTwoFingerGeneral(cdp, p1Start, p2Start, p1End, p2End, steps);
}

async function runChallengerStress(): Promise<void> {
  console.log("=== EMPIRICAL CHALLENGER STRESS SUITE (MB2) ===");
  const browser = await puppeteer.launch({
    executablePath: chromium,
    headless: true,
    args: chromiumArgs(true),
  });

  try {
    // =========================================================================
    // PART 1: DIAGONAL TWO-FINGER PAN STRESS
    // =========================================================================
    console.log("\n--- PART 1: Diagonal Two-Finger Pan Invariance & Stress ---");
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport(MOBILE_VIEWPORT);

    const errors: string[] = [];
    mobilePage.on("pageerror", (e) => errors.push(String(e)));
    mobilePage.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    const cdp = await mobilePage.createCDPSession();
    await mobilePage.goto(url);
    await mobilePage.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 30000 },
    );

    // Open fixture
    const input = (await mobilePage.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await input.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await mobilePage.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 60000 },
    );

    const settle = async (): Promise<void> => {
      await mobilePage.evaluate(() => window.__voxwright?.renderer.whenIdle());
    };
    const pose = (): Promise<TouchPose> =>
      mobilePage.evaluate(() =>
        (
          window.__voxwright as unknown as { renderer: { getPose(): TouchPose } }
        ).renderer.getPose(),
      );

    const getTarget = async (): Promise<[number, number, number]> => {
      const p = await pose();
      return computeTarget(p);
    };

    const canvasEl = await mobilePage.$('[data-testid="canvas"]');
    if (!canvasEl) throw new Error("canvas element not found");
    const box = await canvasEl.boundingBox();
    if (!box) throw new Error("canvas bounding box not found");
    const cx = Math.round(box.x + box.width / 2);
    const cy = Math.round(box.y + box.height / 2);

    await settle();

    // 1.1 Four-quadrant diagonal pan tests
    const diagonalVectors = [
      { name: "Q1 (+dx, +dy)", dx: 140, dy: 100 },
      { name: "Q2 (+dx, -dy)", dx: 130, dy: -110 },
      { name: "Q3 (-dx, +dy)", dx: -120, dy: 130 },
      { name: "Q4 (-dx, -dy)", dx: -150, dy: -120 },
      { name: "Pure 45° diagonal (+100, +100)", dx: 100, dy: 100 },
      { name: "Pure 135° diagonal (-100, +100)", dx: -100, dy: 100 },
      { name: "High aspect ratio diagonal (dx:200, dy:25)", dx: 200, dy: 25 },
      { name: "Steep aspect ratio diagonal (dx:25, dy:200)", dx: 25, dy: 200 },
    ];

    for (const vec of diagonalVectors) {
      const poseBefore = await pose();
      const targetBefore = computeTarget(poseBefore);

      await cdpTwoFingerVectorPan(cdp, { x: cx, y: cy }, { dx: vec.dx, dy: vec.dy });
      await settle();

      const poseAfter = await pose();
      const targetAfter = computeTarget(poseAfter);

      const azimuthDiff = Math.abs(poseAfter.azimuth - poseBefore.azimuth);
      const elevationDiff = Math.abs(poseAfter.elevation - poseBefore.elevation);
      const distDiff = Math.abs(poseAfter.distance - poseBefore.distance);
      const targetShift = dist3d(targetAfter, targetBefore);

      ok(
        azimuthDiff < 0.001,
        `[pan ${vec.name}] azimuth strictly invariant (diff: ${azimuthDiff.toFixed(5)}°)`,
      );
      ok(
        elevationDiff < 0.001,
        `[pan ${vec.name}] elevation strictly invariant (diff: ${elevationDiff.toFixed(5)}°)`,
      );
      ok(
        distDiff < 0.001,
        `[pan ${vec.name}] distance strictly invariant (diff: ${distDiff.toFixed(5)})`,
      );
      ok(
        targetShift > 0.5,
        `[pan ${vec.name}] target translated in 3D (shifted: ${targetShift.toFixed(3)} blocks)`,
      );
    }

    // 1.2 Round-trip diagonal pan (forward and back)
    await mobilePage.evaluate(() => {
      (window as any).__panLog = [];
      const r = (window as any).__voxwright.renderer;
      const origPan = r.panBy.bind(r);
      const origOrbit = r.orbitBy.bind(r);
      r.panBy = (dx: number, dy: number) => {
        origPan(dx, dy);
        (window as any).__panLog.push({ type: "pan", dx, dy, target: [...r.orbit.target] });
      };
      r.orbitBy = (dx: number, dy: number) => {
        origOrbit(dx, dy);
        (window as any).__panLog.push({ type: "orbit", dx, dy, target: [...r.orbit.target] });
      };
    });

    const baselineTarget = await getTarget();
    const baselinePose = await pose();
    console.log(`    [diag pan] baselinePose:`, baselinePose);
    const baselineOrbitTarget = await mobilePage.evaluate(() => [
      ...(window as any).__voxwright.renderer.orbit.target,
    ]);
    console.log(
      `    [diag pan] baselineOrbitTarget:`,
      baselineOrbitTarget,
      `computeTarget:`,
      baselineTarget,
    );

    await cdpTwoFingerVectorPan(cdp, { x: cx, y: cy }, { dx: 150, dy: -130 });
    await settle();
    const midTarget = await getTarget();
    const midPose = await pose();
    const midOrbitTarget = await mobilePage.evaluate(() => [
      ...(window as any).__voxwright.renderer.orbit.target,
    ]);
    console.log(`    [diag pan] midOrbitTarget:`, midOrbitTarget, `computeTarget:`, midTarget);

    const fwdLog = await mobilePage.evaluate(() => {
      const log = (window as any).__panLog;
      (window as any).__panLog = [];
      return log;
    });
    console.log(`    [diag pan fwd] items:`, JSON.stringify(fwdLog));
    const fwdPanSum = fwdLog
      .filter((e: any) => e.type === "pan")
      .reduce((acc: any, e: any) => ({ dx: acc.dx + e.dx, dy: acc.dy + e.dy }), { dx: 0, dy: 0 });
    const fwdOrbitCount = fwdLog.filter((e: any) => e.type === "orbit").length;
    console.log(`    [diag pan fwd] panSum:`, fwdPanSum, `orbitCount:`, fwdOrbitCount);

    ok(dist3d(midTarget, baselineTarget) > 2.0, "diagonal pan forward shifted target > 2 blocks");

    await cdpTwoFingerVectorPan(cdp, { x: cx, y: cy }, { dx: -150, dy: 130 });
    await settle();
    const returnedTarget = await getTarget();
    const returnedPose = await pose();
    const returnedOrbitTarget = await mobilePage.evaluate(() => [
      ...(window as any).__voxwright.renderer.orbit.target,
    ]);
    console.log(
      `    [diag pan] returnedOrbitTarget:`,
      returnedOrbitTarget,
      `computeTarget:`,
      returnedTarget,
    );

    const retLog = await mobilePage.evaluate(() => (window as any).__panLog);
    console.log(`    [diag pan ret] items:`, JSON.stringify(retLog));
    const retPanSum = retLog
      .filter((e: any) => e.type === "pan")
      .reduce((acc: any, e: any) => ({ dx: acc.dx + e.dx, dy: acc.dy + e.dy }), { dx: 0, dy: 0 });
    const retOrbitCount = retLog.filter((e: any) => e.type === "orbit").length;
    console.log(`    [diag pan ret] panSum:`, retPanSum, `orbitCount:`, retOrbitCount);

    const roundTripTargetDrift = dist3d(returnedTarget, baselineTarget);
    const roundTripAzimuthDrift = Math.abs(returnedPose.azimuth - baselinePose.azimuth);
    const roundTripElevationDrift = Math.abs(returnedPose.elevation - baselinePose.elevation);
    const roundTripDistDrift = Math.abs(returnedPose.distance - baselinePose.distance);
    console.log(
      `    [diag pan] drift: target=${roundTripTargetDrift}, az=${roundTripAzimuthDrift}, el=${roundTripElevationDrift}, dist=${roundTripDistDrift}`,
    );

    ok(
      roundTripTargetDrift < 0.01,
      `round-trip diagonal pan restores target to within <0.01 blocks (drift: ${roundTripTargetDrift.toFixed(5)})`,
    );
    ok(
      roundTripAzimuthDrift < 0.001,
      `round-trip diagonal pan preserves azimuth (drift: ${roundTripAzimuthDrift.toFixed(5)}°)`,
    );
    ok(
      roundTripElevationDrift < 0.001,
      `round-trip diagonal pan preserves elevation (drift: ${roundTripElevationDrift.toFixed(5)}°)`,
    );
    ok(
      roundTripDistDrift < 0.001,
      `round-trip diagonal pan preserves distance (drift: ${roundTripDistDrift.toFixed(5)})`,
    );

    // 1.3 Diagonal pan with diagonally arranged fingers
    const poseDiagFingersBefore = await pose();
    const targetDiagFingersBefore = computeTarget(poseDiagFingersBefore);
    await cdpTwoFingerVectorPan(
      cdp,
      { x: cx, y: cy },
      { dx: 100, dy: 80 },
      100, // spacing
      45, // diagonal finger orientation
    );
    await settle();
    const poseDiagFingersAfter = await pose();
    const targetDiagFingersAfter = computeTarget(poseDiagFingersAfter);

    ok(
      Math.abs(poseDiagFingersAfter.azimuth - poseDiagFingersBefore.azimuth) < 0.001,
      "diagonal-finger pan preserves azimuth",
    );
    ok(
      Math.abs(poseDiagFingersAfter.elevation - poseDiagFingersBefore.elevation) < 0.001,
      "diagonal-finger pan preserves elevation",
    );
    ok(
      Math.abs(poseDiagFingersAfter.distance - poseDiagFingersBefore.distance) < 0.001,
      "diagonal-finger pan preserves distance",
    );
    ok(
      dist3d(targetDiagFingersAfter, targetDiagFingersBefore) > 1.0,
      "diagonal-finger pan translates target",
    );

    // =========================================================================
    // PART 2: ASYMMETRIC TWO-FINGER PINCH ZOOM STRESS
    // =========================================================================
    console.log("\n--- PART 2: Asymmetric Two-Finger Pinch Zoom Stress ---");

    // 2.1 Diagonal Asymmetric-Angle Pinch (30°, 45°, 60°, 120°) with stationary midpoint
    const pinchAngles = [30, 45, 60, 120, 135];
    for (const angle of pinchAngles) {
      const p0 = await pose();
      const t0 = computeTarget(p0);

      // Pinch out (fingers move apart: 100 -> 180, factor 100/180 ~0.555 -> zoom in)
      await cdpDiagonalPinch(cdp, { x: cx, y: cy }, 100, 180, angle);
      await settle();
      const p1 = await pose();
      const t1 = computeTarget(p1);

      const expectedFactor = 100 / 180;
      const actualFactor = p1.distance / p0.distance;
      const factorError = Math.abs(actualFactor - expectedFactor);

      ok(
        factorError < 0.05,
        `[pinch ${angle}°] distance scaled by expected factor ${expectedFactor.toFixed(3)} (actual: ${actualFactor.toFixed(3)})`,
      );
      ok(
        Math.abs(p1.azimuth - p0.azimuth) < 0.001,
        `[pinch ${angle}°] zero azimuth drift (${Math.abs(p1.azimuth - p0.azimuth).toFixed(5)}°)`,
      );
      ok(
        Math.abs(p1.elevation - p0.elevation) < 0.001,
        `[pinch ${angle}°] zero elevation drift (${Math.abs(p1.elevation - p0.elevation).toFixed(5)}°)`,
      );
      const targetDrift = dist3d(t1, t0);
      ok(
        targetDrift < 0.01,
        `[pinch ${angle}°] zero target drift (${targetDrift.toFixed(5)} blocks)`,
      );

      // Reverse pinch in (fingers move closer: 180 -> 100, factor 180/100 = 1.8 -> zoom out)
      await cdpDiagonalPinch(cdp, { x: cx, y: cy }, 180, 100, angle);
      await settle();
      const p2 = await pose();
      const t2 = computeTarget(p2);

      ok(
        Math.abs(p2.distance - p0.distance) / p0.distance < 0.02,
        `[pinch ${angle}° reverse] distance returned to baseline (${p2.distance.toFixed(2)} vs ${p0.distance.toFixed(2)})`,
      );
      ok(
        dist3d(t2, t0) < 0.01,
        `[pinch ${angle}° reverse] target returned to baseline (drift: ${dist3d(t2, t0).toFixed(5)})`,
      );
    }

    // 2.2 Stationary Anchor Pinch (Thumb stationary at (cx - 50, cy), Index moves)
    // When one finger is stationary and the other moves:
    // P1: (cx - 50, cy) -> stationary
    // P2: (cx + 50, cy) -> (cx + 170, cy)
    // Initial spread: 100, initial center: (cx, cy)
    // Final spread: 220, final center: (cx + 60, cy)
    // Expected behavior:
    // - Distance scales by ~100 / 220 (~0.455)
    // - NO rotational drift (azimuth & elevation strictly invariant)
    // - Pan delta is center movement (+60, 0)
    const anchorP0 = await pose();
    const anchorT0 = computeTarget(anchorP0);

    const anchorP1Start = { x: cx - 50, y: cy };
    const anchorP2Start = { x: cx + 50, y: cy };
    const anchorP1End = { x: cx - 50, y: cy }; // stationary!
    const anchorP2End = { x: cx + 170, y: cy }; // moved by 120px!

    await cdpTwoFingerGeneral(cdp, anchorP1Start, anchorP2Start, anchorP1End, anchorP2End, 10);
    await settle();

    const anchorP1 = await pose();
    const anchorT1 = computeTarget(anchorP1);

    ok(
      anchorP1.distance < anchorP0.distance * 0.6,
      `anchor pinch scaled distance down (${anchorP0.distance.toFixed(2)} -> ${anchorP1.distance.toFixed(2)})`,
    );
    ok(
      Math.abs(anchorP1.azimuth - anchorP0.azimuth) < 0.001,
      `anchor pinch produced zero azimuth drift (${Math.abs(anchorP1.azimuth - anchorP0.azimuth).toFixed(5)}°)`,
    );
    ok(
      Math.abs(anchorP1.elevation - anchorP0.elevation) < 0.001,
      `anchor pinch produced zero elevation drift (${Math.abs(anchorP1.elevation - anchorP0.elevation).toFixed(5)}°)`,
    );

    // Now reverse the anchor pinch: Finger 2 moves back to (cx + 50, cy) while Finger 1 stays stationary!
    await cdpTwoFingerGeneral(cdp, anchorP1End, anchorP2End, anchorP1Start, anchorP2Start, 10);
    await settle();

    const anchorP2 = await pose();
    const anchorT2 = computeTarget(anchorP2);

    ok(
      Math.abs(anchorP2.distance - anchorP0.distance) / anchorP0.distance < 0.02,
      `reverse anchor pinch restored initial distance (${anchorP2.distance.toFixed(2)} vs ${anchorP0.distance.toFixed(2)})`,
    );
    ok(
      Math.abs(anchorP2.azimuth - anchorP0.azimuth) < 0.001,
      "reverse anchor pinch preserved azimuth",
    );
    ok(
      Math.abs(anchorP2.elevation - anchorP0.elevation) < 0.001,
      "reverse anchor pinch preserved elevation",
    );
    const anchorRoundTripDrift = dist3d(anchorT2, anchorT0);
    ok(
      anchorRoundTripDrift < 0.015,
      `reverse anchor pinch restored target with negligible drift (drift: ${anchorRoundTripDrift.toFixed(5)} blocks)`,
    );

    // 2.3 Asymmetric Velocity Pinch (Fingers moving along different diagonal vectors at different speeds)
    // P1 moves by (-30, -20); P2 moves by (+90, +60).
    const asymP0 = await pose();
    const asymT0 = computeTarget(asymP0);

    const asymP1Start = { x: cx - 40, y: cy - 30 };
    const asymP2Start = { x: cx + 40, y: cy + 30 };
    const asymP1End = { x: cx - 70, y: cy - 50 }; // moved (-30, -20)
    const asymP2End = { x: cx + 130, y: cy + 90 }; // moved (+90, +60)

    await cdpTwoFingerGeneral(cdp, asymP1Start, asymP2Start, asymP1End, asymP2End, 10);
    await settle();

    const asymP1 = await pose();
    const asymT1 = computeTarget(asymP1);

    ok(
      asymP1.distance < asymP0.distance,
      `asymmetric velocity pinch scaled distance down (${asymP0.distance.toFixed(2)} -> ${asymP1.distance.toFixed(2)})`,
    );
    ok(
      Math.abs(asymP1.azimuth - asymP0.azimuth) < 0.001,
      `asymmetric velocity pinch produced zero azimuth drift (${Math.abs(asymP1.azimuth - asymP0.azimuth).toFixed(5)}°)`,
    );
    ok(
      Math.abs(asymP1.elevation - asymP0.elevation) < 0.001,
      `asymmetric velocity pinch produced zero elevation drift (${Math.abs(asymP1.elevation - asymP0.elevation).toFixed(5)}°)`,
    );

    // Reverse asymmetric velocity pinch
    await cdpTwoFingerGeneral(cdp, asymP1End, asymP2End, asymP1Start, asymP2Start, 10);
    await settle();

    const asymP2 = await pose();
    const asymT2 = computeTarget(asymP2);

    ok(
      Math.abs(asymP2.distance - asymP0.distance) / asymP0.distance < 0.02,
      "round-trip asymmetric velocity pinch restored distance",
    );
    ok(
      dist3d(asymT2, asymT0) < 0.015,
      `round-trip asymmetric velocity pinch restored target (drift: ${dist3d(asymT2, asymT0).toFixed(5)} blocks)`,
    );

    // 2.4 Multi-cycle Rapid Pinch Stress (10 rapid cycles)
    const multiP0 = await pose();
    const multiT0 = computeTarget(multiP0);

    for (let cycle = 1; cycle <= 10; cycle++) {
      // Zoom out: spread 160 -> 90
      await cdpDiagonalPinch(cdp, { x: cx, y: cy }, 160, 90, 45, 6);
      // Zoom back in: spread 90 -> 160
      await cdpDiagonalPinch(cdp, { x: cx, y: cy }, 90, 160, 45, 6);
    }
    await settle();

    const multiP1 = await pose();
    const multiT1 = computeTarget(multiP1);

    const multiAzimuthDrift = Math.abs(multiP1.azimuth - multiP0.azimuth);
    const multiElevationDrift = Math.abs(multiP1.elevation - multiP0.elevation);
    const multiDistDrift = Math.abs(multiP1.distance - multiP0.distance) / multiP0.distance;
    const multiTargetDrift = dist3d(multiT1, multiT0);

    ok(
      multiAzimuthDrift < 0.001,
      `10-cycle rapid pinch produced zero cumulative azimuth drift (${multiAzimuthDrift.toFixed(5)}°)`,
    );
    ok(
      multiElevationDrift < 0.001,
      `10-cycle rapid pinch produced zero cumulative elevation drift (${multiElevationDrift.toFixed(5)}°)`,
    );
    ok(
      multiDistDrift < 0.03,
      `10-cycle rapid pinch preserved distance within 3% (${(multiDistDrift * 100).toFixed(2)}%)`,
    );
    ok(
      multiTargetDrift < 0.02,
      `10-cycle rapid pinch produced negligible target drift (${multiTargetDrift.toFixed(5)} blocks)`,
    );

    await mobilePage.close();

    // =========================================================================
    // PART 3: DESKTOP MOUSE AND KEYBOARD INVARIANCE
    // =========================================================================
    console.log("\n--- PART 3: Desktop Mouse & Keyboard Controls Invariance ---");
    const desktopPage = await browser.newPage();
    await desktopPage.setViewport(DESKTOP_VIEWPORT);

    desktopPage.on("pageerror", (e) => errors.push(String(e)));
    desktopPage.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await desktopPage.goto(url);
    await desktopPage.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 30000 },
    );

    // Verify desktop pointer media query & input mode
    const desktopEnv = await desktopPage.evaluate(() => {
      const coarse = window.matchMedia("(any-pointer: coarse)").matches;
      const fine = window.matchMedia("(any-pointer: fine)").matches;
      const r = (window.__voxwright as any)?.renderer;
      return {
        coarse,
        fine,
        inputOption: r?.options?.input,
      };
    });

    ok(!desktopEnv.coarse, "desktop environment reports coarse: false");
    ok(desktopEnv.inputOption === "builtin", "renderer input option is 'builtin' on desktop");

    // Open fixture
    const deskInput = (await desktopPage.$(
      '[data-testid="file"]',
    )) as ElementHandle<HTMLInputElement>;
    await deskInput.uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await desktopPage.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 60000 },
    );

    const deskSettle = async (): Promise<void> => {
      await desktopPage.evaluate(() => window.__voxwright?.renderer.whenIdle());
    };
    const deskPose = (): Promise<TouchPose> =>
      desktopPage.evaluate(() =>
        (
          window.__voxwright as unknown as { renderer: { getPose(): TouchPose } }
        ).renderer.getPose(),
      );

    const deskCanvas = await desktopPage.$('[data-testid="canvas"]');
    if (!deskCanvas) throw new Error("canvas not found");
    const dBox = await deskCanvas.boundingBox();
    if (!dBox) throw new Error("desk canvas bounding box not found");
    const dcx = Math.round(dBox.x + dBox.width / 2);
    const dcy = Math.round(dBox.y + dBox.height / 2);

    await deskSettle();

    // 3.1 Desktop Left Click Drag -> Orbit
    const dPose0 = await deskPose();
    const dTarget0 = computeTarget(dPose0);

    await desktopPage.mouse.move(dcx, dcy);
    await desktopPage.mouse.down({ button: "left" });
    await desktopPage.mouse.move(dcx + 100, dcy + 50, { steps: 5 });
    await desktopPage.mouse.up({ button: "left" });
    await deskSettle();

    const dPose1 = await deskPose();
    const dTarget1 = computeTarget(dPose1);

    const dAzimuthShift = Math.abs(dPose1.azimuth - dPose0.azimuth);
    const dElevationShift = Math.abs(dPose1.elevation - dPose0.elevation);
    const dDistDiff = Math.abs(dPose1.distance - dPose0.distance);
    const dTargetDrift = dist3d(dTarget1, dTarget0);

    ok(
      dAzimuthShift > 10,
      `desktop left-click drag orbits azimuth (shifted: ${dAzimuthShift.toFixed(1)}°)`,
    );
    ok(
      dElevationShift > 10,
      `desktop left-click drag orbits elevation (shifted: ${dElevationShift.toFixed(1)}°)`,
    );
    ok(
      dDistDiff < 0.001,
      `desktop left-click drag preserves distance exactly (diff: ${dDistDiff.toFixed(5)})`,
    );
    ok(
      dTargetDrift < 0.01,
      `desktop left-click drag preserves orbit target (drift: ${dTargetDrift.toFixed(5)} blocks)`,
    );

    // 3.2 Desktop Shift + Left Click Drag -> Pan
    const dPosePan0 = await deskPose();
    const dTargetPan0 = computeTarget(dPosePan0);

    await desktopPage.keyboard.down("Shift");
    await desktopPage.mouse.move(dcx, dcy);
    await desktopPage.mouse.down({ button: "left" });
    await desktopPage.mouse.move(dcx + 80, dcy - 60, { steps: 5 });
    await desktopPage.mouse.up({ button: "left" });
    await desktopPage.keyboard.up("Shift");
    await deskSettle();

    const dPosePan1 = await deskPose();
    const dTargetPan1 = computeTarget(dPosePan1);

    ok(
      Math.abs(dPosePan1.azimuth - dPosePan0.azimuth) < 0.001,
      "desktop Shift+drag pan preserves azimuth",
    );
    ok(
      Math.abs(dPosePan1.elevation - dPosePan0.elevation) < 0.001,
      "desktop Shift+drag pan preserves elevation",
    );
    ok(
      Math.abs(dPosePan1.distance - dPosePan0.distance) < 0.001,
      "desktop Shift+drag pan preserves distance",
    );
    const dPanShift = dist3d(dTargetPan1, dTargetPan0);
    ok(
      dPanShift > 1.0,
      `desktop Shift+drag translates target in 3D (moved: ${dPanShift.toFixed(3)} blocks)`,
    );

    // 3.3 Desktop Right Click Drag -> Pan
    const dPoseRight0 = await deskPose();
    const dTargetRight0 = computeTarget(dPoseRight0);

    await desktopPage.mouse.move(dcx, dcy);
    await desktopPage.mouse.down({ button: "right" });
    await desktopPage.mouse.move(dcx - 70, dcy + 50, { steps: 5 });
    await desktopPage.mouse.up({ button: "right" });
    await deskSettle();

    const dPoseRight1 = await deskPose();
    const dTargetRight1 = computeTarget(dPoseRight1);

    ok(
      Math.abs(dPoseRight1.azimuth - dPoseRight0.azimuth) < 0.001,
      "desktop right-click drag pan preserves azimuth",
    );
    ok(
      Math.abs(dPoseRight1.elevation - dPoseRight0.elevation) < 0.001,
      "desktop right-click drag pan preserves elevation",
    );
    ok(
      Math.abs(dPoseRight1.distance - dPoseRight0.distance) < 0.001,
      "desktop right-click drag pan preserves distance",
    );
    const dRightPanShift = dist3d(dTargetRight1, dTargetRight0);
    ok(
      dRightPanShift > 1.0,
      `desktop right-click translates target in 3D (moved: ${dRightPanShift.toFixed(3)} blocks)`,
    );

    // 3.4 Desktop Mouse Wheel -> Zoom
    const dPoseWheel0 = await deskPose();
    const dTargetWheel0 = computeTarget(dPoseWheel0);

    // Zoom out with wheel
    await desktopPage.mouse.move(dcx, dcy);
    await desktopPage.mouse.wheel({ deltaY: 200 });
    await deskSettle();

    const dPoseWheel1 = await deskPose();
    const dTargetWheel1 = computeTarget(dPoseWheel1);

    ok(
      dPoseWheel1.distance > dPoseWheel0.distance,
      `desktop mouse wheel zooms out (${dPoseWheel0.distance.toFixed(1)} -> ${dPoseWheel1.distance.toFixed(1)})`,
    );
    ok(
      Math.abs(dPoseWheel1.azimuth - dPoseWheel0.azimuth) < 0.001,
      "desktop mouse wheel preserves azimuth",
    );
    ok(
      Math.abs(dPoseWheel1.elevation - dPoseWheel0.elevation) < 0.001,
      "desktop mouse wheel preserves elevation",
    );
    const dWheelTargetDrift = dist3d(dTargetWheel1, dTargetWheel0);
    ok(
      dWheelTargetDrift < 0.01,
      `desktop mouse wheel preserves target (drift: ${dWheelTargetDrift.toFixed(5)} blocks)`,
    );

    // 3.5 Keyboard Arrow Navigation
    await deskCanvas.focus();
    const dPoseKey0 = await deskPose();
    await desktopPage.keyboard.press("ArrowLeft");
    await desktopPage.keyboard.press("ArrowUp");
    await deskSettle();

    const dPoseKey1 = await deskPose();
    ok(
      dPoseKey1.azimuth !== dPoseKey0.azimuth || dPoseKey1.elevation !== dPoseKey0.elevation,
      "desktop arrow keys turn camera view",
    );

    await desktopPage.close();

    // =========================================================================
    // PART 4: PURE GESTURE ARBITER MATHEMATICAL STRESS
    // =========================================================================
    console.log("\n--- PART 4: Pure GestureArbiter Mathematical Stress ---");

    // 4.1 Sub-pixel and zero delta moves
    const arbiter = new GestureArbiter();
    const intents: any[] = [];
    arbiter["config"].onIntent = (i: any) => intents.push(i);

    arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
    arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });
    intents.length = 0;

    // Zero delta move
    arbiter.feed({ id: 1, type: "move", x: 100, y: 100, time: 20 });
    ok(intents.length === 0, "GestureArbiter ignores zero-delta move in two-finger state");

    // Sub-pixel move (< 0.1px pan, < 0.25px spread)
    arbiter.feed({ id: 1, type: "move", x: 100.04, y: 100.04, time: 30 });
    ok(
      intents.length === 0,
      "GestureArbiter filters sub-pixel jitter (<0.1px) in two-finger state",
    );

    // Legitimate diagonal pan move (+50, -30)
    arbiter.feed({ id: 1, type: "move", x: 150, y: 70, time: 40 });
    arbiter.feed({ id: 2, type: "move", x: 250, y: 70, time: 40 });
    const pans = intents.filter((i) => i.type === "twoFingerPan");
    const totalPan = pans.reduce((acc, i) => ({ dx: acc.dx + i.dx, dy: acc.dy + i.dy }), {
      dx: 0,
      dy: 0,
    });
    ok(pans.length > 0, "GestureArbiter emits twoFingerPan on diagonal movement");
    ok(
      Math.abs(totalPan.dx - 50) < 0.1 && Math.abs(totalPan.dy - -30) < 0.1,
      `GestureArbiter calculates exact cumulative diagonal delta: dx=${totalPan.dx}, dy=${totalPan.dy}`,
    );

    const spuriousPinchInPan = intents.filter((i) => i.type === "pinch");
    ok(
      spuriousPinchInPan.length === 0,
      `GestureArbiter must not emit spurious pinch during pure parallel pan (emitted ${spuriousPinchInPan.length} spurious pinch intents)`,
    );

    // 4.2 Degraded sequence: pointercancel while 2 fingers down
    intents.length = 0;
    arbiter.feed({ id: 1, type: "cancel", x: 150, y: 70, time: 50 });
    // A pointercancel is the system taking a finger away, not the user lifting one: the arbiter
    // still enters waiting_for_all_up and emits no single finger drag on pointer 2 move
    arbiter.feed({ id: 2, type: "move", x: 300, y: 300, time: 60 });
    ok(
      intents.every((i) => i.type !== "oneFingerDragStart" && i.type !== "oneFingerDragMove"),
      "GestureArbiter prevents accidental drag when remaining pointer moves after cancellation",
    );

    arbiter.feed({ id: 2, type: "up", x: 300, y: 300, time: 70 });
    ok(
      arbiter["state"] === "idle",
      "GestureArbiter cleanly resets to idle after all pointers lift",
    );

    // 4.3 One finger of a two-finger pan lifts: the other keeps turning the view from where it is
    intents.length = 0;
    arbiter.feed({ id: 3, type: "down", x: 100, y: 100, time: 1000 });
    arbiter.feed({ id: 4, type: "down", x: 200, y: 100, time: 1010 });
    arbiter.feed({ id: 3, type: "move", x: 150, y: 160, time: 1100 });
    arbiter.feed({ id: 4, type: "move", x: 250, y: 160, time: 1100 });
    arbiter.feed({ id: 3, type: "up", x: 150, y: 160, time: 1500 });
    intents.length = 0;
    arbiter.feed({ id: 4, type: "move", x: 253, y: 164, time: 1520 });
    const leftoverStart = intents.find((i) => i.type === "oneFingerDragStart");
    const leftoverMove = intents.find((i) => i.type === "oneFingerDragMove");
    ok(
      leftoverStart?.clientX === 250 && leftoverStart?.clientY === 160,
      "GestureArbiter starts the leftover finger's orbit at its position when the other finger lifted",
    );
    ok(
      leftoverMove?.dx === 3 && leftoverMove?.dy === 4,
      `GestureArbiter measures the leftover finger's first delta from that position, not from where it landed (dx=${leftoverMove?.dx}, dy=${leftoverMove?.dy})`,
    );
    arbiter.stepTime(10000);
    arbiter.feed({ id: 4, type: "up", x: 253, y: 164, time: 1540 });
    ok(
      intents.every((i) => i.type !== "tap" && i.type !== "longPress") &&
        intents.at(-1)?.type === "oneFingerDragEnd",
      "GestureArbiter ends the leftover finger's orbit on lift, with no tap and no long press",
    );
    intents.length = 0;
    arbiter.feed({ id: 5, type: "down", x: 60, y: 60, time: 2000 });
    arbiter.feed({ id: 5, type: "up", x: 60, y: 60, time: 2050 });
    ok(
      intents.length === 1 && intents[0]?.type === "tap",
      "GestureArbiter is ready for the next tap after the leftover finger lifts",
    );

    // Check no console errors
    ok(
      errors.length === 0,
      `no console errors logged during test execution (errors: ${errors.length})`,
    );

    console.log(`\n=======================================================`);
    console.log(`CHECKS PASSED: ${checks.length}`);
    console.log(`CHECKS FAILED: ${failures.length}`);
    if (failures.length > 0) {
      console.log(`FAILED ASSERTIONS:`);
      for (const f of failures) console.log(`  - ${f}`);
    }
    console.log(`=======================================================\n`);
    if (failures.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    server.close();
  }
}

await runChallengerStress();
