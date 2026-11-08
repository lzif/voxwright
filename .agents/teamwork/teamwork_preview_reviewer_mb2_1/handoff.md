# Milestone MB2 Review & Adversarial Critic Report: Input Ownership and the Gesture Arbiter

**Author**: `teamwork_preview_reviewer_mb2_1`  
**Working Directory**: `/home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_reviewer_mb2_1/`  
**Milestone**: MB2 (`FEAT-MB2-01` through `FEAT-MB2-05`)  
**Timestamp**: 2026-11-07T20:36:00Z

---

## 1. Review Summary & Verdict

**Verdict: APPROVE**

Milestone MB2 delivers the required input ownership decoupling, public camera manipulation API, pure zero-DOM gesture arbiter state machine, touch gesture wiring in the web application, and touch E2E test verification. All 34 mobile touch assertions in `touch-e2e.ts` pass, all 338 desktop assertions in `e2e.ts` pass, all 89 web Vitest unit tests pass, and `depcheck` reports 0 violations. No integrity violations or task bypasses were identified. Four minor code hygiene and adversarial robustness findings have been cataloged below for awareness in future milestones.

---

## 2. Integrity Assessment

| Integrity Dimension            | Evaluation                                                                                                                                                     | Result |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Hardcoded test outputs         | Verified CDP dispatch and Three.js matrix updates; dynamic hashes and distance changes asserted                                                                | PASS   |
| Dummy / facade implementations | `GestureArbiter` maintains a full pointer map, timestamp tracking, and state transitions; `WebglRenderer` camera methods directly operate Three.js controllers | PASS   |
| Shortcuts / task bypass        | Pure zero-DOM arbiter implemented from scratch without external libraries                                                                                      | PASS   |
| Fabricated logs / outputs      | Independently reproduced typechecks, Vitest runs, desktop E2E (338 checks), touch E2E (34 checks), and depcruise                                               | PASS   |
| Independent verification       | Ran test suites independently in fresh processes                                                                                                               | PASS   |

**Result**: NO INTEGRITY VIOLATIONS DETECTED.

---

## 3. Observation

### 3.1 Verification Commands and Output

The reviewer independently executed the required verification commands:

1. **Typechecks**:

   ```bash
   pnpm --filter @voxwright/render typecheck && pnpm --filter @voxwright/web typecheck
   ```

   Output:
   - `@voxwright/render`: `tsc -p tsconfig.json && tsc -p tsconfig.webgl.json` exited with code 0.
   - `@voxwright/web`: `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json` exited with code 0 (0 errors, 0 warnings).

2. **Vitest Unit Tests**:
   - `pnpm --filter @voxwright/render test && pnpm --filter @voxwright/web test`:
     - Render: 9 passed (9 test files, 91 passed, 174 skipped).
     - Web: 7 passed (7 test files, 89 passed). `apps/web/test/gestures.test.ts` (18 tests) passed in 17ms.
   - Total workspace `pnpm test`:
     - During high concurrent execution across 50 workers, `packages/core/test/volume-bounds.test.ts` hit a 5000ms Vitest timeout at 5361ms under CPU saturation. When run directly (`pnpm --filter @voxwright/core test test/volume-bounds.test.ts`), all 5 tests passed in 4381ms.

3. **Touch E2E Suite**:

   ```bash
   node apps/web/test/touch-e2e.ts
   ```

   Output: `34 checks passed` (0 errors).
   Direct observations:
   - 1-finger orbit: azimuth changed $45.0^\circ \to 93.0^\circ$, elevation $35.0^\circ \to 51.0^\circ$, distance change $< 0.05$, canvas image hash changed.
   - 2-finger pan: azimuth change $< 0.05^\circ$, elevation change $< 0.05^\circ$, distance change $< 0.05$, 3D translation $> 4.15$ blocks, canvas image hash changed.
   - 2-finger pinch: 2.0x zoom-out ($22.4 \to 44.8$), target drift $< 0.044$ blocks, round-trip zoom-in restored original distance ($44.8 \to 22.4$, baseline $22.4$) without azimuth/elevation drift.

4. **Desktop E2E Suite**:

   ```bash
   node apps/web/test/e2e.ts
   ```

   Output: `338 checks passed` (0 errors, 0 desktop regressions).

5. **Dependency Boundary Verification**:

   ```bash
   pnpm depcheck
   ```

   Output: `✔ no dependency violations found (332 modules, 833 dependencies cruised)` (exit code 0).

### 3.2 Deliverable Inspections

