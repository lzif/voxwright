// SPDX-License-Identifier: AGPL-3.0-only
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  byteArray,
  compound,
  int,
  readLitematic,
  readSchem,
  readStructureNbt,
  short,
  Volume,
  writeLitematic,
  writeNbtGzip,
  writeSchem,
} from "../src/index.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const script = join(root, "scripts/convert.ts");
const dir = mkdtempSync(join(tmpdir(), "voxwright-convert-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A bare `.schem` that only claims a size. */
const writeSchemOf = (w: number, h: number, l: number): Promise<Uint8Array> =>
  writeNbtGzip({
    name: "Schematic",
    tag: compound([
      ["Version", int(2)],
      ["Width", short(w)],
      ["Height", short(h)],
      ["Length", short(l)],
      ["Palette", compound([["minecraft:stone", int(0)]])],
      ["BlockData", byteArray(new Int8Array(0))],
    ]),
  });

const run = (...args: string[]) =>
  execFileSync(process.execPath, [script, ...args], { encoding: "utf8", stdio: "pipe" });

describe("scripts/convert.ts", () => {
  it("turns a .schem into a .nbt with the same blocks", async () => {
    const out = join(dir, "out.nbt");
    const log = run(join(root, "fixtures/synthetic/v3-small.schem"), out);
    expect(log).toContain("24 blocks");
    // The fixture's Metadata (a name) has nowhere to go in a volume.
    expect(log).toContain("1 loss report entry");
    const original = await readSchem(
      new Uint8Array(readFileSync(join(root, "fixtures/synthetic/v3-small.schem"))),
    );
    const converted = await readStructureNbt(new Uint8Array(readFileSync(out)));
    expect(converted.volume.size).toBe(original.volume.size);
    // The chest's block entity travels with it.
    expect(converted.volume.blockEntityCount).toBe(1);
    expect(converted.meta.dataVersion).toBe(4903);
  });

  it("converts back to both Sponge versions", async () => {
    for (const version of ["2", "3"]) {
      const out = join(dir, `back-v${version}.schem`);
      run(join(root, "fixtures/synthetic/v2-small.schem"), out, "--version", version);
      const { meta } = await readSchem(new Uint8Array(readFileSync(out)));
      expect(meta.version).toBe(Number(version));
    }
  });

  it("converts the real build between all four formats without losing a block", async () => {
    const real = join(root, "fixtures/real/rafeals-house/Rafeals_house");
    for (const [from, to] of [
      [".nbt", ".litematic"],
      [".litematic", ".mcstructure"],
      [".mcstructure", ".schem"],
      [".schem", ".nbt"],
    ]) {
      const src =
        from === ".nbt" || from === ".litematic" || from === ".mcstructure"
          ? `${real}${from}`
          : join(dir, `chain${from}`);
      const out = join(dir, `chain${to}`);
      expect(run(src, out)).toContain("762 blocks");
    }
    const final = await readStructureNbt(new Uint8Array(readFileSync(join(dir, "chain.nbt"))));
    expect(final.volume.size).toBe(762);
  });

  it("keeps the .schem Offset from .schem to .schem", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    v.set(1, 0, 0, "minecraft:stone");
    const src = join(dir, "offset-in.schem");
    writeFileSync(src, (await writeSchem(v, { dataVersion: 4903, offset: [3, -2, 5] })).bytes);
    const out = join(dir, "offset-out.schem");
    run(src, out);
    const back = await readSchem(new Uint8Array(readFileSync(out)));
    expect(back.meta.offset).toEqual([3, -2, 5]);
  });

  it("keeps the .litematic name, author and description from .litematic to .litematic", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    const src = join(dir, "meta-in.litematic");
    writeFileSync(
      src,
      (
        await writeLitematic(v, {
          dataVersion: 4903,
          name: "Castle",
          author: "Luki",
          description: "A keep",
        })
      ).bytes,
    );
    const out = join(dir, "meta-out.litematic");
    run(src, out);
    const back = await readLitematic(new Uint8Array(readFileSync(out)));
    expect(back.meta).toMatchObject({ name: "Castle", author: "Luki", description: "A keep" });
  });

  it("says why a build over 512 blocks per axis is refused", async () => {
    const big = join(dir, "big.schem");
    const bytes = await writeSchemOf(601, 1, 1);
    writeFileSync(big, bytes);
    const bad = spawnSync(process.execPath, [script, big, join(dir, "big.nbt")], {
      encoding: "utf8",
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain(
      "convert: this build is 601 x 1 x 1; the limit is 512 blocks per axis",
    );
  });

  it("tells the user to re-save a legacy .schematic as .schem", () => {
    const legacy = join(dir, "old.schematic");
    writeFileSync(legacy, new Uint8Array(0));
    const bad = spawnSync(process.execPath, [script, legacy, join(dir, "x.nbt")], {
      encoding: "utf8",
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain("legacy .schematic");
    expect(bad.stderr).toContain("re-save it as .schem");
  });

  it("fails clearly on bad input", () => {
    const bad = spawnSync(process.execPath, [script, "in.txt", join(dir, "x.nbt")], {
      encoding: "utf8",
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain("unsupported input format");
    const usage = spawnSync(process.execPath, [script], { encoding: "utf8" });
    expect(usage.status).toBe(2);
  });
});
