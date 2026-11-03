// SPDX-License-Identifier: AGPL-3.0-only

export {
  type BlockProperty,
  blockProperties,
  setBlockProperty,
  withBlockProperty,
} from "./blockstate.ts";
export {
  type Box,
  boxCellCount,
  boxContains,
  boxSize,
  eachCellInBox,
  eachPosInBox,
  makeBox,
} from "./box.ts";
export {
  applyCommand,
  type BuilderOptions,
  type Command,
  CommandBuilder,
  commandBytes,
  commandCellCount,
  EditError,
  forEachChange,
  isEmptyCommand,
  MAX_EXTENT,
  mergeCommands,
  revertCommand,
  type SectionDiff,
} from "./command.ts";
export {
  DirtyTracker,
  dirtySectionKeys,
  markBlockDirty,
  parseSectionKey,
  sectionKey,
} from "./dirty.ts";
export { Editor, Stroke } from "./editor.ts";
export { DEFAULT_HISTORY_BYTES, History, type HistoryOptions } from "./history.ts";
export { type RaycastOptions, type RayHit, raycast } from "./pick.ts";
export {
  type Clipboard,
  clipboardCellCount,
  copySelection,
  mirrorSelection,
  moveSelection,
  type PasteOptions,
  pasteClipboard,
  rotatedBox,
  rotateSelection,
} from "./selection.ts";
export {
  type Axis,
  drawBox,
  drawLine,
  drawRectangle,
  type EraseOptions,
  eraseBlock,
  eraseCells,
  type FillOptions,
  fillSelection,
  isEmptyBlock,
  linePoints,
  placeBlock,
  placeCells,
  type RectangleOptions,
  replaceInSelection,
  type ShapeOptions,
} from "./tools.ts";
export { cloneVolume } from "./util.ts";
