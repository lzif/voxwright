## 2026-11-08T00:48:32Z

You are teamwork_preview_spec_miner_mb3_1, a specification investigator.
Your Working Directory: /home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_spec_miner_mb3_1/
Your Parent: Orchestrator Generation 3 (conversation ID: 1bcb5174782f6d0b5a7a72c91040a991)

MANDATORY FIRST STEP: Read /home/antigravity/lzif/voxwright/.agents/teamwork/ORIGINAL_REQUEST.md before doing anything else.
Also read:
- /home/antigravity/lzif/voxwright/docs/mobile-editor-plan.md (especially §1.2, §2.1, §4.3 MB3, §5 Decisions 7 & 8)
- /home/antigravity/lzif/voxwright/PROJECT.md (Milestone MB3, Feature Inventory FEAT-MB3-01 through FEAT-MB3-08, Interface Contracts, Code Layout)

Your Task:
Mine and document the exhaustive, unambiguous specifications for Milestone MB3 (Mobile Layout Shell):
1. Exactly what constitutes the coarse pointer gate removal (what gets removed, what remains, e.g. WebGL2 gate).
2. Full-viewport canvas and hygiene rules: 100dvh, safe-area-inset-*, touch-action, overscroll-behavior, viewport-fit=cover, interactive-widget=resizes-content, user-select, etc.
3. Top app bar and collapsible menu sheet requirements (File/Open, Pack, View, Export; broadened file picker MIME accept).
4. Ergonomic bottom toolbar requirements (thumb zone, >=48px touch targets, tool list, active block swatch opening palette).
5. Ergonomic thumb cluster requirements (Undo, Redo, Confirm, Cancel; right-hand default with left-hand toggle support).
6. Draggable bottom sheet component specification (snap points: peek, half, full; drag handle; visualViewport keyboard resizing; sheet hosting for Palette, Block State, Selection, View without duplication).
7. Breakpoint & layout switcher: 3-column desktop layout vs mobile shell at breakpoint (1000px + pointer: fine) with manual menu override.
8. Exit criteria and test requirements: exactly what tests, assertions, and bounds must be verified for MB3 exit (e.g. 390x844 no scroll, >=44px WCAG 2.5.5 touch targets, desktop pixel parity).
9. Updates needed to m4-suite.ts (updating coarse viewer assertion).

Write your detailed findings to /home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_spec_miner_mb3_1/handoff.md.
When done, send a message to your parent (1bcb5174782f6d0b5a7a72c91040a991) with a brief summary and the report path.
