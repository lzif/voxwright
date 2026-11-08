# Milestone MB2 Gate Verification (Iteration 3) — Reviewer 2 Report

- **Reviewer**: Reviewer 2 (`teamwork_reviewer_mb2_2`)
- **Worker Reviewed**: `teamwork_worker_mb2_2`
- **Working Directory**: `/home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_reviewer_mb2_2/`
- **Milestone**: MB2 Multi-Touch Gesture Drift Remediation (`FEAT-MB2-01` through `FEAT-MB2-05`)
- **Target Specification**: `/home/antigravity/lzif/voxwright/docs/mobile-editor-plan.md`
- **Worker Handoff Reviewed**: `/home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_worker_mb2_2/handoff.md`
- **Date**: 2026-11-07

---

## 1. Observation

All verification commands specified in the review focus and assignment instructions were executed independently against the workspace.

### 1.1 Verification Results Matrix

| Check / Command                                                                | Expected / Worker Claim | Independent Verification Result                                       | Verdict  |
| :----------------------------------------------------------------------------- | :---------------------- | :-------------------------------------------------------------------- | :------- |
| `pnpm test`                                                                    | 51 test files pass      | **51/51 test files passed**, 829 passed, 190 skipped (Exit Code 0)    | **PASS** |
| `pnpm biome check apps/web/src/lib/gestures.ts apps/web/test/gestures.test.ts` | 0 errors, 0 warnings    | Checked 2 files. **0 errors, 0 warnings** (Exit Code 0)               | **PASS** |
| `node apps/web/test/touch-e2e.ts`                                              | 34/34 checks pass       | **34/34 checks passed** (Exit Code 0)                                 | **PASS** |
| `node apps/web/test/challenger-mb2-stress.ts`                                  | 114/114 checks pass     | **114/114 checks passed** (Exit Code 0) across repeated runs          | **PASS** |
| `pnpm depcheck`                                                                | 0 violations            | ✔ no dependency violations found (337 modules cruised)                | **PASS** |
| `pnpm --filter @voxwright/render typecheck`                                    | 0 errors                | 0 errors, 0 warnings (Exit Code 0)                                    | **PASS** |
| `pnpm --filter @voxwright/web typecheck`                                       | 0 errors claimed        | **FAIL (Exit Code 1)** with **3 compilation errors in `gestures.ts`** | **FAIL** |
| `pnpm typecheck`                                                               | 0 errors claimed        | **FAIL (Exit Code 1)** due to web package compilation errors          | **FAIL** |

---

### 1.2 Independent Defect Discovery: TypeScript Compilation Failure

While the worker handoff explicitly asserted:
> `pnpm --filter @voxwright/render typecheck && pnpm --filter @voxwright/web typecheck`
> **Result**: **0 errors and 0 warnings (Exit Code 0)**.

Running `pnpm --filter @voxwright/web typecheck` actually fails with **3 errors in `apps/web/src/lib/gestures.ts`**:

```text
/home/antigravity/lzif/voxwright/apps/web/src/lib/gestures.ts:95:70
Error: No overload matches this call.
  Overload 1 of 2, '(timeout: string | number | Timeout | undefined): void', gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | number | Timeout | undefined'.
  Overload 2 of 2, '(id: number | undefined): void', gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'number | undefined'. 
        config.clearTimeout ??
        ((id) => (typeof clearTimeout !== "undefined" ? clearTimeout(id) : undefined)),

/home/antigravity/lzif/voxwright/apps/web/src/lib/gestures.ts:411:7
Error: Type 'unknown' is not assignable to type 'Timeout | null'. 
    if (this.pendingTimer === null) {
      this.pendingTimer = this.config.setTimeout(() => {
        this.pendingTimer = null;

/home/antigravity/lzif/voxwright/apps/web/src/lib/gestures.ts:486:5
Error: Type 'unknown' is not assignable to type 'Timeout | null'. 
    this.longPressCandidateId = id;
    this.longPressTimer = this.config.setTimeout(() => {
      this.stepTime(this.config.now());
```

