# Milestone MB2 Empirical Challenger Report: Touch Camera Navigation Stress Verification

**Author**: `teamwork_preview_challenger_mb2_2`  
**Working Directory**: `/home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_challenger_mb2_2/`  
**Target Milestone**: MB2 (`FEAT-MB2-01` through `FEAT-MB2-05`)  
**Worker Under Review**: `teamwork_preview_worker_mb2_1`  
**Verdict**: **REQUEST_CHANGES**  
**Timestamp**: 2026-11-07T20:41:00Z

---

## 1. Observation

### 1.1 Baseline Suite Execution

1. Typechecks on render and web packages:

   ```bash
   pnpm --filter @voxwright/render typecheck && pnpm --filter @voxwright/web typecheck
   ```

   Result: Exit code 0, 0 errors, 0 warnings.
2. Vitest test suite:

   ```bash
   pnpm test
   ```

   Result: Exit code 0, 50 test files passed, 804 tests passed, 190 skipped.
3. Touch E2E suite (`apps/web/test/touch-e2e.ts`):

   ```bash
   node apps/web/test/touch-e2e.ts
   ```

   Result: Exit code 0, 34 checks passed.
4. Desktop E2E suite (`apps/web/test/e2e.ts`):

   ```bash
   node apps/web/test/e2e.ts
   ```

   Result: Exit code 0, 338 checks passed.

### 1.2 Empirical Stress Harness Execution (`apps/web/test/challenger-mb2-stress.ts`)

To stress-test 2-finger pan, 2-finger asymmetric pinch zoom, and desktop controls invariance, the challenger created and executed `apps/web/test/challenger-mb2-stress.ts` comprising 114 checks across real Chromium CDP touch emulation and pure mathematical unit feeds:
```bash
node apps/web/test/challenger-mb2-stress.ts
```
Result: **99 CHECKS PASSED, 15 CHECKS FAILED** (Exit code 1).

#### What Passed (99 checks):

- **Rotational Invariance**: In all 2-finger pan vectors and all 2-finger pinch angles, camera azimuth and elevation exhibited strict zero drift:
  - `azimuth strictly invariant (diff: 0.00000°)`
  - `elevation strictly invariant (diff: 0.00000°)`
- **Desktop Mouse & Keyboard Parity**: All 19 desktop assertions passed with 0 drift and 0 errors:
  - Left-click drag orbits camera view with zero target drift and zero distance scaling.
  - Shift + Left-click drag pans camera target with zero angle drift and zero distance scaling.
  - Right-click drag pans camera target with zero angle drift and zero distance scaling.
  - Mouse wheel scales distance with zero angle drift and zero target drift.
  - Keyboard arrow keys turn view properly.
  - Desktop environment activates `input: "builtin"` on `WebglRenderer`.
- **Distance Scaling in Pinch**: Across 30°, 45°, 60°, 120°, 135°, anchor pinch, and asymmetric velocity pinch, camera distance scaled accurately to expected spread ratios (~0.55x on spread expansion, 1.8x on spread contraction).

#### What Failed (15 checks):

1. **Target Drift During Round-Trip Diagonal Pan**:
   - Vector: Forward pan $(+150\text{px}, -130\text{px})$ followed by return pan $(-150\text{px}, +130\text{px})$ at constant finger spacing ($80\text{px}$).
   - Verbatim output:

     ```
     [diag pan] baselineOrbitTarget: [ 4.430036218212093, 15.35596825450796, 15.67520425652975 ]
     [diag pan] midOrbitTarget:      [ 9.234858347589473, 12.133555983742916, 17.289055201296325 ]
     [diag pan] returnedOrbitTarget: [ 3.1930673614410274, 16.184720367162615, 15.258901375573894 ]
     [diag pan] drift: target=1.5460369030340784, az=0, el=0, dist=7.105427357601002e-15
     FAIL round-trip diagonal pan restores target to within <0.01 blocks (drift: 1.54604)
     ```

2. **Spurious Pinch Emission During Pure Parallel Pan**:
   - In `apps/web/test/challenger-mb2-stress.ts` (Part 4.1):
     When two active fingers move by $(+50, -30)$ in parallel:

     ```
     FAIL GestureArbiter must not emit spurious pinch during pure parallel pan (emitted 2 spurious pinch intents)
     ```
   - Feed tracing in Node:

     ```ts
     const arbiter = new GestureArbiter();
     arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
     arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });
     // P1 moves +20px in X:
     r1 = arbiter.feed({ id: 1, type: "move", x: 120, y: 100, time: 30 });
     // [{ type: 'twoFingerPan', dx: 10, dy: 0 }, { type: 'pinch', factor: 1.25, center: { x: 160, y: 100 } }]
     // P2 moves +20px in X:
     r2 = arbiter.feed({ id: 2, type: "move", x: 220, y: 100, time: 30 });
     // [{ type: 'twoFingerPan', dx: 10, dy: 0 }, { type: 'pinch', factor: 0.8, center: { x: 170, y: 100 } }]
     ```

