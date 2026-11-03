<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { TOOLS, toolTitle } from "../editing.ts";
import type { EditSession } from "../editor-session.svelte.ts";

let { session }: { session: EditSession } = $props();

const shown = TOOLS.filter((t) => t.id !== "paste");
const at = (p: readonly number[]): string => p.join(", ");
</script>

<div class="toolbar" role="toolbar" aria-label="Editing tools" data-testid="toolbar">
  {#each shown as t (t.id)}
    <button
      class:on={session.tool === t.id}
      aria-pressed={session.tool === t.id}
      title={toolTitle(t)}
      onclick={() => session.setTool(t.id)}
      data-testid={`tool-${t.id}`}
    >{t.label}<kbd>{t.key?.toUpperCase()}</kbd></button>
  {/each}
  <span class="sep" aria-hidden="true"></span>
  <button title="Undo (Ctrl+Z)" disabled={!session.canUndo} onclick={() => session.undo()} data-testid="undo">Undo</button>
  <button title="Redo (Ctrl+Shift+Z or Ctrl+Y)" disabled={!session.canRedo} onclick={() => session.redo()} data-testid="redo">Redo</button>
  <label class="check" title="Rectangle: draw only the frame">
    <input type="checkbox" bind:checked={session.hollow} data-testid="hollow" /> Hollow
  </label>
</div>

<p class="line" data-testid="edit-line">
  <span class="where" data-testid="hover" title={session.hover?.block}>{#if session.hover}{at(session.hover.position)} · {session.hover.block.replace("minecraft:", "")}{:else}&nbsp;{/if}</span>
  {#if session.error}<span class="bad" data-testid="edit-error">{session.error}</span>
  {:else if session.message}<span data-testid="edit-message">{session.message}</span>
  {:else}<span class="dim">{session.toolHelp}</span>{/if}
</p>

<style>
  .toolbar { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; margin: 0 0 0.4rem; }
  button { background: #e2dccf; color: #2b2925; border: 0; border-radius: 6px; padding: 0.35rem 0.6rem; cursor: pointer; font: inherit; font-size: 0.9rem; }
  button.on { background: #2b2925; color: #f4f1eb; }
  button:disabled { opacity: 0.45; cursor: default; }
  kbd { margin-left: 0.35rem; font: inherit; font-size: 0.7rem; opacity: 0.6; }
  .sep { width: 1px; align-self: stretch; background: #c9c3b6; margin: 0 0.2rem; }
  .check { font-size: 0.9rem; display: inline-flex; gap: 0.3rem; align-items: center; margin-left: 0.3rem; }
  /* A fixed height: if this line grew or shrank, the canvas below would move under the pointer. */
  .line { margin: 0.35rem 0 0.4rem; font-size: 0.85rem; height: 1.5em; line-height: 1.5em; display: flex; gap: 0.8rem; overflow: hidden; white-space: nowrap; }
  .line > span { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .where { flex: 0 0 22ch; font-family: ui-monospace, monospace; color: #6b655b; }
  .dim { color: #8a8378; }
  .bad { color: #7a1f16; }
</style>
