// SPDX-License-Identifier: AGPL-3.0-only

// Import an existing build into a readable builder script.
//
// `summary` describes a structure (size, block counts). `planImport` merges
// runs of the same block into boxes and names each block state; `toScript`
// turns that plan into a runnable TypeScript script that rebuilds the
// structure exactly. Reading the files themselves is the codecs' job in
// `@voxwright/core`.

import { compareCodePoints, type Volume } from "@voxwright/core";

export type StructureCell = readonly [x: number, y: number, z: number, block: string];

export interface Structure {
  /** Cells in a stable order, shifted so the smallest x, y and z are 0. */
  blocks: readonly StructureCell[];
  source: string;
  dataVersion: number | null;
  droppedBlockEntities: number;
  droppedEntities: number;
  /** Unknown properties dropped on import, with counts. */
  droppedProperties: ReadonlyMap<string, number>;
}

/** Wrap a {@link Volume} (cells sorted by x, y, z, as mcbuilder's exporter writes them). */
export function structureFromVolume(
  volume: Volume,
  source: string,
  meta: {
    dataVersion?: number | null;
    droppedBlockEntities?: number;
    droppedEntities?: number;
  } = {},
): Structure {
  const cells: StructureCell[] = [];
  volume.eachCell((x, y, z, idx) => {
    cells.push([x, y, z, volume.palette[idx] as string]);
  });
  cells.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  return {
    blocks: cells,
    source,
    dataVersion: meta.dataVersion ?? null,
    droppedBlockEntities: meta.droppedBlockEntities ?? 0,
    droppedEntities: meta.droppedEntities ?? 0,
    droppedProperties: new Map(),
  };
}

const AIR = "minecraft:air";

/** Python's `format(x, ".{digits}f")`: round half to even on exact ties. */
export function pyFixed(x: number, digits: number): string {
  // `toFixed` expands the double exactly, so a tie shows as "5000...".
  const exact = Math.abs(x).toFixed(Math.min(100, digits + 25));
  const dot = exact.indexOf(".");
  const tail = exact.slice(dot + 1 + digits);
  if (/^50*$/.test(tail)) {
    const kept = exact.slice(0, dot + 1 + digits);
    const lastDigit = Number(kept.replace(".", "").slice(-1));
    const rounded =
      lastDigit % 2 === 0 ? kept : (Math.abs(x) + 0.5 * 10 ** -digits).toFixed(digits);
    return (x < 0 ? "-" : "") + (digits === 0 ? rounded.replace(/\.$/, "") : rounded);
  }
  return x.toFixed(digits);
}

const nameOf = (block: string): string => block.split("[", 1)[0] as string;
const localName = (name: string): string => name.slice(name.indexOf(":") + 1);

/** Human-readable analysis lines: size, block counts, block families. */
export function summary(structure: Structure, top = 25): string[] {
  const blocks = structure.blocks;
  if (blocks.length === 0) return ["empty structure"];
  const dims = [0, 1, 2].map((i) => Math.max(...blocks.map((b) => b[i] as number)) + 1) as [
    number,
    number,
    number,
  ];

  const byName = new Map<string, number>();
  for (const [, , , b] of blocks) {
    if (b === AIR) continue;
    byName.set(nameOf(b), (byName.get(nameOf(b)) ?? 0) + 1);
  }
  const solid = [...byName.values()].reduce((a, b) => a + b, 0);
  const states = new Set(blocks.map((b) => b[3])).size;
  const lines = [
    `source: ${structure.source}${structure.dataVersion ? ` (DataVersion ${structure.dataVersion})` : ""}`,
    `size: ${dims[0]} x ${dims[1]} x ${dims[2]} (x * y * z), ${solid} blocks, ${byName.size} block types, ${states} block states`,
  ];
  if (structure.droppedBlockEntities || structure.droppedEntities) {
    lines.push(
      `not imported: ${structure.droppedBlockEntities} block-entity data (chest contents, signs...), ${structure.droppedEntities} entities`,
    );
  }
  if (structure.droppedProperties.size > 0) {
    const items = [...structure.droppedProperties].sort((a, b) => compareCodePoints(a[0], b[0]));
    lines.push(
      `dropped unknown properties (Bedrock leftovers?): ${items.map(([k, n]) => `${k} x${n}`).join(", ")}`,
    );
  }
  lines.push("", `top block types (of ${byName.size}):`);
  const ranked = [...byName].sort((a, b) => b[1] - a[1]).slice(0, top);
  for (const [name, n] of ranked) {
    lines.push(
      `  ${String(n).padStart(6)}  ${pyFixed((100 * n) / solid, 1).padStart(5)}%  ${localName(name)}`,
    );
  }
  const perLayer = new Map<number, number>();
  for (const [, y, , b] of blocks) if (b !== AIR) perLayer.set(y, (perLayer.get(y) ?? 0) + 1);
  lines.push(
    "",
    `blocks per layer (y): ${Array.from({ length: dims[1] }, (_, y) => `${y}:${perLayer.get(y) ?? 0}`).join(", ")}`,
  );
  return lines;
}

type Box = readonly [c1: readonly [number, number, number], c2: readonly [number, number, number]];

