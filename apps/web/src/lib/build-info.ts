// SPDX-License-Identifier: AGPL-3.0-only

// Where this build's source code is, for the footer. The values are fixed when the site is built
// (see `build-info-config.ts` and vite.config.ts), so a self-hosted, modified copy can point at its
// own source, which is what the AGPL asks of anyone who runs a modified version for others.

declare const __VOXWRIGHT_SOURCE_URL__: string;
declare const __VOXWRIGHT_SOURCE_LINK__: string;
declare const __VOXWRIGHT_COMMIT__: string;
declare const __VOXWRIGHT_MODIFIED__: boolean;
declare const __VOXWRIGHT_VERSION__: string;

export const buildInfo = {
  /** The repository. */
  sourceUrl: __VOXWRIGHT_SOURCE_URL__,
  /** The exact version of the source this site was built from (a commit page when known, else the repository). */
  sourceLink: __VOXWRIGHT_SOURCE_LINK__,
  /** The git commit the site was built from, or "" when unknown. */
  commit: __VOXWRIGHT_COMMIT__,
  /** Was the working tree different from that commit when the site was built? */
  modified: __VOXWRIGHT_MODIFIED__,
  version: __VOXWRIGHT_VERSION__,
} as const;
