// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { AIR, readStructureNbt } from "../src/index.ts";
import { loadFixture } from "./helpers.ts";

// Rafeals_house was saved by a real tool (bloxelizer.com) in three formats.
// The .nbt uses DataVersion 5023, whose palette entries are spelled
// `id` and `properties`.
describe("Rafeals_house.nbt (saved by a real tool)", () => {
  const file = () => loadFixture("real/rafeals-house/Rafeals_house.nbt");

  it("reads every block", async () => {
    const { volume, meta } = await readStructureNbt(file());
    expect(meta).toEqual({ dataVersion: 5023, droppedBlockEntities: 0, droppedEntities: 0 });
    expect(volume.size).toBe(762);
    expect(volume.countNonAir()).toBe(762);
    const [min, max] = volume.bounds() ?? [];
    expect(min).toEqual([0, 0, 0]);
    expect(max).toEqual([13, 7, 13]);
  });

  it("reads block states with their properties", async () => {
    const { volume } = await readStructureNbt(file());
    expect(volume.palette).toContain("minecraft:barrel[facing=down,open=false]");
    expect(volume.palette).toContain("minecraft:black_bed[facing=north,occupied=false,part=head]");
    expect(volume.palette).not.toContain(AIR);
  });
});
