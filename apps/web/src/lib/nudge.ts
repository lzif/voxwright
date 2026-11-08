// SPDX-License-Identifier: AGPL-3.0-only

// The pure parts of the nudge pad and the selection face steppers: which world axis each screen
// arrow means, whether a move is allowed, what a face stepper does to a box, and the hold-to-repeat
// timing of a pad button. No DOM and no session, so all of it runs under Vitest.

import { type Box, MAX_EXTENT, type Vec3 } from "@voxwright/core";

// -- Screen arrows to world axes -----------------------------------------------------------------

/** A step of one cell along a world axis (0 = x, 1 = y, 2 = z). */
export interface AxisStep {
  readonly axis: 0 | 1 | 2;
  readonly step: -1 | 1;
}

/** What each button of the pad does, for one camera azimuth. */
export interface PadDirections {
  readonly left: AxisStep;
  readonly right: AxisStep;
  /** Away from the camera, along the ground. */
  readonly away: AxisStep;
  /** Toward the camera, along the ground. */
  readonly toward: AxisStep;
  readonly up: AxisStep;
  readonly down: AxisStep;
}

/** Two projections this close count as equal, so that 45 degrees decides the same way on every machine. */
const TIE = 1e-9;

/**
 * The pad's horizontal arrows for a camera at `azimuth` degrees (the renderer's convention: the
 * camera looks along (-sin az, cos az) on the ground, and the screen's right is (-cos az, -sin az)
 * in x and z).
 *
 * "Away" is the world axis, sign included, most aligned with the camera's forward direction on the
 * ground; "right" is the one most aligned with the screen's right. They always fall on different
 * axes (turning the view by a right angle swaps them), so the four arrows are the four horizontal
 * directions once each. At the four diagonal azimuths (45, 135, 225 and 315 degrees) the two
 * choices are equally good; the tie rule is fixed: "away" takes the z axis and "right" the x axis,
 * with the signs the view's own direction has on them.
 */
export function padDirections(azimuth: number): PadDirections {
  const rad = (azimuth * Math.PI) / 180;
  const fx = -Math.sin(rad);
  const fz = Math.cos(rad);
  const rx = -Math.cos(rad);
  const rz = -Math.sin(rad);
  const awayOnZ = Math.abs(fz) >= Math.abs(fx) - TIE;
  const sign = (v: number): -1 | 1 => (v < 0 ? -1 : 1);
  const away: AxisStep = awayOnZ ? { axis: 2, step: sign(fz) } : { axis: 0, step: sign(fx) };
  const right: AxisStep = awayOnZ ? { axis: 0, step: sign(rx) } : { axis: 2, step: sign(rz) };
  const flip = (s: AxisStep): AxisStep => ({ axis: s.axis, step: s.step === 1 ? -1 : 1 });
  return {
    left: flip(right),
    right,
    away,
    toward: flip(away),
    up: { axis: 1, step: 1 },
    down: { axis: 1, step: -1 },
  };
}

// -- Is a move allowed -------------------------------------------------------------------------------

export interface NudgeLimits {
  /** The visible layers (world y, inclusive), or `null` when all of them are. */
  slice: { y0: number; y1: number } | null;
  /**
   * The blocks the build holds (its placed bounds), for a move that is part of an edit: the edit may
   * not make the build longer than `maxExtent` along an axis. `null` for a selection, which edits
   * nothing and only has to fit in `maxExtent` itself.
   */
  build: Box | null;
  /** Default core's `MAX_EXTENT`, 512. */
  maxExtent?: number;
}

/** The cells that take part in a move. */
export interface NudgeCells {
  /** Cells that move by the step; each must stay in the visible layers. */
  moving: readonly Vec3[];
  /** Cells that move with them (the far corner of a pasted box) and count for the size limit only. */
  alongside?: readonly Vec3[];
  /** Cells that stay where they are (the other corner) and count for the size limit. */
  fixed?: readonly Vec3[];
}

export type NudgeCheck = { ok: true } | { ok: false; reason: string };

const AXIS_NAMES = ["x", "y", "z"] as const;

/** The length of the box around some cells and, when given, the build, along one axis. */
function span(axis: 0 | 1 | 2, cells: readonly Vec3[], build: Box | null): number {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const c of cells) {
    lo = Math.min(lo, c[axis]);
    hi = Math.max(hi, c[axis]);
  }
  if (build !== null) {
    lo = Math.min(lo, build.min[axis]);
    hi = Math.max(hi, build.max[axis]);
  }
  return hi - lo + 1;
}

/**
 * Would moving `cells` one step along `axis` stay inside what the commands allow? The layers must be
 * visible (the same rule the pointer follows when it picks) and the edit must not make the build
 * longer than the limit along `axis`; a move that makes it no longer than it is now is always fine,
 * so a corner that was put too far out by a tap can still be brought back. A refused move is not
 * clamped: the answer says why, and nothing moves.
 */
