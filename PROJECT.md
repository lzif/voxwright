# Project: Voxwright Mobile Editor (MB1–MB8)

## Architecture

Voxwright is a Minecraft schematic viewer and in-browser editor built on Svelte 5 and Three.js/WebGL2.
The mobile editor introduces full touch-first editing capabilities on mobile devices (specifically Chrome on Android, WebGL2) without altering or degrading desktop mouse-and-keyboard workflows.

### Architectural Tiers & Boundaries

1. **`packages/core` (Zero-DOM Logic)**
   - Pure data structures and algorithms (`Volume`, `Stroke`, `History`, `raycast`, command builders).
   - Completely input-independent. Untouched during early milestones; only clean helper reuses.
2. **`packages/render` (Three.js WebGL2 Rendering)**
   - Manages WebGL canvas, shaders, section meshing, and camera controllers (`OrbitController`, `FlyController`).
   - Additive decoupling: `input: "builtin" | "external"` option in `WebglRendererOptions`.
   - Public camera API: `orbitBy(dx, dy)`, `panBy(dx, dy)`, `zoomBy(factor)`, `focusOn(target, dist)`.
   - Additive rendering features: dynamic resolution scaling (`renderer.setPixelRatio`) and highlight extensions.
3. **`apps/web` (UI, Input Handling & Session State)**
   - Pure gesture arbiter: `apps/web/src/lib/gestures.ts` translates pointer streams into high-level gestures.
   - `EditSession`: Touch input pipeline, offset cursor reticle, armed cell lifecycle (`confirm()` / `cancel()`), and coordination with `gestures.ts`.
   - Mobile Layout Shell: Full-viewport canvas (`100dvh`), `touch-action: none`, top app bar with collapsible menu, single-row bottom toolbar (thumb zone, >=48px targets), thumb cluster (Undo/Redo/Confirm/Cancel), and draggable bottom sheets (snap points: peek, half, full).
   - Telemetry & HUD: `?perf=1` overlay displaying FPS, triangles, heap memory, DPR, and frame latency.

---

## Feature Inventory

