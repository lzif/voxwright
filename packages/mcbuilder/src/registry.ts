// SPDX-License-Identifier: AGPL-3.0-only

// Block registry validator.
//
// Validates canonical block strings (`namespace:name[prop=value,...]{nbt}`)
// against a version-pinned block registry derived from PrismarineJS
// minecraft-data. Unknown names produce errors with did-you-mean
// suggestions; the registry never silently rewrites a name. Block-entity
// NBT is opaque: only brace balance is checked, never the schema.

import { compareCodePoints, getCloseMatches, pyStrip, suggest } from "@voxwright/core";
import { McbuilderError } from "./errors.ts";
import { pyRepr, pyReprList } from "./pyrepr.ts";

const AIR = "minecraft:air";

/** What {@link normalizeBlockData} returns: `{ block: { properties: { property: [legal values] } } }`. */
export type NormalizedBlocks = Record<string, { properties: Record<string, string[]> }>;
/** A registry's own view: `{ block: { property: [legal values] } }`. */
export type RegistryBlocks = Record<string, Record<string, string[]>>;

export class RegistryError extends McbuilderError {}

interface RawState {
  name: string;
  type?: string;
  values?: unknown[];
}

/**
 * Normalize raw minecraft-data into the registry mapping. Accepts either the
 * list format of minecraft-data's `blocks.json`, or an already-normalized
 * `{ blocks: { ... } }` mapping.
 */
export function normalizeBlockData(raw: unknown): NormalizedBlocks {
  if (Array.isArray(raw)) {
    const blocks: NormalizedBlocks = {};
    for (const entry of raw as { name: string; states?: RawState[] }[]) {
      const props: Record<string, string[]> = {};
      for (const state of entry.states ?? []) {
        let values = state.values;
        if (values === undefined || values === null) {
          // minecraft-data omits "values" for bool states.
          values = state.type === "bool" ? ["true", "false"] : [];
        }
        props[state.name] = values.map(String);
      }
      blocks[`minecraft:${entry.name}`] = { properties: props };
    }
    return blocks;
  }
  const mapping = (raw as { blocks?: unknown } | null)?.blocks;
  if (typeof mapping === "object" && mapping !== null && !Array.isArray(mapping)) {
    const blocks: NormalizedBlocks = {};
    for (const [name, info] of Object.entries(
      mapping as Record<string, { properties?: Record<string, unknown[]> } | null>,
    )) {
      const props: Record<string, string[]> = {};
      for (const [p, vals] of Object.entries(info?.properties ?? {})) props[p] = vals.map(String);
      blocks[name] = { properties: props };
    }
    return blocks;
  }
  throw new McbuilderError(
    'unrecognized registry data: expected a minecraft-data blocks.json list or a {"blocks": {...}} mapping',
  );
}

class BlockSyntaxError extends Error {}

