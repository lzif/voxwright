// SPDX-License-Identifier: AGPL-3.0-only
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCanvas } from "@voxwright/render";
import { decodePng, encodePng } from "@voxwright/render/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DiffError,
  diffIsEmpty,
  diffTotal,
  diffVoxelMaps,
  formatDiff,
  voxelKey,
} from "../src/index.ts";
import {
  comparisonImage,
  diffRunDirs,
  firstCommonView,
  loadRunVoxels,
  resolveRunDir,
  runCli,
} from "../src/node/index.ts";
import { expectError, loadVector } from "./helpers.ts";

type Cell = [number, number, number, string];
interface Scenario {
  a: Cell[];
  b: Cell[];
  added: [number[], string][];
  removed: [number[], string][];
  changed: [number[], string, string][];
  cells_a: number;
  cells_b: number;
  is_empty: boolean;
  total: number;
  text: Record<string, string>;
}
interface RunSpec {
  nbt_b64: string;
  report: Record<string, unknown> | null;
  result: { ok?: [number[], string][]; error?: string };
}

const v = loadVector<{
  diffs: Record<string, Scenario>;
  resolve: Record<string, { ok?: string; error?: string }>;
  runs: Record<string, RunSpec>;
}>("diff.json");

const toMap = (cells: Cell[]) => new Map(cells.map(([x, y, z, b]) => [voxelKey(x, y, z), b]));

describe("diff against the Python oracle", () => {
  for (const [name, sc] of Object.entries(v.diffs)) {
    it(`${name}: cells and report text`, () => {
      const d = diffVoxelMaps(toMap(sc.a), toMap(sc.b));
      expect(d.added).toEqual(sc.added);
      expect(d.removed).toEqual(sc.removed);
      expect(d.changed).toEqual(sc.changed);
      expect([d.cellsA, d.cellsB]).toEqual([sc.cells_a, sc.cells_b]);
      expect(diffIsEmpty(d)).toBe(sc.is_empty);
      expect(diffTotal(d)).toBe(sc.total);
      for (const [max, text] of Object.entries(sc.text)) {
        expect(
          formatDiff(d, "run-001", "run-002", { maxEntries: Number(max) }),
          `${name} max=${max}`,
        ).toBe(text);
      }
    });
  }
});