| #   | Feature ID      | Feature Name                      | Description                                                                                           | Milestone | Source                   |
| --- | --------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------- | --------- | ------------------------ |
| 1   | `FEAT-MB1-01`   | Mobile Touch E2E Test Suite       | Headless Chromium CDP touch emulation project (`390 x 844`, DPR 3, `hasTouch`) in `apps/web/test/`    | MB1       | survey / plan §4.1       |
| 2   | `FEAT-MB1-02`   | Performance Debug Overlay         | Live telemetry HUD activated via `?perf=1` displaying FPS, triangles, JS heap, DPR, and frame time    | MB1       | survey / plan §4.1       |
| 3   | `FEAT-MB1-03`   | Real-Phone Test Checklist         | Markdown guide in `docs/phone-test-checklist.md` for Termux dev-server verification                   | MB1       | survey / plan §4.1       |
| 4   | `FEAT-MB1-04`   | Baseline Phone Performance Log    | Benchmark documentation for Rafeals_house fixture on real hardware                                    | MB1       | survey / plan §4.1       |
| 5   | `FEAT-MB2-01`   | WebGL Renderer Input Mode         | Additive `input: "builtin" \| "external"` option; skips internal canvas listeners in external mode    | MB2       | survey / plan §3, §4.2   |
| 6   | `FEAT-MB2-02`   | Public WebGL Camera API           | Public methods: `orbitBy(dx, dy)`, `panBy(dx, dy)`, `zoomBy(factor)`, `focusOn(target, dist)`         | MB2       | survey / plan §3, §4.2   |
| 7   | `FEAT-MB2-03`   | Pure Gesture Arbiter              | Pure state machine in `apps/web/src/lib/gestures.ts` with comprehensive Vitest synthetic suites       | MB2       | survey / plan §3, §4.2   |
| 8   | `FEAT-MB2-04`   | Second-Finger Stroke Abort        | Mid-stroke arrival of 2nd pointer aborts active brush stroke (`Stroke.cancel()`) and shifts to camera | MB2       | survey / plan §2.2, §4.2 |
| 9   | `FEAT-MB2-05`   | Touch Camera Navigation           | 1-finger drag orbits, 2-finger drag pans, 2-finger pinch zooms without drift or jumps                 | MB2       | survey / plan §2.2, §4.2 |
| 10  | `FEAT-MB3-01`   | Coarse Pointer Gate Removal       | Remove `canEdit = fine.matches \|\| !coarse.matches` and lockout message; retain WebGL2 gate          | MB3       | survey / plan §1.2, §4.3 |
| 11  | `FEAT-MB3-02`   | Full-Viewport Canvas & Hygiene    | `100dvh`, safe-area insets, `touch-action: none`, `overscroll-behavior: none`, `viewport-fit=cover`   | MB3       | survey / plan §2.1, §4.3 |
| 12  | `FEAT-MB3-03`   | Breakpoint & Layout Switcher      | Desktop 3-column vs mobile shell based on width (1000px) + pointer type, with manual override         | MB3       | survey / plan §2.1, §4.3 |
| 13  | `FEAT-MB3-04`   | Top App Bar & Collapsible Menu    | Top bar with menu sheet (File/Open, Pack, View, Export); broadened file input MIME accept             | MB3       | survey / plan §2.1, §4.3 |
| 14  | `FEAT-MB3-05`   | Ergonomic Bottom Toolbar          | Single-row thumb-zone toolbar with >=48px touch targets for tools + active block swatch               | MB3       | survey / plan §2.1, §4.3 |
| 15  | `FEAT-MB3-06`   | Ergonomic Thumb Cluster           | Corner action buttons: Undo, Redo, Confirm (✓), Cancel (✕); right default with left toggle            | MB3       | survey / plan §2.1, §4.3 |
| 16  | `FEAT-MB3-07`   | Draggable Bottom Sheet            | Bottom sheet with peek/half/full snap points, drag handle, and `visualViewport` keyboard handling     | MB3       | survey / plan §2.1, §4.3 |
| 17  | `FEAT-MB3-08`   | Mobile Panel Sheet Hosting        | Hosting Palette, Block State, Selection, and View inside bottom sheets without code duplication       | MB3       | survey / plan §2.1, §4.3 |
| 18  | `FEAT-MB4-01`   | Touch Event Processing            | Ingesting touch pointers in `EditSession` routing through offset cursor and stroke transactions       | MB4       | survey / plan §3, §4.4   |
| 19  | `FEAT-MB4-02`   | Offset Cursor (Reticle) Raycast   | Shifting raycast ~64px above finger contact point (`clientY - 64`) so finger does not occlude target  | MB4       | survey / plan §2.3, §4.4 |
| 20  | `FEAT-MB4-03`   | Visual Reticle Indicator          | DOM/canvas visual reticle indicator showing targeted cell and connection line above finger            | MB4       | survey / plan §2.3, §4.4 |
| 21  | `FEAT-MB4-04`   | Single-Tap Block Placement        | Short tap (<8px movement, <450ms) places, replaces, or erases block at reticle cell                   | MB4       | survey / plan §2.2, §4.4 |
| 22  | `FEAT-MB4-05`   | Continuous Brush Painting         | Dragging one finger paints along starting plane; committed as exactly one undo step via `Stroke`      | MB4       | survey / plan §2.2, §4.4 |
| 23  | `FEAT-MB4-06`   | Drag-Off & Toolbar Cancel         | Dragging reticle off canvas bounds or into bottom toolbar aborts stroke cleanly via `Stroke.cancel()` | MB4       | survey / plan §2.3, §4.4 |
| 24  | `FEAT-MB4-07`   | Eyedropper Long-Press Pick        | Holding touch for ~450ms with <8px movement picks block under reticle without tool change             | MB4       | survey / plan §2.2, §4.4 |
| 25  | `FEAT-MB4-08`   | Live Cell Readout Bar             | Accessible text readout bar above bottom toolbar showing active coordinates and block name            | MB4       | survey / plan §2.3, §4.4 |
| 26  | `FEAT-MB4-09`   | Desktop Mouse/Key Parity          | Zero regression on desktop mouse-and-keyboard editing workflows and existing test suites              | MB4       | survey / plan §1.3, §4.4 |
| 27  | `FEAT-MB5-01`   | Armed Cell State & Lifecycle      | Explicit modal state where cell coordinate is held as `armed` before confirming or cancelling         | MB5       | survey / plan §2.3, §4.5 |
| 28  | `FEAT-MB5-02`   | Nudge Pad (D-Pad Steppers)        | Screen-relative & coordinate d-pad steppers (±X, ±Y, ±Z) for single-cell coordinate adjustment        | MB5       | survey / plan §2.3, §4.5 |
| 29  | `FEAT-MB5-03`   | Two-Point Line Tool               | Two-corner modal Line tool with corner nudging and atomic single-step undo commit                     | MB5       | survey / plan §2.3, §4.5 |
| 30  | `FEAT-MB5-04`   | Two-Point Rectangle Tool          | Two-corner modal Rectangle tool maintaining face normal constraint and corner nudging                 | MB5       | survey / plan §2.3, §4.5 |
| 31  | `FEAT-MB5-05`   | Two-Point Box Selection           | Modal selection: tap corner A, tap corner B, corner switching, and 3D bounding box highlight          | MB5       | survey / plan §2.4, §4.5 |
| 32  | `FEAT-MB5-06`   | Selection Face Steppers           | Steppers (±1, ±8) or 6 directional face handles for adjusting selection box dimensions                | MB5       | survey / plan §2.4, §4.5 |
| 33  | `FEAT-MB5-07`   | Paste Ghost with Nudge Pad        | Renders ghost bounding box at armed target cell; 3D nudging before Confirm (✓) commit                 | MB5       | survey / plan §2.4, §4.5 |
| 34  | `FEAT-MB6-01`   | Selection Sheet Actions           | Touch triggers for Fill, Replace A→B, Copy, Paste, Rotate CW/CCW, Mirror X/Z, Move                    | MB6       | survey / plan §2.4, §4.6 |
| 35  | `FEAT-MB6-02`   | Selection Clear & Select All      | Accessible buttons for Select All and Clear Selection, plus tapping empty canvas in View              | MB6       | survey / plan §2.4, §4.6 |
| 36  | `FEAT-MB6-03`   | Touch Block-State Inspector       | Displays properties of inspected block (following tapped/armed cell) inside bottom sheet              | MB6       | survey / plan §2.5, §4.6 |
| 37  | `FEAT-MB6-04`   | Boolean Property Toggle Switches  | Touch switches for boolean properties (`waterlogged`, `open`, `lit`, `powered`)                       | MB6       | survey / plan §2.5, §4.6 |
| 38  | `FEAT-MB6-05`   | Segmented Chips for Properties    | Segmented chip buttons for enumerated values (`facing`, `half`, `shape`, `axis`)                      | MB6       | survey / plan §2.5, §4.6 |
| 39  | `FEAT-MB6-06`   | Quick "Rotate Block" Action       | Shortcut button in block-state sheet cycling directional properties (`facing`, `axis`)                | MB6       | survey / plan §2.5, §4.6 |
| 40  | `FEAT-MB6-07`   | Recent Blocks Hotbar              | Horizontally scrolling quick-access bar with last 8 used blocks + favourites above palette            | MB6       | survey / plan §2.5, §4.6 |
| 41  | `FEAT-MB6-08`   | Recents & Favourites Persistence  | Browser `localStorage` caching of recent blocks and pinned favourites with safe fallback              | MB6       | survey / plan §2.5, §4.6 |
| 42  | `FEAT-MB7-01`   | Dynamic Resolution Scaling        | Canvas pixel ratio scales down to 1.0–1.5 during camera gestures and restores on idle                 | MB7       | survey / plan §3, §4.7   |
| 43  | `FEAT-MB7-02`   | Quality Presets (Auto/High/Low)   | User preset controlling antialiasing, base pixel ratio, and dynamic scaling thresholds                | MB7       | survey / plan §3, §4.7   |
| 44  | `FEAT-MB7-03`   | Demand-Driven Frame Throttling    | Strictly on-demand `requestFrame` rendering during mobile brush strokes; re-mesh dirty only           | MB7       | survey / plan §3, §4.7   |
| 45  | `FEAT-MB7-04`   | Mobile Memory Budget Clamp        | Clamping History memory cap (`maxBytes`) to 16/32 MiB on coarse-pointer devices                       | MB7       | survey / plan §3, §4.7   |
| 46  | `FEAT-MB7-05`   | Mobile Worker Pool Adaptation     | Worker pool clamp to 2 workers for mobile big.LITTLE architectures                                    | MB7       | survey / plan §3, §4.7   |
| 47  | `FEAT-MB8-01`   | Ephemeral Commit Toasts           | Floating toast ("Placed 12 blocks · Undo") with inline 4-second Undo action button                    | MB8       | survey / plan §2.6, §4.8 |
| 48  | `FEAT-MB8-02`   | Tactile Haptic Vibration          | Vibration pulses on commit (15ms), cancel (20ms-50ms-20ms), and pick via `navigator.vibrate`          | MB8       | survey / plan §2.3, §4.8 |
| 49  | `FEAT-MB8-03`   | Left-Handed Layout Toggle         | UI option mirroring thumb cluster and toolbar orientation for left-handed ergonomics                  | MB8       | survey / plan §2.1, §4.8 |
| 50  | `FEAT-MB8-04`   | Multi-Finger Tap Shortcuts        | Optional gesture shortcuts (2-finger tap undo, 3-finger tap redo), disabled by default                | MB8       | survey / plan §2.2, §4.8 |
| 51  | `FEAT-MB8-05`   | Touch Tutorial & Help Content     | Rewritten onboarding help and guide explaining touch gestures and precision placement                 | MB8       | survey / plan §4.8       |
| 52  | `FEAT-MB8-06`   | Mobile Accessibility Pass         | WCAG 2.5.5 targets (>=44px), polite ARIA live status announcements, focus management                  | MB8       | survey / plan §3, §4.8   |
| 53  | `FEAT-MB8-07`   | Extended Automated Contrast Suite | Extending `apps/web/test/contrast.test.ts` to cover all new mobile components and themes              | MB8       | survey / plan §3, §4.8   |
| 54  | `FEAT-MB8-08`   | Documentation & Self-Hosting      | Updating README, mobile editor architecture notes, and Termux dev-server instructions                 | MB8       | survey / plan §4.8       |
| 55  | `FEAT-FINAL-01` | 100% E2E Suite Pass & Hardening   | Full execution of Tiers 1-4 opaque-box tests + Tier 5 adversarial coverage hardening                  | Final     | dual-track plan          |

