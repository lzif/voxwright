<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
  import { onMount } from "svelte";
  import { FORMATS, type FormatId } from "../lib/formats.ts";
  import type { CellEdit, FromWorker, Info, PickResult, RenderRequest, ToWorker, WithoutId } from "../lib/protocol.ts";
  import Worker from "../lib/render.worker.ts?worker";
  import { blockString, splitBlock } from "../lib/states.ts";

  let canvas: HTMLCanvasElement;
  let worker: Worker;
  let nextId = 1;
  const waiting = new Map<number, (m: FromWorker) => void>();

  let status = $state("starting…");
  let haveAssets = $state(false);
  let blockNames = $state<string[]>([]);
  let info = $state<Info | null>(null);
  let error = $state("");
  let busy = $state(false);
  let renderMs = $state(0);
  let restorable = $state(false);

  let azimuth = $state(45);
  let elevation = $state(35);
  let yMin = $state(0);
  let yMax = $state(0);
  let format = $state<FormatId>("litematic");
  let conversionNotes = $state<string[]>([]);

  // Editing.
  type Tool = "view" | "place" | "erase" | "pick";
  let tool = $state<Tool>("view");
  let blockName = $state("minecraft:stone");
  let stateProps = $state<Record<string, string[]>>({});
  let chosen = $state<Record<string, string>>({});
  let lastPick = $state<PickResult | null>(null);

  let dragging = false;
  let moved = 0;
  let lastRequest: RenderRequest | null = null;

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
      const r: RenderRequest = wanted;
      wanted = null;
      const m = await call({ type: "render", ...r });
      if (m.type === "frame") {
        canvas.width = m.width;
        canvas.height = m.height;
        canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(m.rgba), m.width, m.height), 0, 0);
        renderMs = Math.round(m.ms);
        lastRequest = r;
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

  function describe(i: Info): void {
    info = i;
    status = `${i.name}: ${i.size.join(" × ")}, ${i.blocks} blocks`;
  }

  async function adopt(i: Info): Promise<void> {
    describe(i);
    yMin = 0;
    yMax = i.size[1] - 1;
    await draw(request(false));
  }

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
    if (m.type === "opened") await adopt(m.info);
  }

  async function startNew(): Promise<void> {
    error = "";
    const m = await call({ type: "new", width: 9, depth: 9 });
    if (m.type === "opened") {
      tool = "place";
      await adopt(m.info);
    }
  }

  async function restore(): Promise<void> {
    const m = await call({ type: "restore" });
    restorable = false;
    if (m.type === "restored" && m.info) await adopt(m.info);
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

  // -- block and state panel ------------------------------------------------------
  async function chooseBlock(name: string, props: Record<string, string> = {}): Promise<void> {
    blockName = name;
    chosen = props;
    const m = await call({ type: "states", name });
    stateProps = m.type === "states" ? m.props : {};
  }
  const currentBlock = (): string => blockString(blockName, chosen);

  // -- editing --------------------------------------------------------------------
  async function applyEdits(edits: CellEdit[]): Promise<void> {
    const m = await call({ type: "edit", edits });
    if (m.type === "edited") {
      const resized = info !== null && m.info.size[1] !== info.size[1];
      describe(m.info);
      if (resized) {
        yMin = 0;
        yMax = m.info.size[1] - 1;
      }
      await draw(request(false));
    } else if (m.type === "error") error = m.message;
  }

  async function undoRedo(kind: "undo" | "redo"): Promise<void> {
    const m = await call({ type: kind });
    if (m.type === "edited") {
      describe(m.info);
      yMin = 0;
      yMax = m.info.size[1] - 1;
      await draw(request(false));
    }
  }

  async function clickAt(e: PointerEvent): Promise<void> {
    if (!info || tool === "view" || !lastRequest) return;
    const rect = canvas.getBoundingClientRect();
    // The canvas is drawn at its own pixel size and shown scaled to fit.
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const m = await call({ type: "pick", px, py, ...lastRequest });
    if (m.type !== "picked" || m.hit === null) return;
    lastPick = m.hit;
    const { cell, next, block } = m.hit;
    if (tool === "erase") await applyEdits([{ x: cell[0], y: cell[1], z: cell[2], block: null }]);
    else if (tool === "place") await applyEdits([{ x: next[0], y: next[1], z: next[2], block: currentBlock() }]);
    else if (tool === "pick") {
      const s = splitBlock(block);
      await chooseBlock(s.name, s.props);
      tool = "place";
    }
  }

  // -- pointer and keyboard -----------------------------------------------------------
  function pointerDown(e: PointerEvent): void {
    if (!info) return;
    dragging = true;
    moved = 0;
    canvas.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: PointerEvent): void {
    if (!dragging) return;
    moved += Math.abs(e.movementX) + Math.abs(e.movementY);
    if (moved < 4) return; // a click, not a turn
    azimuth = (((azimuth + e.movementX * 0.5) % 360) + 360) % 360;
    elevation = Math.min(90, Math.max(0, elevation + e.movementY * 0.5));
    void draw(request(true));
  }
  function pointerUp(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    if (moved < 4) void clickAt(e);
    else void draw(request(false));
  }

  function turn(da: number, de: number): void {
    azimuth = (((azimuth + da) % 360) + 360) % 360;
    elevation = Math.min(90, Math.max(0, elevation + de));
    void draw(request(false));
  }
  function keydown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    const typing = target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA";
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      void undoRedo(e.shiftKey ? "redo" : "undo");
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      void undoRedo("redo");
    } else if (target === canvas && !typing) {
      const keys: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] };
      const k = keys[e.key];
      if (k) {
        e.preventDefault();
        turn(k[0], k[1]);
      }
    }
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
      blockNames = m.blockNames;
      status = haveAssets ? "open a schematic to begin" : "open a schematic to begin (no texture pack: blocks are drawn as flat colours)";
      await chooseBlock("minecraft:stone");
      const saved = await call({ type: "peek" });
      restorable = saved.type === "peeked" && saved.name !== null;
    }
  });
