// SPDX-License-Identifier: AGPL-3.0-only

// Does the heavy work off the main thread: decoding files, editing, drawing
// frames, picking, autosaving and writing converted files. Holds the asset pack
// and the open schematic.

import { canonicalize, Volume } from "@voxwright/core";
import { type AssetSource, pickCell, renderView, sliceDense, type View } from "@voxwright/render";
import { assetsFromPack, fetchPack, type Pack } from "./assets.ts";
import { type FormatId, openFile, saveAs } from "./formats.ts";
import type { CellEdit, FromWorker, Info, ToWorker } from "./protocol.ts";
import { loadSession, saveSession } from "./session.ts";
import { blockStateProps } from "./states.ts";

let assets: AssetSource | null = null;
let pack: Pack | null = null;
let volume: Volume | null = null;
let dataVersion: number | null = null;
let name = "structure";
let loss: string[] = [];
let dense = new Volume().toDense();
// What an edit changed, so it can be undone: the previous block at each cell.
let undoStack: CellEdit[][] = [];
let redoStack: CellEdit[][] = [];

const post = (m: FromWorker, transfer: Transferable[] = []): void =>
  (self as unknown as Worker).postMessage(m, transfer);
const AIR = "minecraft:air";

function describe(): Info {
  const v = volume as Volume;
  const counts = new Map<string, number>();
  v.eachCell((_x, _y, _z, idx) => {
    const b = v.palette[idx] as string;
    if (b === AIR) return;
    const base = b.split("[", 1)[0] as string;
    counts.set(base, (counts.get(base) ?? 0) + 1);
  });
  const size: [number, number, number] = [dense.size[0], dense.size[1], dense.size[2]];
  return {
    name,
    size,
    blocks: [...counts.values()].reduce((a, b) => a + b, 0),
    dataVersion,
    counts: [...counts].sort((a, b) => b[1] - a[1]),
    loss,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}

function setVolume(v: Volume, label: string, dv: number | null, notes: string[]): void {
  volume = v;
  name = label;
  dataVersion = dv;
  loss = notes;
  dense = v.toDense();
  undoStack = [];
  redoStack = [];
}

/** Apply edits and return the inverse, so the same call can undo them. */
function apply(edits: CellEdit[]): CellEdit[] {
  const v = volume as Volume;
  const inverse: CellEdit[] = [];
  for (const e of edits) {
    const before = v.get(e.x, e.y, e.z) ?? null;
    if (before === e.block) continue;
    inverse.unshift({ x: e.x, y: e.y, z: e.z, block: before });
    if (e.block === null) v.unset(e.x, e.y, e.z);
    else v.set(e.x, e.y, e.z, canonicalize(e.block));
  }
  dense = v.toDense();
  return inverse;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** Remember the work in the browser, a moment after the last change. */
function autosave(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (volume !== null) void saveSession({ name, dataVersion, volume }).catch(() => {});
  }, 400);
}