1. `packages/render/src/webgl/renderer.ts`:
   - Line 58: `WebglRendererOptions` accepts `input?: "builtin" | "external"`.
   - Line 280: Interactive listeners (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `wheel`, `keydown`, `keyup`, `blur`) gated behind `if (this.options.input !== "external")`. Lifecycle listeners remain active.
   - Lines 428–463: Added `orbitBy`, `panBy`, `zoomBy`, `focusOn` with finite-number validation (`Number.isFinite`) and distance clamping.
2. `packages/render/src/types.ts`:
   - Created at root `src/types.ts` with 26 lines duplicating `WebglRendererOptions`. It is never imported by any file in `@voxwright/render` or `@voxwright/web`.
3. `apps/web/src/lib/gestures.ts`:
   - Implements `GestureArbiter` state machine with states: `idle`, `one_pointer_down`, `one_pointer_dragging`, `one_pointer_long_press`, `two_pointer_gesture`, `three_pointer_gesture`, and `waiting_for_all_up`.
   - Lines 132–136: Second-finger arrival during active drag aborts stroke immediately: emits `{ type: "cancel" }`, clears `dragActive`, marks `abortedDrag = true`, transitions to `two_pointer_gesture`.
   - Lines 218–236: Updates `this.twoFingerPrevCenter = center;` and `this.twoFingerPrevSpread = spread;` on every move event.
4. `apps/web/src/routes/+page.svelte`:
   - Lines 657–664: Evaluates `isTouch = coarse.matches && !fine.matches;`.
   - When `isTouch` is true, passes `input: "external"` and calls `wireTouchGestures(canvas, r)`.
   - When false (desktop), passes `input: "builtin"` without touch listeners.
   - Lines 635–641, 680, 769: Calls `gestureCleanup?.()` on unmount and error.

---

## 4. Logic Chain

1. **Decoupling and Desktop Backwards Compatibility**:
   - `WebglRendererOptions.input` defaults to `"builtin"`.
   - Headless desktop tests and standard desktop browsers report `coarse.matches === false` (or fine pointer present), resolving `isTouch = false`.
   - The desktop path instantiates `WebglRenderer` with `input: "builtin"`, which attaches the identical 8 interactive DOM listeners as before.
   - The full desktop test suite passes 338/338 checks with zero regressions.

2. **Touch Ownership Decoupling**:
   - On touch-first environments, `isTouch = true` activates `input: "external"`.
   - `WebglRenderer` skips canvas pointer/wheel/key listeners, preventing conflicting dual-handling between renderer controllers and web application input handlers.
   - `wireTouchGestures` attaches canvas pointer handlers (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) with pointer capture (`setPointerCapture`), converting them into pure `PointerSample` streams fed to `GestureArbiter`.

3. **Camera Method Precision & Reversibility**:
   - `orbitBy(dx, dy)` delegates directly to `this.orbit.rotate(dxPx, dyPx)` and requests a frame.
   - `panBy(dx, dy)` translates camera target in screen-aligned plane coordinates using camera right/up vectors.
   - `zoomBy(factor)` scales distance multiplicatively. Pinch gestures emit `factor = prevSpread / spread`, which forms a telescoping product: total distance change over a gesture is $\prod \frac{s_{i-1}}{s_i} = \frac{s_0}{s_n}$. This produces exact round-trip reversibility ($22.4 \to 44.8 \to 22.4$), confirmed by test assertions.
   - Azimuth and elevation drift during pan and pinch are $< 0.05^\circ$, and target translation drift during pinch zoom is $< 0.044$ blocks.

4. **Second-Finger Stroke Abort**:
   - When a 1-finger tool drag is active and a 2nd finger touches down, the arbiter transitions immediately to `two_pointer_gesture` and emits `{ type: "cancel" }`.
   - `abortedDrag = true` prevents the subsequent finger lifts from being misidentified as a 2-finger tap.
   - Parallel movement immediately transitions into smooth camera pan/pinch without jumps.

---

## 5. Adversarial Findings & Challenges

### Finding 1 [Minor]: Orphaned / Unused File `packages/render/src/types.ts`

- **Location**: `packages/render/src/types.ts:1-26`
- **Description**:
  The worker created `packages/render/src/types.ts` defining `WebglRendererOptions`. However, this file is never imported or exported anywhere. `WebglRendererOptions` is already defined in `packages/render/src/webgl/renderer.ts` and re-exported in `packages/render/src/webgl/index.ts`.
