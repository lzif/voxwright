// SPDX-License-Identifier: AGPL-3.0-only

// Block string parsing and canonicalization, compatible with mcbuilder.
//
// A block string is a namespaced name with optional blockstate properties
// and optional NBT:
//
//   minecraft:oak_stairs[facing=north,half=bottom]
//   minecraft:chest{Items:[{Slot:0b,id:"minecraft:stone"}]}
//   minecraft:furnace[facing=east]{BurnTime:200s}
//
// This module only checks structure. Whether the name exists, whether a
// property is legal, and whether NBT values are well typed is for a
// validator to decide.

import { getCloseMatches } from "./difflib.ts";
import { compareCodePoints, isPySpace, pyStrip } from "./pystr.ts";

/** Raised for a structurally malformed block string (mcbuilder's `ValueError`). */
export class BlockStringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockStringError";
  }
}

export interface ParsedBlock {
  name: string;
  /** Properties in the order they were written. */
  props: Map<string, string>;
  /** The NBT compound verbatim, braces included, or `null`. */
  nbt: string | null;
}

/** Python's `repr` for the plain strings that appear in error messages. */
function repr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += `\\${ch}`;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return quote + out + quote;
}

/**
 * Split a block string into name, properties and NBT.
 * Throws {@link BlockStringError} on anything structurally malformed.
 */
export function parse(block: string): ParsedBlock {
  if (typeof block !== "string" || block === "") {
    throw new BlockStringError(
      `malformed block string ${repr(String(block))}: must be a non-empty string`,
    );
  }

  // NBT comes last: everything from the first '{' is the compound.
  const brace = block.indexOf("{");
  const head = brace === -1 ? block : block.slice(0, brace);
  let nbt: string | null = null;
  if (brace !== -1) nbt = checkCompound(block.slice(brace));

  const bracket = head.indexOf("[");
  let name: string;
  let props: Map<string, string>;
  if (bracket === -1) {
    name = head;
    props = new Map();
  } else {
    name = head.slice(0, bracket);
    const rest = head.slice(bracket);
    if (!rest.endsWith("]")) {
      throw new BlockStringError(`malformed block string ${repr(block)}: unclosed '['`);
    }
    props = parseProps(rest.slice(1, -1), block);
  }

  if (name === "") {
    throw new BlockStringError(`malformed block string ${repr(block)}: empty block name`);
  }
  for (const ch of name) {
    if ("[]{},".includes(ch) || isPySpace(ch)) {
      throw new BlockStringError(
        `malformed block string ${repr(block)}: bad block name ${repr(name)}`,
      );
    }
  }
  return { name, props, nbt };
}

/**
 * The canonical palette-key form: name, then properties sorted by key,
 * then NBT with its top-level keys sorted. NBT values are kept verbatim.
 * Idempotent.
 */
export function canonicalize(block: string): string {
  const { name, props, nbt } = parse(block);
  return join(name, props, nbt === null ? "" : canonicalizeNbt(nbt));
}

/** `name[k=v,...]` with sorted properties, followed by `suffix`. */
export function join(name: string, props: ReadonlyMap<string, string>, suffix = ""): string {
  let out = name;
  if (props.size > 0) {
    const keys = [...props.keys()].sort(compareCodePoints);
    out += `[${keys.map((k) => `${k}=${props.get(k)}`).join(",")}]`;
  }
  return out + suffix;
}

/**
 * Up to `n` did-you-mean candidates for `name`. Matching ignores the
 * namespace, so `oak_stair` still matches `minecraft:oak_stairs`, but the
 * entries returned are the full candidate strings.
 */
export function suggest(name: string, candidates: readonly string[], n = 3): string[] {
  if (n <= 0) return [];
  const plain = stripNamespace(name);
  const table = new Map<string, string>();
  const plains: string[] = [];
  for (const cand of candidates) {
    const p = stripNamespace(cand);
    if (!table.has(p)) {
      table.set(p, cand);
      plains.push(p);
    }
  }
  return getCloseMatches(plain, plains, n).map((p) => table.get(p) as string);
}

/** `s.split(":", 1)[-1]` */
function stripNamespace(s: string): string {
  const i = s.indexOf(":");
  return i === -1 ? s : s.slice(i + 1);
}

