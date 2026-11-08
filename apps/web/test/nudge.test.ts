// SPDX-License-Identifier: AGPL-3.0-only

// The pure parts of the nudge pad and the face steppers: the screen-to-world axis mapping, the
// limits a move is held to, the box math of a face stepper and the hold-to-repeat timing.

import type { Box, Vec3 } from "@voxwright/core";
import { describe, expect, it } from "vitest";
import {
  type AxisStep,
  checkNudge,
  FACES,
  HoldRepeater,
  type NudgeLimits,
  padDirections,
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  stepFace,
} from "../src/lib/nudge.ts";

const box = (min: Vec3, max: Vec3): Box => ({ min, max });
/** The ground direction a step means, as (x, z). */
const dir = (s: AxisStep): [number, number] => (s.axis === 0 ? [s.step, 0] : [0, s.step]);

describe("padDirections", () => {
  // The renderer looks along (-sin az, cos az) on the ground; its right is (-cos az, -sin az).
  const cases: Array<[number, AxisStep, AxisStep]> = [
    // [azimuth, away, right]
    [0, { axis: 2, step: 1 }, { axis: 0, step: -1 }],
    [90, { axis: 0, step: -1 }, { axis: 2, step: -1 }],
    [180, { axis: 2, step: -1 }, { axis: 0, step: 1 }],
    [270, { axis: 0, step: 1 }, { axis: 2, step: 1 }],
    [30, { axis: 2, step: 1 }, { axis: 0, step: -1 }],
    [60, { axis: 0, step: -1 }, { axis: 2, step: -1 }],
    [120, { axis: 0, step: -1 }, { axis: 2, step: -1 }],
    [150, { axis: 2, step: -1 }, { axis: 0, step: 1 }],
    [210, { axis: 2, step: -1 }, { axis: 0, step: 1 }],
    [240, { axis: 0, step: 1 }, { axis: 2, step: 1 }],
    [300, { axis: 0, step: 1 }, { axis: 2, step: 1 }],
    [330, { axis: 2, step: 1 }, { axis: 0, step: -1 }],
  ];

  it.each(cases)("azimuth %d: away and right", (azimuth, away, right) => {
    const d = padDirections(azimuth);
    expect(d.away).toEqual(away);
    expect(d.right).toEqual(right);
    expect(d.toward).toEqual({ axis: away.axis, step: -away.step });
    expect(d.left).toEqual({ axis: right.axis, step: -right.step });
  });

  it("Up and Down are +y and -y whatever the view", () => {
    for (const az of [0, 45, 200, 359]) {
      const d = padDirections(az);
      expect(d.up).toEqual({ axis: 1, step: 1 });
      expect(d.down).toEqual({ axis: 1, step: -1 });
    }
  });

  it("at the four diagonals 'away' takes the z axis and 'right' the x axis, with the view's own signs", () => {
    expect(padDirections(45)).toMatchObject({
      away: { axis: 2, step: 1 },
      right: { axis: 0, step: -1 },
    });
    expect(padDirections(135)).toMatchObject({
      away: { axis: 2, step: -1 },
      right: { axis: 0, step: 1 },
    });
    expect(padDirections(225)).toMatchObject({
      away: { axis: 2, step: -1 },
      right: { axis: 0, step: 1 },
    });
    expect(padDirections(315)).toMatchObject({
      away: { axis: 2, step: 1 },
      right: { axis: 0, step: -1 },
    });
  });

  it("a hair either side of a diagonal picks by the larger projection, not by the tie rule", () => {
    // 44.9 degrees: forward is mostly +z. 45.1: forward is mostly -x.
    expect(padDirections(44.9).away).toEqual({ axis: 2, step: 1 });
    expect(padDirections(45.1).away).toEqual({ axis: 0, step: -1 });
    // And the tie decides the same way for the float noise on either side of exact 45.
    expect(padDirections(45 + 1e-12).away).toEqual(padDirections(45).away);
    expect(padDirections(45 - 1e-12).away).toEqual(padDirections(45).away);
  });

  it("is the same for equivalent azimuths: negative, over 360", () => {
    for (const az of [0, 10, 100, 200, 333]) {
      expect(padDirections(az + 360)).toEqual(padDirections(az));
      expect(padDirections(az - 360)).toEqual(padDirections(az));
    }
  });

  it("for every azimuth the four arrows are the four ground directions once, and a right turn takes away to right", () => {
    for (let az = 0; az < 360; az += 0.5) {
      const d = padDirections(az);
      expect(d.away.axis, `az ${az}`).not.toBe(d.right.axis);
      const four = [d.away, d.toward, d.left, d.right].map((s) => dir(s).join(","));
      expect(new Set(four).size, `az ${az}`).toBe(4);
      // Turning right from "away" gives "right": the cross product of the two unit vectors is +1.
      const [ax, az2] = dir(d.away);
      const [rx, rz] = dir(d.right);
      expect(ax * rz - az2 * rx, `az ${az}`).toBe(1);
    }
  });

  it("each arrow is the axis most aligned with its screen direction (brute force, away from ties)", () => {
    const units: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const best = (v: [number, number]): [number, number] =>
      units.reduce((a, b) => (b[0] * v[0] + b[1] * v[1] > a[0] * v[0] + a[1] * v[1] ? b : a));
    for (let az = 0; az < 360; az += 7) {
      if (az % 45 === 0 && az % 90 !== 0) continue; // diagonals are ties
      const rad = (az * Math.PI) / 180;
      const d = padDirections(az);
      expect(dir(d.away), `az ${az}`).toEqual(best([-Math.sin(rad), Math.cos(rad)]));
      expect(dir(d.right), `az ${az}`).toEqual(best([-Math.cos(rad), -Math.sin(rad)]));
    }
  });
});

