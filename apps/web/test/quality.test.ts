// SPDX-License-Identifier: AGPL-3.0-only

// The Quality setting and dynamic resolution (MB7): the stored value, the pixel ratio each mode asks
// for, the renderer options, the touch-only limits, and the timing of the ratio dropping while a
// gesture moves the view and coming back after it stops (with injected timers, no real waiting).

import { DEFAULT_HISTORY_BYTES } from "@voxwright/core";
import { describe, expect, it } from "vitest";
import {
  antialiasChangesOnReload,
  DEFAULT_QUALITY,
  DynamicResolution,
  idlePixelRatio,
  MAX_PIXEL_RATIO,
  MOVING_PIXEL_RATIO,
  parseQuality,
  pixelRatioFor,
  QUALITY_KEY,
  QUALITY_MODES,
  type QualityMode,
  rendererOptionsFor,
  SETTLE_MS,
  TOUCH_HISTORY_BYTES,
  TOUCH_MAX_WORKERS,
  touchWorkerCount,
} from "../src/lib/quality.ts";

describe("parseQuality (the setting kept from an earlier visit)", () => {
  it("is kept under voxwright.quality and starts as Auto", () => {
    expect(QUALITY_KEY).toBe("voxwright.quality");
    expect(DEFAULT_QUALITY).toBe("auto");
    expect(QUALITY_MODES).toEqual(["auto", "high", "low"]);
  });

  it("reads the three words exactly", () => {
    expect(parseQuality("auto")).toBe("auto");
    expect(parseQuality("high")).toBe("high");
    expect(parseQuality("low")).toBe("low");
  });

  it("anything else, or nothing, is Auto", () => {
    for (const stored of [
      null,
      undefined,
      "",
      "Auto",
      "HIGH",
      "Low",
      " low",
      "medium",
      "1",
      "true",
    ]) {
      expect(parseQuality(stored), String(stored)).toBe("auto");
    }
  });
});

describe("the pixel ratio of each mode", () => {
  it("High and Auto draw with the device's ratio, at most 2", () => {
    for (const mode of ["high", "auto"] as const) {
      expect(idlePixelRatio(mode, 3), mode).toBe(2);
      expect(idlePixelRatio(mode, 2.625), mode).toBe(2);
      expect(idlePixelRatio(mode, 2), mode).toBe(2);
      expect(idlePixelRatio(mode, 1.5), mode).toBe(1.5);
      expect(idlePixelRatio(mode, 1), mode).toBe(1);
    }
    expect(MAX_PIXEL_RATIO).toBe(2);
  });

  it("Low always draws with 1", () => {
    for (const dpr of [1, 1.5, 2, 3, 4]) expect(idlePixelRatio("low", dpr)).toBe(1);
  });

  it("a ratio that is not a usable number counts as 1", () => {
    for (const bad of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(idlePixelRatio("high", bad), String(bad)).toBe(1);
    }
  });

  it("only Auto drops while the view moves", () => {
    expect(pixelRatioFor("auto", 3, false)).toBe(2);
    expect(pixelRatioFor("auto", 3, true)).toBe(MOVING_PIXEL_RATIO);
    expect(pixelRatioFor("high", 3, true)).toBe(2);
    expect(pixelRatioFor("low", 3, true)).toBe(1);
    expect(pixelRatioFor("low", 3, false)).toBe(1);
  });

  it("a device at ratio 1 has nothing to drop", () => {
    expect(pixelRatioFor("auto", 1, true)).toBe(1);
    expect(pixelRatioFor("auto", 1, false)).toBe(1);
  });
});

