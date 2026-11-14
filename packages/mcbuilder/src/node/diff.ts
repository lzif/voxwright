// SPDX-License-Identifier: AGPL-3.0-only

// Diff two `mcbuild run` directories by reading each run's `.nbt` artifact.

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { canonicalize, parseBlockString, pyStrip, readNbtFile } from "@voxwright/core";
import {
  type Canvas,
  createCanvas,
  downscaleLanczos,
  drawRect,
  drawText,
  pasteRgb,
} from "@voxwright/render";
import { decodePng, encodePng } from "@voxwright/render/node";
import {
  DiffError,
  diffVoxelMaps,
  isEmpty,
  total,
  type VoxelDiff,
  type VoxelMap,
  voxelKey,
} from "../diff.ts";

const isDir = async (p: string): Promise<boolean> =>
  (await stat(p).catch(() => null))?.isDirectory() ?? false;
const isFile = async (p: string): Promise<boolean> =>
  (await stat(p).catch(() => null))?.isFile() ?? false;

/**
 * Resolve a run id (`run-001` or bare `001`) to its directory name. Bare
 * numbers are zero-padded run ids: `1` means `run-001`.
 */
export async function resolveRunDir(runsDir: string, runId: string): Promise<string> {
  const raw = pyStrip(String(runId));
  if (raw === "" || raw.includes("/") || raw.startsWith("."))
    throw new DiffError(`invalid run id: '${runId}'`);
  const candidates = [raw];
  if (!raw.startsWith("run-")) {
    candidates.push(`run-${raw}`);
    if (/^\d+$/.test(raw)) candidates.push(`run-${String(Number(raw)).padStart(3, "0")}`);
  }
  for (const name of candidates) {
    if (await isDir(join(runsDir, name))) return join(runsDir, name);
  }
  throw new DiffError(`unknown run: ${raw} (no such directory in ${runsDir})`);
}

async function artifactNbtPath(
  runDir: string,
  report: { artifacts?: { format?: string; file?: string }[] },
): Promise<string> {
  for (const art of report.artifacts ?? []) {
    if (art.format === "nbt" && art.file) return join(runDir, art.file);
  }
  // Tolerate hand-made or older run dirs: exactly one .nbt is unambiguous.
  const candidates = (await readdir(runDir)).filter((f) => f.endsWith(".nbt")).sort();
  const name = runDir.split("/").pop();
  if (candidates.length === 1) return join(runDir, candidates[0] as string);
  if (candidates.length === 0) {
    throw new DiffError(
      `${name}: no .nbt artifact (runs with validation errors export none — diff needs two clean runs)`,
    );
  }
  throw new DiffError(`${name}: several .nbt files and report.json names none — cannot pick one`);
}

/** The `.nbt` a run directory holds: the one its report names, else the only one in it. */
export async function runArtifact(runDir: string): Promise<string> {
  if (!(await isDir(runDir))) throw new DiffError(`not a run directory: ${runDir}`);
  let report: { artifacts?: { format?: string; file?: string }[] } = {};
  try {
    report = JSON.parse(await readFile(join(runDir, "report.json"), "utf8"));
  } catch {}
  return artifactNbtPath(runDir, report);
}

/**
 * Load a run's voxel map from its `.nbt` artifact, with positions translated
 * to world coordinates by the report's `origin` and air excluded.
 */
export async function loadRunVoxels(runDir: string): Promise<VoxelMap> {
  const name = runDir.split("/").pop();
  if (!(await isDir(runDir))) throw new DiffError(`not a run directory: ${runDir}`);
  const reportPath = join(runDir, "report.json");
  if (!(await isFile(reportPath)))
    throw new DiffError(`${runDir} has no report.json — not an mcbuild run dir`);
  let report: { artifacts?: { format?: string; file?: string }[]; origin?: unknown[] | null };
  try {
    report = JSON.parse(await readFile(reportPath, "utf8"));
  } catch (e) {
    throw new DiffError(`${name}: cannot parse report.json: ${(e as Error).message}`);
  }
  const nbtPath = await artifactNbtPath(runDir, report);
  const nbtName = nbtPath.split("/").pop();
  if (!(await isFile(nbtPath))) throw new DiffError(`${name}: artifact not found: ${nbtName}`);
  let root: Awaited<ReturnType<typeof readNbtFile>>;
  try {
    root = await readNbtFile(new Uint8Array(await readFile(nbtPath)));
  } catch (e) {
    throw new DiffError(`${name}: cannot read ${nbtName}: ${(e as Error).message}`);
  }
  const origin = report.origin ?? [0, 0, 0];
  const [ox, oy, oz] = (origin as unknown[]).map((v) =>
    typeof v === "number" && Number.isInteger(v) ? v : Number.NaN,
  );
  if (
    [ox, oy, oz].some((v) => v === undefined || Number.isNaN(v)) ||
    (origin as unknown[]).length !== 3
  ) {
    throw new DiffError(`${name}: report.json has a malformed origin: ${JSON.stringify(origin)}`);
  }
  try {
    const paletteTag = root.tag.value.get("palette");
    const blocksTag = root.tag.value.get("blocks");
    if (paletteTag?.type !== "list" || blocksTag?.type !== "list")
      throw new Error("no palette or blocks");
    const palette = paletteTag.value.map((entry) => {
      if (entry.type !== "compound") throw new Error("bad palette entry");
      const nameTag = entry.value.get("Name") ?? entry.value.get("id");
      if (nameTag?.type !== "string") throw new Error("palette entry without Name");
      const propsTag = entry.value.get("Properties") ?? entry.value.get("properties");
      const props: [string, string][] = [];
      if (propsTag?.type === "compound")
        for (const [k, v] of propsTag.value) props.push([k, String(v.value)]);
      props.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      return canonicalize(
        props.length > 0
          ? `${nameTag.value}[${props.map(([k, v]) => `${k}=${v}`).join(",")}]`
          : nameTag.value,
      );
    });
    const cells = new Map<string, string>();
    for (const b of blocksTag.value) {
      if (b.type !== "compound") throw new Error("bad block");
      const pos = b.value.get("pos");
      const state = b.value.get("state");
      if (
        pos?.type !== "list" ||
        pos.value.length !== 3 ||
        state === undefined ||
        state.type !== "int"
      ) {
        throw new Error("bad block entry");
      }
      const [px, py, pz] = pos.value.map((v) => (v as { value: number }).value) as [
        number,
        number,
        number,
      ];
      const block = palette[state.value];
      if (block === undefined) throw new Error("state index outside the palette");
      if (parseBlockString(block).name === "minecraft:air") continue; // air is "empty" in both frames
      cells.set(voxelKey(px + (ox as number), py + (oy as number), pz + (oz as number)), block);
    }
    return cells;
  } catch (e) {
    throw new DiffError(`${name}: malformed ${nbtName}: ${(e as Error).message}`);
  }
}