3. **Target Drift During Symmetric Diagonal Pinch Zoom**:
   - In 30°, 45°, 60°, 120°, and 135° symmetric pinch zoom gestures around a stationary center:
     - `FAIL [pinch 30°] zero target drift (0.01593 blocks)`
     - `FAIL [pinch 30° reverse] target returned to baseline (drift: 0.03086)`
     - `FAIL [pinch 45°] zero target drift (0.01632 blocks)`
     - `FAIL [pinch 45° reverse] target returned to baseline (drift: 0.03161)`
     - `FAIL [pinch 60°] zero target drift (0.01593 blocks)`
     - `FAIL [pinch 60° reverse] target returned to baseline (drift: 0.03086)`
     - `FAIL [pinch 120°] zero target drift (0.01593 blocks)`
     - `FAIL [pinch 120° reverse] target returned to baseline (drift: 0.03086)`
     - `FAIL [pinch 135°] zero target drift (0.01632 blocks)`
     - `FAIL [pinch 135° reverse] target returned to baseline (drift: 0.03161)`
4. **Target Drift During Asymmetric Velocity & Anchor Pinch Zoom**:
   - Stationary anchor pinch reverse:
     `FAIL reverse anchor pinch restored target with negligible drift (drift: 0.11007 blocks)`
   - Asymmetric velocity pinch reverse:
     `FAIL round-trip asymmetric velocity pinch restored target (drift: 0.12525 blocks)`
   - 10-Cycle rapid pinch:
     `FAIL 10-cycle rapid pinch produced negligible target drift (0.76605 blocks)`

---

## 2. Logic Chain

1. **Serialized Pointer Event Delivery in Browsers vs. Instantaneous Multi-Touch**:
   - In physical reality and mobile touchscreens, two fingers move concurrently in a single hardware scan frame.
   - However, the browser's DOM event loop serializes multi-touch moves into individual sequential `PointerEvent` dispatches: `pointermove` for Pointer 1, followed by `pointermove` for Pointer 2 (often sharing the exact same `timeStamp`).
2. **Failure of `GestureArbiter` During Parallel Pan**:
   - In `apps/web/src/lib/gestures.ts` lines 213–236, `GestureArbiter.feed(sample)` computes `center` and `spread = Math.hypot(p1.curX - p2.curX, p1.curY - p2.curY)` immediately on _every individual pointer sample_.
   - When Pointer 1's `pointermove` arrives, Pointer 1 has moved by $\Delta$, but Pointer 2 is still at its prior location.
   - Consequently, the measured distance between the two fingers temporarily shrinks (or expands) by $\Delta$.
   - Because `spreadDiff >= 0.25px` is trivially satisfied, `GestureArbiter` emits a spurious `pinch` intent with `factor: 1.25` (a 25% zoom out!), alongside the `twoFingerPan` intent.
   - In `apps/web/src/routes/+page.svelte`, the `pinch` intent calls `renderer.zoomBy(factor)`, which immediately scales `orbit.distance`.
   - When Pointer 2's `pointermove` arrives a microsecond later, Pointer 2 catches up. `spread` returns to its initial value, emitting a second spurious `pinch` with `factor: 0.8` (zooming back in).
3. **Cross-Coupling Pan Distortion & Target Drift**:
   - In `packages/render/src/webgl/controls.ts` lines 90–104, `OrbitController.pan(dxPx, dyPx)` translates `target` scaled by $k = \text{this.distance} \times 0.0015$.
   - Because `renderer.zoomBy` modified `this.distance` between Pointer 1's pan step and Pointer 2's pan step, Pointer 1's pan step was multiplied by $k_0$, but Pointer 2's pan step was multiplied by $k_0 \times 1.25$.
   - When reversing the pan (moving back by $-\Delta$), Pointer 1's initial move increases the spread, multiplying the return step by $k_0 \times 0.833$.
   - Because the forward and reverse half-steps are multiplied by asymmetric, zoom-distorted coefficients ($k_0 \times 1.25$ vs $k_0 \times 0.833$), the pan deltas do not cancel out.
   - This directly produces the observed **1.546 block target drift** on a round-trip diagonal pan, and causes the camera distance to micro-oscillate violently by $\pm 25\%$ on every frame of a two-finger pan.