describe("what a mode changes when the renderer is created", () => {
  it("Low: ratio 1 and antialiasing off", () => {
    expect(rendererOptionsFor("low", 3)).toEqual({ antialias: false, pixelRatio: 1 });
  });

  it("High and Auto: the device's ratio, and antialiasing left at the renderer's default", () => {
    expect(rendererOptionsFor("high", 3)).toEqual({ pixelRatio: 2 });
    expect(rendererOptionsFor("auto", 1.5)).toEqual({ pixelRatio: 1.5 });
    expect("antialias" in rendererOptionsFor("high", 3)).toBe(false);
    expect("antialias" in rendererOptionsFor("auto", 3)).toBe(false);
  });

  it("antialiasing waits for a reload only for a change to or from Low", () => {
    const modes: QualityMode[] = ["auto", "high", "low"];
    for (const created of modes) {
      for (const chosen of modes) {
        const expected = (created === "low") !== (chosen === "low");
        expect(antialiasChangesOnReload(created, chosen), `${created} -> ${chosen}`).toBe(expected);
      }
    }
    expect(antialiasChangesOnReload("auto", "high")).toBe(false);
  });
});

describe("limits of a touch-only device", () => {
  it("at most two mesher workers, never fewer than one", () => {
    expect(TOUCH_MAX_WORKERS).toBe(2);
    expect(touchWorkerCount(4)).toBe(2);
    expect(touchWorkerCount(3)).toBe(2);
    expect(touchWorkerCount(2)).toBe(2);
    expect(touchWorkerCount(1)).toBe(1);
    expect(touchWorkerCount(0)).toBe(1);
  });

  it("an undo history of 16 MB instead of core's 64 MB", () => {
    expect(TOUCH_HISTORY_BYTES).toBe(16 * 1024 * 1024);
    expect(DEFAULT_HISTORY_BYTES).toBe(64 * 1024 * 1024);
    expect(TOUCH_HISTORY_BYTES).toBeLessThan(DEFAULT_HISTORY_BYTES);
  });
});

