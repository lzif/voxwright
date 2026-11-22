// SPDX-License-Identifier: AGPL-3.0-only

// TIME-BOXED: this module is removed at 0.1.0, together with its tests, its two call sites (the
// resolver hook in `main.ts` and `findConfig` in `../cli.ts`) and its name-gate exception.
//
// It holds the only old names left in the code base. A tombstone is not an alias: an old import
// specifier or an old config file resolves to nothing. It only turns the silent or confusing
// failure into an error that names the rename. Without it a stray old config file would be ignored
// and the Minecraft version would fall back to the default, which is wrong output with no error.

/** Import specifiers the 0.0.3 CLI or its workspace accepted. A recipe importing one fails. */
export const OLD_IMPORTS: readonly string[] = [
  "voxwright",
  "mcbuild",
  "mcbuilder",
  "@voxwright/mcbuilder",
  "@voxwright/mcbuild",
  "@voxwright/core",
  "@voxwright/render",
];

/** Config file names 0.0.3 read. One found where `voxmc.toml` is looked up is an error. */
export const OLD_CONFIG_NAMES: readonly string[] = ["mcbuild.toml"];

/** The error text for a recipe importing an old specifier, or `null` when it is not one. */
export function oldImportMessage(specifier: string): string | null {
  const hit = OLD_IMPORTS.find((name) => specifier === name || specifier.startsWith(`${name}/`));
  if (hit === undefined) return null;
  return `'${specifier}' was renamed: this project is now called voxmc. Change the import to \`import { ... } from "voxmc"\`; the old names resolve to nothing`;
}

/** The error text for an old config file found at `path`. */
export function oldConfigMessage(path: string): string {
  return `${path}: the config file was renamed to voxmc.toml. Rename it (same contents) and run again; the old name is not read`;
}
