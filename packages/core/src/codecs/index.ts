// SPDX-License-Identifier: AGPL-3.0-only

export { bedrockToJava, javaToBedrock } from "./bedrock.ts";
export { CodecError, type CodecReadOptions, type WriteResult } from "./common.ts";
export {
  buildLitematic,
  type LitematicMeta,
  type LitematicRead,
  readLitematic,
  type WriteLitematicOptions,
  writeLitematic,
} from "./litematic.ts";
export {
  buildMcstructure,
  type McstructureMeta,
  type McstructureRead,
  readMcstructure,
  writeMcstructure,
} from "./mcstructure.ts";
export {
  buildSchem,
  readSchem,
  type SchemMeta,
  type SchemRead,
  type SchemVersion,
  type WriteSchemOptions,
  writeSchem,
} from "./schem.ts";
export {
  type AirMode,
  buildStructureNbt,
  readStructureNbt,
  type StructureNbtMeta,
  type StructureNbtRead,
  type WriteStructureOptions,
  writeStructureNbt,
} from "./structure-nbt.ts";
