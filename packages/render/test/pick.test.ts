// SPDX-License-Identifier: AGPL-3.0-only
import { Volume } from "@voxwright/core";
import { describe, expect, it } from "vitest";
import { camera, frameFor, parseViews, pickCell, project, renderView } from "../src/index.ts";

const view = (spec: string) => parseViews(spec)[0] as ReturnType<typeof parseViews>[number];
const opts = { longestPx: 600, supersample: 1, shadow: false, overlay: false };

function floor(): ReturnType<Volume["toDense"]> {
  const v = new Volume();
  for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) v.set(x, 0, z, "minecraft:stone");
  v.set(2, 1, 2, "minecraft:dirt");
  return v.toDense();
}

/** Screen pixel of a world point under the same framing the renderer used. */
function pixelOf(
  dense: ReturnType<typeof floor>,
  v: ReturnType<typeof view>,
  p: [number, number, number],
): [number, number] {
  const f = frameFor(dense, v, opts);
  if (!f) throw new Error("no frame");
  const { r, u } = camera(v);
  const [sx, sy] = project(p, r, u);
  return [((sx - f.minx) * f.scale) / f.ss, ((f.maxy - sy) * f.scale) / f.ss];
}

describe("picking", () => {
  const dense = floor();

  it("finds the block under a point, and the face the ray entered by", () => {
    for (const spec of ["top", "iso", "az200_el025", "az310_el60"]) {
      const v = view(spec);
      // The centre of the top face of the dirt block at (2, 1, 2) is always visible from above or the side.
      const [px, py] = pixelOf(dense, v, [2.5, 2.0, 2.5]);
      const hit = pickCell(dense, v, opts, px, py - 1 / 2);
      expect(hit, spec).not.toBeNull();
      expect(hit?.cell, spec).toEqual([2, 1, 2]);
    }
  });

  it("reports the top face and the cell above it as the next block to place", () => {
    const v = view("top");
    const [px, py] = pixelOf(dense, v, [0.5, 1.0, 4.5]);
    const hit = pickCell(dense, v, opts, px, py);
    expect(hit?.cell).toEqual([0, 0, 4]);
    expect(hit?.normal).toEqual([0, 1, 0]);
    expect(hit?.next).toEqual([0, 1, 4]);
  });

  it("returns the side face when a block is hit from the side", () => {
    const v = view("az000_el025"); // looking south: the north (-Z) faces face the camera... and walls to +z are hidden
    const [px, py] = pixelOf(dense, v, [2.5, 1.5, 2.0]);
    const hit = pickCell(dense, v, opts, px, py);
    expect(hit?.cell).toEqual([2, 1, 2]);
    expect(hit?.normal.map((n) => Math.abs(n))).toContain(1);
  });

  it("finds nothing off the structure, or in an empty volume", () => {
    expect(pickCell(dense, view("iso"), opts, 2, 2)).toBeNull();
    expect(pickCell(new Volume().toDense(), view("iso"), opts, 100, 100)).toBeNull();
    expect(frameFor(new Volume().toDense(), view("iso"), opts)).toBeNull();
  });

  it("agrees with what is drawn: the picked pixel is not background", () => {
    const v = view("iso");
    const img = renderView(dense, null, v, opts);
    let drawn = 0;
    let picked = 0;
    for (let py = 0; py < img.height; py += 25) {
      for (let px = 0; px < img.width; px += 25) {
        const i = (py * img.width + px) * 3;
        const isBackground =
          img.data[i] === 244 && img.data[i + 1] === 241 && img.data[i + 2] === 235;
        const hit = pickCell(dense, v, opts, px, py) !== null;
        if (isBackground) continue;
        drawn++;
        if (hit) picked++;
      }
    }
    // Silhouette pixels can sit a hair outside the true geometry (the rasteriser fills edge pixels).
    expect(picked / drawn).toBeGreaterThan(0.95);
    expect(drawn).toBeGreaterThan(20);
  });
});