</script>

<svelte:window onkeydown={keydown} />

<main ondragover={(e) => e.preventDefault()} ondrop={onDrop}>
  <header>
    <h1>voxwright</h1>
    <p id="status" data-testid="status" role="status" aria-live="polite">{status}</p>
  </header>

  <section class="open" aria-label="Open or start a build">
    <label class="button">
      Open a schematic
      <input type="file" accept=".nbt,.schem,.litematic,.mcstructure" data-testid="file" onchange={(e) => { const f = e.currentTarget.files?.[0]; if (f) void load(f); }} />
    </label>
    <button onclick={startNew} data-testid="new">New build</button>
    {#if restorable}<button onclick={restore} data-testid="restore">Restore last session</button>{/if}
    <span>or drop a <code>.nbt</code>, <code>.schem</code>, <code>.litematic</code> or <code>.mcstructure</code> file here. Nothing is uploaded: the file is read in your browser, and your work is kept in this browser.</span>
  </section>

  {#if error}<p class="error" data-testid="error" role="alert">{error}</p>{/if}

  <div class="stage">
    <!-- The picture is a custom control: it takes focus, arrow keys turn it, and it has a label. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <canvas
      bind:this={canvas}
      data-testid="canvas"
      class:ready={info !== null}
      class:editing={tool !== "view" && info !== null}
      tabindex="0"
      aria-label={info ? `Drawing of ${info.name}. Arrow keys turn it.` : "Nothing is open yet"}
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerUp}
    ></canvas>

    {#if info}
      <aside aria-label="Controls">
        <h2>Tool</h2>
        <div class="tools" role="radiogroup" aria-label="Tool">
          {#each [["view", "Turn"], ["place", "Place"], ["erase", "Erase"], ["pick", "Pick"]] as [id, label]}
            <button class:on={tool === id} role="radio" aria-checked={tool === id} data-testid={`tool-${id}`} onclick={() => (tool = id as Tool)}>{label}</button>
          {/each}
        </div>
        <div class="tools">
          <button onclick={() => undoRedo("undo")} disabled={!info.canUndo} data-testid="undo" aria-keyshortcuts="Control+Z">Undo</button>
          <button onclick={() => undoRedo("redo")} disabled={!info.canRedo} data-testid="redo" aria-keyshortcuts="Control+Shift+Z">Redo</button>
        </div>

        <h2>Block</h2>
        <label class="wide">Name
          <input list="block-names" value={blockName} data-testid="block-name" onchange={(e) => chooseBlock(e.currentTarget.value.includes(":") ? e.currentTarget.value : `minecraft:${e.currentTarget.value}`)} />
        </label>
        <datalist id="block-names">{#each blockNames as n}<option value={n}></option>{/each}</datalist>
        {#each Object.entries(stateProps) as [prop, values]}
          <label class="wide">{prop}
            <select bind:value={chosen[prop]} data-testid={`state-${prop}`}>
              <option value="">(default)</option>
              {#each values as v}<option value={v}>{v}</option>{/each}
            </select>
          </label>
        {/each}
        <p class="hint" data-testid="block-string">{currentBlock()}</p>

        <h2>View</h2>
        <label>Turn <input type="range" min="0" max="359" bind:value={azimuth} onchange={() => draw(request(false))} oninput={() => draw(request(true))} data-testid="azimuth" /> <output>{Math.round(azimuth)}°</output></label>
        <label>Tilt <input type="range" min="0" max="90" bind:value={elevation} onchange={() => draw(request(false))} oninput={() => draw(request(true))} data-testid="elevation" /> <output>{Math.round(elevation)}°</output></label>
        <p class="hint">Drag the picture to turn it, or focus it and use the arrow keys. {renderMs ? `Last frame: ${renderMs} ms.` : ""}</p>

        <h2>Layers</h2>
        <label>From <input type="range" min="0" max={info.size[1] - 1} bind:value={yMin} onchange={() => { if (yMin > yMax) yMax = yMin; void draw(request(false)); }} data-testid="ymin" /> <output>{yMin}</output></label>
        <label>To <input type="range" min="0" max={info.size[1] - 1} bind:value={yMax} onchange={() => { if (yMax < yMin) yMin = yMax; void draw(request(false)); }} data-testid="ymax" /> <output>{yMax}</output></label>

        <h2>Export</h2>
        <label class="wide">Format
          <select bind:value={format} data-testid="format">
            {#each FORMATS as f}<option value={f.id}>{f.label}</option>{/each}
          </select>
        </label>
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
        {#if lastPick}<p class="hint" data-testid="last-pick">Last click: {lastPick.block} at {lastPick.cell.join(", ")}</p>{/if}
      </aside>
    {/if}
  </div>
  {#if busy}<p class="busy">working…</p>{/if}
</main>

<style>
  :global(body) { margin: 0; font: 15px/1.45 system-ui, sans-serif; color: #2b2925; background: #f4f1eb; }
  :global(:focus-visible) { outline: 3px solid #1d6fd1; outline-offset: 2px; }
  main { max-width: 1180px; margin: 0 auto; padding: 1.2rem; }
  header { display: flex; align-items: baseline; gap: 1.2rem; }
  h1 { margin: 0; font-size: 1.6rem; letter-spacing: 0.02em; }
  h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; margin: 1.2rem 0 0.4rem; color: #5d574d; }
  h3 { font-size: 0.9rem; margin: 0.8rem 0 0.2rem; }
  #status { color: #5d574d; margin: 0; }
  .open { margin: 0.8rem 0 1rem; display: flex; gap: 0.8rem; align-items: center; flex-wrap: wrap; }
  .button, button { background: #2b2925; color: #f4f1eb; border: 0; border-radius: 6px; padding: 0.5rem 0.9rem; cursor: pointer; font: inherit; }
  button:disabled { opacity: 0.45; cursor: default; }
  .button input { display: none; }
  .stage { display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: 1.2rem; align-items: start; }
  canvas { width: 100%; max-height: 80vh; object-fit: contain; background: #f4f1eb; border: 1px dashed #c9c3b6; border-radius: 8px; min-height: 240px; touch-action: none; }
  canvas.ready { border-style: solid; cursor: grab; }
  canvas.editing { cursor: crosshair; }
  aside { background: #fffdf8; border: 1px solid #e2dccf; border-radius: 8px; padding: 0.2rem 1rem 1rem; }
  aside label { display: grid; grid-template-columns: 3rem 1fr 3rem; align-items: center; gap: 0.4rem; margin: 0.2rem 0; }
  aside label.wide { grid-template-columns: 4.5rem 1fr; }
  select, input[list] { padding: 0.35rem; font: inherit; width: 100%; box-sizing: border-box; }
  aside > button { width: 100%; margin: 0.25rem 0; }
  .tools { display: flex; gap: 0.3rem; margin: 0.3rem 0; flex-wrap: wrap; }
  .tools button { flex: 1; padding: 0.4rem 0.5rem; background: #e9e3d6; color: #2b2925; }
  .tools button.on { background: #2b2925; color: #f4f1eb; }
  .hint { color: #6f695f; font-size: 0.85rem; margin: 0.3rem 0 0; word-break: break-all; }
  .error { background: #fbe3e0; color: #7a1f16; padding: 0.6rem 0.8rem; border-radius: 6px; }
  .counts { padding-left: 1.2rem; margin: 0; } .counts span { display: inline-block; min-width: 2.6rem; text-align: right; color: #5d574d; }
  ul { margin: 0; padding-left: 1.2rem; font-size: 0.88rem; }
  .busy { position: fixed; right: 1rem; bottom: 1rem; background: #2b2925; color: #f4f1eb; padding: 0.4rem 0.8rem; border-radius: 6px; }
  @media (max-width: 800px) { .stage { grid-template-columns: 1fr; } }
</style>
