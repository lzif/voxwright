// SPDX-License-Identifier: AGPL-3.0-only

// The WebGL2 renderer: our own mesher's output drawn with three.js. A volume
// is cut into 16x16x16 sections, a pool of workers meshes them (a few results
// are swapped in per frame, nearest the camera first), and each section is up
// to three meshes, one per bucket, sharing one atlas texture. Slicing hides
// whole sections, clips the one or two layers the cut passes through with
// clip planes, and swaps in a re-meshed copy of those layers so the cut faces
// are drawn. Nothing here runs in Node: use the DOM-free `mesh` exports for that.

import type { Volume } from "@voxwright/core";
import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  EdgesGeometry,
  FrontSide,
  Group,
  LinearSRGBColorSpace,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  NoColorSpace,
  PerspectiveCamera,
  Plane,
  RGBAFormat,
  Scene,
  Sphere,
  UnsignedByteType,
  Vector3,
  WebGLRenderer,
} from "three";
import { type Atlas, atlasLayout, buildAtlas } from "../mesh/atlas.ts";
import { type DecodedPack, sourceFromDecoded } from "../mesh/pack.ts";
import { MeshScheduler, type MeshUpdate, type WorkerLike } from "../mesh/scheduler.ts";
import {
  BUCKET_CUTOUT,
  BUCKET_OPAQUE,
  BUCKET_TRANSLUCENT,
  type MeshBuffers,
  parseSectionKey,
  type SectionMesh,
} from "../mesh/section.ts";
import {
  FlyController,
  lookDirection,
  OrbitController,
  type Pose,
  pickRay,
  type Vec3,
} from "./controls.ts";
import type { Box, CameraMode, Renderer, SliceRange } from "./types.ts";

export interface WebglRendererOptions {
  /** Models and textures; `null` draws every block as the magenta fallback cube. */
  pack: DecodedPack | null;
  /**
   * Input handling mode: "builtin" attaches canvas pointer/wheel/key listeners;
   * "external" skips them so an external gesture arbiter has full ownership of input.
   * Default: "builtin".
   */
  input?: "builtin" | "external";
  /** Mesher workers (default: cores minus one, between 1 and 4). */
  workers?: number;
  /** How to start a worker; the default starts this package's own `mesh.worker.ts`. */
  createWorker?: () => WorkerLike;
  /** At most this many finished meshes are swapped in per frame, and never more than 8 ms of them (default 128). */
  maxUpdatesPerFrame?: number;
  /** Background colour as 0xRRGGBB. */
  background?: number;
  /** Multisample antialiasing. Default: on, unless WebGL is software-rendered, where it is far too slow. */
  antialias?: boolean;
}

export interface RendererStats {
  sections: number;
  meshes: number;
  drawCalls: number;
  triangles: number;
  /** Frames per second over the last second of rendering. */
  fps: number;
  /** Time `renderer.render` took on the last frame, milliseconds (CPU side). */
  frameMs: number;
  queued: number;
  inFlight: number;
  /** Worker time per section mesh, milliseconds, for every mesh built since the volume was set. */
  meshMs: number[];
  /** From `setVolume` until every section's mesh was swapped in, milliseconds (no drawing involved). */
  meshingMs: number | null;
  /** From `setVolume` to the first frame drawn with every section in place, milliseconds. */
  firstFullFrameMs: number | null;
  /** Block names drawn as the magenta fallback cube. */
  fallbackBlocks: string[];
  /** `WEBGL_debug_renderer_info` renderer string, or "unknown". */
  gpu: string;
  atlas: { width: number; height: number; textures: number };
}

interface SectionObjects {
  sy: number;
  full: Mesh[];
  sliced: Mesh[];
  slicedTag: string | null;
}

const BUCKET_NAMES = ["opaque", "cutout", "translucent"] as const;

export function webgl2Available(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

/** Is WebGL2 here software-rendered (SwiftShader, llvmpipe)? Multisampling is too slow there. */
function softwareRendered(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    if (!gl || !ext) return false;
    return /swiftshader|llvmpipe|software|softpipe/i.test(
      String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)),
    );
  } catch {
    return false;
  }
}

function defaultWorker(): WorkerLike {
  return new Worker(new URL("./mesh.worker.ts", import.meta.url), {
    type: "module",
  }) as unknown as WorkerLike;
}