describe("run directories", () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "voxwright-diff-"));
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  it("resolves run ids the way Python does", async () => {
    const base = join(root, "resolve");
    for (const n of ["run-001", "run-002", "run-010", "custom", "run-abc"])
      await mkdir(join(base, n), { recursive: true });
    await writeFile(join(base, "afile"), "x");
    for (const [id, want] of Object.entries(v.resolve)) {
      if (want.ok !== undefined)
        expect((await resolveRunDir(base, id)).split("/").pop(), id).toBe(want.ok);
      else await expect(resolveRunDir(base, id), id).rejects.toThrow(DiffError);
    }
  });

  for (const [name, spec] of Object.entries(v.runs)) {
    it(`loads run '${name}' like Python`, async () => {
      const dir = join(root, "runs", name);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "a.nbt"), Buffer.from(spec.nbt_b64, "base64"));
      if (spec.report !== null)
        await writeFile(join(dir, "report.json"), JSON.stringify(spec.report));
      if (spec.result.ok !== undefined) {
        const got = [...(await loadRunVoxels(dir))].map(([k, b]) => [k.split(",").map(Number), b]);
        const key = (e: unknown): number[] => (e as [number[], string])[0];
        got.sort((p, q) => {
          const [a, b] = [key(p), key(q)];
          return (
            (a[0] as number) - (b[0] as number) ||
            (a[1] as number) - (b[1] as number) ||
            (a[2] as number) - (b[2] as number)
          );
        });
        expect(got).toEqual(spec.result.ok);
      } else {
        await expect(loadRunVoxels(dir)).rejects.toThrow(DiffError);
      }
    });
  }

  it("diffs two runs and exits like diff(1)", async () => {
    const out: string[] = [];
    const err: string[] = [];
    const io = {
      out: (l: string) => out.push(l),
      err: (l: string) => err.push(l),
      cwd: root,
      home: root,
    };
    const runs = join(root, "dist");
    for (const [n, name] of [
      ["run-001", "plain"],
      ["run-002", "origin"],
      ["run-003", "plain"],
    ] as const) {
      const spec = v.runs[name] as RunSpec;
      await mkdir(join(runs, n), { recursive: true });
      await writeFile(join(runs, n, "a.nbt"), Buffer.from(spec.nbt_b64, "base64"));
      await writeFile(join(runs, n, "report.json"), JSON.stringify(spec.report));
    }
    expect(await runCli(["diff", "1", "3", "--out", runs], io)).toBe(0);
    expect(out[0]).toContain("diff run-001 -> run-003\n  no differences (2 cells in both)");
    expect(out.join("\n")).toContain("comparison: no shared preview view — image skipped");
    out.length = 0;
    expect(await runCli(["diff", "1", "2", "--out", runs, "--max", "1"], io)).toBe(1);
    expect(out.join("\n")).toContain("not shown (use --max N)");
    expect(
      (await diffRunDirs(join(runs, "run-001"), join(runs, "run-002"))).added.length,
    ).toBeGreaterThan(0);

    expect(await runCli(["diff", "1", "9", "--out", runs], io)).toBe(1);
    expect(err.at(-1)).toContain("unknown run: 9");
    expect(await runCli(["diff", "1", "2", "--out", join(root, "nope")], io)).toBe(1);
    expect(await runCli(["diff", "1", "2", "--out", runs, "--max", "-1"], io)).toBe(1);
    expectError(() => {
      throw new DiffError("x");
    }, "McbuilderError");
  });

  it("prefers direction-trusted views and writes a side-by-side comparison PNG", async () => {
    const runs = join(root, "dist-img");
    for (const [n, name] of [
      ["run-001", "plain"],
      ["run-002", "origin"],
    ] as const) {
      const spec = v.runs[name] as RunSpec;
      const runDir = join(runs, n);
      await mkdir(join(runDir, "previews"), { recursive: true });
      await mkdir(join(runDir, "previews_faithful"), { recursive: true });
      await writeFile(join(runDir, "a.nbt"), Buffer.from(spec.nbt_b64, "base64"));
      const report = {
        ...spec.report,
        views: [
          {
            file: "previews/iso.png",
            label: "iso",
            azimuth: 45,
            elevation: 25,
            directions_untrusted: true,
            directions_trusted: false,
          },
          {
            file: "previews_faithful/iso.png",
            label: "iso",
            azimuth: 45,
            elevation: 25,
            directions_untrusted: false,
            directions_trusted: true,
          },
        ],
      };
      await writeFile(join(runDir, "report.json"), JSON.stringify(report));
      await writeFile(
        join(runDir, "previews", "iso.png"),
        encodePng(createCanvas(40, 30, [90, 90, 200])),
      );
      await writeFile(
        join(runDir, "previews_faithful", "iso.png"),
        encodePng(createCanvas(120, n === "run-001" ? 80 : 100, [90, 180, 90])),
      );
    }

    const aDir = join(runs, "run-001");
    const bDir = join(runs, "run-002");
    expect(await firstCommonView(aDir, bDir)).toEqual([
      join(aDir, "previews_faithful", "iso.png"),
      join(bDir, "previews_faithful", "iso.png"),
    ]);

    const d = await diffRunDirs(aDir, bDir);
    const outPath = join(runs, "manual-diff.png");
    const made = await comparisonImage(aDir, bDir, d, outPath);
    expect(made).toBe(outPath);
    const decoded = decodePng(new Uint8Array(await readFile(outPath)));
    expect(decoded.width).toBeGreaterThan(120);
    expect(decoded.height).toBe(40 + 26 + 80);

    const out: string[] = [];
    const code = await runCli(["diff", "001", "002", "--out", runs], {
      out: (l) => out.push(l),
      err: () => {},
      cwd: root,
      home: root,
    });
    expect(code).toBe(1);
    const cliImg = join(runs, "diff-run-001-run-002.png");
    expect(out.join("\n")).toContain(`comparison: ${cliImg}`);
  });

  it("falls back to untrusted views when trusted views are absent", async () => {
    const runs = join(root, "dist-fallback");
    for (const n of ["run-001", "run-002"] as const) {
      const spec = v.runs.plain as RunSpec;
      const runDir = join(runs, n);
      await mkdir(join(runDir, "previews"), { recursive: true });
      await writeFile(join(runDir, "a.nbt"), Buffer.from(spec.nbt_b64, "base64"));
      await writeFile(
        join(runDir, "report.json"),
        JSON.stringify({
          ...spec.report,
          views: [
            {
              file: "previews/iso.png",
              label: "iso",
              azimuth: 45,
              elevation: 25,
              directions_untrusted: true,
              directions_trusted: false,
            },
          ],
        }),
      );
      await writeFile(
        join(runDir, "previews", "iso.png"),
        encodePng(createCanvas(20, 20, [10, 20, 30])),
      );
    }
    const aDir = join(runs, "run-001");
    const bDir = join(runs, "run-002");
    expect(await firstCommonView(aDir, bDir)).toEqual([
      join(aDir, "previews", "iso.png"),
      join(bDir, "previews", "iso.png"),
    ]);
    const d = await diffRunDirs(aDir, bDir);
    const outPath = join(runs, "same.png");
    expect(await comparisonImage(aDir, bDir, d, outPath)).toBe(outPath);
  });
});
