# Execution Plan — Orchestrator Generation 3

## Overview

Orchestrator Generation 3 executes milestones MB3 through MB8 of `docs/mobile-editor-plan.md` and coordinates the final E2E test hardening.
Every milestone strictly follows the 5-agent gate protocol (Worker -> Reviewers x2 -> Challengers x2 -> Forensic Auditor).

## Milestone Roadmap

### 1. Milestone MB2: Conclusion [DONE]

- Concluded MB2 gate as PASS based on `teamwork_worker_mb2_3` handoff verification (114/114 stress checks, 52/52 Vitest files, 0 typecheck errors, 338/338 e2e checks).

### 2. Milestone MB3: Mobile Layout Shell [IN-PROGRESS]

- **Scope**:
  - Remove coarse pointer lockout gate (`canEdit = fine.matches || !coarse.matches`) from `apps/web/src/routes/+page.svelte` while retaining WebGL2 gate.
  - Full-viewport canvas styling: `100dvh`, `safe-area-inset-*`, `touch-action: none`, `overscroll-behavior: none`, `viewport-fit=cover`.
  - Top app bar & collapsible menu sheet (File/Open, Pack, View, Export).
  - Bottom toolbar (thumb zone, >=48px touch targets for tools + active block swatch).
  - Thumb cluster (Undo, Redo, Confirm, Cancel) with right default and left toggle.
  - Draggable bottom sheets with snap points (peek, half, full), drag handle, and `visualViewport` keyboard handling.
  - Mobile panel sheet hosting (Palette, Block State, Selection, View) without code duplication.
  - Breakpoint & layout switcher: Desktop 3-column vs mobile shell (1000px + pointer type) with manual override.
  - Update `m4-suite.ts` coarse assertions to reflect mobile editor availability.
- **Verification**:
  - No horizontal/page scroll at 390x844.
  - Every touch control >=44px (WCAG 2.5.5) / 48px primary.
  - Desktop 1280x800 layout pixel-identical / 0 regression in existing suites.
  - Typecheck, linter, vitest, and E2E suites passing.

### 3. Milestone MB4: Touch Placement with Offset Cursor

- **Scope**:
  - `EditSession` touch event processing routing through offset cursor.
  - Offset cursor reticle (~64px above finger contact point `clientY - 64`).
  - DOM/canvas visual reticle indicator.
  - Single-tap place/replace/erase.
  - Continuous brush painting as single undo step.
  - Drag-off and toolbar aborts via `Stroke.cancel()`.
  - Long-press eyedropper block pick (~450ms, <8px move).
  - Live cell readout bar above bottom toolbar.
  - Zero regression on desktop mouse/keyboard workflows.

### 4. Milestone MB5: Armed Cell, Nudge Pad & Two-Point Tools

- **Scope**:
  - Armed cell state & confirm mode (`confirm()`, `cancel()`).
  - `NudgePad` d-pad steppers (±X, ±Y, ±Z).
  - Two-point Line tool and Rectangle tool.
  - Two-point Box Selection with face steppers.
  - Paste ghost with nudge pad.

### 5. Milestone MB6: Selection Actions & Block State by Touch

- **Scope**:
  - Selection sheet actions (Fill, Replace A->B, Copy, Paste, Rotate, Mirror, Move).
  - Touch block-state inspector (toggles for booleans, segmented chips for enums, rotate shortcut).
  - Recent blocks hotbar (last 8) + favourites with `localStorage` persistence.

### 6. Milestone MB7: Phone Performance Pass

- **Scope**:
  - Dynamic resolution scaling (canvas pixel ratio drops to 1.0-1.5 during gestures).
  - Quality presets (Auto/High/Low).
  - Demand-driven frame throttling.
  - Mobile memory budget clamp (history cap) & worker pool clamp.

### 7. Milestone MB8: Polish, Accessibility & Docs

- **Scope**:
  - Commit toasts with 4s Undo action.
  - Tactile haptic feedback (`navigator.vibrate`).
  - Left-handed layout toggle.
  - Multi-finger tap shortcuts setting.
  - Touch onboarding walkthrough & help content.
  - WCAG 2.5.5 accessibility & extended contrast tests (`contrast.test.ts`).
  - Documentation and Termux dev-server guide.

### 8. Final E2E Test Suite Pass (Tiers 1-4) & Adversarial Hardening (Tier 5)

- Opaque-box requirement-driven verification across all features.
- Adversarial white-box coverage hardening.
- Completion report to Sentinel for independent Victory Auditor invocation.
