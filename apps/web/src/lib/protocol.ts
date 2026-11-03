// SPDX-License-Identifier: AGPL-3.0-only

import type { FormatId } from "./formats.ts";

export interface RenderRequest {
  azimuth: number;
  elevation: number;
  longestPx: number;
  supersample: number;
  shadow: boolean;
  /** Inclusive layer range, dense-array y (0 = bottom). */
  yMin: number;
  yMax: number;
}

/** One cell change, in world coordinates. `block: null` removes the cell. */
export interface CellEdit {
  x: number;
  y: number;
  z: number;
  block: string | null;
}

export type ToWorker =
  | { id: number; type: "init"; packUrl: string }
  | { id: number; type: "open"; bytes: ArrayBuffer; name: string }
  | { id: number; type: "new"; width: number; depth: number }
  | { id: number; type: "peek" }
  | { id: number; type: "restore" }
  | ({ id: number; type: "render" } & RenderRequest)
  | ({ id: number; type: "pick"; px: number; py: number } & RenderRequest)
  | { id: number; type: "edit"; edits: CellEdit[] }
  | { id: number; type: "undo" }
  | { id: number; type: "redo" }
  | { id: number; type: "states"; name: string }
  | { id: number; type: "convert"; format: FormatId };

export interface Info {
  name: string;
  size: [number, number, number];
  blocks: number;
  dataVersion: number | null;
  /** Non-air block counts, most used first. */
  counts: [string, number][];
  loss: string[];
  canUndo: boolean;
  canRedo: boolean;
}

export interface PickResult {
  /** The block string that was hit. */
  block: string;
  cell: [number, number, number];
  /** Where a new block would go: the cell beside the face that was hit. */
  next: [number, number, number];
}

export type FromWorker =
  | { id: number; type: "ready"; haveAssets: boolean; blockNames: string[] }
  | { id: number; type: "opened"; info: Info }
  | { id: number; type: "peeked"; name: string | null }
  | { id: number; type: "restored"; info: Info | null }
  | { id: number; type: "frame"; width: number; height: number; rgba: ArrayBuffer; ms: number }
  | { id: number; type: "picked"; hit: PickResult | null }
  | { id: number; type: "edited"; info: Info }
  | { id: number; type: "states"; props: Record<string, string[]> }
  | { id: number; type: "converted"; bytes: ArrayBuffer; warnings: string[] }
  | { id: number; type: "error"; message: string };

/** `Omit` that keeps each member of a union separate, so message shapes stay checked. */
export type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
