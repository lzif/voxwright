// SPDX-License-Identifier: AGPL-3.0-only

// report.json builder.
//
//   {
//     errors:   [{ block, message, suggestions, at }],
//     warnings: [...],
//     block_counts: { "minecraft:stone": 12 },
//     dimensions: { x, y, z } | null,
//     origin: [minx, miny, minz] | null,
//     views:    [{ file, azimuth, elevation, label, directions_untrusted, directions_trusted }],
//     artifacts: [...],
//     overwritten_placements: n,
//     run_dir: "dist/run-003"
//   }
//
// Every fast-tier preview is flagged `directions_untrusted: true`: the fast
// renderer cannot show facing or connection state.

export interface ViewLike {
  azimuth: number;
  elevation: number;
  label: string;
}

export interface ViewEntry {
  file: string;
  azimuth: number;
  elevation: number;
  label: string;
  directions_untrusted: boolean;
  directions_trusted: boolean;
}

export function viewEntry(options: {
  file: string;
  view: ViewLike;
  directionsUntrusted?: boolean;
  directionsTrusted?: boolean;
}): ViewEntry {
  return {
    file: options.file,
    azimuth: options.view.azimuth,
    elevation: options.view.elevation,
    label: options.view.label,
    directions_untrusted: options.directionsUntrusted ?? true,
    directions_trusted: options.directionsTrusted ?? false,
  };
}

export interface Report {
  errors: Record<string, unknown>[];
  warnings: Record<string, unknown>[];
  block_counts: Record<string, number>;
  dimensions: { x: number; y: number; z: number } | null;
  origin: number[] | null;
  views: ViewEntry[];
  artifacts: Record<string, unknown>[];
  overwritten_placements: number;
  run_dir: string;
}

export interface ReportInput {
  errors: readonly Record<string, unknown>[];
  warnings: readonly Record<string, unknown>[];
  blockCounts: Readonly<Record<string, number>>;
  dimensions: readonly [number, number, number] | null;
  views: readonly ViewEntry[];
  runDir: string;
  artifacts?: readonly Record<string, unknown>[] | null;
  overwrittenPlacements?: number;
  origin?: readonly number[] | null;
}

/** Assemble the report. Inputs are copied, never mutated. */
export function buildReport(input: ReportInput): Report {
  return {
    errors: input.errors.map((e) => ({ ...e })),
    warnings: input.warnings.map((w) => ({ ...w })),
    block_counts: { ...input.blockCounts },
    dimensions: input.dimensions
      ? { x: input.dimensions[0], y: input.dimensions[1], z: input.dimensions[2] }
      : null,
    origin: input.origin ? input.origin.map((v) => Math.trunc(v)) : null,
    views: input.views.map((v) => ({ ...v })),
    artifacts: input.artifacts ? input.artifacts.map((a) => ({ ...a })) : [],
    overwritten_placements: input.overwrittenPlacements ?? 0,
    run_dir: input.runDir,
  };
}

/**
 * The report as JSON text: two-space indent, ASCII only, trailing newline,
 * the same layout Python's `json.dumps(report, indent=2)` writes. Whole
 * floats print without a `.0`.
 */
export function reportToJson(report: Report): string {
  const text = JSON.stringify(report, null, 2);
  return `${text.replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)}\n`;
}
