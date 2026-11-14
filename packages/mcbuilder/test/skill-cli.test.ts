// SPDX-License-Identifier: AGPL-3.0-only
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import * as core from "@voxwright/core";
import { readLitematic, readMcstructure, readSchem, readStructureNbt } from "@voxwright/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as engine from "../src/index.ts";
import type { HttpGet } from "../src/node/index.ts";
import { locateInRecipe, resolveTargets } from "../src/node/skill/build.ts";
import * as facade from "../src/node/skill/main.ts";
import { runSkillCli } from "../src/node/skill/main.ts";

const run = promisify(execFile);
const repo = fileURLToPath(new URL("../../../", import.meta.url));
const BUNDLE = join(repo, "skills/voxwright/scripts/voxwright-cli.mjs");
// Recipes run in this process are imported by Vitest, which resolves the workspace package from
// inside the repository; the bundle tests further down use a directory outside it.
const base = fileURLToPath(new URL("./.tmp/", import.meta.url));
let root: string;
let home: string;
let registryFile: string;

const dirs = ["north", "south", "west", "east"];
const REGISTRY = {
  version: "26.2",
  blocks: {
    "minecraft:cobblestone": { properties: {} },
    "minecraft:oak_planks": { properties: {} },
    "minecraft:stone": { properties: {} },
    "minecraft:oak_log": { properties: { axis: ["x", "y", "z"] } },
    "minecraft:spruce_stairs": {
      properties: {
        facing: dirs,
        half: ["top", "bottom"],
        shape: ["straight", "inner_left", "inner_right", "outer_left", "outer_right"],
        waterlogged: ["true", "false"],
      },
    },
  },
};

const hut = (from: string): string => `import { Build } from "${from}";

export const BUILD = new Build({ seed: 3 });
BUILD.scope(() => {
  BUILD.box([0, 0, 0], [4, 0, 4], "minecraft:cobblestone");
  BUILD.walls([0, 1, 0], [4, 2, 4], "minecraft:oak_planks");
  BUILD.pillar([0, 1, 0], 2, "minecraft:oak_log[axis=y]");
  BUILD.roofGable([-1, 3, -1], [5, 3, 5], "minecraft:spruce_stairs", { ridge: "x" });
});
`;
/** Non-air cells of the hut: 25 floor, 32 walls (2 of them the corner log), 49 roof. */
const HUT_BLOCKS = 25 + 32 + 49;

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      out: (l: string) => out.push(l),
      err: (l: string) => err.push(l),
      cwd: root,
      home,
      env: {},
    },
  };
}

async function recipe(name: string, source: string): Promise<string> {
  await writeFile(join(root, name), source);
  return name;
}

beforeAll(async () => {
  await mkdir(base, { recursive: true });
  root = await mkdtemp(join(base, "skill-"));
  home = join(root, "home");
  await mkdir(home);
  registryFile = join(root, "registry.json");
  await writeFile(registryFile, JSON.stringify(REGISTRY));
  await recipe("hut.ts", hut("@voxwright/mcbuilder"));
});
afterAll(() => rm(root, { recursive: true, force: true }));

describe("facade", () => {
  it("exports everything of the engine and of core under one name each", () => {
    // `export *` from two modules drops a name both export; nothing may go missing that way.
    const all = facade as Record<string, unknown>;
    for (const [name, value] of Object.entries(engine)) expect(all[name], name).toBe(value);
    for (const [name, value] of Object.entries(core)) expect(all[name], name).toBe(value);
  });
});

