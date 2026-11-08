import {
  GestureArbiter,
  type GestureIntent,
  pointerEventToSample,
} from "../../../apps/web/src/lib/gestures.ts";
import { OrbitController } from "../../../packages/render/src/webgl/controls.ts";

console.log("=== ADVERSARIAL STRESS TEST: GESTURE ARBITER & CAMERA MATH ===");

let passed = 0;
let total = 0;
function test(name: string, fn: () => void) {
  total++;
  try {
    fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err);
  }
}

// 1. GestureArbiter Adversarial Inputs
test("GestureArbiter handles unmounted/phantom move events without down", () => {
  const arbiter = new GestureArbiter();
  const intents = arbiter.feed({ id: 999, type: "move", x: 100, y: 100, time: 100 });
  if (intents.length !== 0) throw new Error("Expected empty intents on phantom move");
});

test("GestureArbiter handles phantom up events without down", () => {
  const arbiter = new GestureArbiter();
  const intents = arbiter.feed({ id: 999, type: "up", x: 100, y: 100, time: 100 });
  if (intents.length !== 0) throw new Error("Expected empty intents on phantom up");
});

test("GestureArbiter handles cancel on empty state", () => {
  const arbiter = new GestureArbiter();
  const intents = arbiter.feed({ id: 999, type: "cancel", x: 100, y: 100, time: 100 });
  if (intents.length !== 0) throw new Error("Expected empty intents on empty cancel");
});

test("GestureArbiter handles 10 concurrent fingers without crashing", () => {
  const arbiter = new GestureArbiter();
  for (let i = 1; i <= 10; i++) {
    arbiter.feed({ id: i, type: "down", x: i * 20, y: 100, time: 10 });
  }
  for (let i = 1; i <= 10; i++) {
    arbiter.feed({ id: i, type: "move", x: i * 20 + 5, y: 105, time: 20 });
  }
  for (let i = 1; i <= 10; i++) {
    arbiter.feed({ id: i, type: "up", x: i * 20 + 5, y: 105, time: 30 });
  }
});

test("GestureArbiter second-finger arrival during drag strictly cancels and shifts to two-finger mode", () => {
  const intents: GestureIntent[] = [];
  const arbiter = new GestureArbiter({ onIntent: (i) => intents.push(i) });

  // Finger 1 down and drag
  arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
  arbiter.feed({ id: 1, type: "move", x: 120, y: 100, time: 20 });
  if (!intents.some((i) => i.type === "oneFingerDragStart")) throw new Error("Missing drag start");

  // Finger 2 arrives mid-drag
  const cancelIntents = arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 30 });
  if (!cancelIntents.some((i) => i.type === "cancel"))
    throw new Error("Second finger must abort active stroke");

  // Both fingers move -> must only emit twoFingerPan or pinch, NEVER oneFingerDragMove
  const moveIntents = arbiter.feed({ id: 1, type: "move", x: 130, y: 100, time: 40 });
  if (moveIntents.some((i) => i.type === "oneFingerDragMove")) {
    throw new Error("Must NOT emit oneFingerDragMove after stroke abortion!");
  }
  if (!moveIntents.some((i) => i.type === "twoFingerPan")) {
    throw new Error("Must emit twoFingerPan for movement");
  }

  // Fingers release -> must NEVER emit oneFingerDragEnd
  const up1 = arbiter.feed({ id: 1, type: "up", x: 130, y: 100, time: 50 });
  const up2 = arbiter.feed({ id: 2, type: "up", x: 200, y: 100, time: 60 });
  if ([...up1, ...up2].some((i) => i.type === "oneFingerDragEnd")) {
    throw new Error("Must NOT emit oneFingerDragEnd after aborted drag!");
  }
});

// 2. Camera Transformations & OrbitController
test("OrbitController pan preserves azimuth and elevation angles", () => {
  const orbit = new OrbitController();
  orbit.azimuth = 37.5;
  orbit.elevation = -22.3;
  orbit.distance = 50;
  orbit.target = [10, 20, 30];

  orbit.pan(150, -80);
  if (Math.abs(orbit.azimuth - 37.5) > 1e-9) throw new Error("Pan changed azimuth!");
  if (Math.abs(orbit.elevation - -22.3) > 1e-9) throw new Error("Pan changed elevation!");
  if (Math.abs(orbit.distance - 50) > 1e-9) throw new Error("Pan changed distance!");
  if (orbit.target[0] === 10 && orbit.target[1] === 20 && orbit.target[2] === 30) {
    throw new Error("Pan did not move target!");
  }
});

test("OrbitController zoom is strictly reversible within precision limits", () => {
  const orbit = new OrbitController();
  orbit.distance = 40;
  const factor = 1.75;
  orbit.zoom(factor);
  orbit.zoom(1 / factor);
  if (Math.abs(orbit.distance - 40) > 1e-9) {
    throw new Error(`Zoom not reversible: distance is ${orbit.distance}`);
  }
});

test("OrbitController zoom respects minDistance and maxDistance bounds", () => {
  const orbit = new OrbitController();
  orbit.zoom(0.00000001);
  if (orbit.distance < orbit.minDistance) throw new Error("Distance fell below minDistance");
  orbit.zoom(100000000);
  if (orbit.distance > orbit.maxDistance) throw new Error("Distance exceeded maxDistance");
});

test("OrbitController rotate clamps elevation to [-89, 89] and wraps azimuth", () => {
  const orbit = new OrbitController();
  orbit.rotate(0, 1000); // extreme up
  if (orbit.elevation > 89) throw new Error("Elevation exceeded 89");
  orbit.rotate(0, -2000); // extreme down
  if (orbit.elevation < -89) throw new Error("Elevation fell below -89");

  orbit.rotate(1000, 0); // azimuth wrap
  if (orbit.azimuth < 0 || orbit.azimuth >= 360)
    throw new Error(`Azimuth out of [0, 360): ${orbit.azimuth}`);
});

console.log(`\nAdversarial tests finished: ${passed}/${total} passed.`);
if (passed !== total) process.exit(1);
