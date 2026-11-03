// SPDX-License-Identifier: AGPL-3.0-only
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { readSchem, readStructureNbt } from "../src/index.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const script = join(root, "scripts/convert.ts");
const dir = mkdtempSync(join(tmpdir(), "voxwright-convert-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const run = (...args: string[]) =>
  execFileSync(process.execPath, [script, ...args], { encoding: "utf8" });

describe("scripts/convert.ts", () => {
  it("turns a .schem into a .nbt with the same blocks", async () => {
    const out = join(dir, "out.nbt");
    const log = run(join(root, "fixtures/synthetic/v3-small.schem"), out);
    expect(log).toContain("24 blocks");
    const original = await readSchem(
      new Uint8Array(readFileSync(join(root, "fixtures/synthetic/v3-small.schem"))),
    );
    const converted = await readStructureNbt(new Uint8Array(readFileSync(out)));
    expect(converted.volume.size).toBe(original.volume.size);
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
