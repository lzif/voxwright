<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import type { Volume } from "@voxwright/core";
import type { RendererStats, WebglRenderer } from "@voxwright/render/webgl";
import { onMount, untrack } from "svelte";
import { asset } from "$app/paths";
import type { AssetPath } from "$app/types";
import { decodePack, fetchPack } from "../lib/assets.ts";
import { Autosave } from "../lib/autosave.svelte.ts";
import BlockPalette from "../lib/components/BlockPalette.svelte";
import BlockStatePanel from "../lib/components/BlockStatePanel.svelte";
import BottomSheet from "../lib/components/BottomSheet.svelte";
import BottomToolbar, { type SheetType } from "../lib/components/BottomToolbar.svelte";
import EditToolbar from "../lib/components/EditToolbar.svelte";
import PackPanel from "../lib/components/PackPanel.svelte";
import PerfOverlay from "../lib/components/PerfOverlay.svelte";
import RestoreDialog from "../lib/components/RestoreDialog.svelte";
import SelectionPanel from "../lib/components/SelectionPanel.svelte";
import SiteFooter from "../lib/components/SiteFooter.svelte";
import ThumbCluster from "../lib/components/ThumbCluster.svelte";
import TouchReticle from "../lib/components/TouchReticle.svelte";
import { describeVolume } from "../lib/describe.ts";
import {
  CURSOR_OFFSET_STEP_PX,
  DEFAULT_CURSOR_OFFSET_PX,
  followLayerBounds,
  MAX_CURSOR_OFFSET_PX,
  MIN_CURSOR_OFFSET_PX,
  normalizeCursorOffset,
  packBlockIds,
  parseCursorOffset,
} from "../lib/editing.ts";
import { EditSession } from "../lib/editor-session.svelte.ts";
import {
  type Carried,
  FORMATS,
  type FormatId,
  type Opened,
  openFile,
  saveAs,
} from "../lib/formats.ts";
import { type GestureIntent, pointerEventToSample } from "../lib/gestures.ts";
import { mergePacks, type Pack } from "../lib/pack-extract.ts";
import type { FromWorker, Info, RenderRequest, ToWorker, WithoutId } from "../lib/protocol.ts";
import Worker from "../lib/render.worker.ts?worker";
import { restoreSnapshot, type Snapshot } from "../lib/snapshot.ts";
import { TouchRouter } from "../lib/touch-router.ts";
import {
  loadUserPack,
  readUserPack,
  removeUserPack,
  type StoredPack,
  saveUserPack,
} from "../lib/user-pack.ts";

// "webgl": the GPU renderer in render/webgl, drawing on this page's thread with a pool of mesher
// workers. "cpu": the software rasterizer in a worker, for browsers without WebGL2.
type Kind = "starting" | "webgl" | "cpu";

let canvas: HTMLCanvasElement;
let worker: Worker;
let renderer = $state.raw<WebglRenderer | null>(null);
let volume: Volume | null = null;
let dataVersion: number | null = null;
let carry: Carried | undefined;
let packBlocks: string[] = [];
let kind = $state<Kind>("starting");
// Editing needs the GPU renderer (it supplies the picking ray).
// With WebGL2 available, editing is supported on both mouse/keyboard and touch devices.
// The CPU software renderer remains a viewer.
let canEdit = $derived(kind === "webgl");

type LayoutMode = "auto" | "desktop" | "mobile";
let layoutOverride = $state<LayoutMode>("auto");
let mqDesktop = $state(false);
let leftHanded = $state(false);
/** How far above the fingertip the touch cursor sits (px); every session the page creates starts with it. */
let cursorOffset = $state(DEFAULT_CURSOR_OFFSET_PX);
let activeSheet = $state<SheetType>("none");

const isMobileLayout = $derived.by(() => {
  if (layoutOverride === "mobile") return true;
  if (layoutOverride === "desktop") return false;
  return !mqDesktop;
});

function setLayoutMode(mode: LayoutMode): void {
  layoutOverride = mode;
  try {
    localStorage.setItem("voxwright.layout", mode);
  } catch {}
}

function setLeftHanded(lh: boolean): void {
  leftHanded = lh;
  try {
    localStorage.setItem("voxwright.lefthanded", String(lh));
  } catch {}
}

function setCursorOffset(px: number): void {
  cursorOffset = normalizeCursorOffset(px);
  if (session) session.cursorOffsetPx = cursorOffset;
  try {
    localStorage.setItem("voxwright.cursoroffset", String(cursorOffset));
  } catch {}
}

function toggleSheet(sheet: SheetType): void {
  activeSheet = activeSheet === sheet ? "none" : sheet;
}
let session = $state.raw<EditSession | null>(null);
let stopSession: (() => void) | null = null;
let gestureCleanup: (() => void) | null = null;
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
// What the last export could not carry over; `null` until a file has been exported.
let conversionNotes = $state<string[] | null>(null);
let dragging = false;

// Autosave of the edited volume, and the offer to restore the last one.
const autosave = new Autosave();
let offer = $state.raw<Snapshot | "damaged" | null>(null);
let offerBusy = $state(false);
let offerError = $state("");

// The texture pack: the site's own (if it ships one) with the user's laid over it.
let sitePack = $state.raw<Pack | null>(null);
let userPack = $state.raw<StoredPack | null>(null);
let packBusy = $state(false);
let packError = $state("");
let packNote = $state("");

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
  if (!confirmDiscard()) return;
  error = "";
  conversionNotes = null;
  busy = true;
  status = `reading ${file.name}…`;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await nextPaint(); // let the status show before the parse holds the thread
    const t0 = performance.now();
    const opened = await openFile(bytes, file.name);
    await showVolume(opened, file.name, 0, performance.now() - t0);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    status = "could not open that file";
  } finally {
    busy = false;
  }
}

/**
 * Put a volume on screen and, if the page can edit, start an editing session on it. `baseEdits` is
 * the number of edits a restored autosave already carries (their undo history is gone).
 */
