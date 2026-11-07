// SPDX-License-Identifier: AGPL-3.0-only

// Does the heavy work off the main thread: decoding files, drawing frames and
// writing converted files. Holds the asset pack and the open schematic.

import type { DenseVolume, Volume } from "@voxwright/core";
import { type AssetSource, renderView, sliceDense, type View } from "@voxwright/render";
import { assetsFromPack, fetchPack } from "./assets.ts";
import { describeVolume } from "./describe.ts";
import { type Carried, type FormatId, openFile, saveAs } from "./formats.ts";
import { mergePacks, type Pack } from "./pack-extract.ts";
import type { FromWorker, ToWorker } from "./protocol.ts";

let assets: AssetSource | null = null;
let sitePack: Pack | null = null;
let userPack: Pack | null = null;
let volume: Volume | null = null;
let dense: DenseVolume | null = null;
let dataVersion: number | null = null;
let carry: Carried | undefined;

const post = (m: FromWorker, transfer: Transferable[] = []): void =>
  (self as unknown as Worker).postMessage(m, transfer);

/** The site's pack with the user's laid over it. */
async function useAssets(): Promise<void> {
  const pack = mergePacks(sitePack, userPack);
  assets = pack ? await assetsFromPack(pack) : null;
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  try {
    switch (m.type) {
      case "init": {
        sitePack = await fetchPack(m.packUrl);
        await useAssets();
        post({ id: m.id, type: "ready", haveAssets: assets !== null });
        return;
      }
      case "userpack": {
        userPack = m.pack;
        await useAssets();
        post({ id: m.id, type: "ready", haveAssets: assets !== null });
        return;
      }
      case "open": {
        const opened = await openFile(new Uint8Array(m.bytes), m.name);
        volume = opened.volume;
        dataVersion = opened.dataVersion;
        carry = opened.carry;
        dense = null; // made when a frame is first asked for
        post({
          id: m.id,
          type: "opened",
          info: describeVolume(m.name, volume, dataVersion, opened.loss),
        });
        return;
      }
      case "render": {
        if (volume === null) throw new Error("nothing to draw: open a file first");
        dense ??= volume.toDense();
        if (dense.data.length === 0) throw new Error("nothing to draw: the file has no blocks");
        const t = performance.now();
        const view: View = { azimuth: m.azimuth, elevation: m.elevation, label: "" };
        const cut = sliceDense(dense, m.yMin, m.yMax);
        const img = renderView(cut, assets, view, {
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
      case "convert": {
        if (volume === null) throw new Error("open a file first");
        const { bytes, warnings } = await saveAs(volume, m.format as FormatId, dataVersion, carry);
        const copy = bytes.slice().buffer;
        post({ id: m.id, type: "converted", bytes: copy, warnings }, [copy]);
        return;
      }
    }
  } catch (err) {
    post({ id: m.id, type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
