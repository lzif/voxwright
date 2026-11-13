// SPDX-License-Identifier: AGPL-3.0-only

// Bedrock <-> Java block translation, by rule.
//
// Bedrock keeps block states as typed values (bits as bytes, directions as
// ints) under different names than Java. This module translates the families
// that matter for builds: stairs, slabs, doors, beds, logs and other pillars,
// fences, panes and walls, moss carpets, and blocks with a facing. Block
// names are passed through unchanged apart from the renames below.
//
// It is rule based, not a complete table. Anything it does not understand is
// dropped from the result and reported, never guessed. A full mapping table
// is a separate, still open decision.

import { canonicalize, joinBlockString, parseBlockString } from "../blocks/index.ts";

export type BedrockScalar = number | string;
export type BedrockStates = ReadonlyMap<string, BedrockScalar>;

/** A state value together with the NBT type it is written as. */
export type BedrockValue =
  | { kind: "byte"; value: number }
  | { kind: "int"; value: number }
  | { kind: "string"; value: string };

export interface BedrockBlock {
  /** With namespace, e.g. `minecraft:stone_brick_stairs`. */
  name: string;
  states: Map<string, BedrockValue>;
}

const COLORS = [
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
  "black",
] as const;

/** Bedrock names that differ from Java. */
const NAME_TO_JAVA: Readonly<Record<string, string>> = {
  web: "cobweb",
  reeds: "sugar_cane",
};
const NAME_TO_BEDROCK: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(NAME_TO_JAVA).map(([b, j]) => [j, b]),
);

/** `weirdo_direction` for stairs. */
const STAIR_DIR = ["east", "west", "south", "north"] as const;
/** `direction` for beds and similar. */
const BED_DIR = ["south", "west", "north", "east"] as const;
/** `facing_direction`. */
const FACING_DIR = ["down", "up", "north", "south", "west", "east"] as const;
/** Doors: Java facing for a Bedrock `cardinal_direction`. */
const DOOR_TO_JAVA: Readonly<Record<string, string>> = {
  south: "east",
  west: "south",
  north: "west",
  east: "north",
};
const DOOR_TO_BEDROCK: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(DOOR_TO_JAVA).map(([b, j]) => [j, b]),
);
const SIDE_TO_JAVA: Readonly<Record<string, string>> = { none: "none", short: "low", tall: "tall" };
const SIDE_TO_BEDROCK: Readonly<Record<string, string>> = {
  none: "none",
  low: "short",
  tall: "tall",
};
const SHELF_CHAIN = ["unconnected", "right", "center", "left"] as const;

const HORIZONTAL = new Set(["north", "south", "east", "west"]);
/** Blocks whose facing is a Bedrock `facing_direction` int. Everything else uses `cardinal_direction`. */
const FACING_DIRECTION_BLOCKS =
  /^(barrel|hopper|dropper|dispenser|piston|sticky_piston|observer|ladder|.*_wall_sign|.*_wall_banner|.*_wall_hanging_sign)$/;

const bare = (id: string): string => id.slice(id.indexOf(":") + 1);
const withNs = (n: string): string => (n.includes(":") ? n : `minecraft:${n}`);
const stripNs = (k: string): string =>
  k.startsWith("minecraft:") ? k.slice("minecraft:".length) : k;

export interface ToJavaResult {
  /** Canonical Java block string. */
  state: string;
  warnings: string[];
}

export interface ToJavaExtra {
  /** Bed colour from the block entity, 0 to 15. */
  bedColor?: number;
}