describe("resolveTargets", () => {
  const cwd = join(tmpdir(), "x");
  it("takes the format from the extension", () => {
    expect(resolveTargets(["a.schem", "b/c.LITEMATIC"], undefined, cwd)).toEqual([
      { path: join(cwd, "a.schem"), format: "schem" },
      { path: join(cwd, "b/c.LITEMATIC"), format: "litematic" },
    ]);
  });
  it("appends the extension when --format names it", () => {
    expect(resolveTargets(["out/a"], "mcstructure", cwd)).toEqual([
      { path: join(cwd, "out/a.mcstructure"), format: "mcstructure" },
    ]);
    expect(resolveTargets(["a.nbt"], "nbt", cwd)).toEqual([
      { path: join(cwd, "a.nbt"), format: "nbt" },
    ]);
  });
  it("refuses what it cannot make sense of", () => {
    const usage = (fn: () => unknown, text: string): void => {
      expect(fn).toThrowError(expect.objectContaining({ exitCode: 2 }));
      expect(fn).toThrow(text);
    };
    usage(() => resolveTargets([], undefined, cwd), "--out <path> is required");
    usage(() => resolveTargets(["a.txt"], undefined, cwd), "cannot tell the format");
    usage(() => resolveTargets(["a"], undefined, cwd), "cannot tell the format");
    usage(() => resolveTargets(["a.nbt"], "schem", cwd), "has the extension of nbt");
    usage(() => resolveTargets(["a.nbt", "b.schem"], "schem", cwd), "several --out");
    usage(() => resolveTargets(["a.nbt"], "zip", cwd), "--format must be one of");
    usage(() => resolveTargets(["a.schematic"], undefined, cwd), "legacy format");
    usage(() => resolveTargets(["a.nbt", "./a.nbt"], undefined, cwd), "given twice");
  });
});

describe("locateInRecipe", () => {
  it("finds the recipe's line in a stack, by path or by file URL", () => {
    const e = new Error("boom");
    e.stack =
      "Error: boom\n    at Build.set (file:///x/engine.mjs:10:3)\n    at file:///r/my%20hut.ts?t=17:12:5";
    expect(locateInRecipe(e, "/r/my hut.ts")).toBe("my hut.ts:12:5");
    e.stack = "/r/hut.ts:7\n  BUILD.box(\n  ^\nSyntaxError: nope";
    expect(locateInRecipe(e, "/r/hut.ts")).toBe("hut.ts:7");
    expect(locateInRecipe(new Error("elsewhere"), "/r/hut.ts")).toBeNull();
    expect(locateInRecipe("not an error", "/r/hut.ts")).toBeNull();
  });
});

