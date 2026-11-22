// SPDX-License-Identifier: AGPL-3.0-only

// Arc de Triomphe de l'Etoile, Paris, with the Place Charles de Gaulle roundabout.
//
// Coordinates: 1 block = 1 m, arch centred at x = 0, z = 0, +x east (toward the
// Champs-Elysees), +z south, ground surface at y = -1.
//
// Two modules, run in this order:
// - place.ts: the ground over x, z in [-90, 90], the island, the ring road, the twelve avenues,
//   trees and lamps. It leaves x in [-14, 14], z in [-25, 25] empty above y = -1.
// - arch.ts: the monument in that zone, including the tomb slab at ground level.
//
// Usage:
//   mcbuild check examples/arc_de_triomphe/arc-de-triomphe.ts
//   mcbuild run examples/arc_de_triomphe/arc-de-triomphe.ts --preview --guide

import { Build } from "../../src/index.ts";
import { buildArch } from "./arch.ts";
import { buildPlace } from "./place.ts";

export const BUILD = new Build({ seed: 1836, views: "iso;az200_el025;az110_el015;top" });

// Both modules open their own `BUILD.scope` internally.
buildPlace(BUILD);
buildArch(BUILD);
