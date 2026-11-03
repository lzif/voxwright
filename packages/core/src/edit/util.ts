// SPDX-License-Identifier: AGPL-3.0-only

import { Volume } from "../volume/index.ts";

/** A deep copy, so an editor can work on a volume without changing the one it was loaded into. */
export function cloneVolume(source: Volume): Volume {
  const copy = new Volume();
  for (const block of source.palette) copy.intern(block);
  source.eachCell((x, y, z, idx) => copy.setIndex(x, y, z, idx));
  return copy;
}