- **Impact**: Harmless dead code, but creates confusion and duplicate type definitions.
- **Mitigation / Next Step**: Unify or remove `packages/render/src/types.ts` in subsequent milestone cleanup.

### Finding 2 [Minor / Adversarial Challenge]: High-Frequency Micro-Movement Loss (Deadband Leak)

- **Location**: `apps/web/src/lib/gestures.ts:218–236`
- **Description**:
  In `two_pointer_gesture`, `twoFingerPrevCenter` and `twoFingerPrevSpread` are unconditionally advanced on every move event:

  ```typescript
  if (this.twoFingerPrevCenter) {
    const dx = center.x - this.twoFingerPrevCenter.x;
    const dy = center.y - this.twoFingerPrevCenter.y;
    if (Math.abs(dx) >= 0.1 || Math.abs(dy) >= 0.1) {
      intents.push({ type: "twoFingerPan", dx, dy });
    }
  }
  ...
  this.twoFingerPrevCenter = center;
  this.twoFingerPrevSpread = spread;
  ```
- **Attack Scenario**:
  On a high-frequency (120Hz) touch screen or with very slow finger movement, if each touchmove event yields $|dx| < 0.1$ px or spread change $< 0.25$ px, the delta is suppressed and `twoFingerPrevCenter` / `twoFingerPrevSpread` are advanced anyway. The accumulated movement is discarded.
- **Blast Radius**: Very slow, crawling multi-touch pans or pinches may feel unresponsive or deadbanded.
- **Mitigation**: Update `twoFingerPrevCenter` only when a pan intent is emitted (or maintain an accumulator). For standard touch movement, deltas exceed 1px and operate smoothly.

### Finding 3 [Minor]: Biome Lint Warnings in `gestures.ts`

- **Location**: `apps/web/src/lib/gestures.ts:31, 32, 70, 173, 174`
- **Description**:
  `moveDx` and `moveDy` are computed at lines 173–174 but never read. `any` is used for timer signatures.
- **Mitigation**: Remove unused variables or prefix with `_`, and type timer handles as `ReturnType<typeof setTimeout> | null`.

### Finding 4 [Minor]: Vitest Parallel Concurrency Saturation

- **Location**: `packages/core/test/volume-bounds.test.ts:96`
- **Description**:
  When all 50 test files run in parallel under `pnpm test`, `Volume.placedBounds cache equals a full recomputation` took 5361ms, narrowly tripping Vitest's 5000ms default timeout. It passes in 4.3s in isolation.
- **Mitigation**: Add `{ timeout: 10000 }` to that specific test case or configure Vitest testTimeout.

---

## 6. Caveats

1. **Dynamic Resolution Scaling**: Per project roadmap (`FEAT-MB7-01`), dynamic downscaling of canvas resolution during active touch gestures is assigned to Milestone MB7.
2. **Fly Mode Hidden on Touch**: As documented in `mobile-editor-plan.md` §2.7 and decision 2, Fly camera mode is hidden on touch devices and is not mapped to touch gestures.

---

## 7. Conclusion

Milestone MB2 satisfies all requirements specified in `PROJECT.md` and `docs/mobile-editor-plan.md`:
- `WebglRendererOptions` cleanly supports `input: "builtin" | "external"`.
- `WebglRenderer` exposes robust, guarded public camera methods (`orbitBy`, `panBy`, `zoomBy`, `focusOn`).
- `GestureArbiter` is a zero-DOM pure state machine thoroughly verified by Vitest unit tests.
- Touch camera navigation (1-finger orbit, 2-finger pan, 2-finger pinch) operates without drift or jumps.
- Existing desktop editing workflows and test suites pass with 100% parity.

**Final Verdict: APPROVE**.

---

## 8. Verification Method

To independently reproduce this review:

1. **Typechecks**:

   ```bash
   pnpm --filter @voxwright/render typecheck && pnpm --filter @voxwright/web typecheck
   ```
2. **Build Web App**:

   ```bash
   pnpm --filter @voxwright/web build
   ```
3. **Mobile Touch E2E (34 checks)**:

   ```bash
   node apps/web/test/touch-e2e.ts
   ```
4. **Desktop E2E (338 checks)**:

   ```bash
   node apps/web/test/e2e.ts
   ```
5. **Vitest Unit Suites**:

   ```bash
   pnpm --filter @voxwright/render test && pnpm --filter @voxwright/web test
   ```
6. **Architecture Dependency Rules**:

   ```bash
   pnpm depcheck
   ```