function parseProps(inner: string, block: string): Map<string, string> {
  if (inner === "") {
    throw new BlockStringError(`malformed block string ${repr(block)}: empty property list '[]'`);
  }
  const props = new Map<string, string>();
  for (const item of splitTopLevel(inner)) {
    const eq = item.indexOf("=");
    const key = pyStrip(eq === -1 ? item : item.slice(0, eq));
    const value = pyStrip(eq === -1 ? "" : item.slice(eq + 1));
    if (eq === -1 || key === "" || value === "") {
      throw new BlockStringError(
        `malformed block string ${repr(block)}: bad property ${repr(item)}`,
      );
    }
    for (const ch of key) {
      if (isPySpace(ch)) {
        throw new BlockStringError(
          `malformed block string ${repr(block)}: bad property key ${repr(key)}`,
        );
      }
    }
    if (props.has(key)) {
      throw new BlockStringError(
        `malformed block string ${repr(block)}: duplicate property ${repr(key)}`,
      );
    }
    props.set(key, value);
  }
  return props;
}

/**
 * Check that `raw` is exactly one balanced compound and return it. Fails on
 * unbalanced braces or brackets, an unterminated string, or anything after
 * the closing brace.
 */
function checkCompound(raw: string): string {
  let depthC = 0;
  let depthS = 0;
  let quote: string | null = null;
  let closedAt: number | null = null;
  // Python indexes code points; the structural characters are all ASCII,
  // so scanning UTF-16 units finds the same positions.
  const n = raw.length;
  let i = 0;
  while (i < n) {
    const ch = raw[i] as string;
    if (quote !== null) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "{") {
      depthC++;
    } else if (ch === "}") {
      depthC--;
      if (depthC < 0) throw new BlockStringError(`malformed NBT ${repr(raw)}: unbalanced '}'`);
      if (depthC === 0 && closedAt === null) closedAt = i;
    } else if (ch === "[") {
      depthS++;
    } else if (ch === "]") {
      depthS--;
      if (depthS < 0) throw new BlockStringError(`malformed NBT ${repr(raw)}: unbalanced ']'`);
    }
    i++;
  }
  if (quote !== null) throw new BlockStringError(`malformed NBT ${repr(raw)}: unterminated string`);
  if (depthC !== 0 || depthS !== 0) {
    throw new BlockStringError(`malformed NBT ${repr(raw)}: unbalanced braces/brackets`);
  }
  if (closedAt !== n - 1) {
    throw new BlockStringError(`malformed NBT ${repr(raw)}: trailing characters after compound`);
  }
  return raw;
}

function canonicalizeNbt(raw: string): string {
  const inner = raw.slice(1, -1);
  if (pyStrip(inner) === "") return "{}";
  const entries: [string, string][] = [];
  for (const part of splitTopLevel(inner)) {
    if (pyStrip(part) === "") {
      throw new BlockStringError(`malformed NBT ${repr(raw)}: empty entry`);
    }
    const [key, value] = splitKeyValue(part, raw);
    if (key === "") {
      throw new BlockStringError(`malformed NBT ${repr(raw)}: empty key in ${repr(part)}`);
    }
    entries.push([key, value]);
  }
  entries.sort((a, b) => compareCodePoints(a[0], b[0]));
  return `{${entries.map(([k, v]) => `${k}:${v}`).join(",")}}`;
}

/** Split an NBT `key:value` entry at the first top-level colon. */
function splitKeyValue(entry: string, raw: string): [string, string] {
  let depthC = 0;
  let depthS = 0;
  let quote: string | null = null;
  const n = entry.length;
  let i = 0;
  while (i < n) {
    const ch = entry[i] as string;
    if (quote !== null) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "{") {
      depthC++;
    } else if (ch === "}") {
      depthC--;
    } else if (ch === "[") {
      depthS++;
    } else if (ch === "]") {
      depthS--;
    } else if (ch === ":" && depthC === 0 && depthS === 0) {
      return [pyStrip(entry.slice(0, i)), pyStrip(entry.slice(i + 1))];
    }
    i++;
  }
  throw new BlockStringError(`malformed NBT ${repr(raw)}: entry without ':' — ${repr(entry)}`);
}

/** Split on commas that are not nested inside `{}`, `[]` or quotes. */
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depthC = 0;
  let depthS = 0;
  let quote: string | null = null;
  let cur = "";
  const n = s.length;
  let i = 0;
  while (i < n) {
    const ch = s[i] as string;
    if (quote !== null) {
      cur += ch;
      if (ch === "\\" && i + 1 < n) {
        cur += s[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
    } else if (ch === "{") {
      depthC++;
      cur += ch;
    } else if (ch === "}") {
      depthC--;
      cur += ch;
    } else if (ch === "[") {
      depthS++;
      cur += ch;
    } else if (ch === "]") {
      depthS--;
      cur += ch;
    } else if (ch === "," && depthC === 0 && depthS === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
    i++;
  }
  parts.push(cur);
  return parts;
}