function view(m: { azimuth: number; elevation: number }): View {
  return { azimuth: m.azimuth, elevation: m.elevation, label: "" };
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  try {
    switch (m.type) {
      case "init": {
        pack = await fetchPack(m.packUrl);
        assets = pack ? await assetsFromPack(pack) : null;
        const blockNames = pack
          ? Object.keys(pack.json)
              .filter((k) => k.startsWith("blockstates/"))
              .map((k) => `minecraft:${k.slice("blockstates/".length, -".json".length)}`)
              .sort()
          : [];
        post({ id: m.id, type: "ready", haveAssets: assets !== null, blockNames });
        return;
      }
      case "open": {
        const opened = await openFile(new Uint8Array(m.bytes), m.name);
        setVolume(opened.volume, m.name, opened.dataVersion, opened.loss);
        autosave();
        post({ id: m.id, type: "opened", info: describe() });
        return;
      }
      case "new": {
        const v = new Volume();
        for (let x = 0; x < m.width; x++)
          for (let z = 0; z < m.depth; z++) v.set(x, 0, z, "minecraft:stone");
        setVolume(v, "new-build.nbt", null, []);
        autosave();
        post({ id: m.id, type: "opened", info: describe() });
        return;
      }
      case "peek": {
        const s = await loadSession().catch(() => null);
        post({ id: m.id, type: "peeked", name: s ? s.name : null });
        return;
      }
      case "restore": {
        const s = await loadSession().catch(() => null);
        if (s === null) {
          post({ id: m.id, type: "restored", info: null });
          return;
        }
        setVolume(s.volume, s.name, s.dataVersion, []);
        post({ id: m.id, type: "restored", info: describe() });
        return;
      }
      case "render": {
        if (dense.data.length === 0) throw new Error("nothing to draw: the file has no blocks");
        const t = performance.now();
        const cut = sliceDense(dense, m.yMin, m.yMax);
        const img = renderView(cut, assets, view(m), {
          longestPx: m.longestPx,
          supersample: m.supersample,
          shadow: m.shadow,
          overlay: false,
        });
        const rgba = new Uint8ClampedArray(img.width * img.height * 4);
        for (let i = 0; i < img.width * img.height; i++) {
          rgba[i * 4] = img.data[i * 3] as number;
          rgba[i * 4 + 1] = img.data[i * 3 + 1] as number;
          rgba[i * 4 + 2] = img.data[i * 3 + 2] as number;
          rgba[i * 4 + 3] = 255;
        }
        post(
          {
            id: m.id,
            type: "frame",
            width: img.width,
            height: img.height,
            rgba: rgba.buffer,
            ms: performance.now() - t,
          },
          [rgba.buffer],
        );
        return;
      }
      case "pick": {
        const cut = sliceDense(dense, m.yMin, m.yMax);
        const hit = pickCell(
          cut,
          view(m),
          { longestPx: m.longestPx, supersample: m.supersample, shadow: m.shadow, overlay: false },
          m.px,
          m.py,
        );
        if (hit === null || volume === null) {
          post({ id: m.id, type: "picked", hit: null });
          return;
        }
        const [ox, oy, oz] = dense.origin;
        const at = (c: readonly number[]): [number, number, number] => [
          (c[0] as number) + ox,
          (c[1] as number) + oy,
          (c[2] as number) + oz,
        ];
        const cell = at(hit.cell);
        post({
          id: m.id,
          type: "picked",
          hit: { block: volume.get(...cell) ?? AIR, cell, next: at(hit.next) },
        });
        return;
      }
      case "edit": {
        if (volume === null) throw new Error("open a file or start a new build first");
        const inverse = apply(m.edits);
        if (inverse.length > 0) {
          undoStack.push(inverse);
          redoStack = [];
          autosave();
        }
        post({ id: m.id, type: "edited", info: describe() });
        return;
      }
      case "undo":
      case "redo": {
        if (volume === null) throw new Error("nothing to undo");
        const from = m.type === "undo" ? undoStack : redoStack;
        const to = m.type === "undo" ? redoStack : undoStack;
        const step = from.pop();
        if (step) {
          to.push(apply(step));
          autosave();
        }
        post({ id: m.id, type: "edited", info: describe() });
        return;
      }
      case "states": {
        const short = m.name.replace(/^minecraft:/, "");
        post({
          id: m.id,
          type: "states",
          props: blockStateProps(pack?.json[`blockstates/${short}.json`]),
        });
        return;
      }
      case "convert": {
        if (volume === null) throw new Error("open a file first");
        const { bytes, warnings } = await saveAs(volume, m.format as FormatId, dataVersion);
        const copy = bytes.slice().buffer;
        post({ id: m.id, type: "converted", bytes: copy, warnings }, [copy]);
        return;
      }
    }
  } catch (err) {
    post({ id: m.id, type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
