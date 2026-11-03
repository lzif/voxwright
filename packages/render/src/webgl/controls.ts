// SPDX-License-Identifier: AGPL-3.0-only

// The two cameras as plain state plus input handling, with no three.js in it:
// each turns pointer and key events into numbers (`position`, `azimuth`,
// `elevation`) that the renderer applies to its camera.
//
// Angles follow the CPU renderer: `azimuth` is degrees clockwise from north
// (-Z) looking at the target, `elevation` is degrees above the horizon that
// the camera sits at, so the view direction is
// `(-sin az cos el, -sin el, cos az cos el)` in both cameras.

export type Vec3 = [number, number, number];

const RAD = Math.PI / 180;
export const lookDirection = (azimuth: number, elevation: number): Vec3 => [
  -Math.sin(azimuth * RAD) * Math.cos(elevation * RAD),
  -Math.sin(elevation * RAD),
  Math.cos(azimuth * RAD) * Math.cos(elevation * RAD),
];

const wrap = (deg: number): number => ((deg % 360) + 360) % 360;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Camera pose that a controller maintains. */
export interface Pose {
  position: Vec3;
  azimuth: number;
  elevation: number;
}

export class OrbitController {
  target: Vec3 = [0, 0, 0];
  distance = 40;
  azimuth = 45;
  elevation = 35;
  minDistance = 2;
  maxDistance = 2000;

  position(): Vec3 {
    const d = lookDirection(this.azimuth, this.elevation);
    return [
      this.target[0] - d[0] * this.distance,
      this.target[1] - d[1] * this.distance,
      this.target[2] - d[2] * this.distance,
    ];
  }

  rotate(dxPx: number, dyPx: number): void {
    this.azimuth = wrap(this.azimuth + dxPx * 0.4);
    this.elevation = clamp(this.elevation + dyPx * 0.4, -89, 89);
  }

  zoom(factor: number): void {
    this.distance = clamp(this.distance * factor, this.minDistance, this.maxDistance);
  }

  /** Move the target in the screen plane. */
  pan(dxPx: number, dyPx: number): void {
    const d = lookDirection(this.azimuth, this.elevation);
    // right = d x up, normalised; up' = right x d
    const rl = Math.hypot(d[0], d[2]) || 1;
    const right: Vec3 = [-d[2] / rl, 0, d[0] / rl];
    const up: Vec3 = [
      right[1] * d[2] - right[2] * d[1],
      right[2] * d[0] - right[0] * d[2],
      right[0] * d[1] - right[1] * d[0],
    ];
    const k = this.distance * 0.0015;
    for (let i = 0; i < 3; i++)
      this.target[i] =
        (this.target[i] as number) - (right[i] as number) * dxPx * k + (up[i] as number) * dyPx * k;
  }

  /** Adopt a fly camera's pose, looking at the point `distance` ahead of it. */
  fromPose(p: Pose): void {
    const d = lookDirection(p.azimuth, p.elevation);
    this.azimuth = p.azimuth;
    this.elevation = clamp(p.elevation, -89, 89);
    this.target = [
      p.position[0] + d[0] * this.distance,
      p.position[1] + d[1] * this.distance,
      p.position[2] + d[2] * this.distance,
    ];
  }

  pose(): Pose {
    return { position: this.position(), azimuth: this.azimuth, elevation: this.elevation };
  }
}

export const FLY_KEYS = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  up: ["Space", "KeyE"],
  down: ["KeyC", "KeyQ"],
  fast: ["ShiftLeft", "ShiftRight"],
} as const;

export class FlyController {
  position: Vec3 = [0, 0, 0];
  azimuth = 45;
  elevation = 35;
  /** Cells per second. */
  speed = 24;
  readonly keys = new Set<string>();

  private held(group: readonly string[]): boolean {
    return group.some((k) => this.keys.has(k));
  }

  /** Whether any movement key is down. */
  moving(): boolean {
    return (
      this.held(FLY_KEYS.forward) ||
      this.held(FLY_KEYS.back) ||
      this.held(FLY_KEYS.left) ||
      this.held(FLY_KEYS.right) ||
      this.held(FLY_KEYS.up) ||
      this.held(FLY_KEYS.down)
    );
  }

  look(dxPx: number, dyPx: number): void {
    this.azimuth = wrap(this.azimuth + dxPx * 0.15);
    this.elevation = clamp(this.elevation + dyPx * 0.15, -89, 89);
  }

  /** Advance by `dt` seconds of held keys. Returns whether the camera moved. */
  step(dt: number): boolean {
    if (!this.moving()) return false;
    const d = lookDirection(this.azimuth, this.elevation);
    const rl = Math.hypot(d[0], d[2]) || 1;
    const right: Vec3 = [-d[2] / rl, 0, d[0] / rl];
    const axis = (plus: readonly string[], minus: readonly string[]): number =>
      (this.held(plus) ? 1 : 0) - (this.held(minus) ? 1 : 0);
    const f = axis(FLY_KEYS.forward, FLY_KEYS.back);
    const r = axis(FLY_KEYS.right, FLY_KEYS.left);
    const u = axis(FLY_KEYS.up, FLY_KEYS.down);
    const v = this.speed * (this.held(FLY_KEYS.fast) ? 4 : 1) * dt;
    this.position = [
      this.position[0] + (d[0] * f + right[0] * r) * v,
      this.position[1] + (d[1] * f + u) * v,
      this.position[2] + (d[2] * f + right[2] * r) * v,
    ];
    return true;
  }

  scaleSpeed(factor: number): void {
    this.speed = clamp(this.speed * factor, 1, 400);
  }

  fromPose(p: Pose): void {
    this.position = [...p.position];
    this.azimuth = p.azimuth;
    this.elevation = clamp(p.elevation, -89, 89);
  }

  pose(): Pose {
    return { position: [...this.position], azimuth: this.azimuth, elevation: this.elevation };
  }
}
