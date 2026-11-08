# Milestone MB2 Challenger Report: Adversarial Stress & Empirical Gate Verification

- **Challenger Agent**: `teamwork_challenger_mb2_1`
- **Working Directory**: `/home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_challenger_mb2_1/`
- **Target Milestone**: MB2 (`FEAT-MB2-01` through `FEAT-MB2-05`)
- **Worker Under Review**: `teamwork_worker_mb2_2`
- **Caller / Parent Agent ID**: `e89fc8da9e29666537c98962425a05cd` (orchestrator_2)
- **Verdict**: **REQUEST_CHANGES**
- **Date**: 2026-11-07T21:26:00Z

---

## 1. Observation

### 1.1 Baseline Test Executions

1. **Workspace Unit Tests (`pnpm test`)**:
   - 52 test files passed, 839 passed, 190 skipped (Exit Code 0).
   - `apps/web/test/gestures.test.ts`: 19 passed.
   - `apps/web/test/gestures-adversarial.test.ts`: 24 passed.
2. **Mobile Touch E2E Suite (`node apps/web/test/touch-e2e.ts`)**:
   - 34/34 checks passed (Exit Code 0).
3. **Previous Challenger Stress Harness (`node apps/web/test/challenger-mb2-stress.ts`)**:
   - 114/114 checks passed (Exit Code 0). All 15 previous regressions identified by Challenger 2 now pass with strict 0.00000 blocks drift.
4. **Desktop E2E Suite (`node apps/web/test/e2e.ts`)**:
   - 338/338 checks passed (Exit Code 0).
5. **Dependency Cruiser (`pnpm depcheck`)**:
   - 0 violations found across 336 modules (Exit Code 0).

### 1.2 Newly Authored Empirical Stress Suite (`apps/web/test/challenger-adversarial-deep.test.ts`)

The challenger authored a dedicated adversarial stress test suite in `apps/web/test/challenger-adversarial-deep.test.ts` covering:
- Pointer cancellation invariants across 2-finger and 3-finger interactions.
- Rapid interleaved pointer events with timestamp packet desynchronization.
- Pointer ID recycling across rapid successive gesture cycles.
- Identical coordinate collision robustness (zero distance / singular spread).
- High-entropy fuzzing with 5,000 randomized state transitions.
- **Pass rate**: 10/10 tests passed (Exit Code 0).

### 1.3 Identified Regressions & Invariant Violations

#### 1. Typecheck Failure in `apps/web/src/lib/gestures.ts` (`svelte-check` / `pnpm typecheck` fails)

Running `pnpm --filter @voxwright/web typecheck` or `pnpm typecheck` in the repository root fails with exit code 1:
```
apps/web typecheck: /home/antigravity/lzif/voxwright/apps/web/src/lib/gestures.ts:95:70
apps/web typecheck: Error: No overload matches this call.
apps/web typecheck:   Overload 1 of 2, '(timeout: string | number | Timeout | undefined): void', gave the following error.
apps/web typecheck:     Argument of type 'unknown' is not assignable to parameter of type 'string | number | Timeout | undefined'.
apps/web typecheck:   Overload 2 of 2, '(id: number | undefined): void', gave the following error.
apps/web typecheck:     Argument of type 'unknown' is not assignable to parameter of type 'number | undefined'. 
apps/web typecheck:         config.clearTimeout ??
apps/web typecheck:         ((id) => (typeof clearTimeout !== "undefined" ? clearTimeout(id) : undefined)),
apps/web typecheck:       now:
apps/web typecheck: 
apps/web typecheck: /home/antigravity/lzif/voxwright/apps/web/src/lib/gestures.ts:411:7
apps/web typecheck: Error: Type 'unknown' is not assignable to type 'Timeout | null'. 
apps/web typecheck:     if (this.pendingTimer === null) {
apps/web typecheck:       this.pendingTimer = this.config.setTimeout(() => {
apps/web typecheck:         this.pendingTimer = null;
apps/web typecheck: 
apps/web typecheck: /home/antigravity/lzif/voxwright/apps/web/src/lib/gestures.ts:486:5
apps/web typecheck: Error: Type 'unknown' is not assignable to type 'Timeout | null'. 
apps/web typecheck:     this.longPressCandidateId = id;
apps/web typecheck:     this.longPressTimer = this.config.setTimeout(() => {
apps/web typecheck:       this.stepTime(this.config.now());
apps/web typecheck: 
apps/web typecheck: ====================================
apps/web typecheck: svelte-check found 3 errors and 0 warnings in 1 file
```

#### 2. Invariant Violation: Spurious `multiFingerTap` Emitted After Pointer Cancellation