describe("build", () => {
  it("writes all four formats, and each reads back with the same blocks", async () => {
    const c = capture();
    const code = await runSkillCli(
      [
        "build",
        "hut.ts",
        "--registry",
        registryFile,
        ...["schem", "litematic", "nbt", "mcstructure"].flatMap((f) => ["--out", `out/hut.${f}`]),
      ],
      c.io,
    );
    expect(c.err).toEqual([]);
    expect(code).toBe(0);
    const text = c.out.join("\n");
    expect(text).toContain("build: OK");
    expect(text).toContain("size: 7×7×7 (X×Y×Z)");
    expect(text).toContain("bounds: -1,0,-1 to 5,6,5");
    expect(text).toContain(`blocks: ${HUT_BLOCKS}`);
    expect(text).toContain("minecraft: 26.2 (DataVersion 4903)");
    expect(text).toContain("validation: 26.2 registry, 0 errors");
    expect(text).toContain("25 minecraft:cobblestone");
    expect(text).toContain(`${join(root, "out/hut.schem")} (schem, `);

    const bytes = async (f: string) => new Uint8Array(await readFile(join(root, `out/hut.${f}`)));
    const schem = await readSchem(await bytes("schem"));
    expect(schem.meta.version).toBe(3);
    expect(schem.meta.dataVersion).toBe(4903);
    const litematic = await readLitematic(await bytes("litematic"));
    expect(litematic.meta.name).toBe("hut");
    const nbt = await readStructureNbt(await bytes("nbt"));
    const bedrock = await readMcstructure(await bytes("mcstructure"));
    for (const r of [schem, litematic, nbt, bedrock]) {
      expect(r.volume.countNonAir()).toBe(HUT_BLOCKS);
    }
    // A file starts at its own corner: the build's lowest corner (-1, 0, -1) is the file's (0, 0, 0).
    expect(schem.volume.get(1, 0, 1)).toBe("minecraft:cobblestone");
  });

  it("honours --format, --schem-version, --name and --author", async () => {
    const c = capture();
    expect(
      await runSkillCli(
        [
          "build",
          "hut.ts",
          "--registry",
          registryFile,
          "--out",
          "named/hut",
          "--format",
          "schem",
        ].concat(["--schem-version", "2"]),
        c.io,
      ),
    ).toBe(0);
    const schem = await readSchem(new Uint8Array(await readFile(join(root, "named/hut.schem"))));
    expect(schem.meta.version).toBe(2);

    expect(
      await runSkillCli(
        ["build", "hut.ts", "--registry", registryFile, "--out", "named/h.litematic"].concat([
          "--name",
          "Hut",
          "--author",
          "Ada",
        ]),
        capture().io,
      ),
    ).toBe(0);
    const lit = await readLitematic(
      new Uint8Array(await readFile(join(root, "named/h.litematic"))),
    );
    expect(lit.meta.name).toBe("Hut");
    expect(lit.meta.author).toBe("Ada");
  });

  it("prints one JSON document with --json", async () => {
    const c = capture();
    const code = await runSkillCli(
      ["build", "hut.ts", "--registry", registryFile, "--out", "json/hut.mcstructure", "--json"],
      c.io,
    );
    expect(code).toBe(0);
    const s = JSON.parse(c.out.join("\n"));
    expect(s).toMatchObject({
      ok: true,
      recipe: join(root, "hut.ts"),
      size: [7, 7, 7],
      bounds: { min: [-1, 0, -1], max: [5, 6, 5] },
      blocks: HUT_BLOCKS,
      mcVersion: "26.2",
      dataVersion: 4903,
      validation: { registry: "26.2", source: registryFile, skipped: null, errors: [] },
      outputs: [{ path: join(root, "json/hut.mcstructure"), format: "mcstructure" }],
    });
    expect(s.blockStates).toBe(s.palette.length);
    expect(s.palette[0]).toEqual({ state: "minecraft:oak_planks", count: 30 });
    expect(s.outputs[0].bytes).toBeGreaterThan(0);
    expect(s.outputs[0].warnings).toEqual([]);
    expect(s.warnings).toEqual([]);
  });

  it("passes on what a format could not carry, per file and for the run", async () => {
    await recipe(
      "lamp.ts",
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build();
BUILD.scope(() => {
  BUILD.set(0, 0, 0, "minecraft:redstone_lamp[lit=true]");
});
`,
    );
    const c = capture();
    const code = await runSkillCli(
      ["build", "lamp.ts", "--offline", "--json"].concat([
        "--out",
        "loss/l.mcstructure",
        "--out",
        "loss/l.schem",
      ]),
      c.io,
    );
    expect(code).toBe(0);
    const s = JSON.parse(c.out.join("\n"));
    const lost = "redstone_lamp: dropped Java property lit=true";
    expect(s.outputs.map((o: { warnings: string[] }) => o.warnings)).toEqual([[lost], []]);
    expect(s.warnings).toContain(`l.mcstructure: ${lost}`);
    expect(s.validation.skipped).toContain("--offline is set");
  });

  it("fails on unknown blocks and illegal states, and writes nothing", async () => {
    await recipe(
      "bad.ts",
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build();
BUILD.scope(() => {
  BUILD.set(0, 0, 0, "minecraft:oak_plank");
  BUILD.set(1, 0, 0, "minecraft:spruce_stairs[facing=up]");
  BUILD.set(2, 0, 0, "mymod:gizmo");
});
`,
    );
    const c = capture();
    const code = await runSkillCli(
      ["build", "bad.ts", "--registry", registryFile, "--out", "bad/bad.schem"],
      c.io,
    );
    expect(code).toBe(1);
    const text = c.out.join("\n");
    expect(text).toContain("build: FAILED");
    expect(text).toContain("validation: 26.2 registry, 3 errors");
    expect(text).toContain("unknown block 'minecraft:oak_plank'");
    // Each error names the recipe line that first placed the block.
    expect(text).toMatch(/unknown block 'minecraft:oak_plank'.*\(at bad\.ts:4:\d+\)/);
    expect(text).toMatch(/illegal value 'up'.*\(at bad\.ts:5:\d+\)/);
    expect(text).toContain("did you mean minecraft:oak_planks");
    expect(text).toContain("illegal value 'up' for property 'facing'");
    expect(text).toContain("pass --allow mymod:gizmo");
    expect(text).toContain("nothing was written");
    expect(existsSync(join(root, "bad"))).toBe(false);

    const j = capture();
    expect(
      await runSkillCli(
        ["build", "bad.ts", "--registry", registryFile, "--out", "bad/bad.schem", "--json"],
        j.io,
      ),
    ).toBe(1);
    const s = JSON.parse(j.out.join("\n"));
    expect(s.ok).toBe(false);
    expect(s.outputs).toEqual([]);
    expect(s.validation.errors).toHaveLength(3);
    expect(s.validation.errors[0].suggestions).toContain("minecraft:oak_planks");
  });

  it("accepts an allowlisted block with a warning", async () => {
    await recipe(
      "modded.ts",
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build();
BUILD.scope(() => {
  BUILD.set(0, 0, 0, "mymod:gizmo");
});
`,
    );
    const c = capture();
    const code = await runSkillCli(
      ["build", "modded.ts", "--registry", registryFile, "--out", "modded.nbt"].concat([
        "--allow",
        "mymod:gizmo",
      ]),
      c.io,
    );
    expect(code).toBe(0);
    expect(c.out.join("\n")).toContain("mymod:gizmo is allowlisted");
  });

  it("exports unvalidated, with a warning, when offline without a registry", async () => {
    const c = capture();
    const code = await runSkillCli(["build", "hut.ts", "--offline", "--out", "off/hut.nbt"], c.io);
    expect(code).toBe(0);
    const text = c.out.join("\n");
    expect(text).toContain("validation: skipped");
    expect(text).toContain("validation skipped: no block registry for 26.2");
    expect(text).toContain("--offline is set");
    expect(existsSync(join(root, "off/hut.nbt"))).toBe(true);
  });

  it("downloads the registry once into the shared cache, then validates", async () => {
    const calls: string[] = [];
    const get: HttpGet = async (url) => {
      calls.push(url);
      if (!url.endsWith("/data/pc/26.2/blocks.json"))
        return { status: 404, body: new Uint8Array() };
      const blocks = [
        { name: "cobblestone", states: [] },
        { name: "oak_planks", states: [] },
        { name: "oak_log", states: [{ name: "axis", type: "enum", values: ["x", "y", "z"] }] },
      ];
      return { status: 200, body: new TextEncoder().encode(JSON.stringify(blocks)) };
    };
    const c = capture();
    const code = await runSkillCli(["build", "hut.ts", "--out", "dl/hut.nbt"], c.io, { get });
    // The fake registry lacks spruce_stairs: validation ran against the download.
    expect(code).toBe(1);
    expect(c.out.join("\n")).toContain("unknown block 'minecraft:spruce_stairs'");
    expect(calls).toHaveLength(1);
    const cached = join(home, ".cache/mcbuilder/26.2/minecraft-data.json");
    expect(existsSync(cached)).toBe(true);

    await runSkillCli(["build", "hut.ts", "--out", "dl/hut.nbt"], capture().io, { get });
    expect(calls).toHaveLength(1);
    await rm(join(home, ".cache"), { recursive: true });
  });

  it("still exports when the download fails", async () => {
    const get: HttpGet = async () => ({ status: 503, body: new Uint8Array() });
    const c = capture();
    const code = await runSkillCli(["build", "hut.ts", "--out", "fail/hut.nbt"], c.io, { get });
    expect(code).toBe(0);
    expect(c.out.join("\n")).toContain("could not be downloaded");
    expect(existsSync(join(home, ".cache/mcbuilder/26.2/minecraft-data.json"))).toBe(false);
  });

  it("reports recipe problems as one line with exit code 1", async () => {
    await recipe(
      "empty.ts",
      `import { Build } from "@voxwright/mcbuilder";\nexport const BUILD = new Build();\n`,
    );
    await recipe("nobuild.ts", "export const BUILD = 3;\n");
    for (const [file, text] of [
      ["empty.ts", "placed no blocks"],
      ["nobuild.ts", "must export a Build as BUILD"],
      ["missing.ts", "no such script"],
    ] as const) {
      const c = capture();
      expect(await runSkillCli(["build", file, "--offline", "--out", "x.nbt"], c.io)).toBe(1);
      expect(c.err.join("\n")).toContain(text);
      expect(c.out).toEqual([]);
    }
    const j = capture();
    expect(
      await runSkillCli(["build", "empty.ts", "--offline", "--out", "x.nbt", "--json"], j.io),
    ).toBe(1);
    expect(JSON.parse(j.out.join("\n"))).toMatchObject({ ok: false, error: /placed no blocks/ });
    expect(existsSync(join(root, "x.nbt"))).toBe(false);
  });

  it("treats bad command lines as usage errors (exit code 2)", async () => {
    for (const [args, text] of [
      [["build", "hut.ts"], "--out <path> is required"],
      [["build", "--out", "a.nbt"], "exactly one recipe"],
      [["build", "hut.ts", "--out", "a.nbt", "--bogus"], "Unknown option '--bogus'"],
      [["build", "hut.ts", "--out", "a.nbt", "--air", "some"], "--air must be"],
      [["build", "hut.ts", "--out", "a.schem", "--schem-version", "4"], "--schem-version must be"],
      [
        ["build", "hut.ts", "--out", "a.nbt", "--registry", "nope.json"],
        "--registry: no such file",
      ],
      [["build", "hut.ts", "--out", "a.nbt", "--offline", "--mc-version", "9.9"], "--data-version"],
      [["inspect"], "exactly one file"],
      [["inspect", "a.txt"], "cannot inspect"],
      [["frobnicate"], "unknown command 'frobnicate'"],
      [[], "Usage: voxwright-cli <command>"],
    ] as const) {
      const c = capture();
      expect(await runSkillCli([...args], c.io), args.join(" ")).toBe(2);
      expect(c.err.join("\n"), args.join(" ")).toContain(text);
    }
    expect(existsSync(join(root, "a.nbt"))).toBe(false);
  });

  it("runs the run-directory commands through the same program", async () => {
    const c = capture();
    expect(await runSkillCli(["init", "starter/house.ts"], c.io)).toBe(0);
    expect(existsSync(join(root, "starter/house.ts"))).toBe(true);
    const bad = capture();
    expect(await runSkillCli(["assets", "fetch", "--version", "26.2", "--from", "x"], bad.io)).toBe(
      1,
    );
    expect(bad.err.join("\n")).toContain("--from must be mcasset or mojang");
    const help = capture();
    expect(await runSkillCli(["--help"], help.io)).toBe(0);
    for (const word of ["init", "check", "run", "import", "diff", "assets fetch"]) {
      expect(help.out.join("\n")).toContain(word);
    }
  });

  it("takes the version and the allowlist from a mcbuild.toml next to the recipe", async () => {
    await mkdir(join(root, "modded"), { recursive: true });
    await writeFile(join(root, "modded/mcbuild.toml"), 'allowlist = ["mymod:gizmo"]\n');
    await recipe(
      "modded/g.ts",
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build();
BUILD.scope(() => BUILD.set(0, 0, 0, "mymod:gizmo"));
`,
    );
    const c = capture();
    const code = await runSkillCli(
      ["build", "modded/g.ts", "--registry", registryFile, "--out", "modded/g.schem"],
      c.io,
    );
    expect(code).toBe(0);
    expect(c.out.join("\n")).toContain("mymod:gizmo is allowlisted");
  });

  it("writes the DataVersion given for a version it does not know", async () => {
    const c = capture();
    const code = await runSkillCli(
      ["build", "hut.ts", "--offline", "--mc-version", "9.9", "--data-version", "5000"].concat([
        "--out",
        "dv/hut.nbt",
      ]),
      c.io,
    );
    expect(code).toBe(0);
    const nbt = await readStructureNbt(new Uint8Array(await readFile(join(root, "dv/hut.nbt"))));
    expect(nbt.meta.dataVersion).toBe(5000);
  });

  it("prints help and the version", async () => {
    for (const args of [
      ["--help"],
      ["build", "--help"],
      ["inspect", "-h"],
      ["preview", "--help"],
    ]) {
      const c = capture();
      expect(await runSkillCli(args, c.io)).toBe(0);
      expect(c.out.join("\n")).toContain("Usage: voxwright-cli");
      expect(c.err).toEqual([]);
    }
    const v = capture();
    expect(await runSkillCli(["--version"], v.io)).toBe(0);
    expect(v.out[0]).toMatch(/^voxwright-cli \S+$/);
  });
});