4. **Failure of `GestureArbiter` During Pinch Zoom**:
   - Symmetrically, during a pinch zoom with a stationary center (e.g. fingers moving symmetrically apart along a $45^\circ$ diagonal), Pointer 1 moving first causes `center = (p1 + p2)/2` to temporarily shift by $\Delta/2$.
   - `GestureArbiter` emits a spurious `twoFingerPan` intent, translating the camera target.
   - When Pointer 2 moves, it emits the opposing pan. However, because `zoomBy` scaled `this.distance` between the two pointer events, the return pan uses a scaled $k$ coefficient.
   - As a result, the two halves of the pan do not cancel out. Over 10 cycles of pinch zooming, the target walks away by **0.766 blocks** without any user pan intention.
5. **Inadequacy of Worker's Original Tests**:
   - In `apps/web/test/gestures.test.ts` lines 115–120:
     Worker called `arbiter.feed(p1)` then `intents = arbiter.feed(p2)` and only asserted `intents.filter(i => i.type === "twoFingerPan").length > 0`. Worker never checked `r1` (from p1), never asserted `pinch.length === 0`, and never verified round-trip reversibility.
   - In `apps/web/test/touch-e2e.ts` lines 328–358:
     Worker only tested one forward pan and asserted `translationDist > 1.0` and that final distance was within $0.05$ (because $1.25 \times 0.8 = 1.0$, final distance appeared unchanged even though it oscillated throughout the gesture). Worker never tested round-trip target reversibility.

---

## 3. Caveats

- **Desktop Workflows Unaffected**: This failure is isolated strictly to the touch gesture pipeline (`GestureArbiter` and `wireTouchGestures` in `apps/web`). Desktop mouse-and-keyboard editing is 100% compliant and unaffected.
- **Rotational Invariance Unaffected**: Azimuth and elevation remain strictly invariant during all touch gestures ($0.00000^\circ$ drift). The bug is entirely in translation/scaling cross-talk.
- **No Implementation Code Modified**: Following the mandatory Teamwork constraint (_"Review-only — do NOT modify implementation code"_), the challenger has not modified source files in `packages/render` or `apps/web/src/`. All tests were authored in `apps/web/test/challenger-mb2-stress.ts`.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES.**

Milestone MB2 cannot be approved in its current state because touch camera navigation violates the core stability and invariance requirements of `docs/mobile-editor-plan.md` §4.2 and `PROJECT.md` (`FEAT-MB2-05`: _"1-finger drag orbits, 2-finger drag pans, 2-finger pinch zooms without drift or jumps"_):
1. **Two-Finger Pan Jitter & Drift**: Every parallel two-finger pan emits spurious pinch intents on every frame, causing distance oscillation ($\pm 25\%$) and target drift of **1.546 blocks** on a simple round trip.
2. **Pinch Zoom Target Drift**: Every symmetric pinch zoom emits spurious pan intents, causing target drift of up to **0.766 blocks** over repeated zoom cycles.

### Actionable Remediation Guidance for Worker:

The worker should implement one of the following standard multi-touch arbitration patterns in `apps/web/src/lib/gestures.ts` (or `+page.svelte`):
1. **Touch Frame Batching / Coalescing**:
   Do not evaluate two-finger gesture deltas immediately on each single-pointer move. Buffer pointer updates per microtask/animation frame (or wait until both active pointers have updated their positions in the current touch packet) before computing `center` and `spread`.
2. **Gesture Disambiguation & Deadbanding**:
   In `GestureArbiter`:
   - If `center` displacement is dominant and spread change over a full gesture step is within a reasonable deadband (e.g., $< 2-3\%$), suppress `pinch` intent emission.
   - Conversely, if spread change is dominant and center shift is within slop, suppress `twoFingerPan` intent emission.
   - Increase the spread sensitivity threshold beyond the brittle $0.25\text{px}$ threshold.
3. **Atomic Multi-Touch Intent**:
   Emit a unified intent (e.g. `{ type: "twoFingerTransform", dx, dy, factor }`) where the pan translation is applied using the pre-zoom camera distance.

---

## 5. Verification Method

To independently reproduce the failures:

1. **Execute the Empirical Challenger Stress Suite**:

   ```bash
   node apps/web/test/challenger-mb2-stress.ts
   ```

   Expected output:
   - 99 passing checks (all desktop controls, rotational invariance, and distance scaling).
   - 15 failing assertions documenting the round-trip pan target drift (1.546 blocks), symmetric pinch target drift (0.016 to 0.031 blocks per pinch, 0.766 blocks on 10 cycles), and spurious pinch emission during parallel pan.
   - Process exit code: 1.

2. **Execute Full Project Baseline**:

   ```bash
   pnpm test
   node apps/web/test/touch-e2e.ts
   node apps/web/test/e2e.ts
   ```
