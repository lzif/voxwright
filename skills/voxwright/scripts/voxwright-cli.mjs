#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// GENERATED FILE. Do not edit: change the sources and run `pnpm build:skill`.
// The Voxwright skill CLI, bundled from packages/mcbuilder/src/node/skill/main.ts
// (packages/mcbuilder and packages/core). It needs Node 22.18 or later and nothing else.
//
// Third-party code bundled in this file, with its licence:
//
// smol-toml 1.9.1 (BSD-3-Clause)
//
//   Copyright (c) Squirrel Chat et al., All rights reserved.
//
//   Redistribution and use in source and binary forms, with or without
//   modification, are permitted provided that the following conditions are met:
//
//   1. Redistributions of source code must retain the above copyright notice, this
//      list of conditions and the following disclaimer.
//   2. Redistributions in binary form must reproduce the above copyright notice,
//      this list of conditions and the following disclaimer in the
//      documentation and/or other materials provided with the distribution.
//   3. Neither the name of the copyright holder nor the names of its contributors
//      may be used to endorse or promote products derived from this software without
//      specific prior written permission.
//
//   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
//   ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
//   WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
//   DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
//   FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
//   DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
//   SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
//   CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
//   OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
//   OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// packages/mcbuilder/src/node/skill/main.ts
import { realpathSync } from "node:fs";
import * as nodeModule from "node:module";
import { homedir } from "node:os";
import { extname as extname5 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// packages/mcbuilder/src/errors.ts
var McbuilderError = class extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
};
var BuildError = class extends McbuilderError {
};
var GridBoundsError = class extends McbuilderError {
};

// packages/mcbuilder/src/node/skill/build.ts
import { mkdir as mkdir2, readFile as readFile2, writeFile as writeFile2 } from "node:fs/promises";
import { basename as basename2, dirname as dirname2, extname as extname2, join as join5, resolve as resolve4 } from "node:path";
import { pathToFileURL as pathToFileURL2 } from "node:url";
import { parseArgs } from "node:util";

// packages/mcbuilder/src/dataversion.ts
var ExportError = class extends McbuilderError {
};
var DATA_VERSIONS = {
  "26.2": 4903,
  "26.1": 4786,
  "1.21.11": 4671,
  "1.21.4": 4189,
  "1.21.1": 3955
};
function resolveDataVersion(mcVersion, versionJson) {
  const wv = versionJson?.world_version;
  if (typeof wv === "number" && Number.isInteger(wv)) return wv;
  const known = Object.hasOwn(DATA_VERSIONS, mcVersion) ? DATA_VERSIONS[mcVersion] : void 0;
  if (known === void 0) {
    throw new ExportError(
      `unknown DataVersion for MC version '${mcVersion}': run \`mcbuild assets fetch --version ${mcVersion}\` first so the client jar's version.json can supply it`
    );
  }
  return known;
}

// packages/mcbuilder/src/node/script.ts
import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// packages/core/src/blocks/pystr.ts
var PY_SPACE = /* @__PURE__ */ new Set([
  9,
  10,
  11,
  12,
  13,
  28,
  29,
  30,
  31,
  32,
  133,
  160,
  5760,
  8192,
  8193,
  8194,
  8195,
  8196,
  8197,
  8198,
  8199,
  8200,
  8201,
  8202,
  8232,
  8233,
  8239,
  8287,
  12288
]);
function isPySpace(ch) {
  const cp = ch.codePointAt(0);
  return cp !== void 0 && PY_SPACE.has(cp);
}
function pyStrip(s) {
  let start = 0;
  let end = s.length;
  while (start < end && PY_SPACE.has(s.charCodeAt(start))) start++;
  while (end > start && PY_SPACE.has(s.charCodeAt(end - 1))) end--;
  return s.slice(start, end);
}
function compareCodePoints(a, b) {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (; ; ) {
    const ra = ia.next();
    const rb = ib.next();
    if (ra.done && rb.done) return 0;
    if (ra.done) return -1;
    if (rb.done) return 1;
    const ca = ra.value.codePointAt(0);
    const cb = rb.value.codePointAt(0);
    if (ca !== cb) return ca < cb ? -1 : 1;
  }
}

// packages/core/src/blocks/difflib.ts
function longestMatch(a, b2j, alo, ahi, blo, bhi) {
  let besti = alo;
  let bestj = blo;
  let bestsize = 0;
  let j2len = /* @__PURE__ */ new Map();
  for (let i = alo; i < ahi; i++) {
    const newj2len = /* @__PURE__ */ new Map();
    for (const j of b2j.get(a[i]) ?? []) {
      if (j < blo) continue;
      if (j >= bhi) break;
      const k = (j2len.get(j - 1) ?? 0) + 1;
      newj2len.set(j, k);
      if (k > bestsize) {
        besti = i - k + 1;
        bestj = j - k + 1;
        bestsize = k;
      }
    }
    j2len = newj2len;
  }
  return [besti, bestj, bestsize];
}
function matchingBlocks(a, b) {
  const b2j = /* @__PURE__ */ new Map();
  b.forEach((ch, j) => {
    const arr = b2j.get(ch);
    if (arr) arr.push(j);
    else b2j.set(ch, [j]);
  });
  const found = [];
  const queue = [[0, a.length, 0, b.length]];
  while (queue.length > 0) {
    const [alo, ahi, blo, bhi] = queue.pop();
    const m = longestMatch(a, b2j, alo, ahi, blo, bhi);
    const [i, j, k] = m;
    if (k > 0) {
      found.push(m);
      if (alo < i && blo < j) queue.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
  }
  return found;
}
function ratio(a, b) {
  const aa = Array.from(a);
  const bb = Array.from(b);
  const total2 = aa.length + bb.length;
  if (total2 === 0) return 1;
  let matches = 0;
  for (const [, , size] of matchingBlocks(aa, bb)) matches += size;
  return 2 * matches / total2;
}
function getCloseMatches(word, possibilities, n2 = 3, cutoff = 0.6) {
  const scored = [];
  for (const x of possibilities) {
    const score = ratio(x, word);
    if (score >= cutoff) scored.push({ score, value: x });
  }
  scored.sort((p, q) => q.score - p.score || compareCodePoints(q.value, p.value));
  return scored.slice(0, n2).map((s) => s.value);
}

// packages/core/src/blocks/blocks.ts
var BlockStringError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "BlockStringError";
  }
};
function repr(s) {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += `\\${ch}`;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "	") out += "\\t";
    else out += ch;
  }
  return quote + out + quote;
}
function parse(block) {
  if (typeof block !== "string" || block === "") {
    throw new BlockStringError(
      `malformed block string ${repr(String(block))}: must be a non-empty string`
    );
  }
  const brace = block.indexOf("{");
  const head = brace === -1 ? block : block.slice(0, brace);
  let nbt = null;
  if (brace !== -1) nbt = checkCompound(block.slice(brace));
  const bracket = head.indexOf("[");
  let name;
  let props;
  if (bracket === -1) {
    name = head;
    props = /* @__PURE__ */ new Map();
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
        `malformed block string ${repr(block)}: bad block name ${repr(name)}`
      );
    }
  }
  return { name, props, nbt };
}
function canonicalize(block) {
  const { name, props, nbt } = parse(block);
  return join(name, props, nbt === null ? "" : canonicalizeNbt(nbt));
}
function join(name, props, suffix = "") {
  let out = name;
  if (props.size > 0) {
    const keys = [...props.keys()].sort(compareCodePoints);
    out += `[${keys.map((k) => `${k}=${props.get(k)}`).join(",")}]`;
  }
  return out + suffix;
}
function suggest(name, candidates, n2 = 3) {
  if (n2 <= 0) return [];
  const plain = stripNamespace(name);
  const table = /* @__PURE__ */ new Map();
  const plains = [];
  for (const cand of candidates) {
    const p = stripNamespace(cand);
    if (!table.has(p)) {
      table.set(p, cand);
      plains.push(p);
    }
  }
  return getCloseMatches(plain, plains, n2).map((p) => table.get(p));
}
function stripNamespace(s) {
  const i = s.indexOf(":");
  return i === -1 ? s : s.slice(i + 1);
}
function parseProps(inner, block) {
  if (inner === "") {
    throw new BlockStringError(`malformed block string ${repr(block)}: empty property list '[]'`);
  }
  const props = /* @__PURE__ */ new Map();
  for (const item of splitTopLevel(inner)) {
    const eq = item.indexOf("=");
    const key = pyStrip(eq === -1 ? item : item.slice(0, eq));
    const value = pyStrip(eq === -1 ? "" : item.slice(eq + 1));
    if (eq === -1 || key === "" || value === "") {
      throw new BlockStringError(
        `malformed block string ${repr(block)}: bad property ${repr(item)}`
      );
    }
    for (const ch of key) {
      if (isPySpace(ch)) {
        throw new BlockStringError(
          `malformed block string ${repr(block)}: bad property key ${repr(key)}`
        );
      }
    }
    if (props.has(key)) {
      throw new BlockStringError(
        `malformed block string ${repr(block)}: duplicate property ${repr(key)}`
      );
    }
    props.set(key, value);
  }
  return props;
}
function checkCompound(raw) {
  let depthC = 0;
  let depthS = 0;
  let quote = null;
  let closedAt = null;
  const n2 = raw.length;
  let i = 0;
  while (i < n2) {
    const ch = raw[i];
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
  if (closedAt !== n2 - 1) {
    throw new BlockStringError(`malformed NBT ${repr(raw)}: trailing characters after compound`);
  }
  return raw;
}
function canonicalizeNbt(raw) {
  const inner = raw.slice(1, -1);
  if (pyStrip(inner) === "") return "{}";
  const entries2 = [];
  for (const part of splitTopLevel(inner)) {
    if (pyStrip(part) === "") {
      throw new BlockStringError(`malformed NBT ${repr(raw)}: empty entry`);
    }
    const [key, value] = splitKeyValue(part, raw);
    if (key === "") {
      throw new BlockStringError(`malformed NBT ${repr(raw)}: empty key in ${repr(part)}`);
    }
    entries2.push([key, value]);
  }
  entries2.sort((a, b) => compareCodePoints(a[0], b[0]));
  return `{${entries2.map(([k, v]) => `${k}:${v}`).join(",")}}`;
}
function splitKeyValue(entry, raw) {
  let depthC = 0;
  let depthS = 0;
  let quote = null;
  const n2 = entry.length;
  let i = 0;
  while (i < n2) {
    const ch = entry[i];
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
function splitTopLevel(s) {
  const parts = [];
  let depthC = 0;
  let depthS = 0;
  let quote = null;
  let cur = "";
  const n2 = s.length;
  let i = 0;
  while (i < n2) {
    const ch = s[i];
    if (quote !== null) {
      cur += ch;
      if (ch === "\\" && i + 1 < n2) {
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

// packages/core/src/codecs/bedrock.ts
var COLORS = [
  "white",
  "orange",
  "magenta",
  "light_blue",
  "yellow",
  "lime",
  "pink",
  "gray",
  "light_gray",
  "cyan",
  "purple",
  "blue",
  "brown",
  "green",
  "red",
  "black"
];
var NAME_TO_JAVA = {
  web: "cobweb",
  reeds: "sugar_cane"
};
var NAME_TO_BEDROCK = Object.fromEntries(
  Object.entries(NAME_TO_JAVA).map(([b, j]) => [j, b])
);
var STAIR_DIR = ["east", "west", "south", "north"];
var BED_DIR = ["south", "west", "north", "east"];
var FACING_DIR = ["down", "up", "north", "south", "west", "east"];
var DOOR_TO_JAVA = {
  south: "east",
  west: "south",
  north: "west",
  east: "north"
};
var DOOR_TO_BEDROCK = Object.fromEntries(
  Object.entries(DOOR_TO_JAVA).map(([b, j]) => [j, b])
);
var SIDE_TO_JAVA = { none: "none", short: "low", tall: "tall" };
var SIDE_TO_BEDROCK = {
  none: "none",
  low: "short",
  tall: "tall"
};
var SHELF_CHAIN = ["unconnected", "right", "center", "left"];
var HORIZONTAL = /* @__PURE__ */ new Set(["north", "south", "east", "west"]);
var FACING_DIRECTION_BLOCKS = /^(barrel|hopper|dropper|dispenser|piston|sticky_piston|observer|ladder|.*_wall_sign|.*_wall_banner|.*_wall_hanging_sign)$/;
var bare = (id) => id.slice(id.indexOf(":") + 1);
var withNs = (n2) => n2.includes(":") ? n2 : `minecraft:${n2}`;
var stripNs = (k) => k.startsWith("minecraft:") ? k.slice("minecraft:".length) : k;
function bedrockToJava(bedrockName, statesIn, extra = {}) {
  const warnings = [];
  const s = /* @__PURE__ */ new Map();
  for (const [k, v] of statesIn) s.set(stripNs(k), v);
  const out = /* @__PURE__ */ new Map();
  const take = (key) => {
    const v = s.get(key);
    s.delete(key);
    return v;
  };
  const bool = (v) => Number(v) ? "true" : "false";
  let name = bare(bedrockName);
  name = NAME_TO_JAVA[name] ?? name;
  if (name === "bed") {
    const color = extra.bedColor;
    if (color === void 0 || COLORS[color] === void 0) {
      warnings.push("bed without a readable colour became a white bed");
    }
    name = `${COLORS[color ?? 0] ?? "white"}_bed`;
    out.set("facing", BED_DIR[Number(take("direction"))] ?? "south");
    out.set("part", Number(take("head_piece_bit")) ? "head" : "foot");
    out.set("occupied", bool(take("occupied_bit")));
  } else if (name.endsWith("_stairs") && s.has("weirdo_direction")) {
    out.set("facing", STAIR_DIR[Number(take("weirdo_direction"))] ?? "east");
    out.set("half", Number(take("upside_down_bit")) ? "top" : "bottom");
    const corner = String(take("corner") ?? "none");
    out.set("shape", corner === "none" ? "straight" : corner);
  } else if (name.endsWith("_door") && s.has("upper_block_bit")) {
    out.set("facing", DOOR_TO_JAVA[String(take("cardinal_direction"))] ?? "north");
    out.set("half", Number(take("upper_block_bit")) ? "upper" : "lower");
    out.set("hinge", Number(take("door_hinge_bit")) ? "right" : "left");
    out.set("open", bool(take("open_bit")));
  } else if (name.endsWith("_double_slab")) {
    name = `${name.slice(0, -"_double_slab".length)}_slab`;
    out.set("type", "double");
    take("vertical_half");
  } else if (name.endsWith("_slab") && s.has("vertical_half")) {
    out.set("type", String(take("vertical_half")));
  } else if (name === "pale_moss_carpet") {
    for (const side of ["east", "north", "south", "west"]) {
      out.set(
        side,
        SIDE_TO_JAVA[String(take(`pale_moss_carpet_side_${side}`) ?? "none")] ?? "none"
      );
    }
    out.set("bottom", Number(take("upper_block_bit")) ? "false" : "true");
  } else if (name.endsWith("_shelf") && s.has("powered_shelf_type")) {
    out.set("facing", String(take("cardinal_direction")));
    out.set("powered", bool(take("powered_bit")));
    const chain = Number(take("powered_shelf_type"));
    out.set("side_chain", SHELF_CHAIN[chain] ?? "unconnected");
    if (chain !== 0) warnings.push(`${name}: side_chain value ${chain} is assumed, not verified`);
  }
  for (const side of ["north", "east", "south", "west"]) {
    if (s.has(`connection_${side}`)) out.set(side, bool(take(`connection_${side}`)));
    if (s.has(`wall_connection_type_${side}`)) {
      out.set(side, SIDE_TO_JAVA[String(take(`wall_connection_type_${side}`))] ?? "none");
    }
  }
  if (s.has("wall_post_bit")) out.set("up", bool(take("wall_post_bit")));
  if (s.has("pillar_axis")) out.set("axis", String(take("pillar_axis")));
  if (s.has("cardinal_direction")) out.set("facing", String(take("cardinal_direction")));
  if (s.has("facing_direction")) {
    out.set("facing", FACING_DIR[Number(take("facing_direction"))] ?? "north");
  }
  if (s.has("open_bit")) out.set("open", bool(take("open_bit")));
  if (s.has("powered_bit")) out.set("powered", bool(take("powered_bit")));
  if (s.has("button_pressed_bit")) out.set("powered", bool(take("button_pressed_bit")));
  if (s.has("in_wall_bit")) out.set("in_wall", bool(take("in_wall_bit")));
  for (const [k, v] of s) warnings.push(`${name}: dropped Bedrock state ${k}=${v}`);
  return { state: canonicalize(join(`minecraft:${name}`, out)), warnings };
}
var byte = (value) => ({ kind: "byte", value });
var int = (value) => ({ kind: "int", value });
var str = (value) => ({ kind: "string", value });
function javaToBedrock(canonical2) {
  const parse3 = parse(canonical2);
  const warnings = [];
  const p = new Map(parse3.props);
  const states = /* @__PURE__ */ new Map();
  const take = (key) => {
    const v = p.get(key);
    p.delete(key);
    return v;
  };
  const flag = (v) => v === "true" ? 1 : 0;
  let name = bare(parse3.name);
  let bedColor;
  const waterlogged = take("waterlogged") === "true";
  if (name.endsWith("_bed")) {
    const color = COLORS.indexOf(name.slice(0, -"_bed".length));
    if (color === -1) warnings.push(`${name}: unknown bed colour`);
    bedColor = Math.max(color, 0);
    name = "bed";
    states.set(
      "direction",
      int(Math.max(BED_DIR.indexOf(take("facing") ?? "south"), 0))
    );
    states.set("head_piece_bit", byte(take("part") === "head" ? 1 : 0));
    states.set("occupied_bit", byte(flag(take("occupied"))));
  } else if (name.endsWith("_stairs")) {
    states.set(
      "weirdo_direction",
      int(Math.max(STAIR_DIR.indexOf(take("facing") ?? "east"), 0))
    );
    states.set("upside_down_bit", byte(take("half") === "top" ? 1 : 0));
    const shape = take("shape") ?? "straight";
    states.set("minecraft:corner", str(shape === "straight" ? "none" : shape));
  } else if (name.endsWith("_door") && p.has("half")) {
    states.set(
      "minecraft:cardinal_direction",
      str(DOOR_TO_BEDROCK[take("facing") ?? "north"] ?? "north")
    );
    states.set("upper_block_bit", byte(take("half") === "upper" ? 1 : 0));
    states.set("door_hinge_bit", byte(take("hinge") === "right" ? 1 : 0));
    states.set("open_bit", byte(flag(take("open"))));
    take("powered");
  } else if (name.endsWith("_slab") && p.has("type")) {
    const type = take("type");
    if (type === "double") {
      name = `${name.slice(0, -"_slab".length)}_double_slab`;
      states.set("minecraft:vertical_half", str("bottom"));
    } else {
      states.set("minecraft:vertical_half", str(type ?? "bottom"));
    }
  } else if (name === "pale_moss_carpet") {
    for (const side of ["east", "north", "south", "west"]) {
      states.set(
        `pale_moss_carpet_side_${side}`,
        str(SIDE_TO_BEDROCK[take(side) ?? "none"] ?? "none")
      );
    }
    states.set("upper_block_bit", byte(take("bottom") === "false" ? 1 : 0));
  } else if (name.endsWith("_shelf") && p.has("side_chain")) {
    states.set("minecraft:cardinal_direction", str(take("facing") ?? "north"));
    states.set("powered_bit", byte(flag(take("powered"))));
    states.set(
      "powered_shelf_type",
      int(
        Math.max(
          SHELF_CHAIN.indexOf(
            take("side_chain") ?? "unconnected"
          ),
          0
        )
      )
    );
  }
  const isWall = name.endsWith("_wall");
  for (const side of ["north", "east", "south", "west"]) {
    const v = p.get(side);
    if (v === void 0) continue;
    p.delete(side);
    if (isWall) states.set(`wall_connection_type_${side}`, str(SIDE_TO_BEDROCK[v] ?? "none"));
    else states.set(`minecraft:connection_${side}`, int(flag(v)));
  }
  if (isWall && p.has("up")) states.set("wall_post_bit", byte(flag(take("up"))));
  const axis = take("axis");
  if (axis !== void 0) states.set("pillar_axis", str(axis));
  const facing = take("facing");
  if (facing !== void 0) {
    if (FACING_DIRECTION_BLOCKS.test(name)) {
      const i = FACING_DIR.indexOf(facing);
      states.set("facing_direction", int(i === -1 ? 0 : i));
    } else if (HORIZONTAL.has(facing)) {
      states.set("minecraft:cardinal_direction", str(facing));
    } else {
      warnings.push(`${name}: facing=${facing} has no Bedrock cardinal_direction`);
    }
  }
  const open = take("open");
  if (open !== void 0) states.set("open_bit", byte(flag(open)));
  const powered = take("powered");
  if (powered !== void 0 && !name.endsWith("_door"))
    states.set("powered_bit", byte(flag(powered)));
  const inWall = take("in_wall");
  if (inWall !== void 0) states.set("in_wall_bit", byte(flag(inWall)));
  const DEFAULTS = /* @__PURE__ */ new Map([
    ["lit", "false"],
    ["type", "single"],
    ["powered", "false"],
    ["side_chain", "unconnected"]
  ]);
  for (const [k, v] of p) {
    if (DEFAULTS.get(k) !== v)
      warnings.push(`${bare(parse3.name)}: dropped Java property ${k}=${v}`);
  }
  return {
    block: { name: withNs(NAME_TO_BEDROCK[name] ?? name), states },
    bedColor,
    waterlogged,
    warnings
  };
}

// packages/core/src/nbt/types.ts
var TagId = {
  End: 0,
  Byte: 1,
  Short: 2,
  Int: 3,
  Long: 4,
  Float: 5,
  Double: 6,
  ByteArray: 7,
  String: 8,
  List: 9,
  Compound: 10,
  IntArray: 11,
  LongArray: 12
};
var NbtError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "NbtError";
  }
};
var TYPE_TO_ID = {
  byte: TagId.Byte,
  short: TagId.Short,
  int: TagId.Int,
  long: TagId.Long,
  float: TagId.Float,
  double: TagId.Double,
  byteArray: TagId.ByteArray,
  string: TagId.String,
  list: TagId.List,
  compound: TagId.Compound,
  intArray: TagId.IntArray,
  longArray: TagId.LongArray
};
function tagId(tag) {
  return TYPE_TO_ID[tag.type];
}
var byte2 = (value) => ({ type: "byte", value });
var short = (value) => ({ type: "short", value });
var int2 = (value) => ({ type: "int", value });
var long = (value) => ({ type: "long", value });
var float = (value) => ({ type: "float", value });
var double = (value) => ({ type: "double", value });
var string = (value) => ({ type: "string", value });
var byteArray = (value) => ({ type: "byteArray", value });
var intArray = (value) => ({ type: "intArray", value });
var longArray = (value) => ({ type: "longArray", value });
function list(elementType, value) {
  return { type: "list", elementType, value };
}
function compound(entries2 = []) {
  return { type: "compound", value: new Map(entries2) };
}

// packages/core/src/nbt/mutf8.ts
function encodeMutf8(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c !== 0 && c < 128) {
      out.push(c);
    } else if (c < 2048) {
      out.push(192 | c >> 6, 128 | c & 63);
    } else {
      out.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
    }
  }
  return Uint8Array.from(out);
}
function decodeMutf8(bytes) {
  const units = [];
  let i = 0;
  const cont = (k) => {
    const b = bytes[k];
    if (b === void 0 || (b & 192) !== 128) {
      throw new NbtError("invalid modified UTF-8 sequence");
    }
    return b & 63;
  };
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 128) {
      units.push(b);
      i += 1;
    } else if ((b & 224) === 192) {
      units.push((b & 31) << 6 | cont(i + 1));
      i += 2;
    } else if ((b & 240) === 224) {
      units.push((b & 15) << 12 | cont(i + 1) << 6 | cont(i + 2));
      i += 3;
    } else if ((b & 248) === 240) {
      const cp = (b & 7) << 18 | cont(i + 1) << 12 | cont(i + 2) << 6 | cont(i + 3);
      if (cp < 65536 || cp > 1114111) throw new NbtError("invalid modified UTF-8 sequence");
      const v = cp - 65536;
      units.push(55296 | v >> 10, 56320 | v & 1023);
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

// packages/core/src/nbt/reader.ts
var MAX_DEPTH = 512;
var Cursor = class {
  view;
  bytes;
  little;
  pos = 0;
  constructor(bytes, little) {
    this.bytes = bytes;
    this.little = little;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  need(n2) {
    if (n2 < 0 || this.pos + n2 > this.bytes.length) {
      throw new NbtError("unexpected end of NBT data");
    }
  }
  u8() {
    this.need(1);
    return this.view.getUint8(this.pos++);
  }
  i8() {
    this.need(1);
    return this.view.getInt8(this.pos++);
  }
  i16() {
    this.need(2);
    const v = this.view.getInt16(this.pos, this.little);
    this.pos += 2;
    return v;
  }
  u16() {
    this.need(2);
    const v = this.view.getUint16(this.pos, this.little);
    this.pos += 2;
    return v;
  }
  i32() {
    this.need(4);
    const v = this.view.getInt32(this.pos, this.little);
    this.pos += 4;
    return v;
  }
  i64() {
    this.need(8);
    const v = this.view.getBigInt64(this.pos, this.little);
    this.pos += 8;
    return v;
  }
  f32() {
    this.need(4);
    const v = this.view.getFloat32(this.pos, this.little);
    this.pos += 4;
    return v;
  }
  f64() {
    this.need(8);
    const v = this.view.getFloat64(this.pos, this.little);
    this.pos += 8;
    return v;
  }
  take(n2) {
    this.need(n2);
    const out = this.bytes.subarray(this.pos, this.pos + n2);
    this.pos += n2;
    return out;
  }
  str() {
    return decodeMutf8(this.take(this.u16()));
  }
  length() {
    const n2 = this.i32();
    if (n2 < 0) throw new NbtError(`negative array length ${n2}`);
    return n2;
  }
};
function readPayload(c, id, depth) {
  if (depth > MAX_DEPTH) throw new NbtError("NBT nesting too deep");
  switch (id) {
    case TagId.Byte:
      return { type: "byte", value: c.i8() };
    case TagId.Short:
      return { type: "short", value: c.i16() };
    case TagId.Int:
      return { type: "int", value: c.i32() };
    case TagId.Long:
      return { type: "long", value: c.i64() };
    case TagId.Float:
      return { type: "float", value: c.f32() };
    case TagId.Double:
      return { type: "double", value: c.f64() };
    case TagId.ByteArray: {
      const n2 = c.length();
      const raw = c.take(n2);
      return { type: "byteArray", value: new Int8Array(raw.slice().buffer) };
    }
    case TagId.String:
      return { type: "string", value: c.str() };
    case TagId.List: {
      const elementType = c.u8();
      const n2 = c.length();
      if (!isTagId(elementType)) throw new NbtError(`unknown list element type ${elementType}`);
      if (elementType === TagId.End && n2 > 0) {
        throw new NbtError("non-empty list of TAG_End");
      }
      const value = [];
      for (let i = 0; i < n2; i++) value.push(readPayload(c, elementType, depth + 1));
      return { type: "list", elementType, value };
    }
    case TagId.Compound: {
      const value = /* @__PURE__ */ new Map();
      for (; ; ) {
        const childId = c.u8();
        if (childId === TagId.End) break;
        if (!isTagId(childId)) throw new NbtError(`unknown tag type ${childId}`);
        const name = c.str();
        value.set(name, readPayload(c, childId, depth + 1));
      }
      return { type: "compound", value };
    }
    case TagId.IntArray: {
      const n2 = c.length();
      c.need(n2 * 4);
      const out = new Int32Array(n2);
      for (let i = 0; i < n2; i++) out[i] = c.i32();
      return { type: "intArray", value: out };
    }
    case TagId.LongArray: {
      const n2 = c.length();
      c.need(n2 * 8);
      const out = new BigInt64Array(n2);
      for (let i = 0; i < n2; i++) out[i] = c.i64();
      return { type: "longArray", value: out };
    }
    default:
      throw new NbtError(`unknown tag type ${id}`);
  }
}
function isTagId(n2) {
  return Number.isInteger(n2) && n2 >= 0 && n2 <= TagId.LongArray;
}
function readNbt(bytes, options = {}) {
  const c = new Cursor(bytes, options.endian === "little");
  const id = c.u8();
  if (id !== TagId.Compound) {
    throw new NbtError(`root tag must be a compound, found type ${id}`);
  }
  const name = c.str();
  const tag = readPayload(c, TagId.Compound, 0);
  return { name, tag };
}

// packages/core/src/nbt/writer.ts
var Sink = class {
  buf = new Uint8Array(256);
  view = new DataView(this.buf.buffer);
  len = 0;
  little;
  constructor(little) {
    this.little = little;
  }
  grow(n2) {
    if (this.len + n2 <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n2) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
    this.view = new DataView(next.buffer);
  }
  u8(v) {
    this.grow(1);
    this.view.setUint8(this.len++, v);
  }
  i8(v) {
    this.grow(1);
    this.view.setInt8(this.len++, v);
  }
  i16(v) {
    this.grow(2);
    this.view.setInt16(this.len, v, this.little);
    this.len += 2;
  }
  u16(v) {
    this.grow(2);
    this.view.setUint16(this.len, v, this.little);
    this.len += 2;
  }
  i32(v) {
    this.grow(4);
    this.view.setInt32(this.len, v, this.little);
    this.len += 4;
  }
  i64(v) {
    this.grow(8);
    this.view.setBigInt64(this.len, v, this.little);
    this.len += 8;
  }
  f32(v) {
    this.grow(4);
    this.view.setFloat32(this.len, v, this.little);
    this.len += 4;
  }
  f64(v) {
    this.grow(8);
    this.view.setFloat64(this.len, v, this.little);
    this.len += 8;
  }
  raw(b) {
    this.grow(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }
  str(s) {
    const b = encodeMutf8(s);
    if (b.length > 65535) throw new NbtError("string too long for NBT");
    this.u16(b.length);
    this.raw(b);
  }
  bytes() {
    return this.buf.slice(0, this.len);
  }
};
function writePayload(s, tag) {
  switch (tag.type) {
    case "byte":
      s.i8(tag.value);
      return;
    case "short":
      s.i16(tag.value);
      return;
    case "int":
      s.i32(tag.value);
      return;
    case "long":
      s.i64(tag.value);
      return;
    case "float":
      s.f32(tag.value);
      return;
    case "double":
      s.f64(tag.value);
      return;
    case "byteArray":
      s.i32(tag.value.length);
      s.raw(new Uint8Array(tag.value.buffer, tag.value.byteOffset, tag.value.byteLength));
      return;
    case "string":
      s.str(tag.value);
      return;
    case "list":
      s.u8(tag.elementType);
      s.i32(tag.value.length);
      for (const el of tag.value) {
        if (tagId(el) !== tag.elementType) {
          throw new NbtError(`list of type ${tag.elementType} holds a ${el.type} tag`);
        }
        writePayload(s, el);
      }
      return;
    case "compound":
      for (const [name, child2] of tag.value) {
        s.u8(tagId(child2));
        s.str(name);
        writePayload(s, child2);
      }
      s.u8(TagId.End);
      return;
    case "intArray":
      s.i32(tag.value.length);
      for (const v of tag.value) s.i32(v);
      return;
    case "longArray":
      s.i32(tag.value.length);
      for (const v of tag.value) s.i64(v);
      return;
  }
}
function writeNbt(root, options = {}) {
  const s = new Sink(options.endian === "little");
  s.u8(TagId.Compound);
  s.str(root.name);
  writePayload(s, root.tag);
  return s.bytes();
}

// packages/core/src/nbt/gzip.ts
async function pipe(bytes, stream) {
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
  const out = source.pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
function isGzip(bytes) {
  return bytes.length >= 2 && bytes[0] === 31 && bytes[1] === 139;
}
function gzip(bytes) {
  return pipe(bytes, new CompressionStream("gzip"));
}
function gunzip(bytes) {
  return pipe(bytes, new DecompressionStream("gzip"));
}
async function readNbtFile(bytes, options = {}) {
  return readNbt(isGzip(bytes) ? await gunzip(bytes) : bytes, options);
}
async function writeNbtGzip(root, options = {}) {
  return gzip(writeNbt(root, options));
}

// packages/core/src/nbt/util.ts
function cloneNbt(tag) {
  switch (tag.type) {
    case "byteArray":
      return { type: "byteArray", value: tag.value.slice() };
    case "intArray":
      return { type: "intArray", value: tag.value.slice() };
    case "longArray":
      return { type: "longArray", value: tag.value.slice() };
    case "list":
      return {
        type: "list",
        elementType: tag.elementType,
        value: tag.value.map((v) => cloneNbt(v))
      };
    case "compound": {
      const value = /* @__PURE__ */ new Map();
      for (const [k, v] of tag.value) value.set(k, cloneNbt(v));
      return { type: "compound", value };
    }
    default:
      return { ...tag };
  }
}
function nbtEqual(a, b) {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "byte":
    case "short":
    case "int":
    case "float":
    case "double":
      return Object.is(a.value, b.value);
    case "long":
    case "string":
      return a.value === b.value;
    case "byteArray":
    case "intArray":
    case "longArray": {
      const bv = b.value;
      const av = a.value;
      if (av.length !== bv.length) return false;
      for (let i = 0; i < av.length; i++) if (av[i] !== bv[i]) return false;
      return true;
    }
    case "list": {
      const other = b;
      if (a.value.length !== other.value.length) return false;
      if (a.value.length > 0 && a.elementType !== other.elementType) return false;
      return a.value.every((v, i) => nbtEqual(v, other.value[i]));
    }
    case "compound": {
      const other = b.value;
      if (a.value.size !== other.size) return false;
      for (const [k, v] of a.value) {
        const w = other.get(k);
        if (w === void 0 || !nbtEqual(v, w)) return false;
      }
      return true;
    }
  }
}

// packages/core/src/volume/entity.ts
function blockIdOf(block) {
  const a = block.indexOf("[");
  const b = block.indexOf("{");
  const end = a === -1 ? b : b === -1 ? a : Math.min(a, b);
  return end === -1 ? block : block.slice(0, end);
}
function entityPosition(nbt) {
  const pos = nbt.value.get("Pos");
  if (pos?.type !== "list" || pos.value.length !== 3) return void 0;
  const out = [];
  for (const v of pos.value) {
    if (v.type !== "double" && v.type !== "float") return void 0;
    out.push(v.value);
  }
  return out;
}
function positionTag(edition, x, y, z) {
  const num = (v) => edition === "java" ? { type: "double", value: v } : { type: "float", value: Math.fround(v) };
  return {
    type: "list",
    elementType: edition === "java" ? TagId.Double : TagId.Float,
    value: [num(x), num(y), num(z)]
  };
}
function shiftEntity(e, dx, dy, dz) {
  const pos = e.nbt.value.get("Pos");
  if (pos?.type !== "list" || pos.value.length !== 3 || dx === 0 && dy === 0 && dz === 0) {
    return e;
  }
  const d = [dx, dy, dz];
  const moved = pos.value.map((v, i) => {
    const delta = d[i];
    if (v.type === "double") return { type: "double", value: v.value + delta };
    if (v.type === "float") return { type: "float", value: Math.fround(v.value + delta) };
    return v;
  });
  const value = new Map(e.nbt.value);
  value.set("Pos", { type: "list", elementType: pos.elementType, value: moved });
  return { edition: e.edition, nbt: { type: "compound", value } };
}

// packages/core/src/volume/volume.ts
var AIR = "minecraft:air";
var MAX_EXTENT = 512;
var UNSET = -1;
var SECTION_BITS = 4;
var SECTION_SIZE = 1 << SECTION_BITS;
var SECTION_MASK = SECTION_SIZE - 1;
var SECTION_VOLUME = SECTION_SIZE ** 3;
var Section = class {
  data = new Int32Array(SECTION_VOLUME).fill(UNSET);
  count = 0;
};
var VolumeError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "VolumeError";
  }
};
function checkCoord(axis, v) {
  if (!Number.isSafeInteger(v) || Math.abs(v) > 2147483647) {
    throw new VolumeError(`axis ${axis}: coordinate ${v} is not a 32-bit integer`);
  }
}
var sectionKey = (sx, sy, sz) => `${sx},${sy},${sz}`;
var cellIndex = (x, y, z) => (y & SECTION_MASK) << 8 | (z & SECTION_MASK) << 4 | x & SECTION_MASK;
var blockEntityKey = (x, y, z) => `${x},${y},${z}`;
function parseBlockEntityKey(key) {
  const p = key.split(",").map(Number);
  return [p[0], p[1], p[2]];
}
var Volume = class {
  sections = /* @__PURE__ */ new Map();
  paletteList = [];
  paletteIndex = /* @__PURE__ */ new Map();
  cellCount = 0;
  // Cached bounding box of the set cells (air included). Exact whenever
  // `boundsStale` is false and cellCount > 0. A set that adds a cell widens
  // it; an unset of a cell on one of its faces may shrink it, so that marks
  // it stale and the next placedBounds() rescans. Every path that changes
  // which cells are set goes through put(), unset() or translate().
  minX = 0;
  minY = 0;
  minZ = 0;
  maxX = 0;
  maxY = 0;
  maxZ = 0;
  boundsStale = false;
  blockEntityMap = /* @__PURE__ */ new Map();
  entityList = [];
  /** The interned palette, in the order blocks were first set. */
  get palette() {
    return this.paletteList;
  }
  /** Number of cells that have been set, air included. */
  get size() {
    return this.cellCount;
  }
  /** Block entities by cell, keyed `"x,y,z"`. Do not modify the map; use the methods. */
  get blockEntities() {
    return this.blockEntityMap;
  }
  /** Number of block entities held. */
  get blockEntityCount() {
    return this.blockEntityMap.size;
  }
  /** Entities, in the order they were added. */
  get entities() {
    return this.entityList;
  }
  /** The block entity at a cell, if any. */
  blockEntityAt(x, y, z) {
    if (this.blockEntityMap.size === 0) return void 0;
    return this.blockEntityMap.get(blockEntityKey(x, y, z));
  }
  /**
   * Attach a block entity to a cell, replacing any it had. The cell must hold
   * a block (set it first).
   */
  setBlockEntity(x, y, z, entity) {
    if (this.indexAt(x, y, z) === UNSET) {
      throw new VolumeError(`cannot attach a block entity to unset cell ${x},${y},${z}`);
    }
    this.blockEntityMap.set(blockEntityKey(x, y, z), entity);
  }
  /** Remove the block entity at a cell. Returns whether there was one. */
  deleteBlockEntity(x, y, z) {
    if (this.blockEntityMap.size === 0) return false;
    return this.blockEntityMap.delete(blockEntityKey(x, y, z));
  }
  /** Visit every block entity with its cell. */
  eachBlockEntity(fn) {
    for (const [key, entity] of this.blockEntityMap) {
      const [x, y, z] = parseBlockEntityKey(key);
      fn(x, y, z, entity);
    }
  }
  /** Add an entity. Its `Pos` is in volume coordinates. */
  addEntity(entity) {
    this.entityList.push(entity);
  }
  /** Replace the whole entity list. */
  setEntities(entities) {
    this.entityList = [...entities];
  }
  /** Add `block` to the palette if needed and return its index. */
  intern(block) {
    let idx = this.paletteIndex.get(block);
    if (idx === void 0) {
      idx = this.paletteList.length;
      this.paletteList.push(block);
      this.paletteIndex.set(block, idx);
    }
    return idx;
  }
  /** Set a cell. The last write wins. `block` should be a canonical block string. */
  set(x, y, z, block) {
    checkCoord("x", x);
    checkCoord("y", y);
    checkCoord("z", z);
    this.put(x, y, z, this.intern(block));
  }
  /**
   * Set a cell by palette index, or make it unset with {@link UNSET}. The
   * index must come from this volume's palette (it never shrinks, so an
   * index stays valid for the life of the volume).
   */
  setIndex(x, y, z, index) {
    if (index === UNSET) {
      this.unset(x, y, z);
      return;
    }
    if (!Number.isInteger(index) || index < 0 || index >= this.paletteList.length) {
      throw new VolumeError(`palette index ${index} is out of range`);
    }
    checkCoord("x", x);
    checkCoord("y", y);
    checkCoord("z", z);
    this.put(x, y, z, index);
  }
  put(x, y, z, idx) {
    const sx = x >> SECTION_BITS;
    const sy = y >> SECTION_BITS;
    const sz = z >> SECTION_BITS;
    const key = sectionKey(sx, sy, sz);
    let entry = this.sections.get(key);
    if (entry === void 0) {
      entry = { sx, sy, sz, s: new Section() };
      this.sections.set(key, entry);
    }
    const i = cellIndex(x, y, z);
    const prev = entry.s.data[i];
    if (prev === UNSET) {
      if (this.cellCount === 0) {
        this.minX = this.maxX = x;
        this.minY = this.maxY = y;
        this.minZ = this.maxZ = z;
        this.boundsStale = false;
      } else if (!this.boundsStale) {
        if (x < this.minX) this.minX = x;
        else if (x > this.maxX) this.maxX = x;
        if (y < this.minY) this.minY = y;
        else if (y > this.maxY) this.maxY = y;
        if (z < this.minZ) this.minZ = z;
        else if (z > this.maxZ) this.maxZ = z;
      }
      entry.s.count++;
      this.cellCount++;
    } else if (prev !== idx && this.blockEntityMap.size > 0) {
      const key2 = blockEntityKey(x, y, z);
      if (this.blockEntityMap.has(key2) && blockIdOf(this.paletteList[prev]) !== blockIdOf(this.paletteList[idx])) {
        this.blockEntityMap.delete(key2);
      }
    }
    entry.s.data[i] = idx;
  }
  /** Make a cell unset again. Returns whether it held a value. */
  unset(x, y, z) {
    const entry = this.sections.get(
      sectionKey(x >> SECTION_BITS, y >> SECTION_BITS, z >> SECTION_BITS)
    );
    if (entry === void 0) return false;
    const i = cellIndex(x, y, z);
    if (entry.s.data[i] === UNSET) return false;
    entry.s.data[i] = UNSET;
    entry.s.count--;
    this.cellCount--;
    if (this.cellCount === 0) {
      this.boundsStale = false;
    } else if (!this.boundsStale && (x === this.minX || x === this.maxX || y === this.minY || y === this.maxY || z === this.minZ || z === this.maxZ)) {
      this.boundsStale = true;
    }
    if (this.blockEntityMap.size > 0) this.blockEntityMap.delete(blockEntityKey(x, y, z));
    return true;
  }
  /**
   * Move every set cell, block entity and entity by `(dx, dy, dz)` in place.
   * The palette is kept.
   */
  translate(dx, dy, dz) {
    if (dx === 0 && dy === 0 && dz === 0) return;
    const cells = [];
    this.eachCell((x, y, z, idx) => {
      cells.push([x + dx, y + dy, z + dz, idx]);
    });
    const entities = [];
    this.eachBlockEntity((x, y, z, e) => {
      entities.push([x + dx, y + dy, z + dz, e]);
    });
    this.sections.clear();
    this.blockEntityMap.clear();
    this.cellCount = 0;
    this.boundsStale = false;
    for (const [x, y, z, idx] of cells) this.set(x, y, z, this.paletteList[idx]);
    for (const [x, y, z, e] of entities) this.blockEntityMap.set(blockEntityKey(x, y, z), e);
    this.entityList = this.entityList.map((e) => shiftEntity(e, dx, dy, dz));
  }
  /** Palette index at a cell, or {@link UNSET}. */
  indexAt(x, y, z) {
    const entry = this.sections.get(
      sectionKey(x >> SECTION_BITS, y >> SECTION_BITS, z >> SECTION_BITS)
    );
    return entry === void 0 ? UNSET : entry.s.data[cellIndex(x, y, z)];
  }
  /** Block string at a cell, or `undefined` when it was never set. */
  get(x, y, z) {
    const idx = this.indexAt(x, y, z);
    return idx === UNSET ? void 0 : this.paletteList[idx];
  }
  /** Visit every set cell. Order is by section, not by coordinate. */
  eachCell(fn) {
    for (const { sx, sy, sz, s } of this.sections.values()) {
      if (s.count === 0) continue;
      for (let i = 0; i < SECTION_VOLUME; i++) {
        const idx = s.data[i];
        if (idx === UNSET) continue;
        fn(
          sx << SECTION_BITS | i & SECTION_MASK,
          sy << SECTION_BITS | i >> 8,
          sz << SECTION_BITS | i >> 4 & SECTION_MASK,
          idx
        );
      }
    }
  }
  boundsWhere(include) {
    let min = null;
    let max = null;
    this.eachCell((x, y, z, idx) => {
      if (!include(idx)) return;
      if (min === null || max === null) {
        min = [x, y, z];
        max = [x, y, z];
        return;
      }
      if (x < min[0]) min[0] = x;
      if (y < min[1]) min[1] = y;
      if (z < min[2]) min[2] = z;
      if (x > max[0]) max[0] = x;
      if (y > max[1]) max[1] = y;
      if (z > max[2]) max[2] = z;
    });
    return min === null || max === null ? null : [min, max];
  }
  /** Inclusive bounding box over every set cell, air included, or `null` when empty. */
  placedBounds() {
    if (this.cellCount === 0) return null;
    if (this.boundsStale) {
      const b = this.boundsWhere(() => true);
      if (b === null) return null;
      [this.minX, this.minY, this.minZ] = b[0];
      [this.maxX, this.maxY, this.maxZ] = b[1];
      this.boundsStale = false;
    }
    return [
      [this.minX, this.minY, this.minZ],
      [this.maxX, this.maxY, this.maxZ]
    ];
  }
  /** Inclusive bounding box over non-air cells, or `null` when there are none. */
  bounds() {
    return this.boundsWhere((idx) => this.paletteList[idx] !== AIR);
  }
  /** Number of set cells whose block is not `minecraft:air`. */
  countNonAir() {
    let n2 = 0;
    this.eachCell((_x, _y, _z, idx) => {
      if (this.paletteList[idx] !== AIR) n2++;
    });
    return n2;
  }
  /**
   * Materialize the placed region (see {@link placedBounds}) as a dense
   * array. The palette is compacted to the entries some cell references, in
   * their original order. An empty volume gives a 0x0x0 array.
   */
  toDense() {
    const bb = this.placedBounds();
    if (bb === null) {
      return { size: [0, 0, 0], origin: [0, 0, 0], data: new Int32Array(0), palette: [] };
    }
    const [min, max] = bb;
    const sx = max[0] - min[0] + 1;
    const sy = max[1] - min[1] + 1;
    const sz = max[2] - min[2] + 1;
    const total2 = sx * sy * sz;
    if (total2 > 2147483647)
      throw new VolumeError(`volume ${sx}x${sy}x${sz} is too large to densify`);
    const data = new Int32Array(total2).fill(UNSET);
    const used = new Uint8Array(this.paletteList.length);
    this.eachCell((x, y, z, idx) => {
      data[((x - min[0]) * sy + (y - min[1])) * sz + (z - min[2])] = idx;
      used[idx] = 1;
    });
    const remap = new Int32Array(this.paletteList.length).fill(UNSET);
    const palette = [];
    for (let i = 0; i < used.length; i++) {
      if (used[i]) {
        remap[i] = palette.length;
        palette.push(this.paletteList[i]);
      }
    }
    if (palette.length !== this.paletteList.length) {
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (v !== UNSET) data[i] = remap[v];
      }
    }
    return { size: [sx, sy, sz], origin: min, data, palette };
  }
};

// packages/core/src/codecs/common.ts
var CodecError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "CodecError";
  }
};
var AIR_BLOCKS = /* @__PURE__ */ new Set([
  "minecraft:air",
  "minecraft:cave_air",
  "minecraft:void_air"
]);
var SKIP_BLOCKS = /* @__PURE__ */ new Set([
  "minecraft:structure_void",
  "minecraft:structure_block",
  "minecraft:jigsaw"
]);
function checkExtent(size, options) {
  const limit = options.maxExtent ?? MAX_EXTENT;
  if (size.some((n2) => n2 > limit)) {
    throw new CodecError(
      `this build is ${size[0]} x ${size[1]} x ${size[2]}; the limit is ${limit} blocks per axis`
    );
  }
}
function child(tag, name) {
  return tag.value.get(name);
}
function asCompound(tag, what) {
  if (tag?.type !== "compound") throw new CodecError(`${what} must be a compound`);
  return tag;
}
function asNumber(tag, what) {
  if (tag === void 0) throw new CodecError(`${what} is missing`);
  if (tag.type === "byte" || tag.type === "short" || tag.type === "int") return tag.value;
  throw new CodecError(`${what} must be an integer tag, found ${tag.type}`);
}

// packages/core/src/codecs/carry.ts
var POSITION_KEYS = /* @__PURE__ */ new Set(["x", "y", "z"]);
function entriesWithout(tag, skip) {
  return [...tag.value].filter(([k]) => !skip.has(k));
}
function kindOf(tag) {
  if (tag?.type !== "string" || tag.value === "") return "unknown";
  return tag.value.startsWith("minecraft:") ? tag.value.slice(10) : tag.value;
}
var Tally = class {
  blocks = /* @__PURE__ */ new Map();
  mobs = /* @__PURE__ */ new Map();
  addBlockEntity(kind) {
    this.blocks.set(kind, (this.blocks.get(kind) ?? 0) + 1);
  }
  addEntity(kind) {
    this.mobs.set(kind, (this.mobs.get(kind) ?? 0) + 1);
  }
  get blockEntityCount() {
    let n2 = 0;
    for (const c of this.blocks.values()) n2 += c;
    return n2;
  }
  get entityCount() {
    let n2 = 0;
    for (const c of this.mobs.values()) n2 += c;
    return n2;
  }
  /** One line per non-empty count, such as `2 block entities not carried over (why): chest x2`. */
  lines(why) {
    const out = [];
    const describe = (counts, one, many) => {
      let total2 = 0;
      for (const c of counts.values()) total2 += c;
      if (total2 === 0) return;
      const kinds = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([k, c]) => `${k} x${c}`).join(", ");
      out.push(`${total2} ${total2 === 1 ? one : many} not carried over (${why}): ${kinds}`);
    };
    describe(this.blocks, "block entity", "block entities");
    describe(this.mobs, "entity", "entities");
    return out;
  }
};
var bareName = (name) => name.startsWith("minecraft:") ? name.slice(10) : name;
function describeCounts(counts) {
  return [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([k, c]) => `${k} x${c}`).join(", ");
}
function classifyBlock(name) {
  if (SKIP_BLOCKS.has(name)) return "skip";
  return AIR_BLOCKS.has(name) ? "air" : "block";
}
var BlockTally = class {
  skipped = /* @__PURE__ */ new Map();
  air = /* @__PURE__ */ new Map();
  /**
   * Classify a block read from a file by its name (no properties) and count
   * it if it is dropped or rewritten. Nothing is counted for plain
   * `minecraft:air`.
   */
  note(name) {
    const kind = classifyBlock(name);
    const bare2 = bareName(name);
    if (kind === "skip") this.skipped.set(bare2, (this.skipped.get(bare2) ?? 0) + 1);
    else if (kind === "air" && name !== "minecraft:air") {
      this.air.set(bare2, (this.air.get(bare2) ?? 0) + 1);
    }
    return kind;
  }
  /** One line per non-empty count. */
  lines() {
    const out = [];
    const describe = (counts, why, verb) => {
      let total2 = 0;
      for (const c of counts.values()) total2 += c;
      if (total2 === 0) return;
      out.push(
        `${total2} ${total2 === 1 ? "block" : "blocks"} ${verb} (${why}): ${describeCounts(counts)}`
      );
    };
    describe(this.skipped, "editor leftovers that are not part of a build", "not carried over");
    describe(this.air, "cave_air and void_air are not kept", "turned into air");
    return out;
  }
};
function attachBlockEntity(volume, x, y, z, entity, lost, kind) {
  if (volume.indexAt(x, y, z) < 0) lost.addBlockEntity(kind);
  else volume.setBlockEntity(x, y, z, entity);
}
var blockEntityKind = (e) => kindOf(e.nbt.value.get("id"));
var entityKind = (e) => kindOf(e.nbt.value.get(e.edition === "java" ? "id" : "identifier") ?? e.nbt.value.get("id"));
function foreignLines(volume, target, skip = () => false) {
  const tally = new Tally();
  volume.eachBlockEntity((x, y, z, e) => {
    if (e.edition !== target && !skip(x, y, z, e)) tally.addBlockEntity(blockEntityKind(e));
  });
  for (const e of volume.entities) if (e.edition !== target) tally.addEntity(entityKind(e));
  return tally.lines(
    target === "java" ? "Bedrock NBT cannot be translated to Java" : "Java NBT cannot be translated to Bedrock"
  );
}

// packages/core/src/codecs/litematic.ts
function bitsFor(paletteSize) {
  return Math.max(2, 32 - Math.clz32(Math.max(paletteSize - 1, 1)));
}
function unpack(words, bits, count) {
  const needed = Math.ceil(count * bits / 64);
  if (words.length < needed) {
    throw new CodecError(`BlockStates holds ${words.length} longs; ${needed} are needed`);
  }
  const mask = (1n << BigInt(bits)) - 1n;
  const out = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const start = i * bits;
    const wi = Math.floor(start / 64);
    const off = BigInt(start % 64);
    let v = BigInt.asUintN(64, words[wi]) >> off;
    if (off + BigInt(bits) > 64n) {
      v |= BigInt.asUintN(64, words[wi + 1]) << 64n - off;
    }
    out[i] = Number(v & mask);
  }
  return out;
}
function pack(values, bits) {
  const words = new BigInt64Array(Math.ceil(values.length * bits / 64));
  const mask = (1n << BigInt(bits)) - 1n;
  for (let i = 0; i < values.length; i++) {
    const v = BigInt(values[i]) & mask;
    const start = i * bits;
    const wi = Math.floor(start / 64);
    const off = BigInt(start % 64);
    words[wi] = BigInt.asIntN(64, BigInt.asUintN(64, words[wi]) | v << off);
    if (off + BigInt(bits) > 64n) {
      words[wi + 1] = BigInt.asIntN(
        64,
        BigInt.asUintN(64, words[wi + 1]) | v >> 64n - off
      );
    }
  }
  return words;
}
function xyz(tag, what) {
  const c = asCompound(tag, what);
  return [
    asNumber(child(c, "x"), `${what}.x`),
    asNumber(child(c, "y"), `${what}.y`),
    asNumber(child(c, "z"), `${what}.z`)
  ];
}
function paletteState(entry) {
  const e = asCompound(entry, "palette entry");
  const nameTag = child(e, "Name") ?? child(e, "id");
  if (nameTag?.type !== "string") throw new CodecError("palette entry has no Name");
  const props = /* @__PURE__ */ new Map();
  const p = child(e, "Properties") ?? child(e, "properties");
  if (p !== void 0) {
    for (const [k, v] of asCompound(p, "Properties").value) {
      props.set(k, v.type === "string" ? v.value : String(v.value));
    }
  }
  return canonicalize(join(nameTag.value, props));
}
function regionBox(name, regionTag) {
  const region = asCompound(regionTag, `region ${name}`);
  const pos = xyz(child(region, "Position"), "Position");
  const size = xyz(child(region, "Size"), "Size");
  const abs = size.map(Math.abs);
  const min = pos.map((p, i) => p + Math.min(0, size[i] + 1));
  return { min, abs, region };
}
function metadataString(root, key) {
  const meta = child(root, "Metadata");
  const v = meta?.type === "compound" ? child(meta, key) : void 0;
  return v?.type === "string" ? v.value : null;
}
async function readLitematic(bytes, options = {}) {
  let root;
  try {
    root = (await readNbtFile(bytes)).tag;
  } catch (e) {
    throw new CodecError(`not a readable NBT file (${e instanceof Error ? e.message : String(e)})`);
  }
  const version = asNumber(child(root, "Version"), "Version");
  if (version < 5 || version > 7) {
    throw new CodecError(`unsupported litematic version ${version} (expected 5 to 7)`);
  }
  const regions = asCompound(child(root, "Regions"), "Regions");
  let lo = null;
  let hi = null;
  for (const [name, regionTag] of regions.value) {
    const { min, abs } = regionBox(name, regionTag);
    if (abs[0] * abs[1] * abs[2] === 0) continue;
    lo ??= [...min];
    hi ??= [...min];
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], min[a]);
      hi[a] = Math.max(hi[a], min[a] + abs[a] - 1);
    }
  }
  if (lo !== null && hi !== null) {
    checkExtent([hi[0] - lo[0] + 1, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1], options);
  }
  const lost = new Tally();
  const dropped = new BlockTally();
  const warnings = [];
  let ticks = 0;
  const read2 = [];
  for (const [name, regionTag] of regions.value) {
    const { min, abs, region } = regionBox(name, regionTag);
    const total2 = abs[0] * abs[1] * abs[2];
    const tileEntities = child(region, "TileEntities");
    const entities = child(region, "Entities");
    for (const key of ["PendingBlockTicks", "PendingFluidTicks"]) {
      const t = child(region, key);
      if (t?.type === "list") ticks += t.value.length;
    }
    if (total2 === 0) {
      for (const t of tileEntities?.type === "list" ? tileEntities.value : []) {
        lost.addBlockEntity(t.type === "compound" ? kindOf(child(t, "id")) : "unknown");
      }
      for (const t of entities?.type === "list" ? entities.value : []) {
        lost.addEntity(t.type === "compound" ? kindOf(child(t, "id")) : "unknown");
      }
      continue;
    }
    if (total2 > 2147483647) throw new CodecError(`region ${name} is too large`);
    const paletteTag = child(region, "BlockStatePalette");
    if (paletteTag?.type !== "list")
      throw new CodecError(`region ${name} has no BlockStatePalette`);
    const palette = paletteTag.value.map(paletteState);
    const statesTag = child(region, "BlockStates");
    if (statesTag?.type !== "longArray") throw new CodecError(`region ${name} has no BlockStates`);
    const idx = unpack(statesTag.value, bitsFor(palette.length), total2);
    const [w, , l] = abs;
    const kept = (i, count = false) => {
      const state = palette[idx[i]];
      if (state === void 0)
        throw new CodecError(`region ${name} uses palette index ${idx[i]} outside its palette`);
      const base = state.split("[", 1)[0];
      const kind = count ? dropped.note(base) : classifyBlock(base);
      if (kind === "skip") return void 0;
      if (kind === "air" && !options.keepAir) return void 0;
      return kind === "air" ? AIR : state;
    };
    const r = { blocks: [], blockEntities: [], entities: [], min };
    for (let i = 0; i < total2; i++) {
      const state = kept(i, true);
      if (state === void 0) continue;
      const x = i % w;
      const z = Math.floor(i / w) % l;
      const y = Math.floor(i / (w * l));
      r.blocks.push([min[0] + x, min[1] + y, min[2] + z, state]);
    }
    for (const t of tileEntities?.type === "list" ? tileEntities.value : []) {
      if (t.type !== "compound") {
        lost.addBlockEntity("unknown");
        continue;
      }
      const kind = kindOf(child(t, "id"));
      const rel = [child(t, "x"), child(t, "y"), child(t, "z")].map(
        (v) => v !== void 0 && (v.type === "int" || v.type === "short" || v.type === "byte") ? v.value : Number.NaN
      );
      const inside = rel.every((v, i) => Number.isInteger(v) && v >= 0 && v < abs[i]);
      if (!inside || kept((rel[1] * l + rel[2]) * w + rel[0]) === void 0) {
        lost.addBlockEntity(kind);
        continue;
      }
      r.blockEntities.push({
        pos: [min[0] + rel[0], min[1] + rel[1], min[2] + rel[2]],
        nbt: compound(entriesWithout(t, POSITION_KEYS))
      });
    }
    for (const t of entities?.type === "list" ? entities.value : []) {
      if (t.type !== "compound" || entityPosition(t) === void 0) {
        lost.addEntity(t.type === "compound" ? kindOf(child(t, "id")) : "unknown");
        continue;
      }
      r.entities.push({ edition: "java", nbt: t });
    }
    read2.push(r);
  }
  const volume = new Volume();
  let [mx, my, mz] = [0, 0, 0];
  if (read2.some((r) => r.blocks.length > 0)) {
    mx = my = mz = Number.POSITIVE_INFINITY;
    for (const r of read2) {
      for (const [x, y, z] of r.blocks) {
        if (x < mx) mx = x;
        if (y < my) my = y;
        if (z < mz) mz = z;
      }
    }
  }
  let overwritten = 0;
  for (const r of read2) {
    for (const [x, y, z, s] of r.blocks) {
      if (volume.indexAt(x - mx, y - my, z - mz) >= 0) overwritten++;
      volume.set(x - mx, y - my, z - mz, s);
      volume.deleteBlockEntity(x - mx, y - my, z - mz);
    }
    for (const { pos, nbt } of r.blockEntities) {
      volume.setBlockEntity(pos[0] - mx, pos[1] - my, pos[2] - mz, { edition: "java", nbt });
    }
    for (const e of r.entities) {
      volume.addEntity(shiftEntity(e, r.min[0] - mx, r.min[1] - my, r.min[2] - mz));
    }
  }
  warnings.push(...lost.lines("their position holds no block, or is missing or malformed"));
  warnings.push(...dropped.lines());
  if (regions.value.size > 1) {
    warnings.push(`${regions.value.size} regions flattened into one`);
    if (overwritten > 0) {
      warnings.push(
        `${overwritten} ${overwritten === 1 ? "cell" : "cells"} overwritten where regions overlap (the later region wins)`
      );
    }
  }
  if (ticks > 0) warnings.push(`${ticks} pending block and fluid ticks not carried over`);
  const dv = child(root, "MinecraftDataVersion");
  return {
    volume,
    meta: {
      version,
      dataVersion: dv === void 0 ? null : asNumber(dv, "MinecraftDataVersion"),
      regionCount: regions.value.size,
      name: metadataString(root, "Name"),
      author: metadataString(root, "Author"),
      description: metadataString(root, "Description"),
      droppedBlockEntities: lost.blockEntityCount,
      droppedEntities: lost.entityCount
    },
    warnings
  };
}
function buildLitematic(volume, options) {
  const dense = volume.toDense();
  const [w, h, l] = dense.size;
  if (dense.data.length === 0) throw new CodecError("build is empty — nothing to export");
  const warnings = [...foreignLines(volume, "java")];
  const states = [AIR];
  const remap = new Int32Array(dense.palette.length);
  dense.palette.forEach((p, i) => {
    const brace = p.indexOf("{");
    let state = p;
    if (brace !== -1) {
      warnings.push(
        `palette entry '${p}' carries block-entity NBT which .litematic export drops (no tile entities are written)`
      );
      state = p.slice(0, brace);
    }
    if (state === AIR) {
      remap[i] = 0;
      return;
    }
    let at = states.indexOf(state);
    if (at === -1) {
      states.push(state);
      at = states.length - 1;
    }
    remap[i] = at;
  });
  const total2 = w * h * l;
  const values = new Int32Array(total2);
  let blocks = 0;
  for (let y = 0; y < h; y++) {
    for (let z = 0; z < l; z++) {
      for (let x = 0; x < w; x++) {
        const v = dense.data[(x * h + y) * l + z];
        if (v < 0) continue;
        const idx = remap[v];
        values[(y * l + z) * w + x] = idx;
        if (idx !== 0) blocks++;
      }
    }
  }
  const palette = states.map((s) => {
    const bracket = s.indexOf("[");
    const entry = compound([["Name", string(bracket === -1 ? s : s.slice(0, bracket))]]);
    if (bracket !== -1) {
      const props = compound();
      for (const item of s.slice(bracket + 1, -1).split(",")) {
        const eq = item.indexOf("=");
        props.value.set(item.slice(0, eq), string(item.slice(eq + 1)));
      }
      entry.value.set("Properties", props);
    }
    return entry;
  });
  const vec = (a, b, c) => compound([
    ["x", int2(a)],
    ["y", int2(b)],
    ["z", int2(c)]
  ]);
  const [ox, oy, oz] = dense.origin;
  const tileEntities = [];
  volume.eachBlockEntity((x, y, z, e) => {
    if (e.edition === "java") {
      tileEntities.push({ x: x - ox, y: y - oy, z: z - oz, nbt: e.nbt });
    }
  });
  tileEntities.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  const tiles = tileEntities.map(
    ({ x, y, z, nbt }) => compound([["x", int2(x)], ["y", int2(y)], ["z", int2(z)], ...entriesWithout(nbt, POSITION_KEYS)])
  );
  const mobs = volume.entities.filter((e) => e.edition === "java").map((e) => shiftEntity(e, -ox, -oy, -oz).nbt);
  const time = BigInt(options.time ?? 0);
  const region = compound([
    ["Position", vec(0, 0, 0)],
    ["Size", vec(w, h, l)],
    ["BlockStatePalette", list(TagId.Compound, palette)],
    ["BlockStates", longArray(pack(values, bitsFor(palette.length)))],
    ["TileEntities", list(TagId.Compound, tiles)],
    ["Entities", list(TagId.Compound, mobs)],
    ["PendingBlockTicks", list(TagId.Compound, [])],
    ["PendingFluidTicks", list(TagId.Compound, [])]
  ]);
  const root = compound([
    ["Version", int2(6)],
    ["MinecraftDataVersion", int2(options.dataVersion)],
    [
      "Metadata",
      compound([
        ["Name", string(options.name ?? "voxwright")],
        ["Author", string(options.author ?? "")],
        ["Description", string(options.description ?? "")],
        ["RegionCount", int2(1)],
        ["TimeCreated", long(time)],
        ["TimeModified", long(time)],
        ["TotalBlocks", int2(blocks)],
        ["TotalVolume", int2(total2)],
        ["EnclosingSize", vec(w, h, l)]
      ])
    ],
    ["Regions", compound([["Main", region]])]
  ]);
  return { root, warnings };
}
async function writeLitematic(volume, options) {
  const { root, warnings } = buildLitematic(volume, options);
  return { bytes: await writeNbtGzip({ name: "Litematic", tag: root }), warnings };
}

// packages/core/src/codecs/mcstructure.ts
var BLOCK_VERSION = 18168865;
var BED_KEYS = /* @__PURE__ */ new Set(["id", "color", "isMovable", "x", "y", "z"]);
function isPlainBed(be) {
  if (be.value.get("id")?.type !== "string" || be.value.get("id").value !== "Bed")
    return false;
  for (const [k, v] of be.value) {
    if (!BED_KEYS.has(k)) return false;
    if (k === "isMovable" && !(v.type === "byte" && v.value === 1)) return false;
  }
  return be.value.has("color");
}
function scalar(tag) {
  if (tag.type === "string") return tag.value;
  if (tag.type === "byte" || tag.type === "short" || tag.type === "int") return tag.value;
  if (tag.type === "long") return Number(tag.value);
  throw new CodecError(`unexpected ${tag.type} tag in block states`);
}
async function readMcstructure(bytes, options = {}) {
  let root;
  try {
    root = (await readNbtFile(bytes, { endian: "little" })).tag;
  } catch (e) {
    throw new CodecError(`not a readable NBT file (${e instanceof Error ? e.message : String(e)})`);
  }
  const sizeTag = child(root, "size");
  if (sizeTag?.type !== "list" || sizeTag.value.length !== 3) {
    throw new CodecError("not a .mcstructure (no size)");
  }
  const [sx, sy, sz] = sizeTag.value.map((v, i2) => asNumber(v, `size[${i2}]`));
  checkExtent([sx, sy, sz], options);
  const structure = asCompound(child(root, "structure"), "structure");
  const indicesTag = child(structure, "block_indices");
  const paletteRoot = child(asCompound(child(structure, "palette"), "palette"), "default");
  if (indicesTag?.type !== "list" || indicesTag.value.length === 0) {
    throw new CodecError("not a .mcstructure (no block_indices)");
  }
  const layers = indicesTag.value.map((l) => {
    if (l.type === "intArray") return Array.from(l.value);
    if (l.type === "list") return l.value.map((v) => asNumber(v, "block index"));
    throw new CodecError("block_indices layers must be lists");
  });
  const palContainer = asCompound(paletteRoot, "palette.default");
  const paletteList = child(palContainer, "block_palette");
  if (paletteList?.type !== "list") throw new CodecError("no block_palette");
  const total2 = sx * sy * sz;
  if (total2 < 0 || total2 > 2147483647) throw new CodecError(`invalid size ${sx}x${sy}x${sz}`);
  const main = layers[0];
  if (main.length !== total2) {
    throw new CodecError(`block_indices holds ${main.length} entries for ${sx}x${sy}x${sz}`);
  }
  const positionData = child(palContainer, "block_position_data");
  const bedColor = /* @__PURE__ */ new Map();
  const lost = new Tally();
  const pendingBlockEntities = /* @__PURE__ */ new Map();
  let ticks = 0;
  if (positionData?.type === "compound") {
    for (const [key, entry] of positionData.value) {
      if (entry.type !== "compound") continue;
      if (child(entry, "tick_queue_data") !== void 0) ticks++;
      const be = child(entry, "block_entity_data");
      if (be?.type !== "compound") continue;
      const cell = Number(key);
      const color = child(be, "color");
      const idTag = child(be, "id");
      if (idTag?.type === "string" && idTag.value === "Bed" && color !== void 0) {
        bedColor.set(cell, asNumber(color, "bed color"));
      }
      if (isPlainBed(be)) continue;
      if (!Number.isInteger(cell) || cell < 0 || cell >= total2) lost.addBlockEntity(kindOf(idTag));
      else pendingBlockEntities.set(cell, be);
    }
  }
  const warnings = /* @__PURE__ */ new Set();
  const entries2 = paletteList.value.map((e) => {
    const c = asCompound(e, "palette entry");
    const name = child(c, "name");
    if (name?.type !== "string") throw new CodecError("palette entry has no name");
    const states = /* @__PURE__ */ new Map();
    const st = child(c, "states");
    if (st?.type === "compound") for (const [k, v] of st.value) states.set(k, scalar(v));
    return { name: name.value, states };
  });
  const translated = /* @__PURE__ */ new Map();
  const javaOf = (idx, color) => {
    const key = `${idx}/${color ?? ""}`;
    let state = translated.get(key);
    if (state === void 0) {
      const e = entries2[idx];
      if (e === void 0) throw new CodecError(`block index ${idx} is outside the palette`);
      const r = bedrockToJava(e.name, e.states, color === void 0 ? {} : { bedColor: color });
      for (const w of r.warnings) warnings.add(w);
      state = r.state;
      translated.set(key, state);
    }
    return state;
  };
  const water = /* @__PURE__ */ new Set();
  entries2.forEach((e, i2) => {
    if (e.name === "minecraft:water" || e.name === "minecraft:flowing_water") water.add(i2);
  });
  const second = layers[1];
  const kept = [];
  const dropped = new BlockTally();
  const unknown = /* @__PURE__ */ new Map();
  let i = 0;
  for (let x = 0; x < sx; x++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++, i++) {
        const idx = main[i];
        if (idx < 0) continue;
        let state = javaOf(idx, bedColor.get(i));
        const base = state.split("[", 1)[0];
        const kind = dropped.note(base);
        if (kind === "skip") continue;
        if (kind === "air") {
          if (options.keepAir) kept.push([x, y, z, AIR]);
          continue;
        }
        if (options.knownBlocks !== void 0 && !options.knownBlocks.has(base)) {
          unknown.set(base, (unknown.get(base) ?? 0) + 1);
        }
        const layer2 = second?.[i];
        if (layer2 !== void 0 && water.has(layer2)) {
          const parsed = parse(state);
          parsed.props.set("waterlogged", "true");
          state = canonicalize(
            `${parsed.name}[${[...parsed.props].map(([k, v]) => `${k}=${v}`).join(",")}]`
          );
        }
        kept.push([x, y, z, state]);
      }
    }
  }
  const volume = new Volume();
  let [mx, my, mz] = [0, 0, 0];
  if (kept.length > 0) {
    mx = my = mz = Number.POSITIVE_INFINITY;
    for (const [x, y, z] of kept) {
      if (x < mx) mx = x;
      if (y < my) my = y;
      if (z < mz) mz = z;
    }
    for (const [x, y, z, s] of kept) volume.set(x - mx, y - my, z - mz, s);
  }
  for (const [cell, be] of pendingBlockEntities) {
    const x = Math.floor(cell / (sy * sz)) - mx;
    const y = Math.floor(cell / sz) % sy - my;
    const z = cell % sz - mz;
    if (volume.indexAt(x, y, z) < 0) lost.addBlockEntity(kindOf(child(be, "id")));
    else {
      const entity = {
        edition: "bedrock",
        nbt: compound(entriesWithout(be, POSITION_KEYS))
      };
      volume.setBlockEntity(x, y, z, entity);
    }
  }
  const entities = child(structure, "entities");
  for (const raw of entities?.type === "list" ? entities.value : []) {
    if (raw.type !== "compound" || entityPosition(raw) === void 0) {
      lost.addEntity(
        raw.type === "compound" ? kindOf(child(raw, "identifier") ?? child(raw, "id")) : "unknown"
      );
      continue;
    }
    volume.addEntity(shiftEntity({ edition: "bedrock", nbt: raw }, -mx, -my, -mz));
  }
  for (const line2 of lost.lines("their position holds no block, or is missing or malformed")) {
    warnings.add(line2);
  }
  for (const line2 of dropped.lines()) warnings.add(line2);
  if (unknown.size > 0) {
    let total3 = 0;
    for (const c of unknown.values()) total3 += c;
    warnings.add(
      `${total3} ${total3 === 1 ? "block" : "blocks"} not translated, kept as is (the name is not a known Java block): ${describeCounts(unknown)}`
    );
  }
  if (ticks > 0) warnings.add(`${ticks} pending block ticks not carried over`);
  const fv = child(root, "format_version");
  return {
    volume,
    meta: {
      formatVersion: fv === void 0 ? null : asNumber(fv, "format_version"),
      size: [sx, sy, sz],
      droppedBlockEntities: lost.blockEntityCount,
      droppedEntities: lost.entityCount
    },
    warnings: [...warnings]
  };
}
function valueTag(v) {
  if (v.kind === "byte") return byte2(v.value);
  if (v.kind === "int") return int2(v.value);
  return string(v.value);
}
function buildMcstructure(volume) {
  const dense = volume.toDense();
  const [sx, sy, sz] = dense.size;
  if (dense.data.length === 0) throw new CodecError("build is empty — nothing to export");
  const warnings = /* @__PURE__ */ new Set();
  const palette = [];
  const index = /* @__PURE__ */ new Map();
  const intern = (name, states) => {
    const keys = [...states.keys()].sort();
    const sig = name + JSON.stringify(keys.map((k) => [k, states.get(k)]));
    let at = index.get(sig);
    if (at === void 0) {
      at = palette.length;
      index.set(sig, at);
      palette.push(
        compound([
          ["name", string(name)],
          [
            "states",
            compound(keys.map((k) => [k, valueTag(states.get(k))]))
          ],
          ["version", int2(BLOCK_VERSION)]
        ])
      );
    }
    return at;
  };
  const perPalette = dense.palette.map((canonical2) => {
    const brace = canonical2.indexOf("{");
    let state = canonical2;
    if (brace !== -1) {
      warnings.add(
        `palette entry '${canonical2}' carries block-entity NBT which .mcstructure export drops`
      );
      state = canonical2.slice(0, brace);
    }
    const r = javaToBedrock(state);
    for (const w of r.warnings) warnings.add(w);
    return r;
  });
  const [ox, oy, oz] = dense.origin;
  for (const line2 of foreignLines(volume, "bedrock", (x, y, z, e) => {
    const v = dense.data[((x - ox) * sy + (y - oy)) * sz + (z - oz)];
    const id = e.nbt.value.get("id");
    return e.nbt.value.size === 1 && id?.type === "string" && id.value === "minecraft:bed" && perPalette[v]?.bedColor !== void 0;
  })) {
    warnings.add(line2);
  }
  const mapped = perPalette.map((r) => intern(r.block.name, r.block.states));
  const waterIdx = perPalette.some((r) => r.waterlogged) ? intern("minecraft:water", /* @__PURE__ */ new Map([["liquid_depth", { kind: "int", value: 0 }]])) : -1;
  const main = [];
  const layer2 = [];
  const positionData = compound();
  let i = 0;
  for (let x = 0; x < sx; x++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++, i++) {
        const v = dense.data[i];
        main.push(int2(v < 0 ? -1 : mapped[v]));
        const r = v < 0 ? void 0 : perPalette[v];
        layer2.push(int2(r?.waterlogged ? waterIdx : -1));
        const stored = volume.blockEntityAt(ox + x, oy + y, oz + z);
        if (stored?.edition === "bedrock") {
          positionData.value.set(
            String(i),
            compound([
              [
                "block_entity_data",
                compound([
                  ...entriesWithout(stored.nbt, POSITION_KEYS),
                  ["x", int2(x)],
                  ["y", int2(y)],
                  ["z", int2(z)]
                ])
              ]
            ])
          );
        } else if (r?.bedColor !== void 0) {
          positionData.value.set(
            String(i),
            compound([
              [
                "block_entity_data",
                compound([
                  ["color", byte2(r.bedColor)],
                  ["id", string("Bed")],
                  ["x", int2(x)],
                  ["y", int2(y)],
                  ["z", int2(z)]
                ])
              ]
            ])
          );
        }
      }
    }
  }
  const mobs = volume.entities.filter((e) => e.edition === "bedrock").map((e) => shiftEntity(e, -ox, -oy, -oz).nbt);
  const root = compound([
    ["format_version", int2(1)],
    ["size", list(TagId.Int, [int2(sx), int2(sy), int2(sz)])],
    [
      "structure",
      compound([
        ["block_indices", list(TagId.List, [list(TagId.Int, main), list(TagId.Int, layer2)])],
        ["entities", list(TagId.Compound, mobs)],
        [
          "palette",
          compound([
            [
              "default",
              compound([
                ["block_palette", list(TagId.Compound, palette)],
                ["block_position_data", positionData]
              ])
            ]
          ])
        ]
      ])
    ],
    ["structure_world_origin", list(TagId.Int, [int2(0), int2(0), int2(0)])]
  ]);
  return { root: { name: "", tag: root }, warnings: [...warnings] };
}
function writeMcstructure(volume) {
  const { root, warnings } = buildMcstructure(volume);
  return { bytes: writeNbt(root, { endian: "little" }), warnings };
}

// packages/core/src/codecs/schem.ts
var LEGACY_SCHEMATIC_MESSAGE = "this is a legacy .schematic file (the pre-1.13 MCEdit format with numeric block IDs), which is not supported; re-save it as .schem (for example with WorldEdit in Minecraft 1.13 or later) and open that";
function isLegacySchematic(top) {
  if (child(top, "Version") !== void 0 || child(top, "Palette") !== void 0) return false;
  if (child(top, "Schematic")?.type === "compound") return false;
  return child(top, "Materials")?.type === "string" || child(top, "Blocks")?.type === "byteArray";
}
function readVarint(data, pos) {
  let value = 0;
  let shift = 0;
  let p = pos;
  for (; ; ) {
    const b = data[p++];
    if (b === void 0) throw new CodecError("BlockData ends inside a varint");
    value += (b & 127) * 2 ** shift;
    if ((b & 128) === 0) break;
    shift += 7;
    if (shift > 35) throw new CodecError("BlockData varint is too long");
  }
  return [value, p];
}
function writeVarint(out, value) {
  let v = value;
  while (v >= 128) {
    out.push(v % 128 | 128);
    v = Math.floor(v / 128);
  }
  out.push(v);
}
function dimension(tag, name) {
  return asNumber(child(tag, name), name) & 65535;
}
function readOffset(tag) {
  const t = child(tag, "Offset");
  if (t?.type === "intArray" && t.value.length === 3) {
    return [t.value[0], t.value[1], t.value[2]];
  }
  return [0, 0, 0];
}
function compoundList(tag) {
  return tag?.type === "list" ? tag.value : [];
}
function canonical(id, head, rest, skip) {
  const out = compound();
  if (id?.type === "string") out.value.set("id", id);
  for (const [k, v] of head) out.value.set(k, v);
  for (const [k, v] of rest)
    if (!skip.has(k) && !(k === "id" && id?.type === "string")) out.value.set(k, v);
  return out;
}
function readBlockEntities(volume, list2, version, lost) {
  for (const raw of list2) {
    if (raw.type !== "compound") {
      lost.addBlockEntity("unknown");
      continue;
    }
    const idTag = child(raw, "Id") ?? child(raw, "id");
    const pos = child(raw, "Pos");
    if (pos?.type !== "intArray" || pos.value.length !== 3) {
      lost.addBlockEntity(kindOf(idTag));
      continue;
    }
    const data = child(raw, "Data");
    const rest = version === 2 ? [...raw.value] : [
      ...entriesWithout(raw, /* @__PURE__ */ new Set(["Id", "id", "Pos", "Data"])),
      ...data?.type === "compound" ? [...data.value] : []
    ];
    const skip = /* @__PURE__ */ new Set([...POSITION_KEYS, ...version === 2 ? ["Id", "Pos"] : []]);
    const nbt = canonical(idTag, [], rest, skip);
    const [x, y, z] = [pos.value[0], pos.value[1], pos.value[2]];
    attachBlockEntity(volume, x, y, z, { edition: "java", nbt }, lost, kindOf(idTag));
  }
}
function readEntities(volume, list2, version, lost) {
  for (const raw of list2) {
    if (raw.type !== "compound") {
      lost.addEntity("unknown");
      continue;
    }
    const idTag = child(raw, "Id") ?? child(raw, "id");
    const pos = child(raw, "Pos");
    const data = child(raw, "Data");
    const rest = version === 2 ? [...raw.value] : [
      ...entriesWithout(raw, /* @__PURE__ */ new Set(["Id", "id", "Pos", "Data"])),
      ...data?.type === "compound" ? [...data.value] : []
    ];
    const nbt = canonical(
      idTag,
      pos === void 0 ? [] : [["Pos", pos]],
      rest,
      /* @__PURE__ */ new Set(["Id", "Pos"])
    );
    if (entityPosition(nbt) === void 0) {
      lost.addEntity(kindOf(idTag));
      continue;
    }
    volume.addEntity({ edition: "java", nbt });
  }
}
async function readSchem(bytes, options = {}) {
  let top;
  try {
    top = (await readNbtFile(bytes)).tag;
  } catch (e) {
    throw new CodecError(`not a readable NBT file (${e instanceof Error ? e.message : String(e)})`);
  }
  if (isLegacySchematic(top)) throw new CodecError(LEGACY_SCHEMATIC_MESSAGE);
  const nested = child(top, "Schematic");
  const isV3 = nested?.type === "compound";
  const schem = isV3 ? nested : top;
  const version = asNumber(child(schem, "Version"), "Version");
  if (version !== 2 && version !== 3) {
    throw new CodecError(`unsupported Sponge schematic version ${version} (expected 2 or 3)`);
  }
  if (version === 3 !== isV3) {
    throw new CodecError(`Sponge schematic version ${version} has the wrong layout`);
  }
  const width = dimension(schem, "Width");
  const height = dimension(schem, "Height");
  const length = dimension(schem, "Length");
  checkExtent([width, height, length], options);
  let paletteTag;
  let dataTag;
  let blockEntities;
  if (version === 3) {
    const blocks = asCompound(child(schem, "Blocks"), "Blocks");
    paletteTag = child(blocks, "Palette");
    dataTag = child(blocks, "Data");
    blockEntities = child(blocks, "BlockEntities");
  } else {
    paletteTag = child(schem, "Palette");
    dataTag = child(schem, "BlockData");
    blockEntities = child(schem, "BlockEntities");
  }
  const palette = asCompound(paletteTag, "Palette");
  if (dataTag?.type !== "byteArray") throw new CodecError("block data must be a byte array");
  const data = new Uint8Array(
    dataTag.value.buffer,
    dataTag.value.byteOffset,
    dataTag.value.byteLength
  );
  const states = /* @__PURE__ */ new Map();
  for (const [key, value] of palette.value) {
    const id = asNumber(value, `palette id for ${key}`);
    let canonical2;
    try {
      canonical2 = canonicalize(key);
    } catch (e) {
      throw new CodecError(
        `bad palette entry '${key}': ${e instanceof Error ? e.message : String(e)}`
      );
    }
    states.set(id, canonical2.includes(":") ? canonical2 : `minecraft:${canonical2}`);
  }
  const total2 = width * height * length;
  if (total2 > 2147483647)
    throw new CodecError(`schematic ${width}x${height}x${length} is too large`);
  if (data.length < total2) {
    throw new CodecError(
      `block data holds fewer than ${total2} entries for ${width}x${height}x${length}`
    );
  }
  const volume = new Volume();
  const dropped = new BlockTally();
  let pos = 0;
  for (let i = 0; i < total2; i++) {
    let id;
    [id, pos] = readVarint(data, pos);
    const state = states.get(id);
    if (state === void 0)
      throw new CodecError(`block data uses palette id ${id} which is not defined`);
    const name = state.split("[", 1)[0];
    const kind = dropped.note(name);
    if (kind === "skip" || kind === "air" && !options.keepAir) continue;
    const x = i % width;
    const z = Math.floor(i / width) % length;
    const y = Math.floor(i / (width * length));
    volume.set(x, y, z, kind === "air" ? AIR : state);
  }
  const lost = new Tally();
  readBlockEntities(volume, compoundList(blockEntities), version, lost);
  readEntities(volume, compoundList(child(schem, "Entities")), version, lost);
  const warnings = [...lost.lines("their position holds no block, or is missing or malformed")];
  warnings.push(...dropped.lines());
  const metadata = child(schem, "Metadata");
  if (metadata?.type === "compound" && metadata.value.size > 0) {
    warnings.push(`Metadata not carried over (${[...metadata.value.keys()].join(", ")})`);
  }
  if (child(schem, version === 3 ? "Biomes" : "BiomeData") !== void 0) {
    warnings.push("biomes not carried over (a volume holds no biomes)");
  }
  const dv = child(schem, "DataVersion");
  return {
    volume,
    meta: {
      version,
      dataVersion: dv === void 0 ? null : asNumber(dv, "DataVersion"),
      offset: readOffset(schem),
      width,
      height,
      length,
      droppedBlockEntities: lost.blockEntityCount,
      droppedEntities: lost.entityCount
    },
    warnings
  };
}
function carriedOffset(volume, offset) {
  const bounds = volume.placedBounds();
  const corner = bounds === null ? [0, 0, 0] : bounds[0];
  return [offset[0] + corner[0], offset[1] + corner[1], offset[2] + corner[2]];
}
function writeBlockEntities(volume, origin, version) {
  const found = [];
  volume.eachBlockEntity((x, y, z, e) => {
    if (e.edition === "java")
      found.push({ x: x - origin[0], y: y - origin[1], z: z - origin[2], nbt: e.nbt });
  });
  found.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  return found.map(({ x, y, z, nbt }) => {
    const out = compound();
    const id = nbt.value.get("id");
    if (id !== void 0) out.value.set("Id", id);
    out.value.set("Pos", intArray(Int32Array.of(x, y, z)));
    const rest = entriesWithout(nbt, /* @__PURE__ */ new Set(["id"]));
    if (version === 2) for (const [k, v] of rest) out.value.set(k, v);
    else out.value.set("Data", compound(rest));
    return out;
  });
}
function writeEntities(volume, origin, version) {
  return volume.entities.filter((e) => e.edition === "java").map((e) => {
    const { nbt } = shiftEntity(e, -origin[0], -origin[1], -origin[2]);
    const out = compound();
    const id = nbt.value.get("id");
    if (id !== void 0) out.value.set("Id", id);
    out.value.set("Pos", nbt.value.get("Pos"));
    const rest = entriesWithout(nbt, /* @__PURE__ */ new Set(["id", "Pos"]));
    if (version === 2) for (const [k, v] of rest) out.value.set(k, v);
    else out.value.set("Data", compound(rest));
    return out;
  });
}
function buildSchem(volume, options) {
  const version = options.version ?? 3;
  if (version !== 2 && version !== 3)
    throw new CodecError(`unsupported version ${String(version)}`);
  const dense = volume.toDense();
  const [width, height, length] = dense.size;
  if (dense.data.length === 0) throw new CodecError("build is empty — nothing to export");
  for (const [axis, n2] of [
    ["Width", width],
    ["Height", height],
    ["Length", length]
  ]) {
    if (n2 > 65535) throw new CodecError(`${axis} ${n2} does not fit in an unsigned short`);
  }
  const warnings = [...foreignLines(volume, "java")];
  const ids = /* @__PURE__ */ new Map();
  const paletteTag = compound();
  const idOf = (state) => {
    let id = ids.get(state);
    if (id === void 0) {
      id = ids.size;
      ids.set(state, id);
      paletteTag.value.set(state, int2(id));
    }
    return id;
  };
  const out = [];
  const warned = /* @__PURE__ */ new Set();
  for (let y = 0; y < height; y++) {
    for (let z = 0; z < length; z++) {
      for (let x = 0; x < width; x++) {
        const idx = dense.data[(x * height + y) * length + z];
        let state = idx < 0 ? AIR : dense.palette[idx];
        const brace = state.indexOf("{");
        if (brace !== -1) {
          if (!warned.has(state)) {
            warned.add(state);
            warnings.push(
              `palette entry '${state}' carries block-entity NBT which .schem export drops (no block entities are written)`
            );
          }
          state = state.slice(0, brace);
        }
        writeVarint(out, idOf(state));
      }
    }
  }
  const blockEntities = writeBlockEntities(volume, dense.origin, version);
  const entities = writeEntities(volume, dense.origin, version);
  const blockData = byteArray(new Int8Array(Uint8Array.from(out).buffer));
  const offset = options.offset ?? [0, 0, 0];
  const body = [
    ["Version", int2(version)],
    ["DataVersion", int2(options.dataVersion)],
    ["Width", short(width)],
    ["Height", short(height)],
    ["Length", short(length)],
    ["Offset", intArray(Int32Array.from(offset))]
  ];
  if (version === 2) {
    body.push(
      ["PaletteMax", int2(ids.size)],
      ["Palette", paletteTag],
      ["BlockData", blockData],
      ["BlockEntities", list(TagId.Compound, blockEntities)]
    );
    if (entities.length > 0) body.push(["Entities", list(TagId.Compound, entities)]);
    return { root: compound(body), warnings };
  }
  body.push([
    "Blocks",
    compound([
      ["Palette", paletteTag],
      ["Data", blockData],
      ["BlockEntities", list(TagId.Compound, blockEntities)]
    ])
  ]);
  if (entities.length > 0) body.push(["Entities", list(TagId.Compound, entities)]);
  return { root: compound([["Schematic", compound(body)]]), warnings };
}
async function writeSchem(volume, options) {
  const { root, warnings } = buildSchem(volume, options);
  const name = (options.version ?? 3) === 2 ? "Schematic" : "";
  return { bytes: await writeNbtGzip({ name, tag: root }), warnings };
}

// packages/core/src/codecs/structure-nbt.ts
function stateOf(name, props) {
  const full = name.includes(":") ? name : `minecraft:${name}`;
  return canonicalize(join(full, props));
}
function paletteState2(entry) {
  const e = asCompound(entry, "palette entry");
  const nameTag = child(e, "Name") ?? child(e, "id");
  if (nameTag?.type !== "string") throw new CodecError("palette entry has no Name or id");
  const props = /* @__PURE__ */ new Map();
  const propsTag = child(e, "Properties") ?? child(e, "properties");
  if (propsTag !== void 0) {
    for (const [k, v] of asCompound(propsTag, "Properties").value) {
      props.set(k, v.type === "string" ? v.value : String(v.value));
    }
  }
  return stateOf(nameTag.value, props);
}
async function readStructureNbt(bytes, options = {}) {
  let root;
  try {
    root = await readNbtFile(bytes);
  } catch (e) {
    throw new CodecError(`not a readable NBT file (${e instanceof Error ? e.message : String(e)})`);
  }
  const tag = root.tag;
  let paletteTag = child(tag, "palette");
  if (paletteTag === void 0) {
    const variants = child(tag, "palettes");
    if (variants?.type === "list" && variants.value.length > 0) paletteTag = variants.value[0];
  }
  const blocksTag = child(tag, "blocks");
  if (paletteTag?.type !== "list" || blocksTag?.type !== "list") {
    throw new CodecError("not a structure .nbt (no palette/blocks)");
  }
  const declared = child(tag, "size");
  if (declared?.type === "list" && declared.value.length === 3) {
    checkExtent(
      declared.value.map((v, i) => asNumber(v, `size[${i}]`)),
      options
    );
  }
  const states = paletteTag.value.map(paletteState2);
  const kept = [];
  const pendingBlockEntities = /* @__PURE__ */ new Map();
  const lost = new Tally();
  const dropped = new BlockTally();
  for (const b of blocksTag.value) {
    const block = asCompound(b, "block");
    const pos = child(block, "pos");
    if (pos?.type !== "list" || pos.value.length !== 3)
      throw new CodecError("block pos must be 3 ints");
    const [x, y, z] = pos.value.map((v, i) => asNumber(v, `block pos[${i}]`));
    const stateIdx = asNumber(child(block, "state"), "block state");
    const state = states[stateIdx];
    if (state === void 0) throw new CodecError(`block state ${stateIdx} is outside the palette`);
    const nbt = child(block, "nbt");
    const name = state.split("[", 1)[0];
    const kind = dropped.note(name);
    const skipped = kind === "skip" || kind === "air" && !options.keepAir;
    if (nbt !== void 0) {
      if (nbt.type === "compound" && !skipped) pendingBlockEntities.set(`${x},${y},${z}`, nbt);
      else lost.addBlockEntity(kindOf(nbt.type === "compound" ? nbt.value.get("id") : void 0));
    }
    if (kind === "skip") continue;
    if (kind === "air") {
      if (options.keepAir) kept.push([x, y, z, AIR]);
      continue;
    }
    kept.push([x, y, z, state]);
  }
  const volume = new Volume();
  let [mx, my, mz] = [0, 0, 0];
  if (kept.length > 0) {
    mx = my = mz = Number.POSITIVE_INFINITY;
    let [hx, hy, hz] = [
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY
    ];
    for (const [x, y, z] of kept) {
      if (x < mx) mx = x;
      if (y < my) my = y;
      if (z < mz) mz = z;
      if (x > hx) hx = x;
      if (y > hy) hy = y;
      if (z > hz) hz = z;
    }
    checkExtent([hx - mx + 1, hy - my + 1, hz - mz + 1], options);
    for (const [x, y, z, s] of kept) volume.set(x - mx, y - my, z - mz, s);
  }
  for (const [key, nbt] of pendingBlockEntities) {
    const [x, y, z] = key.split(",").map(Number);
    const entity = {
      edition: "java",
      nbt: compound(entriesWithout(nbt, POSITION_KEYS))
    };
    volume.setBlockEntity(x - mx, y - my, z - mz, entity);
  }
  const entitiesTag = child(tag, "entities");
  for (const raw of entitiesTag?.type === "list" ? entitiesTag.value : []) {
    const e = raw.type === "compound" ? child(raw, "nbt") : void 0;
    if (raw.type !== "compound" || e?.type !== "compound") {
      lost.addEntity("unknown");
      continue;
    }
    const nbt = compound(e.value);
    const pos = child(raw, "pos");
    if (pos !== void 0) nbt.value.set("Pos", pos);
    if (entityPosition(nbt) === void 0) {
      lost.addEntity(kindOf(e.value.get("id")));
      continue;
    }
    volume.addEntity(shiftEntity({ edition: "java", nbt }, -mx, -my, -mz));
  }
  const dv = child(tag, "DataVersion");
  return {
    volume,
    meta: {
      dataVersion: dv === void 0 ? null : asNumber(dv, "DataVersion"),
      droppedBlockEntities: lost.blockEntityCount,
      droppedEntities: lost.entityCount
    },
    warnings: [
      ...lost.lines("their position holds no block, or is missing or malformed"),
      ...dropped.lines()
    ]
  };
}
var AIR_MODES = ["none", "explicit", "all"];
function buildStructureNbt(volume, options) {
  const airMode = options.air ?? "none";
  if (!AIR_MODES.includes(airMode)) {
    throw new CodecError(`air must be one of ${AIR_MODES.join(", ")}, got '${String(airMode)}'`);
  }
  const dense = volume.toDense();
  const [sx, sy, sz] = dense.size;
  if (dense.data.length === 0) throw new CodecError("build is empty — nothing to export");
  const warnings = [...foreignLines(volume, "java")];
  const palette = [];
  let airIdx = null;
  dense.palette.forEach((canonical2, i) => {
    const { name, props, nbt } = parse(canonical2);
    if (nbt !== null) {
      warnings.push(
        `palette entry '${canonical2}' carries block-entity NBT which .nbt export drops (no block_entities list is written)`
      );
    }
    const entry = compound([["Name", string(name)]]);
    if (props.size > 0) {
      const keys = [...props.keys()].sort();
      entry.value.set("Properties", compound(keys.map((k) => [k, string(props.get(k))])));
    }
    if (name === AIR) airIdx = i;
    palette.push(entry);
  });
  if (airMode === "all" && airIdx === null) {
    airIdx = palette.length;
    palette.push(compound([["Name", string(AIR)]]));
  }
  const blocks = [];
  const lost = new Tally();
  const [ox, oy, oz] = dense.origin;
  for (let x = 0; x < sx; x++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++) {
        let idx = dense.data[(x * sy + y) * sz + z];
        if (idx < 0) {
          if (airMode !== "all") continue;
          idx = airIdx;
        } else if (airMode === "none" && idx === airIdx) {
          continue;
        }
        const block = compound([
          ["pos", list(TagId.Int, [int2(x), int2(y), int2(z)])],
          ["state", int2(idx)]
        ]);
        const entity = volume.blockEntityAt(ox + x, oy + y, oz + z);
        if (entity?.edition === "java") block.value.set("nbt", entity.nbt);
        blocks.push(block);
      }
    }
  }
  volume.eachBlockEntity((x, y, z, e) => {
    if (e.edition !== "java") return;
    const key = ((x - ox) * sy + (y - oy)) * sz + (z - oz);
    const idx = dense.data[key];
    if (idx < 0 ? airMode !== "all" : airMode === "none" && idx === airIdx) {
      lost.addBlockEntity(kindOf(e.nbt.value.get("id")));
    }
  });
  warnings.push(...lost.lines("their cell is air, which this export leaves out"));
  const entities = [];
  for (const e of volume.entities) {
    if (e.edition !== "java") continue;
    const moved = shiftEntity(e, -ox, -oy, -oz);
    const p = entityPosition(moved.nbt);
    entities.push(
      compound([
        ["pos", positionTag("java", p[0], p[1], p[2])],
        [
          "blockPos",
          list(TagId.Int, [int2(Math.floor(p[0])), int2(Math.floor(p[1])), int2(Math.floor(p[2]))])
        ],
        ["nbt", moved.nbt]
      ])
    );
  }
  const root = compound([
    ["DataVersion", int2(options.dataVersion)],
    ["size", list(TagId.Int, [int2(sx), int2(sy), int2(sz)])],
    ["palette", list(TagId.Compound, palette)],
    ["blocks", list(TagId.Compound, blocks)],
    ["entities", list(TagId.Compound, entities)]
  ]);
  return { root, warnings };
}
async function writeStructureNbt(volume, options) {
  const { root, warnings } = buildStructureNbt(volume, options);
  return { bytes: await writeNbtGzip({ name: "", tag: root }), warnings };
}

// packages/core/src/edit/command.ts
var EditError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "EditError";
  }
};
var SECTION_BITS2 = 4;
var SECTION_CELLS = 1 << SECTION_BITS2 * 3;
var SECTION_MASK2 = (1 << SECTION_BITS2) - 1;
var SPARSE_BYTES = 20;
var DIFF_BYTES = SECTION_CELLS * 8;
var PENDING = -2;
var localIndex = (x, y, z) => (y & SECTION_MASK2) << 8 | (z & SECTION_MASK2) << 4 | x & SECTION_MASK2;
function isEmptyCommand(command) {
  return command.before.length === 0 && command.sections.length === 0 && command.blockEntities.length === 0;
}
function commandCellCount(command) {
  let n2 = command.before.length;
  for (const d of command.sections) {
    for (let i = 0; i < SECTION_CELLS; i++) if (d.before[i] !== d.after[i]) n2++;
  }
  return n2;
}
function commandBytes(command) {
  let n2 = 64 + command.label.length * 2;
  n2 += command.positions.byteLength + command.before.byteLength + command.after.byteLength;
  for (const d of command.sections) n2 += d.before.byteLength + d.after.byteLength + 48;
  n2 += command.blockEntities.length * 512;
  return n2;
}
function forEachChange(command, fn) {
  const { positions, before, after } = command;
  for (let i = 0; i < before.length; i++) {
    fn(
      positions[3 * i],
      positions[3 * i + 1],
      positions[3 * i + 2],
      before[i],
      after[i]
    );
  }
  for (const d of command.sections) {
    for (let i = 0; i < SECTION_CELLS; i++) {
      const b = d.before[i];
      const a = d.after[i];
      if (b === a) continue;
      fn(
        d.sx << SECTION_BITS2 | i & SECTION_MASK2,
        d.sy << SECTION_BITS2 | i >> 8,
        d.sz << SECTION_BITS2 | i >> 4 & SECTION_MASK2,
        b,
        a
      );
    }
  }
}
function putBlockEntity(volume, x, y, z, entity) {
  if (entity === void 0) volume.deleteBlockEntity(x, y, z);
  else volume.setBlockEntity(x, y, z, entity);
}
function applyCommand(volume, command) {
  forEachChange(command, (x, y, z, _before, after) => volume.setIndex(x, y, z, after));
  for (const c of command.blockEntities) putBlockEntity(volume, c.x, c.y, c.z, c.after);
}
function revertCommand(volume, command) {
  forEachChange(command, (x, y, z, before) => volume.setIndex(x, y, z, before));
  for (const c of command.blockEntities) putBlockEntity(volume, c.x, c.y, c.z, c.before);
}
var SectionStage = class {
  before = new Int32Array(SECTION_CELLS).fill(PENDING);
  after = new Int32Array(SECTION_CELLS);
  sx;
  sy;
  sz;
  constructor(sx, sy, sz) {
    this.sx = sx;
    this.sy = sy;
    this.sz = sz;
  }
};
var Staging = class {
  stages = /* @__PURE__ */ new Map();
  beStages = /* @__PURE__ */ new Map();
  last;
  /** The staged block entity change at a cell, if any. */
  blockEntityStage(x, y, z) {
    if (this.beStages.size === 0) return void 0;
    return this.beStages.get(`${x},${y},${z}`);
  }
  /** The first `before` and the last `after` of a cell win. */
  recordBlockEntity(x, y, z, before, after) {
    const key = `${x},${y},${z}`;
    const have = this.beStages.get(key);
    if (have === void 0) this.beStages.set(key, { before, after, x, y, z });
    else have.after = after;
  }
  /** Does the staged value of this cell differ from what it was before? */
  isChanged(x, y, z) {
    const stage = this.stages.get(`${x >> SECTION_BITS2},${y >> SECTION_BITS2},${z >> SECTION_BITS2}`);
    if (stage === void 0) return false;
    const i = localIndex(x, y, z);
    return stage.before[i] !== PENDING && stage.before[i] !== stage.after[i];
  }
  stageFor(x, y, z) {
    const sx = x >> SECTION_BITS2;
    const sy = y >> SECTION_BITS2;
    const sz = z >> SECTION_BITS2;
    const last = this.last;
    if (last !== void 0 && last.sx === sx && last.sy === sy && last.sz === sz) return last;
    const key = `${sx},${sy},${sz}`;
    let stage = this.stages.get(key);
    if (stage === void 0) {
      stage = new SectionStage(sx, sy, sz);
      this.stages.set(key, stage);
    }
    this.last = stage;
    return stage;
  }
  /** The staged value at a cell, or `undefined` if it has not been touched. */
  peek(x, y, z) {
    const sx = x >> SECTION_BITS2;
    const sy = y >> SECTION_BITS2;
    const sz = z >> SECTION_BITS2;
    let stage = this.last;
    if (stage === void 0 || stage.sx !== sx || stage.sy !== sy || stage.sz !== sz) {
      stage = this.stages.get(`${sx},${sy},${sz}`);
      if (stage === void 0) return void 0;
      this.last = stage;
    }
    const i = localIndex(x, y, z);
    return stage.before[i] === PENDING ? void 0 : stage.after[i];
  }
  /** Visit every staged cell whose value changes, with its new value. */
  eachChanged(fn) {
    for (const st of this.stages.values()) {
      for (let i = 0; i < SECTION_CELLS; i++) {
        const b = st.before[i];
        if (b === PENDING) continue;
        fn(
          st.sx << SECTION_BITS2 | i & SECTION_MASK2,
          st.sy << SECTION_BITS2 | i >> 8,
          st.sz << SECTION_BITS2 | i >> 4 & SECTION_MASK2,
          st.after[i]
        );
      }
    }
  }
  record(x, y, z, before, after) {
    const stage = this.stageFor(x, y, z);
    const i = localIndex(x, y, z);
    if (stage.before[i] === PENDING) stage.before[i] = before;
    stage.after[i] = after;
  }
  /** Freeze into a command, leaving out cells that end up unchanged. */
  toCommand(label) {
    const sparse = [];
    const diffs = [];
    let sparseCount = 0;
    for (const st of this.stages.values()) {
      const cells = [];
      for (let i = 0; i < SECTION_CELLS; i++) {
        const b = st.before[i];
        if (b === PENDING) continue;
        const a = st.after[i];
        if (b === a) continue;
        cells.push(i);
      }
      if (cells.length === 0) continue;
      if (cells.length * SPARSE_BYTES > DIFF_BYTES) {
        const before2 = new Int32Array(SECTION_CELLS).fill(UNSET);
        const after2 = new Int32Array(SECTION_CELLS).fill(UNSET);
        for (const i of cells) {
          before2[i] = st.before[i];
          after2[i] = st.after[i];
        }
        diffs.push({ sx: st.sx, sy: st.sy, sz: st.sz, before: before2, after: after2 });
      } else {
        sparse.push({ sx: st.sx, sy: st.sy, sz: st.sz, cells });
        sparseCount += cells.length;
      }
    }
    const positions = new Int32Array(sparseCount * 3);
    const before = new Int32Array(sparseCount);
    const after = new Int32Array(sparseCount);
    let n2 = 0;
    for (const { sx, sy, sz, cells } of sparse) {
      const st = this.stages.get(`${sx},${sy},${sz}`);
      for (const i of cells) {
        positions[3 * n2] = sx << SECTION_BITS2 | i & SECTION_MASK2;
        positions[3 * n2 + 1] = sy << SECTION_BITS2 | i >> 8;
        positions[3 * n2 + 2] = sz << SECTION_BITS2 | i >> 4 & SECTION_MASK2;
        before[n2] = st.before[i];
        after[n2] = st.after[i];
        n2++;
      }
    }
    const blockEntities = [];
    for (const e of this.beStages.values()) {
      if (e.before === void 0 && e.after === void 0) continue;
      if (e.before === e.after && !this.isChanged(e.x, e.y, e.z)) continue;
      blockEntities.push({ x: e.x, y: e.y, z: e.z, before: e.before, after: e.after });
    }
    return { label, positions, before, after, sections: diffs, blockEntities };
  }
};
function mergeCommands(label, commands) {
  const staging = new Staging();
  for (const c of commands) {
    forEachChange(c, (x, y, z, before, after) => staging.record(x, y, z, before, after));
    for (const e of c.blockEntities) staging.recordBlockEntity(e.x, e.y, e.z, e.before, e.after);
  }
  return staging.toCommand(label);
}
function checkCoordinate(axis, v) {
  if (!Number.isSafeInteger(v) || Math.abs(v) > 2147483647) {
    throw new EditError(`axis ${axis}: coordinate ${v} is not a 32-bit integer`);
  }
}
var hasNbt = (block) => block.includes("{");
var baseState = (block) => {
  const brace = block.indexOf("{");
  return brace === -1 ? block : block.slice(0, brace);
};
var CommandBuilder = class {
  staging = new Staging();
  maxExtent;
  volume;
  label;
  constructor(volume, label, options = {}) {
    this.volume = volume;
    this.label = label;
    this.maxExtent = options.maxExtent ?? MAX_EXTENT;
  }
  /** Palette index at a cell as it will be once the builder's writes are applied. */
  indexAt(x, y, z) {
    return this.staging.peek(x, y, z) ?? this.volume.indexAt(x, y, z);
  }
  /** The block entity at a cell as it will be once the builder's writes are applied. */
  blockEntityAt(x, y, z) {
    const staged = this.staging.blockEntityStage(x, y, z);
    return staged === void 0 ? this.volume.blockEntityAt(x, y, z) : staged.after;
  }
  /** Set a cell's block entity (or remove it with `undefined`). The cell must end up holding a block. */
  setBlockEntity(x, y, z, entity) {
    checkCoordinate("x", x);
    checkCoordinate("y", y);
    checkCoordinate("z", z);
    if (entity !== void 0 && this.indexAt(x, y, z) === UNSET) {
      throw new EditError(`no block at ${x}, ${y}, ${z} to attach a block entity to`);
    }
    this.staging.recordBlockEntity(x, y, z, this.volume.blockEntityAt(x, y, z), entity);
  }
  /**
   * Write a palette index (or {@link UNSET}) unconditionally. The cell keeps
   * its block entity if it holds a block of the same name afterwards, and
   * loses it otherwise.
   */
  setIndex(x, y, z, index) {
    checkCoordinate("x", x);
    checkCoordinate("y", y);
    checkCoordinate("z", z);
    if (index !== UNSET && this.volume.palette[index] === void 0) {
      throw new EditError(`palette index ${index} is not in the volume's palette`);
    }
    const prev = this.indexAt(x, y, z);
    if (prev !== index && this.blockEntityAt(x, y, z) !== void 0) {
      const keeps = index !== UNSET && prev !== UNSET && blockIdOf(this.volume.palette[prev]) === blockIdOf(this.volume.palette[index]);
      if (!keeps) this.setBlockEntity(x, y, z, void 0);
    }
    this.staging.record(x, y, z, this.volume.indexAt(x, y, z), index);
  }
  /** Write a palette index together with exactly this block entity (or none). */
  setCell(x, y, z, index, entity) {
    this.setIndex(x, y, z, index);
    if (entity !== void 0 || this.blockEntityAt(x, y, z) !== void 0) {
      this.setBlockEntity(x, y, z, index === UNSET ? void 0 : entity);
    }
  }
  /** Write a block string, adding it to the palette. */
  setBlock(x, y, z, block) {
    this.setIndex(x, y, z, this.volume.intern(block));
  }
  /**
   * Place a block, keeping the block entity of a block that is already in
   * the same state: if the target has no NBT of its own and the cell holds
   * the same name and properties, nothing changes.
   */
  place(x, y, z, index) {
    const current = this.indexAt(x, y, z);
    if (current !== UNSET && current !== index) {
      const next = this.volume.palette[index];
      const old = this.volume.palette[current];
      if (!hasNbt(next) && baseState(old) === next) return;
    }
    this.setIndex(x, y, z, index);
  }
  /** Make a cell unset. */
  unset(x, y, z) {
    this.setIndex(x, y, z, UNSET);
  }
  /**
   * Freeze the recorded edits. Throws {@link EditError} if they would grow
   * the volume past the size limit on an axis (a volume that is already
   * larger may keep its size but not grow further).
   */
  finish() {
    const command = this.staging.toCommand(this.label);
    if (!isEmptyCommand(command)) this.checkGrowth(command);
    return command;
  }
  checkGrowth(command) {
    let grows = false;
    forEachChange(command, (_x, _y, _z, before, after) => {
      if (before === UNSET && after !== UNSET) grows = true;
    });
    if (!grows) return;
    const now = this.volume.placedBounds();
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    const note = (x, y, z) => {
      if (x < lo[0]) lo[0] = x;
      if (y < lo[1]) lo[1] = y;
      if (z < lo[2]) lo[2] = z;
      if (x > hi[0]) hi[0] = x;
      if (y > hi[1]) hi[1] = y;
      if (z > hi[2]) hi[2] = z;
    };
    let shrinks = false;
    this.staging.eachChanged((x, y, z, after) => {
      if (after !== UNSET) {
        note(x, y, z);
      } else if (now !== null && this.volume.indexAt(x, y, z) !== UNSET && (x === now[0][0] || x === now[1][0] || y === now[0][1] || y === now[1][1] || z === now[0][2] || z === now[1][2])) {
        shrinks = true;
      }
    });
    if (shrinks) {
      lo.fill(Infinity);
      hi.fill(-Infinity);
      this.staging.eachChanged((x, y, z, after) => {
        if (after !== UNSET) note(x, y, z);
      });
      this.volume.eachCell((x, y, z) => {
        if (this.staging.peek(x, y, z) === void 0) note(x, y, z);
      });
    } else if (now !== null) {
      note(now[0][0], now[0][1], now[0][2]);
      note(now[1][0], now[1][1], now[1][2]);
    }
    const names = ["x", "y", "z"];
    for (let a = 0; a < 3; a++) {
      const next = hi[a] - lo[a] + 1;
      if (next <= this.maxExtent) continue;
      const before = now === null ? 0 : now[1][a] - now[0][a] + 1;
      if (next > before) {
        throw new EditError(
          `this edit would make the volume ${next} blocks long along ${names[a]}; the limit is ${this.maxExtent}`
        );
      }
    }
  }
};

// packages/core/src/edit/blockstate.ts
var BOOLEAN = ["true", "false"];
var CARDINAL = ["north", "east", "south", "west"];
var SIX_FACES = ["north", "east", "south", "west", "up", "down"];
var range = (n2) => Array.from({ length: n2 }, (_, i) => String(i));
var KNOWN = {
  axis: [["x", "y", "z"]],
  facing: [CARDINAL, SIX_FACES],
  half: [
    ["top", "bottom"],
    ["upper", "lower"]
  ],
  type: [
    ["top", "bottom", "double"],
    ["single", "left", "right"],
    ["normal", "sticky"]
  ],
  shape: [
    ["straight", "inner_left", "inner_right", "outer_left", "outer_right"],
    [
      "north_south",
      "east_west",
      "ascending_east",
      "ascending_west",
      "ascending_north",
      "ascending_south",
      "south_east",
      "south_west",
      "north_west",
      "north_east"
    ]
  ],
  hinge: [["left", "right"]],
  part: [["head", "foot"]],
  face: [["floor", "wall", "ceiling"]],
  attachment: [["floor", "ceiling", "single_wall", "double_wall"]],
  mode: [["compare", "subtract"]],
  north: [
    ["none", "low", "tall"],
    ["up", "side", "none"]
  ],
  east: [
    ["none", "low", "tall"],
    ["up", "side", "none"]
  ],
  south: [
    ["none", "low", "tall"],
    ["up", "side", "none"]
  ],
  west: [
    ["none", "low", "tall"],
    ["up", "side", "none"]
  ],
  rotation: [range(16)],
  power: [range(16)]
};
function optionsFor(key, value) {
  if (BOOLEAN.includes(value)) return { options: BOOLEAN, exact: true };
  const sets = Object.hasOwn(KNOWN, key) ? KNOWN[key] : [];
  const set2 = sets.find((s) => s.includes(value));
  return set2 === void 0 ? { options: null, exact: false } : { options: set2, exact: false };
}
function blockProperties(state) {
  const { props } = parse(state);
  return [...props].map(([key, value]) => ({ key, value, ...optionsFor(key, value) }));
}
var TOKEN = /^[a-z0-9_]+$/;
function withBlockProperty(state, key, value) {
  if (!TOKEN.test(key)) throw new EditError(`invalid property name '${key}'`);
  if (!TOKEN.test(value)) throw new EditError(`invalid value '${value}' for property '${key}'`);
  const { name, props, nbt } = parse(state);
  const next = new Map(props);
  next.set(key, value);
  return join(name, next, nbt ?? "");
}
function setBlockProperty(volume, pos, key, value) {
  const idx = volume.indexAt(pos[0], pos[1], pos[2]);
  if (idx === UNSET) throw new EditError(`no block at ${pos.join(", ")} to edit`);
  const b = new CommandBuilder(volume, `set ${key}=${value}`);
  b.setBlock(pos[0], pos[1], pos[2], withBlockProperty(volume.palette[idx], key, value));
  return b.finish();
}

// packages/core/src/edit/box.ts
function makeBox(a, b) {
  return {
    min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])]
  };
}
function boxSize(box2) {
  return [box2.max[0] - box2.min[0] + 1, box2.max[1] - box2.min[1] + 1, box2.max[2] - box2.min[2] + 1];
}
function boxCellCount(box2) {
  const [w, h, l] = boxSize(box2);
  return w * h * l;
}
function boxContains(box2, x, y, z) {
  return x >= box2.min[0] && x <= box2.max[0] && y >= box2.min[1] && y <= box2.max[1] && z >= box2.min[2] && z <= box2.max[2];
}
function eachPosInBox(box2, fn) {
  for (let x = box2.min[0]; x <= box2.max[0]; x++) {
    for (let y = box2.min[1]; y <= box2.max[1]; y++) {
      for (let z = box2.min[2]; z <= box2.max[2]; z++) fn(x, y, z);
    }
  }
}
function eachCellInBox(volume, box2, fn) {
  if (boxCellCount(box2) <= volume.size * 8 + 4096) {
    eachPosInBox(box2, (x, y, z) => {
      const idx = volume.indexAt(x, y, z);
      if (idx >= 0) fn(x, y, z, idx);
    });
    return;
  }
  const hits = [];
  volume.eachCell((x, y, z, idx) => {
    if (boxContains(box2, x, y, z)) hits.push(x, y, z, idx);
  });
  for (let i = 0; i < hits.length; i += 4) {
    fn(hits[i], hits[i + 1], hits[i + 2], hits[i + 3]);
  }
}

// packages/core/src/edit/dirty.ts
var sectionKey2 = (sx, sy, sz) => `${sx},${sy},${sz}`;
function parseSectionKey(key) {
  const parts = key.split(",").map(Number);
  if (parts.length !== 3 || parts.some((n2) => !Number.isInteger(n2))) {
    throw new Error(`malformed section key '${key}'`);
  }
  return [parts[0], parts[1], parts[2]];
}
function offsets(local) {
  if (local === 0) return [0, -1];
  if (local === 15) return [0, 1];
  return [0];
}
function markBlockDirty(into, x, y, z) {
  const sx = x >> 4;
  const sy = y >> 4;
  const sz = z >> 4;
  for (const dx of offsets(x & 15)) {
    for (const dy of offsets(y & 15)) {
      for (const dz of offsets(z & 15)) into.add(sectionKey2(sx + dx, sy + dy, sz + dz));
    }
  }
}
function dirtySectionKeys(command, into = /* @__PURE__ */ new Set()) {
  forEachChange(command, (x, y, z) => markBlockDirty(into, x, y, z));
  return into;
}
var DirtyTracker = class {
  keys = /* @__PURE__ */ new Set();
  get size() {
    return this.keys.size;
  }
  has(key) {
    return this.keys.has(key);
  }
  markCommand(command) {
    dirtySectionKeys(command, this.keys);
  }
  markSection(sx, sy, sz) {
    this.keys.add(sectionKey2(sx, sy, sz));
  }
  /** Return the dirty keys and start empty. */
  take() {
    const out = [...this.keys];
    this.keys = /* @__PURE__ */ new Set();
    return out;
  }
};

// packages/core/src/edit/history.ts
var DEFAULT_HISTORY_BYTES = 64 * 1024 * 1024;
var History = class {
  maxBytes;
  undoStack = [];
  redoStack = [];
  total = 0;
  constructor(options = {}) {
    this.maxBytes = options.maxBytes ?? DEFAULT_HISTORY_BYTES;
  }
  get undoCount() {
    return this.undoStack.length;
  }
  get redoCount() {
    return this.redoStack.length;
  }
  /** Bytes held by both stacks. */
  get bytes() {
    return this.total;
  }
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  /** Labels of the undo stack, oldest first. */
  get undoLabels() {
    return this.undoStack.map((e) => e.command.label);
  }
  /**
   * Record a command that has already been applied. Clears the redo stack.
   * Returns how many old entries were dropped to stay in budget.
   */
  push(command) {
    for (const e of this.redoStack) this.total -= e.bytes;
    this.redoStack = [];
    const bytes = commandBytes(command);
    this.undoStack.push({ command, bytes });
    this.total += bytes;
    let drop = 0;
    while (this.total > this.maxBytes && drop < this.undoStack.length - 1) {
      this.total -= this.undoStack[drop].bytes;
      drop++;
    }
    if (drop > 0) this.undoStack.splice(0, drop);
    return drop;
  }
  /** Revert the latest command on `volume`. Returns it, or `null` if there is nothing to undo. */
  undo(volume) {
    const entry = this.undoStack.pop();
    if (entry === void 0) return null;
    revertCommand(volume, entry.command);
    this.redoStack.push(entry);
    return entry.command;
  }
  /** Re-apply the latest undone command. Returns it, or `null` if there is nothing to redo. */
  redo(volume) {
    const entry = this.redoStack.pop();
    if (entry === void 0) return null;
    applyCommand(volume, entry.command);
    this.undoStack.push(entry);
    return entry.command;
  }
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.total = 0;
  }
};

// packages/core/src/edit/editor.ts
var Stroke = class {
  applied = [];
  open = true;
  editor;
  label;
  constructor(editor, label) {
    this.editor = editor;
    this.label = label;
  }
  /** Apply a tool's command now. Build each one from the editor's current volume. */
  apply(command) {
    this.assertOpen();
    if (isEmptyCommand(command)) return;
    applyCommand(this.editor.volume, command);
    this.editor.dirty.markCommand(command);
    this.applied.push(command);
  }
  /** End the stroke and record it as one history entry. Returns false if it changed nothing. */
  commit() {
    this.assertOpen();
    this.open = false;
    const merged = mergeCommands(this.label, this.applied);
    if (isEmptyCommand(merged)) return false;
    this.editor.history.push(merged);
    return true;
  }
  /** End the stroke and undo everything it did. */
  cancel() {
    this.assertOpen();
    this.open = false;
    for (let i = this.applied.length - 1; i >= 0; i--) {
      const c = this.applied[i];
      revertCommand(this.editor.volume, c);
      this.editor.dirty.markCommand(c);
    }
  }
  assertOpen() {
    if (!this.open) throw new Error("stroke is already finished");
  }
};
var Editor = class {
  history;
  dirty = new DirtyTracker();
  clipboard = null;
  volume;
  constructor(volume, options = {}) {
    this.volume = volume;
    this.history = new History(options);
  }
  /** Apply a command, record it for undo and mark its sections dirty. Returns false if it was empty. */
  run(command) {
    if (isEmptyCommand(command)) return false;
    applyCommand(this.volume, command);
    this.dirty.markCommand(command);
    this.history.push(command);
    return true;
  }
  /** Begin a drag; see {@link Stroke}. */
  beginStroke(label) {
    return new Stroke(this, label);
  }
  undo() {
    const c = this.history.undo(this.volume);
    if (c === null) return false;
    this.dirty.markCommand(c);
    return true;
  }
  redo() {
    const c = this.history.redo(this.volume);
    if (c === null) return false;
    this.dirty.markCommand(c);
    return true;
  }
};

// packages/core/src/edit/pick.ts
function raycast(volume, origin, direction2, options = {}) {
  const maxDistance = options.maxDistance ?? 256;
  if (![...origin, ...direction2].every(Number.isFinite)) {
    throw new EditError("ray origin and direction must be finite");
  }
  const len = Math.hypot(direction2[0], direction2[1], direction2[2]);
  if (len === 0) throw new EditError("ray direction must not be zero");
  const dx = direction2[0] / len;
  const dy = direction2[1] / len;
  const dz = direction2[2] / len;
  let x = Math.floor(origin[0]);
  let y = Math.floor(origin[1]);
  let z = Math.floor(origin[2]);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = dx === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dy);
  const tDeltaZ = dz === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dz);
  let tMaxX = dx === 0 ? Number.POSITIVE_INFINITY : (dx > 0 ? x + 1 - origin[0] : origin[0] - x) * tDeltaX;
  let tMaxY = dy === 0 ? Number.POSITIVE_INFINITY : (dy > 0 ? y + 1 - origin[1] : origin[1] - y) * tDeltaY;
  let tMaxZ = dz === 0 ? Number.POSITIVE_INFINITY : (dz > 0 ? z + 1 - origin[2] : origin[2] - z) * tDeltaZ;
  const accept = options.accept;
  const solid = (cx, cy, cz) => {
    if (accept !== void 0 && !accept(cx, cy, cz)) return null;
    const block = volume.get(cx, cy, cz);
    return block === void 0 || AIR_BLOCKS.has(block) ? null : block;
  };
  const start = solid(x, y, z);
  if (start !== null) {
    return {
      position: [x, y, z],
      normal: [0, 0, 0],
      adjacent: [x, y, z],
      distance: 0,
      block: start
    };
  }
  for (; ; ) {
    let t;
    let normal;
    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      t = tMaxX;
      x += stepX;
      tMaxX += tDeltaX;
      normal = [0 - stepX, 0, 0];
    } else if (tMaxY <= tMaxZ) {
      t = tMaxY;
      y += stepY;
      tMaxY += tDeltaY;
      normal = [0, 0 - stepY, 0];
    } else {
      t = tMaxZ;
      z += stepZ;
      tMaxZ += tDeltaZ;
      normal = [0, 0, 0 - stepZ];
    }
    if (t > maxDistance) return null;
    const block = solid(x, y, z);
    if (block !== null) {
      return {
        position: [x, y, z],
        normal,
        adjacent: [x + normal[0], y + normal[1], z + normal[2]],
        distance: t,
        block
      };
    }
  }
}

// packages/core/src/rotation/rotation.ts
var ROTATIONS = ["NONE", "CLOCKWISE_90", "CLOCKWISE_180", "COUNTERCLOCKWISE_90"];
var RotationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "RotationError";
  }
};
var FACING_CW90 = { north: "east", east: "south", south: "west", west: "north" };
var FACING_CCW90 = { east: "north", south: "east", west: "south", north: "west" };
var FACING_180 = { north: "south", south: "north", east: "west", west: "east" };
var CARDINALS = ["north", "east", "south", "west"];
var own = (map, key) => key !== void 0 && Object.hasOwn(map, key) ? map[key] : void 0;
function checkRotation(rotation) {
  if (!ROTATIONS.includes(rotation)) {
    throw new RotationError(
      `invalid rotation '${rotation}'; expected one of [${ROTATIONS.map((r) => `'${r}'`).join(", ")}]`
    );
  }
  return rotation;
}
function rotatePoint(x, z, ax, az, rotation) {
  checkRotation(rotation);
  let rx = x - ax;
  let rz = z - az;
  if (rotation === "CLOCKWISE_90") [rx, rz] = [-rz, rx];
  else if (rotation === "COUNTERCLOCKWISE_90") [rx, rz] = [rz, -rx];
  else if (rotation === "CLOCKWISE_180") [rx, rz] = [-rx, -rz];
  return [ax + rx + 0, az + rz + 0];
}
function rotatePosition(x, z, size, rotation) {
  checkRotation(rotation);
  if (rotation === "NONE") return [x, z];
  if (rotation === "CLOCKWISE_90") return [size - 1 - z, x];
  if (rotation === "CLOCKWISE_180") return [size - 1 - x, size - 1 - z];
  return [z, size - 1 - x];
}
function facingMap(rotation) {
  if (rotation === "CLOCKWISE_90") return FACING_CW90;
  if (rotation === "COUNTERCLOCKWISE_90") return FACING_CCW90;
  if (rotation === "CLOCKWISE_180") return FACING_180;
  return null;
}
function permuteCardinalKeys(props, map) {
  const remapped = /* @__PURE__ */ new Map();
  for (const key of CARDINALS) {
    const v = props.get(key);
    if (v !== void 0) remapped.set(map[key] ?? key, v);
  }
  for (const key of CARDINALS) props.delete(key);
  for (const [k, v] of remapped) props.set(k, v);
}
function remapOrientation(props, map) {
  const ori = props.get("orientation");
  if (ori === void 0) return;
  const cut = ori.indexOf("_");
  const head = cut === -1 ? ori : ori.slice(0, cut);
  const tail = cut === -1 ? "" : ori.slice(cut);
  const next = own(map, head);
  if (next !== void 0) props.set("orientation", next + tail);
}
function remapProps(input, rotation) {
  const out = new Map(input);
  const map = facingMap(rotation);
  if (map !== null) {
    const next = own(map, out.get("facing"));
    if (next !== void 0) out.set("facing", next);
    permuteCardinalKeys(out, map);
    remapOrientation(out, map);
  }
  if (rotation === "CLOCKWISE_90" || rotation === "COUNTERCLOCKWISE_90") {
    const axis = out.get("axis");
    if (axis === "x") out.set("axis", "z");
    else if (axis === "z") out.set("axis", "x");
  }
  const rot = out.get("rotation");
  if (rot !== void 0 && /^-*[0-9]+$/.test(rot)) {
    const shift = { CLOCKWISE_90: 4, CLOCKWISE_180: 8, COUNTERCLOCKWISE_90: 12, NONE: 0 }[rotation];
    out.set("rotation", String(((Number.parseInt(rot, 10) + shift) % 16 + 16) % 16));
  }
  return out;
}
function split(canonical2) {
  let head = canonical2;
  let nbt = "";
  const brace = head.indexOf("{");
  if (brace !== -1) {
    nbt = head.slice(brace);
    head = head.slice(0, brace);
  }
  const props = /* @__PURE__ */ new Map();
  let name = head;
  const open = head.indexOf("[");
  const close = open === -1 ? -1 : head.indexOf("]", open);
  if (open !== -1 && close !== -1) {
    name = head.slice(0, open);
    for (const raw of head.slice(open + 1, close).split(",")) {
      const item = raw.trim();
      if (item === "") continue;
      const eq = item.indexOf("=");
      const key = (eq === -1 ? item : item.slice(0, eq)).trim();
      const value = eq === -1 ? "" : item.slice(eq + 1).trim();
      props.set(key, value);
    }
  }
  return { name, props, nbt };
}
function rejoin(name, props, nbt) {
  const built = props.size > 0 ? join(name, props, nbt) : name + nbt;
  return canonicalize(built);
}
function rotateBlockstate(canonical2, rotation) {
  checkRotation(rotation);
  if (rotation === "NONE") return canonicalize(canonical2);
  const { name, props, nbt } = split(canonical2);
  if (props.size === 0) return canonicalize(canonical2);
  return rejoin(name, remapProps(props, rotation), nbt);
}
var MIRROR_FACING = {
  x: { east: "west", west: "east" },
  z: { north: "south", south: "north" }
};
function mirrorBlockstate(canonical2, axis) {
  if (axis !== "x" && axis !== "z") {
    throw new RotationError(`invalid mirror axis '${String(axis)}'; expected 'x' or 'z'`);
  }
  const { name, props, nbt } = split(canonical2);
  if (props.size === 0) return canonicalize(canonical2);
  const swap = MIRROR_FACING[axis];
  const out = new Map(props);
  const next = own(swap, out.get("facing"));
  if (next !== void 0) out.set("facing", next);
  permuteCardinalKeys(out, swap);
  remapOrientation(out, swap);
  return rejoin(name, out, nbt);
}

// packages/core/src/edit/selection.ts
function clipboardCellCount(clip) {
  return clip.indices.length;
}
function copySelection(volume, box2) {
  const palette = [];
  const remap = /* @__PURE__ */ new Map();
  const offsets2 = [];
  const indices = [];
  const blockEntities = /* @__PURE__ */ new Map();
  eachCellInBox(volume, box2, (x, y, z, idx) => {
    let local = remap.get(idx);
    if (local === void 0) {
      local = palette.length;
      palette.push(volume.palette[idx]);
      remap.set(idx, local);
    }
    const entity = volume.blockEntityAt(x, y, z);
    if (entity !== void 0) {
      blockEntities.set(indices.length, { edition: entity.edition, nbt: cloneNbt(entity.nbt) });
    }
    offsets2.push(x - box2.min[0], y - box2.min[1], z - box2.min[2]);
    indices.push(local);
  });
  return {
    size: boxSize(box2),
    palette,
    offsets: Int32Array.from(offsets2),
    indices: Int32Array.from(indices),
    blockEntities
  };
}
function pasteClipboard(volume, clip, at, options = {}) {
  if (!at.every(Number.isInteger))
    throw new EditError("paste position must be integer coordinates");
  const b = new CommandBuilder(volume, "paste");
  const mapped = clip.palette.map(
    (p) => options.skipAir === true && AIR_BLOCKS.has(baseState(p)) ? UNSET : volume.intern(p)
  );
  for (let i = 0; i < clip.indices.length; i++) {
    const idx = mapped[clip.indices[i]];
    if (idx === UNSET) continue;
    const x = at[0] + clip.offsets[3 * i];
    const y = at[1] + clip.offsets[3 * i + 1];
    const z = at[2] + clip.offsets[3 * i + 2];
    b.place(x, y, z, idx);
    const entity = clip.blockEntities.get(i);
    b.setBlockEntity(
      x,
      y,
      z,
      entity === void 0 ? void 0 : { edition: entity.edition, nbt: cloneNbt(entity.nbt) }
    );
  }
  return b.finish();
}
function moveSelection(volume, box2, delta, options = {}) {
  if (!delta.every(Number.isInteger))
    throw new EditError("move offset must be integer coordinates");
  const b = new CommandBuilder(volume, "move");
  if (delta[0] === 0 && delta[1] === 0 && delta[2] === 0) return b.finish();
  const moved = [];
  const carried = [];
  eachCellInBox(volume, box2, (x, y, z, idx) => {
    moved.push(x, y, z, idx);
    carried.push(volume.blockEntityAt(x, y, z));
  });
  for (let i = 0; i < moved.length; i += 4) {
    b.unset(moved[i], moved[i + 1], moved[i + 2]);
  }
  for (let i = 0; i < moved.length; i += 4) {
    const idx = moved[i + 3];
    if (options.skipAir === true && AIR_BLOCKS.has(baseState(volume.palette[idx])))
      continue;
    b.setCell(
      moved[i] + delta[0],
      moved[i + 1] + delta[1],
      moved[i + 2] + delta[2],
      idx,
      carried[i / 4]
    );
  }
  return b.finish();
}
function rotatedBox(box2, rotation) {
  const [w, h, l] = boxSize(box2);
  const quarter = rotation === "CLOCKWISE_90" || rotation === "COUNTERCLOCKWISE_90";
  return {
    min: box2.min,
    max: [
      box2.min[0] + (quarter ? l : w) - 1,
      box2.min[1] + h - 1,
      box2.min[2] + (quarter ? w : l) - 1
    ]
  };
}
function rotateSelection(volume, box2, rotation, options = {}) {
  const b = new CommandBuilder(volume, `rotate ${rotation}`);
  const [w, , l] = boxSize(box2);
  const s = Math.max(w, l);
  const corners2 = [
    rotatePosition(0, 0, s, rotation),
    rotatePosition(w - 1, 0, s, rotation),
    rotatePosition(0, l - 1, s, rotation),
    rotatePosition(w - 1, l - 1, s, rotation)
  ];
  const shiftX = Math.min(...corners2.map((c) => c[0]));
  const shiftZ = Math.min(...corners2.map((c) => c[1]));
  return transformSelection(
    volume,
    box2,
    b,
    (lx, lz) => {
      const [rx, rz] = rotatePosition(lx, lz, s, rotation);
      return [rx - shiftX, rz - shiftZ];
    },
    (block) => rotateBlockstate(block, rotation),
    options.skipAir === true
  );
}
function mirrorSelection(volume, box2, axis) {
  if (axis !== "x" && axis !== "z") throw new EditError(`invalid mirror axis '${String(axis)}'`);
  const [w, , l] = boxSize(box2);
  const b = new CommandBuilder(volume, `mirror ${axis}`);
  return transformSelection(
    volume,
    box2,
    b,
    (lx, lz) => [axis === "x" ? w - 1 - lx : lx, axis === "z" ? l - 1 - lz : lz],
    (block) => mirrorBlockstate(block, axis)
  );
}
function transformSelection(volume, box2, b, movePos, mapBlock, skipAir = false) {
  const cells = [];
  const carried = [];
  eachCellInBox(volume, box2, (x, y, z, idx) => {
    cells.push(x, y, z, idx);
    carried.push(volume.blockEntityAt(x, y, z));
  });
  for (let i = 0; i < cells.length; i += 4) {
    b.unset(cells[i], cells[i + 1], cells[i + 2]);
  }
  const mapped = /* @__PURE__ */ new Map();
  for (let i = 0; i < cells.length; i += 4) {
    const idx = cells[i + 3];
    if (skipAir && AIR_BLOCKS.has(baseState(volume.palette[idx]))) continue;
    let next = mapped.get(idx);
    if (next === void 0) {
      next = volume.intern(mapBlock(volume.palette[idx]));
      mapped.set(idx, next);
    }
    const [nx, nz] = movePos(
      cells[i] - box2.min[0],
      cells[i + 2] - box2.min[2]
    );
    b.setCell(box2.min[0] + nx, cells[i + 1], box2.min[2] + nz, next, carried[i / 4]);
  }
  return b.finish();
}

// packages/core/src/edit/tools.ts
function checkInt(what, p) {
  if (!p.every(Number.isInteger)) throw new EditError(`${what} must be integer coordinates`);
}
function isEmptyBlock(block) {
  return block === void 0 || AIR_BLOCKS.has(baseState(block));
}
function placeBlock(volume, pos, block) {
  return placeCells(volume, [pos], block, "place");
}
function placeCells(volume, cells, block, label = "place") {
  const b = new CommandBuilder(volume, label);
  const idx = volume.intern(canonicalize(block));
  for (const p of cells) {
    checkInt("position", p);
    b.place(p[0], p[1], p[2], idx);
  }
  return b.finish();
}
function eraseBlock(volume, pos, options = {}) {
  return eraseCells(volume, [pos], options, "erase");
}
function eraseCells(volume, cells, options = {}, label = "erase") {
  const b = new CommandBuilder(volume, label);
  const air = options.toAir === true ? volume.intern("minecraft:air") : UNSET;
  for (const p of cells) {
    checkInt("position", p);
    if (b.indexAt(p[0], p[1], p[2]) === UNSET && air !== UNSET) continue;
    b.setIndex(p[0], p[1], p[2], air);
  }
  return b.finish();
}
function linePoints(a, b) {
  checkInt("line end", a);
  checkInt("line end", b);
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const n2 = Math.max(Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2]));
  if (n2 === 0) return [[a[0], a[1], a[2]]];
  const step = [Math.sign(d[0]), Math.sign(d[1]), Math.sign(d[2])];
  const abs = [Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2])];
  const err = [Math.floor(n2 / 2), Math.floor(n2 / 2), Math.floor(n2 / 2)];
  const cur = [a[0], a[1], a[2]];
  const out = [[cur[0], cur[1], cur[2]]];
  for (let i = 0; i < n2; i++) {
    for (let k = 0; k < 3; k++) {
      err[k] = err[k] - abs[k];
      if (err[k] < 0) {
        cur[k] = cur[k] + step[k];
        err[k] = err[k] + n2;
      }
    }
    out.push([cur[0], cur[1], cur[2]]);
  }
  return out;
}
function drawLine(volume, a, b, block) {
  return placeCells(volume, linePoints(a, b), block, "line");
}
var AXES = ["x", "y", "z"];
function drawRectangle(volume, a, b, block, options = {}) {
  checkInt("rectangle corner", a);
  checkInt("rectangle corner", b);
  const normal = options.normal ?? AXES.find((_, i) => a[i] === b[i]) ?? "y";
  const n2 = AXES.indexOf(normal);
  const lo = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
  const hi = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
  lo[n2] = a[n2];
  hi[n2] = a[n2];
  const box2 = makeBox(lo, hi);
  const [u, v] = [0, 1, 2].filter((i) => i !== n2);
  const cells = [];
  eachPosInBox(box2, (x, y, z) => {
    const p = [x, y, z];
    if (options.hollow === true && p[u] !== lo[u] && p[u] !== hi[u] && p[v] !== lo[v] && p[v] !== hi[v]) {
      return;
    }
    cells.push([x, y, z]);
  });
  return placeCells(
    volume,
    cells,
    block,
    options.hollow === true ? "hollow rectangle" : "rectangle"
  );
}
function drawBox(volume, a, b, block, options = {}) {
  checkInt("box corner", a);
  checkInt("box corner", b);
  const box2 = makeBox(a, b);
  const label = options.hollow === true ? "hollow box" : "box";
  const b2 = new CommandBuilder(volume, label);
  const idx = volume.intern(canonicalize(block));
  eachPosInBox(box2, (x, y, z) => {
    if (options.hollow === true && x !== box2.min[0] && x !== box2.max[0] && y !== box2.min[1] && y !== box2.max[1] && z !== box2.min[2] && z !== box2.max[2]) {
      return;
    }
    b2.place(x, y, z, idx);
  });
  return b2.finish();
}
function fillSelection(volume, box2, block, options = {}) {
  const b = new CommandBuilder(volume, "fill");
  const idx = volume.intern(canonicalize(block));
  eachPosInBox(box2, (x, y, z) => {
    if (options.onlyEmpty === true) {
      const cur = b.indexAt(x, y, z);
      if (!isEmptyBlock(cur === UNSET ? void 0 : volume.palette[cur])) return;
    }
    b.place(x, y, z, idx);
  });
  return b.finish();
}
function replaceInSelection(volume, box2, from, to) {
  const wanted = canonicalize(from);
  const wantsExact = wanted.includes("{");
  const b = new CommandBuilder(volume, "replace");
  const idx = volume.intern(canonicalize(to));
  eachCellInBox(volume, box2, (x, y, z, cur) => {
    const block = volume.palette[cur];
    if (wantsExact ? block === wanted : baseState(block) === wanted) b.place(x, y, z, idx);
  });
  return b.finish();
}

// packages/core/src/edit/util.ts
function cloneVolume(source) {
  const copy = new Volume();
  for (const block of source.palette) copy.intern(block);
  source.eachCell((x, y, z, idx) => copy.setIndex(x, y, z, idx));
  source.eachBlockEntity(
    (x, y, z, e) => copy.setBlockEntity(x, y, z, { edition: e.edition, nbt: cloneNbt(e.nbt) })
  );
  for (const e of source.entities) copy.addEntity({ edition: e.edition, nbt: cloneNbt(e.nbt) });
  return copy;
}

// packages/mcbuilder/src/sha256.ts
var K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var rotr = (x, n2) => x >>> n2 | x << 32 - n2;
function sha256(data) {
  const bitLen = data.length * 8;
  const padded = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64);
  padded.set(data);
  padded[data.length] = 128;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
  view.setUint32(padded.length - 4, bitLen >>> 0);
  const h = new Uint32Array([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ w15 >>> 3;
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ w2 >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = e & f ^ ~e & g;
      const t1 = hh + S1 + ch + K[i] + w[i] | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const t2 = S0 + maj | 0;
      hh = g;
      g = f;
      f = e;
      e = d + t1 | 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 | 0;
    }
    h[0] = h[0] + a | 0;
    h[1] = h[1] + b | 0;
    h[2] = h[2] + c | 0;
    h[3] = h[3] + d | 0;
    h[4] = h[4] + e | 0;
    h[5] = h[5] + f | 0;
    h[6] = h[6] + g | 0;
    h[7] = h[7] + hh | 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i]);
  return out;
}

// packages/mcbuilder/src/materials.ts
function pyStr(v) {
  if (v === null || v === void 0) return "None";
  return String(v);
}
function entries(spec) {
  if (!Array.isArray(spec)) {
    throw new McbuilderError(
      `invalid material spec ${JSON.stringify(spec)}: expected a block string, a sequence of block strings / (block, weight) pairs, or a callable (x, y, z) -> str`
    );
  }
  const out = [];
  for (const e of spec) {
    if (typeof e === "string") {
      out.push([canonicalize(e), 1]);
    } else if (Array.isArray(e) && e.length === 2 && typeof e[0] === "string") {
      const w = e[1];
      if (typeof w !== "number" || Number.isNaN(w)) {
        throw new McbuilderError(`invalid palette weight ${String(w)} for '${e[0]}'`);
      }
      if (w < 0) throw new McbuilderError(`negative palette weight ${w} for '${e[0]}'`);
      out.push([canonicalize(e[0]), w]);
    } else {
      throw new McbuilderError(
        `invalid palette entry ${JSON.stringify(e)}: expected a block string or a (block, weight) pair`
      );
    }
  }
  if (out.length === 0) throw new McbuilderError("material palette is empty");
  if (sum(out) <= 0) throw new McbuilderError("material palette weights sum to zero");
  return out;
}
var sum = (es) => es.reduce((acc, [, w]) => acc + w, 0);
function unitHash(...key) {
  const bytes = sha256(new TextEncoder().encode(key.map(pyStr).join("\0")));
  let n2 = 0n;
  for (let i = 0; i < 8; i++) n2 = n2 << 8n | BigInt(bytes[i]);
  return Number(n2) / 2 ** 64;
}
function pick(es, r) {
  const target = r * sum(es);
  let acc = 0;
  for (const [block, w] of es) {
    acc += w;
    if (target < acc) return block;
  }
  return es[es.length - 1][0];
}
function resolveMaterial(spec, x, y, z, seed) {
  if (typeof spec === "string") return canonicalize(spec);
  if (typeof spec === "function") return canonicalize(spec(x, y, z));
  return pick(entries(spec), unitHash(seed, x, y, z));
}
function patches(palette, options = {}) {
  const scale = options.scale ?? 4;
  const salt = options.salt ?? "";
  const es = entries(palette);
  if (!(scale > 0)) throw new McbuilderError(`patches: scale must be > 0, got ${scale}`);
  const lattice = (ix, iy, iz) => unitHash("patches", salt, ix, iy, iz);
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y, z) => {
    const fx = x / scale;
    const fy = y / scale;
    const fz = z / scale;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const iz = Math.floor(fz);
    const tx = smooth(fx - ix);
    const ty = smooth(fy - iy);
    const tz = smooth(fz - iz);
    let v = 0;
    for (const [dx, wx] of [
      [0, 1 - tx],
      [1, tx]
    ]) {
      for (const [dy, wy] of [
        [0, 1 - ty],
        [1, ty]
      ]) {
        for (const [dz, wz] of [
          [0, 1 - tz],
          [1, tz]
        ]) {
          v += wx * wy * wz * lattice(ix + dx, iy + dy, iz + dz);
        }
      }
    }
    return v;
  };
  const equalize = (value) => {
    const v = Math.min(1, Math.max(0, (value - 0.5) * 1.7 + 0.5));
    return Math.min(0.999999, smooth(v));
  };
  return (x, y, z) => pick(es, equalize(noise(x, y, z)));
}

// packages/mcbuilder/src/geometry.ts
function checkInts(what, ...values) {
  for (const v of values) {
    if (typeof v !== "number" || !Number.isInteger(v)) {
      throw new TypeError(`${what} must be ints, got ${String(v)}`);
    }
  }
}
var Geometry = class _Geometry {
  cellList = [];
  /** Add one block (any material spec) at `(dx, dy, dz)`. */
  set(dx, dy, dz, block) {
    checkInts("geometry coordinates", dx, dy, dz);
    this.cellList.push([dx, dy, dz, resolveMaterial(block, dx, dy, dz)]);
  }
  /** Combine two geometries; later cells win on overlap when stamped. */
  concat(other) {
    const out = new _Geometry();
    out.cellList = [...this.cellList, ...other.cellList];
    return out;
  }
  /** Translate every cell. Block states are untouched. */
  shift(dx, dy, dz) {
    checkInts("shift offsets", dx, dy, dz);
    const out = new _Geometry();
    out.cellList = this.cellList.map(([x, y, z, b]) => [x + dx, y + dy, z + dz, b]);
    return out;
  }
  /**
   * Rotate every cell about `anchor`, clockwise viewed from above. Block
   * states rotate too, so a rotated stair assembly keeps pointing the right way.
   */
  rotate(rotation = "CLOCKWISE_90", anchor = [0, 0, 0]) {
    const [ax, , az] = anchor;
    checkInts("rotate: anchor coordinates", ...anchor);
    const out = new _Geometry();
    for (const [x, y, z, b] of this.cellList) {
      const [rx, rz] = rotatePoint(x, z, ax, az, rotation);
      out.cellList.push([rx, y, rz, rotateBlockstate(b, rotation)]);
    }
    return out;
  }
  /** Mirror across the `axis` plane through the origin (`x` maps x to -x, `z` maps z to -z). */
  mirror(axis = "x") {
    if (axis !== "x" && axis !== "z") {
      throw new TypeError(`mirror: axis must be 'x' or 'z', got ${String(axis)}`);
    }
    const out = new _Geometry();
    for (const [x, y, z, b] of this.cellList) {
      out.cellList.push(
        axis === "x" ? [0 - x, y, z, mirrorBlockstate(b, axis)] : [x, y, 0 - z, mirrorBlockstate(b, axis)]
      );
    }
    return out;
  }
  /** Remove every cell in the inclusive relative box `c1`..`c2`. Corners may be in any order. */
  carve(c1, c2) {
    checkInts("carve: corner coordinates", ...c1, ...c2);
    const [lx, hx] = [Math.min(c1[0], c2[0]), Math.max(c1[0], c2[0])];
    const [ly, hy] = [Math.min(c1[1], c2[1]), Math.max(c1[1], c2[1])];
    const [lz, hz] = [Math.min(c1[2], c2[2]), Math.max(c1[2], c2[2])];
    const out = new _Geometry();
    out.cellList = this.cellList.filter(
      ([x, y, z]) => !(lx <= x && x <= hx && ly <= y && y <= hy && lz <= z && z <= hz)
    );
    return out;
  }
  /** The relative placements, in the order they were added. */
  cells() {
    return [...this.cellList];
  }
  get length() {
    return this.cellList.length;
  }
  /** Inclusive relative bounding box, or `null` when empty. */
  bounds() {
    if (this.cellList.length === 0) return null;
    let [x0, y0, z0] = this.cellList[0];
    let [x1, y1, z1] = [x0, y0, z0];
    for (const [x, y, z] of this.cellList) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (z < z0) z0 = z;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
      if (z > z1) z1 = z;
    }
    return [
      [x0, y0, z0],
      [x1, y1, z1]
    ];
  }
  /** @internal Used by `Build.place`; cells are already resolved. */
  static fromCells(cells) {
    const g = new _Geometry();
    g.cellList = cells;
    return g;
  }
};

// packages/mcbuilder/src/rng.ts
var Rng = class _Rng {
  a;
  b;
  c;
  d;
  /** Seed from any string. Equal strings give equal sequences. */
  constructor(seed) {
    const h = new DataView(sha256(new TextEncoder().encode(seed)).buffer);
    this.a = h.getUint32(0);
    this.b = h.getUint32(4);
    this.c = h.getUint32(8);
    this.d = h.getUint32(12);
    for (let i = 0; i < 12; i++) this.nextUint32();
  }
  /** A generator seeded from the system's entropy source. */
  static unseeded() {
    const words = globalThis.crypto.getRandomValues(new Uint32Array(4));
    return new _Rng(Array.from(words).join(","));
  }
  nextUint32() {
    const t = (this.a + this.b | 0) + this.d | 0;
    this.d = this.d + 1 | 0;
    this.a = this.b ^ this.b >>> 9;
    this.b = this.c + (this.c << 3) | 0;
    this.c = this.c << 21 | this.c >>> 11;
    this.c = this.c + t | 0;
    return t >>> 0;
  }
  /** A float in [0, 1). */
  random() {
    return this.nextUint32() / 4294967296;
  }
  /** A float in [a, b). */
  uniform(a, b) {
    return a + (b - a) * this.random();
  }
  /** An integer in [lo, hi], both inclusive. */
  int(lo, hi) {
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi < lo) {
      throw new RangeError(`int: need integers with hi >= lo, got ${lo}, ${hi}`);
    }
    return lo + Math.floor(this.random() * (hi - lo + 1));
  }
  choice(items) {
    if (items.length === 0) throw new RangeError("choice: empty sequence");
    return items[Math.floor(this.random() * items.length)];
  }
  /** Fisher-Yates shuffle, in place. */
  shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
};

// packages/mcbuilder/src/shapes.ts
var shapes_exports = {};
__export(shapes_exports, {
  DIRECTIONS: () => DIRECTIONS,
  arch: () => arch,
  box: () => box,
  cone: () => cone,
  cylinder: () => cylinder,
  line: () => line,
  parapet: () => parapet,
  pillar: () => pillar,
  railing: () => railing,
  roofGable: () => roofGable,
  roofHip: () => roofHip,
  skirtRoof: () => skirtRoof,
  sphere: () => sphere,
  stairs: () => stairs,
  stairsRun: () => stairsRun,
  walls: () => walls
});
var DIRECTIONS = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0]
};
var isInt = (v) => typeof v === "number" && Number.isInteger(v);
var show = (v) => Array.isArray(v) ? `[${v.join(", ")}]` : String(v);
function point(what, p) {
  if (!Array.isArray(p) || p.length !== 3)
    throw new McbuilderError(`${what} must be 3 ints, got ${show(p)}`);
  if (!p.every(isInt)) throw new McbuilderError(`${what} coordinates must be ints, got ${show(p)}`);
  return p;
}
function corners(what, c1, c2) {
  const [x1, y1, z1] = point(`${what}: c1`, c1);
  const [x2, y2, z2] = point(`${what}: c2`, c2);
  return [
    [Math.min(x1, x2), Math.min(y1, y2), Math.min(z1, z2)],
    [Math.max(x1, x2), Math.max(y1, y2), Math.max(z1, z2)]
  ];
}
function positive(what, v, minimum = 1) {
  if (!isInt(v) || v < minimum)
    throw new McbuilderError(`${what} must be an int >= ${minimum}, got ${show(v)}`);
  return v;
}
function direction(what, d) {
  const key = String(d).toLowerCase();
  if (!Object.hasOwn(DIRECTIONS, key)) {
    throw new McbuilderError(
      `${what}: invalid direction ${d}; expected one of [${Object.keys(DIRECTIONS).sort().join(", ")}]`
    );
  }
  return key;
}
function withProps(block, extra) {
  const { name, props, nbt } = parse(block);
  const merged = new Map(props);
  for (const [k, v] of Object.entries(extra)) merged.set(k, v);
  return canonicalize(join(name, merged, nbt ?? ""));
}
var Painter = class {
  geo = new Geometry();
  plain;
  block;
  seed;
  constructor(block, seed) {
    this.block = block;
    this.seed = seed;
    this.plain = typeof block === "string" ? canonicalize(block) : null;
  }
  blockAt(x, y, z) {
    return this.plain || resolveMaterial(this.block, x, y, z, this.seed);
  }
  put(x, y, z, extra) {
    const b = this.blockAt(x, y, z);
    this.geo.set(x, y, z, extra ? withProps(b, extra) : b);
  }
};
function stairMaterial(what, block, seed) {
  const at = (x, y, z) => {
    const b = resolveMaterial(block, x, y, z, seed);
    if (parse(b).props.has("facing")) {
      throw new McbuilderError(
        `${what} computes 'facing' from the geometry; pass the stair block without a facing property`
      );
    }
    return b;
  };
  at(0, 0, 0);
  return at;
}
function box(c1, c2, block, { seed } = {}) {
  const [[x1, y1, z1], [x2, y2, z2]] = corners("box", c1, c2);
  const p = new Painter(block, seed);
  for (let x = x1; x <= x2; x++)
    for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) p.put(x, y, z);
  return p.geo;
}
function walls(c1, c2, block, { seed } = {}) {
  const [[x1, y1, z1], [x2, y2, z2]] = corners("walls", c1, c2);
  const p = new Painter(block, seed);
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      for (let z = z1; z <= z2; z++) {
        if (x === x1 || x === x2 || z === z1 || z === z2) p.put(x, y, z);
      }
    }
  }
  return p.geo;
}
function pillar(base, height, block, { seed } = {}) {
  const [x, y, z] = point("pillar: base", base);
  const h = positive("pillar: height", height);
  return box([x, y, z], [x, y + h - 1, z], block, { seed });
}
var roundHalfUp = (v) => Math.floor(v + 0.5);
function line(p1, p2, block, { seed } = {}) {
  const a = point("line: p1", p1);
  const b = point("line: p2", p2);
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const n2 = Math.max(Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2]));
  const pts = [];
  for (let k = 0; k <= n2; k++) {
    pts.push(
      [0, 1, 2].map(
        (i) => n2 ? roundHalfUp(a[i] + d[i] * k / n2) : a[i]
      )
    );
  }
  const cells = [pts[0]];
  for (const nxt of pts.slice(1)) {
    const cur = [...cells[cells.length - 1]];
    while (cur[0] !== nxt[0] || cur[1] !== nxt[1] || cur[2] !== nxt[2]) {
      for (let i = 0; i < 3; i++) {
        if (cur[i] !== nxt[i]) {
          cur[i] += nxt[i] > cur[i] ? 1 : -1;
          break;
        }
      }
      cells.push([cur[0], cur[1], cur[2]]);
    }
  }
  const p = new Painter(block, seed);
  for (const [x, y, z] of cells) p.put(x, y, z);
  return p.geo;
}
function stairs(start, dir, block, options = {}) {
  const [sx, sy, sz] = point("stairs: start", start);
  const key = direction("stairs", dir);
  const [dx, dz] = DIRECTIONS[key];
  let length = options.length;
  if (length === void 0 === (options.target === void 0)) {
    throw new McbuilderError("stairs: give exactly one of length or target");
  }
  if (options.target !== void 0) {
    const [tx, ty, tz] = point("stairs: target", options.target);
    const rise = ty - sy;
    const along = dx * (tx - sx) + dz * (tz - sz);
    const across = dz * (tx - sx) - dx * (tz - sz);
    if (rise < 0 || along !== rise || across !== 0) {
      throw new McbuilderError(
        `stairs: target [${options.target.join(", ")}] is not on the 1:1 diagonal from [${start.join(", ")}] climbing ${key}`
      );
    }
    length = rise + 1;
  }
  const len = positive("stairs: length", length);
  const width = positive("stairs: width", options.width ?? 1);
  const [px, pz] = dx ? [0, 1] : [1, 0];
  const stair = stairMaterial("stairs", block, options.seed);
  const geo = new Geometry();
  for (let i = 0; i < len; i++) {
    for (let w = 0; w < width; w++) {
      const x = sx + i * dx + w * px;
      const y = sy + i;
      const z = sz + i * dz + w * pz;
      geo.set(x, y, z, withProps(stair(x, y, z), { facing: key, half: "bottom" }));
    }
  }
  return geo;
}
function stairsRun(start, dir, block, options = {}) {
  return stairs(start, dir, block, options);
}
function railing(start, end, block, { seed } = {}) {
  const [x1, y1, z1] = point("railing: start", start);
  const [x2, y2, z2] = point("railing: end", end);
  if (y1 !== y2) {
    throw new McbuilderError(
      `railing: start and end must share the same y level (got y=${y1} and y=${y2})`
    );
  }
  if (x1 !== x2 && z1 !== z2) {
    throw new McbuilderError(
      `railing: run must be axis-aligned (x or z constant); got start=${show(start)} end=${show(end)}`
    );
  }
  return line(start, end, block, { seed });
}
function cylinder(center, radius, height, block, options = {}) {
  const [cx, cy, cz] = point("cylinder: center", center);
  const r = positive("cylinder: radius", radius);
  const hgt = positive("cylinder: height", height);
  const axis = options.axis ?? "y";
  if (axis !== "x" && axis !== "y" && axis !== "z") {
    throw new McbuilderError(`cylinder: axis must be 'x', 'y' or 'z', got ${String(axis)}`);
  }
  const shell = new Painter(block, options.seed);
  const inner = options.fill ? new Painter(options.fill, options.seed) : null;
  const r2 = r * r;
  const in2 = (r - 1) ** 2;
  for (let h = 0; h < hgt; h++) {
    for (let a = -r; a <= r; a++) {
      for (let b = -r; b <= r; b++) {
        const d2 = a * a + b * b;
        if (d2 > r2) continue;
        const pos = axis === "y" ? [cx + a, cy + h, cz + b] : axis === "x" ? [cx + h, cy + a, cz + b] : [cx + a, cy + b, cz + h];
        if (options.hollow && d2 <= in2) {
          if (inner) inner.put(...pos);
        } else {
          shell.put(...pos);
        }
      }
    }
  }
  return inner ? inner.geo.concat(shell.geo) : shell.geo;
}
function sphere(center, radius, block, options = {}) {
  const [cx, cy, cz] = point("sphere: center", center);
  const r = positive("sphere: radius", radius);
  const thickness = positive("sphere: thickness", options.thickness ?? 1);
  const shell = new Painter(block, options.seed);
  const inner = options.fill ? new Painter(options.fill, options.seed) : null;
  const r2 = r * r;
  const in2 = Math.max(0, r - thickness) ** 2;
  for (let x = cx - r; x <= cx + r; x++) {
    for (let y = options.dome ? cy : cy - r; y <= cy + r; y++) {
      for (let z = cz - r; z <= cz + r; z++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
        if (d2 > r2) continue;
        if (options.hollow && d2 <= in2) {
          if (inner) inner.put(x, y, z);
        } else {
          shell.put(x, y, z);
        }
      }
    }
  }
  return inner ? inner.geo.concat(shell.geo) : shell.geo;
}
function cone(center, radius, height, block, options = {}) {
  const [cx, cy, cz] = point("cone: center", center);
  const rad = positive("cone: radius", radius);
  const hgt = positive("cone: height", height);
  const p = new Painter(block, options.seed);
  for (let i = 0; i < hgt; i++) {
    const r = rad * (hgt - i) / hgt;
    const ri = Math.ceil(r);
    for (let x = cx - ri; x <= cx + ri; x++) {
      for (let z = cz - ri; z <= cz + ri; z++) {
        const d2 = (x - cx) ** 2 + (z - cz) ** 2;
        if (d2 > r * r) continue;
        const interior = d2 <= Math.max(0, r - 1) ** 2;
        if (options.hollow && interior && !(r < 1 && d2 === 0)) continue;
        p.put(x, cy + i, z);
      }
    }
  }
  return p.geo;
}
var halfDefault = (block) => parse(block).props.has("half") ? {} : { half: "bottom" };
function roofGable(c1, c2, block, options) {
  const { ridge, seed } = options;
  if (ridge !== "x" && ridge !== "z") {
    throw new McbuilderError(`roof_gable: ridge must be 'x' or 'z', got ${String(ridge)}`);
  }
  const [[x1, y0, z1], [x2, , z2]] = corners("roof_gable", c1, c2);
  const body = stairMaterial("roof_gable", block, seed);
  const verge = options.verge ? stairMaterial("roof_gable", options.verge, seed) : null;
  const eave = options.eave ? stairMaterial("roof_gable", options.eave, seed) : null;
  const [lo, hi, runLo, runHi, faceLo, faceHi] = ridge === "x" ? [z1, z2, x1, x2, "south", "north"] : [x1, x2, z1, z2, "east", "west"];
  const span = hi - lo + 1;
  const geo = new Geometry();
  const put = (across, run, row, facing) => {
    const [x, z] = ridge === "x" ? [run, across] : [across, run];
    const y = y0 + row;
    let mat = body;
    if (verge && (run === runLo || run === runHi)) mat = verge;
    else if (eave && row === 0) mat = eave;
    const b = mat(x, y, z);
    geo.set(x, y, z, withProps(b, { facing, ...halfDefault(b) }));
  };
  for (let row = 0; row < Math.floor(span / 2); row++) {
    for (let run = runLo; run <= runHi; run++) {
      put(lo + row, run, row, faceLo);
      put(hi - row, run, row, faceHi);
    }
  }
  if (span % 2) {
    const row = Math.floor(span / 2);
    for (let run = runLo; run <= runHi; run++)
      put(lo + row, run, row, faceHi);
  }
  return geo;
}
function roofHip(c1, c2, block, options) {
  const [[x1, y0, z1], [x2, , z2]] = corners("roof_hip", c1, c2);
  const stair = stairMaterial("roof_hip", block, options.seed);
  const hipP = new Painter(options.hip, options.seed);
  const capP = new Painter(options.cap ?? options.hip, options.seed);
  const geo = new Geometry();
  let k = 0;
  while (x1 + k <= x2 - k && z1 + k <= z2 - k) {
    const [a, b, c, d, y] = [x1 + k, x2 - k, z1 + k, z2 - k, y0 + k];
    if (a === b || c === d) {
      for (let x = a; x <= b; x++) for (let z = c; z <= d; z++) capP.put(x, y, z);
      break;
    }
    for (let x = a + 1; x < b; x++) {
      geo.set(x, y, c, withProps(stair(x, y, c), { facing: "south", half: "bottom" }));
      geo.set(x, y, d, withProps(stair(x, y, d), { facing: "north", half: "bottom" }));
    }
    for (let z = c + 1; z < d; z++) {
      geo.set(a, y, z, withProps(stair(a, y, z), { facing: "east", half: "bottom" }));
      geo.set(b, y, z, withProps(stair(b, y, z), { facing: "west", half: "bottom" }));
    }
    for (const [x, z] of [
      [a, c],
      [b, c],
      [a, d],
      [b, d]
    ])
      hipP.put(x, y, z);
    k++;
  }
  return geo.concat(hipP.geo).concat(capP.geo);
}
function slabMaterial(what, block, seed) {
  const at = (x, y, z) => {
    const b = resolveMaterial(block, x, y, z, seed);
    if (parse(b).props.has("type")) {
      throw new McbuilderError(
        `${what} computes slab 'type' from the geometry; pass the slab block without a type property`
      );
    }
    return b;
  };
  at(0, 0, 0);
  return at;
}
var ARCH_PROFILES = ["stepped", "segmental", "pointed"];
function arch(start, width, block, options) {
  const [sx, sy, sz] = point("arch: start", start);
  const w = positive("arch: width", width, 2);
  const { axis, profile, seed } = options;
  if (axis !== "x" && axis !== "z") {
    throw new McbuilderError(`arch: axis must be 'x' or 'z', got ${String(axis)}`);
  }
  if (!ARCH_PROFILES.includes(profile)) {
    throw new McbuilderError(
      `arch: profile must be one of [${ARCH_PROFILES.join(", ")}], got ${String(profile)}`
    );
  }
  const depth = positive("arch: depth", options.depth ?? 1);
  const half = Math.floor(w / 2);
  let rise;
  if (profile === "segmental") {
    rise = positive("arch: rise", options.rise ?? 2, 2);
    if (w < 2 * rise - 1) {
      throw new McbuilderError(
        `arch: segmental with rise ${rise} needs width >= ${2 * rise - 1}, got ${w}; use 'stepped' or 'pointed' for a narrower span`
      );
    }
  } else if (profile === "pointed") {
    rise = half;
    if (options.rise !== void 0 && options.rise !== rise) {
      throw new McbuilderError(
        `arch: pointed closes at rise ${rise} for width ${w} (floor(width / 2)); got rise ${show(options.rise)}, use 'stepped' for a flat-topped staircase`
      );
    }
  } else {
    rise = positive("arch: rise", options.rise ?? Math.min(2, half));
    if (rise > half) {
      throw new McbuilderError(
        `arch: stepped with width ${w} allows rise <= ${half}, got ${rise}; the two sides would cross`
      );
    }
  }
  if (profile === "stepped" && options.slab !== void 0) {
    throw new McbuilderError("arch: slab is not used by the 'stepped' profile");
  }
  if (profile === "pointed" && options.slab === void 0) {
    throw new McbuilderError("arch: the 'pointed' profile requires a slab block");
  }
  const stair = stairMaterial("arch", block, seed);
  const slab = options.slab ? slabMaterial("arch", options.slab, seed) : null;
  const spandrel = options.fill ? new Painter(options.fill, seed) : null;
  const geo = new Geometry();
  const apexCap = profile === "pointed" && w % 2 === 1 ? slab : null;
  const [leftFacing, rightFacing] = axis === "x" ? ["west", "east"] : ["north", "south"];
  const cell = (col, row, layer) => axis === "x" ? [sx + col, sy + row, sz + layer] : [sx + layer, sy + row, sz + col];
  for (let layer = 0; layer < depth; layer++) {
    for (let row = 0; row < rise; row++) {
      const crown = profile === "segmental" && row === rise - 1;
      for (let col = 0; col < w; col++) {
        const [x, y, z] = cell(col, row, layer);
        if (col < row || col > w - 1 - row) {
          spandrel?.put(x, y, z);
        } else if (crown) {
          if (slab) geo.set(x, y, z, withProps(slab(x, y, z), { type: "bottom" }));
        } else if (apexCap && row === rise - 1 && col === half) {
          geo.set(x, y, z, withProps(apexCap(x, y, z), { type: "top" }));
        } else if (col === row || col === w - 1 - row) {
          const facing = col === row ? leftFacing : rightFacing;
          geo.set(x, y, z, withProps(stair(x, y, z), { facing, half: "top" }));
        }
      }
    }
  }
  return spandrel ? spandrel.geo.concat(geo) : geo;
}
function parapet(c1, c2, block, options = {}) {
  const [[x1, y0, z1], [x2, , z2]] = corners("parapet", c1, c2);
  const merlon = positive("parapet: merlon", options.merlon ?? 1);
  const crenel = positive("parapet: crenel", options.crenel ?? 1);
  const height = positive("parapet: height", options.height ?? 1);
  const base = positive("parapet: base", options.base ?? 1, 0);
  const { seed } = options;
  const corbel = options.corbel === void 0 ? null : stairMaterial("parapet", options.corbel, seed);
  if (corbel && (x1 === x2 || z1 === z2)) {
    throw new McbuilderError(
      "parapet: corbel needs a footprint at least 2 x 2; a straight run has no inside to step out from"
    );
  }
  const grow = corbel ? 1 : 0;
  const [rx1, rx2, rz1, rz2] = [x1 - grow, x2 + grow, z1 - grow, z2 + grow];
  const period = merlon + crenel;
  const isMerlon = (x, z) => {
    const onZEdge = z === rz1 || z === rz2 || rz1 === rz2;
    const d = onZEdge ? Math.min(x - rx1, rx2 - x) : Math.min(z - rz1, rz2 - z);
    return d % period < merlon;
  };
  const p = new Painter(block, seed);
  const geo = new Geometry();
  for (let x = rx1; x <= rx2; x++) {
    for (let z = rz1; z <= rz2; z++) {
      const onRing = x === rx1 || x === rx2 || z === rz1 || z === rz2;
      if (!onRing) continue;
      for (let row = 0; row < base; row++) p.put(x, y0 + row, z);
      if (isMerlon(x, z)) for (let row = 0; row < height; row++) p.put(x, y0 + base + row, z);
      if (corbel) {
        const facing = x === rx1 ? "east" : x === rx2 ? "west" : z === rz1 ? "south" : "north";
        geo.set(x, y0 - 1, z, withProps(corbel(x, y0 - 1, z), { facing, half: "top" }));
      }
    }
  }
  return geo.concat(p.geo);
}
function skirtRoof(c1, c2, block, options = {}) {
  const [[x1, y0, z1], [x2, , z2]] = corners("skirt_roof", c1, c2);
  const overhang = positive("skirt_roof: overhang", options.overhang ?? 2);
  const courses = positive("skirt_roof: courses", options.courses ?? 2, 0);
  const { seed } = options;
  let hole = null;
  if (options.hole !== void 0) {
    if (!Array.isArray(options.hole) || options.hole.length !== 2) {
      throw new McbuilderError(
        `skirt_roof: hole must be two corner points, got ${show(options.hole)}`
      );
    }
    const [[hx1, , hz1], [hx2, , hz2]] = corners("skirt_roof", options.hole[0], options.hole[1]);
    if (hx1 < x1 || hx2 > x2 || hz1 < z1 || hz2 > z2) {
      throw new McbuilderError(
        `skirt_roof: hole [${[hx1, hz1].join(", ")}]..[${[hx2, hz2].join(", ")}] (x, z) must lie inside the footprint [${[x1, z1].join(", ")}]..[${[x2, z2].join(", ")}]`
      );
    }
    hole = [hx1, hx2, hz1, hz2];
  }
  const slab = options.slab ? slabMaterial("skirt_roof", options.slab, seed) : null;
  const body = new Painter(block, seed);
  const rim = options.rim ? new Painter(options.rim, seed) : body;
  const dentil = options.dentil === null ? null : new Painter(options.dentil ?? block, seed);
  const geo = new Geometry();
  const [ox1, ox2, oz1, oz2] = [x1 - overhang, x2 + overhang, z1 - overhang, z2 + overhang];
  const r = y0 + (dentil ? 1 : 0);
  for (let x = ox1; x <= ox2; x++) {
    for (let z = oz1; z <= oz2; z++) {
      if (hole && x >= hole[0] && x <= hole[1] && z >= hole[2] && z <= hole[3]) continue;
      const ring = Math.min(x - ox1, ox2 - x, z - oz1, oz2 - z);
      if (ring === 0) {
        if (dentil) {
          const onZEdge = z === oz1 || z === oz2;
          const d = onZEdge ? Math.min(x - ox1, ox2 - x) : Math.min(z - oz1, oz2 - z);
          if (d % 2 === 0) dentil.put(x, y0, z);
        }
        rim.put(x, r, z);
        continue;
      }
      if (dentil) body.put(x, y0, z);
      const level = Math.min(ring, courses);
      const full = slab ? Math.floor(level / 2) : level;
      for (let row = 0; row <= full; row++) body.put(x, r + row, z);
      if (slab && level % 2 === 1) {
        const y = r + full + 1;
        geo.set(x, y, z, withProps(slab(x, y, z), { type: "bottom" }));
      }
    }
  }
  let out = geo.concat(body.geo);
  if (rim !== body) out = out.concat(rim.geo);
  if (dentil) out = out.concat(dentil.geo);
  return out;
}

// packages/mcbuilder/src/voxels.ts
var VoxelGrid = class _VoxelGrid {
  volume = new Volume();
  maxDims;
  overwrites = 0;
  constructor(maxDims = [256, 256, 256]) {
    if (maxDims.length !== 3 || maxDims.some((d) => !Number.isInteger(d) || d <= 0)) {
      throw new RangeError(`max_dims must be 3 positive ints, got [${maxDims.join(", ")}]`);
    }
    this.maxDims = [...maxDims];
  }
  /** Cells where a real block was replaced by a different real block. */
  get overwriteCount() {
    return this.overwrites;
  }
  checkBounds(x, y, z) {
    const axes = ["x", "y", "z"];
    [x, y, z].forEach((value, i) => {
      const allowed = this.maxDims[i];
      if (!(-allowed <= value && value < allowed)) {
        throw new GridBoundsError(
          `axis ${axes[i]}: coordinate ${value} out of bounds (allowed -${allowed}..${allowed - 1} for max dimension ${allowed})`
        );
      }
    });
  }
  /** Place a canonical block string. Last write wins. */
  place(x, y, z, canonical2) {
    for (const v of [x, y, z]) {
      if (typeof v !== "number" || !Number.isInteger(v)) {
        throw new TypeError(`voxel coordinates must be ints, got ${String(v)}`);
      }
    }
    this.checkBounds(x, y, z);
    const old = this.volume.get(x, y, z);
    if (old !== void 0 && old !== canonical2 && old !== AIR && canonical2 !== AIR) {
      this.overwrites++;
    }
    this.volume.set(x, y, z, canonical2);
  }
  /** Make a cell unset. */
  unset(x, y, z) {
    this.volume.unset(x, y, z);
  }
  /** Move every placed cell. */
  shift(dx, dy, dz) {
    this.volume.translate(dx, dy, dz);
  }
  /** Inclusive bounding box over non-air cells, or `null`. */
  bounds() {
    return this.volume.bounds();
  }
  /** The placed region as a dense array (see `Volume.toDense`). */
  toDense() {
    return this.volume.toDense();
  }
  /** A new grid with only the cells inside the box `c1`..`c2`. */
  crop(c1, c2) {
    const lo = [0, 1, 2].map((i) => Math.min(c1[i], c2[i]));
    const hi = [0, 1, 2].map((i) => Math.max(c1[i], c2[i]));
    const out = new _VoxelGrid(this.maxDims);
    this.volume.eachCell((x, y, z, idx) => {
      if (x >= lo[0] && x <= hi[0] && y >= lo[1] && y <= hi[1] && z >= lo[2] && z <= hi[2]) {
        out.place(x, y, z, this.volume.palette[idx]);
      }
    });
    return out;
  }
};

// packages/mcbuilder/src/build.ts
function ints(what, p) {
  if (!Array.isArray(p) || p.length !== 3)
    throw new BuildError(`${what} must be 3 ints, got ${String(p)}`);
  if (!p.every((v) => typeof v === "number" && Number.isInteger(v))) {
    throw new BuildError(`${what} coordinates must be ints, got [${p.join(", ")}]`);
  }
  return p;
}
var Build = class {
  seedValue;
  sharedRng = null;
  voxelGrid;
  depth = 0;
  views = null;
  constructor(options = {}) {
    this.seedValue = options.seed ?? null;
    this.voxelGrid = new VoxelGrid(options.maxDimensions ?? [256, 256, 256]);
    if (options.views !== void 0) this.setViews(options.views);
  }
  /** Run `fn` with placements enabled. Scopes nest. */
  scope(fn) {
    this.depth++;
    try {
      return fn(this);
    } finally {
      this.depth = Math.max(0, this.depth - 1);
    }
  }
  requireScope() {
    if (this.depth === 0) throw new BuildError("placements must be inside `build.scope(...)`");
  }
  // -- primitives -------------------------------------------------------------
  /** Place one block (any material spec). Last write wins. `minecraft:air` places explicit air. */
  set(x, y, z, block) {
    this.requireScope();
    this.voxelGrid.place(x, y, z, resolveMaterial(block, x, y, z, this.seedValue));
  }
  /** Make every placed cell in the box `c1`..`c2` unset, so pasting leaves the world untouched there. */
  carve(c1, c2) {
    this.requireScope();
    const [x1, y1, z1] = ints("carve: c1", c1);
    const [x2, y2, z2] = ints("carve: c2", c2);
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) this.voxelGrid.unset(x, y, z);
      }
    }
  }
  /**
   * Stamp `geometry` with its origin at `at`. Returns what was placed, in
   * absolute coordinates. `rotation` turns the geometry about its origin
   * first; `facing`, `axis` and friends rotate with it.
   */
  place(geometry, options = {}) {
    this.requireScope();
    if (!(geometry instanceof Geometry)) throw new BuildError("place: expected a Geometry");
    const rotation = options.rotation ?? "NONE";
    const [ax, ay, az] = ints("place: at", options.at ?? [0, 0, 0]);
    const placed = [];
    for (const cell of geometry.cells()) {
      let [dx, , dz] = cell;
      const dy = cell[1];
      let block = cell[3];
      if (rotation !== "NONE") {
        [dx, dz] = rotatePoint(dx, dz, 0, 0, rotation);
        block = rotateBlockstate(block, rotation);
      } else {
        rotatePoint(0, 0, 0, 0, rotation);
      }
      const x = ax + dx;
      const y = ay + dy;
      const z = az + dz;
      this.voxelGrid.place(x, y, z, block);
      placed.push([x, y, z, block]);
    }
    return Geometry.fromCells(placed);
  }
  /** Shift the build so its XZ bounding-box centre is at the origin (Y unchanged). */
  recenter() {
    const bb = this.voxelGrid.bounds();
    if (bb === null) return;
    const [[minx, , minz], [maxx, , maxz]] = bb;
    this.voxelGrid.shift(-Math.floor((minx + maxx + 1) / 2), 0, -Math.floor((minz + maxz + 1) / 2));
  }
  // -- reading the build back ---------------------------------------------------
  /** Canonical block at `(x, y, z)`; `null` if unset or air. */
  get(x, y, z) {
    const b = this.voxelGrid.volume.get(x, y, z);
    return b === void 0 || b === AIR ? null : b;
  }
  /** Number of cells holding exactly `block` (property order ignored). */
  count(block) {
    const canonical2 = canonicalize(block);
    let n2 = 0;
    const palette = this.voxelGrid.volume.palette;
    this.voxelGrid.volume.eachCell((_x, _y, _z, idx) => {
      if (palette[idx] === canonical2) n2++;
    });
    return n2;
  }
  /** Sorted coordinates of every cell holding exactly `block`. */
  find(block) {
    const canonical2 = canonicalize(block);
    const out = [];
    const palette = this.voxelGrid.volume.palette;
    this.voxelGrid.volume.eachCell((x, y, z, idx) => {
      if (palette[idx] === canonical2) out.push([x, y, z]);
    });
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  }
  /** Bounding box of placed non-air cells, or `null`. */
  bounds() {
    return this.voxelGrid.bounds();
  }
  // -- randomness and config ------------------------------------------------------
  /**
   * Seeded random generator. `rng()` is one shared stream; `rng("roof")` is
   * an independent stream for that name, so editing one part of a script
   * does not reshuffle the random choices of every other part.
   */
  rng(namespace) {
    if (namespace === void 0) {
      this.sharedRng ??= this.seedValue === null ? Rng.unseeded() : new Rng(String(this.seedValue));
      return this.sharedRng;
    }
    if (typeof namespace !== "string")
      throw new BuildError(`rng: namespace must be a string, got ${String(namespace)}`);
    return new Rng(
      `${this.seedValue === null ? "None" : String(this.seedValue)}\0${namespace}`
    );
  }
  setViews(views) {
    this.views = views === null ? null : typeof views === "string" ? [views] : [...views];
  }
  get grid() {
    return this.voxelGrid;
  }
  get seed() {
    return this.seedValue;
  }
  get viewsConfig() {
    return this.views;
  }
  // -- shapes: each places the geometry and returns it ----------------------------
  stamp(g) {
    return this.place(g);
  }
  opt(o) {
    return { seed: this.seedValue, ...o };
  }
  box(c1, c2, block, o) {
    return this.stamp(box(c1, c2, block, this.opt(o)));
  }
  walls(c1, c2, block, o) {
    return this.stamp(walls(c1, c2, block, this.opt(o)));
  }
  pillar(base, height, block, o) {
    return this.stamp(pillar(base, height, block, this.opt(o)));
  }
  line(p1, p2, block, o) {
    return this.stamp(line(p1, p2, block, this.opt(o)));
  }
  /**
   * One-block-thick slab at the lower Y of the corners `c1` and `c2`, covering
   * their XZ rectangle. Corners may be in any order. Port of Python
   * `Build.floor`: a `box` of height 1, so a palette spec resolves with the
   * Build seed.
   */
  floor(c1, c2, block, o) {
    const [x1, y1, z1] = ints("floor: c1", c1);
    const [x2, y2, z2] = ints("floor: c2", c2);
    const y = Math.min(y1, y2);
    return this.box(
      [Math.min(x1, x2), y, Math.min(z1, z2)],
      [Math.max(x1, x2), y, Math.max(z1, z2)],
      block,
      o
    );
  }
  /** Straight horizontal run from `start` to `end`, axis-aligned only; see `shapes.railing`. */
  railing(start, end, block, o) {
    return this.stamp(railing(start, end, block, this.opt(o)));
  }
  stairs(start, direction2, block, o) {
    return this.stamp(stairs(start, direction2, block, this.opt(o)));
  }
  /** Script-port alias of `stairs`; see `shapes.stairsRun` for the Python provenance and the facing divergence. */
  stairsRun(start, direction2, block, o) {
    return this.stamp(stairsRun(start, direction2, block, this.opt(o)));
  }
  cylinder(center, radius, height, block, o) {
    return this.stamp(cylinder(center, radius, height, block, this.opt(o)));
  }
  sphere(center, radius, block, o) {
    return this.stamp(sphere(center, radius, block, this.opt(o)));
  }
  cone(center, radius, height, block, o) {
    return this.stamp(cone(center, radius, height, block, this.opt(o)));
  }
  roofGable(c1, c2, block, o) {
    return this.stamp(roofGable(c1, c2, block, this.opt(o)));
  }
  roofHip(c1, c2, block, o) {
    return this.stamp(roofHip(c1, c2, block, this.opt(o)));
  }
};

// packages/mcbuilder/src/node/script.ts
var ScriptError = class extends McbuilderError {
  /** What the script threw, when it threw. */
  thrown;
  constructor(message, thrown) {
    super(message);
    this.thrown = thrown;
  }
};
var exists = (p) => stat(p).then(
  () => true,
  () => false
);
async function loadScript(path) {
  const abs = resolve(path);
  if (!await exists(abs)) throw new ScriptError(`no such script: ${path}`);
  let mod;
  try {
    mod = await import(`${pathToFileURL(abs).href}?t=${Date.now()}`);
  } catch (e) {
    throw new ScriptError(
      `error in ${basename(path)}: ${e instanceof Error ? e.message : String(e)}`,
      e
    );
  }
  const build = mod.BUILD ?? mod.default;
  if (!(build instanceof Build)) {
    throw new ScriptError(
      `${basename(path)} must export a Build as BUILD (export const BUILD = new Build(...))`
    );
  }
  return build;
}
function scanDeterminism(source, filename) {
  const hint = "use BUILD.rng() (from new Build({ seed })) for deterministic randomness";
  const checks = [
    [/\bMath\.random\s*\(/, "uses 'Math.random'"],
    [/\bDate\.now\s*\(|\bnew\s+Date\s*\(/, "uses the current time"],
    [/\bcrypto\.(randomUUID|getRandomValues|randomInt|randomBytes)\b/, "uses 'crypto' randomness"]
  ];
  const out = [];
  for (const [re, what] of checks) if (re.test(source)) out.push(`${filename}: ${what} — ${hint}`);
  return out;
}

// packages/mcbuilder/src/node/skill/common.ts
import { join as join2 } from "node:path";

// packages/mcbuilder/src/node/skill/io.ts
var SkillCliError = class extends Error {
  exitCode;
  constructor(message, exitCode = 1) {
    super(message);
    this.name = "SkillCliError";
    this.exitCode = exitCode;
  }
};

// packages/mcbuilder/src/node/skill/common.ts
var PROG = /(^|[\\/])mcbuild(\.mjs)?$/.test(process.argv[1] ?? "") ? "mcbuild" : "voxwright-cli";
var VERSION = true ? "0.0.0" : "dev";
var DEFAULT_MC_VERSION = "26.2";
function paletteOf(volume) {
  const counts = /* @__PURE__ */ new Map();
  volume.eachCell((_x, _y, _z, idx) => {
    const state = volume.palette[idx];
    if (state !== AIR) counts.set(state, (counts.get(state) ?? 0) + 1);
  });
  return [...counts].map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count || compareCodePoints(a.state, b.state));
}
var boxOf = (b) => b === null ? null : { min: [...b[0]], max: [...b[1]] };
var sizeOf = (b) => b === null ? [0, 0, 0] : [b.max[0] - b.min[0] + 1, b.max[1] - b.min[1] + 1, b.max[2] - b.min[2] + 1];
var fmtSize = (s) => s.join("×");
var fmtBox = (b) => b === null ? "none" : `${b.min.join(",")} to ${b.max.join(",")}`;
function fmtPalette(palette) {
  const w = Math.max(0, ...palette.map((p) => String(p.count).length));
  return palette.map((p) => `  ${String(p.count).padStart(w)} ${p.state}`);
}
function releaseOf(dataVersion) {
  for (const [release, dv] of Object.entries(DATA_VERSIONS)) if (dv === dataVersion) return release;
  return null;
}
var cacheRoot = (home) => join2(home, ".cache", "mcbuilder");
var usageError = (message) => new SkillCliError(message, 2);

// packages/mcbuilder/src/node/skill/formats.ts
import { extname } from "node:path";
var FORMATS = ["schem", "litematic", "nbt", "mcstructure"];
var isFormat = (s) => FORMATS.includes(s);
function formatOfPath(path) {
  const ext = extname(path).toLowerCase().slice(1);
  return isFormat(ext) ? ext : null;
}
async function encode(volume, format, options) {
  switch (format) {
    case "schem":
      return writeSchem(volume, {
        dataVersion: options.dataVersion,
        version: options.schemVersion
      });
    case "litematic":
      return writeLitematic(volume, {
        dataVersion: options.dataVersion,
        ...options.name === void 0 ? {} : { name: options.name },
        ...options.author === void 0 ? {} : { author: options.author }
      });
    case "nbt":
      return writeStructureNbt(volume, { dataVersion: options.dataVersion, air: options.air });
    case "mcstructure":
      return writeMcstructure(volume);
  }
}
async function decode(bytes, format) {
  const keepAir = true;
  switch (format) {
    case "schem": {
      const r = await readSchem(bytes, { keepAir });
      const m = r.meta;
      return {
        format,
        formatVersion: m.version,
        dataVersion: m.dataVersion,
        volume: r.volume,
        metadata: { offset: m.offset, size: [m.width, m.height, m.length] },
        blockEntities: r.volume.blockEntityCount + m.droppedBlockEntities,
        entities: r.volume.entities.length + m.droppedEntities,
        warnings: r.warnings
      };
    }
    case "litematic": {
      const r = await readLitematic(bytes, { keepAir });
      const m = r.meta;
      return {
        format,
        formatVersion: m.version,
        dataVersion: m.dataVersion,
        volume: r.volume,
        metadata: {
          name: m.name,
          author: m.author,
          description: m.description,
          regions: m.regionCount
        },
        blockEntities: r.volume.blockEntityCount + m.droppedBlockEntities,
        entities: r.volume.entities.length + m.droppedEntities,
        warnings: r.warnings
      };
    }
    case "nbt": {
      const r = await readStructureNbt(bytes, { keepAir });
      const m = r.meta;
      return {
        format,
        formatVersion: null,
        dataVersion: m.dataVersion,
        volume: r.volume,
        metadata: {},
        blockEntities: r.volume.blockEntityCount + m.droppedBlockEntities,
        entities: r.volume.entities.length + m.droppedEntities,
        warnings: r.warnings
      };
    }
    case "mcstructure": {
      const r = await readMcstructure(bytes, { keepAir });
      const m = r.meta;
      return {
        format,
        formatVersion: m.formatVersion,
        dataVersion: null,
        volume: r.volume,
        metadata: { size: m.size },
        blockEntities: r.volume.blockEntityCount + m.droppedBlockEntities,
        entities: r.volume.entities.length + m.droppedEntities,
        warnings: r.warnings
      };
    }
  }
}

// packages/mcbuilder/src/node/skill/registry.ts
import { readFile } from "node:fs/promises";
import { join as join4, resolve as resolve3 } from "node:path";

// packages/mcbuilder/src/pyrepr.ts
function pyRepr(s) {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += `\\${ch}`;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "	") out += "\\t";
    else if (cp < 32 || cp === 127) out += `\\x${cp.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return quote + out + quote;
}
var pyReprList = (items) => `[${items.map(pyRepr).join(", ")}]`;

// packages/mcbuilder/src/registry.ts
var AIR2 = "minecraft:air";
var RegistryError = class extends McbuilderError {
};
function normalizeBlockData(raw) {
  if (Array.isArray(raw)) {
    const blocks = {};
    for (const entry of raw) {
      const props = {};
      for (const state of entry.states ?? []) {
        let values = state.values;
        if (values === void 0 || values === null) {
          values = state.type === "bool" ? ["true", "false"] : [];
        }
        props[state.name] = values.map(String);
      }
      blocks[`minecraft:${entry.name}`] = { properties: props };
    }
    return blocks;
  }
  const mapping = raw?.blocks;
  if (typeof mapping === "object" && mapping !== null && !Array.isArray(mapping)) {
    const blocks = {};
    for (const [name, info] of Object.entries(
      mapping
    )) {
      const props = {};
      for (const [p, vals] of Object.entries(info?.properties ?? {})) props[p] = vals.map(String);
      blocks[name] = { properties: props };
    }
    return blocks;
  }
  throw new McbuilderError(
    'unrecognized registry data: expected a minecraft-data blocks.json list or a {"blocks": {...}} mapping'
  );
}
var BlockSyntaxError = class extends Error {
};
var BLOCK_RE = /^([^[{]+)(?:\[([^\]]*)\])?(\{.*\})?$/s;
function splitBlock(block) {
  const match = BLOCK_RE.exec(pyStrip(block));
  if (!match) throw new BlockSyntaxError(`malformed block string: ${pyRepr(block)}`);
  const name = pyStrip(match[1]);
  if (name === "")
    throw new BlockSyntaxError(`malformed block string (empty name): ${pyRepr(block)}`);
  const props = /* @__PURE__ */ new Map();
  if (match[2] !== void 0) {
    for (const raw of match[2].split(",")) {
      const part = pyStrip(raw);
      if (part === "") continue;
      const eq = part.indexOf("=");
      if (eq === -1) {
        throw new BlockSyntaxError(
          `malformed property ${pyRepr(part)} in ${pyRepr(block)} (want name=value)`
        );
      }
      props.set(pyStrip(part.slice(0, eq)), pyStrip(part.slice(eq + 1)));
    }
  }
  return { name, props, nbt: match[3] ?? null };
}
function nbtBalanced(nbt) {
  const closers = { "}": "{", "]": "[", ")": "(" };
  const stack = [];
  let i = 0;
  const n2 = nbt.length;
  while (i < n2) {
    const ch = nbt[i];
    if (ch === '"' || ch === "'") {
      i++;
      while (i < n2 && nbt[i] !== ch) {
        if (nbt[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }
    if ("{[(".includes(ch)) stack.push(ch);
    else if (ch in closers) {
      if (stack.length === 0 || stack.pop() !== closers[ch]) return false;
    }
    i++;
  }
  return stack.length === 0;
}
var Registry = class _Registry {
  version;
  blocks;
  constructor(blocks, version) {
    this.version = version;
    this.blocks = {};
    for (const [name, info] of Object.entries(blocks)) {
      const props = {};
      for (const [p, vals] of Object.entries(info?.properties ?? {})) props[p] = vals.map(String);
      this.blocks[name] = props;
    }
  }
  /** Build from raw minecraft-data (either accepted shape). */
  static fromData(raw, version) {
    try {
      return new _Registry(normalizeBlockData(raw), version);
    } catch (e) {
      throw new RegistryError(
        `registry data for ${version} has an unexpected shape: ${e.message}`
      );
    }
  }
  /** All known block names (namespaced), sorted. */
  names() {
    return Object.keys(this.blocks).sort(compareCodePoints);
  }
  suggestName(name, n2 = 3) {
    return suggest(name, this.names()).slice(0, n2);
  }
  static allowlistName(entry) {
    try {
      return splitBlock(entry).name;
    } catch {
      return pyStrip(entry);
    }
  }
  /**
   * Validate a palette of canonical block strings. Unknown names are errors
   * with suggestions, illegal properties or values are errors listing what is
   * legal, allowlisted custom names pass with a warning, NBT is only checked
   * for balance, and `minecraft:air` is always legal.
   */
  validate(palette, allowlist = []) {
    const errors = [];
    const warnings = [];
    const allowed = new Set(allowlist.map(_Registry.allowlistName));
    for (const block of palette) {
      let parsed;
      try {
        parsed = splitBlock(block);
      } catch (e) {
        if (!(e instanceof BlockSyntaxError)) throw e;
        errors.push({ block, message: e.message, suggestions: [] });
        continue;
      }
      const { name, props, nbt } = parsed;
      if (name === AIR2) continue;
      if (nbt !== null && !nbtBalanced(nbt)) {
        errors.push({
          block,
          message: `unbalanced braces/brackets in block-entity NBT of ${pyRepr(block)}`,
          suggestions: []
        });
        continue;
      }
      const info = Object.hasOwn(this.blocks, name) ? this.blocks[name] : void 0;
      if (info === void 0) {
        if (allowed.has(name)) {
          warnings.push({
            block,
            message: `${name} is allowlisted: unvalidated, build at own risk`
          });
        } else if (name.includes(":") && !name.startsWith("minecraft:")) {
          errors.push({
            block,
            message: `unknown block ${pyRepr(name)} (not in the ${this.version} registry); add it to \`allowlist\` in mcbuild.toml if it is a modded/custom block`,
            suggestions: []
          });
        } else {
          errors.push({
            block,
            message: `unknown block ${pyRepr(name)} (not in the ${this.version} registry)`,
            suggestions: this.suggestName(name)
          });
        }
        continue;
      }
      for (const [prop, value] of props) {
        const legal = Object.hasOwn(info, prop) ? info[prop] : void 0;
        if (legal === void 0) {
          errors.push({
            block,
            message: `unknown property ${pyRepr(prop)} on ${name}; legal properties: ${pyReprList(Object.keys(info).sort(compareCodePoints))}`,
            suggestions: getCloseMatches(prop, Object.keys(info), 3, 0.6)
          });
          continue;
        }
        if (!legal.includes(value)) {
          const lower = value.toLowerCase();
          const hint = legal.some((v) => v.toLowerCase() === lower) ? ` (did you mean ${pyRepr(lower)}? values are case-sensitive)` : "";
          errors.push({
            block,
            message: `illegal value ${pyRepr(value)} for property ${pyRepr(prop)} on ${name}${hint}; legal values: ${pyReprList(legal)}`,
            suggestions: []
          });
        }
      }
    }
    return { errors, warnings };
  }
};

// packages/mcbuilder/src/node/assets.ts
import { mkdir, readdir, stat as stat2, writeFile } from "node:fs/promises";
import { dirname, join as join3, resolve as resolve2, sep } from "node:path";
var AssetError = class extends McbuilderError {
};
var MC_DATA_RAW = "https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master";
var defaultHttpGet = async (url) => {
  try {
    const res = await fetch(url, { headers: { "user-agent": "voxwright-mcbuilder" } });
    return { status: res.status, body: new Uint8Array(await res.arrayBuffer()) };
  } catch (e) {
    throw new AssetError(
      `network request failed for ${url}: ${e instanceof Error ? e.message : String(e)}`
    );
  }
};
var text = (b) => new TextDecoder().decode(b);
function parseJson(b, what) {
  try {
    return JSON.parse(text(b));
  } catch (e) {
    throw new AssetError(`could not parse ${what}: ${e.message}`);
  }
}
var exists2 = (p) => stat2(p).then(
  () => true,
  () => false
);
function versionKey(version) {
  const dash = version.indexOf("-");
  const base = dash === -1 ? version : version.slice(0, dash);
  const suffix = dash === -1 ? "" : version.slice(dash + 1);
  const nums = base.split(".").map((p) => /^\d+$/.test(p) ? Number(p) : Number.NaN);
  if (nums.length === 0 || nums.some(Number.isNaN))
    throw new AssetError(`cannot parse MC version '${version}'`);
  return [nums, suffix ? 0 : 1];
}
function compareKeys(a, b) {
  const n2 = Math.min(a[0].length, b[0].length);
  for (let i = 0; i < n2; i++) {
    if (a[0][i] !== b[0][i]) return a[0][i] < b[0][i] ? -1 : 1;
  }
  if (a[0].length !== b[0].length) return a[0].length < b[0].length ? -1 : 1;
  return a[1] - b[1];
}
function closestPcLayout(version, dataPaths) {
  const pc = dataPaths.pc ?? {};
  const want = versionKey(version);
  let best = null;
  for (const key of Object.keys(pc)) {
    let k;
    try {
      k = versionKey(key);
    } catch {
      continue;
    }
    if (compareKeys(k, want) <= 0 && (best === null || compareKeys(versionKey(best), k) < 0))
      best = key;
  }
  return best === null ? null : pc[best].blocks;
}
async function fallbackLayout(version, get) {
  const { status, body } = await get(`${MC_DATA_RAW}/data/dataPaths.json`);
  if (status !== 200) {
    throw new AssetError(
      `minecraft-data has no data/pc/${version}/blocks.json (HTTP 404) and dataPaths.json could not be fetched (HTTP ${status}); check the version string or your network connection.`
    );
  }
  const dataPaths = parseJson(
    body,
    "minecraft-data dataPaths.json"
  );
  const layout = closestPcLayout(version, dataPaths);
  if (layout === null) {
    let newest = null;
    for (const key of Object.keys(dataPaths.pc ?? {})) {
      try {
        if (newest === null || compareKeys(versionKey(newest), versionKey(key)) < 0) newest = key;
      } catch {
      }
    }
    throw new AssetError(
      `version '${version}' is not in PrismarineJS/minecraft-data yet (newest pc layout available: ${newest}); minecraft-data lags new releases: either wait for it to update or fetch with an older \`--version\` and accept the older registry.`
    );
  }
  return layout;
}
async function downloadRegistry(version, dest, force, get) {
  const target = join3(dest, "minecraft-data.json");
  if (!force && await exists2(target)) return;
  let layout = `pc/${version}`;
  let res = await get(`${MC_DATA_RAW}/data/${layout}/blocks.json`);
  if (res.status === 404) {
    layout = await fallbackLayout(version, get);
    res = await get(`${MC_DATA_RAW}/data/${layout}/blocks.json`);
  }
  if (res.status !== 200) {
    throw new AssetError(
      `could not download the block registry for '${version}' (HTTP ${res.status}); check the version string or your network connection.`
    );
  }
  const raw = parseJson(res.body, `the registry payload for '${version}'`);
  let blocks;
  try {
    blocks = normalizeBlockData(raw);
  } catch (e) {
    throw new AssetError(
      `registry payload for '${version}' had an unexpected shape: ${e.message}`
    );
  }
  await writeFile(target, JSON.stringify({ version, layout, blocks }), "utf8");
}
async function fetchRegistry(version, cacheDir, options = {}) {
  const dest = join3(cacheDir, version);
  await mkdir(dest, { recursive: true });
  await downloadRegistry(version, dest, options.force ?? false, options.get ?? defaultHttpGet);
  return join3(dest, "minecraft-data.json");
}

// packages/mcbuilder/src/node/skill/registry.ts
async function read(path, version) {
  let raw;
  try {
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    throw new SkillCliError(`could not read the block registry ${path}: ${e.message}`);
  }
  try {
    return Registry.fromData(raw, version);
  } catch (e) {
    throw new SkillCliError(`${path}: ${e.message}`);
  }
}
async function findRegistry(req) {
  if (req.file !== void 0) {
    const path = resolve3(req.cwd, req.file);
    if (!await exists(path)) throw new SkillCliError(`--registry: no such file: ${path}`, 2);
    return {
      registry: await read(path, req.mcVersion),
      source: path,
      skipped: null,
      downloaded: false
    };
  }
  const root = cacheRoot(req.home);
  const cached = join4(root, req.mcVersion, "minecraft-data.json");
  if (await exists(cached)) {
    return {
      registry: await read(cached, req.mcVersion),
      source: cached,
      skipped: null,
      downloaded: false
    };
  }
  if (req.offline) {
    return {
      registry: null,
      source: null,
      skipped: `no block registry for ${req.mcVersion} at ${cached} and --offline is set`,
      downloaded: false
    };
  }
  try {
    const path = await fetchRegistry(
      req.mcVersion,
      root,
      req.get === void 0 ? {} : { get: req.get }
    );
    return {
      registry: await read(path, req.mcVersion),
      source: path,
      skipped: null,
      downloaded: true
    };
  } catch (e) {
    if (!(e instanceof AssetError)) throw e;
    return {
      registry: null,
      source: null,
      skipped: `the block registry for ${req.mcVersion} could not be downloaded (${e.message})`,
      downloaded: false
    };
  }
}

// packages/mcbuilder/src/node/skill/build.ts
var BUILD_USAGE = `Usage: ${PROG} build <recipe> --out <path> [options]

Run a recipe (an ES module that exports a Build as BUILD), validate its blocks
against the block registry of the Minecraft version, and write the schematic.

Options:
  --out <path>          file to write; repeat it to write several formats at once
  --format <f>          ${FORMATS.join(" | ")}
                        (default: the extension of --out; with --format an --out
                        that has no extension gets one)
  --mc-version <v>      Minecraft version for the registry and the DataVersion
                        (default ${DEFAULT_MC_VERSION}; known: ${Object.keys(DATA_VERSIONS).join(", ")})
  --data-version <n>    DataVersion to write, for a version the CLI does not know
  --registry <file>     block registry JSON to validate against, instead of the
                        cache in ~/.cache/mcbuilder/<v>/minecraft-data.json
  --offline             never download the registry; a build without a registry
                        is exported unvalidated, with a warning
  --allow <block>       accept this block name even if the registry lacks it
                        (modded blocks); repeatable
  --schem-version <n>   Sponge schematic version to write: 2 or 3 (default 3)
  --air <mode>          .nbt only: none | explicit | all (default none)
  --name <text>         .litematic only: the schematic's name
  --author <text>       .litematic only: the schematic's author
  --json                print the summary as one JSON document
  -h, --help            show this help

Exit codes: 0 written, 1 the recipe, validation or export failed (nothing is
written), 2 usage error.`;
var LEGACY = "'.schematic' is the legacy format from before Minecraft 1.13 and cannot be written; use .schem";
function resolveTargets(outs, format, cwd) {
  if (outs.length === 0) throw usageError("build: --out <path> is required");
  if (format !== void 0 && !isFormat(format)) {
    throw usageError(`--format must be one of ${FORMATS.join(", ")}, got '${format}'`);
  }
  if (format !== void 0 && outs.length > 1) {
    throw usageError(
      "--format cannot be combined with several --out; give each --out its extension instead"
    );
  }
  const targets = [];
  for (const out of outs) {
    if (out === "") throw usageError("--out must not be empty");
    const ext = extname2(out).toLowerCase();
    if (ext === ".schematic") throw usageError(LEGACY);
    const byExt = formatOfPath(out);
    let path = resolve4(cwd, out);
    let chosen;
    if (format !== void 0) {
      if (byExt !== null && byExt !== format) {
        throw usageError(`--out ${out} has the extension of ${byExt}, but --format is ${format}`);
      }
      chosen = format;
      if (ext === "") path = `${path}.${format}`;
    } else if (byExt !== null) {
      chosen = byExt;
    } else {
      throw usageError(
        `cannot tell the format of --out ${out}: use a .schem, .litematic, .nbt or .mcstructure extension, or pass --format`
      );
    }
    if (targets.some((t) => t.path === path)) throw usageError(`--out ${out} is given twice`);
    targets.push({ path, format: chosen });
  }
  return targets;
}
function locateInRecipe(thrown, recipe) {
  const stack = thrown instanceof Error ? thrown.stack ?? "" : "";
  for (const prefix of [pathToFileURL2(recipe).href, recipe]) {
    let from = 0;
    for (; ; ) {
      const at = stack.indexOf(prefix, from);
      if (at === -1) break;
      const m = /^(?:\?[^\s:)]*)?:(\d+)(?::(\d+))?/.exec(stack.slice(at + prefix.length));
      if (m) return `${basename2(recipe)}:${m[1]}${m[2] === void 0 ? "" : `:${m[2]}`}`;
      from = at + prefix.length;
    }
  }
  return null;
}
var fmtError = (e) => e.suggestions.length > 0 ? `${e.message} (did you mean ${e.suggestions.join(" or ")}?)` : e.message;
function printSummary(s, io) {
  const v = s.validation;
  io.out(`build: ${s.ok ? "OK" : "FAILED"}`);
  io.out(`recipe: ${s.recipe}`);
  io.out(`size: ${fmtSize(s.size)} (X×Y×Z)`);
  io.out(`bounds: ${fmtBox(s.bounds)}`);
  io.out(`blocks: ${s.blocks}`);
  io.out(`block states: ${s.blockStates}`);
  io.out(
    `minecraft: ${s.mcVersion}${s.dataVersion === null ? "" : ` (DataVersion ${s.dataVersion})`}`
  );
  io.out(
    v.registry === null ? "validation: skipped" : `validation: ${v.registry} registry, ${v.errors.length} ${v.errors.length === 1 ? "error" : "errors"}`
  );
  io.out("palette:");
  for (const line2 of fmtPalette(s.palette)) io.out(line2);
  if (v.errors.length > 0) {
    io.out("errors:");
    for (const e of v.errors) io.out(`  - ${fmtError(e)}`);
  }
  if (s.warnings.length > 0) {
    io.out("warnings:");
    for (const w of s.warnings) io.out(`  - ${w}`);
  }
  if (s.outputs.length > 0) {
    io.out("wrote:");
    for (const o of s.outputs) io.out(`  ${o.path} (${o.format}, ${o.bytes} bytes)`);
  } else {
    io.out("nothing was written");
  }
}
function parseDataVersion(value) {
  if (value === void 0) return void 0;
  if (!/^\d+$/.test(value))
    throw usageError(`--data-version must be a whole number, got '${value}'`);
  return Number(value);
}
async function resolveDataVersionFor(mcVersion, override, home) {
  if (override !== void 0) return override;
  const versionJson = join5(cacheRoot(home), mcVersion, "version.json");
  if (await exists(versionJson)) {
    try {
      const wv = JSON.parse(await readFile2(versionJson, "utf8")).world_version;
      if (typeof wv === "number" && Number.isInteger(wv)) return wv;
    } catch {
    }
  }
  const known = Object.hasOwn(DATA_VERSIONS, mcVersion) ? DATA_VERSIONS[mcVersion] : void 0;
  if (known === void 0) {
    throw new SkillCliError(
      `unknown DataVersion for Minecraft '${mcVersion}' (known versions: ${Object.keys(DATA_VERSIONS).join(", ")}); pass --data-version <n>`,
      2
    );
  }
  return known;
}
async function cmdBuild(args, io, deps = {}) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      out: { type: "string", multiple: true },
      format: { type: "string" },
      "mc-version": { type: "string" },
      "data-version": { type: "string" },
      registry: { type: "string" },
      offline: { type: "boolean" },
      allow: { type: "string", multiple: true },
      "schem-version": { type: "string" },
      air: { type: "string" },
      name: { type: "string" },
      author: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" }
    }
  });
  if (values.help) {
    for (const line2 of BUILD_USAGE.split("\n")) io.out(line2);
    return 0;
  }
  if (positionals.length !== 1) {
    throw usageError(`build takes exactly one recipe, got ${positionals.length}`);
  }
  const targets = resolveTargets(values.out ?? [], values.format, io.cwd);
  const schemVersion = Number(values["schem-version"] ?? "3");
  if (schemVersion !== 2 && schemVersion !== 3) {
    throw usageError(`--schem-version must be 2 or 3, got '${values["schem-version"]}'`);
  }
  const air = values.air ?? "none";
  if (!["none", "explicit", "all"].includes(air)) {
    throw usageError(`--air must be none, explicit or all, got '${air}'`);
  }
  const mcVersion = values["mc-version"] ?? DEFAULT_MC_VERSION;
  if (mcVersion === "") throw usageError("--mc-version must not be empty");
  const dataVersionOverride = parseDataVersion(values["data-version"]);
  const json = values.json === true;
  const recipe = resolve4(io.cwd, positionals[0]);
  try {
    const summary2 = await runBuild({
      recipe,
      targets,
      mcVersion,
      dataVersionOverride,
      registryFile: values.registry,
      offline: values.offline === true,
      allow: values.allow ?? [],
      schemVersion,
      air,
      name: values.name,
      author: values.author,
      io,
      get: deps.get
    });
    if (json) io.out(JSON.stringify(summary2, null, 2));
    else printSummary(summary2, io);
    return summary2.ok ? 0 : 1;
  } catch (e) {
    if (json && e instanceof SkillCliError && e.exitCode === 1) {
      io.out(JSON.stringify({ ok: false, recipe, error: e.message }, null, 2));
      return 1;
    }
    throw e;
  }
}
async function runBuild(req) {
  let build;
  try {
    build = await loadScript(req.recipe);
  } catch (e) {
    if (!(e instanceof ScriptError)) throw e;
    const where = locateInRecipe(e.thrown, req.recipe);
    throw new SkillCliError(where === null ? e.message : `${e.message} (at ${where})`);
  }
  const volume = build.grid.volume;
  const palette = paletteOf(volume);
  const blocks = palette.reduce((n2, p) => n2 + p.count, 0);
  if (blocks === 0) {
    throw new SkillCliError(
      `${basename2(req.recipe)} placed no blocks: place them inside BUILD.scope(() => { ... })`
    );
  }
  const bounds = boxOf(volume.bounds());
  const warnings = scanDeterminism(await readFile2(req.recipe, "utf8"), basename2(req.recipe));
  const found = await findRegistry({
    mcVersion: req.mcVersion,
    offline: req.offline,
    cwd: req.io.cwd,
    home: req.io.home,
    ...req.registryFile === void 0 ? {} : { file: req.registryFile },
    ...req.get === void 0 ? {} : { get: req.get }
  });
  let errors = [];
  let registryWarnings = [];
  if (found.registry === null) {
    warnings.push(
      `validation skipped: ${found.skipped}; block names and block states were not checked`
    );
  } else {
    const result = found.registry.validate(
      palette.map((p) => p.state),
      req.allow
    );
    errors = result.errors.map((e) => ({
      ...e,
      message: e.message.replace(
        "add it to `allowlist` in mcbuild.toml",
        `pass --allow ${e.block.replace(/[[{].*$/s, "")}`
      )
    }));
    registryWarnings = result.warnings;
    warnings.push(...registryWarnings.map((w) => w.message));
  }
  const summary2 = {
    ok: errors.length === 0,
    recipe: req.recipe,
    size: sizeOf(bounds),
    bounds,
    blocks,
    blockStates: palette.length,
    palette,
    mcVersion: req.mcVersion,
    dataVersion: null,
    validation: {
      registry: found.registry?.version ?? null,
      source: found.source,
      skipped: found.skipped,
      errors,
      warnings: registryWarnings
    },
    warnings,
    outputs: []
  };
  if (!summary2.ok) return summary2;
  const dataVersion = await resolveDataVersionFor(
    req.mcVersion,
    req.dataVersionOverride,
    req.io.home
  );
  summary2.dataVersion = dataVersion;
  const encoded = [];
  for (const target of req.targets) {
    try {
      const result = await encode(volume, target.format, {
        dataVersion,
        schemVersion: req.schemVersion,
        air: req.air,
        // A litematic shows its name in Litematica's list: default to the recipe's file name.
        name: req.name ?? basename2(req.recipe, extname2(req.recipe)),
        ...req.author === void 0 ? {} : { author: req.author }
      });
      encoded.push({ target, result });
    } catch (e) {
      throw new SkillCliError(
        `could not write ${target.format}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  for (const { target, result } of encoded) {
    await mkdir2(dirname2(target.path), { recursive: true });
    await writeFile2(target.path, result.bytes);
    summary2.outputs.push({
      path: target.path,
      format: target.format,
      bytes: result.bytes.byteLength,
      warnings: result.warnings
    });
    warnings.push(...result.warnings.map((w) => `${basename2(target.path)}: ${w}`));
  }
  return summary2;
}

// packages/mcbuilder/src/node/skill/inspect.ts
import { readFile as readFile3 } from "node:fs/promises";
import { extname as extname3, resolve as resolve5 } from "node:path";
import { parseArgs as parseArgs2 } from "node:util";
var INSPECT_USAGE = `Usage: ${PROG} inspect <schematic> [--json]

Print what a .schem, .litematic, .nbt or .mcstructure file holds: format,
DataVersion, size, block count, palette, block entities, entities and anything
the reader could not carry.

Options:
  --json        print the report as one JSON document
  -h, --help    show this help`;
var fmtValue = (v) => Array.isArray(v) ? v.join(",") : v === null || v === void 0 || v === "" ? "none" : String(v);
async function cmdInspect(args, io) {
  const { values, positionals } = parseArgs2({
    args,
    allowPositionals: true,
    options: { json: { type: "boolean" }, help: { type: "boolean", short: "h" } }
  });
  if (values.help) {
    for (const line2 of INSPECT_USAGE.split("\n")) io.out(line2);
    return 0;
  }
  if (positionals.length !== 1) {
    throw usageError(`inspect takes exactly one file, got ${positionals.length}`);
  }
  const file = resolve5(io.cwd, positionals[0]);
  if (extname3(file).toLowerCase() === ".schematic") throw usageError(LEGACY_SCHEMATIC_MESSAGE);
  const format = formatOfPath(file);
  if (format === null) {
    throw usageError(
      `cannot inspect '${positionals[0]}': expected a .schem, .litematic, .nbt or .mcstructure file`
    );
  }
  if (!await exists(file)) throw new SkillCliError(`no such file: ${file}`);
  let bytes;
  try {
    bytes = new Uint8Array(await readFile3(file));
  } catch (e) {
    throw new SkillCliError(`could not read ${file}: ${e.message}`);
  }
  let decoded;
  try {
    decoded = await decode(bytes, format);
  } catch (e) {
    throw new SkillCliError(`${file} is not a readable ${format} file: ${e.message}`);
  }
  const palette = paletteOf(decoded.volume);
  const report = {
    file,
    format,
    formatVersion: decoded.formatVersion,
    dataVersion: decoded.dataVersion,
    mcVersion: decoded.dataVersion === null ? null : releaseOf(decoded.dataVersion),
    size: sizeOf(boxOf(decoded.volume.placedBounds())),
    bounds: boxOf(decoded.volume.bounds()),
    blocks: palette.reduce((n2, p) => n2 + p.count, 0),
    blockStates: palette.length,
    blockEntities: decoded.blockEntities,
    entities: decoded.entities,
    metadata: decoded.metadata,
    palette,
    warnings: decoded.warnings
  };
  if (values.json) {
    io.out(JSON.stringify(report, null, 2));
    return 0;
  }
  io.out(`file: ${report.file}`);
  io.out(
    `format: ${report.format}${report.formatVersion === null ? "" : ` (version ${report.formatVersion})`}`
  );
  io.out(
    report.dataVersion === null ? "minecraft: Bedrock (no DataVersion)" : `minecraft: DataVersion ${report.dataVersion}${report.mcVersion === null ? "" : ` (${report.mcVersion})`}`
  );
  io.out(`size: ${fmtSize(report.size)} (X×Y×Z)`);
  io.out(`bounds: ${fmtBox(report.bounds)}`);
  io.out(`blocks: ${report.blocks}`);
  io.out(`block states: ${report.blockStates}`);
  io.out(`block entities: ${report.blockEntities}`);
  io.out(`entities: ${report.entities}`);
  const meta = Object.entries(report.metadata);
  if (meta.length > 0) {
    io.out("metadata:");
    for (const [k, v] of meta) io.out(`  ${k}: ${fmtValue(v)}`);
  }
  io.out("palette:");
  for (const line2 of fmtPalette(report.palette)) io.out(line2);
  if (report.warnings.length > 0) {
    io.out("warnings:");
    for (const w of report.warnings) io.out(`  - ${w}`);
  }
  return 0;
}

// packages/mcbuilder/src/node/skill/preview.ts
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir as mkdir3, readFile as readFile4, rename, stat as stat3, writeFile as writeFile3 } from "node:fs/promises";
import { createServer } from "node:http";
import { basename as basename3, dirname as dirname3, extname as extname4, join as join6, resolve as resolve6, sep as sep2 } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs as parseArgs3 } from "node:util";
var DEFAULT_PORT = 4173;
var DEFAULT_HOST = "127.0.0.1";
var PUBLISHED_WEB = "https://luki.is-a.dev/voxwright/";
var PORT_TRIES = 50;
var SCHEMATIC_EXTENSIONS = [".schem", ".litematic", ".nbt", ".mcstructure"];
var PREVIEW_USAGE = `Usage: voxwright-cli preview <schematic> [options]

Serve the web viewer and editor on this machine with <schematic> opened in it
(.schem, .litematic, .nbt or .mcstructure). The file is read again on every page
load, so rebuild and refresh the page to see the new build. Runs until Ctrl+C.

Options:
  --port <n>          port to listen on (default ${DEFAULT_PORT}; when it is busy the next free
                      one is used; an explicit --port that is busy is an error)
  --host <h>          address to listen on (default ${DEFAULT_HOST})
  --no-open           do not open the page in the default browser
  --web <dir|url>     web app to serve: a built apps/web directory or an http(s) URL
                      (default: $VOXWRIGHT_WEB, else apps/web/build of this checkout,
                      else ${PUBLISHED_WEB} through a local caching proxy)
  -h, --help          show this help`;
async function cmdPreview(args, io) {
  let parsed;
  try {
    parsed = parsePreviewArgs(args);
  } catch (err) {
    if (err instanceof SkillCliError) throw err;
    throw new SkillCliError(
      `${err instanceof Error ? err.message : String(err)}
${PREVIEW_USAGE}`,
      2
    );
  }
  if (parsed.help) {
    for (const line2 of PREVIEW_USAGE.split("\n")) io.out(line2);
    return 0;
  }
  const preview = await startPreview({
    schematic: parsed.schematic,
    cwd: io.cwd,
    home: io.home,
    web: parsed.web ?? (io.env.VOXWRIGHT_WEB?.trim() || void 0),
    port: parsed.port,
    host: parsed.host
  });
  for (const note of preview.notes) io.err(`warning: ${note}`);
  io.out(`Preview URL: ${preview.url}`);
  io.out(`Web app: ${describeSource(preview.source)}. Press Ctrl+C to stop.`);
  if (parsed.open) openBrowser(preview.url, (msg) => io.err(`warning: ${msg}`));
  await new Promise((done) => {
    const stop = () => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      done();
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
  await preview.close();
  return 0;
}
function parsePreviewArgs(args) {
  const { values, positionals } = parseArgs3({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      port: { type: "string" },
      host: { type: "string" },
      "no-open": { type: "boolean" },
      web: { type: "string" },
      help: { type: "boolean", short: "h" }
    }
  });
  if (values.help)
    return {
      help: true,
      schematic: "",
      port: void 0,
      host: void 0,
      web: void 0,
      open: false
    };
  if (positionals.length !== 1)
    throw new SkillCliError(
      `preview takes exactly one schematic, got ${positionals.length}
${PREVIEW_USAGE}`,
      2
    );
  let port;
  if (values.port !== void 0) {
    port = Number(values.port);
    if (!/^\d+$/.test(values.port) || port > 65535)
      throw new SkillCliError(
        `--port must be a whole number from 0 to 65535, got '${values.port}'`,
        2
      );
  }
  if (values.host !== void 0 && values.host.trim() === "")
    throw new SkillCliError("--host must not be empty", 2);
  return {
    help: false,
    schematic: positionals[0],
    port,
    host: values.host,
    web: values.web,
    open: !values["no-open"]
  };
}
function describeSource(source) {
  if (source.kind === "dir")
    return source.why === "local-build" ? `local build at ${source.dir}` : `directory ${source.dir}`;
  return `${source.upstream} through a local proxy (cached in ${source.cacheDir})`;
}
async function startPreview(options) {
  const file = resolve6(options.cwd, options.schematic);
  const ext = extname4(file).toLowerCase();
  if (ext === ".schematic")
    throw new SkillCliError(
      "'.schematic' is the legacy format from before Minecraft 1.13 and is not supported; re-save the build as .schem",
      2
    );
  if (!SCHEMATIC_EXTENSIONS.includes(ext))
    throw new SkillCliError(
      `cannot preview '${basename3(file)}': expected a .schem, .litematic, .nbt or .mcstructure file`,
      2
    );
  let st;
  try {
    st = statSync(file);
  } catch {
    throw new SkillCliError(`no such file: ${file}`);
  }
  if (!st.isFile()) throw new SkillCliError(`not a file: ${file}`);
  const notes = [];
  const timeoutMs = options.upstreamTimeoutMs ?? 15e3;
  const source = await chooseSource(options, notes, timeoutMs);
  const base = source.kind === "dir" ? "/" : new URL(source.upstream).pathname;
  const name = basename3(file);
  const schematicPath = `${base}__preview/${name}`;
  const handler = async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" });
      res.end("Only GET and HEAD are supported.\n");
      return;
    }
    const raw = (req.url ?? "/").split("?")[0];
    let path;
    try {
      path = decodeURIComponent(raw);
    } catch {
      return send(req, res, 400, "text/plain; charset=utf-8", "Bad request.\n");
    }
    if (path === schematicPath) return serveSchematic(req, res, file);
    if (source.kind === "dir") return serveStatic(req, res, source.dir, path, raw);
    return serveProxy(req, res, source, raw, timeoutMs);
  };
  const server = createServer((req, res) => {
    handler(req, res).catch((err) => {
      if (!res.headersSent)
        send(req, res, 500, "text/plain; charset=utf-8", `Internal error: ${String(err)}
`);
      else res.destroy();
    });
  });
  const host = options.host ?? DEFAULT_HOST;
  let port;
  if (options.port !== void 0) {
    try {
      port = await listen(server, options.port, host);
    } catch (err) {
      throw listenError(err, options.port, host, true);
    }
  } else {
    port = -1;
    for (let p = DEFAULT_PORT; p < DEFAULT_PORT + PORT_TRIES && p <= 65535; p++) {
      try {
        port = await listen(server, p, host);
        break;
      } catch (err) {
        if (err.code !== "EADDRINUSE")
          throw listenError(err, p, host, false);
      }
    }
    if (port === -1)
      throw new SkillCliError(
        `ports ${DEFAULT_PORT} to ${DEFAULT_PORT + PORT_TRIES - 1} on ${host} are all in use; pass a free --port`
      );
    if (port !== DEFAULT_PORT) notes.push(`port ${DEFAULT_PORT} is in use, using ${port}`);
  }
  const shownHost = host === "0.0.0.0" ? "127.0.0.1" : host === "::" ? "[::1]" : host.includes(":") ? `[${host}]` : host;
  const url = `http://${shownHost}:${port}${base}?open=${openParam(name)}`;
  return {
    url,
    host,
    port,
    source,
    notes,
    close: () => new Promise((done) => {
      server.close(() => done());
      server.closeAllConnections();
    })
  };
}
function openParam(name) {
  return encodeURIComponent(`__preview/${encodeURIComponent(name)}`).replaceAll("%2F", "/");
}
function listen(server, port, host) {
  return new Promise((ok, fail) => {
    const onError = (err) => {
      server.off("listening", onListening);
      fail(err);
    };
    const onListening = () => {
      server.off("error", onError);
      ok(server.address().port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}
function listenError(err, port, host, explicit) {
  const code = err.code;
  if (code === "EADDRINUSE" && explicit)
    return new SkillCliError(
      `port ${port} on ${host} is already in use; pass another --port or leave it out to pick a free one`
    );
  if (code === "EADDRNOTAVAIL" || code === "ENOTFOUND")
    return new SkillCliError(`cannot listen on host '${host}': ${code}`, 2);
  return new SkillCliError(
    `cannot listen on ${host}:${port}: ${err instanceof Error ? err.message : String(err)}`
  );
}
async function chooseSource(options, notes, timeoutMs) {
  const cacheRoot2 = join6(options.home, ".cache", "voxwright", "web");
  if (options.web !== void 0) {
    if (/^https?:\/\//i.test(options.web)) {
      const upstream2 = await resolveUpstream(options.web, cacheRoot2, notes, timeoutMs);
      return { kind: "proxy", upstream: upstream2, cacheDir: cacheRoot2, why: "explicit" };
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(options.web))
      throw new SkillCliError(
        `--web must be a directory or an http(s) URL, got '${options.web}'`,
        2
      );
    const dir = resolve6(options.cwd, options.web);
    if (!existsSync(join6(dir, "index.html")))
      throw new SkillCliError(
        `--web ${dir} has no index.html; build the web app first (pnpm --filter @voxwright/web build)`,
        2
      );
    return { kind: "dir", dir, why: "explicit" };
  }
  const local = findLocalWebBuild(options.searchFrom ?? dirname3(fileURLToPath(import.meta.url)));
  if (local !== null) return { kind: "dir", dir: local, why: "local-build" };
  const upstream = await resolveUpstream(
    options.published ?? PUBLISHED_WEB,
    cacheRoot2,
    notes,
    timeoutMs
  );
  return { kind: "proxy", upstream, cacheDir: cacheRoot2, why: "published" };
}
function findLocalWebBuild(from) {
  let dir = resolve6(from);
  for (; ; ) {
    if (existsSync(join6(dir, "apps", "web"))) {
      const build = join6(dir, "apps", "web", "build");
      return existsSync(join6(build, "index.html")) ? build : null;
    }
    const up = dirname3(dir);
    if (up === dir) return null;
    dir = up;
  }
}
function asDirectoryUrl(u) {
  const copy = new URL(u.href);
  copy.search = "";
  copy.hash = "";
  if (!copy.pathname.endsWith("/")) copy.pathname = copy.pathname.replace(/[^/]*$/, "");
  return copy.href;
}
async function resolveUpstream(given, cacheRoot2, notes, timeoutMs) {
  let start;
  try {
    start = new URL(given);
  } catch {
    throw new SkillCliError(`--web: not a valid URL: '${given}'`, 2);
  }
  if (!start.pathname.endsWith("/")) start.pathname = `${start.pathname}/`;
  start.search = "";
  start.hash = "";
  const aliasesFile = join6(cacheRoot2, "aliases.json");
  let aliases = {};
  try {
    aliases = JSON.parse(await readFile4(aliasesFile, "utf8"));
  } catch {
  }
  try {
    const res = await fetch(start, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "voxwright-cli preview" }
    });
    await res.body?.cancel();
    const final = asDirectoryUrl(new URL(res.url || start.href));
    if (final !== start.href && aliases[start.href] !== final) {
      aliases[start.href] = final;
      await writeAtomic(aliasesFile, JSON.stringify(aliases, null, 2));
    }
    if (!res.ok) notes.push(`${final} answered HTTP ${res.status}`);
    return final;
  } catch (err) {
    const known = aliases[start.href] ?? start.href;
    notes.push(
      `${start.href} could not be reached (${errText(err)}); serving the cached copy of ${known} where there is one`
    );
    return known;
  }
}
var CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".zip": "application/zip"
};
var contentTypeFor = (path) => CONTENT_TYPES[extname4(path).toLowerCase()] ?? "application/octet-stream";
function send(req, res, status, type, body, headers = {}) {
  const bytes = typeof body === "string" ? Buffer.from(body) : body;
  res.writeHead(status, {
    "content-type": type,
    "content-length": String(bytes.byteLength),
    "x-content-type-options": "nosniff",
    ...headers
  });
  res.end(req.method === "HEAD" ? void 0 : bytes);
}
var notFound = (req, res) => send(req, res, 404, "text/plain; charset=utf-8", "Not found.\n", { "cache-control": "no-store" });
async function serveSchematic(req, res, file) {
  let bytes;
  try {
    bytes = await readFile4(file);
  } catch {
    return notFound(req, res);
  }
  send(req, res, 200, "application/octet-stream", bytes, { "cache-control": "no-store" });
}
async function serveStatic(req, res, root, path, rawPath) {
  if (path.includes("\0") || path.includes("\\")) return notFound(req, res);
  const segments = path.split("/").filter((s) => s !== "");
  if (segments.some((s) => s === "." || s === "..")) return notFound(req, res);
  let file = join6(root, ...segments);
  if (file !== root && !file.startsWith(root + sep2)) return notFound(req, res);
  let st = await stat3(file).catch(() => null);
  if (st?.isDirectory()) {
    if (!path.endsWith("/"))
      return send(req, res, 301, "text/plain; charset=utf-8", "", { location: `${rawPath}/` });
    file = join6(file, "index.html");
    st = await stat3(file).catch(() => null);
  }
  if (!st?.isFile()) {
    if (extname4(path) !== "") return notFound(req, res);
    file = join6(root, "200.html");
    st = await stat3(file).catch(() => null);
    if (!st?.isFile()) return notFound(req, res);
  }
  const bytes = await readFile4(file);
  const immutable = path.includes("/_app/immutable/");
  send(req, res, 200, contentTypeFor(file), bytes, {
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache"
  });
}
function cachePaths(cacheDir, upstreamUrl) {
  const u = new URL(upstreamUrl);
  const key = createHash("sha256").update(`${u.origin}${u.pathname}`).digest("hex");
  const host = u.host.replace(/[^a-z0-9.-]/gi, "_");
  return {
    body: join6(cacheDir, host, `${key}.body`),
    meta: join6(cacheDir, host, `${key}.json`)
  };
}
async function readCache(cacheDir, upstreamUrl) {
  const p = cachePaths(cacheDir, upstreamUrl);
  try {
    const meta = JSON.parse(await readFile4(p.meta, "utf8"));
    const body = await readFile4(p.body);
    return { meta, body };
  } catch {
    return null;
  }
}
async function writeCache(cacheDir, upstreamUrl, contentType, body) {
  const p = cachePaths(cacheDir, upstreamUrl);
  const meta = { url: upstreamUrl, status: 200, contentType, savedAt: Date.now() };
  await writeAtomic(p.body, body);
  await writeAtomic(p.meta, JSON.stringify(meta));
}
async function writeAtomic(path, data) {
  await mkdir3(dirname3(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile3(tmp, data);
  await rename(tmp, path);
}
async function serveProxy(req, res, source, rawPath, timeoutMs) {
  const upstream = new URL(source.upstream);
  const base = upstream.pathname;
  if (rawPath === "/" && base !== "/")
    return send(req, res, 302, "text/plain; charset=utf-8", "", { location: base });
  if (rawPath === base.slice(0, -1))
    return send(req, res, 301, "text/plain; charset=utf-8", "", { location: base });
  if (!rawPath.startsWith(base) || rawPath.split("/").some((s) => s === ".." || s === "."))
    return notFound(req, res);
  const targetUrl = new URL(rawPath, upstream.origin);
  if (!targetUrl.pathname.startsWith(base)) return notFound(req, res);
  const target = targetUrl.href;
  const immutable = rawPath.includes("/_app/immutable/");
  const fromCache = async () => {
    const hit = await readCache(source.cacheDir, target);
    if (hit === null) return false;
    send(req, res, 200, hit.meta.contentType, hit.body, {
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      "x-voxwright-cache": "hit"
    });
    return true;
  };
  if (immutable && await fromCache()) return;
  let upstreamRes;
  try {
    upstreamRes = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "voxwright-cli preview", accept: req.headers.accept ?? "*/*" }
    });
  } catch (err) {
    if (await fromCache()) return;
    return send(
      req,
      res,
      502,
      "text/plain; charset=utf-8",
      `The web app at ${target} could not be reached (${errText(err)}) and no cached copy exists.
`,
      { "cache-control": "no-store" }
    );
  }
  const finalUrl = upstreamRes.url ? new URL(upstreamRes.url) : new URL(target);
  if (finalUrl.href !== target) {
    if (finalUrl.origin === upstream.origin && finalUrl.pathname.startsWith(base)) {
      await upstreamRes.body?.cancel();
      return send(req, res, 302, "text/plain; charset=utf-8", "", {
        location: `${finalUrl.pathname}${finalUrl.search}`
      });
    }
  }
  let body;
  try {
    body = new Uint8Array(await upstreamRes.arrayBuffer());
  } catch (err) {
    if (await fromCache()) return;
    return send(
      req,
      res,
      502,
      "text/plain; charset=utf-8",
      `Reading ${target} failed (${errText(err)}).
`,
      {
        "cache-control": "no-store"
      }
    );
  }
  if (upstreamRes.status >= 500 && await fromCache()) return;
  const contentType = upstreamRes.headers.get("content-type") ?? contentTypeFor(finalUrl.pathname);
  if (upstreamRes.status === 200) {
    await writeCache(source.cacheDir, target, contentType, body).catch(() => {
    });
  }
  const headers = {
    "cache-control": upstreamRes.status === 200 && immutable ? "public, max-age=31536000, immutable" : "no-cache"
  };
  const lastModified = upstreamRes.headers.get("last-modified");
  if (lastModified) headers["last-modified"] = lastModified;
  send(req, res, upstreamRes.status, contentType, body, headers);
}
var errText = (err) => {
  if (err instanceof Error) {
    const cause = err.cause;
    if (cause instanceof Error) return cause.message;
    return err.message;
  }
  return String(err);
};
function openBrowser(url, warn) {
  const [cmd, args] = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", '""', `"${url}"`]] : ["xdg-open", [url]];
  const failed = (why) => warn(`could not open a browser (${why}); open the Preview URL above yourself`);
  try {
    const child2 = spawn(cmd, args, {
      stdio: "ignore",
      detached: true,
      // `start "" "<url>"`: the quotes must reach cmd as written, or `&` in the URL splits the command.
      windowsVerbatimArguments: process.platform === "win32"
    });
    child2.on("error", (err) => failed(`${cmd}: ${err.message}`));
    child2.on("exit", (code) => {
      if (code !== 0 && code !== null) failed(`${cmd} exited with code ${code}`);
    });
    child2.unref();
  } catch (err) {
    failed(errText(err));
  }
}

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/error.js
function getLineColFromPtr(string2, ptr) {
  let lines = string2.slice(0, ptr).split(/\r?\n/);
  return [lines.length, lines.pop().length + 1];
}
function makeCodeBlock(string2, line2, column) {
  let lines = string2.split(/\r?\n/);
  let codeblock = "";
  let numberLen = (Math.log10(line2 + 1) | 0) + 1;
  for (let i = line2 - 1; i <= line2 + 1; i++) {
    let l = lines[i - 1];
    if (!l)
      continue;
    codeblock += i.toString().padEnd(numberLen, " ");
    codeblock += ":  ";
    codeblock += l;
    codeblock += "\n";
    if (i === line2) {
      codeblock += " ".repeat(numberLen + column + 2);
      codeblock += "^\n";
    }
  }
  return codeblock;
}
var TomlError = class _TomlError extends Error {
  line;
  column;
  codeblock;
  constructor(message, options) {
    const [line2, column] = getLineColFromPtr(options.toml, options.ptr);
    const codeblock = makeCodeBlock(options.toml, line2, column);
    super(`Invalid TOML document: ${message}

${codeblock}`, options);
    this.line = line2;
    this.column = column;
    this.codeblock = codeblock;
  }
  /** @internal */
  static x(message, ctx, ptr) {
    throw new _TomlError(message, { toml: ctx.s, ptr: ptr ?? ctx.p });
  }
};

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/primitive.js
function parseString(ctx) {
  let startPtr = ctx.p;
  let c = ctx.s.charCodeAt(ctx.p++);
  let first = c;
  let isLiteral = c === 39;
  let isMultiline = c === ctx.s.charCodeAt(ctx.p) && c === ctx.s.charCodeAt(ctx.p + 1);
  if (isMultiline) {
    if ((c = ctx.s.charCodeAt(ctx.p += 2)) === 10)
      ctx.p++;
    else if (c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)
      ctx.p += 2;
  }
  let parsed = "";
  let sliceStart = ctx.p;
  let state = 0;
  for (; ctx.p < ctx.s.length; ctx.p++) {
    c = ctx.s.charCodeAt(ctx.p);
    if (isMultiline && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)) {
      state = state && 3;
    } else if (c < 32 && c !== 9 || c === 127) {
      TomlError.x("control characters are not allowed in strings", ctx);
    } else if ((!state || state === 3) && c === first && (!isMultiline || ctx.s.charCodeAt(ctx.p + 1) === first && ctx.s.charCodeAt(ctx.p + 2) === first)) {
      if (isMultiline) {
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
      }
      if (!state) {
        let s = ctx.s.slice(sliceStart, ctx.p);
        parsed = parsed ? parsed + s : s;
      }
      ctx.p += isMultiline ? 3 : 1;
      return parsed;
    } else if (!state) {
      if (!isLiteral && c === 92) {
        parsed += ctx.s.slice(sliceStart, sliceStart = ctx.p);
        state = 1;
      }
    } else if (state === 1) {
      if (c === 120 || c === 117 || c === 85) {
        let errPtr = ctx.p++ - 1;
        let value = 0;
        let len = c === 120 ? 2 : c === 117 ? 4 : 8;
        for (let j = 0; j < len; j++, ctx.p++) {
          let hex = ctx.s.charCodeAt(ctx.p);
          let digit = (
            /* 0-9 */
            hex >= 48 && hex <= 57 ? hex - 48 : (
              /* A-F */
              hex >= 65 && hex <= 70 ? hex - 65 + 10 : (
                /* a-f */
                hex >= 97 && hex <= 102 ? hex - 97 + 10 : -1
              )
            )
          );
          if (digit < 0)
            TomlError.x("invalid non-hex character in unicode escape", ctx);
          value = value << 4 | digit;
        }
        if (value < 0 || value > 1114111 || value >= 55296 && value <= 57343) {
          TomlError.x("invalid unicode escape", ctx, errPtr);
        }
        parsed += String.fromCodePoint(value);
        sliceStart = ctx.p--;
        state = 0;
      } else if (isMultiline && (c === 32 || c === 9)) {
        state = 2;
      } else {
        if (c === 98)
          parsed += "\b";
        else if (c === 116)
          parsed += "	";
        else if (c === 110)
          parsed += "\n";
        else if (c === 102)
          parsed += "\f";
        else if (c === 114)
          parsed += "\r";
        else if (c === 101)
          parsed += "\x1B";
        else if (c === 34)
          parsed += '"';
        else if (c === 92)
          parsed += "\\";
        else
          TomlError.x("unrecognised escape sequence", ctx);
        sliceStart = ctx.p + 1;
        state = 0;
      }
    } else if (c !== 32 && c !== 9) {
      if (state === 2)
        TomlError.x("invalid escape: only line-ending whitespace may be escaped", ctx, sliceStart);
      state = !isLiteral && c === 92 ? 1 : 0;
      sliceStart = ctx.p;
    }
  }
  TomlError.x("unfinished string", ctx, startPtr);
}

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/date.js
var DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})?[Tt ]?(?:(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?)?(Z|z|[-+]\d{2}:\d{2})?$/i;
var TomlDate = class _TomlDate extends Date {
  #hasDate = false;
  #hasTime = false;
  #offset = null;
  constructor(date, fasttype, unsafeDelim) {
    let hasDate = true;
    let hasTime = true;
    let offset = "Z";
    let c;
    if (typeof date === "string") {
      if (fasttype)
        prep: {
          if (fasttype < 3) {
            if (+date.slice(11, 13) > 23) {
              date = "";
              break prep;
            }
            if (fasttype === 2) {
              offset = null;
              date += "Z";
            } else if ((c = date.charCodeAt(date.length - 1)) !== 90 && c !== 122) {
              offset = date.slice(date.length - 6);
            }
            if (unsafeDelim)
              date = date.slice(0, 10) + "T" + date.slice(11);
          } else if (fasttype === 4) {
            date = +date.slice(0, 2) > 23 ? "" : `0000-01-01T${date}Z`;
          }
          hasDate = fasttype !== 4;
          hasTime = fasttype !== 3;
        }
      else {
        let match = date.match(DATE_TIME_RE);
        if (match) {
          if (!match[1]) {
            hasDate = false;
            date = `0000-01-01T${date}`;
          }
          hasTime = !!match[2];
          hasTime && date[10] === " " && (date = date.replace(" ", "T"));
          if (match[2] && +match[2] > 23) {
            date = "";
          } else {
            offset = match[3] || null;
            if (!offset && hasTime)
              date += "Z";
          }
        } else {
          date = "";
        }
      }
    }
    super(date);
    if (!isNaN(this.getTime())) {
      this.#hasDate = hasDate;
      this.#hasTime = hasTime;
      this.#offset = offset;
    }
  }
  isDateTime() {
    return this.#hasDate && this.#hasTime;
  }
  isLocal() {
    return !this.#hasDate || !this.#hasTime || !this.#offset;
  }
  isDate() {
    return this.#hasDate && !this.#hasTime;
  }
  isTime() {
    return this.#hasTime && !this.#hasDate;
  }
  isValid() {
    return this.#hasDate || this.#hasTime;
  }
  toISOString() {
    let iso = super.toISOString();
    if (this.isDate())
      return iso.slice(0, 10);
    if (this.isTime())
      return iso.slice(11, 23);
    if (this.#offset === null)
      return iso.slice(0, -1);
    if (this.#offset === "Z" || this.#offset === "z")
      return iso;
    let offset = +this.#offset.slice(1, 3) * 60 + +this.#offset.slice(4, 6);
    offset = this.#offset[0] === "-" ? offset : -offset;
    let offsetDate = new Date(this.getTime() - offset * 6e4);
    return offsetDate.toISOString().slice(0, -1) + this.#offset;
  }
  static wrapAsOffsetDateTime(jsDate, offset = "Z") {
    let date = new _TomlDate(jsDate);
    date.#offset = offset;
    return date;
  }
  static wrapAsLocalDateTime(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#offset = null;
    return date;
  }
  static wrapAsLocalDate(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#hasTime = false;
    date.#offset = null;
    return date;
  }
  static wrapAsLocalTime(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#hasDate = false;
    date.#offset = null;
    return date;
  }
};

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/extract.js
function isDigit(char, base = 10) {
  return base === 16 ? char > 47 && char < 58 || char > 64 && char < 71 || char > 96 && char < 103 : char > 47 && char < 48 + base;
}
function isEndOfValue(char, delim) {
  return char === 32 || char === 9 || char === 10 || char === 13 || // Structure end or next value delimiter
  delim && (char === delim || char === 44) || // Comment
  char === 35;
}
function extractValue(ctx, end) {
  let errPtr = ctx.p;
  let c = ctx.s.charCodeAt(ctx.p);
  if (c === 91 || c === 123) {
    ctx.d-- || TomlError.x("document contains excessively nested structures. aborting.", ctx);
    let value = c === 91 ? parseArray(ctx) : parseInlineTable(ctx);
    ctx.d++;
    return value;
  }
  if (c === 34 || c === 39) {
    return parseString(ctx);
  }
  if (c === 116) {
    if (ctx.s.charCodeAt(++ctx.p) !== 114 || ctx.s.charCodeAt(++ctx.p) !== 117 || ctx.s.charCodeAt(++ctx.p) !== 101)
      TomlError.x("invalid value", ctx, errPtr);
    return ctx.p++, true;
  }
  if (c === 102) {
    if (ctx.s.charCodeAt(++ctx.p) !== 97 || ctx.s.charCodeAt(++ctx.p) !== 108 || ctx.s.charCodeAt(++ctx.p) !== 115 || ctx.s.charCodeAt(++ctx.p) !== 101)
      TomlError.x("invalid value", ctx, errPtr);
    return ctx.p++, false;
  }
  if (c === 43 || c === 45) {
    return parseNumber(ctx, ctx.p, ctx.s.charCodeAt(++ctx.p), 44 - c, end);
  }
  if (ctx.s.charCodeAt(ctx.p + 4) === 45 && ctx.s.charCodeAt(ctx.p + 7) === 45) {
    return parseDate(ctx, c, end);
  }
  if (ctx.s.charCodeAt(ctx.p + 2) === 58) {
    return parseTime(ctx, c, end);
  }
  return parseNumber(ctx, ctx.p, c, 0, end);
}
function parseNumber(ctx, startPtr, startChr, sign, endChr) {
  let c = startChr;
  let state = 0;
  let hasUnderscores = false;
  if (c === 105) {
    if (ctx.s.charCodeAt(++ctx.p) !== 110 || ctx.s.charCodeAt(++ctx.p) !== 102)
      TomlError.x("invalid value", ctx, startPtr);
    return ctx.p++, (sign || 1) / 0;
  }
  if (c === 110) {
    if (ctx.s.charCodeAt(++ctx.p) !== 97 || ctx.s.charCodeAt(++ctx.p) !== 110)
      TomlError.x("invalid value", ctx, startPtr);
    return ctx.p++, NaN;
  }
  if (c === 48) {
    if (++ctx.p >= ctx.s.length || isEndOfValue(c = ctx.s.charCodeAt(ctx.p), endChr))
      return ctx.bi === true ? 0n : 0;
    if (!sign) {
      if (c === 120)
        return parseIntegerBaseN(ctx, startPtr, 16, endChr);
      else if (c === 98)
        return parseIntegerBaseN(ctx, startPtr, 2, endChr);
      else if (c === 111)
        return parseIntegerBaseN(ctx, startPtr, 8, endChr);
    }
    if (c === 46)
      state = 2;
    else if (c === 101 || c === 69)
      state = 4;
    else
      TomlError.x("illegal leading zero", ctx, startPtr);
  } else if (!isDigit(c))
    TomlError.x("invalid value", ctx, startPtr);
  while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
    if (!state)
      state = 1;
    if (c === 95) {
      if (!(state & 1))
        TomlError.x("illegal underscore", ctx);
      state += 11;
      hasUnderscores = true;
    } else if (state === 1 && c === 46)
      state = 2;
    else if ((state === 1 || state === 3) && (c === 101 || c === 69))
      state = 4;
    else if (state === 4 && (c === 43 || c === 45)) {
      state = 6;
    } else if (!isDigit(c))
      TomlError.x(`illegal character in numeric literal`, ctx);
    else if (state > 9)
      state -= 11;
    else if (!(state & 1))
      state++;
  }
  if (!state) {
    let val = (startChr - 48) * (sign || 1);
    return ctx.bi === true ? BigInt(val) : val;
  }
  if (!(state & 1))
    TomlError.x("unfinished numeric value", ctx, startPtr);
  let str2 = ctx.s.slice(startPtr, ctx.p);
  if (hasUnderscores)
    str2 = str2.replaceAll("_", "");
  return state > 1 ? parseFloat(str2) : parseInteger(ctx, str2, 10, startPtr);
}
function parseIntegerBaseN(ctx, startPtr, base, endChr) {
  let c, underscore = 1;
  while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
    if (c === 95) {
      if (underscore & 1)
        TomlError.x("illegal underscore", ctx);
      underscore = 3;
    } else if (!isDigit(c, base))
      TomlError.x(`illegal character in numeric literal`, ctx);
    else if (underscore & 1)
      underscore--;
  }
  if (underscore & 1)
    TomlError.x("unfinished numeric value", ctx);
  let str2 = ctx.s.slice(startPtr + 2, ctx.p);
  if (underscore)
    str2 = str2.replaceAll("_", "");
  return parseInteger(ctx, str2, base, startPtr);
}
function parseInteger(ctx, str2, base, startPtr) {
  if (ctx.bi !== true)
    int: {
      let val = parseInt(str2, base);
      if (!Number.isSafeInteger(val)) {
        if (ctx.bi)
          break int;
        TomlError.x("integer value cannot be represented losslessly", ctx, startPtr);
      }
      return val;
    }
  return base === 10 ? BigInt(str2) : BigInt((base === 2 ? "0b" : base === 8 ? "0o" : "0x") + str2);
}
function parseDate(ctx, c, endChr) {
  let startPtr = ctx.p++, unsafeSeparator;
  if (!isDigit(c) || !isDigit(ctx.s.charCodeAt(ctx.p++)) || !isDigit(ctx.s.charCodeAt(ctx.p++)) || !isDigit(ctx.s.charCodeAt(ctx.p++))) {
    return parseNumber(ctx, ctx.p = startPtr, c, 0, endChr);
  }
  ctx.p += 5;
  if (!isDigit(ctx.s.charCodeAt(ctx.p++)))
    TomlError.x("invalid date-time: date part is malformed", ctx, startPtr);
  if (ctx.p >= ctx.s.length || ((c = ctx.s.charCodeAt(ctx.p)) !== 32 || (unsafeSeparator = true, !isDigit(ctx.s.charCodeAt(ctx.p + 1)))) && c !== 84 && c !== 116) {
    let t2 = ctx.s.slice(startPtr, ctx.p);
    return readDate(ctx, t2, 3, false, startPtr);
  }
  if (ctx.s.charCodeAt(ctx.p += 3) !== 58)
    TomlError.x("invalid date-time: time part is malformed", ctx, startPtr);
  if (ctx.s.charCodeAt(ctx.p += 3) === 58)
    ctx.p += 3;
  if (ctx.s.charCodeAt(ctx.p) === 46)
    while (isDigit(ctx.s.charCodeAt(++ctx.p)))
      ;
  if (c = ctx.s.charCodeAt(ctx.p)) {
    if (c === 90 || c === 122) {
      let t2 = ctx.s.slice(startPtr, ++ctx.p);
      return readDate(ctx, t2, 1, unsafeSeparator, startPtr, "[+00:00]");
    }
    if (c === 43 || c === 45) {
      let t2 = ctx.s.slice(startPtr, ctx.p += 6);
      return readDate(ctx, t2, 1, unsafeSeparator, startPtr, !ctx.ld && "[" + ctx.s.slice(ctx.p - 6, ctx.p) + "]");
    }
  }
  let t = ctx.s.slice(startPtr, ctx.p);
  return readDate(ctx, t, 2, unsafeSeparator, startPtr);
}
function parseTime(ctx, c, endChr) {
  let start = ctx.p;
  if (!isDigit(c) || !isDigit(ctx.s.charCodeAt(++ctx.p))) {
    return parseNumber(ctx, --ctx.p, c, 0, endChr);
  }
  if (ctx.s.charCodeAt(ctx.p += 4) === 58)
    ctx.p += 3;
  if (ctx.s.charCodeAt(ctx.p) === 46)
    while (isDigit(ctx.s.charCodeAt(++ctx.p)))
      ;
  let t = ctx.s.slice(start, ctx.p);
  return readDate(ctx, t, 4, false, start);
}
function readDate(ctx, str2, type, unsafeDelim, errPtr, temporalSuffix) {
  if (ctx.ld) {
    let date = new TomlDate(str2, type, unsafeDelim);
    if (!date.isValid())
      TomlError.x("invalid date", ctx, errPtr);
    return date;
  }
  try {
    if (temporalSuffix)
      str2 += temporalSuffix;
    switch (type) {
      case 1:
        return Temporal.ZonedDateTime.from(str2);
      case 2:
        return Temporal.PlainDateTime.from(str2);
      case 3:
        return Temporal.PlainDate.from(str2);
      case 4:
        return Temporal.PlainTime.from(str2);
    }
  } catch (e) {
    TomlError.x(e instanceof Error ? e.message : "" + e, ctx, errPtr);
  }
}

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/util.js
function skipComment(ctx) {
  for (; ctx.p < ctx.s.length; ctx.p++) {
    let c = ctx.s.charCodeAt(ctx.p);
    if (c === 10)
      break;
    if (c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10) {
      ctx.p++;
      break;
    }
    if (c < 32 && c !== 9 || c === 127) {
      TomlError.x("control characters are not allowed in comments", ctx);
    }
  }
}
function skipVoid(ctx, banNewLines, banComments) {
  let c;
  while (ctx.p < ctx.s.length) {
    while (ctx.p < ctx.s.length && ((c = ctx.s.charCodeAt(ctx.p)) === 32 || c === 9 || !banNewLines && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)))
      ctx.p++;
    if (banComments || c !== 35)
      break;
    skipComment(ctx);
  }
}

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/struct.js
function parseKey(ctx, end = 61) {
  let startPtr;
  let state = 0;
  let parsed = [];
  let sliceStart;
  let c = ctx.s.charCodeAt(startPtr = ctx.p);
  do {
    if (c === end) {
      if (!state)
        TomlError.x("unexpected end of key", ctx);
      if (state === 1)
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
      return ctx.p++, parsed;
    } else if (c === 46) {
      if (!state)
        TomlError.x("illegal empty bare key", ctx);
      if (state === 1)
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
      state = 0;
    } else if (!state && (c === 34 || c === 39)) {
      if (c === ctx.s.charCodeAt(ctx.p + 1) && c === ctx.s.charCodeAt(ctx.p + 2))
        TomlError.x("illegal quoted key: multiline strings are not allowed", ctx);
      parsed.push(parseString(ctx));
      state = 2;
      ctx.p--;
    } else if (c === 32 || c === 9) {
      if (state === 1) {
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
        state = 2;
      }
    } else if (state === 2 || c < 48 && c !== 45 || c > 57 && c < 65 || c > 90 && c < 97 && c !== 95 || c > 122) {
      TomlError.x("illegal character in key", ctx);
    } else if (!state) {
      state = 1;
      sliceStart = ctx.p;
    }
  } while (c = ctx.s.charCodeAt(++ctx.p));
  TomlError.x("incomplete key-value: cannot find end of key", ctx, startPtr);
}
function parseInlineTable(ctx) {
  let startPtr = ctx.p++;
  let res = /* @__PURE__ */ Object.create(null);
  let seen = /* @__PURE__ */ new Set();
  let c;
  while (ctx.p < ctx.s.length) {
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p)) === 125) {
      ctx.p++;
      return res;
    }
    let k;
    let t = res;
    let hasOwn = false;
    let errPtr = ctx.p;
    let key = parseKey(ctx);
    for (let i = 0; i < key.length; i++) {
      if (i)
        t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
      k = key[i];
      if ((hasOwn = Object.hasOwn(t, k)) && (typeof t[k] !== "object" || seen.has(t[k]))) {
        TomlError.x("trying to redefine an already defined value", ctx, errPtr);
      }
      let unsafe = k === "__proto__";
      if (ctx.uk && (unsafe || k === "constructor")) {
        t = ctx.uk !== 1 && TomlError.x("document contains an unsafe property", ctx, errPtr);
        break;
      }
      if (!hasOwn && unsafe) {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
      }
    }
    if (hasOwn) {
      TomlError.x("trying to redefine an already defined value", ctx, errPtr);
    }
    skipVoid(ctx, true, true);
    let value = extractValue(
      ctx,
      125
      /* } */
    );
    if (t && typeof (t[k] = value) === "object")
      seen.add(value);
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p++)) === 125) {
      return res;
    }
    if (c !== 44)
      TomlError.x("expected comma or end of structure", ctx, ctx.p - 1);
  }
  TomlError.x("unfinished table", ctx, startPtr);
}
function parseArray(ctx) {
  let startPtr = ctx.p++;
  let res = [];
  let c;
  while (ctx.p < ctx.s.length) {
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p)) === 93) {
      ctx.p++;
      return res;
    }
    res.push(extractValue(
      ctx,
      93
      /* ] */
    ));
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p++)) === 93) {
      return res;
    }
    if (c !== 44)
      TomlError.x("expected comma or end of structure", ctx, ctx.p - 1);
  }
  TomlError.x("unfinished array", ctx, startPtr);
}

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/parse.js
function peekTable(ctx, key, table, meta, type) {
  let t = table;
  let m = meta;
  let k;
  let hasOwn = false;
  let state;
  for (let i = 0; i < key.length; i++) {
    if (i) {
      t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
      m = (state = m[k]).c;
      if (type === 0 && (state.t === 1 || state.t === 2)) {
        return null;
      }
      if (state.t === 2) {
        let l = t.length - 1;
        t = t[l];
        m = m[l].c;
      }
    }
    k = key[i];
    if ((hasOwn = Object.hasOwn(t, k)) && m[k]?.t === 0 && m[k]?.d) {
      return null;
    }
    if (!hasOwn) {
      let unsafe = k === "__proto__";
      if (ctx.uk && (unsafe || k === "constructor"))
        return false;
      if (unsafe) {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
        Object.defineProperty(m, k, { enumerable: true, configurable: true, writable: true });
      }
      m[k] = {
        t: i < key.length - 1 && type === 2 ? 3 : type,
        d: false,
        i: 0,
        c: /* @__PURE__ */ Object.create(null)
      };
    }
  }
  state = m[k];
  if (state.t !== type && !(type === 1 && state.t === 3)) {
    return null;
  }
  if (type === 2) {
    if (!state.d) {
      state.d = true;
      t[k] = [];
    }
    t[k].push(t = /* @__PURE__ */ Object.create(null));
    state.c[state.i++] = state = { t: 1, d: false, i: 0, c: /* @__PURE__ */ Object.create(null) };
  }
  if (state.d) {
    return null;
  }
  state.d = true;
  if (type === 1) {
    t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
  } else if (type === 0 && hasOwn) {
    return null;
  }
  return [k, t, state.c];
}
function validateTablePeek(ctx, peek, ptr) {
  if (peek === null || ctx.uk === 2)
    TomlError.x(peek === null ? "trying to redefine an already defined table or value" : "document contains an unsafe property", ctx, ptr);
}
function parse2(toml, options = {}) {
  let ctx = {
    s: toml,
    p: 0,
    d: options.maxDepth ?? 1e3,
    bi: options.integersAsBigInt ?? false,
    ld: options.useLegacyDate ?? true,
    uk: options.unsafeKeyBehaviour === "throw" ? 2 : options.unsafeKeyBehaviour === "drop" ? 1 : 0
  };
  let res = /* @__PURE__ */ Object.create(null);
  let meta = /* @__PURE__ */ Object.create(null);
  let tmp;
  let skipping = false;
  let tbl = res;
  let m = meta;
  if (toml.charCodeAt(0) === 65279)
    ctx.p++;
  skipVoid(ctx);
  while (ctx.p < toml.length) {
    if (toml.charCodeAt(ctx.p) === 91) {
      let isTableArray = toml.charCodeAt(++ctx.p) === 91;
      tmp = ctx.p += +isTableArray;
      skipping = false;
      let k = parseKey(
        ctx,
        93
        /* ] */
      );
      if (isTableArray) {
        if (toml.charCodeAt(ctx.p) !== 93) {
          TomlError.x("expected end of table array declaration", ctx);
        }
        ctx.p++;
      }
      let p = peekTable(
        ctx,
        k,
        res,
        meta,
        isTableArray ? 2 : 1
        /* Type.EXPLICIT */
      );
      if (!p) {
        validateTablePeek(ctx, p, tmp);
        skipping = true;
      } else {
        m = p[2];
        tbl = p[1];
      }
    } else {
      tmp = ctx.p;
      let k = parseKey(ctx);
      let p = peekTable(
        ctx,
        k,
        tbl,
        m,
        0
        /* Type.DOTTED */
      );
      if (!p && !skipping)
        validateTablePeek(ctx, p, tmp);
      skipVoid(ctx, true, true);
      let v = extractValue(ctx, void 0);
      if (p && !skipping)
        p[1][p[0]] = v;
    }
    skipVoid(ctx, true);
    if (ctx.p < toml.length && (tmp = toml.charCodeAt(ctx.p)) !== 10 && (tmp !== 13 || toml.charCodeAt(ctx.p + 1) !== 10)) {
      TomlError.x("each key-value declaration must be followed by an end-of-line", ctx);
    }
    skipVoid(ctx);
  }
  return res;
}

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/stringify.js
var HAS_WELLFORMED = !!"".isWellFormed;

// packages/mcbuilder/src/config.ts
var ConfigError = class extends McbuilderError {
};
var DEFAULT_MAX_DIMENSIONS = [256, 256, 256];
function pyInt(v) {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("not finite");
    return Math.trunc(v);
  }
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && /^\s*[+-]?\d+\s*$/.test(v)) return Number.parseInt(v, 10);
  throw new Error("not an integer");
}
function expandUser(path, home) {
  if (path === "~") return home;
  if (path.startsWith("~/")) return `${home.replace(/\/$/, "")}/${path.slice(2)}`;
  return path;
}
function parseConfig(text2, options = {}) {
  const source = options.source ?? "mcbuild.toml";
  let data;
  try {
    data = parse2(text2);
  } catch (e) {
    throw new ConfigError(`invalid TOML in ${source}: ${e.message}`);
  }
  const mcVersion = data.mc_version ?? "26.2";
  if (typeof mcVersion !== "string" || mcVersion === "") {
    throw new ConfigError("mc_version must be a non-empty string");
  }
  const rawDims = data.max_dimensions ?? [...DEFAULT_MAX_DIMENSIONS];
  let dims;
  try {
    if (!Array.isArray(rawDims)) throw new Error("not a list");
    dims = rawDims.map(pyInt);
  } catch {
    throw new ConfigError(
      `max_dimensions must be a list of 3 integers, got ${JSON.stringify(rawDims)}`
    );
  }
  if (dims.length !== 3 || dims.some((d) => d <= 0)) {
    throw new ConfigError(
      `max_dimensions must be 3 positive integers, got ${JSON.stringify(rawDims)}`
    );
  }
  const allowlist = data.allowlist ?? [];
  if (!Array.isArray(allowlist) || !allowlist.every((a) => typeof a === "string")) {
    throw new ConfigError(`allowlist must be a list of strings, got ${JSON.stringify(allowlist)}`);
  }
  let assetsDir = null;
  if (data.assets_dir !== void 0) {
    if (typeof data.assets_dir !== "string") {
      throw new ConfigError(
        `assets_dir must be a string path, got ${JSON.stringify(data.assets_dir)}`
      );
    }
    assetsDir = options.home === void 0 ? data.assets_dir : expandUser(data.assets_dir, options.home);
  }
  return {
    mcVersion,
    maxDimensions: dims,
    allowlist: [...allowlist],
    assetsDir
  };
}
function resolveAssetsDir(config, home) {
  return config.assetsDir ?? `${home.replace(/\/$/, "")}/.cache/mcbuilder/${config.mcVersion}`;
}

// packages/mcbuilder/src/diff.ts
var DiffError = class extends McbuilderError {
};
var voxelKey = (x, y, z) => `${x},${y},${z}`;
var posOf = (key) => key.split(",").map(Number);
var isEmpty = (d) => d.added.length + d.removed.length + d.changed.length === 0;
var total = (d) => d.added.length + d.removed.length + d.changed.length;
var cmpPos = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
function diffVoxelMaps(a, b) {
  const keys = [.../* @__PURE__ */ new Set([...a.keys(), ...b.keys()])].map((k) => ({ key: k, pos: posOf(k) }));
  keys.sort((p, q) => cmpPos(p.pos, q.pos));
  const out = { added: [], removed: [], changed: [], cellsA: a.size, cellsB: b.size };
  for (const { key, pos } of keys) {
    const inA = a.has(key);
    const inB = b.has(key);
    if (inA && !inB) out.removed.push([pos, a.get(key)]);
    else if (inB && !inA) out.added.push([pos, b.get(key)]);
    else if (a.get(key) !== b.get(key))
      out.changed.push([pos, a.get(key), b.get(key)]);
  }
  return out;
}
function n(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}
function formatDiff(diff, aId, bId, options = {}) {
  const maxEntries = options.maxEntries ?? 30;
  const lines = [`diff ${aId} -> ${bId}`];
  if (isEmpty(diff)) {
    lines.push(`  no differences (${n(diff.cellsA, "cell")} in both)`);
    return lines.join("\n");
  }
  lines.push(
    `  ${n(total(diff), "changed cell")}: ${diff.added.length} added, ${diff.removed.length} removed, ${diff.changed.length} replaced (${diff.cellsA} -> ${diff.cellsB} cells)`
  );
  const entries2 = [
    ...diff.added.map(([pos, blk]) => ["+", pos, blk, null]),
    ...diff.removed.map(([pos, blk]) => [
      "-",
      pos,
      blk,
      null
    ]),
    ...diff.changed.map(([pos, o, nw]) => ["~", pos, o, nw])
  ];
  const shown = Math.min(entries2.length, Math.max(0, maxEntries));
  for (const [sym, pos, old, nw] of entries2.slice(0, Math.max(0, maxEntries))) {
    const xyz2 = pos.join(", ");
    lines.push(nw === null ? `  ${sym} (${xyz2}) ${old}` : `  ~ (${xyz2}) ${old} -> ${nw}`);
  }
  const rest = entries2.length - shown;
  if (rest) lines.push(`  ... ${n(rest, "more change")} not shown (use --max N)`);
  return lines.join("\n");
}

// packages/render/src/image.ts
function newImage(width, height, rgb) {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) data.set(rgb, i * 3);
  return { width, height, channels: 3, data };
}
function scaleChannels(img, factors) {
  const c = img.channels;
  const data = new Uint8Array(img.data);
  for (let i = 0; i < img.width * img.height; i++) {
    for (let k = 0; k < 3; k++) {
      data[i * c + k] = Math.min(
        255,
        Math.trunc(img.data[i * c + k] * factors[k])
      );
    }
  }
  return { ...img, data };
}
function tint(img, rgb) {
  return scaleChannels(img, [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255]);
}

// packages/render/src/md5.ts
var S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
var K2 = Array.from(
  { length: 64 },
  (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0
);
function md5(data) {
  const padded = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64);
  padded.set(data);
  padded[data.length] = 128;
  const view = new DataView(padded.buffer);
  const bits = data.length * 8;
  view.setUint32(padded.length - 8, bits >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bits / 2 ** 32), true);
  let [a0, b0, c0, d0] = [1732584193, 4023233417, 2562383102, 271733878];
  const m = new Uint32Array(16);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) m[i] = view.getUint32(off + i * 4, true);
    let [a, b, c, d] = [a0, b0, c0, d0];
    for (let i = 0; i < 64; i++) {
      let f;
      let g;
      if (i < 16) {
        f = b & c | ~b & d;
        g = i;
      } else if (i < 32) {
        f = d & b | ~d & c;
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = 7 * i % 16;
      }
      f = f + a + K2[i] + m[g] | 0;
      a = d;
      d = c;
      c = b;
      const s = S[(i >> 4) * 4 + i % 4];
      b = b + (f << s | f >>> 32 - s) | 0;
    }
    a0 = a0 + a | 0;
    b0 = b0 + b | 0;
    c0 = c0 + c | 0;
    d0 = d0 + d | 0;
  }
  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  for (const [i, v] of [a0, b0, c0, d0].entries()) ov.setUint32(i * 4, v >>> 0, true);
  return out;
}

// packages/render/src/constants.ts
var DEFAULT_PROPS = {
  facing: "north",
  half: "bottom",
  shape: "straight",
  type: "bottom",
  // slabs
  axis: "y",
  hanging: "false",
  // lanterns
  waterlogged: "false",
  open: "false",
  // Sign templates key variants on rotation= / attached=.
  rotation: "0",
  attached: "false",
  // grass_block / mycelium / podzol are the only blockstates keyed on snowy=.
  snowy: "false"
};
var PLAINS_GRASS = [145, 189, 89];
var PLAINS_FOLIAGE = [119, 171, 47];
var PLAINS_DRY_FOLIAGE = [163, 117, 70];
var TINT_TABLE = {
  "minecraft:grass_block": PLAINS_GRASS,
  "minecraft:short_grass": PLAINS_GRASS,
  "minecraft:tall_grass": PLAINS_GRASS,
  "minecraft:fern": PLAINS_GRASS,
  "minecraft:large_fern": PLAINS_GRASS,
  "minecraft:potted_fern": PLAINS_GRASS,
  "minecraft:sugar_cane": PLAINS_GRASS,
  "minecraft:bush": PLAINS_GRASS,
  "minecraft:wildflowers": PLAINS_GRASS,
  "minecraft:pink_petals": PLAINS_GRASS,
  "minecraft:bamboo": PLAINS_GRASS,
  "minecraft:oak_leaves": PLAINS_FOLIAGE,
  "minecraft:jungle_leaves": PLAINS_FOLIAGE,
  "minecraft:acacia_leaves": PLAINS_FOLIAGE,
  "minecraft:dark_oak_leaves": PLAINS_FOLIAGE,
  "minecraft:mangrove_leaves": PLAINS_FOLIAGE,
  "minecraft:vine": PLAINS_FOLIAGE,
  "minecraft:leaf_litter": PLAINS_DRY_FOLIAGE,
  "minecraft:birch_leaves": [128, 167, 85],
  "minecraft:spruce_leaves": [97, 153, 97],
  "minecraft:lily_pad": [32, 128, 48]
};

// packages/render/src/models.ts
function splitBlockstate(canonical2) {
  const head = canonical2.split("{", 1)[0];
  const open = head.indexOf("[");
  if (open === -1) return [head, {}];
  const props = {};
  for (const p of head.slice(open + 1).replace(/\]+$/, "").split(",")) {
    const eq = p.indexOf("=");
    if (eq !== -1) props[p.slice(0, eq)] = p.slice(eq + 1);
  }
  return [head.slice(0, open), props];
}

// packages/render/src/blocks.ts
var DYE_RGB = {
  white: [249, 255, 254],
  orange: [249, 128, 29],
  magenta: [199, 78, 189],
  light_blue: [58, 179, 218],
  yellow: [254, 216, 61],
  lime: [128, 199, 31],
  pink: [243, 139, 170],
  gray: [71, 79, 82],
  light_gray: [157, 157, 151],
  cyan: [22, 156, 156],
  purple: [137, 50, 184],
  blue: [60, 68, 170],
  brown: [131, 84, 50],
  green: [94, 124, 22],
  red: [176, 46, 38],
  black: [29, 29, 33]
};
var FLUID_SURFACE_HEIGHT = 8 / 9;
var COPPER_CHEST = [200, 120, 70];
var FLAT_COLORS = {
  "minecraft:water": [63, 118, 228],
  "minecraft:lava": [255, 110, 20],
  "minecraft:chest": [181, 140, 82],
  "minecraft:trapped_chest": [170, 110, 75],
  "minecraft:ender_chest": [60, 55, 70]
};
for (const stage of ["", "exposed_", "weathered_", "oxidized_"]) {
  FLAT_COLORS[`minecraft:${stage}copper_chest`] = COPPER_CHEST;
  FLAT_COLORS[`minecraft:waxed_${stage}copper_chest`] = COPPER_CHEST;
}
for (const [dye, rgb] of Object.entries(DYE_RGB)) {
  FLAT_COLORS[`minecraft:${dye}_banner`] = rgb;
  FLAT_COLORS[`minecraft:${dye}_wall_banner`] = rgb;
}
var hasFlatColor = (name) => Object.hasOwn(FLAT_COLORS, name);
function fallbackColor(blockName) {
  const flat = Object.hasOwn(FLAT_COLORS, blockName) ? FLAT_COLORS[blockName] : void 0;
  if (flat !== void 0) return flat;
  const d = md5(new TextEncoder().encode(blockName));
  return [d[0], d[1], d[2]];
}

// packages/render/src/draw.ts
function createCanvas(width, height, rgb) {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) data.set(rgb, i * 3);
  return { width, height, data };
}
function set(c, x, y, rgb) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  c.data.set(rgb, (y * c.width + x) * 3);
}
function drawLine2(c, x0, y0, x1, y1, rgb) {
  let [x, y] = [Math.round(x0), Math.round(y0)];
  const [ex, ey] = [Math.round(x1), Math.round(y1)];
  const dx = Math.abs(ex - x);
  const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let err = dx + dy;
  for (; ; ) {
    set(c, x, y, rgb);
    if (x === ex && y === ey) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
function drawRect(c, x0, y0, x1, y1, fill, outline) {
  const [lx, hx] = [Math.round(Math.min(x0, x1)), Math.round(Math.max(x0, x1))];
  const [ly, hy] = [Math.round(Math.min(y0, y1)), Math.round(Math.max(y0, y1))];
  for (let y = ly; y <= hy; y++) for (let x = lx; x <= hx; x++) set(c, x, y, fill);
  if (outline) {
    for (let x = lx; x <= hx; x++) {
      set(c, x, ly, outline);
      set(c, x, hy, outline);
    }
    for (let y = ly; y <= hy; y++) {
      set(c, lx, y, outline);
      set(c, hx, y, outline);
    }
  }
}
function drawPolygon(c, pts, fill, outline) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const yc = y + 0.5;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if (y1 <= yc && y2 > yc || y2 <= yc && y1 > yc)
        xs.push(x1 + (yc - y1) / (y2 - y1) * (x2 - x1));
    }
    if (xs.length < 2) continue;
    const [a, b] = [Math.min(...xs), Math.max(...xs)];
    for (let x = Math.round(a); x <= Math.round(b); x++) set(c, x, y, fill);
  }
  if (outline)
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      drawLine2(c, x1, y1, x2, y2, outline);
    }
}
function drawEllipse(c, x0, y0, x1, y1, fill, outline) {
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  const [rx, ry] = [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2];
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const [nx, ny] = [(x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry];
      const d = nx * nx + ny * ny;
      if (d <= 1) set(c, x, y, outline && d > 0.6 ? outline : fill);
    }
  }
}
function resizeNearest(img, w, h) {
  const data = new Uint8Array(w * h * img.channels);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.floor((y + 0.5) * img.height / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x + 0.5) * img.width / w));
      for (let k = 0; k < img.channels; k++)
        data[(y * w + x) * img.channels + k] = img.data[(sy * img.width + sx) * img.channels + k];
    }
  }
  return { width: w, height: h, channels: img.channels, data };
}
function pasteRgb(c, img, left, top) {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * img.channels;
      set(c, left + x, top + y, [
        img.data[i],
        img.data[i + 1],
        img.data[i + 2]
      ]);
    }
  }
}
function blendToward(img, bg, alpha) {
  const data = new Uint8Array(img.data);
  for (let i = 0; i < img.width * img.height; i++) {
    for (let k = 0; k < 3; k++) {
      const a = data[i * img.channels + k];
      data[i * img.channels + k] = Math.trunc(a + alpha * (bg[k] - a));
    }
  }
  return { ...img, data };
}

// packages/render/src/fast.ts
var TEMPLATE_PARENTS = /* @__PURE__ */ new Set(["cube_all", "cube_column", "cube", "cube_mirrored"]);
var FACES = ["up", "down", "north", "south", "east", "west"];
var asObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v) ? v : null;
var afterColon = (s) => s.slice(s.indexOf(":") + 1);
function matchVariant(variants, explicit) {
  let best = null;
  let bestScore = null;
  for (const [key, value] of Object.entries(variants)) {
    const pairs = key ? key.split(",").filter((p) => p) : [];
    let nExp = 0;
    let nDef = 0;
    let ok = true;
    for (const p of pairs) {
      const eq = p.indexOf("=");
      const k = eq === -1 ? p : p.slice(0, eq);
      const v = eq === -1 ? "" : p.slice(eq + 1);
      if (Object.hasOwn(explicit, k)) {
        if (explicit[k] !== v) {
          ok = false;
          break;
        }
        nExp++;
      } else if (DEFAULT_PROPS[k] === v) nDef++;
    }
    if (!ok) continue;
    if (bestScore === null || nExp > bestScore[0] || nExp === bestScore[0] && nDef > bestScore[1]) {
      best = value;
      bestScore = [nExp, nDef];
    }
  }
  if (Array.isArray(best)) best = best.length > 0 ? best[0] : null;
  return asObject(best);
}
function resolveModelTextures(blockName, props, assets) {
  const empty = { images: /* @__PURE__ */ new Map(), parentLeaf: null, tintedVars: /* @__PURE__ */ new Set() };
  try {
    const bs = asObject(assets.readJson(`blockstates/${afterColon(blockName)}.json`));
    if (bs === null) return empty;
    let modelRef = null;
    const variants = asObject(bs.variants);
    if (variants !== null && Object.keys(variants).length > 0) {
      const v = matchVariant(variants, props);
      if (v?.model) modelRef = v.model;
    } else if (Array.isArray(bs.multipart) && bs.multipart.length > 0) {
      for (const c of bs.multipart) {
        let apply = c.apply;
        if (Array.isArray(apply)) apply = apply.length > 0 ? apply[0] : null;
        const a = asObject(apply);
        if (a?.model) {
          modelRef = a.model;
          break;
        }
      }
    }
    if (!modelRef) return empty;
    const chain = [];
    const seen = /* @__PURE__ */ new Set();
    let ref = modelRef;
    for (let i = 0; i < 8; i++) {
      const rel = afterColon(ref);
      if (seen.has(rel)) break;
      seen.add(rel);
      const model = asObject(assets.readJson(`models/${rel}.json`));
      if (model === null) break;
      chain.push(model);
      if (!model.parent || typeof model.parent !== "string") break;
      ref = model.parent;
    }
    if (chain.length === 0) return empty;
    const textures = {};
    for (const model of [...chain].reverse())
      Object.assign(textures, asObject(model.textures) ?? {});
    const sprite = (value) => {
      const o = asObject(value);
      return o !== null ? o.sprite ?? "" : value;
    };
    const resolve7 = (value, depth = 0) => {
      const v = sprite(value);
      if (typeof v !== "string" || !v.startsWith("#") || depth > 8) return v;
      return resolve7(textures[v.slice(1)] ?? "", depth + 1);
    };
    const leaves = [];
    ref = modelRef;
    for (const model of chain) {
      leaves.push(afterColon(ref).split("/").pop() ?? "");
      ref = typeof model.parent === "string" ? model.parent : "";
    }
    const parentLeaf = leaves.find((l) => TEMPLATE_PARENTS.has(l)) ?? null;
    const images = /* @__PURE__ */ new Map();
    for (const [name, value] of Object.entries(textures)) {
      const target = resolve7(value);
      images.set(
        name,
        typeof target === "string" && target !== "" ? assets.texture(afterColon(target), { firstFrameOnly: false }) : null
      );
    }
    const tintedVars = /* @__PURE__ */ new Set();
    for (const model of chain) {
      if (Array.isArray(model.elements) && model.elements.length > 0) {
        for (const el of model.elements) {
          const faces = asObject(asObject(el)?.faces) ?? {};
          for (const face of Object.values(faces)) {
            const f = asObject(face);
            if (f === null) continue;
            const ti = f.tintindex ?? -1;
            if (typeof ti === "number" && Number.isInteger(ti) && ti >= 0) {
              const v = String(f.texture ?? "").replace(/^#+/, "");
              if (images.has(v)) tintedVars.add(v);
            }
          }
        }
        break;
      }
    }
    return { images, parentLeaf, tintedVars };
  } catch {
    return empty;
  }
}
function faceTexVars(images, parentLeaf) {
  const keys = new Set([...images].filter(([, v]) => v !== null).map(([k]) => k));
  const all = (v) => ({
    up: v,
    down: v,
    north: v,
    south: v,
    east: v,
    west: v
  });
  if (parentLeaf === "cube_all") return all(keys.has("all") ? "all" : null);
  if (parentLeaf === "cube_column") {
    const end = keys.has("end") ? "end" : null;
    const side2 = keys.has("side") ? "side" : null;
    return { up: end, down: end, north: side2, south: side2, east: side2, west: side2 };
  }
  const pick2 = (...cands) => cands.find((c) => keys.has(c)) ?? null;
  const anyTex = [...keys].find((k) => k !== "particle") ?? null;
  const side = pick2("side", "front", "all", "texture") ?? anyTex;
  return {
    up: pick2("top", "up", "end", "all", "texture") ?? side,
    down: pick2("bottom", "down", "end", "all", "texture") ?? side,
    north: side,
    south: side,
    east: side,
    west: side
  };
}
function buildFaceTextures(block, assets, fallbackBlocks = /* @__PURE__ */ new Set()) {
  const [name, props] = splitBlockstate(block);
  const resolved = assets === null ? { images: /* @__PURE__ */ new Map(), parentLeaf: null, tintedVars: /* @__PURE__ */ new Set() } : resolveModelTextures(name, props, assets);
  const vars = faceTexVars(resolved.images, resolved.parentLeaf);
  const tintRgb = Object.hasOwn(TINT_TABLE, name) ? TINT_TABLE[name] : void 0;
  const out = {};
  for (const face of FACES) {
    const v = vars[face];
    let img = v ? resolved.images.get(v) ?? null : null;
    if (img === null) {
      if (!hasFlatColor(name)) fallbackBlocks.add(name);
      img = newImage(16, 16, fallbackColor(name));
    } else if (v && resolved.tintedVars.has(v) && tintRgb !== void 0) {
      img = tint(img, tintRgb);
    }
    out[face] = img;
  }
  return out;
}

// packages/render/src/font.ts
var G = {
  " ": ".....|.....|.....|.....|.....|.....|.....",
  "!": "..#..|..#..|..#..|..#..|..#..|.....|..#..",
  '"': ".#.#.|.#.#.|.....|.....|.....|.....|.....",
  "#": ".#.#.|#####|.#.#.|.#.#.|#####|.#.#.|.#.#.",
  $: "..#..|.####|#.#..|.###.|..#.#|####.|..#..",
  "%": "##..#|##..#|...#.|..#..|.#...|#..##|#..##",
  "&": ".##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#",
  "'": "..#..|..#..|.#...|.....|.....|.....|.....",
  "(": "...#.|..#..|.#...|.#...|.#...|..#..|...#.",
  ")": ".#...|..#..|...#.|...#.|...#.|..#..|.#...",
  "*": ".....|#.#.#|.###.|#####|.###.|#.#.#|.....",
  "+": ".....|..#..|..#..|#####|..#..|..#..|.....",
  ",": ".....|.....|.....|.....|..#..|..#..|.#...",
  "-": ".....|.....|.....|#####|.....|.....|.....",
  ".": ".....|.....|.....|.....|.....|.##..|.##..",
  "/": "....#|....#|...#.|..#..|.#...|#....|#....",
  "0": ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.",
  "1": "..#..|.##..|..#..|..#..|..#..|..#..|.###.",
  "2": ".###.|#...#|....#|...#.|..#..|.#...|#####",
  "3": ".###.|#...#|....#|..##.|....#|#...#|.###.",
  "4": "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.",
  "5": "#####|#....|####.|....#|....#|#...#|.###.",
  "6": "..##.|.#...|#....|####.|#...#|#...#|.###.",
  "7": "#####|....#|...#.|..#..|.#...|.#...|.#...",
  "8": ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
  "9": ".###.|#...#|#...#|.####|....#|...#.|.##..",
  ":": ".....|.##..|.##..|.....|.##..|.##..|.....",
  ";": ".....|.##..|.##..|.....|.##..|..#..|.#...",
  "<": "...#.|..#..|.#...|#....|.#...|..#..|...#.",
  "=": ".....|.....|#####|.....|#####|.....|.....",
  ">": ".#...|..#..|...#.|....#|...#.|..#..|.#...",
  "?": ".###.|#...#|....#|...#.|..#..|.....|..#..",
  "@": ".###.|#...#|#.###|#.#.#|#.###|#....|.###.",
  A: ".###.|#...#|#...#|#####|#...#|#...#|#...#",
  B: "####.|#...#|#...#|####.|#...#|#...#|####.",
  C: ".###.|#...#|#....|#....|#....|#...#|.###.",
  D: "####.|#...#|#...#|#...#|#...#|#...#|####.",
  E: "#####|#....|#....|####.|#....|#....|#####",
  F: "#####|#....|#....|####.|#....|#....|#....",
  G: ".###.|#...#|#....|#.###|#...#|#...#|.###.",
  H: "#...#|#...#|#...#|#####|#...#|#...#|#...#",
  I: ".###.|..#..|..#..|..#..|..#..|..#..|.###.",
  J: "..###|...#.|...#.|...#.|...#.|#..#.|.##..",
  K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#",
  L: "#....|#....|#....|#....|#....|#....|#####",
  M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#",
  N: "#...#|##..#|#.#.#|#..##|#...#|#...#|#...#",
  O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
  P: "####.|#...#|#...#|####.|#....|#....|#....",
  Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#",
  R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
  S: ".####|#....|#....|.###.|....#|....#|####.",
  T: "#####|..#..|..#..|..#..|..#..|..#..|..#..",
  U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
  V: "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..",
  W: "#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#",
  X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
  Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..",
  Z: "#####|....#|...#.|..#..|.#...|#....|#####",
  "[": ".###.|.#...|.#...|.#...|.#...|.#...|.###.",
  "\\": "#....|#....|.#...|..#..|...#.|....#|....#",
  "]": ".###.|...#.|...#.|...#.|...#.|...#.|.###.",
  "^": "..#..|.#.#.|#...#|.....|.....|.....|.....",
  _: ".....|.....|.....|.....|.....|.....|#####",
  "`": ".#...|..#..|...#.|.....|.....|.....|.....",
  a: ".....|.....|.###.|....#|.####|#...#|.####",
  b: "#....|#....|####.|#...#|#...#|#...#|####.",
  c: ".....|.....|.###.|#....|#....|#...#|.###.",
  d: "....#|....#|.####|#...#|#...#|#...#|.####",
  e: ".....|.....|.###.|#...#|#####|#....|.###.",
  f: "..##.|.#..#|.#...|####.|.#...|.#...|.#...",
  g: ".....|.....|.####|#...#|#...#|.####|....#|#...#|.###.",
  h: "#....|#....|#.##.|##..#|#...#|#...#|#...#",
  i: "..#..|.....|.##..|..#..|..#..|..#..|.###.",
  j: "...#.|.....|..##.|...#.|...#.|...#.|...#.|#..#.|.##..",
  k: "#....|#....|#..#.|#.#..|##...|#.#..|#..#.",
  l: ".##..|..#..|..#..|..#..|..#..|..#..|.###.",
  m: ".....|.....|##.#.|#.#.#|#.#.#|#.#.#|#...#",
  n: ".....|.....|#.##.|##..#|#...#|#...#|#...#",
  o: ".....|.....|.###.|#...#|#...#|#...#|.###.",
  p: ".....|.....|####.|#...#|#...#|####.|#....|#....|#....",
  q: ".....|.....|.####|#...#|#...#|.####|....#|....#|....#",
  r: ".....|.....|#.##.|##..#|#....|#....|#....",
  s: ".....|.....|.####|#....|.###.|....#|####.",
  t: ".#...|.#...|####.|.#...|.#...|.#..#|..##.",
  u: ".....|.....|#...#|#...#|#...#|#..##|.##.#",
  v: ".....|.....|#...#|#...#|#...#|.#.#.|..#..",
  w: ".....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.",
  x: ".....|.....|#...#|.#.#.|..#..|.#.#.|#...#",
  y: ".....|.....|#...#|#...#|#...#|.####|....#|#...#|.###.",
  z: ".....|.....|#####|...#.|..#..|.#...|#####",
  "{": "..##.|.#...|.#...|#....|.#...|.#...|..##.",
  "|": "..#..|..#..|..#..|..#..|..#..|..#..|..#..",
  "}": ".##..|...#.|...#.|....#|...#.|...#.|.##..",
  "~": ".....|.....|.#..#|#.##.|.....|.....|....."
};
var GLYPHS = new Map(
  Object.entries(G).map(([ch, rows]) => [ch, rows.split("|")])
);
var textScale = (size) => Math.max(1, Math.round(size / 9));
function plot(canvas, x, y, rgb) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const i = (y * canvas.width + x) * 3;
  canvas.data[i] = rgb[0];
  canvas.data[i + 1] = rgb[1];
  canvas.data[i + 2] = rgb[2];
}
function glyphPass(canvas, x, y, text2, scale, rgb, grow) {
  let cx = x;
  for (const ch of text2) {
    const rows = GLYPHS.get(ch) ?? GLYPHS.get("?");
    if (rows) {
      rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          if (row[rx] !== "#") continue;
          for (let dy = -grow; dy < scale + grow; dy++) {
            for (let dx = -grow; dx < scale + grow; dx++)
              plot(canvas, cx + rx * scale + dx, y + ry * scale + dy, rgb);
          }
        }
      });
    }
    cx += 6 * scale;
  }
}
function drawText(canvas, x, y, text2, options) {
  const scale = textScale(options.size);
  if (options.stroke)
    glyphPass(canvas, x, y, text2, scale, options.strokeColor ?? [0, 0, 0], options.stroke);
  glyphPass(canvas, x, y, text2, scale, options.color, 0);
}

// packages/mcbuilder/src/guide.ts
var AIR3 = "minecraft:air";
var BG = [246, 243, 236];
var GRID = [200, 194, 182];
var GRID_MAJOR = [150, 144, 132];
var INK = [40, 38, 34];
var MAX_GRID_PX = 1400;
var LEGEND_W = 330;
var SECOND_HALF = [
  ["half", "upper"],
  ["part", "head"]
];
function itemOf(block) {
  const [name, props] = splitBlockstate(block);
  if (name === AIR3) return null;
  if (SECOND_HALF.some(([k, v]) => props[k] === v)) return null;
  if (props.type === "double" && name.endsWith("_slab")) return [name, 2];
  return [name, 1];
}
function itemCounts(blocks) {
  const out = /* @__PURE__ */ new Map();
  for (const b of blocks) {
    const item = itemOf(b);
    if (item) out.set(item[0], (out.get(item[0]) ?? 0) + item[1]);
  }
  return out;
}
function mostCommon(counts) {
  return [...counts].sort((a, b) => b[1] - a[1]);
}
function stacks(n2) {
  const s = Math.floor(n2 / 64);
  const r = n2 % 64;
  if (!s) return String(n2);
  return `${s}×64${r ? ` + ${r}` : ""}`;
}
var shortName = (name) => name.startsWith("minecraft:") ? name.slice("minecraft:".length) : name;
var titleCase = (s) => s.replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
var ARROW = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0]
};
function marker(canvas, x0, y0, c, props) {
  const [cx, cy] = [x0 + c / 2, y0 + c / 2];
  const facing = props.facing;
  if (facing !== void 0 && Object.hasOwn(ARROW, facing)) {
    const [dx, dy] = ARROW[facing];
    const tip = [cx + dx * c * 0.36, cy + dy * c * 0.36];
    const back = [cx - dx * c * 0.18, cy - dy * c * 0.18];
    const [px, py] = [-dy * c * 0.2, dx * c * 0.2];
    drawPolygon(
      canvas,
      [tip, [back[0] + px, back[1] + py], [back[0] - px, back[1] - py]],
      [255, 255, 255],
      [0, 0, 0]
    );
  } else if (facing === "up" || facing === "down") {
    const r = c * 0.14;
    drawEllipse(
      canvas,
      cx - r,
      cy - r,
      cx + r,
      cy + r,
      facing === "up" ? [255, 255, 255] : [0, 0, 0],
      facing === "up" ? [0, 0, 0] : [255, 255, 255]
    );
  }
  const axis = props.axis;
  if (axis === "x" || axis === "z") {
    const w = c * 0.36;
    if (axis === "x")
      drawRect(canvas, cx - w, cy - 1.5, cx + w, cy + 1.5, [255, 255, 255], [0, 0, 0]);
    else drawRect(canvas, cx - 1.5, cy - w, cx + 1.5, cy + w, [255, 255, 255], [0, 0, 0]);
  }
  if (props.half === "top" || props.type === "top") {
    drawText(canvas, x0 + 2, y0 + 1, "T", {
      size: Math.max(8, Math.trunc(c * 0.38)),
      color: [255, 255, 255],
      stroke: 2,
      strokeColor: [0, 0, 0]
    });
  }
}
function topTextures(palette, assets) {
  const out = /* @__PURE__ */ new Map();
  palette.forEach((block, idx) => {
    if (block !== AIR3) out.set(idx, buildFaceTextures(block, assets, /* @__PURE__ */ new Set()).up);
  });
  return out;
}
function layerImage(dense, y, textures, title) {
  const [sx, sy, sz] = dense.size;
  const cell = (x, yy, z) => dense.data[(x * sy + yy) * sz + z];
  const c = Math.max(10, Math.min(28, Math.floor(MAX_GRID_PX / Math.max(sx, sz))));
  const [top, left] = [96, 44];
  const [gw, gh] = [sx * c, sz * c];
  const layerBlocks = [];
  for (let x = 0; x < sx; x++)
    for (let z = 0; z < sz; z++) {
      const i = cell(x, y, z);
      if (i >= 0) layerBlocks.push(dense.palette[i]);
    }
  const counts = itemCounts(layerBlocks);
  const width = Math.max(left + gw + 20 + LEGEND_W, 720);
  let height = Math.max(top + gh + 30, top + 40);
  height = Math.max(height, top + 30 + counts.size * 24 + 20);
  const img = createCanvas(width, height, BG);
  drawText(img, left, 16, title, { size: 22, color: INK });
  drawText(
    img,
    left,
    46,
    "north is up  |  x: east (right)  |  z: south (down)  |  arrow: facing  |  T: top half  |  faded: layer below",
    {
      size: 13,
      color: [110, 104, 96]
    }
  );
  const tiles = /* @__PURE__ */ new Map();
  for (const [i, t] of textures) tiles.set(i, resizeNearest(t, c, c));
  const ghosts = /* @__PURE__ */ new Map();
  for (const [i, t] of tiles) ghosts.set(i, blendToward(t, BG, 0.75));
  for (let x = 0; x < sx; x++) {
    for (let z = 0; z < sz; z++) {
      const [px, pz] = [left + x * c, top + z * c];
      const idx = cell(x, y, z);
      if (idx >= 0 && dense.palette[idx] !== AIR3) {
        pasteRgb(img, tiles.get(idx), px, pz);
      } else if (y > 0) {
        const b = cell(x, y - 1, z);
        if (b >= 0 && dense.palette[b] !== AIR3) pasteRgb(img, ghosts.get(b), px, pz);
      }
    }
  }
  for (let x = 0; x < sx; x++) {
    for (let z = 0; z < sz; z++) {
      const idx = cell(x, y, z);
      if (idx >= 0 && dense.palette[idx] !== AIR3)
        marker(img, left + x * c, top + z * c, c, splitBlockstate(dense.palette[idx])[1]);
    }
  }
  for (let i = 0; i <= sx; i++)
    drawLine2(img, left + i * c, top, left + i * c, top + gh, i % 5 === 0 ? GRID_MAJOR : GRID);
  for (let k = 0; k <= sz; k++)
    drawLine2(img, left, top + k * c, left + gw, top + k * c, k % 5 === 0 ? GRID_MAJOR : GRID);
  for (let i = 0; i < sx; i += 5)
    drawText(img, left + i * c + 2, top - 14, String(i), { size: 11, color: INK });
  for (let k = 0; k < sz; k += 5)
    drawText(img, 6, top + k * c + 2, String(k), { size: 11, color: INK });
  const lx = left + gw + 20;
  let ly = top;
  drawText(img, lx, ly - 24, "this layer", { size: 14, color: INK });
  const nameToIdx = /* @__PURE__ */ new Map();
  dense.palette.forEach((b, idx) => {
    const n2 = splitBlockstate(b)[0];
    if (!nameToIdx.has(n2)) nameToIdx.set(n2, idx);
  });
  for (const [name, n2] of mostCommon(counts)) {
    const idx = nameToIdx.get(name);
    const tile = idx === void 0 ? void 0 : tiles.get(idx);
    if (tile) pasteRgb(img, resizeNearest(tile, 18, 18), lx, ly);
    drawText(img, lx + 26, ly + 2, `${String(n2).padStart(4)}  ${shortName(name)}`, {
      size: 13,
      color: INK
    });
    ly += 24;
  }
  return { image: img, counts };
}
function buildGuide(dense, assets, options = {}) {
  const title = options.title ?? "Build guide";
  const [sx, sy, sz] = dense.size;
  const textures = topTextures(dense.palette, assets);
  const filled = (y) => {
    for (let x = 0; x < sx; x++) {
      for (let z = 0; z < sz; z++) {
        const i = dense.data[(x * sy + y) * sz + z];
        if (i >= 0 && dense.palette[i] !== AIR3) return true;
      }
    }
    return false;
  };
  const layers = [];
  for (let y = 0; y < sy; y++) if (filled(y)) layers.push(y);
  const everything = [];
  for (const i of dense.data) if (i >= 0) everything.push(dense.palette[i]);
  const total2 = itemCounts(everything);
  const sum2 = [...total2.values()].reduce((a, b) => a + b, 0);
  const md = [`# ${title}`, ""];
  if (options.cover) md.push(`![${title}](${options.cover})`, "");
  md.push(
    `Size: **${sx} × ${sy} × ${sz}** (x × y × z), ${layers.length} layers, ${sum2} items.`,
    "",
    "Coordinates count from the north-west bottom corner: x to the east, z to the south, layer 1 at the bottom. In each plan the faded blocks are the layer below.",
    "",
    "## Materials",
    "",
    "| Item | Count | Stacks |",
    "|---|---:|---:|"
  );
  for (const [n2, k] of mostCommon(total2)) md.push(`| ${shortName(n2)} | ${k} | ${stacks(k)} |`);
  md.push("");
  const out = [];
  layers.forEach((y, i) => {
    const step = i + 1;
    const name = `layer-${String(step).padStart(2, "0")}.png`;
    const { image, counts } = layerImage(
      dense,
      y,
      textures,
      `Layer ${step} of ${layers.length}   (y = ${y})`
    );
    const common = mostCommon(counts);
    out.push({ name, image, counts: common });
    md.push(
      `## Layer ${step} (y = ${y})`,
      "",
      `![Layer ${step}](${name})`,
      "",
      common.map(([n2, k]) => `${k} ${shortName(n2)}`).join(", "),
      ""
    );
  });
  return { markdown: md.join("\n"), layers: out };
}

// packages/mcbuilder/src/importer.ts
function structureFromVolume(volume, source, meta = {}) {
  const cells = [];
  volume.eachCell((x, y, z, idx) => {
    cells.push([x, y, z, volume.palette[idx]]);
  });
  cells.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  return {
    blocks: cells,
    source,
    dataVersion: meta.dataVersion ?? null,
    droppedBlockEntities: meta.droppedBlockEntities ?? 0,
    droppedEntities: meta.droppedEntities ?? 0,
    droppedProperties: /* @__PURE__ */ new Map()
  };
}
var AIR4 = "minecraft:air";
function cleanProperties(structure, registry) {
  const cache = /* @__PURE__ */ new Map();
  const dropped = new Map(structure.droppedProperties);
  const blocks = structure.blocks.map(([x, y, z, b]) => {
    let hit = cache.get(b);
    if (hit === void 0) {
      const bracket = b.indexOf("[");
      const name = bracket === -1 ? b : b.slice(0, bracket);
      const rest = bracket === -1 ? "" : b.slice(bracket + 1);
      const legal = Object.hasOwn(registry.blocks, name) ? registry.blocks[name] : void 0;
      if (legal === void 0 || rest === "") {
        hit = { state: b, dropped: [] };
      } else {
        const props = /* @__PURE__ */ new Map();
        for (const kv of rest.replace(/\]+$/, "").split(",")) {
          const eq = kv.indexOf("=");
          if (eq !== -1) props.set(kv.slice(0, eq), kv.slice(eq + 1));
        }
        const keep = /* @__PURE__ */ new Map();
        const gone = [];
        for (const [k, v] of props) {
          if (Object.hasOwn(legal, k) && legal[k].includes(v)) keep.set(k, v);
          else gone.push(`${localName(name)}.${k}`);
        }
        const kept = [...keep.keys()].sort(compareCodePoints).map((k) => `${k}=${keep.get(k)}`);
        hit = {
          state: canonicalize(kept.length > 0 ? `${name}[${kept.join(",")}]` : name),
          dropped: gone
        };
      }
      cache.set(b, hit);
    }
    for (const k of hit.dropped) dropped.set(k, (dropped.get(k) ?? 0) + 1);
    return [x, y, z, hit.state];
  });
  return { ...structure, blocks, droppedProperties: dropped };
}
function pyFixed(x, digits) {
  const exact = Math.abs(x).toFixed(Math.min(100, digits + 25));
  const dot = exact.indexOf(".");
  const tail = exact.slice(dot + 1 + digits);
  if (/^50*$/.test(tail)) {
    const kept = exact.slice(0, dot + 1 + digits);
    const lastDigit = Number(kept.replace(".", "").slice(-1));
    const rounded = lastDigit % 2 === 0 ? kept : (Math.abs(x) + 0.5 * 10 ** -digits).toFixed(digits);
    return (x < 0 ? "-" : "") + (digits === 0 ? rounded.replace(/\.$/, "") : rounded);
  }
  return x.toFixed(digits);
}
var nameOf = (block) => block.split("[", 1)[0];
var localName = (name) => name.slice(name.indexOf(":") + 1);
function summary(structure, top = 25) {
  const blocks = structure.blocks;
  if (blocks.length === 0) return ["empty structure"];
  const dims = [0, 1, 2].map((i) => Math.max(...blocks.map((b) => b[i])) + 1);
  const byName = /* @__PURE__ */ new Map();
  for (const [, , , b] of blocks) {
    if (b === AIR4) continue;
    byName.set(nameOf(b), (byName.get(nameOf(b)) ?? 0) + 1);
  }
  const solid = [...byName.values()].reduce((a, b) => a + b, 0);
  const states = new Set(blocks.map((b) => b[3])).size;
  const lines = [
    `source: ${structure.source}${structure.dataVersion ? ` (DataVersion ${structure.dataVersion})` : ""}`,
    `size: ${dims[0]} x ${dims[1]} x ${dims[2]} (x * y * z), ${solid} blocks, ${byName.size} block types, ${states} block states`
  ];
  if (structure.droppedBlockEntities || structure.droppedEntities) {
    lines.push(
      `not imported: ${structure.droppedBlockEntities} block-entity data (chest contents, signs...), ${structure.droppedEntities} entities`
    );
  }
  if (structure.droppedProperties.size > 0) {
    const items = [...structure.droppedProperties].sort((a, b) => compareCodePoints(a[0], b[0]));
    lines.push(
      `dropped unknown properties (Bedrock leftovers?): ${items.map(([k, n2]) => `${k} x${n2}`).join(", ")}`
    );
  }
  lines.push("", `top block types (of ${byName.size}):`);
  const ranked = [...byName].sort((a, b) => b[1] - a[1]).slice(0, top);
  for (const [name, n2] of ranked) {
    lines.push(
      `  ${String(n2).padStart(6)}  ${pyFixed(100 * n2 / solid, 1).padStart(5)}%  ${localName(name)}`
    );
  }
  const perLayer = /* @__PURE__ */ new Map();
  for (const [, y, , b] of blocks) if (b !== AIR4) perLayer.set(y, (perLayer.get(y) ?? 0) + 1);
  lines.push(
    "",
    `blocks per layer (y): ${Array.from({ length: dims[1] }, (_, y) => `${y}:${perLayer.get(y) ?? 0}`).join(", ")}`
  );
  return lines;
}
function mergeBoxes(cells) {
  const key = (x, y, z) => `${x},${y},${z}`;
  const left = new Set(cells.map(([x, y, z]) => key(x, y, z)));
  const order = [...cells].sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
  const boxes = [];
  for (const [x0, y0, z0] of order) {
    if (!left.has(key(x0, y0, z0))) continue;
    let x1 = x0;
    while (left.has(key(x1 + 1, y0, z0))) x1++;
    let z1 = z0;
    const rowFull = (z, y) => {
      for (let x = x0; x <= x1; x++) if (!left.has(key(x, y, z))) return false;
      return true;
    };
    while (rowFull(z1 + 1, y0)) z1++;
    let y1 = y0;
    const layerFull = (y) => {
      for (let z = z0; z <= z1; z++) if (!rowFull(z, y)) return false;
      return true;
    };
    while (layerFull(y1 + 1)) y1++;
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) left.delete(key(x, y, z));
    boxes.push([
      [x0, y0, z0],
      [x1, y1, z1]
    ]);
  }
  return boxes;
}
var ABBREV = {
  north: "N",
  south: "S",
  east: "E",
  west: "W",
  true: "T",
  false: "F"
};
var PY_KEYWORDS = new Set(
  "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(
    " "
  )
);
function constName(block, taken) {
  const bracket = block.indexOf("[");
  const base = bracket === -1 ? block : block.slice(0, bracket);
  const props = bracket === -1 ? "" : block.slice(bracket + 1);
  const name = localName(base).toUpperCase();
  const parts = [];
  for (const kv of props.replace(/\]+$/, "").split(",")) {
    const eq = kv.indexOf("=");
    if (eq === -1) continue;
    const k = kv.slice(0, eq);
    const v = kv.slice(eq + 1);
    if (k === "waterlogged" && v === "false") continue;
    parts.push((ABBREV[v] ?? v).toUpperCase());
  }
  let cand = [name, ...parts].join("_").replace(/[^A-Z0-9_]/g, "_");
  if (/^[0-9]/.test(cand) || PY_KEYWORDS.has(cand.toLowerCase())) cand = `B_${cand}`;
  let out = cand;
  let n2 = 2;
  while (taken.has(out)) {
    out = `${cand}_${n2}`;
    n2++;
  }
  taken.add(out);
  return out;
}
function planImport(structure) {
  const counts = /* @__PURE__ */ new Map();
  const byBlock = /* @__PURE__ */ new Map();
  for (const [x, y, z, b] of structure.blocks) {
    counts.set(b, (counts.get(b) ?? 0) + 1);
    const list2 = byBlock.get(b);
    if (list2) list2.push([x, y, z]);
    else byBlock.set(b, [[x, y, z]]);
  }
  const taken = /* @__PURE__ */ new Set();
  const names = /* @__PURE__ */ new Map();
  const order = [...counts.keys()].sort(
    (a, b) => counts.get(b) - counts.get(a) || compareCodePoints(a, b)
  );
  for (const b of order) names.set(b, constName(b, taken));
  const calls = [];
  for (const [block, cells] of byBlock) {
    for (const [c1, c2] of mergeBoxes(cells))
      calls.push({ y: c1[1], z: c1[2], x: c1[0], c1, c2, block });
  }
  calls.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  return { names, counts, calls };
}
function toScript(structure, options = {}) {
  const { names, counts, calls } = planImport(structure);
  const comment = [
    `Imported from ${structure.source} by \`mcbuild import\`.`,
    "",
    ...summary(structure)
  ].concat(["", "Coordinates: x east, y up, z south; (0, 0, 0) is the north-west bottom corner."]).map((l) => l === "" ? " *" : ` * ${l}`);
  const out = [
    "/**",
    ...comment,
    " */",
    'import { Build } from "@voxwright/mcbuilder";',
    "",
    `export const BUILD = new Build({ seed: ${options.seed ?? 0}, views: "iso;az200_el025;top" });`,
    "",
    "// block states, most used first",
    ...[...names].map(([b, n2]) => `const ${n2} = ${JSON.stringify(b)}; // ${counts.get(b)}`),
    "",
    "BUILD.scope(() => {"
  ];
  let layer = null;
  for (const c of calls) {
    if (c.y !== layer) {
      out.push("", `  // --- layer y = ${c.y} ---`);
      layer = c.y;
    }
    const name = names.get(c.block);
    const same = c.c1[0] === c.c2[0] && c.c1[1] === c.c2[1] && c.c1[2] === c.c2[2];
    out.push(
      same ? `  BUILD.set(${c.c1[0]}, ${c.c1[1]}, ${c.c1[2]}, ${name});` : `  BUILD.box([${c.c1.join(", ")}], [${c.c2.join(", ")}], ${name});`
    );
  }
  out.push("});", "");
  return out.join("\n");
}

// packages/mcbuilder/src/report.ts
function viewEntry(options) {
  return {
    file: options.file,
    azimuth: options.view.azimuth,
    elevation: options.view.elevation,
    label: options.view.label,
    directions_untrusted: options.directionsUntrusted ?? true,
    directions_trusted: options.directionsTrusted ?? false
  };
}
function buildReport(input) {
  return {
    errors: input.errors.map((e) => ({ ...e })),
    warnings: input.warnings.map((w) => ({ ...w })),
    block_counts: { ...input.blockCounts },
    dimensions: input.dimensions ? { x: input.dimensions[0], y: input.dimensions[1], z: input.dimensions[2] } : null,
    origin: input.origin ? input.origin.map((v) => Math.trunc(v)) : null,
    views: input.views.map((v) => ({ ...v })),
    artifacts: input.artifacts ? input.artifacts.map((a) => ({ ...a })) : [],
    overwritten_placements: input.overwrittenPlacements ?? 0,
    run_dir: input.runDir
  };
}
function reportToJson(report) {
  const text2 = JSON.stringify(report, null, 2);
  return `${text2.replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)}
`;
}

// packages/mcbuilder/src/node/skill/main.ts
var BUNDLED = true;
var USAGE = `Usage: ${PROG} <command> [options]

Commands:
  build <recipe> --out <path>   run a recipe, validate it and write a schematic
  inspect <schematic>           print what a schematic file holds
  preview <schematic>           serve the 3D viewer and editor with the file open

  ${PROG} <command> --help      options of one command
  ${PROG} --version

A recipe is an ES module (.ts, .mts, .mjs, .js) that exports a Build:

  import { Build } from "voxwright";
  export const BUILD = new Build({ seed: 1 });
  BUILD.scope(() => {
    BUILD.box([0, 0, 0], [4, 0, 4], "minecraft:stone_bricks");
  });

Formats: .schem, .litematic, .nbt, .mcstructure.
Exit codes: 0 success, 1 failure, 2 usage error.`;
var MIN_NODE = "22.18";
function nodeProblem(recipe) {
  const found = `found ${process.version}`;
  if (typeof nodeModule.registerHooks !== "function") {
    return `Node ${MIN_NODE} or later is required (${found})`;
  }
  const ts = recipe !== void 0 && [".ts", ".mts", ".cts"].includes(extname5(recipe).toLowerCase());
  if (ts && !process.features.typescript) {
    return `TypeScript recipes need Node ${MIN_NODE} or later (${found}); upgrade Node or write the recipe as .mjs`;
  }
  return null;
}
var ENGINE_SOURCE = /\/packages\/(?:mcbuilder|core)\/src\/index\.ts(?:\?.*)?$/;
var aliased = false;
function installAlias() {
  if (aliased) return;
  aliased = true;
  const names = new Set(
    BUNDLED ? ["voxwright", "@voxwright/mcbuilder", "@voxwright/core"] : ["voxwright", "@voxwright/mcbuilder"]
  );
  const self = import.meta.url;
  nodeModule.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (names.has(specifier)) return { url: self, shortCircuit: true };
      const resolved = nextResolve(specifier, context);
      if (BUNDLED && ENGINE_SOURCE.test(resolved.url)) return { url: self, shortCircuit: true };
      return resolved;
    }
  });
}
async function runSkillCli(argv, io = {}, deps = {}) {
  const full = {
    out: io.out ?? ((l) => console.log(l)),
    err: io.err ?? ((l) => console.error(l)),
    cwd: io.cwd ?? process.cwd(),
    home: io.home ?? homedir(),
    env: io.env ?? process.env
  };
  const [command, ...rest] = argv;
  const usageOf = {
    build: BUILD_USAGE,
    inspect: INSPECT_USAGE,
    preview: PREVIEW_USAGE
  };
  try {
    switch (command) {
      case "build":
        return await cmdBuild(rest, full, deps);
      case "inspect":
        return await cmdInspect(rest, full);
      case "preview":
        return await cmdPreview(rest, full);
      case "-h":
      case "--help":
      case "help":
        for (const line2 of USAGE.split("\n")) full.out(line2);
        return 0;
      case "-V":
      case "--version":
        full.out(`${PROG} ${VERSION}`);
        return 0;
      case void 0:
        for (const line2 of USAGE.split("\n")) full.err(line2);
        return 2;
      default:
        full.err(`${PROG}: unknown command '${command}'`);
        for (const line2 of USAGE.split("\n")) full.err(line2);
        return 2;
    }
  } catch (e) {
    if (e instanceof SkillCliError) {
      full.err(`${PROG}: ${e.message}`);
      if (e.exitCode === 2 && command !== void 0 && usageOf[command] !== void 0) {
        full.err(`Run '${PROG} ${command} --help' for the options.`);
      }
      return e.exitCode;
    }
    const code = e?.code;
    if (typeof code === "string" && code.startsWith("ERR_PARSE_ARGS_")) {
      full.err(`${PROG}: ${e.message.split(". ")[0]?.replace(/\.$/, "")}`);
      if (command !== void 0 && usageOf[command] !== void 0) {
        full.err(`Run '${PROG} ${command} --help' for the options.`);
      }
      return 2;
    }
    if (e instanceof McbuilderError) {
      full.err(`${PROG}: ${e.message}`);
      return 1;
    }
    throw e;
  }
}
function isEntryPoint() {
  const script = process.argv[1];
  if (script === void 0) return false;
  try {
    return realpathSync(script) === realpathSync(fileURLToPath2(import.meta.url));
  } catch {
    return false;
  }
}
if (isEntryPoint()) {
  const argv = process.argv.slice(2);
  const problem = nodeProblem(
    argv[0] === "build" ? argv.find((a, i) => i > 0 && !a.startsWith("-")) : void 0
  );
  if (problem !== null) {
    console.error(`${PROG}: ${problem}`);
    process.exitCode = 1;
  } else {
    installAlias();
    runSkillCli(argv).then(
      (code) => {
        process.exitCode = code;
      },
      (e) => {
        console.error(e);
        process.exitCode = 1;
      }
    );
  }
}
export {
  AIR,
  BlockStringError,
  Build,
  BuildError,
  CodecError,
  CommandBuilder,
  ConfigError,
  DATA_VERSIONS,
  DEFAULT_HISTORY_BYTES,
  DiffError,
  DirtyTracker,
  EditError,
  Editor,
  ExportError,
  Geometry,
  GridBoundsError,
  History,
  LEGACY_SCHEMATIC_MESSAGE,
  MAX_EXTENT,
  McbuilderError,
  NbtError,
  ROTATIONS,
  Registry,
  RegistryError,
  Rng,
  RotationError,
  Stroke,
  TagId,
  UNSET,
  USAGE,
  Volume,
  VolumeError,
  VoxelGrid,
  applyCommand,
  bedrockToJava,
  blockEntityKey,
  blockIdOf,
  blockProperties,
  boxCellCount,
  boxContains,
  boxSize,
  buildGuide,
  buildLitematic,
  buildMcstructure,
  buildReport,
  buildSchem,
  buildStructureNbt,
  byte2 as byte,
  byteArray,
  canonicalize,
  carriedOffset,
  cleanProperties,
  clipboardCellCount,
  cloneNbt,
  cloneVolume,
  commandBytes,
  commandCellCount,
  compareCodePoints,
  compound,
  constName,
  copySelection,
  decodeMutf8,
  isEmpty as diffIsEmpty,
  total as diffTotal,
  diffVoxelMaps,
  dirtySectionKeys,
  double,
  drawBox,
  drawLine,
  drawRectangle,
  eachCellInBox,
  eachPosInBox,
  encodeMutf8,
  entityPosition,
  eraseBlock,
  eraseCells,
  expandUser,
  fillSelection,
  float,
  forEachChange,
  formatDiff,
  getCloseMatches,
  gunzip,
  gzip,
  int2 as int,
  intArray,
  isEmptyBlock,
  isEmptyCommand,
  isGzip,
  isPySpace,
  itemCounts,
  javaToBedrock,
  join as joinBlockString,
  linePoints,
  list,
  long,
  longArray,
  makeBox,
  markBlockDirty,
  mergeBoxes,
  mergeCommands,
  mirrorBlockstate,
  mirrorSelection,
  mostCommon,
  moveSelection,
  nbtEqual,
  nodeProblem,
  normalizeBlockData,
  parseBlockEntityKey,
  parse as parseBlockString,
  parseConfig,
  parseSectionKey,
  pasteClipboard,
  patches,
  placeBlock,
  placeCells,
  planImport,
  positionTag,
  pyFixed,
  pyStrip,
  ratio,
  raycast,
  readLitematic,
  readMcstructure,
  readNbt,
  readNbtFile,
  readSchem,
  readStructureNbt,
  replaceInSelection,
  reportToJson,
  resolveAssetsDir,
  resolveDataVersion,
  resolveMaterial,
  revertCommand,
  rotateBlockstate,
  rotatePoint,
  rotatePosition,
  rotateSelection,
  rotatedBox,
  runSkillCli,
  sectionKey2 as sectionKey,
  setBlockProperty,
  sha256,
  shapes_exports as shapes,
  shiftEntity,
  short,
  shortName,
  stacks,
  string,
  structureFromVolume,
  suggest,
  summary,
  tagId,
  titleCase,
  toScript,
  unitHash,
  viewEntry,
  voxelKey,
  withBlockProperty,
  writeLitematic,
  writeMcstructure,
  writeNbt,
  writeNbtGzip,
  writeSchem,
  writeStructureNbt
};