describe("inspect", () => {
  it("reports a Sponge schematic", async () => {
    const c = capture();
    const file = join(repo, "fixtures/synthetic/v2-small.schem");
    expect(await runSkillCli(["inspect", file], c.io)).toBe(0);
    const text = c.out.join("\n");
    expect(text).toContain(`file: ${file}`);
    expect(text).toContain("format: schem (version 2)");
    expect(text).toContain("minecraft: DataVersion 4903 (26.2)");
    expect(text).toContain("size: 4×3×5 (X×Y×Z)");
    expect(text).toContain("block entities: 1");
    expect(text).toContain("offset: -1,0,2");
    expect(text).toContain("minecraft:stone");
  });

  it("gives the same block count for one build in three formats", async () => {
    const reports = [];
    for (const ext of ["litematic", "nbt", "mcstructure"]) {
      const c = capture();
      const file = join(repo, `fixtures/real/rafeals-house/Rafeals_house.${ext}`);
      expect(await runSkillCli(["inspect", file, "--json"], c.io)).toBe(0);
      reports.push(JSON.parse(c.out.join("\n")));
    }
    const [lit, nbt, bedrock] = reports;
    expect(lit.format).toBe("litematic");
    expect(lit.metadata.regions).toBe(1);
    expect(bedrock.dataVersion).toBeNull();
    expect(lit.blocks).toBeGreaterThan(0);
    expect(nbt.blocks).toBe(lit.blocks);
    expect(bedrock.blocks).toBe(lit.blocks);
    expect(lit.blockStates).toBe(lit.palette.length);
  });

  it("fails cleanly on a missing or unreadable file", async () => {
    const c = capture();
    expect(await runSkillCli(["inspect", "nope.schem"], c.io)).toBe(1);
    expect(c.err.join("\n")).toContain("no such file");
    await writeFile(join(root, "junk.litematic"), "not a schematic");
    const j = capture();
    expect(await runSkillCli(["inspect", "junk.litematic"], j.io)).toBe(1);
    expect(j.err.join("\n")).toContain("is not a readable litematic file");
  });
});