In `apps/web/src/lib/gestures.ts`, when 2 or 3 pointers are active and one pointer is aborted/cancelled by the platform (`sample.type === "cancel"` due to palm rejection, edge swipe, or system interrupt), `case "cancel"` transitions `this.state` to `"waiting_for_all_up"`, but FAILS to set `this.multiTapEligible = false`.
As a result, when the remaining finger lifts cleanly within 300ms without moving > 12px, `GestureArbiter` emits `{ type: "multiFingerTap", fingers: 2 }` (or `fingers: 3`), falsely triggering an Undo/Redo command from an aborted interaction.

---

## 2. Logic Chain

### 2.1 Causal Analysis of Typecheck Errors

In `apps/web/src/lib/gestures.ts`:
- Lines 31-32 define:

  ```ts
  readonly setTimeout?: (fn: () => void, ms: number) => unknown;
  readonly clearTimeout?: (id: unknown) => void;
  ```
- Lines 70 and 81 define:

  ```ts
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  ```
- In `svelte-check`, `ReturnType<typeof setTimeout>` is Node's `Timeout` (or DOM's `number`). Because `this.config.setTimeout` returns `unknown`, assigning it directly to `this.pendingTimer` (line 411) and `this.longPressTimer` (line 486) violates TypeScript strict typing.
- Similarly, in line 95, passing `id: unknown` to global `clearTimeout` fails because `clearTimeout` rejects type `unknown`.

### 2.2 Causal Analysis of the Cancellation Invariant Defect

1. An intentional multi-finger tap requires all $N$ fingers to touch down, remain stationary within slop ($\le 12\text{px}$), and release cleanly via `pointerup` within `multiTapMaxMs` ($\le 300\text{ms}$).
2. If any pointer is cancelled (`pointercancel`), the touch stream was aborted by the platform.
3. In `apps/web/src/lib/gestures.ts`:
   - Line 186 (`case "down"` with $> 3$ pointers): correctly sets `this.multiTapEligible = false;`.
   - Lines 205, 279, 306 (`move` or `up` exceeding slop/time): correctly set `this.multiTapEligible = false;`.
   - Line 171 (`abortedDrag` on second finger down): correctly sets `this.multiTapEligible = false;`.
   - **Line 339 (`case "cancel"`)**: sets `this.state = "waiting_for_all_up"`, but leaves `this.multiTapEligible = true`.
4. When the companion pointer(s) release (`case "up"` in `waiting_for_all_up`), line 314 checks `if (this.multiTapEligible && !this.abortedDrag && (this.maxConcurrentPointers === 2 || this.maxConcurrentPointers === 3))`. Since `multiTapEligible` was never cleared, it emits `{ type: "multiFingerTap", fingers: 2 }`.

---

## 3. Caveats & Scope Boundaries

- **Pinch/Pan Precision**: The mathematical and geometric integration for 2-finger pan, symmetric pinch zoom, anchor pinch, and asymmetric velocity pinch is robust ($0.00000$ blocks drift across all 114 checks).
- **Desktop Parity**: 100% maintained (338/338 checks passing).
- **Remediation Scope**: The required remediation is strictly confined to `apps/web/src/lib/gestures.ts` (timer typing and 1-line `multiTapEligible = false;` in `case "cancel"`).

---

## 4. Conclusion & Gate Verdict

**Gate Verdict**: **REQUEST_CHANGES**

The implementation is very close to approval, but cannot pass the MB2 gate while `pnpm typecheck` fails with 3 errors and an invariant defect permits cancelled touches to trigger spurious `multiFingerTap` events.

### Required Changes for Worker:

1. **Fix Timer Typing in `apps/web/src/lib/gestures.ts`**:
   - Type timer handles consistently so `pnpm --filter @voxwright/web typecheck` and `pnpm typecheck` pass with 0 errors. (For example, use `ReturnType<typeof setTimeout> | null` for `setTimeout`/`clearTimeout` signatures or appropriate type casts).
2. **Restore Invariant on Pointer Cancellation**:
   - In `apps/web/src/lib/gestures.ts` line 341 (`case "cancel"`), add:

     ```ts
     this.multiTapEligible = false;
     ```
   - Update `apps/web/test/challenger-adversarial-deep.test.ts` line 32 to assert `expect(emittedMultiTap).toBe(false);`.

---

## 5. Verification Method

To verify the remediation:
```bash
# 1. Typecheck must pass with 0 errors across all workspace packages
pnpm typecheck

# 2. Vitest unit and adversarial suites must pass
pnpm test

# 3. Mobile touch E2E must pass (34/34 checks)
node apps/web/test/touch-e2e.ts

# 4. Challenger stress harness must pass (114/114 checks)
node apps/web/test/challenger-mb2-stress.ts

# 5. Desktop regression suite must pass (338/338 checks)
node apps/web/test/e2e.ts

# 6. Biome linter check
pnpm biome check apps/web/src/lib/gestures.ts apps/web/test/gestures.test.ts apps/web/test/challenger-adversarial-deep.test.ts
```
