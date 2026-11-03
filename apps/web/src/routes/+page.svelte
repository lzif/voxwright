<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { onMount } from "svelte";
import { FORMATS, type FormatId } from "../lib/formats.ts";
import type { FromWorker, Info, RenderRequest, ToWorker, WithoutId } from "../lib/protocol.ts";
import Worker from "../lib/render.worker.ts?worker";

let canvas: HTMLCanvasElement;
let worker: Worker;
let nextId = 1;
const waiting = new Map<number, (m: FromWorker) => void>();

let status = $state("starting…");
let haveAssets = $state(false);
let info = $state<Info | null>(null);
let error = $state("");
let busy = $state(false);
let renderMs = $state(0);

let azimuth = $state(45);
let elevation = $state(35);
let yMin = $state(0);
let yMax = $state(0);
let format = $state<FormatId>("litematic");
let conversionNotes = $state<string[]>([]);
let dragging = false;

function call(msg: WithoutId<ToWorker>, transfer: Transferable[] = []): Promise<FromWorker> {
  const id = nextId++;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    worker.postMessage({ ...msg, id } as ToWorker, transfer);
  });
}

// Only the latest frame request matters: draw one at a time, then the newest.
let drawing = false;
let wanted: RenderRequest | null = null;
async function draw(req: RenderRequest): Promise<void> {
  wanted = req;
  if (drawing) return;
  drawing = true;
  while (wanted) {
    const r = wanted;
    wanted = null;
    const m = await call({ type: "render", ...r });
    if (m.type === "frame") {
      canvas.width = m.width;
      canvas.height = m.height;
      canvas
        .getContext("2d")
        ?.putImageData(new ImageData(new Uint8ClampedArray(m.rgba), m.width, m.height), 0, 0);
      renderMs = Math.round(m.ms);
    } else if (m.type === "error") error = m.message;
  }
  drawing = false;
}

const request = (quick: boolean): RenderRequest => ({
  azimuth,
  elevation,
  yMin,
  yMax,
  longestPx: quick ? 360 : 900,
  supersample: quick ? 1 : 2,
  shadow: !quick,
});

async function load(file: File): Promise<void> {
  error = "";
  conversionNotes = [];
  busy = true;
  status = `reading ${file.name}…`;
  const m = await call({ type: "open", bytes: await file.arrayBuffer(), name: file.name });
  busy = false;
  if (m.type === "error") {
    error = m.message;
    status = "could not open that file";
    return;
  }
  if (m.type !== "opened") return;
  info = m.info;
  yMin = 0;
  yMax = m.info.size[1] - 1;
  status = `${m.info.name}: ${m.info.size.join(" × ")}, ${m.info.blocks} blocks`;
  await draw(request(false));
}

