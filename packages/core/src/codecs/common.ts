// SPDX-License-Identifier: AGPL-3.0-only
import type { CompoundTag, NbtTag } from "../nbt/index.ts";
import { MAX_EXTENT } from "../volume/index.ts";

export class CodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodecError";
  }
}

export const AIR_BLOCKS: ReadonlySet<string> = new Set([
  "minecraft:air",
  "minecraft:cave_air",
  "minecraft:void_air",
]);

/** Editor leftovers that are not part of a build. */
export const SKIP_BLOCKS: ReadonlySet<string> = new Set([
  "minecraft:structure_void",
  "minecraft:structure_block",
  "minecraft:jigsaw",
]);

export interface CodecReadOptions {
  /** Keep air cells, returned as `minecraft:air`. Default `false`. */
  keepAir?: boolean;
  /**
   * Largest size a file may have along any axis; a bigger one is refused
   * before any cell is read. Default {@link MAX_EXTENT} (512).
   */
  maxExtent?: number;
}

/** Refuse a build bigger than `options.maxExtent` (default 512) on any axis. */
export function checkExtent(
  size: readonly [number, number, number],
  options: CodecReadOptions,
): void {
  const limit = options.maxExtent ?? MAX_EXTENT;
  if (size.some((n) => n > limit)) {
    throw new CodecError(
      `this build is ${size[0]} x ${size[1]} x ${size[2]}; the limit is ${limit} blocks per axis`,
    );
  }
}

export interface WriteResult {
  /** Gzipped file contents. */
  bytes: Uint8Array;
  /** Things the format could not carry, such as block-entity NBT. */
  warnings: string[];
}

export function child(tag: CompoundTag, name: string): NbtTag | undefined {
  return tag.value.get(name);
}

export function asCompound(tag: NbtTag | undefined, what: string): CompoundTag {
  if (tag?.type !== "compound") throw new CodecError(`${what} must be a compound`);
  return tag;
}

export function asNumber(tag: NbtTag | undefined, what: string): number {
  if (tag === undefined) throw new CodecError(`${what} is missing`);
  if (tag.type === "byte" || tag.type === "short" || tag.type === "int") return tag.value;
  throw new CodecError(`${what} must be an integer tag, found ${tag.type}`);
}