// The committed bundle, run the way an installed skill runs it: from a directory outside the
// repository, with no node_modules to resolve anything from.
describe("skills/voxwright/scripts/voxwright-cli.mjs", () => {
  let outside: string;
  const cli = (args: string[], cwd = outside) =>
    run(process.execPath, [BUNDLE, ...args], { cwd, env: { ...process.env, HOME: outside } }).then(
      (r) => ({ code: 0, ...r }),
      (e: { code: number; stdout: string; stderr: string }) => e,
    );

  beforeAll(async () => {
    outside = await mkdtemp(join(tmpdir(), "voxwright-skill-"));
    await writeFile(join(outside, "registry.json"), JSON.stringify(REGISTRY));
  });
  afterAll(() => rm(outside, { recursive: true, force: true }));

  it("builds a recipe that imports from 'voxwright', and inspects the result", async () => {
    await writeFile(join(outside, "hut.ts"), hut("voxwright"));
    const built = await cli([
      "build",
      "hut.ts",
      "--registry",
      "registry.json",
      "--out",
      "hut.schem",
    ]);
    expect(built.stderr).toBe("");
    expect(built.code).toBe(0);
    expect(built.stdout).toContain("build: OK");
    expect(built.stdout).toContain(`blocks: ${HUT_BLOCKS}`);
    const seen = await cli(["inspect", "hut.schem", "--json"]);
    expect(JSON.parse(seen.stdout)).toMatchObject({ format: "schem", blocks: HUT_BLOCKS });
  });

  it("resolves the workspace package names and plain JavaScript recipes too", async () => {
    await writeFile(
      join(outside, "parts.mjs"),
      `import { rotateBlockstate } from "@voxwright/core";
import { Build, shapes } from "@voxwright/mcbuilder";
export default new Build();
const stair = rotateBlockstate("minecraft:spruce_stairs[facing=north]", "CLOCKWISE_90");
export const BUILD = new Build();
BUILD.scope(() => {
  BUILD.place(shapes.box([0, 0, 0], [1, 0, 1], "minecraft:stone"), { at: [0, 0, 0] });
  BUILD.set(0, 1, 0, stair);
});
`,
    );
    const built = await cli([
      "build",
      "parts.mjs",
      "--registry",
      "registry.json",
      "--out",
      "parts.nbt",
      "--json",
    ]);
    expect(built.code).toBe(0);
    expect(JSON.parse(built.stdout).palette).toContainEqual({
      state: "minecraft:spruce_stairs[facing=east]",
      count: 1,
    });
  });

  it("runs an example of this repository, which imports the engine by path", async () => {
    const built = await cli([
      "build",
      join(repo, "packages/mcbuilder/examples/homestead/well.ts"),
      "--offline",
      "--out",
      "well.litematic",
    ]);
    expect(built.stderr).toBe("");
    expect(built.code).toBe(0);
    expect(built.stdout).toContain("validation: skipped");
    expect(existsSync(join(outside, "well.litematic"))).toBe(true);
  });

  it("points at the line of a recipe that throws", async () => {
    await writeFile(
      join(outside, "throws.ts"),
      `import { Build } from "voxwright";
export const BUILD = new Build();
BUILD.scope(() => {
  BUILD.set(0.5, 0, 0, "minecraft:stone");
});
`,
    );
    const r = await cli(["build", "throws.ts", "--offline", "--out", "t.nbt"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("error in throws.ts: voxel coordinates must be ints, got 0.5");
    expect(r.stderr).toContain("(at throws.ts:4:");
  });

  it("builds every complete recipe printed in references/", async () => {
    // Validated against the real 26.2 registry where this machine has it (CI fetches it).
    const real = join(homedir(), ".cache/mcbuilder/26.2/minecraft-data.json");
    const registry = existsSync(real) ? ["--registry", real] : ["--offline"];
    let n = 0;
    for (const doc of ["recipe-examples.md", "builder-api.md"]) {
      const text = await readFile(join(repo, "skills/voxwright/references", doc), "utf8");
      for (const [, source] of text.matchAll(
        /```ts\n((?:\/\/ recipe: \S+\n)?import [\s\S]*?)```/g,
      )) {
        const file = `doc-${n++}.ts`;
        await writeFile(join(outside, file), source as string);
        const built = await cli(["build", file, ...registry, "--out", `${file}.schem`, "--json"]);
        expect(built.stderr, `${doc}: ${file}`).toBe("");
        const summary = JSON.parse(built.stdout);
        expect(summary.validation.errors, `${doc}: ${file}`).toEqual([]);
        expect(summary.ok, `${doc}: ${file}`).toBe(true);
      }
    }
    expect(n).toBe(5);
  });

  it("is what scripts/build-skill.ts produces from the current sources", async () => {
    const r = await run(process.execPath, [join(repo, "scripts/build-skill.ts"), "--check"]).then(
      (ok) => ({ code: 0, ...ok }),
      (e: { code: number; stdout: string; stderr: string }) => e,
    );
    expect(r.stderr).toBe("");
    expect(r.code).toBe(0);
  });
});
