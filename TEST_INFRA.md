# E2E Test Infra: Voxwright Mobile Editor

## Test Philosophy

- Opaque-box, requirement-driven, touch-first testing.
- No internal module dependencies in end-to-end tests; drives user-facing DOM touch events and CDP input dispatch.
- Preserves desktop mouse/keyboard testing intact while establishing automated mobile test coverage.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial + Real-World Workload Testing.

## Test Architecture

- **Unit & Logic Layer**: Vitest (`pnpm test`), executing pure modules (`apps/web/src/lib/gestures.ts`, pure core functions, coordinate math).
- **Mobile Touch E2E Runner**: Headless Chromium via `puppeteer-core` in `apps/web/test/touch-e2e.ts`.
  - Mobile Viewport: 390 x 844 px, DPR: 3.0, `hasTouch: true`, `isMobile: true`.
  - Touch Event Dispatching: Native CDP `Input.dispatchTouchEvent` and Puppeteer touch APIs.
- **Desktop E2E Runner**: Headless Chromium via `puppeteer-core` in `apps/web/test/e2e.ts` (338 baseline assertions).
- **Accessibility & Contrast**: Automated axe-core checks in page tests + `apps/web/test/contrast.test.ts`.

## Feature Inventory Coverage Map

| Feature Area            | Features                       | Target Tier 1 | Target Tier 2 | Target Tier 3 | Target Tier 4 |
| ----------------------- | ------------------------------ | :-----------: | :-----------: | :-----------: | :-----------: |
| MB1: Harness & Overlay  | `FEAT-MB1-01` .. `FEAT-MB1-04` |       5       |       5       |       ✓       |       ✓       |
| MB2: Input & Gestures   | `FEAT-MB2-01` .. `FEAT-MB2-05` |       5       |       5       |       ✓       |       ✓       |
| MB3: Layout Shell       | `FEAT-MB3-01` .. `FEAT-MB3-08` |       5       |       5       |       ✓       |       ✓       |
| MB4: Touch Placement    | `FEAT-MB4-01` .. `FEAT-MB4-09` |       5       |       5       |       ✓       |       ✓       |
| MB5: Armed Cell & Nudge | `FEAT-MB5-01` .. `FEAT-MB5-07` |       5       |       5       |       ✓       |       ✓       |
| MB6: Selection & State  | `FEAT-MB6-01` .. `FEAT-MB6-08` |       5       |       5       |       ✓       |       ✓       |
| MB7: Performance Pass   | `FEAT-MB7-01` .. `FEAT-MB7-05` |       5       |       5       |       ✓       |       ✓       |
| MB8: Polish & A11y      | `FEAT-MB8-01` .. `FEAT-MB8-08` |       5       |       5       |       ✓       |       ✓       |

## Real-World Application Scenarios (Tier 4)

| #   | Scenario                                | Features Exercised                                                                        | Complexity |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------- | ---------- |
| 1   | Rafeals_house Mobile Inspection & Edit  | View, Orbit, Inspect block, Eyedropper pick, Place block with reticle, Undo               | High       |
| 2   | Small Cottage Two-Point Construction    | Line tool foundation, Rectangle walls, Nudge pad corner adjustments, Confirm              | High       |
| 3   | Furniture Transformation & Duplicate    | 3D Box Selection, Copy, Paste ghost with 3D nudge, Rotate 90°, Mirror                     | High       |
| 4   | Door & Stairs Block-State Customization | Inspect stairs facing, change via segmented chips, toggle door open/close                 | Medium     |
| 5   | Mobile High-DPR Stress & Gesture Churn  | Continuous brush stroke, rapid 2-finger pan/pinch, second-finger cancel, HUD verification | High       |

## Coverage Thresholds

- Tier 1: >=5 test cases per feature area (happy-path functional isolation)
- Tier 2: >=5 test cases per feature area (boundaries, empty states, screen edges, multi-touch races)
- Tier 3: Pairwise combinations of touch gestures, tools, and bottom sheet states
- Tier 4: >=5 realistic full-lifecycle application scenarios