describe("DynamicResolution", () => {
  /** A manual clock: timers run when the test says time has passed. */
  function setup(options: { mode?: QualityMode; dpr?: number } = {}) {
    let now = 0;
    let dpr = options.dpr ?? 3;
    const applied: number[] = [];
    const timers = new Map<number, { at: number; fn: () => void }>();
    let nextId = 1;
    const dyn = new DynamicResolution({
      apply: (r) => applied.push(r),
      dpr: () => dpr,
      mode: options.mode ?? "auto",
      setTimeout: (fn, ms) => {
        const id = nextId++;
        timers.set(id, { at: now + ms, fn });
        return id as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout: (h) => {
        timers.delete(h as unknown as number);
      },
    });
    const advance = (ms: number): void => {
      const to = now + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= to)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (due === undefined) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = to;
    };
    return { dyn, applied, advance, timers, setDpr: (v: number) => (dpr = v) };
  }

  it("settles after 200 ms, the number the plan asks for", () => {
    expect(SETTLE_MS).toBe(200);
  });

  it("the first refresh applies the idle ratio once", () => {
    const { dyn, applied } = setup();
    dyn.refresh();
    expect(applied).toEqual([2]);
    dyn.refresh();
    expect(applied).toEqual([2]); // the same ratio is not applied again
  });

  it("Auto: the first movement drops to 1 at once; the ratio is back 200 ms after the last one", () => {
    const { dyn, applied, advance } = setup();
    dyn.refresh();
    dyn.moving();
    expect(applied).toEqual([2, 1]);
    expect(dyn.isReduced).toBe(true);
    advance(199);
    expect(applied).toEqual([2, 1]);
    advance(1);
    expect(applied).toEqual([2, 1, 2]);
    expect(dyn.isReduced).toBe(false);
  });

  it("a gesture of many movements is one resize down and one resize up", () => {
    const { dyn, applied, advance } = setup();
    dyn.refresh();
    for (let i = 0; i < 40; i++) {
      dyn.moving();
      if (i < 39) advance(16); // a frame, until the last movement
    }
    expect(applied).toEqual([2, 1]);
    advance(199);
    expect(applied).toEqual([2, 1]);
    advance(1);
    expect(applied).toEqual([2, 1, 2]);
  });

  it("every movement pushes the return back to 200 ms after the last one", () => {
    const { dyn, applied, advance } = setup();
    dyn.refresh();
    dyn.moving();
    advance(150);
    dyn.moving();
    advance(150); // 300 ms since the first, 150 since the last
    expect(applied).toEqual([2, 1]);
    advance(49);
    expect(applied).toEqual([2, 1]);
    advance(1);
    expect(applied).toEqual([2, 1, 2]);
  });

  it("a movement after it settled is a new gesture: one more drop and one more return", () => {
    const { dyn, applied, advance } = setup();
    dyn.refresh();
    dyn.moving();
    advance(200);
    dyn.moving();
    expect(applied).toEqual([2, 1, 2, 1]);
    advance(200);
    expect(applied).toEqual([2, 1, 2, 1, 2]);
  });

  it("a device at ratio 1 never resizes", () => {
    const { dyn, applied, advance } = setup({ dpr: 1 });
    dyn.refresh();
    dyn.moving();
    advance(500);
    dyn.moving();
    advance(500);
    expect(applied).toEqual([1]);
  });

  it("High keeps the idle ratio whatever moves, and has no timer", () => {
    const { dyn, applied, advance, timers } = setup({ mode: "high" });
    dyn.refresh();
    for (let i = 0; i < 10; i++) dyn.moving();
    advance(1000);
    expect(applied).toEqual([2]);
    expect(timers.size).toBe(0);
    expect(dyn.isReduced).toBe(false);
  });

  it("Low stays at 1 whatever moves", () => {
    const { dyn, applied, advance } = setup({ mode: "low" });
    dyn.refresh();
    dyn.moving();
    advance(1000);
    expect(applied).toEqual([1]);
  });

  it("changing the mode applies the new ratio at once", () => {
    const { dyn, applied } = setup();
    dyn.refresh();
    dyn.setMode("low");
    expect(applied).toEqual([2, 1]);
    dyn.setMode("high");
    expect(applied).toEqual([2, 1, 2]);
    dyn.setMode("auto");
    expect(applied).toEqual([2, 1, 2]); // already 2
    expect(dyn.current).toBe("auto");
    expect(dyn.ratio).toBe(2);
  });

  it("changing the mode in the middle of a gesture drops the pending return", () => {
    const { dyn, applied, advance, timers } = setup();
    dyn.refresh();
    dyn.moving();
    expect(applied).toEqual([2, 1]);
    dyn.setMode("high"); // back to sharp at once, no stale timer left to fire later
    expect(applied).toEqual([2, 1, 2]);
    expect(timers.size).toBe(0);
    advance(1000);
    expect(applied).toEqual([2, 1, 2]);
    dyn.moving(); // High ignores movement
    expect(applied).toEqual([2, 1, 2]);
  });

  it("Auto after Low picks the gesture drop up again", () => {
    const { dyn, applied, advance } = setup({ mode: "low" });
    dyn.refresh();
    dyn.setMode("auto"); // 1 -> 2
    dyn.moving(); // 2 -> 1
    advance(200); // 1 -> 2
    expect(applied).toEqual([1, 2, 1, 2]);
  });

  it("reads the device's ratio when it works a ratio out (browser zoom changes it)", () => {
    const { dyn, applied, advance, setDpr } = setup({ dpr: 2 });
    dyn.refresh();
    setDpr(3);
    dyn.moving();
    advance(200);
    expect(applied).toEqual([2, 1, 2]); // 3 still gives 2
    setDpr(1.5);
    dyn.moving();
    advance(200);
    expect(applied).toEqual([2, 1, 2, 1, 1.5]);
  });

  it("dispose drops the timer, so nothing resizes after the page is gone", () => {
    const { dyn, applied, advance, timers } = setup();
    dyn.refresh();
    dyn.moving();
    dyn.dispose();
    expect(timers.size).toBe(0);
    advance(1000);
    expect(applied).toEqual([2, 1]);
  });
});
