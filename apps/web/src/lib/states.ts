// SPDX-License-Identifier: AGPL-3.0-only

// Which block-state properties a block has, and the values each can take, read
// from its blockstate file: the keys of `variants` and the `when` clauses of
// `multipart`. This needs no separate registry; the pack already has it.

type Json = Record<string, unknown>;
const asObject = (v: unknown): Json | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : null;

export function blockStateProps(blockstate: unknown): Record<string, string[]> {
  const props = new Map<string, Set<string>>();
  const add = (k: string, v: unknown): void => {
    // `when` values can be "a|b" alternatives, which vanilla writes as one string.
    for (const part of String(v).split("|")) {
      let set = props.get(k);
      if (set === undefined) {
        set = new Set();
        props.set(k, set);
      }
      set.add(part);
    }
  };
  const when = (w: unknown): void => {
    const o = asObject(w);
    if (o === null) return;
    if ("OR" in o) return void (o.OR as unknown[]).forEach(when);
    if ("AND" in o) return void (o.AND as unknown[]).forEach(when);
    for (const [k, v] of Object.entries(o)) add(k, v);
  };
  const bs = asObject(blockstate);
  if (bs === null) return {};
  const variants = asObject(bs.variants);
  if (variants !== null) {
    for (const key of Object.keys(variants)) {
      for (const pair of key.split(",")) {
        const eq = pair.indexOf("=");
        if (eq > 0) add(pair.slice(0, eq), pair.slice(eq + 1));
      }
    }
  }
  if (Array.isArray(bs.multipart)) for (const c of bs.multipart as Json[]) when(c.when);
  // A multipart block's property set is whatever its `when` clauses mention, but a clause
  // that only ever names `true` leaves out the `false` a player can also choose.
  const out: Record<string, string[]> = {};
  for (const [k, set] of props) {
    const values = [...set];
    if (values.length === 1 && values[0] === "true") values.push("false");
    out[k] = values.sort();
  }
  return out;
}

/** `minecraft:oak_stairs[facing=north,half=top]` from a name and chosen properties (empty values skipped). */
export function blockString(name: string, chosen: Record<string, string>): string {
  const keys = Object.keys(chosen)
    .filter((k) => chosen[k])
    .sort();
  return keys.length === 0 ? name : `${name}[${keys.map((k) => `${k}=${chosen[k]}`).join(",")}]`;
}

/** Split a block string into its name and properties. */
export function splitBlock(block: string): { name: string; props: Record<string, string> } {
  const open = block.indexOf("[");
  if (open === -1) return { name: block, props: {} };
  const props: Record<string, string> = {};
  for (const pair of block
    .slice(open + 1)
    .replace(/\]+$/, "")
    .split(",")) {
    const eq = pair.indexOf("=");
    if (eq > 0) props[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return { name: block.slice(0, open), props };
}