describe("checkNudge", () => {
  const limits = (over: Partial<NudgeLimits> = {}): NudgeLimits => ({
    slice: null,
    build: box([0, 0, 0], [15, 5, 15]),
    ...over,
  });

  it("allows an ordinary step and refuses nothing silently", () => {
    expect(checkNudge({ moving: [[2, 1, 2]] }, 0, 1, limits())).toEqual({ ok: true });
  });

  it("refuses a step along y that leaves the visible layers, with a message", () => {
    const r = checkNudge({ moving: [[2, 3, 2]] }, 1, 1, limits({ slice: { y0: 1, y1: 3 } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Layer 4.*1 to 3/);
    expect(checkNudge({ moving: [[2, 1, 2]] }, 1, -1, limits({ slice: { y0: 1, y1: 3 } })).ok).toBe(
      false,
    );
    expect(checkNudge({ moving: [[2, 2, 2]] }, 1, 1, limits({ slice: { y0: 1, y1: 3 } })).ok).toBe(
      true,
    );
  });

  it("the layers do not limit a step along x or z", () => {
    expect(checkNudge({ moving: [[2, 3, 2]] }, 0, 1, limits({ slice: { y0: 3, y1: 3 } })).ok).toBe(
      true,
    );
  });

  it("every moving cell must stay visible, not only the first", () => {
    const r = checkNudge(
      {
        moving: [
          [0, 1, 0],
          [0, 3, 0],
        ],
      },
      1,
      1,
      limits({ slice: { y0: 1, y1: 3 } }),
    );
    expect(r.ok).toBe(false);
  });

  describe("the 512 limit", () => {
    const wide = box([0, 0, 0], [511, 5, 15]); // already 512 long along x

    it("refuses a step that would make the build 513 blocks long", () => {
      const r = checkNudge({ moving: [[511, 1, 0]] }, 0, 1, limits({ build: wide }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/Build would be 513 long along x; limit is 512/);
      expect(checkNudge({ moving: [[0, 1, 0]] }, 0, -1, limits({ build: wide })).ok).toBe(false);
    });

    it("allows a step that stays inside or goes back toward the build", () => {
      expect(checkNudge({ moving: [[511, 1, 0]] }, 0, -1, limits({ build: wide })).ok).toBe(true);
      expect(checkNudge({ moving: [[300, 1, 0]] }, 0, 1, limits({ build: wide })).ok).toBe(true);
    });

    it("counts the cell that stays put: a corner cannot be nudged 513 from the other", () => {
      const small = limits({ build: box([0, 0, 0], [15, 5, 15]) });
      // The other corner is at x = -300; this one at 211 would be 512 apart, at 212 513.
      expect(checkNudge({ moving: [[211, 1, 0]], fixed: [[-300, 1, 0]] }, 0, 1, small).ok).toBe(
        false,
      );
      expect(checkNudge({ moving: [[210, 1, 0]], fixed: [[-300, 1, 0]] }, 0, 1, small).ok).toBe(
        true,
      );
    });

    it("counts the far corner of a pasted box that moves with the origin", () => {
      const small = limits({ build: box([0, 0, 0], [400, 5, 15]) });
      expect(checkNudge({ moving: [[300, 1, 0]], alongside: [[320, 5, 4]] }, 0, 1, small).ok).toBe(
        true,
      );
      const r = checkNudge({ moving: [[500, 1, 0]], alongside: [[511, 5, 4]] }, 0, 1, small);
      expect(r.ok).toBe(false);
    });

    it("a build already longer than the limit may keep its length but not grow", () => {
      const huge = box([0, 0, 0], [599, 5, 15]);
      expect(checkNudge({ moving: [[300, 1, 0]] }, 0, 1, limits({ build: huge })).ok).toBe(true);
      expect(checkNudge({ moving: [[599, 1, 0]] }, 0, 1, limits({ build: huge })).ok).toBe(false);
    });

    it("a selection (no build) is limited by its own size only", () => {
      const sel = limits({ build: null });
      expect(checkNudge({ moving: [[1000, 1, 0]], fixed: [[900, 1, 0]] }, 0, 1, sel).ok).toBe(true);
      expect(checkNudge({ moving: [[411, 1, 0]], fixed: [[0, 1, 0]] }, 0, 1, sel).ok).toBe(true);
      expect(checkNudge({ moving: [[511, 1, 0]], fixed: [[0, 1, 0]] }, 0, 1, sel).ok).toBe(false);
    });

    it("the limit can be lowered", () => {
      const r = checkNudge({ moving: [[9, 1, 0]], fixed: [[0, 1, 0]] }, 0, 1, {
        slice: null,
        build: null,
        maxExtent: 10,
      });
      expect(r.ok).toBe(false);
    });
  });
});

describe("stepFace", () => {
  const sel = box([2, 3, 4], [4, 5, 6]); // 3 x 3 x 3
  const noLimits = { slice: null };

  it("has the six faces, named by direction, each once", () => {
    expect(FACES.map((f) => f.name)).toEqual(["West", "East", "Bottom", "Top", "North", "South"]);
    expect(new Set(FACES.map((f) => `${f.axis}${f.side}`)).size).toBe(6);
    // West/East are x, Bottom/Top y, North/South z; the first of each pair is the min face.
    expect(FACES.map((f) => [f.axis, f.side])).toEqual([
      [0, "min"],
      [0, "max"],
      [1, "min"],
      [1, "max"],
      [2, "min"],
      [2, "max"],
    ]);
  });

  it("grows each face by one block on its own side", () => {
    const grown = (axis: 0 | 1 | 2, side: "min" | "max"): Box => {
      const r = stepFace(sel, axis, side, true, noLimits);
      if (!r.ok) throw new Error(r.reason);
      return r.box;
    };
    expect(grown(0, "min")).toEqual(box([1, 3, 4], [4, 5, 6]));
    expect(grown(0, "max")).toEqual(box([2, 3, 4], [5, 5, 6]));
    expect(grown(1, "min")).toEqual(box([2, 2, 4], [4, 5, 6]));
    expect(grown(1, "max")).toEqual(box([2, 3, 4], [4, 6, 6]));
    expect(grown(2, "min")).toEqual(box([2, 3, 3], [4, 5, 6]));
    expect(grown(2, "max")).toEqual(box([2, 3, 4], [4, 5, 7]));
  });

  it("shrinks each face by one block", () => {
    const shrunk = (axis: 0 | 1 | 2, side: "min" | "max"): Box => {
      const r = stepFace(sel, axis, side, false, noLimits);
      if (!r.ok) throw new Error(r.reason);
      return r.box;
    };
    expect(shrunk(0, "min")).toEqual(box([3, 3, 4], [4, 5, 6]));
    expect(shrunk(0, "max")).toEqual(box([2, 3, 4], [3, 5, 6]));
    expect(shrunk(1, "min")).toEqual(box([2, 4, 4], [4, 5, 6]));
    expect(shrunk(1, "max")).toEqual(box([2, 3, 4], [4, 4, 6]));
    expect(shrunk(2, "min")).toEqual(box([2, 3, 5], [4, 5, 6]));
    expect(shrunk(2, "max")).toEqual(box([2, 3, 4], [4, 5, 5]));
  });

  it("does not change the box it was given", () => {
    const before = JSON.stringify(sel);
    stepFace(sel, 0, "min", true, noLimits);
    expect(JSON.stringify(sel)).toBe(before);
  });

  it("a face cannot pass the opposite one: one block is the least", () => {
    const one = box([2, 3, 4], [2, 3, 4]);
    for (const f of FACES) {
      const r = stepFace(one, f.axis, f.side, false, noLimits);
      expect(r.ok, f.name).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/at least one block/);
    }
    // Two blocks shrink to one, and no further.
    const two = box([2, 3, 4], [3, 3, 4]);
    const r1 = stepFace(two, 0, "max", false, noLimits);
    expect(r1.ok && r1.box).toEqual(one);
    expect(stepFace(r1.ok ? r1.box : two, 0, "min", false, noLimits).ok).toBe(false);
  });

  it("growing along y stays inside the visible layers, shrinking is always allowed", () => {
    const slice = { y0: 3, y1: 5 };
    expect(stepFace(sel, 1, "min", true, { slice }).ok).toBe(false);
    expect(stepFace(sel, 1, "max", true, { slice }).ok).toBe(false);
    const r = stepFace(sel, 1, "max", true, { slice: { y0: 3, y1: 6 } });
    expect(r.ok && r.box.max[1]).toBe(6);
    expect(stepFace(sel, 1, "max", false, { slice }).ok).toBe(true);
    // x and z are not limited by the layers.
    expect(stepFace(sel, 0, "min", true, { slice }).ok).toBe(true);
  });

  it("a selection is at most 512 blocks long", () => {
    const long = box([0, 0, 0], [511, 0, 0]);
    const r = stepFace(long, 0, "max", true, noLimits);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Selection would be 513 long along x; limit is 512/);
    expect(stepFace(long, 0, "max", false, noLimits).ok).toBe(true);
    expect(stepFace(long, 1, "max", true, noLimits).ok).toBe(true);
  });
});

describe("HoldRepeater", () => {
  /** A clock the test moves by hand. */
  function clock() {
    let now = 0;
    let nextId = 1;
    const timers = new Map<number, { at: number; fn: () => void }>();
    return {
      setTimeout: (fn: () => void, ms: number) => {
        const id = nextId++;
        timers.set(id, { at: now + ms, fn });
        return id as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout: (id: ReturnType<typeof setTimeout>) => {
        timers.delete(id as unknown as number);
      },
      advance(ms: number) {
        const end = now + ms;
        for (;;) {
          const due = [...timers.entries()]
            .filter(([, t]) => t.at <= end)
            .sort((a, b) => a[1].at - b[1].at)[0];
          if (due === undefined) break;
          timers.delete(due[0]);
          now = due[1].at;
          due[1].fn();
        }
        now = end;
      },
      pending: () => timers.size,
    };
  }

  it("acts at once, again after 400 ms, then every 100 ms", () => {
    expect([REPEAT_DELAY_MS, REPEAT_INTERVAL_MS]).toEqual([400, 100]);
    const c = clock();
    const r = new HoldRepeater(c);
    let n = 0;
    r.start(() => {
      n++;
      return true;
    });
    expect(n).toBe(1);
    c.advance(399);
    expect(n).toBe(1);
    c.advance(1);
    expect(n).toBe(2);
    c.advance(99);
    expect(n).toBe(2);
    c.advance(1);
    expect(n).toBe(3);
    c.advance(1000);
    expect(n).toBe(13);
    expect(r.running).toBe(true);
  });

  it("stop ends it and leaves no timer behind", () => {
    const c = clock();
    const r = new HoldRepeater(c);
    let n = 0;
    r.start(() => {
      n++;
      return true;
    });
    c.advance(550);
    expect(n).toBe(3); // at 0, 400, 500
    r.stop();
    expect(r.running).toBe(false);
    expect(c.pending()).toBe(0);
    c.advance(5000);
    expect(n).toBe(3);
    r.stop(); // twice is fine
  });

  it("a tap shorter than the delay acts once", () => {
    const c = clock();
    const r = new HoldRepeater(c);
    let n = 0;
    r.start(() => {
      n++;
      return true;
    });
    c.advance(120);
    r.stop();
    c.advance(2000);
    expect(n).toBe(1);
  });

  it("stops by itself when a step is refused, at the first press and while held", () => {
    const c = clock();
    const r = new HoldRepeater(c);
    let n = 0;
    r.start(() => {
      n++;
      return n < 4;
    });
    c.advance(2000);
    expect(n).toBe(4);
    expect(r.running).toBe(false);
    expect(c.pending()).toBe(0);

    let m = 0;
    r.start(() => {
      m++;
      return false;
    });
    expect(m).toBe(1);
    expect(r.running).toBe(false);
    c.advance(2000);
    expect(m).toBe(1);
  });

  it("starting again replaces the old repeat", () => {
    const c = clock();
    const r = new HoldRepeater(c);
    let a = 0;
    let b = 0;
    r.start(() => {
      a++;
      return true;
    });
    r.start(() => {
      b++;
      return true;
    });
    c.advance(1000);
    expect(a).toBe(1);
    expect(b).toBeGreaterThan(5);
  });
});
