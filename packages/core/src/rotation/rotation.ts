// SPDX-License-Identifier: AGPL-3.0-only

// Structure rotation semantics, ported from mcbuilder's `rotation.py`.
//
// The position and blockstate transforms a structure paste applies for each
// rotation (the same table Bukkit's `StructureRotation` uses).
//
// Rotations, clockwise viewed from above:
//   NONE                 identity
//   CLOCKWISE_90         north -> east
//   CLOCKWISE_180        north -> south
//   COUNTERCLOCKWISE_90  north -> west
//
// Positions, for a square footprint of size `s` and 0-based cells:
//   NONE                 (x, z)
//   CLOCKWISE_90         (s - 1 - z, x)
//   CLOCKWISE_180        (s - 1 - x, s - 1 - z)
//   COUNTERCLOCKWISE_90  (z, s - 1 - x)
//
// Blockstates: `facing`, `axis`, sign and banner `rotation`, the cardinal
// connection keys (north/east/south/west) and the horizontal head of a
// compound `orientation` are rotated. Everything else is invariant.

import { canonicalize, join } from "../blocks/blocks.ts";

export const ROTATIONS = ["NONE", "CLOCKWISE_90", "CLOCKWISE_180", "COUNTERCLOCKWISE_90"] as const;
export type Rotation = (typeof ROTATIONS)[number];

export class RotationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RotationError";
  }
}

type FacingMap = Readonly<Record<string, string>>;

const FACING_CW90: FacingMap = { north: "east", east: "south", south: "west", west: "north" };
const FACING_CCW90: FacingMap = { east: "north", south: "east", west: "south", north: "west" };
const FACING_180: FacingMap = { north: "south", south: "north", east: "west", west: "east" };
const CARDINALS = ["north", "east", "south", "west"] as const;

const own = (map: FacingMap, key: string | undefined): string | undefined =>
  key !== undefined && Object.hasOwn(map, key) ? map[key] : undefined;

function checkRotation(rotation: string): Rotation {
  if (!(ROTATIONS as readonly string[]).includes(rotation)) {
    throw new RotationError(
      `invalid rotation '${rotation}'; expected one of [${ROTATIONS.map((r) => `'${r}'`).join(", ")}]`,
    );
  }
  return rotation as Rotation;
}

/**
 * Rotate point `(x, z)` about the integer anchor `(ax, az)`, in the same
 * clockwise-from-above convention as {@link rotatePosition}.
 */
export function rotatePoint(
  x: number,
  z: number,
  ax: number,
  az: number,
  rotation: Rotation,
): [number, number] {
  checkRotation(rotation);
  let rx = x - ax;
  let rz = z - az;
  if (rotation === "CLOCKWISE_90") [rx, rz] = [-rz, rx];
  else if (rotation === "COUNTERCLOCKWISE_90") [rx, rz] = [rz, -rx];
  else if (rotation === "CLOCKWISE_180") [rx, rz] = [-rx, -rz];
  // Adding zero turns -0 into +0.
  return [ax + rx + 0, az + rz + 0];
}

/** Rotate a footprint cell `(x, z)` for a square footprint of `size`. Y is untouched. */
export function rotatePosition(
  x: number,
  z: number,
  size: number,
  rotation: Rotation,
): [number, number] {
  checkRotation(rotation);
  if (rotation === "NONE") return [x, z];
  if (rotation === "CLOCKWISE_90") return [size - 1 - z, x];
  if (rotation === "CLOCKWISE_180") return [size - 1 - x, size - 1 - z];
  return [z, size - 1 - x];
}

function facingMap(rotation: Rotation): FacingMap | null {
  if (rotation === "CLOCKWISE_90") return FACING_CW90;
  if (rotation === "COUNTERCLOCKWISE_90") return FACING_CCW90;
  if (rotation === "CLOCKWISE_180") return FACING_180;
  return null;
}

