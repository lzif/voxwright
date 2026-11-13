// SPDX-License-Identifier: AGPL-3.0-only

// Shared by every subcommand of the skill CLI (`scripts/voxwright-cli.mjs`).

/** Everything a subcommand touches outside its arguments. Tests replace it. */
export interface SkillIo {
  /** Write one line to stdout. */
  out(line: string): void;
  /** Write one line to stderr. */
  err(line: string): void;
  /** Directory that relative paths on the command line resolve against. */
  cwd: string;
  /** The user's home directory; caches live under it. */
  home: string;
  env: Readonly<Record<string, string | undefined>>;
}

/**
 * A failure the CLI reports as one line instead of a stack trace.
 * `exitCode` 2 is a usage error; 1 is a failed build, read, export or preview.
 */
export class SkillCliError extends Error {
  readonly exitCode: 1 | 2;

  constructor(message: string, exitCode: 1 | 2 = 1) {
    super(message);
    this.name = "SkillCliError";
    this.exitCode = exitCode;
  }
}