export function checkNudge(
  cells: NudgeCells,
  axis: 0 | 1 | 2,
  step: number,
  limits: NudgeLimits,
): NudgeCheck {
  const shift = (c: Vec3): Vec3 => {
    const out: [number, number, number] = [c[0], c[1], c[2]];
    out[axis] += step;
    return out;
  };
  const moved = cells.moving.map(shift);
  if (axis === 1 && limits.slice !== null) {
    const { y0, y1 } = limits.slice;
    const out = moved.find((c) => c[1] < y0 || c[1] > y1);
    if (out !== undefined) {
      return {
        ok: false,
        reason: `Layer ${out[1]} is outside the visible layers ${y0} to ${y1}.`,
      };
    }
  }
  const alongside = (cells.alongside ?? []).map(shift);
  const fixed = cells.fixed ?? [];
  const limit = limits.maxExtent ?? MAX_EXTENT;
  const before = span(axis, [...cells.moving, ...(cells.alongside ?? []), ...fixed], limits.build);
  const after = span(axis, [...moved, ...alongside, ...fixed], limits.build);
  if (after > limit && after > before) {
    return {
      ok: false,
      reason: `${limits.build === null ? "Selection" : "Build"} would be ${after} long along ${AXIS_NAMES[axis]}; limit is ${limit}.`,
    };
  }
  return { ok: true };
}

// -- Selection face steppers -----------------------------------------------------------------------

export type FaceSide = "min" | "max";

/** One face of the selection box and the plain name it goes by. */
export interface FaceInfo {
  readonly axis: 0 | 1 | 2;
  readonly side: FaceSide;
  /** West and East are the x faces, Bottom and Top the y faces, North and South the z faces (north is -z). */
  readonly name: "West" | "East" | "Bottom" | "Top" | "North" | "South";
}

export const FACES: readonly FaceInfo[] = [
  { axis: 0, side: "min", name: "West" },
  { axis: 0, side: "max", name: "East" },
  { axis: 1, side: "min", name: "Bottom" },
  { axis: 1, side: "max", name: "Top" },
  { axis: 2, side: "min", name: "North" },
  { axis: 2, side: "max", name: "South" },
];

export type FaceStep = { ok: true; box: Box } | { ok: false; reason: string };

/**
 * Grow (`grow` = true) or shrink a face of a box by one block. A box is at least one block in each
 * direction, so a face cannot pass the opposite one; growing along y stays inside the visible
 * layers; and a box is at most `maxExtent` blocks long on an axis. A refused step says why and
 * leaves the box alone. Shrinking is always allowed down to one block, whatever the layers.
 */
export function stepFace(
  box: Box,
  axis: 0 | 1 | 2,
  side: FaceSide,
  grow: boolean,
  limits: Pick<NudgeLimits, "slice" | "maxExtent">,
): FaceStep {
  const min = [...box.min] as [number, number, number];
  const max = [...box.max] as [number, number, number];
  // Growing moves the min face down and the max face up; shrinking the other way round.
  const delta = (side === "min" ? -1 : 1) * (grow ? 1 : -1);
  const face = side === "min" ? min : max;
  face[axis] += delta;
  if (max[axis] < min[axis]) {
    return { ok: false, reason: "A selection keeps at least one block each way." };
  }
  if (grow) {
    if (axis === 1 && limits.slice !== null) {
      const { y0, y1 } = limits.slice;
      if (face[1] < y0 || face[1] > y1) {
        return {
          ok: false,
          reason: `Layer ${face[1]} is outside the visible layers ${y0} to ${y1}.`,
        };
      }
    }
    const limit = limits.maxExtent ?? MAX_EXTENT;
    const length = max[axis] - min[axis] + 1;
    if (length > limit) {
      return {
        ok: false,
        reason: `Selection would be ${length} long along ${AXIS_NAMES[axis]}; limit is ${limit}.`,
      };
    }
  }
  return { ok: true, box: { min, max } };
}

// -- Hold to repeat ------------------------------------------------------------------------------------

/** A pad button held down acts once at once, again after this long, then at the interval. */
export const REPEAT_DELAY_MS = 400;
export const REPEAT_INTERVAL_MS = 100;

type TimerHandle = ReturnType<typeof setTimeout>;

export interface HoldRepeaterOptions {
  readonly delayMs?: number;
  readonly intervalMs?: number;
  /** Timers, replaceable in tests. */
  readonly setTimeout?: (fn: () => void, ms: number) => TimerHandle;
  readonly clearTimeout?: (handle: TimerHandle) => void;
}

/**
 * The repeat of a held button. `start(act)` calls `act` once now and keeps calling it while held;
 * `stop()` ends it (pointer up, cancel or leave, or the button going away). `act` returns false to
 * stop the repeat early, as a refused nudge does: holding a button against a limit must not keep
 * repeating the same refusal.
 */
export class HoldRepeater {
  private timer: TimerHandle | null = null;
  private readonly delayMs: number;
  private readonly intervalMs: number;
  private readonly set: (fn: () => void, ms: number) => TimerHandle;
  private readonly clear: (handle: TimerHandle) => void;

  constructor(options: HoldRepeaterOptions = {}) {
    this.delayMs = options.delayMs ?? REPEAT_DELAY_MS;
    this.intervalMs = options.intervalMs ?? REPEAT_INTERVAL_MS;
    this.set = options.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
    this.clear = options.clearTimeout ?? ((handle) => clearTimeout(handle));
  }

  get running(): boolean {
    return this.timer !== null;
  }

  start(act: () => boolean | undefined): void {
    this.stop();
    if (act() === false) return;
    const again = (): void => {
      if (act() === false) {
        this.timer = null;
        return;
      }
      this.timer = this.set(again, this.intervalMs);
    };
    this.timer = this.set(again, this.delayMs);
  }

  stop(): void {
    if (this.timer !== null) {
      this.clear(this.timer);
      this.timer = null;
    }
  }
}
