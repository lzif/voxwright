// SPDX-License-Identifier: AGPL-3.0-only

import type { Volume } from "@voxwright/core";

/** Inclusive cell corners of a box in world coordinates. Core's `Box` fits. */
export interface Box {
  readonly min: readonly [x: number, y: number, z: number];
  readonly max: readonly [x: number, y: number, z: number];
  /** How to draw it; defaults to `selection`. */
  readonly style?: "selection" | "hover" | "ghost";
}

export type CameraMode = "orbit" | "fly";

/** A range of whole cell rows, inclusive, in world coordinates. */
export interface SliceRange {
  y0: number;
  y1: number;
}

/** The renderer every viewer implements; this package supplies a WebGL2 one. */
export interface Renderer {
  mount(canvas: HTMLCanvasElement): void;
  setVolume(v: Volume): void;
  /** Re-mesh only these sections, named `"sx,sy,sz"` (cell coordinate shifted right by 4). */
  markDirty(sectionKeys: string[]): void;
  setCamera(mode: CameraMode): void;
  /** Show only the cell rows in `range`; `null` shows everything. No re-mesh of the whole volume. */
  setSlice(range: SliceRange | null): void;
  /** Selection, hover and ghost-block outlines. Replaces the previous set. */
  highlight(boxes: Box[]): void;
  dispose(): void;
}
