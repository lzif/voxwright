// SPDX-License-Identifier: AGPL-3.0-only
export { Build, type BuildOptions } from "./build.ts";
export {
  ConfigError,
  expandUser,
  type McbuildConfig,
  parseConfig,
  resolveAssetsDir,
} from "./config.ts";
export { DATA_VERSIONS, ExportError, resolveDataVersion } from "./dataversion.ts";
export {
  DiffError,
  diffVoxelMaps,
  formatDiff,
  isEmpty as diffIsEmpty,
  type Pos,
  total as diffTotal,
  type VoxelDiff,
  type VoxelMap,
  voxelKey,
} from "./diff.ts";
export { BuildError, GridBoundsError, McbuilderError } from "./errors.ts";
export { type Cell, Geometry, type Point } from "./geometry.ts";
export {
  cleanProperties,
  constName,
  type ImportCall,
  type ImportPlan,
  mergeBoxes,
  planImport,
  pyFixed,
  type Structure,
  type StructureCell,
  structureFromVolume,
  summary,
  toScript,
} from "./importer.ts";
export {
  type Material,
  type MaterialEntry,
  type MaterialFn,
  type PatchesOptions,
  patches,
  resolveMaterial,
  type Seed,
  unitHash,
} from "./materials.ts";
export {
  type NormalizedBlocks,
  normalizeBlockData,
  Registry,
  type RegistryBlocks,
  RegistryError,
  type ValidationError,
  type ValidationWarning,
} from "./registry.ts";
export {
  buildReport,
  type Report,
  type ReportInput,
  reportToJson,
  type ViewEntry,
  type ViewLike,
  viewEntry,
} from "./report.ts";
export { Rng } from "./rng.ts";
export { sha256 } from "./sha256.ts";
export * as shapes from "./shapes.ts";
export { type Dims, VoxelGrid } from "./voxels.ts";