**Root Cause**:
In `apps/web/src/lib/gestures.ts`:
- `GestureArbiterConfig.setTimeout` was declared returning `unknown`: `(fn: () => void, ms: number) => unknown`.
- `GestureArbiterConfig.clearTimeout` was declared accepting `unknown`: `(id: unknown) => void`.
- In `GestureArbiter`, `this.pendingTimer` and `this.longPressTimer` are declared as `ReturnType<typeof setTimeout> | null`.
- Under strict TypeScript mode, `this.config.setTimeout(...)` (`unknown`) cannot be assigned to `ReturnType<typeof setTimeout> | null`.
- Furthermore, in the fallback `config.clearTimeout ?? ((id) => clearTimeout(id))`, passing `id: unknown` into global `clearTimeout` violates its type signature (`NodeJS.Timeout | number | string | undefined`).

---

## 2. Logic Chain: Technical Critique

### 2.1 Multi-Touch Event Arbitration & Timing

1. **Touch Packet Coalescing (`pendingMovePointers`)**:
   - Chromium serializes multi-touch `pointermove` events per finger within an event frame.
   - Tracking `pendingMovePointers` ensures that when all active pointers report (`pendingMovePointers.size >= this.pointers.size`), the arbiter evaluates the gesture atomically.
   - This cleanly resolved the intermediate false deformation where Pointer 1 moved before Pointer 2 reported.

2. **Macrotask Fallback Timer (`schedulePendingFlush`) & Timer Hygiene**:
   - The fallback timer with delay 0 (`this.config.setTimeout(..., 0)`) prevents starvation during anchor pinches where companion fingers are stationary.
   - **Timing Edge Case & Hygiene Risk**:
     - In `gestures.ts` line 113, when a non-move event arrives (`sample.type !== "move"`), the arbiter clears `pendingMovePointers`, but does NOT cancel `this.pendingTimer`.
     - In `gestures.ts` lines 298-303 (when 1 finger lifts from a 2-finger gesture transitioning to `waiting_for_all_up`), `pendingMovePointers` is cleared, but `cancelPendingFlush()` is NOT called.
     - While `flush()` guards against this with `if (this.pendingMovePointers.size > 0 && this.state === "two_pointer_gesture")`, leaving un-cancelled timers in the event loop queue is poor event loop hygiene and risks premature evaluation if a stationary-finger sequence transitions rapidly.
     - **Recommendation**: Explicitly call `this.cancelPendingFlush()` whenever transitioning away from `two_pointer_gesture` or clearing pending move packets.

3. **Gesture Disambiguation & Deadband Thresholds**:
   - In `evaluateTwoFingerMove()`:
     - Parallel pan dominance: `isPinchSignificant = spreadDiff >= 1.0 && (panDist < 1.0 || relSpreadChange >= 0.015)`.
     - Pinch zoom dominance: `isPanSignificant = panDist >= 0.1 && (spreadDiff < 1.0 || (panDist >= 0.5 && panDist >= 0.08 * spreadDiff))`.
   - These thresholds successfully filter capacitive touch chatter (sub-pixel tremor $\pm 0.5\text{px}$) during intentional pans, and prevent accidental pan intents during rapid pinch zooms.

4. **Geometric Mean Distance Scaling in `apps/web/src/routes/+page.svelte`**:
   - In `wireTouchGestures`, simultaneous `twoFingerPan` and `pinch` intents are flushed together.
   - The translation delta is scaled by $d_{\text{eff}} / d_{\text{start}}$, where $d_{\text{eff}} = \sqrt{d_{\text{start}} \cdot d_{\text{end}}}$.
   - Mathematically:
     $$\Delta T_{\text{fwd}} = -\mathbf{R} \cdot \Delta \mathbf{x} \cdot \left(\frac{\sqrt{d_0 d_1}}{d_0}\right) \cdot (d_0 k) = -\mathbf{R} \cdot \Delta \mathbf{x} \cdot \sqrt{d_0 d_1} \cdot k$$
     $$\Delta T_{\text{rev}} = -\mathbf{R} \cdot (-\Delta \mathbf{x}) \cdot \left(\frac{\sqrt{d_1 d_0}}{d_1}\right) \cdot (d_1 k) = +\mathbf{R} \cdot \Delta \mathbf{x} \cdot \sqrt{d_0 d_1} \cdot k$$
     $$\text{Net Drift} = \Delta T_{\text{fwd}} + \Delta T_{\text{rev}} = \mathbf{0}$$
   - This guarantees machine-precision reversibility ($0.00000$ blocks drift), as confirmed in Challenger 2's reverse anchor pinch and asymmetric velocity pinch tests.

---

### 2.2 Memory Safety & Event Listener Hygiene

