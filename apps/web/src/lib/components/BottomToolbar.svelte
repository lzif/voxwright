<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { TOOLS, toolTitle } from "../editing.ts";
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
  <!-- Live cell readout bar -->
  <div
    class="cell-readout-bar"
    data-testid="live-cell-readout"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    aria-label="Target cell readout"
  >
    <div class="readout-cell" data-testid="cell-readout">
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
    </div>
    {#if session.message}
      <span class="readout-msg" data-testid="edit-message">{session.message}</span>
    {:else if session.error}
      <span class="readout-error" data-testid="edit-error">{session.error}</span>
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
      class="swatch-btn"
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
          class="tool-btn"
          class:active={session.tool === t.id}
          aria-pressed={session.tool === t.id}
          onclick={() => session.setTool(t.id)}
          title={toolTitle(t)}
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
      class="panel-btn"
      class:active={activeSheet === "blockstate"}
      onclick={() => ontogglesheet?.("blockstate")}
      data-testid="mobile-state-toggle"
      aria-label="Toggle block state sheet"
    >
      State
    </button>

    <button
      type="button"
      class="panel-btn"
      class:active={activeSheet === "selection"}
      onclick={() => ontogglesheet?.("selection")}
      data-testid="mobile-selection-toggle"
      aria-label="Toggle selection sheet"
    >
      Select
    </button>
  </div>
</div>

<style>
  .bottom-toolbar-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 30;
    background: #24221f;
    border-top: 1px solid #3d3a34;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.28);
  }

  .bottom-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 56px;
    padding: 0 12px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    touch-action: pan-x;
  }
  .bottom-toolbar::-webkit-scrollbar {
    display: none;
  }

  .tool-strip {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .tool-btn,
  .panel-btn {
    min-width: 48px;
    min-height: 48px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: #3d3a34;
    color: #f4f1eb;
    font-size: 0.84rem;
    font-weight: 500;
    cursor: pointer;
    touch-action: manipulation;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .tool-btn.active,
  .panel-btn.active {
    background: #f4f1eb;
    color: #24221f;
    font-weight: 600;
  }

  .tool-btn:active,
  .panel-btn:active {
    filter: brightness(0.9);
  }

  .sep {
    width: 1px;
    height: 32px;
    background: #4a463f;
    flex-shrink: 0;
  }

  .swatch-btn {
    min-width: 48px;
    min-height: 48px;
    padding: 4px 12px;
    border: 1px solid #4a463f;
    border-radius: 8px;
    background: #2f2c27;
    color: #f4f1eb;
    cursor: pointer;
    touch-action: manipulation;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    max-width: 180px;
  }

  .swatch-btn.active {
    border-color: #f4f1eb;
    background: #3d3a34;
  }

  .swatch-indicator {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    flex-shrink: 0;
  }

  .swatch-label {
    font-size: 0.82rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cell-readout-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 28px;
    padding: 0 12px;
    background: #1e1c19;
    border-bottom: 1px solid #3d3a34;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.78rem;
    color: #f4f1eb;
    user-select: none;
    -webkit-user-select: none;
  }

  .readout-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .readout-coord {
    font-weight: 600;
    color: #4dedd5;
  }

  .readout-sep {
    color: #858585;
  }

  .readout-block {
    color: #f4f1eb;
  }

  .readout-msg {
    font-size: 0.74rem;
    color: #a8a29e;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-left: 8px;
  }

  .readout-error {
    font-size: 0.74rem;
    color: #ef4444;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-left: 8px;
  }
</style>