/** Translate one Bedrock palette entry to a canonical Java block string. */
export function bedrockToJava(
  bedrockName: string,
  statesIn: BedrockStates,
  extra: ToJavaExtra = {},
): ToJavaResult {
  const warnings: string[] = [];
  const s = new Map<string, BedrockScalar>();
  for (const [k, v] of statesIn) s.set(stripNs(k), v);
  const out = new Map<string, string>();
  const take = (key: string): BedrockScalar | undefined => {
    const v = s.get(key);
    s.delete(key);
    return v;
  };
  const bool = (v: BedrockScalar | undefined): string => (Number(v) ? "true" : "false");

  let name = bare(bedrockName);
  name = NAME_TO_JAVA[name] ?? name;

  if (name === "bed") {
    const color = extra.bedColor;
    if (color === undefined || COLORS[color] === undefined) {
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
        SIDE_TO_JAVA[String(take(`pale_moss_carpet_side_${side}`) ?? "none")] ?? "none",
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

  // Connections: fences, panes and bars use 0/1, walls use none/short/tall.
  for (const side of ["north", "east", "south", "west"]) {
    if (s.has(`connection_${side}`)) out.set(side, bool(take(`connection_${side}`)));
    if (s.has(`wall_connection_type_${side}`)) {
      out.set(side, SIDE_TO_JAVA[String(take(`wall_connection_type_${side}`))] ?? "none");
    }
  }
  if (s.has("wall_post_bit")) out.set("up", bool(take("wall_post_bit")));

  // Generic renames.
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
  return { state: canonicalize(joinBlockString(`minecraft:${name}`, out)), warnings };
}

export interface ToBedrockResult {
  block: BedrockBlock;
  /** Set for beds: the colour to write in the block entity. */
  bedColor?: number;
  /** The block holds water. */
  waterlogged: boolean;
  warnings: string[];
}

const byte = (value: number): BedrockValue => ({ kind: "byte", value });
const int = (value: number): BedrockValue => ({ kind: "int", value });
const str = (value: string): BedrockValue => ({ kind: "string", value });

/** Translate a canonical Java block string to a Bedrock palette entry. */
export function javaToBedrock(canonical: string): ToBedrockResult {
  const parse = parseBlockString(canonical);
  const warnings: string[] = [];
  const p = new Map(parse.props);
  const states = new Map<string, BedrockValue>();
  const take = (key: string): string | undefined => {
    const v = p.get(key);
    p.delete(key);
    return v;
  };
  const flag = (v: string | undefined): number => (v === "true" ? 1 : 0);

  let name = bare(parse.name);
  let bedColor: number | undefined;
  const waterlogged = take("waterlogged") === "true";

  if (name.endsWith("_bed")) {
    const color = COLORS.indexOf(name.slice(0, -"_bed".length) as (typeof COLORS)[number]);
    if (color === -1) warnings.push(`${name}: unknown bed colour`);
    bedColor = Math.max(color, 0);
    name = "bed";
    states.set(
      "direction",
      int(Math.max(BED_DIR.indexOf((take("facing") ?? "south") as (typeof BED_DIR)[number]), 0)),
    );
    states.set("head_piece_bit", byte(take("part") === "head" ? 1 : 0));
    states.set("occupied_bit", byte(flag(take("occupied"))));
  } else if (name.endsWith("_stairs")) {
    // A stair written with only `facing` and `half` (what a build script places) is a stair too:
    // the properties it leaves out are the Java defaults.
    states.set(
      "weirdo_direction",
      int(Math.max(STAIR_DIR.indexOf((take("facing") ?? "east") as (typeof STAIR_DIR)[number]), 0)),
    );
    states.set("upside_down_bit", byte(take("half") === "top" ? 1 : 0));
    const shape = take("shape") ?? "straight";
    states.set("minecraft:corner", str(shape === "straight" ? "none" : shape));
  } else if (name.endsWith("_door") && p.has("half")) {
    states.set(
      "minecraft:cardinal_direction",
      str(DOOR_TO_BEDROCK[take("facing") ?? "north"] ?? "north"),
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
        str(SIDE_TO_BEDROCK[take(side) ?? "none"] ?? "none"),
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
            (take("side_chain") ?? "unconnected") as (typeof SHELF_CHAIN)[number],
          ),
          0,
        ),
      ),
    );
  }

  // Connections. Fences and panes carry booleans; walls carry none/low/tall.
  const isWall = name.endsWith("_wall");
  for (const side of ["north", "east", "south", "west"]) {
    const v = p.get(side);
    if (v === undefined) continue;
    p.delete(side);
    if (isWall) states.set(`wall_connection_type_${side}`, str(SIDE_TO_BEDROCK[v] ?? "none"));
    else states.set(`minecraft:connection_${side}`, int(flag(v)));
  }
  if (isWall && p.has("up")) states.set("wall_post_bit", byte(flag(take("up"))));

  const axis = take("axis");
  if (axis !== undefined) states.set("pillar_axis", str(axis));
  const facing = take("facing");
  if (facing !== undefined) {
    if (FACING_DIRECTION_BLOCKS.test(name)) {
      const i = FACING_DIR.indexOf(facing as (typeof FACING_DIR)[number]);
      states.set("facing_direction", int(i === -1 ? 0 : i));
    } else if (HORIZONTAL.has(facing)) {
      states.set("minecraft:cardinal_direction", str(facing));
    } else {
      warnings.push(`${name}: facing=${facing} has no Bedrock cardinal_direction`);
    }
  }
  const open = take("open");
  if (open !== undefined) states.set("open_bit", byte(flag(open)));
  const powered = take("powered");
  if (powered !== undefined && !name.endsWith("_door"))
    states.set("powered_bit", byte(flag(powered)));
  const inWall = take("in_wall");
  if (inWall !== undefined) states.set("in_wall_bit", byte(flag(inWall)));

  // What is left cannot be expressed. Java defaults such as lit=false and
  // type=single need no state in Bedrock, so only report non-default values.
  const DEFAULTS = new Map([
    ["lit", "false"],
    ["type", "single"],
    ["powered", "false"],
    ["side_chain", "unconnected"],
  ]);
  for (const [k, v] of p) {
    if (DEFAULTS.get(k) !== v)
      warnings.push(`${bare(parse.name)}: dropped Java property ${k}=${v}`);
  }
  return {
    block: { name: withNs(NAME_TO_BEDROCK[name] ?? name), states },
    bedColor,
    waterlogged,
    warnings,
  };
}