const HIGHLIGHT_STYLES = {
  selection: { edge: 0x2f6df6, fill: 0x2f6df6, alpha: 0.16 },
  hover: { edge: 0xf2b705, fill: 0xf2b705, alpha: 0.22 },
  ghost: { edge: 0x2fa84f, fill: 0x2fa84f, alpha: 0.34 },
} as const;

export class WebglRenderer implements Renderer {
  private readonly options: WebglRendererOptions;
  private atlas: Atlas;
  private readonly scheduler: MeshScheduler;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(60, 1, 0.1, 4000);
  private readonly world = new Group();
  private readonly marks = new Group();
  private texture: DataTexture;
  private readonly materials: MeshBasicMaterial[];
  private readonly sections = new Map<string, SectionObjects>();
  private readonly orbit = new OrbitController();
  private readonly fly = new FlyController();
  private readonly planes = [
    new Plane(new Vector3(0, 1, 0), 0),
    new Plane(new Vector3(0, -1, 0), 0),
  ];
  private readonly sectionSphere = new Sphere(new Vector3(8, 8, 8), 14.5);

  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private volume: Volume | null = null;
  private mode: CameraMode = "orbit";
  private slice: SliceRange | null = null;
  private raf = 0;
  private last = 0;
  private needsRender = true;
  private disposed = false;

  private frameTimes: number[] = [];
  private frameMs = 0;
  private volumeSetAt = 0;
  private firstFullFrameMs: number | null = null;
  private meshingMs: number | null = null;
  private idleWaiters: (() => void)[] = [];
  private meshedWaiters: (() => void)[] = [];
  private benchmark: {
    until: number;
    frames: number[];
    cpu: number[];
    resolve: (r: BenchmarkResult) => void;
  } | null = null;
  private gpuName = "unknown";
  private lastPose = "";
  /** Called after a frame whose camera differs from the last one reported. */
  onCamera: ((pose: Pose & { mode: CameraMode; distance: number }) => void) | null = null;
  private drag: { id: number; x: number; y: number; button: number; shift: boolean } | null = null;
  private pointers = new Map<number, { x: number; y: number; button: number; shift: boolean }>();
  private pinch = 0;
  private pinchMid: { x: number; y: number } | null = null;
  private cleanup: (() => void)[] = [];

  constructor(options: WebglRendererOptions) {
    this.options = options;
    this.atlas = this.makeAtlas(options.pack);
    this.texture = this.makeTexture();
    const common = { map: this.texture, vertexColors: true, side: FrontSide } as const;
    this.materials = [
      new MeshBasicMaterial({ ...common }),
      new MeshBasicMaterial({ ...common, alphaTest: 0.5 }),
      new MeshBasicMaterial({ ...common, transparent: true, depthWrite: false }),
    ];

    this.scene.add(new AmbientLight(0xffffff, 1));
    this.scene.add(this.world, this.marks);
    this.scene.background = new Color().setRGB(
      ((options.background ?? 0xe9e5dc) >> 16) / 255,
      (((options.background ?? 0xe9e5dc) >> 8) & 255) / 255,
      ((options.background ?? 0xe9e5dc) & 255) / 255,
      LinearSRGBColorSpace,
    );

    const n =
      options.workers ??
      Math.max(1, Math.min(4, (globalThis.navigator?.hardwareConcurrency ?? 2) - 1));
    const make = options.createWorker ?? defaultWorker;
    this.scheduler = new MeshScheduler({
      workers: Array.from({ length: n }, make),
      pack: options.pack,
      atlas: atlasLayout(this.atlas),
      onActivity: () => this.requestFrame(),
    });
  }

  private makeAtlas(pack: DecodedPack | null): Atlas {
    const assets = pack === null ? null : sourceFromDecoded(pack);
    return buildAtlas(
      assets === null ? [] : Object.keys(pack?.textures ?? {}),
      assets ?? { readJson: () => null, texture: () => null },
    );
  }

