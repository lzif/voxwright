// SPDX-License-Identifier: AGPL-3.0-only

// Shared helpers for carrying block entities and entities through the
// codecs, and for counting what a codec could not carry so it can be put in
// the loss report.

import type { CompoundTag, NbtTag } from "../nbt/index.ts";
import type { BlockEntity, Edition, Volume, VolumeEntity } from "../volume/index.ts";
import { AIR_BLOCKS, SKIP_BLOCKS } from "./common.ts";

/** Keys that hold a block entity's position in the file formats that embed it in the NBT. */
export const POSITION_KEYS: ReadonlySet<string> = new Set(["x", "y", "z"]);

/** The entries of a compound in order, leaving out the named keys. */
export function entriesWithout(tag: CompoundTag, skip: ReadonlySet<string>): [string, NbtTag][] {
  return [...tag.value].filter(([k]) => !skip.has(k));
}

/** The name of a thing for the loss report: its id without the `minecraft:` prefix. */
export function kindOf(tag: NbtTag | undefined): string {
  if (tag?.type !== "string" || tag.value === "") return "unknown";
  return tag.value.startsWith("minecraft:") ? tag.value.slice(10) : tag.value;
}

/** Counts of block entities and entities by kind, for a loss report line. */
export class Tally {
  private readonly blocks = new Map<string, number>();
  private readonly mobs = new Map<string, number>();

  addBlockEntity(kind: string): void {
    this.blocks.set(kind, (this.blocks.get(kind) ?? 0) + 1);
  }

  addEntity(kind: string): void {
    this.mobs.set(kind, (this.mobs.get(kind) ?? 0) + 1);
  }

  get blockEntityCount(): number {
    let n = 0;
    for (const c of this.blocks.values()) n += c;
    return n;
  }

  get entityCount(): number {
    let n = 0;
    for (const c of this.mobs.values()) n += c;
    return n;
  }

  /** One line per non-empty count, such as `2 block entities not carried over (why): chest x2`. */
  lines(why: string): string[] {
    const out: string[] = [];
    const describe = (counts: Map<string, number>, one: string, many: string): void => {
      let total = 0;
      for (const c of counts.values()) total += c;
      if (total === 0) return;
      const kinds = [...counts]
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([k, c]) => `${k} x${c}`)
        .join(", ");
      out.push(`${total} ${total === 1 ? one : many} not carried over (${why}): ${kinds}`);
    };
    describe(this.blocks, "block entity", "block entities");
    describe(this.mobs, "entity", "entities");
    return out;
  }
}

const bareName = (name: string): string => (name.startsWith("minecraft:") ? name.slice(10) : name);

/** Names with counts, most frequent first: `jigsaw x3, structure_void x1`. */
export function describeCounts(counts: ReadonlyMap<string, number>): string {
  return [...counts]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, c]) => `${k} x${c}`)
    .join(", ");
}

/** `"skip"` for editor leftovers, `"air"` for any kind of air and `"block"` otherwise; `name` has no properties. */
export function classifyBlock(name: string): "skip" | "air" | "block" {
  if (SKIP_BLOCKS.has(name)) return "skip";
  return AIR_BLOCKS.has(name) ? "air" : "block";
}

/** Blocks a reader drops or rewrites on purpose, counted by kind for the loss report. */
export class BlockTally {
  private readonly skipped = new Map<string, number>();
  private readonly air = new Map<string, number>();

  /**
   * Classify a block read from a file by its name (no properties) and count
   * it if it is dropped or rewritten. Nothing is counted for plain
   * `minecraft:air`.
   */
  note(name: string): "skip" | "air" | "block" {
    const kind = classifyBlock(name);
    const bare = bareName(name);
    if (kind === "skip") this.skipped.set(bare, (this.skipped.get(bare) ?? 0) + 1);
    else if (kind === "air" && name !== "minecraft:air") {
      this.air.set(bare, (this.air.get(bare) ?? 0) + 1);
    }
    return kind;
  }

  /** One line per non-empty count. */
  lines(): string[] {
    const out: string[] = [];
    const describe = (counts: Map<string, number>, why: string, verb: string): void => {
      let total = 0;
      for (const c of counts.values()) total += c;
      if (total === 0) return;
      out.push(
        `${total} ${total === 1 ? "block" : "blocks"} ${verb} (${why}): ${describeCounts(counts)}`,
      );
    };
    describe(this.skipped, "editor leftovers that are not part of a build", "not carried over");
    describe(this.air, "cave_air and void_air are not kept", "turned into air");
    return out;
  }
}

/** Attach a block entity to a cell that was read; if the cell holds no block, count it as lost. */
export function attachBlockEntity(
  volume: Volume,
  x: number,
  y: number,
  z: number,
  entity: BlockEntity,
  lost: Tally,
  kind: string,
): void {
  if (volume.indexAt(x, y, z) < 0) lost.addBlockEntity(kind);
  else volume.setBlockEntity(x, y, z, entity);
}

/** Block-entity kind for the loss report: the `id` of a Java compound or a Bedrock one (`Chest`, `Sign`...). */
const blockEntityKind = (e: BlockEntity): string => kindOf(e.nbt.value.get("id"));
/** Entity kind for the loss report: `id` in Java, `identifier` in Bedrock. */
const entityKind = (e: VolumeEntity): string =>
  kindOf(e.nbt.value.get(e.edition === "java" ? "id" : "identifier") ?? e.nbt.value.get("id"));

/**
 * Report everything the volume holds in the other edition's NBT, which a
 * writer for `target` cannot use. `skip` leaves out block entities the
 * writer rebuilds from the block itself. Returns the loss lines.
 */
export function foreignLines(
  volume: Volume,
  target: Edition,
  skip: (x: number, y: number, z: number, e: BlockEntity) => boolean = () => false,
): string[] {
  const tally = new Tally();
  volume.eachBlockEntity((x, y, z, e) => {
    if (e.edition !== target && !skip(x, y, z, e)) tally.addBlockEntity(blockEntityKind(e));
  });
  for (const e of volume.entities) if (e.edition !== target) tally.addEntity(entityKind(e));
  return tally.lines(
    target === "java"
      ? "Bedrock NBT cannot be translated to Java"
      : "Java NBT cannot be translated to Bedrock",
  );
}

export { blockEntityKind, entityKind };
