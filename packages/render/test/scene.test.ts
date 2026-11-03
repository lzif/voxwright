// SPDX-License-Identifier: AGPL-3.0-only
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  cellQuads,
  prepareScene,
  type Quad,
  quadAoLevels,
  quadCulledByNeighbour,
  splitBlockstate,
} from "../src/index.ts";
import { directoryAssets } from "../src/node/index.ts";

interface SceneWant {
  size: [number, number, number];
  palette: string[];
  data: number[];
  occludes: boolean[];
  walls: Record<
    string,
    {
      north: boolean;
      south: boolean;
      east: boolean;
      west: boolean;
      above_solid: boolean;
      above_any: boolean;
    }
  >;
  connectors: Record<string, { north: boolean; south: boolean; east: boolean; west: boolean }>;
  cells: Record<
    string,
    { effective: string; fallback: boolean; quads: { culled: boolean; ao: number[] | null }[] }
  >;
}
const { scenes } = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../vectors/scenes.json", import.meta.url)), "utf8"),
) as { scenes: Record<string, SceneWant> };

const root =
  process.env.VOXWRIGHT_ASSETS ?? join(homedir(), ".cache/mcbuilder/26.2/client/assets/minecraft");
const have = existsSync(join(root, "blockstates"));

describe.skipIf(!have)("scene logic against the Python renderer (vanilla assets)", () => {
  const assets = directoryAssets(root);

  for (const [name, want] of Object.entries(scenes)) {
    describe(name, () => {
      const scene = prepareScene(
        {
          size: want.size,
          origin: [0, 0, 0],
          data: Int32Array.from(want.data),
          palette: want.palette,
        },
        assets,
      );

      it("classifies which palette entries occlude", () => {
        expect(scene.occIdx).toEqual(want.occludes);
      });

      it("infers wall and fence connections", () => {
        const walls = Object.fromEntries(
          [...scene.walls].map(([k, e]) => [
            k,
            {
              north: e.north,
              south: e.south,
              east: e.east,
              west: e.west,
              above_solid: e.aboveSolid,
              above_any: e.aboveAny,
            },
          ]),
        );
        expect(walls).toEqual(want.walls);
        expect(Object.fromEntries(scene.connectors)).toEqual(want.connectors);
      });

      it("renders the same blocks, culls the same faces and gives the same ambient occlusion", () => {
        const cache = new Map<string, { quads: Quad[]; isFallback: boolean }>();
        let quadCount = 0;
        for (const [k, cell] of Object.entries(want.cells)) {
          const [x, y, z] = k.split(",").map(Number) as [number, number, number];
          const got = cellQuads(scene, x, y, z, cache);
          expect(got, k).not.toBeNull();
          expect(got?.block, k).toBe(cell.effective);
          expect(got?.isFallback, k).toBe(cell.fallback);
          const quads = got?.quads ?? [];
          expect(quads.length, k).toBe(cell.quads.length);
          const [bname] = splitBlockstate(got?.block ?? "");
          for (const [i, q] of quads.entries()) {
            const w = cell.quads[i] as { culled: boolean; ao: number[] | null };
            expect(
              quadCulledByNeighbour(scene, q.cull, x, y, z, bname),
              `${k} quad ${i} culled`,
            ).toBe(w.culled);
            if (q.flat) {
              expect(w.ao, `${k} quad ${i} ao`).toBeNull();
            } else {
              // The renderer shifts points into world space and back; do the same.
              const local = q.points.map(
                (p) => [p[0] + x - x, p[1] + y - y, p[2] + z - z] as [number, number, number],
              );
              const levels = quadAoLevels(local, snapNormalOf(q.normal), [x, y, z], scene.occ);
              expect(levels, `${k} quad ${i} ao`).toEqual(w.ao);
            }
            quadCount++;
          }
        }
        expect(quadCount).toBeGreaterThan(0);
      });
    });
  }
});

function snapNormalOf(n: readonly number[]): [number, number, number] {
  let ax = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(n[i] as number) > Math.abs(n[ax] as number)) ax = i;
  const out: [number, number, number] = [0, 0, 0];
  out[ax] = (n[ax] as number) >= 0 ? 1 : -1;
  return out;
}

describe("scene vectors", () => {
  it("cover all five scenes", () => {
    expect(Object.keys(scenes).sort()).toEqual([
      "ao",
      "entities",
      "fences",
      "translucent",
      "walls",
    ]);
  });
});
