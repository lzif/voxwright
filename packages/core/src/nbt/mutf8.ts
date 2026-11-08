// SPDX-License-Identifier: AGPL-3.0-only
import { NbtError } from "./types.ts";

/**
 * Java "modified UTF-8", the string encoding of NBT: U+0000 is the two
 * bytes C0 80, and characters outside the BMP are written as two
 * three-byte surrogates.
 */
export function encodeMutf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c !== 0 && c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return Uint8Array.from(out);
}

/**
 * Decodes NBT strings. Besides modified UTF-8 it accepts a character outside the BMP written as
 * one four-byte UTF-8 sequence, which several tools emit (for example an emoji in a schematic's
 * name) instead of two three-byte surrogates. Encoding stays strict, so what we write is always
 * valid modified UTF-8.
 */
export function decodeMutf8(bytes: Uint8Array): string {
  const units: number[] = [];
  let i = 0;
  const cont = (k: number): number => {
    const b = bytes[k];
    if (b === undefined || (b & 0xc0) !== 0x80) {
      throw new NbtError("invalid modified UTF-8 sequence");
    }
    return b & 0x3f;
  };
  while (i < bytes.length) {
    const b = bytes[i] as number;
    if (b < 0x80) {
      units.push(b);
      i += 1;
    } else if ((b & 0xe0) === 0xc0) {
      units.push(((b & 0x1f) << 6) | cont(i + 1));
      i += 2;
    } else if ((b & 0xf0) === 0xe0) {
      units.push(((b & 0x0f) << 12) | (cont(i + 1) << 6) | cont(i + 2));
      i += 3;
    } else if ((b & 0xf8) === 0xf0) {
      const cp = ((b & 0x07) << 18) | (cont(i + 1) << 12) | (cont(i + 2) << 6) | cont(i + 3);
      // Refuse overlong forms and anything past U+10FFFF.
      if (cp < 0x10000 || cp > 0x10ffff) throw new NbtError("invalid modified UTF-8 sequence");
      const v = cp - 0x10000;
      units.push(0xd800 | (v >> 10), 0xdc00 | (v & 0x3ff));
      i += 4;
    } else {
      throw new NbtError("invalid modified UTF-8 sequence");
    }
  }
  const CHUNK = 8192;
  let s = "";
  for (let k = 0; k < units.length; k += CHUNK) {
    s += String.fromCharCode(...units.slice(k, k + CHUNK));
  }
  return s;
}
