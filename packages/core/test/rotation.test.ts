// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  mirrorBlockstate,
  ROTATIONS,
  type Rotation,
  RotationError,
  rotateBlockstate,
  rotatePoint,
  rotatePosition,
} from "../src/index.ts";
import { loadVector } from "./helpers.ts";

interface Vectors {
  rotations: Rotation[];
  positions: { x: number; z: number; size: number; rotation: Rotation; result: [number, number] }[];
  points: {
    x: number;
    z: number;
    ax: number;
    az: number;
    rotation: Rotation;
    result: [number, number];
  }[];
  blockstates: { input: string; rotation: Rotation; result: string }[];
  mirrors: { input: string; axis: "x" | "z"; result: string }[];
  invalid: { call: string }[];
}

const v = loadVector<Vectors>("rotation.json");

describe("rotation against the Python oracle", () => {
  it("lists the same rotations in the same order", () => {
    expect([...ROTATIONS]).toEqual(v.rotations);
  });

  it("rotates positions", () => {
    expect(v.positions.length).toBeGreaterThan(300);
    for (const c of v.positions) {
      expect(rotatePosition(c.x, c.z, c.size, c.rotation)).toEqual(c.result);
    }
  });

  it("rotates points about an anchor", () => {
    for (const c of v.points) {
      expect(rotatePoint(c.x, c.z, c.ax, c.az, c.rotation)).toEqual(c.result);
    }
  });

  it("rotates block states", () => {
    expect(v.blockstates.length).toBeGreaterThan(90);
    for (const c of v.blockstates) {
      expect(rotateBlockstate(c.input, c.rotation), `${c.input} ${c.rotation}`).toBe(c.result);
    }
  });

  it("mirrors block states", () => {
    for (const c of v.mirrors) {
      expect(mirrorBlockstate(c.input, c.axis), `${c.input} ${c.axis}`).toBe(c.result);
    }
  });

  it("rejects invalid rotations and axes", () => {
    expect(() => rotatePosition(0, 0, 3, "SIDEWAYS" as Rotation)).toThrow(RotationError);
    expect(() => rotateBlockstate("minecraft:stone", "SIDEWAYS" as Rotation)).toThrow(
      RotationError,
    );
    expect(() => mirrorBlockstate("minecraft:stone", "y" as "x")).toThrow(RotationError);
    expect(v.invalid).toHaveLength(3);
  });

  it("four quarter turns return to the start", () => {
    for (const c of v.blockstates.filter((b) => b.rotation === "NONE")) {
      let s = c.input;
      for (let i = 0; i < 4; i++) s = rotateBlockstate(s, "CLOCKWISE_90");
      expect(s).toBe(c.input);
    }
  });
});
