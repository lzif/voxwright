# Execution Plan: Mobile Editor (MB1–MB8)

## Overview

Decomposition and sequential execution of Milestones MB1 through MB8, followed by Dual-Track E2E Test Suite pass and Tier 5 Adversarial Coverage Hardening.

## Milestones & Execution Stages

1. **Milestone MB1: Phone Baseline and Test Harness**
   - Touch-emulated E2E project (`apps/web/test/touch-e2e.ts`) using headless Chromium via puppeteer-core (viewport 390x844, DPR 3, hasTouch).
   - Telemetry HUD overlay (`?perf=1`) in `apps/web/src/lib/components/PerfOverlay.svelte` showing FPS, triangles, heap, DPR, first frame latency.
   - Physical phone testing guide in `docs/phone-test-checklist.md`.
   - Baseline performance measurements recorded.
   - Exit Criteria: Touch E2E opens page and executes orbit/viewer tests; overlay functional; 0 desktop regressions.

2. **Milestone MB2: Input Ownership and the Gesture Arbiter**
   - Additive `input: "builtin" | "external"` on `WebglRendererOptions` and public camera methods on `WebglRenderer`.
   - Pure gesture arbiter `apps/web/src/lib/gestures.ts` and unit tests in Vitest (`gestures.test.ts`).
   - Wire gestures to camera in external mode on touch.
   - Exit Criteria: 1-finger orbit, 2-finger pan & pinch zoom without jump/drift; 2nd finger cancels active stroke; desktop suites pass unmodified.

3. **Milestone MB3: Mobile Layout Shell**
   - Remove coarse pointer editor lockout in `apps/web/src/routes/+page.svelte` (retaining WebGL2 requirement).
   - Full-viewport canvas (`100dvh`, `touch-action: none`, `overscroll-behavior: none`, `env(safe-area-inset)`).
   - Top app bar with collapsible menu; bottom toolbar (>=48px targets); thumb cluster (Undo/Redo); draggable bottom sheet with snap points (peek, half, full) and `visualViewport` keyboard handling.
   - Update `apps/web/test/m4-suite.ts` coarse-device assertion.
   - Exit Criteria: At 390x844 no page scroll or overflow; tools can be selected; desktop 1280x800 layout pixel-identical.

4. **Milestone MB4: Touch Placement with the Offset Cursor**
   - `EditSession` touch input pipeline with ~64px offset cursor reticle.
   - Visual reticle indicator above finger.
   - Single-tap place/replace/erase, continuous brush strokes, stroke cancellation on drag into toolbar or off-screen.
   - Second-finger cancellation mid-stroke. Long-press eyedropper pick (~450ms).
   - Exit Criteria: Tap places block under reticle; drag paints single undo step; second finger aborts stroke; long press picks block.

5. **Milestone MB5: Armed Cell, Nudge Pad and Two-Point Tools**
   - Confirm mode and modal armed cell state (`armed: Vec3 | null`).
   - `NudgePad` on-screen d-pad steppers (±X, ±Y, ±Z).
   - Two-point Line tool, Rectangle tool, Box Selection with corner toggling.
   - Selection face steppers and Paste ghost with nudge pad.
   - Exit Criteria: 5-block line, 4x3 hollow rect, 3x3x3 selection by touch only; nudging changes cell by exactly 1; equal to desktop commands.

6. **Milestone MB6: Selection Actions and Block State by Touch**
   - Selection sheet actions (Fill, Replace A→B, Copy, Paste, Rotate CW/CCW, Mirror X/Z, Move with steppers).
   - Block-state sheet with boolean toggle switches, segmented chips for properties, "Rotate block" button.
   - Recent blocks hotbar (8 recents + favourites) with `localStorage` persistence.
   - Exit Criteria: Full selection transform workflow, block state orientation edit, exported schematic round-trips cell-for-cell.

7. **Milestone MB7: Phone Performance Pass**
   - Dynamic resolution scaling (DPR 1.0–1.5 during camera gestures, full on idle).
   - Quality presets (Auto/High/Low), demand-driven frame rendering (`requestFrame`).
   - Coarse-device history cap clamp (16/32 MiB) and worker pool clamp (2 workers).
   - Exit Criteria: Smooth rendering, stroke latency <100ms, zero software regression.

8. **Milestone MB8: Polish, Accessibility and Docs**
   - Transient commit toasts with 4s Undo action; haptic feedback (`navigator.vibrate`).
   - Left-handed layout toggle; optional multi-finger tap shortcuts.
   - Touch help walkthrough, WCAG 2.5.5 target size verification, extended `contrast.test.ts`.
   - Exit Criteria: Every gesture has button equivalent; contrast suite passes; clean CI.

9. **Final Milestone: Dual-Track E2E Test Suite & Adversarial Coverage Hardening**
   - Run 100% of E2E test suite (Tiers 1-4).
   - Tier 5 Adversarial Coverage Hardening loop with Challengers and Reviewers.
   - Victory audit verification before claiming victory to Sentinel.
