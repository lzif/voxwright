<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { TOOLS, touchToolTitle } from "../editing.ts";
import type { EditSession } from "../editor-session.svelte.ts";

export type SheetType = "none" | "palette" | "blockstate" | "selection" | "menu";

let {
  session,
  activeSheet = "none",
  ontogglesheet,
}: {
  session: EditSession;
  activeSheet?: SheetType;
  ontogglesheet?: (sheet: SheetType) => void;
} = $props();

const shown = TOOLS.filter((t) => t.id !== "paste");
const cleanBlockName = $derived(session.block.replace("minecraft:", ""));
// The chip that opens the block state sheet: there is a block that was tapped (or armed, or
// inspected) and nothing waits for a confirm. A finger previewing a cell moves `inspected` with
// it, so the chip needs no gap while a finger is down (the readout line would jump on every touch).
const showChip = $derived(session.pending === null && session.inspectedBlock !== null);
const chipLabel = $derived(
  showChip && session.inspected !== null
    ? `Edit state of ${(session.inspectedBlock ?? "").split(/[[{]/, 1)[0]?.replace("minecraft:", "")} at ${session.inspected.join(", ")}`
    : "Edit state",
);

function blockColor(name: string): string {
  if (name.includes("stone")) return "#858585";
  if (name.includes("plank") || name.includes("wood") || name.includes("log")) return "#9c6e3b";
  if (name.includes("dirt") || name.includes("ground")) return "#866043";
  if (name.includes("grass")) return "#4a8528";
  if (name.includes("brick")) return "#964332";
  if (name.includes("sand")) return "#d6cb96";
  if (name.includes("glass")) return "#8ec0c7";
  if (name.includes("iron")) return "#d8d8d8";
  if (name.includes("gold")) return "#f5cf38";
  if (name.includes("diamond")) return "#4dedd5";
  if (name.includes("wool") || name.includes("concrete")) return "#e0e0e0";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 45%)`;
}

const swatchColor = $derived(blockColor(cleanBlockName));
</script>

<div class="bottom-toolbar-container" data-testid="bottom-toolbar">
  <div class="readout-row" class:has-chip={showChip}>
  <!-- Live cell readout bar -->
  <div
    class="cell-readout-bar ore-type-caption"
    data-testid="live-cell-readout"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    aria-label="Target cell readout"
  >
    <div class="readout-cell" class:pending={session.pending !== null} data-testid="cell-readout">
      {#if session.pending}
        <!-- The armed cell and its block, or the corners and the size: it follows every nudge. A refusal
             takes the whole line while it shows, so that it reads in full. -->
        {#if !session.error}
          <span class="readout-coord" data-testid="pending-readout">{session.pendingReadout}</span>
        {/if}
      {:else}
        <span class="readout-coord" data-testid="hover">
          {#if session.hover}
            [{session.hover.position.join(", ")}]
          {:else if session.inspected}
            [{session.inspected.join(", ")}]
          {:else}
            [—, —, —]
          {/if}
        </span>
        <span class="readout-sep" aria-hidden="true">·</span>
        <span class="readout-block" data-testid="cell-block">
          {#if session.hover}
            {session.hover.block.replace("minecraft:", "")}
          {:else if session.inspectedBlock}
            {session.inspectedBlock.replace("minecraft:", "")}
          {:else}
            {session.block.replace("minecraft:", "")}
          {/if}
        </span>
      {/if}
    </div>
    {#if session.message}
      <span class="readout-msg" data-testid="edit-message">{session.message}</span>
    {:else if session.error}
      <span class="readout-error" class:wide={session.pending !== null} data-testid="edit-error">{session.error}</span>
    {/if}
  </div>
  {#if showChip}
    <!-- Outside the live region: a button does not belong in a status line. Zoom is the double tap's
         focus without the gesture: the camera comes closer to the inspected block and centres on it. -->
    <button
      type="button"
      class="state-chip ore-btn ore-btn--secondary ore-type-caption"
      aria-label="Zoom to this block"
      title="Zoom to this block: bring the camera closer, as a double tap does"
      onclick={() => session.focusInspected()}
      data-testid="zoom-chip"
    >Zoom</button>
    <button
      type="button"
      class="state-chip ore-btn ore-btn--secondary ore-type-caption"
      aria-label={chipLabel}
      onclick={() => ontogglesheet?.("blockstate")}
      data-testid="state-chip"
    >Edit state ›</button>
  {/if}
  </div>

  <div
    class="bottom-toolbar"
    role="toolbar"
    aria-label="Mobile editing toolbar"
    data-testid="toolbar"
  >
    <!-- Active block swatch: opens/toggles palette sheet -->
    <button
      type="button"
      class="swatch-btn ore-btn ore-btn--secondary ore-type-label"
      class:active={activeSheet === "palette"}
      onclick={() => ontogglesheet?.("palette")}
      data-testid="active-block-swatch"
      data-palette-toggle="true"
      aria-label={`Current block: ${cleanBlockName}. Tap to open palette.`}
    >
      <span
        class="swatch-indicator"
        data-testid="mobile-swatch"
        style="background-color: {swatchColor}"
      ></span>
      <span class="swatch-label" data-testid="mobile-palette-toggle">{cleanBlockName}</span>
    </button>

    <div class="sep" aria-hidden="true"></div>

    <!-- Tool buttons: View, Place, Replace, Erase, Pick, Line, Rect, Select -->
    <div class="tool-strip">
      {#each shown as t (t.id)}
        <button
          type="button"
          class="tool-btn ore-seg ore-type-label"
          class:active={session.tool === t.id}
          aria-pressed={session.tool === t.id}
          onclick={() => session.setTool(t.id)}
          title={touchToolTitle(t)}
          data-testid={`tool-${t.id}`}
          data-tool={t.id}
          aria-label={t.label}
        >
          <span class="tool-label">{t.label}</span>
        </button>
      {/each}
    </div>

    <div class="sep" aria-hidden="true"></div>

    <!-- Quick sheet toggles for State and Selection -->
    <button
      type="button"
      class="panel-btn ore-seg ore-type-label"
      class:active={activeSheet === "blockstate"}
      onclick={() => ontogglesheet?.("blockstate")}
      data-testid="mobile-state-toggle"
      aria-label="State: show or hide the block state sheet"
    >
      State
    </button>

    <button
      type="button"
      class="panel-btn ore-seg ore-type-label"
      class:active={activeSheet === "selection"}
      onclick={() => ontogglesheet?.("selection")}
      data-testid="mobile-selection-toggle"
      aria-label="Select: show or hide the selection sheet"
    >
      Select
    </button>
  </div>
</div>

<style>
  /* The bar is a surface-page strip with the toolbar's own outline on top; the readout line is a
     surface-panel tile above the buttons. Tool buttons are the design's toggle segments (.ore-seg),
     the swatch and the chips are secondary buttons (.ore-btn--secondary). */
  .bottom-toolbar-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 30;
    background: var(--surface-page);
    color: var(--ink);
    border-top: 2px solid var(--outline);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .bottom-toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: 56px;
    padding: 0 var(--space-3);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    touch-action: pan-x;
  }
  .bottom-toolbar::-webkit-scrollbar {
    display: none;
  }

  /* The segments touch (.ore-seg + .ore-seg overlaps their outlines by 2 px), as a toggle group does. */
  .tool-strip {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .tool-btn,
  .panel-btn {
    flex: 0 0 auto;
    min-width: 48px;
    min-height: 48px;
    padding-left: var(--space-3);
    padding-right: var(--space-3);
    white-space: nowrap;
    touch-action: manipulation;
  }

  /* The armed tool (aria-pressed) and an open sheet (.active) are the design's selected segment:
     green, the band closed, and the 2 px underline that says "selected" without colour. .ore-seg reads
     aria-checked, which these buttons do not carry (they keep aria-pressed), so the same variables
     are set here. The box stays 48 px tall: it is the touch target. */
  .bottom-toolbar .tool-strip .tool-btn.ore-seg[aria-pressed="true"],
  .bottom-toolbar .panel-btn.ore-seg.active {
    --bf: var(--green);
    --bh: var(--green-hi);
    --bl: var(--green-lo);
    --bt: var(--ink);
    min-height: 48px;
    padding-bottom: 0;
    box-shadow: inset 2px 2px 0 var(--bh), inset -2px -2px 0 var(--bl);
  }
  .tool-btn[aria-pressed="true"]::after,
  .panel-btn.active::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 44px;
    height: 2px;
    margin-left: -22px;
    background: var(--ink);
  }

  /* State and Select are a group of two: the gap of the toolbar is taken back so their outlines overlap. */
  .panel-btn + .panel-btn {
    margin-left: calc(-1 * var(--space-2) - 2px);
  }

  .sep {
    width: 2px;
    height: 32px;
    background: var(--panel-hi);
    flex-shrink: 0;
  }

  .swatch-btn {
    min-width: 48px;
    min-height: 48px;
    padding-left: var(--space-3);
    padding-right: var(--space-3);
    touch-action: manipulation;
    flex-shrink: 0;
    max-width: 180px;
  }

  /* Palette sheet open: the pressed secondary face (the dropdown's open look) and an underline. */
  .bottom-toolbar .swatch-btn.ore-btn.active {
    --bf: var(--light-300);
    --bh: var(--light-300-hi);
    --bl: var(--light-300-lo);
    min-height: 48px;
    padding-bottom: 0;
    box-shadow: inset 2px 2px 0 var(--bh), inset -2px -2px 0 var(--bl);
  }
  .swatch-btn.active::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 44px;
    height: 2px;
    margin-left: -22px;
    background: var(--ink-dark);
  }

  /* The block's own colour, so it is data, not a design colour: set inline from the block name. */
  .swatch-indicator {
    width: 24px;
    height: 24px;
    box-sizing: border-box;
    border: 2px solid var(--outline);
    border-radius: var(--radius-none);
    flex-shrink: 0;
  }

  .swatch-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .readout-row {
    display: flex;
    align-items: stretch;
    min-height: 28px;
    background: var(--surface-panel);
    box-shadow: var(--panel-tile);
  }

  .state-chip {
    flex: 0 0 auto;
    min-height: 44px;
    min-width: 44px;
    margin: 0 var(--space-2) 0 0;
    padding-left: var(--space-3);
    padding-right: var(--space-3);
    white-space: nowrap;
    touch-action: manipulation;
  }

  .cell-readout-bar {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: auto;
    min-height: 28px;
    padding: 0 var(--space-3);
    color: var(--ink);
    user-select: none;
    -webkit-user-select: none;
  }

  .readout-cell {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .readout-coord {
    font-weight: 700;
    color: var(--ink);
  }

  .readout-sep {
    color: var(--ink-muted);
  }

  .readout-block {
    color: var(--ink);
  }

  /* While something is pending the readout keeps its width and the message takes the rest. */
  .readout-cell.pending {
    flex: 0 0 auto;
    max-width: 100%;
  }

  .readout-msg {
    color: var(--ink-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-left: var(--space-2);
    min-width: 0;
    flex: 1 1 0;
    text-align: right;
  }

  /* A refusal: white text behind the design's 8 px red square (red text would not reach 4.5:1 on
     surface-panel), as .ore-field__error does. */
  .readout-error {
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-left: var(--space-2);
  }
  .readout-error::before {
    content: "";
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 6px;
    background: var(--red);
  }

  .readout-error.wide {
    margin-left: 0;
    flex: 1 1 auto;
  }
</style>
