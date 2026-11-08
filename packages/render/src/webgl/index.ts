// SPDX-License-Identifier: AGPL-3.0-only

// The browser entry point: `@voxwright/render/webgl`. It pulls in three.js and
// the DOM, so Node programs (the mcbuilder CLI) import `@voxwright/render`
// instead, which never reaches this folder.

export {
  type BenchmarkResult,
  createWebglRenderer,
  defaultPixelRatio,
  defaultWorkerCount,
  type RendererStats,
  WebglRenderer,
  type WebglRendererOptions,
  webgl2Available,
} from "./renderer.ts";
export type { Box, CameraMode, Renderer, SliceRange } from "./types.ts";
