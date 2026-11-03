<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import type { Volume } from "@voxwright/core";
import { sectionKeysAround } from "@voxwright/render";
import type { RendererStats, WebglRenderer } from "@voxwright/render/webgl";
import { onMount } from "svelte";
import { decodePack, fetchPack } from "../lib/assets.ts";
import { describeVolume } from "../lib/describe.ts";
import { FORMATS, type FormatId, openFile } from "../lib/formats.ts";
import type { FromWorker, Info, RenderRequest, ToWorker, WithoutId } from "../lib/protocol.ts";
import Worker from "../lib/render.worker.ts?worker";

// "webgl": the GPU renderer in render/webgl, drawing on this page's thread with a pool of mesher
// workers. "cpu": the software rasterizer in a worker, for browsers without WebGL2.
type Kind = "starting" | "webgl" | "cpu";

let canvas: HTMLCanvasElement;
let worker: Worker;
let renderer: WebglRenderer | null = null;
let volume: Volume | null = null;
let fileBytes: Uint8Array | null = null;
let workerHolds = false;
let kind = $state<Kind>("starting");
let camMode = $state<"orbit" | "fly">("orbit");
let timings = $state({ parseMs: 0, describeMs: 0, firstFrameMs: 0 });
let stats = $state<RendererStats | null>(null);
let placeholders = $state<string[]>([]);
let statsTimer = 0;
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

const nextPaint = (): Promise<void> => new Promise((r) => setTimeout(r, 30));

/** Read a file on this thread (the renderer needs the volume here) and hand it to the GPU renderer. */
async function loadForGpu(file: File): Promise<void> {
  error = "";
  conversionNotes = [];
  busy = true;
  status = `reading ${file.name}…`;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await nextPaint(); // let the status show before the parse holds the thread
    const t0 = performance.now();
    const opened = await openFile(bytes, file.name);
    const t1 = performance.now();
    const described = describeVolume(file.name, opened.volume, opened.dataVersion, opened.loss);
    const t2 = performance.now();
    if (described.blocks === 0) throw new Error("nothing to draw: the file has no blocks");
    volume = opened.volume;
    fileBytes = bytes;
    workerHolds = false;
    info = described;
    yMin = 0;
    yMax = described.size[1] - 1;
    timings = { parseMs: t1 - t0, describeMs: t2 - t1, firstFrameMs: 0 };
    status = `${described.name}: ${described.size.join(" × ")}, ${described.blocks} blocks`;
    const r = renderer as WebglRenderer;
    r.setVolume(volume);
    r.setSlice(null);
    r.setCamera("orbit");
    camMode = "orbit";
    await r.whenIdle();
    const s = r.stats();
    timings.firstFrameMs = s.firstFullFrameMs ?? 0;
    placeholders = s.fallbackBlocks.map((n) => n.replace("minecraft:", ""));
    refreshStats();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    status = "could not open that file";
  } finally {
    busy = false;
  }
}

function refreshStats(): void {
  if (renderer) stats = renderer.stats();
}

function applySlice(): void {
  if (!renderer || !info) return;
  const full = yMin === 0 && yMax === info.size[1] - 1;
  renderer.setSlice(full ? null : { y0: info.origin[1] + yMin, y1: info.origin[1] + yMax });
}

function setCamMode(mode: "orbit" | "fly"): void {
  camMode = mode;
  renderer?.setCamera(mode);
  if (mode === "fly") canvas.focus();
}

function setAngles(): void {
  renderer?.setOrbit({ azimuth, elevation });
}

