# Orchestrator 2 Execution Plan

## Immediate Goal: Milestone MB2 Remediation & Gate Pass

### Step 1: Dispatch MB2 Remediation Worker

- **Task**: Remediate sequential pointermove cross-coupling in `apps/web/src/lib/gestures.ts` (and/or `apps/web/src/routes/+page.svelte`).
- **Input Context**:
  - Challenger 2 diagnosis: `/home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_challenger_mb2_2/handoff.md`
  - Challenger stress test: `apps/web/test/challenger-mb2-stress.ts` (114 checks)
  - Unit tests: `apps/web/src/lib/gestures.test.ts`
  - Mobile touch e2e: `apps/web/test/touch-e2e.ts`
  - Desktop e2e: `apps/web/test/e2e.ts`
- **Criteria for Worker Completion**:
  - `node apps/web/test/challenger-mb2-stress.ts` exits 0 (114/114 passing)
  - `pnpm test` exits 0
  - `node apps/web/test/touch-e2e.ts` exits 0
  - `node apps/web/test/e2e.ts` exits 0

### Step 2: Milestone MB2 Gate Verification (Iteration 3)

- Dispatch Reviewers (2)
- Dispatch Challengers (2) (specifically re-running challenger-mb2-stress.ts)
- Dispatch Forensic Auditor (1)
- If all approve and Auditor reports CLEAN: mark MB2 DONE.

### Step 3: Advance to Milestone MB3 (Mobile Layout Shell)

- Decompose MB3:
  - Remove coarse pointer gate in `+page.svelte` (retaining WebGL2 check)
  - Update `apps/web/test/m4-suite.ts` coarse lockout check
  - Full-viewport canvas styling (`100dvh`, `touch-action: none`, `overscroll-behavior: none`, `viewport-fit=cover`)
  - Breakpoint & layout switcher (<1000px vs desktop 3-column)
  - Top app bar & collapsible menu
  - Ergonomic bottom toolbar (thumb zone, >=48px targets)
  - Thumb cluster (Undo, Redo, Confirm, Cancel)
  - Draggable bottom sheet with peek/half/full snap points & `visualViewport` support
  - Mobile panel sheet hosting (Palette, Block State, Selection, View)
- Dispatch Worker -> Gate Verification -> Advance.

### Step 4: Advance through Milestones MB4–MB8

- MB4: Touch placement with offset cursor reticle
- MB5: Armed cell, nudge pad and two-point tools
- MB6: Selection actions and block state by touch
- MB7: Phone performance pass
- MB8: Polish, accessibility, haptics and docs

### Step 5: Final Milestone (Dual-Track Pass & Tier 5 Hardening)

- Full opaque-box E2E suites (Tiers 1-4)
- Tier 5 adversarial hardening loop
- Final report to Sentinel (`79f6b20a7a7f8d5a8a2b93de8f6d1082`)