  private makeTexture(): DataTexture {
    // Colours are mixed in the same space the CPU renderer works in: no sRGB conversion anywhere.
    const texture = new DataTexture(
      this.atlas.data,
      this.atlas.width,
      this.atlas.height,
      RGBAFormat,
      UnsignedByteType,
    );
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = NoColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  // -- Renderer interface -------------------------------------------------------------------

  mount(canvas: HTMLCanvasElement): void {
    if (this.canvas !== null) throw new Error("this renderer is already mounted");
    this.canvas = canvas;
    this.gl = new WebGLRenderer({
      canvas,
      antialias: this.options.antialias ?? !softwareRendered(),
      powerPreference: "high-performance",
    });
    this.gl.outputColorSpace = LinearSRGBColorSpace;
    this.gl.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
    this.gl.clippingPlanes = [];
    const ctx = this.gl.getContext();
    const ext = ctx.getExtension("WEBGL_debug_renderer_info");
    if (ext !== null) this.gpuName = String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL));

    canvas.tabIndex = 0;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.listen(canvas, "contextmenu", (e) => e.preventDefault());
    this.listen(canvas, "webglcontextlost", (e) => e.preventDefault());
    this.listen(canvas, "webglcontextrestored", () => this.requestFrame());
    if (this.options.input !== "external") {
      this.listen(canvas, "pointerdown", this.onPointerDown);
      this.listen(canvas, "pointermove", this.onPointerMove);
      this.listen(canvas, "pointerup", this.onPointerUp);
      this.listen(canvas, "pointercancel", this.onPointerUp);
      this.listen(canvas, "wheel", this.onWheel, { passive: false });
      this.listen(window, "keydown", this.onKey);
      this.listen(window, "keyup", this.onKey);
      this.listen(window, "blur", () => this.fly.keys.clear());
    }
    this.resize();
    this.requestFrame();
  }

  setVolume(v: Volume): void {
    this.volume = v;
    this.clearSections();
    this.volumeSetAt = performance.now();
    this.firstFullFrameMs = null;
    this.meshingMs = null;
    this.scheduler.setVolume(v);
    this.applySliceToScheduler();
    this.frameCamera();
    this.requestFrame();
  }

  /**
   * Swap the textures and models for another pack (or `null` for flat fallback cubes) and mesh the
   * open volume again. The camera, the slice and the volume stay as they are.
   */
  setPack(pack: DecodedPack | null): void {
    this.options.pack = pack;
    this.atlas = this.makeAtlas(pack);
    const old = this.texture;
    this.texture = this.makeTexture();
    for (const m of this.materials) {
      m.map = this.texture;
      m.needsUpdate = true;
    }
    old.dispose();
    this.clearSections();
    this.volumeSetAt = performance.now();
    this.firstFullFrameMs = null;
    this.meshingMs = null;
    this.scheduler.setPack(pack, atlasLayout(this.atlas));
    this.applySliceToScheduler();
    this.requestFrame();
  }

  markDirty(sectionKeys: string[]): void {
    this.scheduler.markDirty(sectionKeys);
    this.requestFrame();
  }

  setCamera(mode: CameraMode): void {
    if (mode === this.mode) return;
    if (mode === "fly") {
      this.fly.fromPose(this.orbit.pose());
    } else {
      this.orbit.fromPose(this.fly.pose());
      this.fly.keys.clear();
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    }
    this.mode = mode;
    this.requestFrame();
  }

  setSlice(range: SliceRange | null): void {
    this.slice = range === null ? null : { y0: range.y0, y1: range.y1 };
    this.applySliceToScheduler();
    this.updateVisibility();
    this.requestFrame();
  }

  highlight(boxes: Box[]): void {
    for (const c of [...this.marks.children]) {
      this.marks.remove(c);
      (c as Mesh | LineSegments).geometry.dispose();
      const m = (c as Mesh).material;
      for (const x of Array.isArray(m) ? m : [m]) x.dispose();
    }
    for (const box of boxes) {
      const st = HIGHLIGHT_STYLES[box.style ?? "selection"];
      const size = [
        box.max[0] - box.min[0] + 1,
        box.max[1] - box.min[1] + 1,
        box.max[2] - box.min[2] + 1,
      ] as const;
      const centre = [
        box.min[0] + size[0] / 2,
        box.min[1] + size[1] / 2,
        box.min[2] + size[2] / 2,
      ] as const;
      const geo = new BoxGeometry(size[0] + 0.02, size[1] + 0.02, size[2] + 0.02);
      const fill = new Mesh(
        geo,
        new MeshBasicMaterial({
          color: st.fill,
          transparent: true,
          opacity: st.alpha,
          depthWrite: false,
        }),
      );
      fill.position.set(...centre);
      fill.renderOrder = 10;
      const edges = new LineSegments(
        new EdgesGeometry(geo),
        new LineBasicMaterial({ color: st.edge }),
      );
      edges.position.set(...centre);
      edges.renderOrder = 11;
      this.marks.add(fill, edges);
    }
    this.needsRender = true;
    this.requestFrame();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const f of this.cleanup.splice(0)) f();
    this.resizeObserver?.disconnect();
    this.scheduler.dispose();
    this.clearSections();
    this.highlight([]);
    for (const m of this.materials) m.dispose();
    this.texture.dispose();
    this.gl?.dispose();
    this.gl = null;
    this.canvas = null;
    for (const r of this.idleWaiters.splice(0)) r();
  }

  // -- Beyond the interface: for the app, tests and measurements ----------------------------

  /** Orbit camera state; also used to put the camera at a known place. */
  setOrbit(p: {
    azimuth?: number;
    elevation?: number;
    distance?: number;
    target?: [number, number, number];
  }): void {
    if (p.azimuth !== undefined) this.orbit.azimuth = ((p.azimuth % 360) + 360) % 360;
    if (p.elevation !== undefined) this.orbit.elevation = Math.max(-89, Math.min(89, p.elevation));
    if (p.distance !== undefined) this.orbit.distance = p.distance;
    if (p.target !== undefined) this.orbit.target = [...p.target];
    this.requestFrame();
  }

  /** Orbit the camera around its target by screen pixel deltas. */
  orbitBy(dxPx: number, dyPx: number): void {
    if (!Number.isFinite(dxPx) || !Number.isFinite(dyPx)) return;
    this.orbit.rotate(dxPx, dyPx);
    this.requestFrame();
  }

  /**
   * Turn the orbit camera around its target by degrees of azimuth, as `setOrbit({ azimuth })` would
   * from the current pose. A positive value is the direction a drag to the right turns the camera
   * (seen from above, the build turns counter-clockwise on the screen); a negative one turns it
   * clockwise. The elevation, the distance and the target stay.
   */
  orbitAzimuthBy(degrees: number): void {
    if (!Number.isFinite(degrees)) return;
    this.orbit.azimuth = (((this.orbit.azimuth + degrees) % 360) + 360) % 360;
    this.requestFrame();
  }

  /** Pan the camera target in the screen plane by screen pixel deltas. */
  panBy(dxPx: number, dyPx: number): void {
    if (!Number.isFinite(dxPx) || !Number.isFinite(dyPx)) return;
    this.orbit.pan(dxPx, dyPx);
    this.requestFrame();
  }

  /** Zoom the orbit camera by scaling the distance by factor (>1 zooms out, <1 zooms in). */
  zoomBy(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    this.orbit.zoom(factor);
    this.requestFrame();
  }

  /** Focus the orbit camera on a target cell/world position, optionally setting the distance. */
  focusOn(target: Vec3, distance?: number): void {
    if (this.mode === "fly") {
      this.setCamera("orbit");
    }
    this.orbit.target = [target[0], target[1], target[2]];
    if (distance !== undefined && Number.isFinite(distance)) {
      this.orbit.distance = Math.max(
        this.orbit.minDistance,
        Math.min(this.orbit.maxDistance, distance),
      );
    }
    this.requestFrame();
  }

  /** Where the camera is now. */
  getPose(): Pose & { mode: CameraMode; distance: number } {
    const p = this.mode === "orbit" ? this.orbit.pose() : this.fly.pose();
    return { ...p, mode: this.mode, distance: this.orbit.distance };
  }

  /** Turn the fly camera as the mouse would, or press keys without a keyboard. */
  flyLook(dxPx: number, dyPx: number): void {
    this.fly.look(dxPx, dyPx);
    this.requestFrame();
  }

  /**
   * The world-space ray under a point of the page (`clientX`, `clientY` as in a mouse event), for
   * picking blocks with core's `raycast`. `null` before the renderer is mounted or when the point
   * is outside the canvas.
   */
  rayFromClient(
    clientX: number,
    clientY: number,
  ): { origin: [number, number, number]; direction: [number, number, number] } | null {
    const c = this.canvas;
    if (c === null) return null;
    const r = c.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const u = (clientX - r.left) / r.width;
    const v = (clientY - r.top) / r.height;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    return pickRay(this.getPose(), this.camera.fov, r.width / r.height, u * 2 - 1, 1 - v * 2);
  }

  /** Where a world point appears on the page (client coordinates), for tests; `null` behind the camera or unmounted. */
  clientFromWorld(x: number, y: number, z: number): { x: number; y: number } | null {
    const c = this.canvas;
    if (c === null) return null;
    this.updateCamera();
    const p = new Vector3(x, y, z).project(this.camera);
    if (p.z > 1) return null;
    const r = c.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  getMode(): CameraMode {
    return this.mode;
  }

  /** Fit the whole volume in view from the default angle. */
  frameCamera(): void {
    const b = this.scheduler.bounds();
    if (b === null) return;
    const c: [number, number, number] = [
      (b.min[0] + b.max[0] + 1) / 2,
      (b.min[1] + b.max[1] + 1) / 2,
      (b.min[2] + b.max[2] + 1) / 2,
    ];
    const radius =
      Math.hypot(b.max[0] - b.min[0] + 1, b.max[1] - b.min[1] + 1, b.max[2] - b.min[2] + 1) / 2;
    this.orbit.target = c;
    this.orbit.distance = Math.max(
      4,
      (radius / Math.sin((this.camera.fov * Math.PI) / 360)) * 1.05,
    );
    this.orbit.maxDistance = Math.max(2000, this.orbit.distance * 4);
    this.camera.far = Math.max(4000, this.orbit.distance * 8);
    this.fly.speed = Math.max(12, radius * 0.4);
    this.mode = "orbit";
    this.needsRender = true;
  }

  /**
   * Resolves once no section is queued, building or waiting to be swapped in. Unlike
   * {@link whenIdle} it does not wait for a frame to be drawn.
   */
  whenMeshed(): Promise<void> {
    if (this.scheduler.idle()) return Promise.resolve();
    return new Promise((r) => {
      this.meshedWaiters.push(r);
      this.requestFrame();
    });
  }

  /** Resolves after a frame has been drawn while no section is queued, building or waiting. */
  whenIdle(): Promise<void> {
    if (this.isIdle()) return Promise.resolve();
    return new Promise((r) => {
      this.idleWaiters.push(r);
      this.requestFrame();
    });
  }

  /** Spin the orbit camera for `seconds` and report how many frames the browser delivered. */
  runOrbitBenchmark(seconds: number): Promise<BenchmarkResult> {
    return new Promise((resolve) => {
      this.benchmark = { until: performance.now() + seconds * 1000, frames: [], cpu: [], resolve };
      this.requestFrame();
    });
  }

  stats(): RendererStats {
    const s = this.scheduler.stats();
    const info = this.gl?.info.render;
    let meshes = 0;
    for (const o of this.sections.values()) meshes += o.full.length + o.sliced.length;
    return {
      sections: this.sections.size,
      meshes,
      drawCalls: info?.calls ?? 0,
      triangles: info?.triangles ?? 0,
      fps: this.fps(),
      frameMs: this.frameMs,
      queued: s.queued,
      inFlight: s.inFlight,
      meshMs: s.meshMs,
      meshingMs: this.meshingMs,
      firstFullFrameMs: this.firstFullFrameMs,
      fallbackBlocks: s.fallback,
      gpu: this.gpuName,
      atlas: {
        width: this.atlas.width,
        height: this.atlas.height,
        textures: Object.keys(this.atlas.entries).length,
      },
    };
  }

  // -- Internals -------------------------------------------------------------------------------

  private listen<E extends Event>(
    target: EventTarget,
    type: string,
    fn: (e: E) => void,
    opts?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, fn as EventListener, opts);
    this.cleanup.push(() => target.removeEventListener(type, fn as EventListener, opts));
  }

  private resize(): void {
    const c = this.canvas;
    if (c === null || this.gl === null) return;
    const w = Math.max(1, c.clientWidth);
    const h = Math.max(1, c.clientHeight);
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
    this.requestFrame();
  }

  private requestFrame(): void {
    this.needsRender = true;
    if (this.disposed || this.gl === null || this.raf !== 0) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private isIdle(): boolean {
    return this.scheduler.idle() && !this.needsRender;
  }

  private readonly frame = (t: number): void => {
    this.raf = 0;
    if (this.disposed || this.gl === null) return;
    const dt = this.last === 0 ? 0 : Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    let again = false;

    if (this.benchmark !== null) {
      this.orbit.azimuth = (this.orbit.azimuth + 0.5) % 360;
      this.needsRender = true;
      again = true;
    }
    if (this.mode === "fly" && this.fly.step(dt)) {
      this.needsRender = true;
      again = true;
    }
    const pos = this.mode === "orbit" ? this.orbit.position() : this.fly.position;
    this.scheduler.setFocus(pos[0], pos[1], pos[2]);
    this.scheduler.pump();
    const swapped = this.applyUpdates();
    if (swapped > 0) this.needsRender = true;
    if (!this.scheduler.idle()) again = true;
    else {
      if (this.meshingMs === null && this.volume !== null)
        this.meshingMs = performance.now() - this.volumeSetAt;
    }
    if (this.scheduler.idle()) for (const r of this.meshedWaiters.splice(0)) r();

    if (this.needsRender) {
      this.needsRender = false;
      this.draw();
    }
    if (this.fly.moving() && this.mode === "fly") again = true;
    this.recordFrame(t);

    if (this.benchmark !== null && t >= this.benchmark.until) {
      const b = this.benchmark;
      this.benchmark = null;
      b.resolve(summarise(b.frames, b.cpu));
    } else if (this.benchmark !== null) {
      this.benchmark.frames.push(t);
    }

    if (this.scheduler.idle() && !this.needsRender && this.drewSinceVolume) {
      if (this.firstFullFrameMs === null && this.volume !== null)
        this.firstFullFrameMs = performance.now() - this.volumeSetAt;
      for (const r of this.idleWaiters.splice(0)) r();
    }
    if (again || !this.scheduler.idle() || this.needsRender) this.requestFrame();
  };

  private drewSinceVolume = false;

  private draw(): void {
    const gl = this.gl;
    if (gl === null) return;
    this.updateCamera();
    const t0 = performance.now();
    gl.render(this.scene, this.camera);
    this.frameMs = performance.now() - t0;
    this.benchmark?.cpu.push(this.frameMs);
    this.drewSinceVolume = true;
    if (this.onCamera !== null) {
      const p = this.getPose();
      const key = `${this.mode}|${p.azimuth.toFixed(2)}|${p.elevation.toFixed(2)}|${p.position.map((v) => v.toFixed(2)).join(",")}`;
      if (key !== this.lastPose) {
        this.lastPose = key;
        this.onCamera(p);
      }
    }
  }

  /** Copy out the last frame drawn by the loop, for tests and screenshots. */
  capture(): { width: number; height: number; rgba: Uint8ClampedArray } | null {
    const canvas = this.canvas;
    if (canvas === null || this.gl === null) return null;
    this.gl.render(this.scene, this.camera);
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const ctx = copy.getContext("2d", { willReadFrequently: true });
    if (ctx === null) return null;
    ctx.drawImage(canvas, 0, 0);
    const img = ctx.getImageData(0, 0, copy.width, copy.height);
    return { width: img.width, height: img.height, rgba: img.data };
  }

  private updateCamera(): void {
    const pos = this.mode === "orbit" ? this.orbit.position() : this.fly.position;
    const az = this.mode === "orbit" ? this.orbit.azimuth : this.fly.azimuth;
    const el = this.mode === "orbit" ? this.orbit.elevation : this.fly.elevation;
    const d = lookDirection(az, el);
    this.camera.position.set(pos[0], pos[1], pos[2]);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(pos[0] + d[0], pos[1] + d[1], pos[2] + d[2]);
    this.camera.near =
      this.mode === "orbit" ? Math.min(1, Math.max(0.05, this.orbit.distance * 0.004)) : 0.1;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  private recordFrame(t: number): void {
    this.frameTimes.push(t);
    while (this.frameTimes.length > 0 && t - (this.frameTimes[0] as number) > 1000)
      this.frameTimes.shift();
  }

  private fps(): number {
    const f = this.frameTimes;
    if (f.length < 2) return 0;
    return ((f.length - 1) * 1000) / ((f[f.length - 1] as number) - (f[0] as number));
  }

  /** Swap in finished meshes: at most the per-frame limit, and stop early once a frame's budget is spent. */
  private applyUpdates(): number {
    const max = this.options.maxUpdatesPerFrame ?? 128;
    const t0 = performance.now();
    let n = 0;
    while (n < max) {
      const batch = this.scheduler.drain(1);
      const u = batch[0];
      if (u === undefined) break;
      this.apply(u);
      n++;
      if (performance.now() - t0 > 8) break;
    }
    if (n > 0) this.drewSinceVolume = false;
    return n;
  }

  private apply(u: MeshUpdate): void {
    let o = this.sections.get(u.key);
    if (o === undefined) {
      if (u.mesh === null) return;
      o = { sy: parseSectionKey(u.key)[1], full: [], sliced: [], slicedTag: null };
      this.sections.set(u.key, o);
    }
    const [sx, sy, sz] = parseSectionKey(u.key);
    const meshes = u.mesh === null ? [] : this.buildMeshes(u.mesh, sx * 16, sy * 16, sz * 16);
    if (u.sliceTag === null) {
      this.drop(o.full);
      o.full = meshes;
    } else {
      this.drop(o.sliced);
      o.sliced = meshes;
      o.slicedTag = u.mesh === null ? null : u.sliceTag;
    }
    if (o.full.length === 0 && o.sliced.length === 0) this.sections.delete(u.key);
    this.updateVisibilityOf(o);
  }

  private buildMeshes(mesh: SectionMesh, ox: number, oy: number, oz: number): Mesh[] {
    const out: Mesh[] = [];
    for (const bucket of [BUCKET_OPAQUE, BUCKET_CUTOUT, BUCKET_TRANSLUCENT] as const) {
      const b = mesh[BUCKET_NAMES[bucket]] as MeshBuffers | null;
      if (b === null) continue;
      const geo = new BufferGeometry();
      geo.setAttribute("position", new BufferAttribute(b.positions, 3));
      geo.setAttribute("uv", new BufferAttribute(b.uvs, 2));
      geo.setAttribute("color", new BufferAttribute(b.colors, 4, true));
      geo.setIndex(new BufferAttribute(b.indices, 1));
      geo.boundingSphere = this.sectionSphere.clone();
      const m = new Mesh(geo, this.materials[bucket]);
      m.position.set(ox, oy, oz);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      m.renderOrder = bucket;
      this.world.add(m);
      out.push(m);
    }
    return out;
  }

  private drop(meshes: Mesh[]): void {
    for (const m of meshes) {
      this.world.remove(m);
      m.geometry.dispose();
    }
  }

  private clearSections(): void {
    for (const o of this.sections.values()) {
      this.drop(o.full);
      this.drop(o.sliced);
    }
    this.sections.clear();
  }

  /** Show, hide and swap section meshes for the current slice. */
  private updateVisibility(): void {
    const s = this.slice;
    const gl = this.gl;
    if (gl !== null) {
      if (s === null) gl.clippingPlanes = [];
      else {
        this.planes[0]?.set(new Vector3(0, 1, 0), -s.y0);
        this.planes[1]?.set(new Vector3(0, -1, 0), s.y1 + 1);
        gl.clippingPlanes = this.planes;
      }
    }
    for (const o of this.sections.values()) this.updateVisibilityOf(o);
    this.needsRender = true;
  }

  private updateVisibilityOf(o: SectionObjects): void {
    const s = this.slice;
    let showFull = true;
    let showSliced = false;
    if (s !== null) {
      const y = o.sy * 16;
      const inside = y >= s.y0 && y + 15 <= s.y1;
      const outside = y + 15 < s.y0 || y > s.y1;
      if (outside) showFull = false;
      else if (!inside && o.slicedTag === `${s.y0}:${s.y1}` && o.sliced.length > 0) {
        showFull = false;
        showSliced = true;
      }
    }
    for (const m of o.full) m.visible = showFull;
    for (const m of o.sliced) m.visible = showSliced;
    if (s === null && o.sliced.length > 0) {
      this.drop(o.sliced);
      o.sliced = [];
      o.slicedTag = null;
    }
  }

  private applySliceToScheduler(): void {
    this.scheduler.setSlice(this.slice);
    this.updateVisibility();
  }

  // -- Input ----------------------------------------------------------------------------------

  private readonly onPointerDown = (e: PointerEvent): void => {
    const c = this.canvas;
    if (c === null) return;
    c.focus({ preventScroll: true });
    this.pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      button: e.button,
      shift: e.shiftKey,
    });
    if (this.pointers.size === 2) {
      this.pinch = this.pointerSpread();
      this.pinchMid = this.pointerMidpoint();
    }
    this.drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      button: e.button,
      shift: e.shiftKey,
    };
    c.setPointerCapture(e.pointerId);
    if (this.mode === "fly" && c.requestPointerLock) {
      // A click takes the mouse; where that is refused, dragging still looks around.
      void Promise.resolve(c.requestPointerLock()).catch(() => {});
    }
    e.preventDefault();
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const tracked = this.pointers.get(e.pointerId);
    if (tracked !== undefined) {
      tracked.x = e.clientX;
      tracked.y = e.clientY;
    }
    if (this.mode === "fly") {
      const locked = document.pointerLockElement === this.canvas;
      if (locked) this.fly.look(e.movementX, e.movementY);
      else if (this.drag !== null && this.drag.id === e.pointerId)
        this.fly.look(e.clientX - this.drag.x, e.clientY - this.drag.y);
      if (this.drag !== null) {
        this.drag.x = e.clientX;
        this.drag.y = e.clientY;
      }
      if (locked || this.drag !== null) this.requestFrame();
      return;
    }
    if (this.pointers.size === 2) {
      const spread = this.pointerSpread();
      if (this.pinch > 0 && spread > 0) this.orbit.zoom(this.pinch / spread);
      this.pinch = spread;
      // Moving both fingers together drags the build, like a Shift+drag.
      const mid = this.pointerMidpoint();
      if (this.pinchMid !== null && mid !== null)
        this.orbit.pan(mid.x - this.pinchMid.x, mid.y - this.pinchMid.y);
      this.pinchMid = mid;
      this.requestFrame();
      return;
    }
    const d = this.drag;
    if (d === null || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    if (d.button === 0 && !d.shift) this.orbit.rotate(dx, dy);
    else this.orbit.pan(dx, dy);
    this.requestFrame();
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.drag?.id === e.pointerId) this.drag = null;
    this.pinch = 0;
    this.pinchMid = null;
    // After a two-finger gesture the finger still down carries on as a one-finger drag, from where
    // it is now, so the view does not jump.
    if (this.pointers.size === 1) {
      for (const [id, p] of this.pointers)
        this.drag = { id, x: p.x, y: p.y, button: p.button, shift: p.shift };
    }
  };

  private pointerMidpoint(): { x: number; y: number } | null {
    const [a, b] = [...this.pointers.values()];
    return a === undefined || b === undefined ? null : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private pointerSpread(): number {
    const [a, b] = [...this.pointers.values()];
    return a === undefined || b === undefined ? 0 : Math.hypot(a.x - b.x, a.y - b.y);
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const k = Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0015);
    if (this.mode === "orbit") this.orbit.zoom(k);
    else this.fly.scaleSpeed(1 / k);
    this.requestFrame();
  };

  private readonly onKey = (e: KeyboardEvent): void => {
    if (this.mode !== "fly") return;
    const t = e.target as HTMLElement | null;
    if (t !== null && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
    if (e.type === "keydown") {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      this.fly.keys.add(e.code);
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      this.requestFrame();
    } else this.fly.keys.delete(e.code);
  };
}

