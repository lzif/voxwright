// SPDX-License-Identifier: AGPL-3.0-only

import { cloneNbt } from "../nbt/index.ts";
import { Volume } from "../volume/index.ts";

/**
 * A deep copy, so an editor can work on a volume without changing the one it
 * was loaded into. Block entities and entities are copied too.
 */
export function cloneVolume(source: Volume): Volume {
  const copy = new Volume();
  for (const block of source.palette) copy.intern(block);
  source.eachCell((x, y, z, idx) => copy.setIndex(x, y, z, idx));
  source.eachBlockEntity((x, y, z, e) =>
    copy.setBlockEntity(x, y, z, { edition: e.edition, nbt: cloneNbt(e.nbt) }),
  );
  for (const e of source.entities) copy.addEntity({ edition: e.edition, nbt: cloneNbt(e.nbt) });
  return copy;
}
