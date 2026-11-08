// SPDX-License-Identifier: AGPL-3.0-only

// An edit that touch has begun and the user has not confirmed yet: the corners of a line, a
// rectangle or a selection, a cell armed for Place, Replace or Erase, or the origin of a paste.
// These are plain values, replaced (never changed) on every step, so the session can hold the
// current one in reactive state. Nothing here knows about the DOM, the renderer or the volume.

import type { Box, Vec3 } from "@voxwright/core";
import { boxBetween } from "./editing.ts";

export type PendingCorner = "a" | "b";

/** The tools that take two taps. */
export type TwoPointTool = "line" | "rectangle" | "select";

export interface LinePending {
  readonly kind: "line";
  readonly a: Vec3;
  /** `null` until the second tap; a confirm before that uses `a` as `b`. */
  readonly b: Vec3 | null;
  /** The corner the pad and the next tap move. `"b"` only once `b` exists. */
  readonly active: PendingCorner;
}

export interface RectanglePending {
  readonly kind: "rectangle";
  readonly a: Vec3;
  readonly b: Vec3 | null;
  readonly active: PendingCorner;
  /** The axis the rectangle is flat along: both corners have the same coordinate on it. */
  readonly axis: 0 | 1 | 2;
  /** Where on `axis` a ray meets the plane of the face that was tapped: 0, or 1 for a face looking down the axis. */
  readonly at: number;
}

export interface SelectPending {
  readonly kind: "select";
  readonly a: Vec3;
  readonly b: Vec3 | null;
  readonly active: PendingCorner;
  /** The selection that existed before corner A, which cancelling puts back. */
  readonly before: Box | null;
}

export interface CellPending {
  readonly kind: "cell";
  readonly tool: "place" | "paint" | "erase";
  /** The cell the tool will be applied to: next to the block that was tapped for Place, the block itself otherwise. */
  readonly cell: Vec3;
}

export interface PastePending {
  readonly kind: "paste";
  /** The corner of the pasted box with the smallest coordinates, as `pasteClipboard` takes it. */
  readonly at: Vec3;
}

export type TwoPointPending = LinePending | RectanglePending | SelectPending;
export type Pending = TwoPointPending | CellPending | PastePending;

export const isTwoPoint = (p: Pending): p is TwoPointPending =>
  p.kind === "line" || p.kind === "rectangle" || p.kind === "select";

/** The second corner a confirm uses: `b`, or `a` when only the first tap happened. */
export const cornerB = (p: TwoPointPending): Vec3 => p.b ?? p.a;

/** The corner the pad is moving. */
export const activeCorner = (p: TwoPointPending): Vec3 =>
  p.active === "b" && p.b !== null ? p.b : p.a;

/** The box the two corners span (a flat one for a rectangle). */
export const cornersBox = (p: TwoPointPending): Box => boxBetween(p.a, cornerB(p));

/** Edge lengths in cells of what the corners span. */
export function pendingSize(p: Pending, clipSize: Vec3 | null): Vec3 | null {
  if (p.kind === "cell") return [1, 1, 1];
  if (p.kind === "paste") return clipSize;
  const box = cornersBox(p);
  return [box.max[0] - box.min[0] + 1, box.max[1] - box.min[1] + 1, box.max[2] - box.min[2] + 1];
}

const at = (c: Vec3): string => c.join(",");
const sizeText = (s: Vec3): string => s.join("×");
const nameOf = (block: string): string => block.replace("minecraft:", "");

export interface ReadoutContext {
  /** The block the tools place. */
  readonly block: string;
  /** What the volume holds at a cell, or `undefined` for nothing. */
  readonly blockAt: (cell: Vec3) => string | undefined;
  /** The size of the copied box, or `null` when nothing was copied. */
  readonly clipSize: Vec3 | null;
}

/**
 * The line above the toolbar while something is pending: the armed cell and its block, or the corners
 * and the size. Short, because it shares a 28 px line with the message (`A 6,8,3 ▸B 10,8,6 · 5×1×4`).
 */
export function describePending(p: Pending, ctx: ReadoutContext): string {
  switch (p.kind) {
    case "cell": {
      const here = ctx.blockAt(p.cell);
      const there = here === undefined ? "air" : nameOf(here);
      if (p.tool === "place") return `Place ${at(p.cell)} ${nameOf(ctx.block)}`;
      if (p.tool === "paint") return `Replace ${at(p.cell)} ${there} → ${nameOf(ctx.block)}`;
      return `Erase ${at(p.cell)} ${there}`;
    }
    case "paste": {
      const size = ctx.clipSize === null ? "" : ` · ${sizeText(ctx.clipSize)}`;
      return `Paste at ${at(p.at)}${size}`;
    }
    default: {
      const mark = (which: PendingCorner): string => (p.active === which ? "▸" : "");
      const b = p.b === null ? "—" : at(p.b);
      return `${mark("a")}A ${at(p.a)} ${mark("b")}B ${b} · ${sizeText(pendingSize(p, null) as Vec3)}`;
    }
  }
}

/**
 * The pending value with a corner of a two-point tool put at `cell`. Putting the first corner of a
 * rectangle again (no `b` yet) keeps the plane it already had; the caller replaces the whole value
 * when the plane should come from a new tap.
 */
export function withCorner(p: TwoPointPending, which: PendingCorner, cell: Vec3): TwoPointPending {
  return which === "a" ? { ...p, a: cell, active: "a" } : { ...p, b: cell, active: "b" };
}

/**
 * The cells that take part in a one-step move along `axis`, for `checkNudge`. A rectangle moved along
 * its normal moves whole (both corners); a move along any other axis, and every move of a line or a
 * selection, takes the active corner and leaves the other where it is.
 */
export function nudgeCells(
  p: Pending,
  axis: 0 | 1 | 2,
  clipSize: Vec3 | null,
): { moving: Vec3[]; alongside: Vec3[]; fixed: Vec3[] } {
  if (p.kind === "cell") return { moving: [p.cell], alongside: [], fixed: [] };
  if (p.kind === "paste") {
    const far: Vec3 =
      clipSize === null
        ? p.at
        : [p.at[0] + clipSize[0] - 1, p.at[1] + clipSize[1] - 1, p.at[2] + clipSize[2] - 1];
    return { moving: [p.at], alongside: [far], fixed: [] };
  }
  if (p.kind === "rectangle" && axis === p.axis) {
    return { moving: p.b === null ? [p.a] : [p.a, p.b], alongside: [], fixed: [] };
  }
  const moving = activeCorner(p);
  const other = p.active === "a" ? p.b : p.a;
  return { moving: [moving], alongside: [], fixed: other === null ? [] : [other] };
}

const shift = (c: Vec3, axis: 0 | 1 | 2, step: number): Vec3 => {
  const out: [number, number, number] = [c[0], c[1], c[2]];
  out[axis] += step;
  return out;
};

/** The pending value moved one step the way `nudgeCells` says. */
export function shiftPending(p: Pending, axis: 0 | 1 | 2, step: number): Pending {
  switch (p.kind) {
    case "cell":
      return { ...p, cell: shift(p.cell, axis, step) };
    case "paste":
      return { ...p, at: shift(p.at, axis, step) };
    case "rectangle":
      if (axis === p.axis) {
        return {
          ...p,
          a: shift(p.a, axis, step),
          b: p.b === null ? null : shift(p.b, axis, step),
        };
      }
      return withCorner(p, p.active, shift(activeCorner(p), axis, step)) as RectanglePending;
    default:
      return withCorner(p, p.active, shift(activeCorner(p), axis, step));
  }
}
