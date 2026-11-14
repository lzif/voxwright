// SPDX-License-Identifier: AGPL-3.0-only

// `Build`: the object a builder script fills with blocks.
//
//   const build = new Build({ seed: 7 });
//   build.scope(() => {
//     build.box([0, 0, 0], [8, 0, 6], "minecraft:cobblestone");
//     build.walls([0, 1, 0], [8, 4, 6], "minecraft:oak_planks");
//     build.roofGable([-1, 5, -1], [9, 5, 7], "minecraft:spruce_stairs", { ridge: "x" });
//   });
//
// Placements must happen inside `scope`. Blocks are placed verbatim: nothing
// guesses `facing` or `axis` except shapes whose geometry implies it (stairs,
// roofs). `seed` drives every random choice, so the same script and seed
// always give the same build.

import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { AIR, canonicalize, type Rotation, rotateBlockstate, rotatePoint } from "@voxwright/core";
import { type AssetSource, renderView, resolveViews, type View } from "@voxwright/render";
import { directoryAssets, encodePng } from "@voxwright/render/node";
import { parseConfig, resolveAssetsDir } from "./config.ts";
import { BuildError } from "./errors.ts";
import { Geometry, type Point } from "./geometry.ts";
import { type Material, resolveMaterial, type Seed } from "./materials.ts";
import type { Registry, ValidationError, ValidationWarning } from "./registry.ts";
import { Rng } from "./rng.ts";
import * as shapes from "./shapes.ts";
import { type Dims, VoxelGrid } from "./voxels.ts";

export interface BuildOptions {
  seed?: Seed;
  /** Default preview views, e.g. `["iso", "az135_el025", "top"]`. */
  views?: string | readonly string[] | null;
  /** Size limit per axis; exceeding it throws `GridBoundsError`. Default 256 each. */
  maxDimensions?: Dims;
}

export interface BuildRenderOptions {
  /** Preview views (defaults to this build's `views`, then the standard 9-view orbit). */
  views?: string | readonly (string | View)[] | null;
  /** Preview tier; only `"faithful"` is ported. */
  tier?: "faithful" | "fast" | "trusted";
  /** Two corners `[c1, c2]` to render only that box. */
  region?: readonly [Point, Point] | null;
  /** Directory holding vanilla client assets (defaults to the configured cache directory). */
  assetsDir?: string | null;
  /** Pre-resolved asset source (overrides `assetsDir` when given). */
  assets?: AssetSource | null;
  /** Optional title drawn top-centre in presentation mode. */
  title?: string;
  /** `false` gives the plain debug look (dark background, no shadow or title). Default `true`. */
  presentation?: boolean;
}

