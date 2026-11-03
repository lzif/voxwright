// SPDX-License-Identifier: AGPL-3.0-only
export type { AssetSource } from "./assets.ts";
export {
  blockQuads,
  DYE_RGB,
  FALLBACK_MAGENTA,
  FLUID_RGBA,
  FLUID_SURFACE_HEIGHT,
  fallbackColor,
  fallbackCubeQuads,
  fluidCubeQuads,
  tryEntityQuads,
} from "./blocks.ts";
export { DEFAULT_PROPS, type Rgb, TINT_TABLE } from "./constants.ts";
export {
  blendToward,
  createCanvas,
  drawEllipse,
  drawLine,
  drawPolygon,
  drawRect,
  pasteRgb,
  type Rgb3,
  resizeNearest,
} from "./draw.ts";
export { buildFaceTextures } from "./fast.ts";
export { drawText, textScale, textWidth } from "./font.ts";
export type { RasterImage } from "./image.ts";
export {
  type ModelApplication,
  modelApplications,
  type Quad,
  resolveBlockQuads,
  splitBlockstate,
  type Vec3,
} from "./models.ts";
export {
  type Canvas,
  camera,
  downscaleLanczos,
  drawTexturedQuad,
  PRESENTATION_LONGEST_PX,
  PRESENTATION_MARGIN,
  project,
  type RenderOptions,
  renderView,
  SUPERSAMPLE,
} from "./rasterize.ts";
export {
  blockOccludesAo,
  cellQuads,
  effectiveBlock,
  inferConnectorProps,
  inferWallProps,
  isHorizConnectorBlock,
  isWallBlock,
  type OccGrid,
  prepareScene,
  quadAoLevels,
  quadCulledByNeighbour,
  type Scene,
} from "./scene.ts";
export {
  checkCap,
  defaultViews,
  MAX_VIEWS,
  parseViews,
  resolveViews,
  type View,
  ViewError,
  withCount,
} from "./views.ts";
