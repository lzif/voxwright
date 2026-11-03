// SPDX-License-Identifier: AGPL-3.0-only

// Browser-side measurements on a generated 256-wide build, in headless Chromium:
// parse time, time to the first full frame, frame rate while orbiting, how long a
// slice takes to settle, and the time to show one edited block. Run after
// `pnpm --filter @voxwright/web build`; needs the texture pack (`pnpm assets`).
//
//   node test/perf.ts [--size 256] [--height 64] [--seconds 6] [--chromium <path>]
//
// The numbers depend on the machine; the output says which GPU the page got.

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { writeSchem } from "@voxwright/core";
import puppeteer, { type ElementHandle } from "puppeteer-core";
import { generateTerrain } from "../scripts/synthetic.ts";
import { chromiumArgs, findChromium, serveSite } from "./site.ts";
import type { Vox } from "./vox.ts";

const { values } = parseArgs({
  options: {
    size: { type: "string" },
    height: { type: "string" },
    seconds: { type: "string" },
    chromium: { type: "string" },
    shots: { type: "string" },
    query: { type: "string" },
    viewport: { type: "string" },
  },
});
const size = Number(values.size ?? 256);
const height = Number(values.height ?? 64);
const seconds = Number(values.seconds ?? 6);

const volume = generateTerrain({ size, height });
const { bytes } = await writeSchem(volume, { dataVersion: 4903, version: 3 });
const dir = await mkdtemp(join(tmpdir(), "voxwright-perf-"));
const file = join(dir, `synthetic-${size}.schem`);
await writeFile(file, bytes);

const { url, server } = await serveSite();
const browser = await puppeteer.launch({
  executablePath: findChromium(values.chromium),
  headless: true,
  args: chromiumArgs(true),
});
const quantile = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
};
const round = (n: number, d = 1): number => Math.round(n * 10 ** d) / 10 ** d;