function isDirSync(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function resolveAssetsRoot(assetsDir: string): string | null {
  const direct = join(assetsDir, "client", "assets", "minecraft");
  if (isDirSync(direct)) return direct;
  if (isDirSync(join(assetsDir, "blockstates"))) return assetsDir;
  if (isDirSync(assetsDir)) {
    for (const child of readdirSync(assetsDir).sort()) {
      const cand = join(assetsDir, child, "client", "assets", "minecraft");
      if (isDirSync(cand)) return cand;
    }
  }
  return null;
}

function ints(what: string, p: unknown): Point {
  if (!Array.isArray(p) || p.length !== 3)
    throw new BuildError(`${what} must be 3 ints, got ${String(p)}`);
  if (!p.every((v) => typeof v === "number" && Number.isInteger(v))) {
    throw new BuildError(`${what} coordinates must be ints, got [${p.join(", ")}]`);
  }
  return p as unknown as Point;
}

export class Build {
  private readonly seedValue: Seed;
  private sharedRng: Rng | null = null;
  private readonly voxelGrid: VoxelGrid;
  private depth = 0;
  private views: string[] | null = null;

  constructor(options: BuildOptions = {}) {
    this.seedValue = options.seed ?? null;
    this.voxelGrid = new VoxelGrid(options.maxDimensions ?? [256, 256, 256]);
    if (options.views !== undefined) this.setViews(options.views);
  }

  /** Run `fn` with placements enabled. Scopes nest. */
  scope<T>(fn: (build: this) => T): T {
    this.depth++;
    try {
      return fn(this);
    } finally {
      this.depth = Math.max(0, this.depth - 1);
    }
  }

  private requireScope(): void {
    if (this.depth === 0) throw new BuildError("placements must be inside `build.scope(...)`");
  }

  // -- primitives -------------------------------------------------------------

  /** Place one block (any material spec). Last write wins. `minecraft:air` places explicit air. */
  set(x: number, y: number, z: number, block: Material): void {
    this.requireScope();
    this.voxelGrid.place(x, y, z, resolveMaterial(block, x, y, z, this.seedValue));
  }

  /** Make every placed cell in the box `c1`..`c2` unset, so pasting leaves the world untouched there. */
  carve(c1: Point, c2: Point): void {
    this.requireScope();
    const [x1, y1, z1] = ints("carve: c1", c1);
    const [x2, y2, z2] = ints("carve: c2", c2);
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) this.voxelGrid.unset(x, y, z);
      }
    }
  }

  /**
   * Stamp `geometry` with its origin at `at`. Returns what was placed, in
   * absolute coordinates. `rotation` turns the geometry about its origin
   * first; `facing`, `axis` and friends rotate with it.
   */
  place(geometry: Geometry, options: { at?: Point; rotation?: Rotation } = {}): Geometry {
    this.requireScope();
    if (!(geometry instanceof Geometry)) throw new BuildError("place: expected a Geometry");
    const rotation = options.rotation ?? "NONE";
    const [ax, ay, az] = ints("place: at", options.at ?? [0, 0, 0]);
    const placed: Array<readonly [number, number, number, string]> = [];
    for (const cell of geometry.cells()) {
      let [dx, , dz] = cell;
      const dy = cell[1];
      let block = cell[3];
      if (rotation !== "NONE") {
        [dx, dz] = rotatePoint(dx, dz, 0, 0, rotation);
        block = rotateBlockstate(block, rotation);
      } else {
        rotatePoint(0, 0, 0, 0, rotation); // validates the name
      }
      const x = ax + dx;
      const y = ay + dy;
      const z = az + dz;
      this.voxelGrid.place(x, y, z, block);
      placed.push([x, y, z, block]);
    }
    return Geometry.fromCells(placed);
  }

  /** Shift the build so its XZ bounding-box centre is at the origin (Y unchanged). */
  recenter(): void {
    const bb = this.voxelGrid.bounds();
    if (bb === null) return;
    const [[minx, , minz], [maxx, , maxz]] = bb;
    this.voxelGrid.shift(-Math.floor((minx + maxx + 1) / 2), 0, -Math.floor((minz + maxz + 1) / 2));
  }

  // -- reading the build back ---------------------------------------------------

  /** Canonical block at `(x, y, z)`; `null` if unset or air. */
  get(x: number, y: number, z: number): string | null {
    const b = this.voxelGrid.volume.get(x, y, z);
    return b === undefined || b === AIR ? null : b;
  }

  /** Number of cells holding exactly `block` (property order ignored). */
  count(block: string): number {
    const canonical = canonicalize(block);
    let n = 0;
    const palette = this.voxelGrid.volume.palette;
    this.voxelGrid.volume.eachCell((_x, _y, _z, idx) => {
      if (palette[idx] === canonical) n++;
    });
    return n;
  }

  /** Sorted coordinates of every cell holding exactly `block`. */
  find(block: string): Point[] {
    const canonical = canonicalize(block);
    const out: Point[] = [];
    const palette = this.voxelGrid.volume.palette;
    this.voxelGrid.volume.eachCell((x, y, z, idx) => {
      if (palette[idx] === canonical) out.push([x, y, z]);
    });
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  }

  /** Bounding box of placed non-air cells, or `null`. */
  bounds(): ReturnType<VoxelGrid["bounds"]> {
    return this.voxelGrid.bounds();
  }

  // -- randomness and config ------------------------------------------------------

  /**
   * Seeded random generator. `rng()` is one shared stream; `rng("roof")` is
   * an independent stream for that name, so editing one part of a script
   * does not reshuffle the random choices of every other part.
   */
  rng(namespace?: string): Rng {
    if (namespace === undefined) {
      this.sharedRng ??= this.seedValue === null ? Rng.unseeded() : new Rng(String(this.seedValue));
      return this.sharedRng;
    }
    if (typeof namespace !== "string")
      throw new BuildError(`rng: namespace must be a string, got ${String(namespace)}`);
    return new Rng(
      `${this.seedValue === null ? "None" : String(this.seedValue)}\u0000${namespace}`,
    );
  }

  setViews(views: string | readonly string[] | null): void {
    this.views = views === null ? null : typeof views === "string" ? [views] : [...views];
  }

  get grid(): VoxelGrid {
    return this.voxelGrid;
  }

  get seed(): Seed {
    return this.seedValue;
  }

  get viewsConfig(): readonly string[] | null {
    return this.views;
  }

  // -- validation and rendering ---------------------------------------------------

  /** Check every placed block against `registry`. Returns `{ errors, warnings }`. */
  validate(
    registry: Registry,
    allowlist: readonly string[] = [],
  ): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    return registry.validate(this.voxelGrid.toDense().palette, allowlist);
  }

  /**
   * Render preview PNGs into `outDir`; returns the written file paths.
   * Accepts either `render(outDir, options?)` or `render(outDir, views, options?)`.
   */
  render(
    outDir: string,
    viewsOrOptions?: string | readonly (string | View)[] | BuildRenderOptions | null,
    maybeOptions?: BuildRenderOptions,
  ): string[] {
    let views: string | readonly (string | View)[] | null | undefined;
    let options: BuildRenderOptions;
    if (
      viewsOrOptions !== undefined &&
      viewsOrOptions !== null &&
      typeof viewsOrOptions === "object" &&
      !Array.isArray(viewsOrOptions)
    ) {
      options = viewsOrOptions as BuildRenderOptions;
      views = options.views;
    } else {
      options = maybeOptions ?? {};
      views = viewsOrOptions !== undefined ? viewsOrOptions : options.views;
    }

    const tier = options.tier ?? "faithful";
    if (tier !== "faithful" && tier !== "fast" && tier !== "trusted") {
      throw new BuildError(
        `render: tier must be 'fast', 'trusted' or 'faithful', got '${String(tier)}'`,
      );
    }
    if (tier !== "faithful") {
      throw new BuildError(`render: tier '${tier}' is not ported; only 'faithful' is supported`);
    }

    const viewList = resolveViews(views !== undefined && views !== null ? views : this.views);
    let grid = this.voxelGrid;
    if (options.region !== undefined && options.region !== null) {
      if (!Array.isArray(options.region) || options.region.length !== 2) {
        throw new BuildError("render: region must be [c1, c2]");
      }
      const [c1, c2] = options.region;
      grid = grid.crop(ints("render: region", c1), ints("render: region", c2));
    }

    let assets: AssetSource | null = null;
    if (options.assets !== undefined) {
      assets = options.assets;
    } else if (options.assetsDir !== null) {
      const base = options.assetsDir ?? resolveAssetsDir(parseConfig(""), homedir());
      const root = resolveAssetsRoot(base);
      if (root !== null) assets = directoryAssets(root);
    }

    mkdirSync(outDir, { recursive: true });
    const dense = grid.toDense();
    const presentation = options.presentation ?? true;
    const paths: string[] = [];
    for (const view of viewList) {
      const file = join(outDir, `${view.label}.png`);
      const canvas = renderView(
        dense,
        assets,
        view,
        presentation
          ? { ...(options.title ? { title: options.title } : {}) }
          : { background: 0x1e1e26, shadow: false },
      );
      writeFileSync(file, encodePng(canvas));
      paths.push(file);
    }
    return paths;
  }

  // -- shapes: each places the geometry and returns it ----------------------------

  private stamp(g: Geometry): Geometry {
    return this.place(g);
  }

  private opt<T extends shapes.SeedOption>(o: T | undefined): T {
    return { seed: this.seedValue, ...o } as T;
  }

  box(c1: Point, c2: Point, block: Material, o?: shapes.SeedOption): Geometry {
    return this.stamp(shapes.box(c1, c2, block, this.opt(o)));
  }
  walls(c1: Point, c2: Point, block: Material, o?: shapes.SeedOption): Geometry {
    return this.stamp(shapes.walls(c1, c2, block, this.opt(o)));
  }
  pillar(base: Point, height: number, block: Material, o?: shapes.SeedOption): Geometry {
    return this.stamp(shapes.pillar(base, height, block, this.opt(o)));
  }
  line(p1: Point, p2: Point, block: Material, o?: shapes.SeedOption): Geometry {
    return this.stamp(shapes.line(p1, p2, block, this.opt(o)));
  }
  /**
   * One-block-thick slab at the lower Y of the corners `c1` and `c2`, covering
   * their XZ rectangle. Corners may be in any order. Port of Python
   * `Build.floor`: a `box` of height 1, so a palette spec resolves with the
   * Build seed.
   */
  floor(c1: Point, c2: Point, block: Material, o?: shapes.SeedOption): Geometry {
    const [x1, y1, z1] = ints("floor: c1", c1);
    const [x2, y2, z2] = ints("floor: c2", c2);
    const y = Math.min(y1, y2);
    return this.box(
      [Math.min(x1, x2), y, Math.min(z1, z2)],
      [Math.max(x1, x2), y, Math.max(z1, z2)],
      block,
      o,
    );
  }
  /** Straight horizontal run from `start` to `end`, axis-aligned only; see `shapes.railing`. */
  railing(start: Point, end: Point, block: Material, o?: shapes.SeedOption): Geometry {
    return this.stamp(shapes.railing(start, end, block, this.opt(o)));
  }
  stairs(start: Point, direction: string, block: Material, o?: shapes.StairsOptions): Geometry {
    return this.stamp(shapes.stairs(start, direction, block, this.opt(o)));
  }
  /** Script-port alias of `stairs`; see `shapes.stairsRun` for the Python provenance and the facing divergence. */
  stairsRun(start: Point, direction: string, block: Material, o?: shapes.StairsOptions): Geometry {
    return this.stamp(shapes.stairsRun(start, direction, block, this.opt(o)));
  }
  cylinder(
    center: Point,
    radius: number,
    height: number,
    block: Material,
    o?: shapes.CylinderOptions,
  ): Geometry {
    return this.stamp(shapes.cylinder(center, radius, height, block, this.opt(o)));
  }
  sphere(center: Point, radius: number, block: Material, o?: shapes.SphereOptions): Geometry {
    return this.stamp(shapes.sphere(center, radius, block, this.opt(o)));
  }
  cone(
    center: Point,
    radius: number,
    height: number,
    block: Material,
    o?: shapes.ConeOptions,
  ): Geometry {
    return this.stamp(shapes.cone(center, radius, height, block, this.opt(o)));
  }
  roofGable(c1: Point, c2: Point, block: Material, o: shapes.RoofGableOptions): Geometry {
    return this.stamp(shapes.roofGable(c1, c2, block, this.opt(o)));
  }
  roofHip(c1: Point, c2: Point, block: Material, o: shapes.RoofHipOptions): Geometry {
    return this.stamp(shapes.roofHip(c1, c2, block, this.opt(o)));
  }
}
