// SPDX-License-Identifier: AGPL-3.0-only

import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { camera } from "../src/index.ts";
import { FlyController, lookDirection, OrbitController, pickRay } from "../src/webgl/controls.ts";

const near = (a: readonly number[], b: readonly number[], eps = 1e-9): void => {
  for (const [i, v] of a.entries()) expect(Math.abs(v - (b[i] as number))).toBeLessThan(eps);
};

describe("camera controllers", () => {
  it("look in the direction the CPU renderer's camera does", () => {
    for (const [az, el] of [
      [0, 0],
      [45, 35],
      [200, 60],
      [315, -20],
    ] as const) {
      near(lookDirection(az, el), camera({ azimuth: az, elevation: el, label: "" }).d);
    }
  });

  it("orbit: the camera sits distance away from the target, looking at it", () => {
    const o = new OrbitController();
    o.target = [10, 5, -3];
    o.distance = 30;
    o.azimuth = 120;
    o.elevation = 25;
    const p = o.position();
    expect(Math.hypot(p[0] - 10, p[1] - 5, p[2] + 3)).toBeCloseTo(30, 9);
    const d = lookDirection(120, 25);
    near([p[0] + d[0] * 30, p[1] + d[1] * 30, p[2] + d[2] * 30], [10, 5, -3]);
    expect(p[1]).toBeGreaterThan(5); // positive elevation: above the target
  });

  it("orbit: dragging turns, clamps the tilt, and zoom stays in range", () => {
    const o = new OrbitController();
    o.rotate(100, 10000);
    expect(o.elevation).toBe(89);
    o.rotate(-100000, -100000);
    expect(o.elevation).toBe(-89);
    expect(o.azimuth).toBeGreaterThanOrEqual(0);
    expect(o.azimuth).toBeLessThan(360);
    o.zoom(1e-9);
    expect(o.distance).toBe(o.minDistance);
    o.zoom(1e12);
    expect(o.distance).toBe(o.maxDistance);
  });

  it("orbit: panning moves the target across the view, not along it", () => {
    const o = new OrbitController();
    o.azimuth = 30;
    o.elevation = 20;
    const before = [...o.target];
    o.pan(40, 0);
    const moved = o.target.map((v, i) => v - (before[i] as number)) as [number, number, number];
    const d = lookDirection(30, 20);
    expect(Math.abs(moved[0] * d[0] + moved[1] * d[1] + moved[2] * d[2])).toBeLessThan(1e-9);
    expect(Math.hypot(...moved)).toBeGreaterThan(0);
  });

  it("fly: W goes along the view, S back, A and D sideways, and speed scales with time", () => {
    const f = new FlyController();
    f.position = [0, 50, 0];
    f.azimuth = 90;
    f.elevation = 0;
    f.speed = 10;
    f.keys.add("KeyW");
    expect(f.step(0.5)).toBe(true);
    near(f.position, [-5, 50, 0]); // azimuth 90 looks toward -x
    f.keys.clear();
    expect(f.step(1)).toBe(false);
    f.keys.add("KeyS");
    f.step(0.5);
    near(f.position, [0, 50, 0]);
    f.keys.clear();
    f.keys.add("KeyD");
    f.step(1);
    expect(Math.abs(f.position[2])).toBeCloseTo(10, 9); // sideways, not along the view
    expect(f.position[0]).toBeCloseTo(0, 9);
    f.keys.clear();
    f.keys.add("Space");
    f.step(1);
    expect(f.position[1]).toBeCloseTo(60, 9);
    f.keys.add("ShiftLeft");
    const y = f.position[1];
    f.step(1);
    expect(f.position[1] - y).toBeCloseTo(40, 9); // shift is four times faster
  });

  it("switching between the cameras keeps the view", () => {
    const o = new OrbitController();
    o.target = [20, 10, 20];
    o.distance = 50;
    o.azimuth = 77;
    o.elevation = 33;
    const f = new FlyController();
    f.fromPose(o.pose());
    const back = new OrbitController();
    back.distance = 50;
    back.fromPose(f.pose());
    near(back.target, o.target, 1e-9);
    expect(back.azimuth).toBeCloseTo(77, 9);
    expect(back.elevation).toBeCloseTo(33, 9);
  });

  it("fly: looking turns by the mouse and clamps the pitch", () => {
    const f = new FlyController();
    f.azimuth = 350;
    f.look(100, -1e6);
    expect(f.azimuth).toBeGreaterThanOrEqual(0);
    expect(f.azimuth).toBeLessThan(360);
    expect(f.elevation).toBe(-89);
  });
});

describe("pickRay", () => {
  it("goes through the middle of the screen along the look direction", () => {
    const o = new OrbitController();
    o.azimuth = 120;
    o.elevation = 25;
    const ray = pickRay(o.pose(), 60, 1.6, 0, 0);
    near(ray.direction, lookDirection(120, 25));
    near(ray.origin, o.position());
  });

  it("matches the ray three.js builds for the same camera, at the corners and off centre", () => {
    const o = new OrbitController();
    o.target = [10, 5, -3];
    o.distance = 30;
    o.azimuth = 215;
    o.elevation = -20;
    const pose = o.pose();
    const cam = new PerspectiveCamera(60, 1.6, 0.1, 4000);
    cam.position.set(...pose.position);
    const look = lookDirection(pose.azimuth, pose.elevation);
    cam.lookAt(pose.position[0] + look[0], pose.position[1] + look[1], pose.position[2] + look[2]);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    for (const [x, y] of [
      [-1, -1],
      [1, 1],
      [0.5, -0.25],
      [-0.9, 0.7],
    ] as const) {
      const far = new Vector3(x, y, 0.5).unproject(cam);
      const expected = far.sub(cam.position).normalize();
      near(pickRay(pose, 60, 1.6, x, y).direction, [expected.x, expected.y, expected.z], 1e-6);
    }
  });
});