try {
  const page = await browser.newPage();
  const [vw, vh] = (values.viewport ?? "1200x900").split("x").map(Number) as [number, number];
  await page.setViewport({ width: vw, height: vh });
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(String(e)));
  page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
  await page.goto(values.query ? `${url}?${values.query}` : url);
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="status"]')?.textContent?.startsWith("open a schematic"),
    { timeout: 60000 },
  );
  const kind = await page.$eval('[data-testid="renderer"]', (e) => e.getAttribute("data-kind"));
  if (kind !== "webgl") throw new Error(`the page used the ${kind} renderer, not WebGL`);

  const input = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
  const t0 = Date.now();
  await input.uploadFile(file);
  await page.waitForFunction(
    () => {
      const v = window.__voxwright as Vox;
      return v.renderer.stats().firstFullFrameMs !== null && v.timings().parseMs > 0;
    },
    { timeout: 180000, polling: 50 },
  );
  const wallMs = Date.now() - t0;
  const open = await page.evaluate(() => ({
    timings: (window.__voxwright as Vox).timings(),
    stats: (window.__voxwright as Vox).renderer.stats(),
  }));
  const meshMs = open.stats.meshMs;

  // Orbit for a while, spinning the camera every frame.
  await page.evaluate(() => (window.__voxwright as Vox).renderer.setOrbit({ azimuth: 0 }));
  const orbit = await page.evaluate(
    (s) => (window.__voxwright as Vox).renderer.runOrbitBenchmark(s),
    seconds,
  );
  const afterOrbit = await page.evaluate(() => (window.__voxwright as Vox).renderer.stats());

  // The same, close to the ground, where most sections are outside the view.
  await page.evaluate(() =>
    (window.__voxwright as Vox).renderer.setOrbit({ distance: 70, target: [128, 30, 128] }),
  );
  const near = await page.evaluate(
    (s) => (window.__voxwright as Vox).renderer.runOrbitBenchmark(s),
    Math.max(2, seconds / 2),
  );
  const nearStats = await page.evaluate(() => (window.__voxwright as Vox).renderer.stats());

  // A slice moving through the build: how long until the cut layers are in place.
  const slice: number[] = [];
  for (const y1 of [40, 33, 27, 21, 15]) {
    slice.push(
      await page.evaluate(async (top) => {
        const r = (window.__voxwright as Vox).renderer;
        const t = performance.now();
        r.setSlice({ y0: 0, y1: top });
        await r.whenIdle();
        return performance.now() - t;
      }, y1),
    );
  }
  await page.evaluate(() => (window.__voxwright as Vox).renderer.setSlice(null));
  await page.evaluate(() => (window.__voxwright as Vox).renderer.whenIdle());

  // Edit one block at a time on the surface and wait until it is on screen.
  const edits: { appliedMs: number; visibleMs: number }[] = [];
  const spots = [
    [100, 40, 100],
    [130, 40, 70],
    [31, 40, 200],
    [200, 40, 200],
    [15, 40, 15], // a border of sections
    [16, 40, 16],
    [128, 40, 128],
  ] as const;
  for (const [x, , z] of spots) {
    edits.push(
      await page.evaluate(
        async (px, pz) => {
          const v = window.__voxwright as Vox;
          // The column's top solid block, found from the volume (what an editor tool would do).
          const volume = (
            v as unknown as {
              volume(): { get(x: number, y: number, z: number): string | undefined };
            }
          ).volume();
          let y = 63;
          while (y > 0 && (volume.get(px, y, pz) ?? "minecraft:air") === "minecraft:air") y--;
          return v.edit(px, y, pz, "minecraft:glowstone");
        },
        x,
        z,
      ),
    );
  }
  const editMeshMs = (
    await page.evaluate(() => (window.__voxwright as Vox).renderer.stats())
  ).meshMs.slice(-edits.length * 2);
  if (values.shots) await page.screenshot({ path: join(values.shots, "perf-256.png") });

  const report = {
    build: `${size} x ${height} x ${size}, ${volume.size} cells, ${(bytes.length / 1e6).toFixed(2)} MB file`,
    gpu: open.stats.gpu,
    cores: await page.evaluate(() => navigator.hardwareConcurrency),
    sectionsMeshed: open.stats.meshes,
    parseMs: round(open.timings.parseMs),
    describeMs: round(open.timings.describeMs),
    allMeshesInPlaceMs: round(open.stats.meshingMs ?? 0),
    firstFullFrameMs: round(open.stats.firstFullFrameMs ?? 0),
    fileChosenToFullFrameWallMs: wallMs,
    meshPerSectionMs: {
      median: round(quantile(meshMs, 0.5), 2),
      p95: round(quantile(meshMs, 0.95), 2),
      max: round(Math.max(...meshMs), 2),
      jobs: meshMs.length,
    },
    orbit: {
      seconds,
      frames: orbit.frames,
      fps: round(orbit.fps),
      frameMedianMs: round(orbit.medianMs),
      frameP95Ms: round(orbit.p95Ms),
      worstMs: round(orbit.worstMs),
      renderCallMedianMs: round(orbit.cpuMedianMs, 2),
      renderCallP95Ms: round(orbit.cpuP95Ms, 2),
      drawCalls: afterOrbit.drawCalls,
      triangles: afterOrbit.triangles,
    },
    orbitCloseUp: {
      fps: round(near.fps),
      frameMedianMs: round(near.medianMs),
      renderCallMedianMs: round(near.cpuMedianMs, 2),
      drawCalls: nearStats.drawCalls,
      triangles: nearStats.triangles,
    },
    sliceSettleMs: slice.map((n) => round(n)),
    editToMeshInPlaceMs: {
      each: edits.map((e) => round(e.appliedMs, 2)),
      median: round(
        quantile(
          edits.map((e) => e.appliedMs),
          0.5,
        ),
        2,
      ),
    },
    editToVisibleMs: {
      each: edits.map((e) => round(e.visibleMs)),
      median: round(
        quantile(
          edits.map((e) => e.visibleMs),
          0.5,
        ),
      ),
    },
    editWorkerMeshMs: editMeshMs.map((n) => round(n, 2)),
    fallbackBlocks: afterOrbit.fallbackBlocks,
    pageErrors: problems,
  };
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.close();
}
