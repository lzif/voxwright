// SPDX-License-Identifier: AGPL-3.0-only

// Autosave snapshots. A snapshot is a plain object that IndexedDB stores by structured clone: the
// volume's palette, its cells grouped by 16x16x16 section as typed arrays of palette indices, and
// its block entities and entities exactly as parsed NBT (the Maps and typed arrays of core's tag
// objects survive structured clone). It is built from the volume's public API only.
//
// Why not a core codec: the four codecs are the export formats, they cannot hold a Bedrock block
// entity and a Java one together, they drop what a format has no field for, and encoding is
// slower than copying typed arrays. A snapshot must give back the volume cell for cell, air and
// unset cells included, with every block entity and entity untouched.

import { type BlockEntity, UNSET, Volume, type VolumeEntity } from "@voxwright/core";

export const SNAPSHOT_FORMAT = 1;

export interface SnapshotSection {
  /** Section coordinates (cell coordinate shifted right by 4). */
  sx: number;
  sy: number;
  sz: number;
  /** 4096 palette indices, `(y & 15) << 8 | (z & 15) << 4 | (x & 15)`; `NONE` marks an unset cell. */
  cells: Uint16Array | Int32Array;
}

export interface Snapshot {
  format: typeof SNAPSHOT_FORMAT;
  /** The file that was opened (for the restore prompt). */
  name: string;
  dataVersion: number | null;
  /** The loss report of the file as it was opened, kept so the restored page can show it again. */
  loss: string[];
  /** `Date.now()` when taken. */
  savedAt: number;
  /** Edits made in the session, counting the ones already carried by an earlier restore. */
  edits: number;
  palette: string[];
  sections: SnapshotSection[];
  blockEntities: [string, BlockEntity][];
  entities: VolumeEntity[];
}

/** Marks an unset cell in a `Uint16Array` section. */
const NONE = 0xffff;

export interface SnapshotMeta {
  name: string;
  dataVersion: number | null;
  loss: string[];
  edits: number;
  savedAt?: number;
}

/** Copy a volume into a snapshot. Typed arrays are fresh copies, so the volume may change afterwards. */
export function takeSnapshot(volume: Volume, meta: SnapshotMeta): Snapshot {
  const palette = [...volume.palette];
  const narrow = palette.length < NONE;
  const sections = new Map<string, SnapshotSection>();
  volume.eachCell((x, y, z, idx) => {
    const sx = x >> 4;
    const sy = y >> 4;
    const sz = z >> 4;
    const key = `${sx},${sy},${sz}`;
    let s = sections.get(key);
    if (s === undefined) {
      s = {
        sx,
        sy,
        sz,
        cells: narrow ? new Uint16Array(4096).fill(NONE) : new Int32Array(4096).fill(UNSET),
      };
      sections.set(key, s);
    }
    s.cells[((y & 15) << 8) | ((z & 15) << 4) | (x & 15)] = idx;
  });
  return {
    format: SNAPSHOT_FORMAT,
    name: meta.name,
    dataVersion: meta.dataVersion,
    loss: [...meta.loss],
    savedAt: meta.savedAt ?? Date.now(),
    edits: meta.edits,
    palette,
    sections: [...sections.values()],
    blockEntities: [...volume.blockEntities],
    entities: [...volume.entities],
  };
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

/** Is this value shaped like a snapshot this version wrote? Cheap checks; `restoreSnapshot` does the rest. */
export function isSnapshot(value: unknown): value is Snapshot {
  const v = value as Partial<Snapshot> | null | undefined;
  return (
    typeof v === "object" &&
    v !== null &&
    v.format === SNAPSHOT_FORMAT &&
    typeof v.name === "string" &&
    typeof v.savedAt === "number" &&
    typeof v.edits === "number" &&
    Array.isArray(v.palette) &&
    Array.isArray(v.sections) &&
    Array.isArray(v.blockEntities) &&
    Array.isArray(v.entities)
  );
}

/** Rebuild the volume. Throws a `SnapshotError` if the data is not a snapshot or is inconsistent. */
export function restoreSnapshot(snapshot: Snapshot): Volume {
  if (!isSnapshot(snapshot)) throw new SnapshotError("the saved session is not readable");
  const volume = new Volume();
  for (const block of snapshot.palette) volume.intern(block);
  const n = snapshot.palette.length;
  for (const s of snapshot.sections) {
    if (s.cells.length !== 4096) throw new SnapshotError("the saved session is damaged");
    const none = s.cells instanceof Uint16Array ? NONE : UNSET;
    for (let i = 0; i < 4096; i++) {
      const idx = s.cells[i] as number;
      if (idx === none) continue;
      if (idx >= n || idx < 0) throw new SnapshotError("the saved session is damaged");
      volume.setIndex(
        (s.sx << 4) | (i & 15),
        (s.sy << 4) | (i >> 8),
        (s.sz << 4) | ((i >> 4) & 15),
        idx,
      );
    }
  }
  // After the cells: a block entity needs its cell to hold a block.
  for (const [key, entity] of snapshot.blockEntities) {
    const [x, y, z] = key.split(",").map(Number) as [number, number, number];
    volume.setBlockEntity(x, y, z, entity);
  }
  volume.setEntities(snapshot.entities);
  return volume;
}
