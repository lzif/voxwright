// SPDX-License-Identifier: AGPL-3.0-only
export {
  AssetError,
  type AssetSource,
  assetVersionCandidates,
  CLIENT_PREFIXES,
  closestPcLayout,
  defaultCacheRoot,
  defaultHttpGet,
  fetchAssets,
  fetchClientAssets,
  fetchRegistry,
  findAssetVersionDir,
  type HttpGet,
  versionKey,
} from "./assets.ts";
export { CliError, HOUSE_TEMPLATE, runCli } from "./cli.ts";
export {
  comparisonImage,
  diffRunDirs,
  firstCommonView,
  listCleanRuns,
  loadRunVoxels,
  resolveRunDir,
} from "./diff.ts";
export {
  type BlockStat,
  computeTextureStats,
  deltaE,
  type Face,
  type FaceStat,
  type Family,
  faceStat,
  hex,
  inFamily,
  type Lab,
  loadTextureStats,
  type Match,
  nearest,
  ramp,
  srgbToLab,
  type TextureStats,
} from "./palette.ts";
export {
  type LoadScriptOptions,
  loadScript,
  ScriptError,
  scanDeterminism,
} from "./script.ts";
