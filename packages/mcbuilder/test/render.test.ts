// SPDX-License-Identifier: AGPL-3.0-only
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DenseVolume } from "@voxwright/core";
import { parseViews, renderView } from "@voxwright/render";
import { directoryAssets } from "@voxwright/render/node";
import { describe, expect, it } from "vitest";

interface Want {
  size: [number, number];
  thumb: number[][];
}
const ref = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../vectors/renders.json", import.meta.url)), "utf8"),
) as {
  thumb: number;
  views: string;
  cases: Record<string, Record<string, Want>>;
};

const root =
  process.env.VOXWRIGHT_ASSETS ?? join(homedir(), ".cache/mcbuilder/26.2/client/assets/minecraft");
const have = existsSync(join(root, "blockstates"));

/** Area-average an RGB canvas to n by n, as rows of r, g, b, r, g, b... */
function thumbnail(c: { width: number; height: number; data: Uint8Array }, n: number): number[][] {
  const edges = (len: number): number[] =>
    Array.from({ length: n + 1 }, (_, i) => Math.trunc((i * len) / n));
  const [ys, xs] = [edges(c.height), edges(c.width)];
  return Array.from({ length: n }, (_, i) => {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      const sums = [0, 0, 0];
      let count = 0;
      for (let y = ys[i] as number; y < (ys[i + 1] as number); y++) {
        for (let x = xs[j] as number; x < (xs[j + 1] as number); x++) {
          for (let k = 0; k < 3; k++)
            (sums[k] as number) += c.data[(y * c.width + x) * 3 + k] as number;
          count++;
        }
      }
      row.push(...sums.map((s) => Math.round(s / Math.max(1, count))));
    }
    return row;
  });
}

// The Python renderer draws at 2048 px; the comparison renders at 512 px, which
// keeps the aspect ratio and the look while staying fast. Thumbnails make the two
// sizes comparable.
const EXAMPLES: Record<string, () => Promise<{ BUILD: { grid: { toDense(): DenseVolume } } }>> = {
  "homestead-well": () => import("../examples/homestead/well.ts"),
  "waystone-skystead": () => import("../examples/waystones/skystead.ts"),
  "waystone-s5": () => import("../examples/waystones/s5.ts"),
  "homestead-house": () => import("../examples/homestead/house.ts"),
};

describe.skipIf(!have)("rendered images against the Python renderer (vanilla assets)", () => {
  const assets = directoryAssets(root);
  for (const [name, views] of Object.entries(ref.cases)) {
    for (const [label, want] of Object.entries(views)) {
      it(`${name} ${label}`, async () => {
        const { BUILD } = await (
          EXAMPLES[name] as () => Promise<{ BUILD: { grid: { toDense(): DenseVolume } } }>
        )();
        const view = parseViews(label)[0] as ReturnType<typeof parseViews>[number];
        const img = renderView(BUILD.grid.toDense(), assets, view, { longestPx: 512 });

        // Same shape: aspect ratio within a pixel of rounding.
        expect(img.width / img.height).toBeCloseTo(want.size[0] / want.size[1], 2);

        const got = thumbnail(img, ref.thumb);
        let total = 0;
        let worst = 0;
        for (const [i, row] of got.entries()) {
          for (const [k, v] of row.entries()) {
            const diff = Math.abs(v - ((want.thumb[i] as number[])[k] as number));
            total += diff;
            worst = Math.max(worst, diff);
          }
        }
        const mean = total / (ref.thumb * ref.thumb * 3);
        expect(mean, `mean thumbnail difference ${mean.toFixed(2)}`).toBeLessThan(2.0);
        expect(worst, `worst thumbnail difference ${worst}`).toBeLessThan(40);
      });
    }
  }
});

describe("render vectors", () => {
  it("cover four builds in three views", () => {
    expect(Object.keys(ref.cases)).toHaveLength(4);
    for (const views of Object.values(ref.cases))
      expect(Object.keys(views).sort()).toEqual(["az200_el025", "iso", "top"]);
  });
});
