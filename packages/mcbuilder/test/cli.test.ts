// SPDX-License-Identifier: AGPL-3.0-only
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readStructureNbt } from "@voxwright/core";
import { decodePng } from "@voxwright/render/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HOUSE_TEMPLATE, runCli, scanDeterminism } from "../src/node/index.ts";

const base = fileURLToPath(new URL("./.tmp/", import.meta.url));
let root: string;
let home: string;

// A registry that knows the blocks the starter house uses.
const dirs = ["north", "south", "west", "east"];
const stairs = {
  facing: dirs,
  half: ["top", "bottom"],
  shape: ["straight", "inner_left", "inner_right", "outer_left", "outer_right"],
  waterlogged: ["true", "false"],
};
const REGISTRY = {
  version: "26.2",
  layout: "pc/26.2",
  blocks: {
    "minecraft:cobblestone": { properties: {} },
    "minecraft:oak_planks": { properties: {} },
    "minecraft:stripped_oak_wood": { properties: { axis: ["x", "y", "z"] } },
    "minecraft:oak_log": { properties: { axis: ["x", "y", "z"] } },
    "minecraft:glass_pane": {
      properties: {
        east: ["true", "false"],
        north: ["true", "false"],
        south: ["true", "false"],
        west: ["true", "false"],
        waterlogged: ["true", "false"],
      },
    },
    "minecraft:oak_door": {
      properties: {
        facing: dirs,
        half: ["upper", "lower"],
        hinge: ["left", "right"],
        open: ["true", "false"],
        powered: ["true", "false"],
      },
    },
    "minecraft:spruce_stairs": { properties: stairs },
    "minecraft:dark_oak_stairs": { properties: stairs },
    "minecraft:stone": { properties: {} },
  },
};

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l), cwd: root, home },
  };
}

beforeAll(async () => {
  await mkdir(base, { recursive: true });
  root = await mkdtemp(join(base, "cli-"));
  home = join(root, "home");
  await mkdir(join(home, ".cache/mcbuilder/26.2"), { recursive: true });
  await writeFile(
    join(home, ".cache/mcbuilder/26.2/minecraft-data.json"),
    JSON.stringify(REGISTRY),
  );
});
afterAll(() => rm(root, { recursive: true, force: true }));