---

## Milestones

| #     | Name                                           | Scope                                                                                                                                                                                                                            | Dependencies | Status                |
| ----- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------- |
| MB1   | Phone baseline and test harness                | Mobile touch E2E test harness (`apps/web/test/touch-e2e.ts`), `?perf=1` telemetry overlay HUD, Termux checklist `docs/phone-test-checklist.md`                                                                                   | None         | DONE                  |
| MB2   | Input ownership and gesture arbiter            | WebGL renderer `input: "builtin" \| "external"`, public camera methods, `apps/web/src/lib/gestures.ts` state machine + Vitest tests, touch camera navigation                                                                     | MB1          | DONE                  |
| MB3   | Mobile layout shell                            | Remove coarse gate, full-viewport canvas (`100dvh`), top bar, bottom toolbar, thumb cluster, draggable bottom sheets with snap points & `visualViewport`, desktop breakpoint, update m4-suite coarse assertion                   | MB2          | DONE                  |
| MB4   | Touch placement with offset cursor             | Touch event handling in `EditSession`, ~64px offset cursor reticle, single-tap place/replace/erase, continuous brush stroke, drag-off/toolbar cancellation, second-finger cancel, long-press pick, cell readout bar              | MB3          | PLANNED               |
| MB5   | Armed cell, nudge pad & two-point tools        | Confirm mode, modal armed cell state, `NudgePad` d-pad steppers (±X, ±Y, ±Z), two-point Line tool, two-point Rectangle tool, two-point Box Selection, selection face steppers, paste ghost with nudge pad                        | MB4          | PLANNED               |
| MB6   | Selection actions & block state by touch       | Selection bottom sheet (Fill, Replace, Copy, Paste, Rotate, Mirror, Move), block-state sheet (boolean switches, segmented chips, rotate block button), recent blocks hotbar + `localStorage` persistence, inspected follows taps | MB5          | PLANNED               |
| MB7   | Phone performance pass                         | Dynamic resolution scaling during camera gestures, Auto/High/Low quality presets, demand-driven frame rendering, coarse-device history cap clamp, mobile worker pool clamp                                                       | MB6          | PLANNED               |
| MB8   | Polish, accessibility and docs                 | Toasts with 4s Undo, haptic feedback (`navigator.vibrate`), left-handed toggle, optional multi-finger tap shortcuts, touch help/walkthrough, WCAG 2.5.5 touch target size pass, extended contrast suite, documentation           | MB7          | PLANNED               |
| FINAL | E2E test pass & adversarial coverage hardening | Pass 100% of E2E test suite (Tiers 1-4) across mobile & desktop, followed by Tier 5 adversarial coverage hardening loop                                                                                                          | MB1–MB8      | PLANNED               |

