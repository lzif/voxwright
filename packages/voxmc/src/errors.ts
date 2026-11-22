// SPDX-License-Identifier: AGPL-3.0-only

/** Base class for all voxmc errors. */
export class VoxmcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Misuse of the Build API (placing outside `build.scope`, bad arguments). */
export class BuildError extends VoxmcError {}

/** A placement fell outside the grid's allowed dimensions. */
export class GridBoundsError extends VoxmcError {}
