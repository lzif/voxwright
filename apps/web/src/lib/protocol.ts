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

export type ToWorker =
  | { id: number; type: "init"; packUrl: string }
  | { id: number; type: "open"; bytes: ArrayBuffer; name: string }
  | ({ id: number; type: "render" } & RenderRequest)
  | { id: number; type: "convert"; format: FormatId };

export interface Info {
  name: string;
  size: [number, number, number];
  blocks: number;
  dataVersion: number | null;
  /** Non-air block counts, most used first. */
  counts: [string, number][];
  loss: string[];
}

export type FromWorker =
  | { id: number; type: "ready"; haveAssets: boolean }
  | { id: number; type: "opened"; info: Info }
  | { id: number; type: "frame"; width: number; height: number; rgba: ArrayBuffer; ms: number }
  | { id: number; type: "converted"; bytes: ArrayBuffer; warnings: string[] }
  | { id: number; type: "error"; message: string };

/** `Omit` that keeps each member of a union separate, so message shapes stay checked. */
export type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