---

## Interface Contracts

### 1. `packages/render` ↔ `apps/web`

- **`WebglRendererOptions`**:

  ```typescript
  export interface WebglRendererOptions {
    canvas: HTMLCanvasElement;
    input?: "builtin" | "external"; // default: "builtin"
    devicePixelRatio?: number;
    workerCount?: number;
    // ...existing options preserved
  }
  ```
- **Public Camera Operations on `WebglRenderer`**:

  ```typescript
  export interface WebglRenderer {
    // ...existing methods preserved
    orbitBy(dxPx: number, dyPx: number): void;
    panBy(dxPx: number, dyPx: number): void;
    zoomBy(factor: number): void;
    focusOn(target: Vec3, distance?: number): void;
    setPixelRatio(dpr: number): void;
  }
  ```

### 2. `apps/web/src/lib/gestures.ts` ↔ Consumers

- **Gesture Intents**:

  ```typescript
  export type GestureIntent =
    | { type: "tap"; clientX: number; clientY: number }
    | { type: "longPress"; clientX: number; clientY: number }
    | { type: "oneFingerDragStart"; clientX: number; clientY: number }
    | { type: "oneFingerDragMove"; clientX: number; clientY: number; dx: number; dy: number }
    | { type: "oneFingerDragEnd"; clientX: number; clientY: number }
    | { type: "twoFingerPan"; dx: number; dy: number }
    | { type: "pinch"; factor: number; center: { x: number; y: number } }
    | { type: "multiFingerTap"; fingers: 2 | 3 }
    | { type: "cancel" };
  ```

