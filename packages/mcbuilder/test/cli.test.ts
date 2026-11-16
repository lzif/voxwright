// SPDX-License-Identifier: AGPL-3.0-only
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readStructureNbt, Volume, writeStructureNbt } from "@voxwright/core";
import { createCanvas } from "@voxwright/render";
import { decodePng, encodePng } from "@voxwright/render/node";
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
    "minecraft:iron_chain": {
      properties: { axis: ["x", "y", "z"], waterlogged: ["true", "false"] },
    },
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

  it("refuses to overwrite without --force, creates parents and rejects directories", async () => {
    const c = capture();
    expect(await runCli(["init", "proj/house.ts"], c.io)).toBe(1);
    expect(c.err[0]).toContain("refusing to overwrite");
    expect(await runCli(["init", "proj/house.ts", "--force"], capture().io)).toBe(0);

    // Default target in cwd (`house.ts`).
    const cwdDir = join(root, "init-default");
    await mkdir(cwdDir, { recursive: true });
    const def = capture();
    def.io.cwd = cwdDir;
    expect(await runCli(["init"], def.io)).toBe(0);
    expect(def.out.join("\n")).toContain("next: mcbuild check house.ts");
    expect(await readFile(join(cwdDir, "house.ts"), "utf8")).toBe(HOUSE_TEMPLATE);

    // Custom nested path creates parent directories.
    const nested = capture();
    expect(await runCli(["init", "sub/dir/cabin.ts"], nested.io)).toBe(0);
    expect(await readFile(join(root, "sub/dir/cabin.ts"), "utf8")).toBe(HOUSE_TEMPLATE);

    // Directory target without trailing slash is rejected.
    const dirErr = capture();
    expect(await runCli(["init", cwdDir], dirErr.io)).toBe(1);
    expect(dirErr.err[0]).toContain("not a file");
  });

  it("reports unknown blocks with suggestions and provenance, and exports nothing", async () => {
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
    expect(check.out.join("\n")).toContain("(at bad.ts:4:");
    expect(check.out.join("\n")).toContain("uses 'Math.random'");

    const run = capture();
    expect(
      await runCli(["run", script, "--out", join(root, "dist-bad"), "--preview"], run.io),
    ).toBe(1);
    const report = JSON.parse(await readFile(join(root, "dist-bad/run-001/report.json"), "utf8"));
    expect(report.errors).toHaveLength(2);
    expect(report.errors[0].at).toMatch(/^bad\.ts:4:/);
    expect(report.artifacts).toEqual([]);
    expect(report.views).toEqual([]);
  });

  it("reports runtime errors, out-of-scope placements and DSL misuse with recipe line numbers", async () => {
    const broken = join(root, "broken.ts");
    await writeFile(
      broken,
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build({ seed: 1 });
BUILD.scope(() => {
  // @ts-expect-error deliberate undefined variable
  BUILD.set(0, 0, 0, undefined_name);
});
`,
    );
    const cBroken = capture();
    expect(await runCli(["check", broken], cBroken.io)).toBe(1);
    expect(cBroken.err[0]).toContain("undefined_name is not defined");
    expect(cBroken.err[0]).toMatch(/\(at broken\.ts:5:\d+\)/);

    const outside = join(root, "scope.ts");
    await writeFile(
      outside,
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build({ seed: 1 });
BUILD.set(0, 0, 0, "minecraft:stone");
`,
    );
    const cOutside = capture();
    expect(await runCli(["check", outside], cOutside.io)).toBe(1);
    expect(cOutside.err[0]).toContain("placements must be inside `build.scope(...)`");
    expect(cOutside.err[0]).toMatch(/\(at scope\.ts:3:\d+\)/);

    const ridge = join(root, "ridge.ts");
    await writeFile(
      ridge,
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build({ seed: 1 });
BUILD.scope(() => {
  // @ts-expect-error deliberate invalid ridge axis
  BUILD.roofGable([0, 0, 0], [4, 0, 4], "minecraft:spruce_stairs", { ridge: "y" });
});
`,
    );
    const cRidge = capture();
    expect(await runCli(["check", ridge], cRidge.io)).toBe(1);
    expect(cRidge.err[0]).toContain("ridge must be 'x' or 'z'");
    expect(cRidge.err[0]).toMatch(/\(at ridge\.ts:5:\d+\)/);
  });

  it("ignores overwritten phantom palette entries and records overwrite counts in run", async () => {
    const phantom = join(root, "phantom.ts");
    await writeFile(
      phantom,
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build({ seed: 1 });
BUILD.scope(() => {
  BUILD.set(0, 0, 0, "minecraft:oak_log_typo");
  BUILD.set(0, 0, 0, "minecraft:stone");
});
`,
    );
    const check = capture();
    expect(await runCli(["check", phantom], check.io)).toBe(0);
    expect(check.out[0]).toContain("0 errors");
    expect(check.out.join("\n")).not.toContain("oak_log_typo");

    const run = capture();
    expect(await runCli(["run", phantom, "--out", join(root, "dist-ow")], run.io)).toBe(0);
    expect(run.out.join("\n")).toContain("1 placements overwritten");
    const report = JSON.parse(await readFile(join(root, "dist-ow/run-001/report.json"), "utf8"));
    expect(report.overwritten_placements).toBe(1);
  });

  it("fails cleanly on a missing registry, a script without BUILD and an unknown command", async () => {
    const noReg = capture();
    noReg.io.home = join(root, "empty-home");
    expect(await runCli(["check", join(root, "proj/house.ts"), "--offline"], noReg.io)).toBe(1);
    expect(noReg.err[0]).toContain("run `mcbuild assets fetch --version 26.2` first");

    // Without --offline it tries the download first, and says why that failed.
    const down = capture();
    down.io.home = join(root, "empty-home");
    const calls: string[] = [];
    expect(
      await runCli(["check", join(root, "proj/house.ts")], down.io, {
        get: async (url) => {
          calls.push(url);
          return { status: 503, body: new Uint8Array() };
        },
      }),
    ).toBe(1);
    expect(calls[0]).toContain("minecraft-data");
    expect(down.out[0]).toContain("downloading the block registry for 26.2");
    expect(down.err[0]).toContain("could not download the block registry");

    const help = capture();
    expect(await runCli(["run", "--help"], help.io)).toBe(0);
    expect(help.out[0]).toContain("Usage: mcbuild run <script>");
    expect(help.out.join("\n")).toContain("--preview");

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
    expect(
      await runCli(
        ["run", script, "--out", join(root, "dist-prev"), "--preview", "--offline"],
        c.io,
      ),
    ).toBe(0);
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

  it("tries to download the assets for a preview, and falls back to cubes when it cannot", async () => {
    const script = join(root, "tiny.ts");
    const c = capture();
    const calls: string[] = [];
    const code = await runCli(
      ["run", script, "--out", join(root, "dist-auto"), "--preview", "--views", "top"],
      c.io,
      {
        get: async (url) => {
          calls.push(url);
          return { status: 503, body: new Uint8Array() };
        },
      },
    );
    expect(code).toBe(0);
    expect(calls[0]).toContain("InventivetalentDev/minecraft-assets/26.2/");
    const out = c.out.join("\n");
    expect(out).toContain("downloading the vanilla assets for 26.2");
    expect(out).toContain("vanilla client assets not found");
    expect(out).toContain("download failed");
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
          "--offline",
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

    // `--count 4` appends a 4-view orbit to the script's 2 views (`iso;top` -> 6 views).
    const countRun = capture();
    expect(
      await runCli(
        [
          "run",
          script,
          "--out",
          join(root, "dist-count"),
          "--preview",
          "--offline",
          "--count",
          "4",
        ],
        countRun.io,
      ),
    ).toBe(0);
    const countReport = JSON.parse(
      await readFile(join(root, "dist-count/run-001/report.json"), "utf8"),
    );
    expect(countReport.views).toHaveLength(6);

    // When `client/assets/minecraft/blockstates` exists on disk, missing block models warn per block type.
    const partialHome = join(root, "partial-assets-home");
    await mkdir(join(partialHome, ".cache/mcbuilder/26.2/client/assets/minecraft/blockstates"), {
      recursive: true,
    });
    await writeFile(
      join(partialHome, ".cache/mcbuilder/26.2/minecraft-data.json"),
      JSON.stringify(REGISTRY),
    );
    const fallbackRun = capture();
    fallbackRun.io.home = partialHome;
    expect(
      await runCli(
        [
          "run",
          script,
          "--out",
          join(root, "dist-fallback-warn"),
          "--preview",
          "--offline",
          "--views",
          "top",
        ],
        fallbackRun.io,
      ),
    ).toBe(0);
    const fallbackReport = JSON.parse(
      await readFile(join(root, "dist-fallback-warn/run-001/report.json"), "utf8"),
    );
    expect(
      fallbackReport.warnings.some((w: { message: string }) =>
        w.message.includes("`minecraft:stone` rendered as magenta fallback cube"),
      ),
    ).toBe(true);

    for (const [args, message] of [
      [["--preview", "--offline", "--views", "bogus"], "invalid views"],
      [["--preview", "--offline", "--views", "iso@bad"], "invalid views"],
      [["--preview", "--offline", "--focus", "1,2:3"], "--focus must look like"],
      [["--preview", "--offline", "--focus", "50,50,50:60,60,60"], "no blocks inside that box"],
      [["--tier", "fast"], "not ported yet"],
      [["--tier", "nope"], "--tier must be"],
    ] as const) {
      const e = capture();
      expect(
        await runCli(["run", script, "--out", join(root, "dist-bad2"), ...args], e.io),
        args.join(" "),
      ).toBe(1);
      expect(e.err.join("\n"), args.join(" ")).toContain(message);
    }
  });

  it("supports close-up focus views via --views and in report.json", async () => {
    const wide = join(root, "wide-focus.ts");
    await writeFile(
      wide,
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build({ seed: 1 });
BUILD.scope(() => {
  BUILD.box([0, 0, 0], [10, 0, 10], "minecraft:stone");
  BUILD.set(9, 1, 9, "minecraft:cobblestone");
});
`,
    );
    const c = capture();
    expect(
      await runCli(
        [
          "run",
          wide,
          "--out",
          join(root, "dist-closeup"),
          "--preview",
          "--offline",
          "--guide",
          "--views",
          "iso;iso@9,1,9r1;az225_el025@10,1,10:8,0,8;iso@50,50,50r2;iso@50,50,50:60,60,60",
        ],
        c.io,
      ),
    ).toBe(0);
    const dir = join(root, "dist-closeup/run-001");
    const report = JSON.parse(await readFile(join(dir, "report.json"), "utf8"));
    expect(report.views.map((v: { file: string }) => v.file)).toEqual([
      "previews_faithful/iso.png",
      "previews_faithful/iso@9,1,9r1.png",
      "previews_faithful/az225_el025@8,0,8:10,1,10.png",
      "previews_faithful/iso@50,50,50r2.png",
      "previews_faithful/iso@50,50,50:60,60,60.png",
    ]);
    expect("focus" in report.views[0]).toBe(false);
    expect(report.views[1].focus).toEqual({ center: [9, 1, 9], radius: 1 });
    expect(report.views[2].focus).toEqual({ min: [8, 0, 8], max: [10, 1, 10] });
    expect(
      report.warnings.some((w: { message: string }) =>
        w.message.includes("`iso@50,50,50r2` focus region contains no blocks"),
      ),
    ).toBe(true);
    expect(
      report.warnings.some((w: { message: string }) =>
        w.message.includes("`iso@50,50,50:60,60,60` focus region contains no blocks"),
      ),
    ).toBe(true);

    const wholePng = await readFile(join(dir, "previews_faithful/iso.png"));
    const closePng = await readFile(join(dir, "previews_faithful/iso@9,1,9r1.png"));
    expect(closePng.equals(wholePng)).toBe(false);

    // Build guide prefers an unfocused view over a close-up when `iso` is absent.
    const guideRun = capture();
    expect(
      await runCli(
        [
          "run",
          wide,
          "--out",
          join(root, "dist-closeup-guide"),
          "--preview",
          "--offline",
          "--guide",
          "--views",
          "iso@9,1,9r1;az135_el025",
        ],
        guideRun.io,
      ),
    ).toBe(0);
    expect(
      await readFile(join(root, "dist-closeup-guide/run-001/guide/guide.md"), "utf8"),
    ).toContain("![Wide-Focus](../previews_faithful/az135_el025.png)");
  });

  it("writes a build guide with --guide, and covers it with the iso preview when there is one", async () => {
    const script = join(root, "tiny.ts");
    const c = capture();
    expect(await runCli(["run", script, "--out", join(root, "dist-guide"), "--guide"], c.io)).toBe(
      0,
    );
    const dir = join(root, "dist-guide/run-001");
    expect(c.out.join("\n")).toContain("guide: guide/guide.md");
    const md = await readFile(join(dir, "guide/guide.md"), "utf8");
    expect(md).toContain("# Tiny");
    expect(md).toContain("Size: **2 × 2 × 2**");
    expect(md).toContain("| stone | 8 | 8 |");
    expect(md).not.toContain("![Tiny]");
    expect(
      decodePng(new Uint8Array(await readFile(join(dir, "guide/layer-01.png")))).width,
    ).toBeGreaterThanOrEqual(720);
    const report = JSON.parse(await readFile(join(dir, "report.json"), "utf8"));
    expect(report.artifacts.map((a: { format: string }) => a.format)).toEqual(["nbt", "guide"]);

    const withIso = capture();
    expect(
      await runCli(
        [
          "run",
          script,
          "--out",
          join(root, "dist-guide2"),
          "--preview",
          "--offline",
          "--views",
          "iso",
          "--guide",
        ],
        withIso.io,
      ),
    ).toBe(0);
    expect(await readFile(join(root, "dist-guide2/run-001/guide/guide.md"), "utf8")).toContain(
      "![Tiny](../previews_faithful/iso.png)",
    );

    // Without `iso`, pick the first non-top view; if only `top` exists, fall back to it.
    const withAz = capture();
    expect(
      await runCli(
        [
          "run",
          script,
          "--out",
          join(root, "dist-guide3"),
          "--preview",
          "--offline",
          "--views",
          "top;az135_el025",
          "--guide",
        ],
        withAz.io,
      ),
    ).toBe(0);
    expect(await readFile(join(root, "dist-guide3/run-001/guide/guide.md"), "utf8")).toContain(
      "![Tiny](../previews_faithful/az135_el025.png)",
    );

    const withTopOnly = capture();
    expect(
      await runCli(
        [
          "run",
          script,
          "--out",
          join(root, "dist-guide4"),
          "--preview",
          "--offline",
          "--views",
          "top",
          "--guide",
        ],
        withTopOnly.io,
      ),
    ).toBe(0);
    expect(await readFile(join(root, "dist-guide4/run-001/guide/guide.md"), "utf8")).toContain(
      "![Tiny](../previews_faithful/top.png)",
    );
  });

  it("reads mcbuild.toml next to the script, honours allowlist and rejects bad --config", async () => {
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
    expect(await runCli(["check", join(dir, "s.ts"), "--offline"], c.io)).toBe(1); // no 1.21.4 registry cached
    expect(c.err[0]).toContain("version '1.21.4'");

    // With 26.2 (cached in `home`), the allowlisted block passes with an unvalidated warning.
    await writeFile(
      join(dir, "mcbuild.toml"),
      `mc_version = "26.2"\nallowlist = ["lostqol:waystone"]\n`,
    );
    const allow = capture();
    expect(await runCli(["check", join(dir, "s.ts"), "--offline"], allow.io)).toBe(0);
    expect(allow.out.join("\n")).toContain("is allowlisted: unvalidated");

    // Missing explicit --config is a clean error.
    const missingCfg = capture();
    expect(
      await runCli(["check", join(dir, "s.ts"), "--config", join(dir, "nope.toml")], missingCfg.io),
    ).toBe(1);
    expect(missingCfg.err[0]).toContain("config not found");

    // Malformed mcbuild.toml is a clean error.
    await writeFile(join(dir, "mcbuild.toml"), "not valid toml ===\n");
    const badCfg = capture();
    expect(await runCli(["check", join(dir, "s.ts")], badCfg.io)).toBe(1);
    expect(badCfg.err[0]).toContain("invalid mcbuild.toml");
  });

  it("fetches assets and reports clean errors on bad flags or network failure", async () => {
    const help = capture();
    expect(await runCli(["assets", "fetch", "--help"], help.io)).toBe(0);
    expect(help.out[0]).toContain("Usage: mcbuild assets fetch --version V");

    for (const [args, want] of [
      [["assets"], "assets: expected `fetch`"],
      [["assets", "fetch"], "--version is required"],
      [["assets", "fetch", "--version", "26.2", "--from", "bogus"], "--from must be"],
    ] as const) {
      const e = capture();
      expect(await runCli([...args], e.io)).toBe(1);
      expect(e.err[0]).toContain(want);
    }

    const fail = capture();
    expect(
      await runCli(["assets", "fetch", "--version", "26.2"], fail.io, {
        get: async () => ({ status: 503, body: new Uint8Array() }),
      }),
    ).toBe(1);
    expect(fail.err[0]).toContain("assets fetch failed");

    const enc = (s: string) => new TextEncoder().encode(s);
    const raw = "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/26.2";
    const mc = `${raw}/assets/minecraft`;
    const json = (v: unknown) => ({ status: 200, body: enc(JSON.stringify(v)) });
    const routes: Record<string, { status: number; body: Uint8Array }> = {
      "https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master/data/pc/26.2/blocks.json":
        json([{ name: "stone", states: [] }]),
      [`${mc}/blockstates/_all.json`]: json({
        stone: { variants: { "": { model: "block/stone" } } },
      }),
      [`${mc}/models/block/_all.json`]: json({ stone: { parent: "block/cube_all" } }),
      [`${mc}/textures/block/_list.json`]: json({ directories: [], files: ["stone.png"] }),
      [`${mc}/textures/block/stone.png`]: { status: 200, body: new Uint8Array([1, 2, 3]) },
      [`${mc}/textures/entity/_list.json`]: json({ directories: [], files: [] }),
    };
    const cacheDir = join(root, "fetched-cache");
    const ok = capture();
    expect(
      await runCli(["assets", "fetch", "--version", "26.2", "--cache-dir", cacheDir], ok.io, {
        get: async (u) => routes[u] ?? { status: 404, body: new Uint8Array() },
      }),
    ).toBe(0);
    expect(ok.out[0]).toContain(`fetched 26.2 -> ${join(cacheDir, "26.2")}`);
    expect(ok.out[0]).toContain("textures, models, blockstates");
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
    expect(script).toContain('import { Build } from "@voxwright/mcbuilder";');
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

  it("writes an .mjs recipe, renames old block ids and rebuilds the same blocks", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    v.set(1, 0, 0, "minecraft:stone");
    v.set(0, 1, 0, "minecraft:chain[axis=y,waterlogged=false]");
    v.set(0, 2, 0, "minecraft:chain[axis=y,waterlogged=false]");
    const src = join(root, "old-1.19.nbt");
    await writeFile(src, (await writeStructureNbt(v, { dataVersion: 3105 })).bytes);
    const out = join(root, "old-import/old.mjs");
    const c = capture();
    expect(await runCli(["import", src, "-o", out], c.io)).toBe(0);
    expect(c.out[0]).toBe(`wrote ${out}`);
    expect(c.out.join("\n")).toContain("renamed to current block ids: chain -> iron_chain x2");
    const script = await readFile(out, "utf8");
    // From source the workspace package name; the bundled command line writes "voxwright".
    expect(script).toContain('import { Build } from "@voxwright/mcbuilder";');
    expect(script).toContain('"minecraft:iron_chain[axis=y,waterlogged=false]"');
    expect(script).not.toContain("minecraft:chain");

    const run = capture();
    expect(await runCli(["run", out, "--out", join(root, "old-import/dist")], run.io)).toBe(0);
    const report = JSON.parse(
      await readFile(join(root, "old-import/dist/run-001/report.json"), "utf8"),
    );
    expect(report.block_counts).toEqual({
      "minecraft:iron_chain[axis=y,waterlogged=false]": 2,
      "minecraft:stone": 2,
    });
  });

  it("only writes recipe file types", async () => {
    const src = fileURLToPath(
      new URL("../../../fixtures/real/rafeals-house/Rafeals_house.litematic", import.meta.url),
    );
    const c = capture();
    expect(await runCli(["import", src, "-o", join(root, "house.txt")], c.io)).toBe(1);
    expect(c.err[0]).toContain("-o must end in .ts, .mts, .mjs, .js");
  });

  it("rejects unknown file types", async () => {
    const f = join(root, "x.txt");
    await writeFile(f, "hello");
    const c = capture();
    expect(await runCli(["import", f], c.io)).toBe(1);
    expect(c.err[0]).toContain("unsupported file type");
  });
});

describe("DataVersion from the fetched version.json", () => {
  const DISTINCT = 7654321;
  const fakeVersionJson = JSON.stringify({ id: "26.2", world_version: DISTINCT });

  async function dataVersionOf(cwdHome: string, script: string, outDir: string) {
    const c = capture();
    c.io.home = cwdHome;
    expect(await runCli(["run", script, "--out", outDir], c.io)).toBe(0);
    const report = JSON.parse(await readFile(join(outDir, "run-001/report.json"), "utf8"));
    expect(c.out.join("\n")).toContain(`DataVersion ${DISTINCT}`);
    return report.artifacts[0].data_version as number;
  }

  it("reads <home>/.cache/mcbuilder/<ver>/version.json by default", async () => {
    const h = join(root, "dv-home");
    await mkdir(join(h, ".cache/mcbuilder/26.2"), { recursive: true });
    await writeFile(join(h, ".cache/mcbuilder/26.2/minecraft-data.json"), JSON.stringify(REGISTRY));
    await writeFile(join(h, ".cache/mcbuilder/26.2/version.json"), fakeVersionJson);
    const proj = join(root, "dv-default");
    await mkdir(proj, { recursive: true });
    await writeFile(join(proj, "house.ts"), HOUSE_TEMPLATE);
    expect(await dataVersionOf(h, join(proj, "house.ts"), join(root, "dv-default-out"))).toBe(
      DISTINCT,
    );
  });

  it("reads version.json under an explicit assets_dir (version dir or cache root)", async () => {
    for (const layout of ["direct", "fetched"]) {
      const assets = join(root, `dv-assets-${layout}`);
      const versionDir = layout === "direct" ? assets : join(assets, "26.2");
      await mkdir(join(assets, "26.2"), { recursive: true });
      await writeFile(join(assets, "26.2/minecraft-data.json"), JSON.stringify(REGISTRY));
      await writeFile(join(versionDir, "version.json"), fakeVersionJson);
      const proj = join(root, `dv-explicit-${layout}`);
      await mkdir(proj, { recursive: true });
      await writeFile(join(proj, "house.ts"), HOUSE_TEMPLATE);
      await writeFile(join(proj, "mcbuild.toml"), `assets_dir = ${JSON.stringify(assets)}\n`);
      expect(
        await dataVersionOf(
          join(root, "empty-home"),
          join(proj, "house.ts"),
          join(root, `dv-explicit-out-${layout}`),
        ),
      ).toBe(DISTINCT);
    }
  });
});

describe("determinism scan", () => {
  it("flags time and randomness, and passes clean scripts", () => {
    expect(scanDeterminism("const a = 1;", "s.ts")).toEqual([]);
    expect(scanDeterminism("Date.now()", "s.ts")).toHaveLength(1);
    expect(scanDeterminism("crypto.randomUUID(); Math.random()", "s.ts")).toHaveLength(2);
  });
});

describe("max_dimensions enforcement", () => {
  it("rejects tightened limits (both default and explicit Build maxDimensions) and allows relaxed limits", async () => {
    const tight = join(root, "maxdims-tight");
    await mkdir(tight, { recursive: true });
    await writeFile(join(tight, "mcbuild.toml"), "max_dimensions = [10, 10, 10]\n");
    await writeFile(
      join(tight, "default-build.ts"),
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build();
BUILD.scope(() => BUILD.set(10, 0, 0, "minecraft:stone"));
`,
    );
    await writeFile(
      join(tight, "explicit-large.ts"),
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build({ maxDimensions: [64, 64, 64] });
BUILD.scope(() => BUILD.set(20, 0, 0, "minecraft:stone"));
`,
    );
    await writeFile(
      join(tight, "within.ts"),
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build();
BUILD.scope(() => BUILD.set(9, 0, 0, "minecraft:stone"));
`,
    );

    for (const file of ["default-build.ts", "explicit-large.ts"]) {
      const checkRes = capture();
      expect(await runCli(["check", join(tight, file)], checkRes.io)).toBe(1);
      expect(checkRes.err.join("\n")).toContain("out of bounds");

      const outDir = join(tight, `out-${file}`);
      const runRes = capture();
      expect(await runCli(["run", join(tight, file), "--out", outDir], runRes.io)).toBe(1);
      expect(runRes.err.join("\n")).toContain("out of bounds");
      expect(await stat(outDir).catch(() => null)).toBeNull();
    }

    expect(await runCli(["check", join(tight, "within.ts")], capture().io)).toBe(0);

    const relaxed = join(root, "maxdims-relaxed");
    await mkdir(relaxed, { recursive: true });
    await writeFile(join(relaxed, "mcbuild.toml"), "max_dimensions = [512, 512, 512]\n");
    await writeFile(
      join(relaxed, "wide.ts"),
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build();
BUILD.scope(() => BUILD.set(300, 0, 0, "minecraft:stone"));
`,
    );
    const checkRelaxed = capture();
    expect(await runCli(["check", join(relaxed, "wide.ts")], checkRelaxed.io)).toBe(0);
    expect(checkRelaxed.out[0]).toContain("OK");

    const runRelaxed = capture();
    expect(
      await runCli(
        ["run", join(relaxed, "wide.ts"), "--out", join(relaxed, "dist")],
        runRelaxed.io,
      ),
    ).toBe(0);
    const report = JSON.parse(await readFile(join(relaxed, "dist/run-001/report.json"), "utf8"));
    expect(report.origin).toEqual([300, 0, 0]);
    expect(report.dimensions).toEqual({ x: 1, y: 1, z: 1 });

    // Default 256 limit is restored once the relaxed script finishes loading.
    const unconfigured = join(root, "maxdims-default");
    await mkdir(unconfigured, { recursive: true });
    await writeFile(
      join(unconfigured, "too-wide.ts"),
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build();
BUILD.scope(() => BUILD.set(300, 0, 0, "minecraft:stone"));
`,
    );
    const afterRelaxed = capture();
    expect(await runCli(["check", join(unconfigured, "too-wide.ts")], afterRelaxed.io)).toBe(1);
    expect(afterRelaxed.err.join("\n")).toContain("out of bounds");
  });
});