/** Permute the cardinal connection keys through `map`; values stay put. */
function permuteCardinalKeys(props: Map<string, string>, map: FacingMap): void {
  const remapped = new Map<string, string>();
  for (const key of CARDINALS) {
    const v = props.get(key);
    if (v !== undefined) remapped.set(map[key] ?? key, v);
  }
  for (const key of CARDINALS) props.delete(key);
  for (const [k, v] of remapped) props.set(k, v);
}

/** Remap the horizontal head of a compound `orientation` such as `north_up`. */
function remapOrientation(props: Map<string, string>, map: FacingMap): void {
  const ori = props.get("orientation");
  if (ori === undefined) return;
  const cut = ori.indexOf("_");
  const head = cut === -1 ? ori : ori.slice(0, cut);
  const tail = cut === -1 ? "" : ori.slice(cut);
  const next = own(map, head);
  if (next !== undefined) props.set("orientation", next + tail);
}

function remapProps(input: ReadonlyMap<string, string>, rotation: Rotation): Map<string, string> {
  const out = new Map(input);
  const map = facingMap(rotation);
  if (map !== null) {
    const next = own(map, out.get("facing"));
    if (next !== undefined) out.set("facing", next);
    permuteCardinalKeys(out, map);
    remapOrientation(out, map);
  }
  if (rotation === "CLOCKWISE_90" || rotation === "COUNTERCLOCKWISE_90") {
    const axis = out.get("axis");
    if (axis === "x") out.set("axis", "z");
    else if (axis === "z") out.set("axis", "x");
  }
  const rot = out.get("rotation");
  if (rot !== undefined && /^-*[0-9]+$/.test(rot)) {
    const shift = { CLOCKWISE_90: 4, CLOCKWISE_180: 8, COUNTERCLOCKWISE_90: 12, NONE: 0 }[rotation];
    out.set("rotation", String((((Number.parseInt(rot, 10) + shift) % 16) + 16) % 16));
  }
  return out;
}

/** Split canonical -> name, props, nbt (the verbatim tail starting at the first brace). */
function split(canonical: string): { name: string; props: Map<string, string>; nbt: string } {
  let head = canonical;
  let nbt = "";
  const brace = head.indexOf("{");
  if (brace !== -1) {
    nbt = head.slice(brace);
    head = head.slice(0, brace);
  }
  const props = new Map<string, string>();
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

function rejoin(name: string, props: Map<string, string>, nbt: string): string {
  const built = props.size > 0 ? join(name, props, nbt) : name + nbt;
  return canonicalize(built);
}

/**
 * Rotate one canonical block string. The input must already be canonical;
 * the output is canonical too. Non-directional blocks pass through
 * unchanged.
 */
export function rotateBlockstate(canonical: string, rotation: Rotation): string {
  checkRotation(rotation);
  if (rotation === "NONE") return canonicalize(canonical);
  const { name, props, nbt } = split(canonical);
  if (props.size === 0) return canonicalize(canonical);
  return rejoin(name, remapProps(props, rotation), nbt);
}

const MIRROR_FACING: Readonly<Record<"x" | "z", FacingMap>> = {
  x: { east: "west", west: "east" },
  z: { north: "south", south: "north" },
};

/**
 * Mirror one canonical block string across an axis plane. `x` maps x to
 * -x (east and west swap); `z` maps z to -z (north and south swap).
 * Up/down facings, `axis`, sign `rotation` and door `hinge` pass through
 * unchanged, as in mcbuilder.
 */
export function mirrorBlockstate(canonical: string, axis: "x" | "z"): string {
  if (axis !== "x" && axis !== "z") {
    throw new RotationError(`invalid mirror axis '${String(axis)}'; expected 'x' or 'z'`);
  }
  const { name, props, nbt } = split(canonical);
  if (props.size === 0) return canonicalize(canonical);
  const swap = MIRROR_FACING[axis];
  const out = new Map(props);
  const next = own(swap, out.get("facing"));
  if (next !== undefined) out.set("facing", next);
  permuteCardinalKeys(out, swap);
  remapOrientation(out, swap);
  return rejoin(name, out, nbt);
}