### 3. `EditSession` ↔ Mobile UI Components

- **Armed Cell & Precision State**:

  ```typescript
  export class EditSession {
    // ...existing properties preserved
    armed: Vec3 | null;
    confirmMode: boolean;
    nudge(axis: 0 | 1 | 2, step: -1 | 1 | -8 | 8): void;
    confirm(): void;
    cancel(): void;
    pickBlockAt(pos: Vec3): void;
    cycleInspectedFacing(): void;
  }
  ```

### 4. `packages/core` ↔ `apps/web`

- Pure data models and commands are strictly preserved.
- `Stroke.begin()`, `Stroke.apply(command)`, `Stroke.commit()`, `Stroke.cancel()` govern all transactional edits.

---

## Code Layout

- `apps/web/src/lib/gestures.ts`: Pure gesture arbiter state machine (Unit tests in `apps/web/src/lib/gestures.test.ts`).
- `apps/web/src/lib/editor-session.svelte.ts`: Core touch input handling, offset reticle, armed cell lifecycle.
- `apps/web/src/routes/+page.svelte`: Stage layout, breakpoint handling, app bars, sheet hosting.
- `apps/web/src/lib/components/`:
  - `BottomToolbar.svelte`: Mobile tool bar & block swatch.
  - `ThumbCluster.svelte`: Floating undo/redo/confirm/cancel buttons.
  - `BottomSheet.svelte`: Draggable sheet component with snap points.
  - `NudgePad.svelte`: Coordinate steppers d-pad.
  - `Hotbar.svelte`: Recent blocks & favourites bar.
  - `PerfOverlay.svelte`: `?perf=1` telemetry HUD.
  - `Toast.svelte`: Commit toasts with Undo action.
- `packages/render/src/webgl/renderer.ts`: Additive `input: "builtin" | "external"`, public camera methods, dynamic resolution.
- `apps/web/test/`:
  - `touch-e2e.ts`: Mobile touch-emulated test suite runner.
  - `m4-suite.ts`: Updated to reflect mobile editor availability.
  - `contrast.test.ts`: Extended contrast tests for mobile UI elements.
- `docs/phone-test-checklist.md`: Termux mobile testing guide.