describe("consistent assets_dir resolution across CLI commands", () => {
  const DISTINCT = 7654321;

  async function seedAssets(versionDir: string) {
    const mc = join(versionDir, "client/assets/minecraft");
    await mkdir(join(mc, "blockstates"), { recursive: true });
    await mkdir(join(mc, "models/block"), { recursive: true });
    await mkdir(join(mc, "textures/block"), { recursive: true });
    await writeFile(join(versionDir, "minecraft-data.json"), JSON.stringify(REGISTRY));
    await writeFile(
      join(versionDir, "version.json"),
      JSON.stringify({ id: "26.2", world_version: DISTINCT }),
    );
    await writeFile(
      join(mc, "blockstates/stone.json"),
      JSON.stringify({ variants: { "": { model: "block/stone" } } }),
    );
    const faces = Object.fromEntries(
      ["down", "up", "north", "south", "west", "east"].map((f) => [
        f,
        { texture: "#all", cullface: f },
      ]),
    );
    await writeFile(
      join(mc, "models/block/stone.json"),
      JSON.stringify({
        textures: { all: "block/stone" },
        elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces }],
      }),
    );
    await writeFile(
      join(mc, "textures/block/stone.png"),
      encodePng(createCanvas(16, 16, [120, 120, 120])),
    );
  }

  for (const layout of ["direct", "nested", "tilde-direct"] as const) {
    it(`supports ${layout} assets_dir for check, run --preview --guide, and palette`, async () => {
      const isolatedHome = join(root, `assets-home-${layout}`);
      await mkdir(isolatedHome, { recursive: true });
      const rawAssetsDir =
        layout === "tilde-direct" ? "~/custom-assets" : join(root, `assets-dir-${layout}`);
      const resolvedAssetsDir =
        layout === "tilde-direct" ? join(isolatedHome, "custom-assets") : rawAssetsDir;
      const versionDir = layout === "nested" ? join(resolvedAssetsDir, "26.2") : resolvedAssetsDir;
      await seedAssets(versionDir);

      const proj = join(root, `assets-proj-${layout}`);
      await mkdir(proj, { recursive: true });
      await writeFile(join(proj, "mcbuild.toml"), `assets_dir = ${JSON.stringify(rawAssetsDir)}\n`);
      const script = join(proj, "stone.ts");
      await writeFile(
        script,
        `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build();
BUILD.scope(() => BUILD.set(0, 0, 0, "minecraft:stone"));
`,
      );

      const calls: string[] = [];
      const get = async (url: string) => {
        calls.push(url);
        return { status: 500, body: new Uint8Array() };
      };

      const chk = capture();
      chk.io.home = isolatedHome;
      expect(await runCli(["check", script], chk.io, { get })).toBe(0);
      expect(chk.out[0]).toContain("OK");

      const run = capture();
      run.io.home = isolatedHome;
      const outDir = join(proj, "dist");
      expect(
        await runCli(
          ["run", script, "--out", outDir, "--preview", "--views", "top", "--guide"],
          run.io,
          { get },
        ),
      ).toBe(0);
      const report = JSON.parse(await readFile(join(outDir, "run-001/report.json"), "utf8"));
      expect(
        report.artifacts.find((a: { format: string }) => a.format === "nbt")?.data_version,
      ).toBe(DISTINCT);
      expect(report.warnings).toEqual([]);
      expect(await stat(join(outDir, "run-001/previews_faithful/top.png"))).toBeTruthy();
      expect(await readFile(join(outDir, "run-001/guide/guide.md"), "utf8")).toContain(
        "![Stone](../previews_faithful/top.png)",
      );

      const pal = capture();
      pal.io.cwd = proj;
      pal.io.home = isolatedHome;
      expect(await runCli(["palette", "show", "stone"], pal.io, { get })).toBe(0);
      expect(pal.out[0]).toBe("minecraft:stone");
      expect(pal.out.join("\n")).toContain("#787878");
      expect(calls).toEqual([]);
      expect(await stat(join(isolatedHome, ".cache")).catch(() => null)).toBeNull();
    });
  }

  it("never auto-downloads into default cache when configured assets_dir lacks assets", async () => {
    const emptyAssets = join(root, "assets-empty");
    await mkdir(emptyAssets, { recursive: true });
    const isolatedHome = join(root, "assets-empty-home");
    await mkdir(isolatedHome, { recursive: true });
    const proj = join(root, "assets-empty-proj");
    await mkdir(proj, { recursive: true });
    await writeFile(join(proj, "mcbuild.toml"), `assets_dir = ${JSON.stringify(emptyAssets)}\n`);
    const script = join(proj, "stone.ts");
    await writeFile(
      script,
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build();
BUILD.scope(() => BUILD.set(0, 0, 0, "minecraft:stone"));
`,
    );

    const calls: string[] = [];
    const get = async (url: string) => {
      calls.push(url);
      return { status: 200, body: new Uint8Array() };
    };

    const chk = capture();
    chk.io.home = isolatedHome;
    expect(await runCli(["check", script], chk.io, { get })).toBe(1);
    expect(chk.err[0]).toContain("not found at");

    // Put only registry in assets_dir, leave client assets absent -> preview uses fallback without downloading.
    await writeFile(join(emptyAssets, "minecraft-data.json"), JSON.stringify(REGISTRY));
    const prev = capture();
    prev.io.home = isolatedHome;
    expect(
      await runCli(
        ["run", script, "--out", join(proj, "dist"), "--preview", "--views", "top"],
        prev.io,
        { get },
      ),
    ).toBe(0);
    expect(prev.out.join("\n")).toContain("vanilla client assets not found");
    expect(prev.out.join("\n")).not.toContain("downloading");

    const pal = capture();
    pal.io.cwd = proj;
    pal.io.home = isolatedHome;
    expect(await runCli(["palette", "show", "stone"], pal.io, { get })).toBe(1);
    expect(pal.err[0]).toContain("no client assets for 26.2");

    expect(calls).toEqual([]);
    expect(await stat(join(isolatedHome, ".cache")).catch(() => null)).toBeNull();
  });
});

describe("mcbuild diff 0-arg default", () => {
  it("picks the last two clean runs in numerical order while skipping dirty runs", async () => {
    const proj = join(root, "diff-default");
    await mkdir(proj, { recursive: true });
    const runs = join(proj, "dist");
    await mkdir(runs, { recursive: true });
    await writeFile(
      join(proj, "a.ts"),
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build();
BUILD.scope(() => BUILD.set(0, 0, 0, "minecraft:stone"));
`,
    );
    await writeFile(
      join(proj, "b.ts"),
      `import { Build } from "@voxwright/mcbuilder";
export const BUILD = new Build();
BUILD.scope(() => {
  BUILD.set(0, 0, 0, "minecraft:stone");
  BUILD.set(1, 0, 0, "minecraft:cobblestone");
});
`,
    );

    // Fewer than 2 clean runs fails cleanly.
    const emptyErr = capture();
    expect(await runCli(["diff", "--out", runs], emptyErr.io)).toBe(1);
    expect(emptyErr.err[0]).toContain("need at least 2");

    expect(await runCli(["run", join(proj, "a.ts"), "--out", runs], capture().io)).toBe(0); // run-001 (clean)
    const oneCleanErr = capture();
    expect(await runCli(["diff", "--out", runs], oneCleanErr.io)).toBe(1);
    expect(oneCleanErr.err[0]).toContain("found 1 clean run");

    // Dirty/broken run dirs of various shapes.
    await mkdir(join(runs, "run-002"), { recursive: true });
    await writeFile(join(runs, "run-002/report.json"), JSON.stringify({ artifacts: [] }));
    await mkdir(join(runs, "run-broken"), { recursive: true });
    await mkdir(join(runs, "run-003"), { recursive: true });
    await writeFile(
      join(runs, "run-003/report.json"),
      JSON.stringify({ artifacts: [{ format: "nbt", file: "missing.nbt" }] }),
    );

    // Clean run-009 and clean run-1000 (tests numerical sort over lexicographical: 1000 > 9).
    await mkdir(join(runs, "run-009"), { recursive: true });
    await mkdir(join(runs, "run-1000"), { recursive: true });
    const tmpOut = join(proj, "tmp-dist");
    expect(await runCli(["run", join(proj, "a.ts"), "--out", tmpOut], capture().io)).toBe(0);
    expect(await runCli(["run", join(proj, "b.ts"), "--out", tmpOut], capture().io)).toBe(0);
    await writeFile(join(runs, "run-009/a.nbt"), await readFile(join(tmpOut, "run-001/a.nbt")));
    await writeFile(
      join(runs, "run-009/report.json"),
      await readFile(join(tmpOut, "run-001/report.json"), "utf8"),
    );
    await writeFile(join(runs, "run-1000/b.nbt"), await readFile(join(tmpOut, "run-002/b.nbt")));
    await writeFile(
      join(runs, "run-1000/report.json"),
      await readFile(join(tmpOut, "run-002/report.json"), "utf8"),
    );
    // A trailing broken run-1001 with no .nbt should be skipped.
    await mkdir(join(runs, "run-1001"), { recursive: true });

    const def = capture();
    expect(await runCli(["diff", "--out", runs], def.io)).toBe(1);
    expect(def.out[0]).toContain("diff run-009 -> run-1000");
    expect(def.out.join("\n")).toContain("+ (1, 0, 0) minecraft:cobblestone");

    // 1 or 3 positionals still fail with "diff: give two run ids".
    const oneArg = capture();
    expect(await runCli(["diff", "1", "--out", runs], oneArg.io)).toBe(1);
    expect(oneArg.err[0]).toContain("diff: give two run ids");
    const threeArgs = capture();
    expect(await runCli(["diff", "1", "9", "1000", "--out", runs], threeArgs.io)).toBe(1);
    expect(threeArgs.err[0]).toContain("diff: give two run ids");
  });
});