async function convert(): Promise<void> {
  error = "";
  const m = await call({ type: "convert", format });
  if (m.type === "error") {
    error = m.message;
    return;
  }
  if (m.type !== "converted") return;
  conversionNotes = m.warnings;
  const ext = FORMATS.find((f) => f.id === format)?.ext ?? "";
  const base = (info?.name ?? "structure").replace(/\.[^.]+$/, "");
  const url = URL.createObjectURL(new Blob([m.bytes]));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

function pointerDown(e: PointerEvent): void {
  if (!info) return;
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
}
function pointerMove(e: PointerEvent): void {
  if (!dragging) return;
  azimuth = (((azimuth + e.movementX * 0.5) % 360) + 360) % 360;
  elevation = Math.min(90, Math.max(0, elevation + e.movementY * 0.5));
  void draw(request(true));
}
function pointerUp(): void {
  if (!dragging) return;
  dragging = false;
  void draw(request(false));
}

function onDrop(e: DragEvent): void {
  e.preventDefault();
  const f = e.dataTransfer?.files[0];
  if (f) void load(f);
}

onMount(async () => {
  worker = new Worker();
  worker.onerror = (e) => {
    error = `the viewer's worker failed to start: ${e.message || "see the browser console"}`;
    status = "the viewer could not start";
  };
  worker.onmessage = (e: MessageEvent<FromWorker>) => {
    const resolve = waiting.get(e.data.id);
    if (resolve) {
      waiting.delete(e.data.id);
      resolve(e.data);
    }
  };
  const m = await call({ type: "init", packUrl: new URL("pack/pack.json", document.baseURI).href });
  if (m.type === "error") {
    error = m.message;
    status = "the viewer could not start";
  } else if (m.type === "ready") {
    haveAssets = m.haveAssets;
    status = haveAssets
      ? "open a schematic to begin"
      : "open a schematic to begin (no texture pack: blocks are drawn as flat colours)";
  }
});
</script>

<main ondragover={(e) => e.preventDefault()} ondrop={onDrop}>
  <header>
    <h1>voxwright</h1>
    <p id="status" data-testid="status">{status}</p>
  </header>

  <section class="open">
    <label class="button">
      Open a schematic
      <input type="file" accept=".nbt,.schem,.litematic,.mcstructure" data-testid="file" onchange={(e) => { const f = e.currentTarget.files?.[0]; if (f) void load(f); }} />
    </label>
    <span>or drop a <code>.nbt</code>, <code>.schem</code>, <code>.litematic</code> or <code>.mcstructure</code> file here. Nothing is uploaded: the file is read in your browser.</span>
  </section>

  {#if error}<p class="error" data-testid="error">{error}</p>{/if}

  <div class="stage">
    <canvas
      bind:this={canvas}
      data-testid="canvas"
      class:ready={info !== null}
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerUp}
    ></canvas>

    {#if info}
      <aside>
        <h2>View</h2>
        <label>Turn <input type="range" min="0" max="359" bind:value={azimuth} onchange={() => draw(request(false))} oninput={() => draw(request(true))} data-testid="azimuth" /> <output>{Math.round(azimuth)}°</output></label>
        <label>Tilt <input type="range" min="0" max="90" bind:value={elevation} onchange={() => draw(request(false))} oninput={() => draw(request(true))} data-testid="elevation" /> <output>{Math.round(elevation)}°</output></label>
        <p class="hint">You can also drag the picture to turn it. {renderMs ? `Last frame: ${renderMs} ms.` : ""}</p>

        <h2>Layers</h2>
        <label>From <input type="range" min="0" max={info.size[1] - 1} bind:value={yMin} onchange={() => { if (yMin > yMax) yMax = yMin; void draw(request(false)); }} data-testid="ymin" /> <output>{yMin}</output></label>
        <label>To <input type="range" min="0" max={info.size[1] - 1} bind:value={yMax} onchange={() => { if (yMax < yMin) yMin = yMax; void draw(request(false)); }} data-testid="ymax" /> <output>{yMax}</output></label>

        <h2>Convert</h2>
        <select bind:value={format} data-testid="format">
          {#each FORMATS as f}<option value={f.id}>{f.label}</option>{/each}
        </select>
        <button onclick={convert} data-testid="convert">Convert and download</button>
        {#if info.loss.length || conversionNotes.length}
          <h3>Loss report</h3>
          <ul data-testid="loss">
            {#each [...new Set([...info.loss, ...conversionNotes])] as line}<li>{line}</li>{/each}
          </ul>
        {/if}

        <h2>Blocks</h2>
        <ol class="counts" data-testid="counts">
          {#each info.counts.slice(0, 12) as [name, n]}<li><span>{n}</span> {name.replace("minecraft:", "")}</li>{/each}
        </ol>
      </aside>
    {/if}
  </div>
  {#if busy}<p class="busy">working…</p>{/if}
</main>

<style>
  :global(body) { margin: 0; font: 15px/1.45 system-ui, sans-serif; color: #2b2925; background: #f4f1eb; }
  main { max-width: 1180px; margin: 0 auto; padding: 1.2rem; }
  header { display: flex; align-items: baseline; gap: 1.2rem; }
  h1 { margin: 0; font-size: 1.6rem; letter-spacing: 0.02em; }
  h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; margin: 1.2rem 0 0.4rem; color: #6b655b; }
  h3 { font-size: 0.9rem; margin: 0.8rem 0 0.2rem; }
  #status { color: #6b655b; margin: 0; }
  .open { margin: 0.8rem 0 1rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
  .button, button { background: #2b2925; color: #f4f1eb; border: 0; border-radius: 6px; padding: 0.5rem 0.9rem; cursor: pointer; font: inherit; }
  .button input { display: none; }
  .stage { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 1.2rem; align-items: start; }
  canvas { width: 100%; max-height: 80vh; object-fit: contain; background: #f4f1eb; border: 1px dashed #c9c3b6; border-radius: 8px; min-height: 240px; touch-action: none; }
  canvas.ready { border-style: solid; cursor: grab; }
  aside { background: #fffdf8; border: 1px solid #e2dccf; border-radius: 8px; padding: 0.2rem 1rem 1rem; }
  aside label { display: grid; grid-template-columns: 3rem 1fr 3rem; align-items: center; gap: 0.4rem; margin: 0.2rem 0; }
  select, aside button { width: 100%; margin: 0.25rem 0; }
  select { padding: 0.4rem; font: inherit; }
  .hint { color: #8a8378; font-size: 0.85rem; margin: 0.3rem 0 0; }
  .error { background: #fbe3e0; color: #7a1f16; padding: 0.6rem 0.8rem; border-radius: 6px; }
  .counts { padding-left: 1.2rem; margin: 0; } .counts span { display: inline-block; min-width: 2.6rem; text-align: right; color: #6b655b; }
  ul { margin: 0; padding-left: 1.2rem; font-size: 0.88rem; }
  .busy { position: fixed; right: 1rem; bottom: 1rem; background: #2b2925; color: #f4f1eb; padding: 0.4rem 0.8rem; border-radius: 6px; }
  @media (max-width: 800px) { .stage { grid-template-columns: 1fr; } }
</style>
