// SPDX-License-Identifier: AGPL-3.0-only

// Diff two `mcbuild run` directories by reading each run's `.nbt` artifact.

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { canonicalize, parseBlockString, pyStrip, readNbtFile } from "@voxwright/core";
import { DiffError, diffVoxelMaps, type VoxelDiff, type VoxelMap, voxelKey } from "../diff.ts";

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