/** Greedy cover of `cells` with axis-aligned boxes (no overlaps). */
export function mergeBoxes(cells: readonly (readonly [number, number, number])[]): Box[] {
  const key = (x: number, y: number, z: number): string => `${x},${y},${z}`;
  const left = new Set(cells.map(([x, y, z]) => key(x, y, z)));
  const order = [...cells].sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
  const boxes: Box[] = [];
  for (const [x0, y0, z0] of order) {
    if (!left.has(key(x0, y0, z0))) continue;
    let x1 = x0;
    while (left.has(key(x1 + 1, y0, z0))) x1++;
    let z1 = z0;
    const rowFull = (z: number, y: number): boolean => {
      for (let x = x0; x <= x1; x++) if (!left.has(key(x, y, z))) return false;
      return true;
    };
    while (rowFull(z1 + 1, y0)) z1++;
    let y1 = y0;
    const layerFull = (y: number): boolean => {
      for (let z = z0; z <= z1; z++) if (!rowFull(z, y)) return false;
      return true;
    };
    while (layerFull(y1 + 1)) y1++;
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) left.delete(key(x, y, z));
    boxes.push([
      [x0, y0, z0],
      [x1, y1, z1],
    ]);
  }
  return boxes;
}

const ABBREV: Readonly<Record<string, string>> = {
  north: "N",
  south: "S",
  east: "E",
  west: "W",
  true: "T",
  false: "F",
};

// Python's keyword list: names the original avoided, kept so constants match.
const PY_KEYWORDS = new Set(
  "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(
    " ",
  ),
);

/** A constant name for a block state, unique within `taken`. */
export function constName(block: string, taken: Set<string>): string {
  const bracket = block.indexOf("[");
  const base = bracket === -1 ? block : block.slice(0, bracket);
  const props = bracket === -1 ? "" : block.slice(bracket + 1);
  const name = localName(base).toUpperCase();
  const parts: string[] = [];
  for (const kv of props.replace(/\]+$/, "").split(",")) {
    const eq = kv.indexOf("=");
    if (eq === -1) continue;
    const k = kv.slice(0, eq);
    const v = kv.slice(eq + 1);
    if (k === "waterlogged" && v === "false") continue;
    parts.push((ABBREV[v] ?? v).toUpperCase());
  }
  let cand = [name, ...parts].join("_").replace(/[^A-Z0-9_]/g, "_");
  if (/^[0-9]/.test(cand) || PY_KEYWORDS.has(cand.toLowerCase())) cand = `B_${cand}`;
  let out = cand;
  let n = 2;
  while (taken.has(out)) {
    out = `${cand}_${n}`;
    n++;
  }
  taken.add(out);
  return out;
}

export interface ImportCall {
  y: number;
  z: number;
  x: number;
  c1: readonly [number, number, number];
  c2: readonly [number, number, number];
  block: string;
}

export interface ImportPlan {
  /** Block state to constant name, most used first. */
  names: Map<string, string>;
  counts: Map<string, number>;
  /** Placements in build order: layer by layer. */
  calls: ImportCall[];
}

/** Decide the constants and placements a script needs to rebuild `structure`. */
export function planImport(structure: Structure): ImportPlan {
  const counts = new Map<string, number>();
  const byBlock = new Map<string, [number, number, number][]>();
  for (const [x, y, z, b] of structure.blocks) {
    counts.set(b, (counts.get(b) ?? 0) + 1);
    const list = byBlock.get(b);
    if (list) list.push([x, y, z]);
    else byBlock.set(b, [[x, y, z]]);
  }
  const taken = new Set<string>();
  const names = new Map<string, string>();
  const order = [...counts.keys()].sort(
    (a, b) => (counts.get(b) as number) - (counts.get(a) as number) || compareCodePoints(a, b),
  );
  for (const b of order) names.set(b, constName(b, taken));

  const calls: ImportCall[] = [];
  for (const [block, cells] of byBlock) {
    for (const [c1, c2] of mergeBoxes(cells))
      calls.push({ y: c1[1], z: c1[2], x: c1[0], c1, c2, block });
  }
  calls.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  return { names, counts, calls };
}

/** A runnable TypeScript builder script that rebuilds `structure` exactly. */
export function toScript(structure: Structure, options: { seed?: number } = {}): string {
  const { names, counts, calls } = planImport(structure);
  const comment = [
    `Imported from ${structure.source} by \`mcbuild import\`.`,
    "",
    ...summary(structure),
  ]
    .concat(["", "Coordinates: x east, y up, z south; (0, 0, 0) is the north-west bottom corner."])
    .map((l) => (l === "" ? " *" : ` * ${l}`));
  const out = [
    "/**",
    ...comment,
    " */",
    'import { Build } from "@voxwright/mcbuilder";',
    "",
    `export const BUILD = new Build({ seed: ${options.seed ?? 0}, views: "iso;az200_el025;top" });`,
    "",
    "// block states, most used first",
    ...[...names].map(([b, n]) => `const ${n} = ${JSON.stringify(b)}; // ${counts.get(b)}`),
    "",
    "BUILD.scope(() => {",
  ];
  let layer: number | null = null;
  for (const c of calls) {
    if (c.y !== layer) {
      out.push("", `  // --- layer y = ${c.y} ---`);
      layer = c.y;
    }
    const name = names.get(c.block) as string;
    const same = c.c1[0] === c.c2[0] && c.c1[1] === c.c2[1] && c.c1[2] === c.c2[2];
    out.push(
      same
        ? `  BUILD.set(${c.c1[0]}, ${c.c1[1]}, ${c.c1[2]}, ${name});`
        : `  BUILD.box([${c.c1.join(", ")}], [${c.c2.join(", ")}], ${name});`,
    );
  }
  out.push("});", "");
  return out.join("\n");
}
