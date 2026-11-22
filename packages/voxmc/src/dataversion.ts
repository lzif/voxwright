// SPDX-License-Identifier: AGPL-3.0-only

import { McbuilderError } from "./errors.ts";

export class ExportError extends McbuilderError {}

/**
 * DataVersion per release, from https://minecraft.wiki/w/Data_version
 * (as recorded by mcbuilder, verified 2026-10-09). A fallback only: the
 * client jar's `version.json` (`world_version`), fetched by the assets
 * command, always wins when present.
 */
export const DATA_VERSIONS: Readonly<Record<string, number>> = {
  "26.2": 4903,
  "26.1": 4786,
  "1.21.11": 4671,
  "1.21.4": 4189,
  "1.21.1": 3955,
};

/**
 * The integer DataVersion for a pinned MC version. `versionJson` is the
 * parsed `version.json` from the assets cache, if there is one.
 */
export function resolveDataVersion(mcVersion: string, versionJson?: unknown): number {
  const wv = (versionJson as { world_version?: unknown } | null | undefined)?.world_version;
  if (typeof wv === "number" && Number.isInteger(wv)) return wv;
  const known = Object.hasOwn(DATA_VERSIONS, mcVersion) ? DATA_VERSIONS[mcVersion] : undefined;
  if (known === undefined) {
    throw new ExportError(
      `unknown DataVersion for MC version '${mcVersion}': run \`mcbuild assets fetch --version ${mcVersion}\` first so the client jar's version.json can supply it`,
    );
  }
  return known;
}
