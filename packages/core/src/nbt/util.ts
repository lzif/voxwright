// SPDX-License-Identifier: AGPL-3.0-only

import type { CompoundTag, NbtTag } from "./types.ts";

/** A deep copy of a tag, so the copy can be kept without sharing arrays or maps with the source. */
export function cloneNbt<T extends NbtTag>(tag: T): T {
  switch (tag.type) {
    case "byteArray":
      return { type: "byteArray", value: tag.value.slice() } as T;
    case "intArray":
      return { type: "intArray", value: tag.value.slice() } as T;
    case "longArray":
      return { type: "longArray", value: tag.value.slice() } as T;
    case "list":
      return {
        type: "list",
        elementType: tag.elementType,
        value: tag.value.map((v) => cloneNbt(v)),
      } as T;
    case "compound": {
      const value = new Map<string, NbtTag>();
      for (const [k, v] of tag.value) value.set(k, cloneNbt(v));
      return { type: "compound", value } as T;
    }
    default:
      return { ...tag };
  }
}

/**
 * Structural equality of two tags. Types must match exactly (a byte is not
 * an int); compounds are compared without regard to key order, as NBT
 * compounds are unordered. Numbers are compared with `Object.is`, so `-0`
 * differs from `0` and `NaN` equals itself.
 */
export function nbtEqual(a: NbtTag, b: NbtTag): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "byte":
    case "short":
    case "int":
    case "float":
    case "double":
      return Object.is(a.value, (b as typeof a).value);
    case "long":
    case "string":
      return a.value === (b as typeof a).value;
    case "byteArray":
    case "intArray":
    case "longArray": {
      const bv = (b as typeof a).value as ArrayLike<number | bigint>;
      const av = a.value as ArrayLike<number | bigint>;
      if (av.length !== bv.length) return false;
      for (let i = 0; i < av.length; i++) if (av[i] !== bv[i]) return false;
      return true;
    }
    case "list": {
      const other = b as typeof a;
      if (a.value.length !== other.value.length) return false;
      // An empty list's element type is not significant.
      if (a.value.length > 0 && a.elementType !== other.elementType) return false;
      return a.value.every((v, i) => nbtEqual(v, other.value[i] as NbtTag));
    }
    case "compound": {
      const other = (b as CompoundTag).value;
      if (a.value.size !== other.size) return false;
      for (const [k, v] of a.value) {
        const w = other.get(k);
        if (w === undefined || !nbtEqual(v, w)) return false;
      }
      return true;
    }
  }
}