async function showVolume(
  opened: Opened,
  name: string,
  baseEdits: number,
  parseMs: number,
): Promise<void> {
  const t1 = performance.now();
  const described = describeVolume(name, opened.volume, opened.dataVersion, opened.loss);
  const t2 = performance.now();
  if (described.blocks === 0) throw new Error("nothing to draw: the file has no blocks");
  volume = opened.volume;
  dataVersion = opened.dataVersion;
  carry = opened.carry;
  info = described;
  yMin = 0;
  yMax = described.size[1] - 1;
  timings = { parseMs, describeMs: t2 - t1, firstFrameMs: 0 };
  status = `${described.name}: ${described.size.join(" × ")}, ${described.blocks} blocks`;
  const r = renderer as WebglRenderer;
  endSession();
  r.setVolume(volume);
  r.setSlice(null);
  r.setCamera("orbit");
  camMode = "orbit";
  if (canEdit) startSession(r, opened.volume, opened.dataVersion, baseEdits);
  await r.whenIdle();
  const s = r.stats();
  timings.firstFrameMs = s.firstFullFrameMs ?? 0;
  placeholders = s.fallbackBlocks.map((n) => n.replace("minecraft:", ""));
  refreshStats();
}

function startSession(r: WebglRenderer, v: Volume, dv: number | null, baseEdits: number): void {
  const s = new EditSession({
    renderer: r,
    canvas,
    volume: v,
    dataVersion: dv,
    packBlocks,
    baseEdits,
    cursorOffsetPx: cursorOffset,
  });
  stopSession = s.attach();
  session = s;
}

function endSession(): void {
  stopSession?.();
  stopSession = null;
  session?.dispose();
  session = null;
}

/** Opening another file drops the edits made to this one, so ask first. */
function confirmDiscard(): boolean {
  if (!session?.unsaved) return true;
  const go = window.confirm(
    "You have edits that are not exported yet. Opening another file discards them. Continue?",
  );
  if (go) void autosave.clear(); // the user chose to drop them; do not offer them again on the next visit
  return go;
}

// Autosave follows the session; a change to it (an edit, undo, redo) schedules a snapshot.
$effect(() => {
  const s = session;
  untrack(() =>
    autosave.watch(
      s === null
        ? null
        : {
            session: s,
            meta: () => ({
              name: info?.name ?? "structure",
              dataVersion: s.dataVersion,
              loss: info?.loss ?? [],
              carry,
            }),
          },
    ),
  );
});
$effect(() => {
  const s = session;
  if (s === null) return;
  void s.revision;
  untrack(() => autosave.changed());
});

const when = (ms: number): string => new Date(ms).toLocaleString();

async function restoreSaved(): Promise<void> {
  const snap = offer;
  if (snap === null || snap === "damaged") return;
  offerBusy = true;
  offerError = "";
  error = "";
  conversionNotes = null;
  try {
    status = `restoring ${snap.name}…`;
    await nextPaint();
    const t0 = performance.now();
    const v = restoreSnapshot(snap);
    await showVolume(
      { volume: v, dataVersion: snap.dataVersion, loss: snap.loss, carry: snap.carry },
      snap.name,
      snap.edits,
      performance.now() - t0,
    );
    offer = null;
    status = `restored ${snap.name} from autosave (${snap.edits} edit${snap.edits === 1 ? "" : "s"})`;
    session?.noteRestored(snap.edits, when(snap.savedAt));
  } catch (err) {
    offerError = `The saved session could not be restored: ${err instanceof Error ? err.message : String(err)}`;
    status = idleStatus();
  } finally {
    offerBusy = false;
  }
}

async function discardSaved(): Promise<void> {
  offerBusy = true;
  await autosave.clear();
  offerBusy = false;
  offer = null;
  offerError = "";
}

/** A saved session from an earlier visit? Offer it. Only a page that can edit has any use for it. */
async function checkForSaved(): Promise<void> {
  if (!canEdit) return;
  const found = await autosave.peek();
  if (found !== null) offer = found;
}

const idleStatus = (): string =>
  haveAssets
    ? "open a schematic to begin"
    : "open a schematic to begin (no texture pack: blocks are drawn as flat colours)";

// -- Texture packs ------------------------------------------------------------------------------

/** Lay the user's pack over the site's and give the result to whichever renderer is running. */
async function applyPacks(): Promise<void> {
  const merged = mergePacks(sitePack, userPack?.pack ?? null);
  if (kind === "webgl" && renderer) {
    const decoded = merged ? await decodePack(merged) : null;
    renderer.setPack(decoded);
    packBlocks = merged ? packBlockIds(merged.json) : [];
    if (session) session.packBlocks = packBlocks;
    haveAssets = decoded !== null;
    if (info) {
      await renderer.whenIdle();
      placeholders = renderer.stats().fallbackBlocks.map((n) => n.replace("minecraft:", ""));
    }
  } else if (kind === "cpu") {
    const m = await call({ type: "userpack", pack: userPack?.pack ?? null });
    if (m.type === "ready") haveAssets = m.haveAssets;
    if (info) await draw(request(false));
  }
  if (info === null) status = idleStatus();
}

async function addPack(file: File): Promise<void> {
  packError = "";
  packNote = "";
  packBusy = true;
  try {
    const { stored, skipped } = await readUserPack(file);
    userPack = stored;
    packNote = skipped.length
      ? `Ignored ${skipped.length} file${skipped.length === 1 ? "" : "s"} that were not valid JSON.`
      : "";
    try {
      await saveUserPack(stored);
    } catch (err) {
      packNote =
        `${packNote} The pack is in use now but could not be kept in this browser (${err instanceof Error ? err.message : String(err)}), so it will be gone after a reload.`.trim();
    }
    await applyPacks();
  } catch (err) {
    packError = err instanceof Error ? err.message : String(err);
  } finally {
    packBusy = false;
  }
}

async function removePack(): Promise<void> {
  packBusy = true;
  packError = "";
  packNote = "";
  userPack = null;
  await removeUserPack();
  await applyPacks();
  packBusy = false;
}

// The block counts follow the edits, a moment after the last one.
$effect(() => {
  const s = session;
  if (s === null) return;
  void s.revision;
  const timer = window.setTimeout(() => {
    if (info === null) return;
    const d = describeVolume(info.name, s.volume, s.dataVersion, info.loss);
    followBounds(d);
  }, 250);
  return () => window.clearTimeout(timer);
});

/** Everything the open file and the last export could not carry over, each line once. */
const lossLines = $derived([...new Set([...(info?.loss ?? []), ...(conversionNotes ?? [])])]);

/**
 * Take the counts and the size of the edited volume. The layer sliders follow its new height and
 * keep the layers they showed; with an empty volume (no bounds) the old size stays.
 */
function followBounds(d: Info): void {
  if (info === null) return;
  const old = info;
  if (d.size[1] === 0) {
    info = { ...old, counts: d.counts, blocks: d.blocks };
    return;
  }
  const wasFull = yMin === 0 && yMax === old.size[1] - 1;
  const next = followLayerBounds(
    { yMin, yMax },
    old.size[1],
    old.origin[1],
    d.size[1],
    d.origin[1],
  );
  info = { ...old, counts: d.counts, blocks: d.blocks, size: d.size, origin: d.origin };
  yMin = next.yMin;
  yMax = next.yMax;
  if (!wasFull) applySlice();
}