// name [ [props] ] [{nbt}]: props cannot contain ']', NBT runs to the end.
const BLOCK_RE = /^([^[{]+)(?:\[([^\]]*)\])?(\{.*\})?$/s;

function splitBlock(block: string): {
  name: string;
  props: Map<string, string>;
  nbt: string | null;
} {
  const match = BLOCK_RE.exec(pyStrip(block));
  if (!match) throw new BlockSyntaxError(`malformed block string: ${pyRepr(block)}`);
  const name = pyStrip(match[1] as string);
  if (name === "")
    throw new BlockSyntaxError(`malformed block string (empty name): ${pyRepr(block)}`);
  const props = new Map<string, string>();
  if (match[2] !== undefined) {
    for (const raw of match[2].split(",")) {
      const part = pyStrip(raw);
      if (part === "") continue;
      const eq = part.indexOf("=");
      if (eq === -1) {
        throw new BlockSyntaxError(
          `malformed property ${pyRepr(part)} in ${pyRepr(block)} (want name=value)`,
        );
      }
      props.set(pyStrip(part.slice(0, eq)), pyStrip(part.slice(eq + 1)));
    }
  }
  return { name, props, nbt: match[3] ?? null };
}

/** True if braces, brackets and parens are balanced; quoted strings are skipped. */
function nbtBalanced(nbt: string): boolean {
  const closers: Record<string, string> = { "}": "{", "]": "[", ")": "(" };
  const stack: string[] = [];
  let i = 0;
  const n = nbt.length;
  while (i < n) {
    const ch = nbt[i] as string;
    if (ch === '"' || ch === "'") {
      i++;
      while (i < n && nbt[i] !== ch) {
        if (nbt[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }
    if ("{[(".includes(ch)) stack.push(ch);
    else if (ch in closers) {
      if (stack.length === 0 || stack.pop() !== closers[ch]) return false;
    }
    i++;
  }
  return stack.length === 0;
}

export interface ValidationError {
  block: string;
  message: string;
  suggestions: string[];
}
export interface ValidationWarning {
  block: string;
  message: string;
}

export class Registry {
  readonly version: string;
  readonly blocks: RegistryBlocks;

  constructor(blocks: NormalizedBlocks, version: string) {
    this.version = version;
    this.blocks = {};
    for (const [name, info] of Object.entries(blocks)) {
      const props: Record<string, string[]> = {};
      for (const [p, vals] of Object.entries(info?.properties ?? {})) props[p] = vals.map(String);
      this.blocks[name] = props;
    }
  }

  /** Build from raw minecraft-data (either accepted shape). */
  static fromData(raw: unknown, version: string): Registry {
    try {
      return new Registry(normalizeBlockData(raw), version);
    } catch (e) {
      throw new RegistryError(
        `registry data for ${version} has an unexpected shape: ${(e as Error).message}`,
      );
    }
  }

  /** All known block names (namespaced), sorted. */
  names(): string[] {
    return Object.keys(this.blocks).sort(compareCodePoints);
  }

  private suggestName(name: string, n = 3): string[] {
    return suggest(name, this.names()).slice(0, n);
  }

  private static allowlistName(entry: string): string {
    try {
      return splitBlock(entry).name;
    } catch {
      return pyStrip(entry);
    }
  }

  /**
   * Validate a palette of canonical block strings. Unknown names are errors
   * with suggestions, illegal properties or values are errors listing what is
   * legal, allowlisted custom names pass with a warning, NBT is only checked
   * for balance, and `minecraft:air` is always legal.
   */
  validate(
    palette: readonly string[],
    allowlist: readonly string[] = [],
  ): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const allowed = new Set(allowlist.map(Registry.allowlistName));

    for (const block of palette) {
      let parsed: ReturnType<typeof splitBlock>;
      try {
        parsed = splitBlock(block);
      } catch (e) {
        if (!(e instanceof BlockSyntaxError)) throw e;
        errors.push({ block, message: e.message, suggestions: [] });
        continue;
      }
      const { name, props, nbt } = parsed;
      if (name === AIR) continue;

      if (nbt !== null && !nbtBalanced(nbt)) {
        errors.push({
          block,
          message: `unbalanced braces/brackets in block-entity NBT of ${pyRepr(block)}`,
          suggestions: [],
        });
        continue;
      }

      const info = Object.hasOwn(this.blocks, name) ? this.blocks[name] : undefined;
      if (info === undefined) {
        if (allowed.has(name)) {
          warnings.push({
            block,
            message: `${name} is allowlisted: unvalidated, build at own risk`,
          });
        } else if (name.includes(":") && !name.startsWith("minecraft:")) {
          errors.push({
            block,
            message: `unknown block ${pyRepr(name)} (not in the ${this.version} registry); add it to \`allowlist\` in mcbuild.toml if it is a modded/custom block`,
            suggestions: [],
          });
        } else {
          errors.push({
            block,
            message: `unknown block ${pyRepr(name)} (not in the ${this.version} registry)`,
            suggestions: this.suggestName(name),
          });
        }
        continue;
      }

      for (const [prop, value] of props) {
        const legal = Object.hasOwn(info, prop) ? info[prop] : undefined;
        if (legal === undefined) {
          errors.push({
            block,
            message: `unknown property ${pyRepr(prop)} on ${name}; legal properties: ${pyReprList(Object.keys(info).sort(compareCodePoints))}`,
            suggestions: getCloseMatches(prop, Object.keys(info), 3, 0.6),
          });
          continue;
        }
        if (!legal.includes(value)) {
          const lower = value.toLowerCase();
          const hint = legal.some((v) => v.toLowerCase() === lower)
            ? ` (did you mean ${pyRepr(lower)}? values are case-sensitive)`
            : "";
          errors.push({
            block,
            message: `illegal value ${pyRepr(value)} for property ${pyRepr(prop)} on ${name}${hint}; legal values: ${pyReprList(legal)}`,
            suggestions: [],
          });
        }
      }
    }
    return { errors, warnings };
  }
}