describe("mcbuild init, check and run", () => {
  it("scaffolds a house, checks it and exports it", async () => {
    const c = capture();
    expect(await runCli(["init", "proj/"], c.io)).toBe(0);
    const script = join(root, "proj/house.ts");
    expect(await readFile(script, "utf8")).toBe(HOUSE_TEMPLATE);
    expect(c.out[0]).toBe("wrote proj/house.ts");

    const check = capture();
    expect(await runCli(["check", script], check.io)).toBe(0);
    expect(check.out[0]).toMatch(
      /^house\.ts — OK \(\d+ blocks, \d+ types, 0 errors, 0 warnings\)$/,
    );

    const run = capture();
    expect(await runCli(["run", script, "--out", join(root, "dist")], run.io)).toBe(0);
    const dir = join(root, "dist/run-001");
    expect(run.out[0]).toBe(`run dir: ${dir}`);
    expect(run.out.join("\n")).toContain("artifact: house.nbt (nbt, DataVersion 4903)");

    const report = JSON.parse(await readFile(join(dir, "report.json"), "utf8"));
    expect(report.errors).toEqual([]);
    expect(report.artifacts).toEqual([{ file: "house.nbt", format: "nbt", data_version: 4903 }]);
    expect(report.dimensions).toEqual({ x: 9, y: 9, z: 7 });
    expect(
      Object.values(report.block_counts as Record<string, number>).reduce((a, b) => a + b, 0),
    ).toBe(165);

    const nbt = await readStructureNbt(new Uint8Array(await readFile(join(dir, "house.nbt"))));
    expect(nbt.meta.dataVersion).toBe(4903);
    expect(nbt.volume.size).toBe(
      Object.values(report.block_counts as Record<string, number>).reduce((a, b) => a + b, 0),
    );

    // A second run gets its own directory.
    expect(await runCli(["run", script, "--out", join(root, "dist")], capture().io)).toBe(0);
    expect(
      JSON.parse(await readFile(join(root, "dist/run-002/report.json"), "utf8")).run_dir,
    ).toContain("run-002");
  });

  it("refuses to overwrite without --force", async () => {
    const c = capture();
    expect(await runCli(["init", "proj/house.ts"], c.io)).toBe(1);
    expect(c.err[0]).toContain("refusing to overwrite");
    expect(await runCli(["init", "proj/house.ts", "--force"], capture().io)).toBe(0);
  });

  it("reports unknown blocks with suggestions and exports nothing", async () => {
    const script = join(root, "bad.ts");
    await writeFile(
      script,
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build({ seed: 1 });
BUILD.scope(() => {
  BUILD.set(0, 0, 0, "minecraft:ston");
  BUILD.set(1, 0, 0, "minecraft:stone[bogus=1]");
  BUILD.set(2, 0, 0, Math.random() > 2 ? "minecraft:stone" : "minecraft:stone");
});
`,
    );
    const check = capture();
    expect(await runCli(["check", script], check.io)).toBe(1);
    expect(check.out[0]).toContain("FAILED");
    expect(check.out.join("\n")).toContain("did you mean minecraft:stone?");
    expect(check.out.join("\n")).toContain("uses 'Math.random'");

    const run = capture();
    expect(await runCli(["run", script, "--out", join(root, "dist-bad")], run.io)).toBe(1);
    const report = JSON.parse(await readFile(join(root, "dist-bad/run-001/report.json"), "utf8"));
    expect(report.errors).toHaveLength(2);
    expect(report.artifacts).toEqual([]);
  });

  it("fails cleanly on a missing registry, a script without BUILD and an unknown command", async () => {
    const noReg = capture();
    noReg.io.home = join(root, "empty-home");
    expect(await runCli(["check", join(root, "proj/house.ts")], noReg.io)).toBe(1);
    expect(noReg.err[0]).toContain("run `mcbuild assets fetch --version 26.2` first");

    const empty = join(root, "nobuild.ts");
    await writeFile(empty, "export const x = 1;\n");
    const c = capture();
    expect(await runCli(["check", empty], c.io)).toBe(1);
    expect(c.err[0]).toContain("must export a Build as BUILD");

    const missing = capture();
    expect(await runCli(["check", join(root, "nope.ts")], missing.io)).toBe(1);
    const unknown = capture();
    expect(await runCli(["frobnicate"], unknown.io)).toBe(2);
    expect(await runCli(["guide", "a"], capture().io)).toBe(2);
    expect(await runCli([], capture().io)).toBe(2);
  });

  it("writes faithful previews and lists them in the report", async () => {
    const script = join(root, "tiny.ts");
    await writeFile(
      script,
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build({ seed: 1, views: "iso;top" });
BUILD.scope(() => BUILD.box([0, 0, 0], [1, 1, 1], "minecraft:stone"));
`,
    );
    const c = capture();
    expect(await runCli(["run", script, "--out", join(root, "dist-prev"), "--preview"], c.io)).toBe(
      0,
    );
    const dir = join(root, "dist-prev/run-001");
    expect(c.out.join("\n")).toContain("faithful previews: 2 in previews_faithful/");
    // No vanilla assets in this test home, so the renderer says so and draws fallback cubes.
    expect(c.out.join("\n")).toContain("vanilla client assets not found");
    const report = JSON.parse(await readFile(join(dir, "report.json"), "utf8"));
    expect(report.views.map((v: { file: string }) => v.file)).toEqual([
      "previews_faithful/iso.png",
      "previews_faithful/top.png",
    ]);
    expect(report.views[0]).toMatchObject({
      label: "iso",
      azimuth: 45,
      elevation: 35,
      directions_untrusted: false,
      directions_trusted: true,
    });
    const png = decodePng(new Uint8Array(await readFile(join(dir, "previews_faithful/iso.png"))));
    expect(Math.max(png.width, png.height)).toBe(2048);
  });

  it("takes --views, --count and --focus, and rejects what it cannot do", async () => {
    const script = join(root, "tiny.ts");
    const c = capture();
    expect(
      await runCli(
        [
          "run",
          script,
          "--out",
          join(root, "dist-views"),
          "--preview",
          "--views",
          "top",
          "--focus",
          "0,0,0:0,0,0",
        ],
        c.io,
      ),
    ).toBe(0);
    const report = JSON.parse(await readFile(join(root, "dist-views/run-001/report.json"), "utf8"));
    expect(report.views.map((v: { label: string }) => v.label)).toEqual(["top"]);

    for (const [args, message] of [
      [["--preview", "--views", "bogus"], "invalid views"],
      [["--preview", "--focus", "1,2:3"], "--focus must look like"],
      [["--preview", "--focus", "50,50,50:60,60,60"], "no blocks inside that box"],
      [["--tier", "fast"], "not ported yet"],
      [["--tier", "nope"], "--tier must be"],
      [["--guide"], "--guide is not ported yet"],
    ] as const) {
      const e = capture();
      expect(
        await runCli(["run", script, "--out", join(root, "dist-bad2"), ...args], e.io),
        args.join(" "),
      ).toBe(1);
      expect(e.err.join("\n"), args.join(" ")).toContain(message);
    }
  });

  it("reads mcbuild.toml next to the script", async () => {
    const dir = join(root, "withcfg");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "mcbuild.toml"),
      `mc_version = "1.21.4"\nallowlist = ["lostqol:waystone"]\n`,
    );
    await writeFile(
      join(dir, "s.ts"),
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build();
BUILD.scope(() => BUILD.set(0, 0, 0, "lostqol:waystone"));
`,
    );
    const c = capture();
    expect(await runCli(["check", join(dir, "s.ts")], c.io)).toBe(1); // no 1.21.4 registry cached
    expect(c.err[0]).toContain("version '1.21.4'");
  });
});

describe("mcbuild import", () => {
  it("turns a real file into a script that rebuilds it", async () => {
    const src = fileURLToPath(
      new URL("../../../fixtures/real/rafeals-house/Rafeals_house.litematic", import.meta.url),
    );
    const out = join(root, "imported.ts");
    const c = capture();
    expect(await runCli(["import", src, "-o", out, "--raw"], c.io)).toBe(0);
    expect(c.out[0]).toBe(`wrote ${out}`);
    expect(c.out.join("\n")).toContain("762 blocks");
    const script = await readFile(out, "utf8");
    expect(script).toContain("BUILD.scope(() => {");

    expect(await runCli(["import", src, "-o", out, "--raw"], capture().io)).toBe(1);

    const run = capture();
    expect(
      await runCli(["run", out, "--out", join(root, "dist-import"), "--air", "none"], run.io),
    ).toBe(1); // blocks missing from the tiny test registry
    const report = JSON.parse(
      await readFile(join(root, "dist-import/run-001/report.json"), "utf8"),
    );
    expect(
      Object.values(report.block_counts as Record<string, number>).reduce((a, b) => a + b, 0),
    ).toBe(762);
  });

  it("rejects unknown file types", async () => {
    const f = join(root, "x.txt");
    await writeFile(f, "hello");
    const c = capture();
    expect(await runCli(["import", f], c.io)).toBe(1);
    expect(c.err[0]).toContain("unsupported file type");
  });
});

describe("determinism scan", () => {
  it("flags time and randomness, and passes clean scripts", () => {
    expect(scanDeterminism("const a = 1;", "s.ts")).toEqual([]);
    expect(scanDeterminism("Date.now()", "s.ts")).toHaveLength(1);
    expect(scanDeterminism("crypto.randomUUID(); Math.random()", "s.ts")).toHaveLength(2);
  });
});