/** Load both runs' voxel maps and diff them (A = old, B = new). */
export async function diffRunDirs(aDir: string, bDir: string): Promise<VoxelDiff> {
  return diffVoxelMaps(await loadRunVoxels(aDir), await loadRunVoxels(bDir));
}

/**
 * First preview view label present in both runs' reports and on disk.
 * Direction-trusted views (`previews_faithful/`, `previews_trusted/`) are
 * preferred over `previews/`.
 */
export async function firstCommonView(
  aDir: string,
  bDir: string,
): Promise<[string, string] | null> {
  const views = async (runDir: string): Promise<[boolean, string, string][]> => {
    let report: {
      views?: { label?: string; file?: string; directions_trusted?: boolean }[];
    };
    try {
      report = JSON.parse(await readFile(join(runDir, "report.json"), "utf8"));
    } catch {
      return [];
    }
    const out: [boolean, string, string][] = [];
    const seen = new Set<string>();
    for (const v of report.views ?? []) {
      const label = v.label;
      const rel = v.file;
      const trusted = Boolean(v.directions_trusted);
      const key = `${trusted}:${label}`;
      if (label && rel && !seen.has(key)) {
        seen.add(key);
        out.push([trusted, label, join(runDir, rel)]);
      }
    }
    // Trusted views first; report order otherwise.
    out.sort((a, b) => Number(b[0]) - Number(a[0]));
    return out;
  };

  const va = new Map<string, [boolean, string]>();
  for (const [trusted, label, pa] of await views(aDir)) {
    if (!va.has(label)) va.set(label, [trusted, pa]);
  }
  for (const [, label, pb] of await views(bDir)) {
    const hit = va.get(label);
    if (!hit) continue;
    const [, pa] = hit;
    if ((await isFile(pa)) && (await isFile(pb))) return [pa, pb];
  }
  return null;
}

/**
 * Compose the two runs' matching preview PNGs side by side with a title band
 * and per-panel run captions. Returns `outPath` when written, or `null` when
 * the runs share no preview view (or the PNGs cannot be read).
 */
export async function comparisonImage(
  aDir: string,
  bDir: string,
  diff: VoxelDiff,
  outPath: string,
  options: { aId?: string; bId?: string } = {},
): Promise<string | null> {
  const pair = await firstCommonView(aDir, bDir);
  if (pair === null) return null;
  const aId = options.aId || basename(aDir);
  const bId = options.bId || basename(bDir);
  let imgs: [Canvas, Canvas];
  try {
    imgs = [
      decodePng(new Uint8Array(await readFile(pair[0]))),
      decodePng(new Uint8Array(await readFile(pair[1]))),
    ];
  } catch {
    return null;
  }
  const targetH = Math.min(imgs[0].height, imgs[1].height);
  const scaled = imgs.map((im) => {
    if (im.height === targetH) return im;
    const w = Math.max(1, Math.round((im.width * targetH) / im.height));
    return downscaleLanczos(im, w, targetH);
  }) as [Canvas, Canvas];

  const [titleH, capH, gap, pad] = [40, 26, 12, 10];
  const [w1, w2] = [scaled[0].width, scaled[1].width];
  const width = w1 + gap + w2;
  const height = titleH + capH + targetH;
  const canvas = createCanvas(width, height, [18, 18, 22]);
  const changes = total(diff);
  const title = isEmpty(diff)
    ? `diff ${aId} -> ${bId}: no differences`
    : `diff ${aId} -> ${bId}: ${changes} ${changes === 1 ? "change" : "changes"} (${diff.added.length} added, ${diff.removed.length} removed, ${diff.changed.length} replaced)`;
  drawText(canvas, pad, Math.floor((titleH - 14) / 2), title, {
    size: 11,
    color: [235, 235, 240],
  });
  for (const [x, im, label, color] of [
    [0, scaled[0], aId, [255, 140, 140]],
    [w1 + gap, scaled[1], bId, [140, 230, 150]],
  ] as const) {
    drawText(canvas, x + pad, titleH + Math.floor((capH - 14) / 2), label, {
      size: 11,
      color,
    });
    pasteRgb(canvas, { ...im, channels: 3 }, x, titleH + capH);
  }
  drawRect(canvas, w1, titleH + capH, w1 + gap - 1, height - 1, [70, 70, 80]);
  await writeFile(outPath, encodePng(canvas));
  return outPath;
}