export interface BenchmarkResult {
  frames: number;
  seconds: number;
  fps: number;
  /** Interval between frames, milliseconds. */
  medianMs: number;
  p95Ms: number;
  worstMs: number;
  /** Time the `render` call itself took on the main thread, per frame: what a fast GPU would still wait for. */
  cpuMedianMs: number;
  cpuP95Ms: number;
}

function summarise(times: number[], cpu: number[]): BenchmarkResult {
  const gaps = times.slice(1).map((t, i) => t - (times[i] as number));
  const sorted = [...gaps].sort((a, b) => a - b);
  const q = (p: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  const seconds =
    times.length > 1 ? ((times[times.length - 1] as number) - (times[0] as number)) / 1000 : 0;
  return {
    frames: gaps.length,
    seconds,
    fps: seconds > 0 ? gaps.length / seconds : 0,
    medianMs: q(0.5),
    p95Ms: q(0.95),
    worstMs: sorted[sorted.length - 1] ?? 0,
    cpuMedianMs: [...cpu].sort((a, b) => a - b)[Math.floor(cpu.length / 2)] ?? 0,
    cpuP95Ms: [...cpu].sort((a, b) => a - b)[Math.floor(cpu.length * 0.95)] ?? 0,
  };
}

export function createWebglRenderer(options: WebglRendererOptions): WebglRenderer {
  return new WebglRenderer(options);
}