1. **DOM Event Listeners in `+page.svelte`**:
   - In `wireTouchGestures`, pointerdown, pointermove, pointerup, and pointercancel listeners are attached to canvas.
   - `gestureCleanup` properly removes all four listeners from the canvas element.
   - `gestureCleanup` is invoked:
     - At the start of `wireTouchGestures` (avoiding duplicate listeners).
     - In `startGpu()` catch block on WebGL initialization failure.
     - In `onMount` destructor on component teardown.
   - Zero leak risk on canvas DOM listeners.

2. **Pointer and Timer State in `GestureArbiter`**:
   - Pointer samples are stored in `this.pointers = new Map<number, ActivePointer>()`.
   - On `up` or `cancel`, pointers are deleted with `this.pointers.delete(sample.id)`.
   - When all pointers lift, `this.reset()` clears `this.pointers.clear()`, cancels `longPressTimer`, and cancels `pendingTimer`.
   - The 5,000-event chaotic fuzz test in `apps/web/test/gestures-adversarial.test.ts` verified that arbiter states cleanly recover to `idle` with zero orphaned entries in `this.pointers`.

---

## 3. Caveats & Remaining Risks

1. **Timer Type Defect Blocking CI / Builds**:
   - The type mismatch in `gestures.ts` will fail any standard CI pipeline that runs `pnpm typecheck` or `svelte-check`.
   - Type definitions should be unified:

     ```ts
     export type TimerHandle = ReturnType<typeof setTimeout>;

     export interface GestureArbiterConfig {
       readonly setTimeout?: (fn: () => void, ms: number) => TimerHandle;
       readonly clearTimeout?: (id: TimerHandle) => void;
       ...
     }
     ```

2. **Macrotask Turn Boundary Jitter**:
   - Because `schedulePendingFlush()` relies on `setTimeout(..., 0)`, high system load or heavy main-thread GC could delay Companion Pointer 2's event past the macrotask execution. In our testing, 114/114 assertions passed reliably across multiple test runs, but calling `cancelPendingFlush()` across all non-move phase transitions will provide even stronger determinism.

---

## 4. Conclusion & Gate Verdict

### **Verdict**: **REQUEST_CHANGES**

**Justification**:
The multi-touch gesture math, touch packet coalescing, and desktop compatibility are mathematically sound and pass all 114 challenger checks, 34 touch E2E checks, and 338 desktop regression checks. However, **`apps/web/src/lib/gestures.ts` fails TypeScript compilation with 3 type errors**, directly contradicting the worker's handoff claim of "0 errors, 0 warnings (Exit Code 0)". A gate approval cannot be granted while source files fail workspace typechecks.

### Action Items for Worker:

1. Fix timer type definitions in `apps/web/src/lib/gestures.ts`:
   - Define a strongly typed timer handle `TimerHandle = ReturnType<typeof setTimeout>`.
   - Type `config.setTimeout` as `(fn: () => void, ms: number) => TimerHandle`.
   - Type `config.clearTimeout` as `(id: TimerHandle) => void`.
2. Strengthen timer cancellation hygiene:
   - Call `this.cancelPendingFlush()` when discarding pending move packets on non-move samples (`sample.type !== "move"`), and on pointerup/cancel transitioning to `waiting_for_all_up`.
3. Verify that `pnpm --filter @voxwright/web typecheck` and `pnpm typecheck` exit with code 0 (0 errors, 0 warnings).

---

## 5. Verification Method

Exact commands to reproduce findings and verify the required fix:

```bash
# 1. Verify TypeScript typechecks (currently failing with 3 errors in gestures.ts):
pnpm --filter @voxwright/render typecheck && pnpm --filter @voxwright/web typecheck

# 2. Run full repo typecheck:
pnpm typecheck

# 3. Run workspace unit tests:
pnpm test

# 4. Build web app:
pnpm --filter @voxwright/web build

# 5. Run Challenger stress harness (114 checks):
node apps/web/test/challenger-mb2-stress.ts

# 6. Run mobile touch E2E suite (34 checks):
node apps/web/test/touch-e2e.ts

# 7. Run desktop regression suite (338 checks):
node apps/web/test/e2e.ts

# 8. Run Biome and dependency cruiser:
pnpm biome check apps/web/src/lib/gestures.ts apps/web/test/gestures.test.ts apps/web/test/gestures-adversarial.test.ts
pnpm depcheck
```