function refreshStats(): void {
  if (renderer) stats = renderer.stats();
}

function applySlice(): void {
  if (!renderer || !info) return;
  const full = yMin === 0 && yMax === info.size[1] - 1;
  const range = full ? null : { y0: info.origin[1] + yMin, y1: info.origin[1] + yMax };
  renderer.setSlice(range);
  session?.setSlice(range);
}

function setCamMode(mode: "orbit" | "fly"): void {
  camMode = mode;
  renderer?.setCamera(mode);
  session?.setCameraMode(mode);
  if (mode === "fly") canvas.focus();
}

function setAngles(): void {
  renderer?.setOrbit({ azimuth, elevation });
}

async function load(file: File): Promise<void> {
  if (kind === "webgl") return loadForGpu(file);
  error = "";
  conversionNotes = null;
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

function download(bytes: Uint8Array | ArrayBuffer, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Write the open volume, edits included, to a new file. The file that was opened is never touched. */
async function convert(): Promise<void> {
  error = "";
  const ext = FORMATS.find((f) => f.id === format)?.ext ?? "";
  const base = (info?.name ?? "structure").replace(/\.[^.]+$/, "");
  if (kind === "webgl") {
    if (!volume) return;
    try {
      const { bytes, warnings } = await saveAs(volume, format, dataVersion, carry);
      conversionNotes = warnings;
      const edited = session !== null && session.editCount > 0;
      download(bytes, `${base}${edited ? "-edited" : ""}${ext}`);
      session?.markSaved();
      void autosave.clear(); // exported: the file is the copy now, so the autosave is not needed
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    return;
  }
  const m = await call({ type: "convert", format });
  if (m.type === "error") {
    error = m.message;
    return;
  }
  if (m.type !== "converted") return;
  conversionNotes = m.warnings;
  download(m.bytes, `${base}${ext}`);
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

function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (!session?.unsaved) return;
  e.preventDefault();
  e.returnValue = "";
}

const isPackFile = (f: File): boolean => /\.(zip|jar)$/i.test(f.name);

/** A tab that is hidden may never come back: write the autosave now. */
function onHidden(): void {
  if (document.visibilityState === "hidden") void autosave.flush();
}

function onDrop(e: DragEvent): void {
  e.preventDefault();
  const f = e.dataTransfer?.files[0];
  if (!f) return;
  if (isPackFile(f)) void addPack(f);
  else void load(f);
}

// Without a mouse: arrow keys turn the picture, + and - zoom, while the picture has the focus.
// (In Fly mode the renderer reads the keys itself.)
function onCanvasKey(e: KeyboardEvent): void {
  if (kind === "starting" || info === null || e.ctrlKey || e.metaKey || e.altKey) return;
  if (kind === "webgl" && camMode === "fly") return;
  const turn: Record<string, [number, number]> = {
    ArrowLeft: [-5, 0],
    ArrowRight: [5, 0],
    ArrowUp: [0, 5],
    ArrowDown: [0, -5],
  };
  const t = turn[e.key];
  if (t) {
    azimuth = (((azimuth + t[0]) % 360) + 360) % 360;
    elevation = Math.min(
      kind === "webgl" ? 89 : 90,
      Math.max(kind === "webgl" ? -89 : 0, elevation + t[1]),
    );
    if (kind === "webgl") setAngles();
    else void draw(request(false));
  } else if (e.key === "+" || e.key === "=") zoom(1 / 1.2);
  else if (e.key === "-" || e.key === "_") zoom(1.2);
  else return;
  e.preventDefault();
}

function zoom(factor: number): void {
  if (kind !== "webgl" || !renderer) return;
  renderer.setOrbit({ distance: renderer.getPose().distance * factor });
}

/** The text alternative to the picture: what is open, its size and its main blocks. */
const summary = $derived(
  info === null
    ? "No schematic is open."
    : `${info.name}: ${info.size.join(" by ")} blocks, ${info.blocks} blocks in all. Most used: ${info.counts
        .slice(0, 5)
        .map(([n, c]) => `${n.replace("minecraft:", "")} ${c}`)
        .join(", ")}.`,
);

/** A throwaway canvas, so that the page's own canvas stays free for either kind of context. */
function hasWebgl2(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

/**
 * Where the site's texture pack lives: under the base path the page was built for (or is served at).
 * `asset()` only accepts files found in `static/` when types are generated, and the pack is
 * generated (gitignored, see the `assets` script), so without it the accepted set is empty and the
 * path needs the cast.
 */
const packUrl = (): string => new URL(asset("pack/pack.json" as AssetPath), document.baseURI).href;

function wireTouchGestures(c: HTMLCanvasElement, r: WebglRenderer): void {
  gestureCleanup?.();

  let pendingPan: { dx: number; dy: number } | null = null;
  let pendingPinch: { factor: number } | null = null;
  let flushMicrotaskScheduled = false;

  function flushTwoFinger(): void {
    if (pendingPan && pendingPinch) {
      const currentDist = r.getPose().distance;
      const targetDist = Math.max(1, Math.min(200, currentDist * pendingPinch.factor));
      const effectiveDist = Math.sqrt(currentDist * targetDist);
      const scale = effectiveDist / currentDist;
      r.panBy(pendingPan.dx * scale, pendingPan.dy * scale);
      r.zoomBy(pendingPinch.factor);
    } else if (pendingPan) {
      r.panBy(pendingPan.dx, pendingPan.dy);
    } else if (pendingPinch) {
      r.zoomBy(pendingPinch.factor);
    }
    pendingPan = null;
    pendingPinch = null;
  }

  function scheduleFlushTwoFinger(): void {
    if (!flushMicrotaskScheduled) {
      flushMicrotaskScheduled = true;
      setTimeout(() => {
        flushMicrotaskScheduled = false;
        flushTwoFinger();
      }, 0);
    }
  }

  // The camera's share of a gesture. The router hands over every intent of a gesture the camera
  // owns; a gesture that starts on a touch tool never gets here (see `touch-router.ts`).
  const cameraIntent = (intent: GestureIntent): void => {
    switch (intent.type) {
      case "oneFingerDragMove":
        flushTwoFinger();
        r.orbitBy(intent.dx, intent.dy);
        break;
      case "twoFingerPan":
        pendingPan = { dx: intent.dx, dy: intent.dy };
        scheduleFlushTwoFinger();
        break;
      case "pinch":
        pendingPinch = { factor: intent.factor };
        scheduleFlushTwoFinger();
        break;
      case "tap":
      case "longPress":
      case "oneFingerDragStart":
      case "oneFingerDragEnd":
      case "multiFingerTap":
      case "cancel":
        flushTwoFinger();
        break;
    }
  };

  const router = new TouchRouter({ target: () => session, camera: cameraIntent });

  const onDown = (e: PointerEvent): void => {
    c.focus({ preventScroll: true });
    try {
      c.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if setPointerCapture fails
    }
    e.preventDefault();
    router.feed(pointerEventToSample(e));
    flushTwoFinger();
  };

  const onMove = (e: PointerEvent): void => {
    router.feed(pointerEventToSample(e));
    flushTwoFinger();
  };

  const onUp = (e: PointerEvent): void => {
    router.feed(pointerEventToSample(e));
    flushTwoFinger();
  };

  const onCancel = (e: PointerEvent): void => {
    router.feed(pointerEventToSample(e));
    flushTwoFinger();
  };

  c.addEventListener("pointerdown", onDown);
  c.addEventListener("pointermove", onMove);
  c.addEventListener("pointerup", onUp);
  c.addEventListener("pointercancel", onCancel);

  gestureCleanup = () => {
    router.reset();
    c.removeEventListener("pointerdown", onDown);
    c.removeEventListener("pointermove", onMove);
    c.removeEventListener("pointerup", onUp);
    c.removeEventListener("pointercancel", onCancel);
    gestureCleanup = null;
  };
}

async function startGpu(): Promise<boolean> {
  try {
    const [{ createWebglRenderer }, site, user] = await Promise.all([
      import("@voxwright/render/webgl"),
      fetchPack(packUrl()),
      loadUserPack(),
    ]);
    sitePack = site;
    userPack = user;
    const pack = mergePacks(site, user?.pack ?? null);
    const decoded = pack ? await decodePack(pack) : null;
    packBlocks = pack ? packBlockIds(pack.json) : [];

    const coarse = window.matchMedia("(any-pointer: coarse)");
    const fine = window.matchMedia("(any-pointer: fine)");
    const isTouch = coarse.matches && !fine.matches;

    const r = createWebglRenderer({
      pack: decoded,
      input: isTouch ? "external" : "builtin",
    });
    r.onCamera = (p) => {
      azimuth = p.azimuth;
      elevation = p.elevation;
    };
    r.mount(canvas);
    renderer = r;
    haveAssets = decoded !== null;

    if (isTouch) {
      wireTouchGestures(canvas, r);
    }

    return true;
  } catch (err) {
    console.warn("WebGL2 renderer unavailable, using the software renderer:", err);
    gestureCleanup?.();
    renderer?.dispose();
    renderer = null;
    return false;
  }
}

/**
 * Test and measurement hook: the page's own state, and one way to change a block. Installed only when
 * the address has `?e2e` (the browser tests add it), so a normal visit exposes nothing on `window`.
 */
function installTestHook(): void {
  if (!new URLSearchParams(location.search).has("e2e")) return;
  (window as unknown as { __voxwright: unknown }).__voxwright = {
    renderer,
    timings: () => $state.snapshot(timings),
    volume: () => volume,
    session: () => session,
    /** Write the autosave now instead of waiting for its timer. */
    flushAutosave: () => autosave.flush(),
    /** Change one block through the editor; report ms until its mesh is swapped in and until a frame shows it. */
    async edit(
      x: number,
      y: number,
      z: number,
      block: string,
    ): Promise<{ appliedMs: number; visibleMs: number }> {
      if (!volume || !renderer || !session) throw new Error("open a file first");
      const t = performance.now();
      if (!session.placeAt([x, y, z], block)) throw new Error(session.error || "no change");
      await renderer.whenMeshed();
      const appliedMs = performance.now() - t;
      await renderer.whenIdle();
      return { appliedMs, visibleMs: performance.now() - t };
    },
  };
}

onMount(() => {
  try {
    const savedLayout = localStorage.getItem("voxwright.layout");
    if (savedLayout === "auto" || savedLayout === "desktop" || savedLayout === "mobile") {
      layoutOverride = savedLayout;
    }
    const savedLh = localStorage.getItem("voxwright.lefthanded");
    if (savedLh !== null) {
      leftHanded = savedLh === "true";
    }
    cursorOffset = parseCursorOffset(localStorage.getItem("voxwright.cursoroffset"));
  } catch {}

  const mqWidth = window.matchMedia("(min-width: 1000px)");
  const mqFine = window.matchMedia("(pointer: fine)");
  const mqCoarse = window.matchMedia("(pointer: coarse)");
  const syncMq = (): void => {
    // Width >= 1000px with fine pointer (or headless/desktop reporting no coarse pointer)
    mqDesktop = mqWidth.matches && (mqFine.matches || !mqCoarse.matches);
  };
  syncMq();
  mqWidth.addEventListener("change", syncMq);
  mqFine.addEventListener("change", syncMq);
  mqCoarse.addEventListener("change", syncMq);

  window.addEventListener("beforeunload", onBeforeUnload);
  document.addEventListener("visibilitychange", onHidden);
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
      status = idleStatus();
      installTestHook();
      await checkForSaved();
      return;
    }
    kind = "cpu";
    userPack = await loadUserPack();
    const m = await call({
      type: "init",
      packUrl: packUrl(),
    });
    if (m.type === "error") {
      error = m.message;
      status = "the viewer could not start";
    } else if (m.type === "ready") {
      haveAssets = m.haveAssets;
      status = idleStatus();
      if (userPack) await applyPacks();
    }
  })();
  return () => {
    window.clearInterval(statsTimer);
    window.removeEventListener("beforeunload", onBeforeUnload);
    document.removeEventListener("visibilitychange", onHidden);
    mqWidth.removeEventListener("change", syncMq);
    mqFine.removeEventListener("change", syncMq);
    mqCoarse.removeEventListener("change", syncMq);
    endSession();
    gestureCleanup?.();
    renderer?.dispose();
    worker.terminate();
  };
});
</script>

<a class="skip" href="#view" data-testid="skip-link">Skip to the picture</a>

{#if isMobileLayout}
  <header class="mobile-top-bar" data-testid="top-app-bar">
    <button
      type="button"
      class="mobile-menu-btn"
      onclick={() => toggleSheet("menu")}
      aria-label="Open menu"
      data-testid="mobile-menu-btn"
    >
      <span class="menu-icon" data-testid="mobile-menu-button">☰</span>
      <span class="menu-label">Menu</span>
    </button>
    <div class="mobile-bar-center">
      <h1 class="mobile-logo">voxwright</h1>
      <p id="status" class="mobile-status" data-testid="status" role="status">{status}</p>
    </div>
    <p class="engine mobile-engine" data-testid="renderer" data-kind={kind}>
      {kind === "webgl" ? "GPU" : kind === "cpu" ? "software" : ""}
    </p>
  </header>
{/if}

<main class:mobile-layout={isMobileLayout} ondragover={(e) => e.preventDefault()} ondrop={onDrop}>
  {#if !isMobileLayout}
    <header>
      <h1>voxwright</h1>
      <p id="status" data-testid="status" role="status">{status}</p>
      <p class="engine" data-testid="renderer" data-kind={kind}>{kind === "webgl" ? "GPU renderer" : kind === "cpu" ? "software renderer (no WebGL2)" : ""}</p>
    </header>

    <section class="open" aria-label="Open a file">
      <label class="button">
        Open a schematic
        <input type="file" class="sr-only" accept=".nbt,.schem,.schematic,.litematic,application/octet-stream,*/*" data-testid="file" onchange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (f) void load(f); }} />
      </label>
      <span>or drop a <code>.nbt</code>, <code>.schem</code>, <code>.litematic</code> or <code>.mcstructure</code> file here. Nothing is uploaded: the file is read in your browser.</span>
    </section>

    <PackPanel
      hasSitePack={sitePack !== null}
      user={userPack}
      busy={packBusy}
      note={packNote}
      error={packError}
      onadd={(f) => void addPack(f)}
      onremove={() => void removePack()}
    />
  {:else}
    <!-- Hidden persistent file input accessible for test automation in mobile mode -->
    <input
      type="file"
      class="sr-only"
      accept=".nbt,.schem,.schematic,.litematic,application/octet-stream,*/*"
      data-testid="file"
      onchange={(e) => {
        const f = e.currentTarget.files?.[0];
        e.currentTarget.value = "";
        if (f) void load(f);
      }}
    />

    {#if !info}
      <div class="mobile-welcome-card">
        <h2>Welcome to voxwright</h2>
        <p>In-browser 3D schematic editor</p>
        <label class="button mobile-card-btn">
          Open a schematic
          <input
            type="file"
            class="sr-only"
            accept=".nbt,.schem,.schematic,.litematic,application/octet-stream,*/*"
            onchange={(e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (f) void load(f);
            }}
          />
        </label>
      </div>
    {/if}
  {/if}

  {#if error}<p class="error" data-testid="error" role="alert">{error}</p>{/if}

  <div class="stage" class:editable={session !== null} class:mobile={isMobileLayout}>
    {#if !isMobileLayout && session}
      <div class="tools" data-testid="editor-side" role="region" aria-label="Editing panels">
        <BlockPalette {session} />
        <BlockStatePanel {session} />
        <SelectionPanel {session} />
      </div>
    {/if}

    <div class="center" class:mobile={isMobileLayout}>
      {#if !isMobileLayout && session}<EditToolbar {session} />{/if}
      <div class="canvas-host" class:mobile={isMobileLayout}>
        <canvas
          bind:this={canvas}
          id="view"
          data-testid="canvas"
          aria-label="3D view of the open schematic"
          aria-describedby="canvas-summary"
          tabindex="0"
          class:ready={info !== null}
          class:gl={kind === "webgl"}
          class:editing={session?.interactive}
          onpointerdown={pointerDown}
          onpointermove={pointerMove}
          onpointerup={pointerUp}
          onpointercancel={pointerUp}
          onkeydown={onCanvasKey}
        ></canvas>
      </div>
      <p id="canvas-summary" class="sr-only" data-testid="canvas-summary">{summary}</p>
      {#if !isMobileLayout}
        {#if session}
          <p class="hint" data-testid="edit-help">
            With a tool selected: click to use it, hold Alt and drag to turn the view, hold Shift (or use the right button) and drag to move sideways, scroll to zoom. Choose View to look around without editing. Tools work in the Orbit camera. Shortcuts are in each button's tooltip; Esc cancels. Without a mouse, the Selection panel changes blocks by typed coordinates. Edits stay in this page until you export: the file you opened is never changed. A copy is kept in this browser so a closed tab can be restored; undo history is not kept.
          </p>
        {:else if info && kind === "cpu"}
          <p class="hint" data-testid="edit-note">Editing needs WebGL2; the software renderer is a viewer.</p>
        {/if}
      {:else if info && kind === "cpu"}
        <p class="hint mobile-edit-note" data-testid="edit-note">Editing needs WebGL2; the software renderer is a viewer.</p>
      {/if}
    </div>

    {#if !isMobileLayout && info}
      <aside aria-label="View, export and block counts">
        <h2>View</h2>
        {#if kind === "webgl"}
          <div class="seg" role="group" aria-label="Camera">
            <button class:on={camMode === "orbit"} aria-pressed={camMode === "orbit"} onclick={() => setCamMode("orbit")} data-testid="mode-orbit">Orbit</button>
            <button class:on={camMode === "fly"} aria-pressed={camMode === "fly"} onclick={() => setCamMode("fly")} data-testid="mode-fly">Fly</button>
          </div>
          <p class="hint" data-testid="camera-hint">{camMode === "orbit" ? "Drag to turn, scroll to zoom, shift-drag or right-drag to move sideways. With the picture focused: arrow keys turn it, + and - zoom." : "Click the picture, then W A S D to move, Space and C for up and down, Shift to go faster, scroll to change speed. Esc lets go of the mouse."}</p>
        {/if}
        <label>Turn <input type="range" min="0" max="359" bind:value={azimuth} onchange={() => kind === "cpu" && draw(request(false))} oninput={() => (kind === "webgl" ? setAngles() : draw(request(true)))} data-testid="azimuth" /> <output>{Math.round(azimuth)}°</output></label>
        <label>Tilt <input type="range" min={kind === "webgl" ? -89 : 0} max={kind === "webgl" ? 89 : 90} bind:value={elevation} onchange={() => kind === "cpu" && draw(request(false))} oninput={() => (kind === "webgl" ? setAngles() : draw(request(true)))} data-testid="elevation" /> <output>{Math.round(elevation)}°</output></label>
        {#if kind === "webgl"}
          <div class="seg" role="group" aria-label="Zoom">
            <button onclick={() => zoom(1 / 1.2)} data-testid="zoom-in">Zoom in</button>
            <button onclick={() => zoom(1.2)} data-testid="zoom-out">Zoom out</button>
          </div>
        {/if}
        {#if kind === "cpu"}<p class="hint">You can also drag the picture to turn it. {renderMs ? `Last frame: ${renderMs} ms.` : ""}</p>{/if}

        <h2>Layers</h2>
        <label>From <input type="range" min="0" max={info.size[1] - 1} bind:value={yMin} oninput={() => { if (kind === "webgl") { if (yMin > yMax) yMax = yMin; applySlice(); } }} onchange={() => { if (yMin > yMax) yMax = yMin; if (kind === "cpu") void draw(request(false)); }} data-testid="ymin" /> <output>{yMin}</output></label>
        <label>To <input type="range" min="0" max={info.size[1] - 1} bind:value={yMax} oninput={() => { if (kind === "webgl") { if (yMax < yMin) yMin = yMax; applySlice(); } }} onchange={() => { if (yMax < yMin) yMin = yMax; if (kind === "cpu") void draw(request(false)); }} data-testid="ymax" /> <output>{yMax}</output></label>

        <h2>{session ? "Export" : "Convert"}</h2>
        <select bind:value={format} aria-label="File format" data-testid="format">
          {#each FORMATS as f}<option value={f.id}>{f.label}</option>{/each}
        </select>
        <button onclick={convert} data-testid="convert">{session ? "Export and download" : "Convert and download"}</button>
        {#if session}<p class="hint" data-testid="export-note">{session.editCount} edit{session.editCount === 1 ? "" : "s"} included. This writes a new file; the one you opened is not changed.</p>{/if}
        <div aria-live="polite" data-testid="loss-region">
          <h3>Loss report</h3>
          {#if lossLines.length}
            <ul data-testid="loss">
              {#each lossLines as line}<li>{line}</li>{/each}
            </ul>
          {:else}
            <p class="hint" data-testid="loss-none">{conversionNotes === null ? "Nothing was lost reading this file." : "Nothing was lost."}</p>
          {/if}
        </div>
        {#if session}
          <h2>Autosave</h2>
          <p class="hint" data-testid="autosave" role="status">
            {#if autosave.state === "failed" || autosave.state === "unavailable"}
              <span class="bad">{autosave.problem}</span>
            {:else if autosave.state === "saved" && autosave.savedAt !== null}
              Saved in this browser at {new Date(autosave.savedAt).toLocaleTimeString()}. Undo history is not kept.
            {:else if session.unsaved}
              Edits are copied to this browser a few seconds after you stop. Undo history is not kept.
            {:else}
              Edits are copied to this browser a few seconds after you stop. Nothing to save yet.
            {/if}
          </p>
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
  {#if busy}<p class="busy" role="status">working…</p>{/if}
</main>

{#if !isMobileLayout}
  <SiteFooter />
{:else}
  <!-- In mobile mode, SiteFooter is in the sr-only wrapper for accessibility and test discovery -->
  <div class="sr-only">
    <SiteFooter />
  </div>
{/if}

<!-- The offset cursor of a touch gesture, drawn over the canvas; it ignores the pointer. -->
{#if session}
  <TouchReticle {session} />
{/if}

<!-- Mobile floating thumb controls and docked toolbar -->
{#if isMobileLayout && session}
  <ThumbCluster {session} {leftHanded} />
  <BottomToolbar
    {session}
    {activeSheet}
    ontogglesheet={(s) => toggleSheet(s)}
  />
{/if}

<!-- Mobile bottom sheets for Palette, State, Selection, and Menu -->
{#if isMobileLayout}
  {#if activeSheet === "palette" && session}
    <BottomSheet snap="half" title="Block Palette" onclose={() => (activeSheet = "none")}>
      <BlockPalette {session} />
    </BottomSheet>
  {:else if activeSheet === "blockstate" && session}
    <BottomSheet snap="half" title="Block State" onclose={() => (activeSheet = "none")}>
      <BlockStatePanel {session} />
    </BottomSheet>
  {:else if activeSheet === "selection" && session}
    <BottomSheet snap="half" title="Selection" onclose={() => (activeSheet = "none")}>
      <SelectionPanel {session} />
    </BottomSheet>
  {:else if activeSheet === "menu"}
    <BottomSheet snap="half" title="Menu" onclose={() => (activeSheet = "none")}>
      <div class="mobile-menu-body" data-testid="menu-sheet">
        <section class="menu-grp">
          <h3>File</h3>
          <label class="button menu-action-btn">
            Open a schematic
            <input
              type="file"
              class="sr-only"
              accept=".nbt,.schem,.schematic,.litematic,application/octet-stream,*/*"
              data-testid="file-mobile"
              onchange={(e) => {
                const f = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (f) {
                  activeSheet = "none";
                  void load(f);
                }
              }}
            />
          </label>
          {#if info}
            <p class="menu-hint">{info.name} · {info.size[0]}×{info.size[1]}×{info.size[2]} · {info.blocks} blocks</p>
          {/if}
        </section>

        <section class="menu-grp">
          <h3>{session ? "Export" : "Convert"}</h3>
          <select bind:value={format} aria-label="File format" data-testid="mobile-format">
            {#each FORMATS as f}<option value={f.id}>{f.label}</option>{/each}
          </select>
          <button type="button" class="button menu-action-btn" onclick={convert} data-testid="mobile-convert">
            {session ? "Export and download" : "Convert and download"}
          </button>
          {#if session}
            <p class="hint" data-testid="export-note">{session.editCount} edit{session.editCount === 1 ? "" : "s"} included.</p>
          {/if}
          <div aria-live="polite" data-testid="loss-region">
            <h4>Loss report</h4>
            {#if lossLines.length}
              <ul data-testid="loss">
                {#each lossLines as line}<li>{line}</li>{/each}
              </ul>
            {:else}
              <p class="hint" data-testid="loss-none">{conversionNotes === null ? "Nothing was lost reading this file." : "Nothing was lost."}</p>
            {/if}
          </div>
        </section>

        <section class="menu-grp">
          <h3>View & Camera</h3>
          <label>Turn <input type="range" min="0" max="359" bind:value={azimuth} onchange={() => kind === "cpu" && draw(request(false))} oninput={() => (kind === "webgl" ? setAngles() : draw(request(true)))} data-testid="mobile-azimuth" /> <output>{Math.round(azimuth)}°</output></label>
          <label>Tilt <input type="range" min={kind === "webgl" ? -89 : 0} max={kind === "webgl" ? 89 : 90} bind:value={elevation} onchange={() => kind === "cpu" && draw(request(false))} oninput={() => (kind === "webgl" ? setAngles() : draw(request(true)))} data-testid="mobile-elevation" /> <output>{Math.round(elevation)}°</output></label>
          {#if kind === "webgl"}
            <div class="menu-seg" role="group" aria-label="Zoom">
              <button type="button" onclick={() => zoom(1 / 1.2)} data-testid="mobile-zoom-in">Zoom in</button>
              <button type="button" onclick={() => zoom(1.2)} data-testid="mobile-zoom-out">Zoom out</button>
            </div>
          {/if}
          {#if info}
            <h4>Layers</h4>
            <label>From <input type="range" min="0" max={info.size[1] - 1} bind:value={yMin} oninput={() => { if (kind === "webgl") { if (yMin > yMax) yMax = yMin; applySlice(); } }} onchange={() => { if (yMin > yMax) yMax = yMin; if (kind === "cpu") void draw(request(false)); }} data-testid="mobile-ymin" /> <output>{yMin}</output></label>
            <label>To <input type="range" min="0" max={info.size[1] - 1} bind:value={yMax} oninput={() => { if (kind === "webgl") { if (yMax < yMin) yMin = yMax; applySlice(); } }} onchange={() => { if (yMax < yMin) yMin = yMax; if (kind === "cpu") void draw(request(false)); }} data-testid="mobile-ymax" /> <output>{yMax}</output></label>
          {/if}
        </section>

        <section class="menu-grp">
          <h3>Texture Pack</h3>
          <PackPanel
            hasSitePack={sitePack !== null}
            user={userPack}
            busy={packBusy}
            note={packNote}
            error={packError}
            onadd={(f) => void addPack(f)}
            onremove={() => void removePack()}
          />
        </section>

        <section class="menu-grp">
          <h3>Settings</h3>
          <div class="menu-field">
            <span class="field-label">Layout mode:</span>
            <div class="menu-seg" role="group" aria-label="Layout override" data-testid="layout-override">
              <button type="button" class:on={layoutOverride === "auto"} onclick={() => setLayoutMode("auto")}>Auto</button>
              <button type="button" class:on={layoutOverride === "mobile"} onclick={() => setLayoutMode("mobile")}>Mobile</button>
              <button type="button" class:on={layoutOverride === "desktop"} onclick={() => setLayoutMode("desktop")}>Desktop</button>
            </div>
          </div>
          <label class="menu-checkbox" data-testid="left-handed-toggle">
            <input type="checkbox" checked={leftHanded} onchange={(e) => setLeftHanded(e.currentTarget.checked)} />
            <span>Left-handed controls (mirror thumb cluster)</span>
          </label>
          <div class="menu-field menu-range" data-testid="cursor-offset">
            <div class="menu-range-head">
              <span class="field-label">Cursor distance</span>
              <output for="cursor-offset-input" data-testid="cursor-offset-value">{cursorOffset} px</output>
            </div>
            <input
              id="cursor-offset-input"
              type="range"
              min={MIN_CURSOR_OFFSET_PX}
              max={MAX_CURSOR_OFFSET_PX}
              step={CURSOR_OFFSET_STEP_PX}
              value={cursorOffset}
              aria-label="Cursor distance above the finger"
              aria-valuetext="{cursorOffset} px"
              oninput={(e) => setCursorOffset(e.currentTarget.valueAsNumber)}
              data-testid="cursor-offset-input"
            />
            <p class="menu-hint">How far above your fingertip the cursor sits when you place or erase blocks. 0 puts it under the finger.</p>
          </div>
        </section>

        {#if session}
          <section class="menu-grp">
            <h3>Autosave</h3>
            <p class="hint" data-testid="autosave" role="status">
              {#if autosave.state === "failed" || autosave.state === "unavailable"}
                <span class="bad">{autosave.problem}</span>
              {:else if autosave.state === "saved" && autosave.savedAt !== null}
                Saved in this browser at {new Date(autosave.savedAt).toLocaleTimeString()}.
              {:else if session.unsaved}
                Edits are copied to this browser a few seconds after you stop.
              {:else}
                Nothing to save yet.
              {/if}
            </p>
          </section>
        {/if}

        <div class="menu-footer">
          <SiteFooter />
        </div>
      </div>
    </BottomSheet>
  {/if}
{/if}

<RestoreDialog
  {offer}
  busy={offerBusy}
  error={offerError}
  onrestore={() => void restoreSaved()}
  ondiscard={() => void discardSaved()}
/>

<PerfOverlay {renderer} />

<style>
  :global(body) { margin: 0; font: 15px/1.45 system-ui, sans-serif; color: #2b2925; background: #f4f1eb; min-height: 100vh; overscroll-behavior: none; }
  :global(:focus-visible) { outline: 3px solid #1d4ed8; outline-offset: 2px; }
  .skip { position: absolute; left: 0.5rem; top: -4rem; background: #2b2925; color: #f4f1eb; padding: 0.5rem 0.8rem; border-radius: 6px; z-index: 50; }
  .skip:focus { top: 0.5rem; }
  :global(.sr-only) { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
  /* Nothing here moves on its own; this keeps it so if a transition or animation is ever added. */
  @media (prefers-reduced-motion: reduce) {
    :global(*, *::before, *::after) { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  }
  main { max-width: 1500px; margin: 0 auto; padding: 1.2rem; }
  main.mobile-layout {
    position: fixed;
    inset: 0;
    width: 100vw;
    width: 100dvw;
    height: 100vh;
    height: 100dvh;
    margin: 0;
    padding: 0;
    max-width: none;
    overflow: hidden;
    background: #1e1d1a;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  header { display: flex; align-items: baseline; gap: 1.2rem; }
  h1 { margin: 0; font-size: 1.6rem; letter-spacing: 0.02em; }
  h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; margin: 1.2rem 0 0.4rem; color: #6b655b; }
  h3 { font-size: 0.9rem; margin: 0.8rem 0 0.2rem; }
  #status { color: #6b655b; margin: 0; }
  .open { margin: 0.8rem 0 1rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
  .button, button { background: #2b2925; color: #f4f1eb; border: 0; border-radius: 6px; padding: 0.5rem 0.9rem; cursor: pointer; font: inherit; }
  .button { position: relative; }
  .button:focus-within { outline: 3px solid #1d4ed8; outline-offset: 2px; }
  .stage { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 1.2rem; align-items: start; }
  .stage.mobile { display: block; gap: 0; margin: 0; padding: 0; }
  .center.mobile { display: block; margin: 0; padding: 0; }
  .canvas-host { width: 100%; position: relative; }
  .canvas-host.mobile {
    position: fixed;
    inset: 0;
    width: 100vw;
    width: 100dvw;
    height: 100vh;
    height: 100dvh;
    z-index: 10;
    touch-action: none;
    overflow: hidden;
  }
  .canvas-host.mobile canvas {
    width: 100% !important;
    height: 100% !important;
    max-height: none !important;
    min-height: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    touch-action: none !important;
    background: #1e1d1a !important;
  }
  canvas { width: 100%; max-height: 80vh; object-fit: contain; background: #f4f1eb; border: 1px dashed #c9c3b6; border-radius: 8px; min-height: 240px; touch-action: none; }
  canvas.ready { border-style: solid; cursor: grab; }
  aside { background: #fffdf8; border: 1px solid #e2dccf; border-radius: 8px; padding: 0.2rem 1rem 1rem; }
  aside label { display: grid; grid-template-columns: 3rem 1fr 3rem; align-items: center; gap: 0.4rem; margin: 0.2rem 0; }
  select, aside button { width: 100%; margin: 0.25rem 0; }
  select { padding: 0.4rem; font: inherit; }
  .seg { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; }
  .seg button { background: #e2dccf; color: #2b2925; }
  .seg button.on { background: #2b2925; color: #f4f1eb; }
  .engine { margin: 0 0 0 auto; font-size: 0.8rem; color: #5f594f; }
  .stage.editable { grid-template-columns: 280px minmax(0, 1fr) 280px; }
  .stage.editable.mobile { grid-template-columns: none; display: block; }
  .center { min-width: 0; }
  .tools { background: #fffdf8; border: 1px solid #e2dccf; border-radius: 8px; padding: 0.9rem 1rem 1rem; max-height: 86vh; overflow: auto; }
  canvas.editing { cursor: crosshair; }
  canvas.gl { height: min(72vh, 760px); max-height: none; }
  .hint { color: #5f594f; font-size: 0.85rem; margin: 0.3rem 0 0; }
  .bad { color: #7a1f16; }
  .error { background: #fbe3e0; color: #7a1f16; padding: 0.6rem 0.8rem; border-radius: 6px; }
  .counts { padding-left: 1.2rem; margin: 0; } .counts span { display: inline-block; min-width: 2.6rem; text-align: right; color: #6b655b; }
  ul { margin: 0; padding-left: 1.2rem; font-size: 0.88rem; }
  .busy { position: fixed; right: 1rem; bottom: 1rem; background: #2b2925; color: #f4f1eb; padding: 0.4rem 0.8rem; border-radius: 6px; z-index: 50; }
  @media (max-width: 1000px) { .stage, .stage.editable { grid-template-columns: 1fr; } }

  /* Mobile UI styling */
  .mobile-top-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 50px;
    z-index: 25;
    background: #24221f;
    color: #f4f1eb;
    border-bottom: 1px solid #3d3a34;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: env(safe-area-inset-top, 0px) 12px 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .mobile-menu-btn {
    min-width: 48px;
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #3d3a34;
    color: #f4f1eb;
    border: 0;
    border-radius: 8px;
    padding: 0 12px;
    font: inherit;
    font-size: 0.88rem;
    cursor: pointer;
    touch-action: manipulation;
  }
  .mobile-menu-btn:active {
    background: #504c45;
  }

  .menu-icon {
    font-size: 1.15rem;
    line-height: 1;
  }

  .menu-label {
    font-weight: 500;
  }

  .mobile-bar-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
    padding: 0 8px;
  }

  .mobile-logo {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #f4f1eb;
  }

  .mobile-status {
    margin: 0;
    font-size: 0.76rem;
    color: #a8a194;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 170px;
  }

  .mobile-engine {
    font-size: 0.78rem;
    color: #a8a194;
    font-weight: 500;
    margin: 0;
    padding: 2px 6px;
    border: 1px solid #3d3a34;
    border-radius: 4px;
    background: #1e1d1a;
  }

  .mobile-welcome-card {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 20;
    background: #fffdf8;
    color: #2b2925;
    border: 1px solid #c9c3b6;
    border-radius: 14px;
    padding: 24px;
    text-align: center;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
    max-width: 320px;
    width: calc(100% - 48px);
  }
  .mobile-welcome-card h2 {
    margin: 0 0 6px;
    font-size: 1.15rem;
    color: #2b2925;
    text-transform: none;
    letter-spacing: normal;
  }
  .mobile-welcome-card p {
    margin: 0 0 16px;
    font-size: 0.88rem;
    color: #5f594f;
  }
  .mobile-card-btn {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    box-sizing: border-box;
    font-size: 0.95rem;
  }

  .mobile-menu-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .menu-grp {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e2dccf;
  }
  .menu-grp h3 {
    margin: 0;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b655b;
  }
  .menu-grp h4 {
    margin: 8px 0 2px;
    font-size: 0.8rem;
    color: #6b655b;
  }
  .menu-grp label {
    display: grid;
    grid-template-columns: 3.5rem 1fr 3.5rem;
    align-items: center;
    gap: 8px;
    font-size: 0.88rem;
    min-height: 44px;
  }
  .menu-action-btn {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    box-sizing: border-box;
    font-size: 0.92rem;
    touch-action: manipulation;
  }
  .menu-hint {
    margin: 4px 0 0;
    font-size: 0.82rem;
    color: #5f594f;
  }
  .menu-seg {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
    gap: 6px;
  }
  .menu-seg button {
    min-height: 44px;
    background: #e2dccf;
    color: #2b2925;
    border: 0;
    border-radius: 6px;
    font-size: 0.86rem;
    font-weight: 500;
    cursor: pointer;
    touch-action: manipulation;
  }
  .menu-seg button.on {
    background: #2b2925;
    color: #f4f1eb;
  }
  .menu-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field-label {
    font-size: 0.85rem;
    color: #5f594f;
    font-weight: 500;
  }
  .menu-range-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.9rem;
  }
  .menu-range input[type="range"] {
    width: 100%;
    height: 44px;
    margin: 0;
    box-sizing: border-box;
  }
  .menu-checkbox {
    display: inline-flex !important;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .menu-checkbox input[type="checkbox"] {
    width: 22px;
    height: 22px;
  }
  .menu-footer {
    padding-top: 8px;
  }

  .mobile-edit-note {
    position: fixed;
    bottom: 70px;
    left: 12px;
    right: 12px;
    z-index: 25;
    background: #fbe3e0;
    color: #7a1f16;
    padding: 8px 12px;
    border-radius: 6px;
    text-align: center;
  }
</style>
