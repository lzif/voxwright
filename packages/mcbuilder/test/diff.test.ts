// SPDX-License-Identifier: AGPL-3.0-only
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DiffError,
  diffIsEmpty,
  diffTotal,
  diffVoxelMaps,
  formatDiff,
  voxelKey,
} from "../src/index.ts";
import { diffRunDirs, loadRunVoxels, resolveRunDir, runCli } from "../src/node/index.ts";
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
});
