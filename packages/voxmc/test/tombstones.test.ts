// SPDX-License-Identifier: AGPL-3.0-only
// The tombstones (time-boxed, removed at 0.1.0). Old names are never written out here: they come
// from the tombstone module's own lists, so this file passes the name gate without an exception.
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CliError, findConfig } from "../src/node/cli.ts";
import {
  OLD_CONFIG_NAMES,
  OLD_IMPORTS,
  oldConfigMessage,
  oldImportMessage,
} from "../src/node/skill/tombstones.ts";

const run = promisify(execFile);
const BIN = fileURLToPath(new URL("../bin/voxmc.ts", import.meta.url));
const recipeFor = (from: string): string =>
  `import { Build } from "${from}";\nexport const BUILD = new Build();\n`;

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "voxmc-tomb-"));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const cli = (args: string[], cwd: string) =>
  run(process.execPath, [BIN, ...args], { cwd, env: { ...process.env, HOME: dir } }).then(
    (r) => ({ code: 0, ...r }),
    (e: { code: number; stdout: string; stderr: string }) => e,
  );

describe("old import specifiers", () => {
  it("lists every old specifier, scoped and unscoped", () => {
    expect(OLD_IMPORTS.length).toBeGreaterThanOrEqual(6);
    expect(OLD_IMPORTS.some((n) => n.startsWith("@"))).toBe(true);
  });

  it.each(OLD_IMPORTS)("%s gives a message naming the rename and the new import", (name) => {
    const message = oldImportMessage(name);
    expect(message).toContain(`'${name}' was renamed`);
    expect(message).toContain('from "voxmc"');
    expect(oldImportMessage(`${name}/sub/path`)).toContain("was renamed");
  });

  it("leaves the new names and look-alikes alone", () => {
    const first = OLD_IMPORTS[0] as string;
    for (const ok of ["voxmc", "voxmc-engine", "voxmc-core", "node:fs", "./local.ts"]) {
      expect(oldImportMessage(ok)).toBeNull();
    }
    expect(oldImportMessage(`${first}x`)).toBeNull();
    expect(oldImportMessage(`x${first}`)).toBeNull();
  });

  it("makes the command line fail with that message, for every old specifier", async () => {
    for (const [i, name] of OLD_IMPORTS.entries()) {
      const file = `old${i}.ts`;
      await writeFile(join(dir, file), recipeFor(name));
      const r = await cli(["check", file], dir);
      expect(r.code, name).not.toBe(0);
      expect(r.stderr, name).toContain(`'${name}' was renamed`);
      expect(r.stderr, name).toContain('from "voxmc"');
      expect(r.stdout, name).not.toContain("OK");
    }
  });

  it("does not resolve the old name to anything (it is not an alias)", async () => {
    await writeFile(join(dir, "alias.ts"), recipeFor(OLD_IMPORTS[0] as string));
    const r = await cli(["check", "alias.ts"], dir);
    expect(r.stdout).not.toContain("blocks");
  });

  it("still builds a recipe that imports the new name", async () => {
    await writeFile(
      join(dir, "new.ts"),
      `${recipeFor("voxmc")}BUILD.scope(() => BUILD.box([0, 0, 0], [1, 1, 1], "minecraft:stone"));\n`,
    );
    await writeFile(
      join(dir, "registry.json"),
      JSON.stringify({ version: "26.2", blocks: { "minecraft:stone": { properties: {} } } }),
    );
    const r = await cli(
      ["build", "new.ts", "--registry", "registry.json", "--out", "new.schem"],
      dir,
    );
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("build: OK");
  });
});

describe("old config file", () => {
  it.each(OLD_CONFIG_NAMES)("%s found where voxmc.toml is looked up is an error", async (name) => {
    const here = join(dir, `cfg-${name}`);
    await mkdir(here, { recursive: true });
    await writeFile(join(here, name), 'mc_version = "1.20.1"\n');
    await expect(findConfig(here, dir)).rejects.toThrow(CliError);
    await expect(findConfig(here, dir)).rejects.toThrow("renamed to voxmc.toml");
    // Found by the walk upwards too, not only in the recipe's own directory.
    const below = join(here, "a", "b");
    await mkdir(below, { recursive: true });
    await expect(findConfig(below, dir)).rejects.toThrow(oldConfigMessage(join(here, name)));
  });

  it("makes the command line fail instead of ignoring the file", async () => {
    const name = OLD_CONFIG_NAMES[0] as string;
    const here = join(dir, "cli-cfg");
    await mkdir(here, { recursive: true });
    await writeFile(join(here, name), 'mc_version = "1.20.1"\n');
    await writeFile(join(here, "x.ts"), recipeFor("voxmc"));
    const r = await cli(["check", "x.ts"], here);
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain("renamed to voxmc.toml");
    const b = await cli(["build", "x.ts", "--out", "x.schem"], here);
    expect(b.code).not.toBe(0);
    expect(b.stderr).toContain("renamed to voxmc.toml");
  });

  it("is not triggered when voxmc.toml is there too (the new file wins)", async () => {
    const name = OLD_CONFIG_NAMES[0] as string;
    const here = join(dir, "both");
    await mkdir(here, { recursive: true });
    await writeFile(join(here, name), 'mc_version = "1.20.1"\n');
    await writeFile(join(here, "voxmc.toml"), 'mc_version = "1.21"\n');
    const cfg = await findConfig(here, dir);
    expect(cfg?.mcVersion).toBe("1.21");
  });
});
