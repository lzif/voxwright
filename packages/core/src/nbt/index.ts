// SPDX-License-Identifier: AGPL-3.0-only
export { gunzip, gzip, isGzip, readNbtFile, writeNbtGzip } from "./gzip.ts";
export { decodeMutf8, encodeMutf8 } from "./mutf8.ts";
export { type ReadOptions, readNbt } from "./reader.ts";
export * from "./types.ts";
export { type WriteOptions, writeNbt } from "./writer.ts";
