// SPDX-License-Identifier: AGPL-3.0-only

// Editing the properties of the block under the cursor.
//
// The core has no block registry, so the legal values of a property are not
// known. {@link blockProperties} lists what the state itself shows and, for
// well-known property names, a likely set of values; only boolean values are
// marked `exact`. A UI should offer the list as suggestions and still accept
// a typed value.

import { joinBlockString, parseBlockString } from "../blocks/index.ts";
import { UNSET, type Vec3, type Volume } from "../volume/index.ts";
import { type Command, CommandBuilder, EditError } from "./command.ts";

export interface BlockProperty {
  key: string;
  /** The current value. */
  value: string;
  /** Candidate values, current value included, or `null` when nothing is known. */
  options: readonly string[] | null;
  /** True when `options` is the complete set (booleans only). */
  exact: boolean;
}

const BOOLEAN = ["true", "false"];
const CARDINAL = ["north", "east", "south", "west"];
const SIX_FACES = ["north", "east", "south", "west", "up", "down"];
const range = (n: number): string[] => Array.from({ length: n }, (_, i) => String(i));

/** Value sets seen in vanilla for a property name; the one containing the current value is used. */
const KNOWN: Readonly<Record<string, readonly (readonly string[])[]>> = {
  axis: [["x", "y", "z"]],
  facing: [CARDINAL, SIX_FACES],
  half: [
    ["top", "bottom"],
    ["upper", "lower"],
  ],
  type: [
    ["top", "bottom", "double"],
    ["single", "left", "right"],
    ["normal", "sticky"],
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
      "north_east",
    ],
  ],
  hinge: [["left", "right"]],
  part: [["head", "foot"]],
  face: [["floor", "wall", "ceiling"]],
  attachment: [["floor", "ceiling", "single_wall", "double_wall"]],
  mode: [["compare", "subtract"]],
  north: [
    ["none", "low", "tall"],
    ["up", "side", "none"],
  ],
  east: [
    ["none", "low", "tall"],
    ["up", "side", "none"],
  ],
  south: [
    ["none", "low", "tall"],
    ["up", "side", "none"],
  ],
  west: [
    ["none", "low", "tall"],
    ["up", "side", "none"],
  ],
  rotation: [range(16)],
  power: [range(16)],
};

function optionsFor(
  key: string,
  value: string,
): { options: readonly string[] | null; exact: boolean } {
  if (BOOLEAN.includes(value)) return { options: BOOLEAN, exact: true };
  const sets = Object.hasOwn(KNOWN, key) ? (KNOWN[key] as readonly (readonly string[])[]) : [];
  const set = sets.find((s) => s.includes(value));
  return set === undefined ? { options: null, exact: false } : { options: set, exact: false };
}

/** The editable properties of a block state, in the canonical (sorted) order. */
export function blockProperties(state: string): BlockProperty[] {
  const { props } = parseBlockString(state);
  return [...props].map(([key, value]) => ({ key, value, ...optionsFor(key, value) }));
}

const TOKEN = /^[a-z0-9_]+$/;

/**
 * The block string with one property set (added if missing). Name and
 * block-entity NBT are kept; the result is canonical.
 */
export function withBlockProperty(state: string, key: string, value: string): string {
  if (!TOKEN.test(key)) throw new EditError(`invalid property name '${key}'`);
  if (!TOKEN.test(value)) throw new EditError(`invalid value '${value}' for property '${key}'`);
  const { name, props, nbt } = parseBlockString(state);
  const next = new Map(props);
  next.set(key, value);
  return joinBlockString(name, next, nbt ?? "");
}

/** Set one property of the block at `pos`. Throws if the cell is unset. */
export function setBlockProperty(volume: Volume, pos: Vec3, key: string, value: string): Command {
  const idx = volume.indexAt(pos[0], pos[1], pos[2]);
  if (idx === UNSET) throw new EditError(`no block at ${pos.join(", ")} to edit`);
  const b = new CommandBuilder(volume, `set ${key}=${value}`);
  b.setBlock(pos[0], pos[1], pos[2], withBlockProperty(volume.palette[idx] as string, key, value));
  return b.finish();
}
