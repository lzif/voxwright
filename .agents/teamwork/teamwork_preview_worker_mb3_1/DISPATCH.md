## 2026-11-08T00:58:36Z

You are teamwork_preview_worker_mb3_1, an implementation specialist.
Your Working Directory: /home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_worker_mb3_1/
Your Parent: Orchestrator Generation 3 (conversation ID: 1bcb5174782f6d0b5a7a72c91040a991)

MANDATORY FIRST STEP: Read /home/antigravity/lzif/voxwright/.agents/teamwork/ORIGINAL_REQUEST.md before doing anything else.
Also read the authoritative exploration and specification handoff reports:
- /home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_spec_miner_mb3_1/handoff.md
- /home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_explorer_mb3_1/handoff.md
- /home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_explorer_mb3_2/handoff.md
- /home/antigravity/lzif/voxwright/docs/mobile-editor-plan.md (§1.2, §2.1, §4.3 MB3, §5 Decisions 7 & 8)
- /home/antigravity/lzif/voxwright/PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope of Milestone MB3 (Mobile Layout Shell):
Files you own exclusively:
- apps/web/src/app.html
- apps/web/src/routes/+page.svelte
- apps/web/src/lib/components/BottomSheet.svelte (create)
- apps/web/src/lib/components/BottomToolbar.svelte (create)
- apps/web/src/lib/components/ThumbCluster.svelte (create)
- apps/web/test/m4-suite.ts
- apps/web/test/touch-e2e.ts

Implementation Requirements:
1. In `apps/web/src/app.html`:
   - Update viewport meta: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />`.

2. Create `apps/web/src/lib/components/BottomSheet.svelte`:
   - Draggable bottom sheet with 4 snap states: "closed", "peek" (~160px), "half" (~50vh), "full" (~88vh).
   - Drag handle with touch pointer capture (`setPointerCapture`, pointermove tracking, velocity fling calculation to snap to nearest point).
   - Backdrop overlay that closes sheet on tap when at half or full snap.
   - Keyboard resize handling listening to `window.visualViewport` resize so keyboard does not obscure content.
   - Hosts existing panels (`BlockPalette`, `BlockStatePanel`, `SelectionPanel`, View/Render options, and Menu) passed as children/snippets without duplicating code.

3. Create `apps/web/src/lib/components/BottomToolbar.svelte`:
   - Single-row horizontally scrollable thumb zone toolbar.
   - Touch targets >= 48px x 48px (meeting WCAG 2.5.5 >= 44px).
   - Buttons for tools: View, Place, Replace, Erase, Pick, Line, Rect, Select.
   - Active block swatch button with block color/name that toggles the Palette bottom sheet.

4. Create `apps/web/src/lib/components/ThumbCluster.svelte`:
   - Floating corner action cluster: Undo, Redo, Confirm (✓), Cancel (✕).
   - Touch targets >= 48px x 48px.
   - Positioned above the bottom toolbar (`bottom: calc(64px + env(safe-area-inset-bottom, 0px))`).
   - Default right corner (`right: calc(12px + env(safe-area-inset-right, 0px))`), with left-handed toggle support (`left: calc(12px + env(safe-area-inset-left, 0px))`).

5. In `apps/web/src/routes/+page.svelte`:
   - Remove coarse pointer lockout: replace `canEdit = fine.matches || !coarse.matches` with `canEdit = kind === "webgl"`.
   - Remove lockout message `<p class="hint" data-testid="edit-note">Editing needs a mouse and keyboard; on this device the page is a viewer.</p>`.
   - Retain WebGL2 requirement message: `<p class="hint" data-testid="edit-note">Editing needs WebGL2; the software renderer is a viewer.</p>` for CPU software renderer.
   - Retain single persistent `<canvas>` instance across layout modes so WebGL context and chunk meshes are not destroyed.
   - Layout switching: automatic detection via `window.matchMedia("(min-width: 1000px) and (pointer: fine)")` with manual override ("auto" | "desktop" | "mobile") stored in `localStorage["voxwright.layout"]`.
   - When desktop mode: render existing 3-column layout pixel-identically.
   - When mobile mode: render top app bar (title, status, menu button), full-viewport canvas (`100dvh`, safe-area insets, `touch-action: none`), `ThumbCluster.svelte`, `BottomToolbar.svelte`, and `BottomSheet.svelte`.
   - Top bar menu sheet should include: File/Open, Pack, View options, Export, Layout mode toggle (Auto/Desktop/Mobile), and Left-Handed toggle.
   - Broaden file input `accept`: `.nbt,.schem,.schematic,.litematic,application/octet-stream,*/*`.

6. In `apps/web/test/m4-suite.ts`:
   - Update coarse device assertion (lines 1098–1099) so that coarse WebGL2 devices expect the toolbar to be present (`ok(m.toolbar, ...)` and lockout message is null).

7. In `apps/web/test/touch-e2e.ts`:
   - Update line 275 (`ok(layout.toolbar, ...)`).
   - Add automated checks verifying MB3 exit criteria:
     - 390x844 no horizontal scroll and no document scroll (`overflow <= 1`).
     - All touch targets (tools, swatch, thumb cluster, menu button) >= 44px (WCAG 2.5.5) / 48px.
     - Palette sheet opens when tapping block swatch, search input works with visualViewport keyboard resize.
     - Desktop 1280x800 layout maintains 3-column layout and zero regressions.

8. Run all verifications:
   - `pnpm --filter @voxwright/render typecheck && pnpm --filter @voxwright/web typecheck`
   - `pnpm typecheck`
   - `pnpm biome check` on modified/created files
   - `pnpm test`
   - `node apps/web/test/touch-e2e.ts`
   - `node apps/web/test/m4-suite.ts`
   - `node apps/web/test/e2e.ts`

Write your complete handoff report to:
/home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_worker_mb3_1/handoff.md
When finished, notify your parent (1bcb5174782f6d0b5a7a72c91040a991) via send_message.