async function load(file: File): Promise<void> {
  if (kind === "webgl") return loadForGpu(file);
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
  if (kind === "webgl" && !workerHolds && fileBytes && info) {
    // The converter lives in the worker, which has not seen this file yet.
    const copy = fileBytes.slice().buffer;
    const opened = await call({ type: "open", bytes: copy, name: info.name }, [copy]);
    if (opened.type === "error") {
      error = opened.message;
      return;
    }
    workerHolds = true;
  }
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
  if (kind !== "cpu" || !info) return;
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
}
function pointerMove(e: PointerEvent): void {
  if (kind !== "cpu" || !dragging) return;
  azimuth = (((azimuth + e.movementX * 0.5) % 360) + 360) % 360;
  elevation = Math.min(90, Math.max(0, elevation + e.movementY * 0.5));
  void draw(request(true));
}
function pointerUp(): void {
  if (kind !== "cpu" || !dragging) return;
  dragging = false;
  void draw(request(false));
}

function onDrop(e: DragEvent): void {
  e.preventDefault();
  const f = e.dataTransfer?.files[0];
  if (f) void load(f);
}

/** A throwaway canvas, so that the page's own canvas stays free for either kind of context. */
function hasWebgl2(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

async function startGpu(): Promise<boolean> {
  try {
    const [{ createWebglRenderer }, pack] = await Promise.all([
      import("@voxwright/render/webgl"),
      fetchPack(new URL("pack/pack.json", document.baseURI).href),
    ]);
    const decoded = pack ? await decodePack(pack) : null;
    const r = createWebglRenderer({ pack: decoded });
    r.onCamera = (p) => {
      azimuth = p.azimuth;
      elevation = p.elevation;
    };
    r.mount(canvas);
    renderer = r;
    haveAssets = decoded !== null;
    return true;
  } catch (err) {
    console.warn("WebGL2 renderer unavailable, using the software renderer:", err);
    renderer?.dispose();
    renderer = null;
    return false;
  }
}

onMount(() => {
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
  (async () => {
    if (hasWebgl2() && (await startGpu())) {
      kind = "webgl";
      statsTimer = window.setInterval(refreshStats, 500);
      status = haveAssets
        ? "open a schematic to begin"
        : "open a schematic to begin (no texture pack: blocks are drawn as flat colours)";
      // Test and measurement hook: the page's own state, and one way to change a block.
      (window as unknown as { __voxwright: unknown }).__voxwright = {
        renderer,
        timings: () => $state.snapshot(timings),
        volume: () => volume,
        /** Change one block; report ms until its mesh is swapped in and until a frame shows it. */
        async edit(
          x: number,
          y: number,
          z: number,
          block: string,
        ): Promise<{ appliedMs: number; visibleMs: number }> {
          if (!volume || !renderer) throw new Error("open a file first");
          const t = performance.now();
          volume.set(x, y, z, block);
          renderer.markDirty(sectionKeysAround(x, y, z));
          await renderer.whenMeshed();
          const appliedMs = performance.now() - t;
          await renderer.whenIdle();
          return { appliedMs, visibleMs: performance.now() - t };
        },
      };
      return;
    }
    kind = "cpu";
    const m = await call({
      type: "init",
      packUrl: new URL("pack/pack.json", document.baseURI).href,
    });
    if (m.type === "error") {
      error = m.message;
      status = "the viewer could not start";
    } else if (m.type === "ready") {
      haveAssets = m.haveAssets;
      status = haveAssets
        ? "open a schematic to begin"
        : "open a schematic to begin (no texture pack: blocks are drawn as flat colours)";
    }
  })();
  return () => {
    window.clearInterval(statsTimer);
    renderer?.dispose();
    worker.terminate();
  };
});
</script>

<main ondragover={(e) => e.preventDefault()} ondrop={onDrop}>
  <header>
    <h1>voxwright</h1>
    <p id="status" data-testid="status">{status}</p>
    <p class="engine" data-testid="renderer" data-kind={kind}>{kind === "webgl" ? "GPU renderer" : kind === "cpu" ? "software renderer (no WebGL2)" : ""}</p>
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
      class:gl={kind === "webgl"}
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerUp}
    ></canvas>

    {#if info}
      <aside>
        <h2>View</h2>
        {#if kind === "webgl"}
          <div class="seg" role="group" aria-label="Camera">
            <button class:on={camMode === "orbit"} onclick={() => setCamMode("orbit")} data-testid="mode-orbit">Orbit</button>
            <button class:on={camMode === "fly"} onclick={() => setCamMode("fly")} data-testid="mode-fly">Fly</button>
          </div>
          <p class="hint" data-testid="camera-hint">{camMode === "orbit" ? "Drag to turn, scroll to zoom, shift-drag or right-drag to move sideways." : "Click the picture, then W A S D to move, Space and C for up and down, Shift to go faster, scroll to change speed. Esc lets go of the mouse."}</p>
        {/if}
        <label>Turn <input type="range" min="0" max="359" bind:value={azimuth} onchange={() => kind === "cpu" && draw(request(false))} oninput={() => (kind === "webgl" ? setAngles() : draw(request(true)))} data-testid="azimuth" /> <output>{Math.round(azimuth)}°</output></label>
        <label>Tilt <input type="range" min={kind === "webgl" ? -89 : 0} max={kind === "webgl" ? 89 : 90} bind:value={elevation} onchange={() => kind === "cpu" && draw(request(false))} oninput={() => (kind === "webgl" ? setAngles() : draw(request(true)))} data-testid="elevation" /> <output>{Math.round(elevation)}°</output></label>
        {#if kind === "cpu"}<p class="hint">You can also drag the picture to turn it. {renderMs ? `Last frame: ${renderMs} ms.` : ""}</p>{/if}

        <h2>Layers</h2>
        <label>From <input type="range" min="0" max={info.size[1] - 1} bind:value={yMin} oninput={() => { if (kind === "webgl") { if (yMin > yMax) yMax = yMin; applySlice(); } }} onchange={() => { if (yMin > yMax) yMax = yMin; if (kind === "cpu") void draw(request(false)); }} data-testid="ymin" /> <output>{yMin}</output></label>
        <label>To <input type="range" min="0" max={info.size[1] - 1} bind:value={yMax} oninput={() => { if (kind === "webgl") { if (yMax < yMin) yMin = yMax; applySlice(); } }} onchange={() => { if (yMax < yMin) yMin = yMax; if (kind === "cpu") void draw(request(false)); }} data-testid="ymax" /> <output>{yMax}</output></label>

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

        {#if kind === "webgl" && stats}
          <h2>Renderer</h2>
          <p class="hint" data-testid="stats">
            {stats.sections} sections, {stats.fps.toFixed(0)} fps · opened in {Math.round(timings.parseMs)} ms,
            on screen after {Math.round(timings.firstFrameMs)} ms · {stats.gpu}
          </p>
          {#if placeholders.length}
            <p class="hint" data-testid="placeholders">Drawn as magenta placeholder cubes (no model): {placeholders.join(", ")}.</p>
          {/if}
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
  .seg { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; }
  .seg button { background: #e2dccf; color: #2b2925; }
  .seg button.on { background: #2b2925; color: #f4f1eb; }
  .engine { margin: 0 0 0 auto; font-size: 0.8rem; color: #8a8378; }
  canvas.gl { height: min(72vh, 760px); max-height: none; outline: none; }
  .hint { color: #8a8378; font-size: 0.85rem; margin: 0.3rem 0 0; }
  .error { background: #fbe3e0; color: #7a1f16; padding: 0.6rem 0.8rem; border-radius: 6px; }
  .counts { padding-left: 1.2rem; margin: 0; } .counts span { display: inline-block; min-width: 2.6rem; text-align: right; color: #6b655b; }
  ul { margin: 0; padding-left: 1.2rem; font-size: 0.88rem; }
  .busy { position: fixed; right: 1rem; bottom: 1rem; background: #2b2925; color: #f4f1eb; padding: 0.4rem 0.8rem; border-radius: 6px; }
  @media (max-width: 800px) { .stage { grid-template-columns: 1fr; } }
</style>
