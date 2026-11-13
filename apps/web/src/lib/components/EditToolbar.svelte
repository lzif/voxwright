<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { TOOLS, toolTitle } from "../editing.ts";
import type { EditSession } from "../editor-session.svelte.ts";

let { session }: { session: EditSession } = $props();

const shown = TOOLS.filter((t) => t.id !== "paste");
const at = (p: readonly number[]): string => p.join(", ");
</script>

<div class="toolbar ore-editor" role="toolbar" aria-label="Editing tools" data-testid="toolbar">
  {#each shown as t (t.id)}
    <button
      type="button"
      class="ore-seg ore-type-ui"
      aria-pressed={session.tool === t.id}
      title={toolTitle(t)}
      onclick={() => session.setTool(t.id)}
      data-testid={`tool-${t.id}`}
    >{t.label}<kbd class="ore-type-ui-small">{t.key?.toUpperCase()}</kbd></button>
  {/each}
  <span class="sep" aria-hidden="true"></span>
  <button type="button" class="ore-btn ore-btn--secondary ore-type-ui" title="Undo (Ctrl+Z)" disabled={!session.canUndo} onclick={() => session.undo()} data-testid="undo">Undo</button>
  <button type="button" class="ore-btn ore-btn--secondary ore-type-ui" title="Redo (Ctrl+Shift+Z or Ctrl+Y)" disabled={!session.canRedo} onclick={() => session.redo()} data-testid="redo">Redo</button>
  <label class="check ore-choice__row" title="Rectangle: draw only the frame">
    <input type="checkbox" class="ore-choice__input" bind:checked={session.hollow} data-testid="hollow" />
    <span class="ore-box" aria-hidden="true">
      <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" focusable="false" shape-rendering="crispEdges">
        <path d="M2 6.5l3 3 5-6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" />
      </svg>
    </span>
    <span class="ore-choice__text ore-type-ui">Hollow</span>
  </label>
</div>

<p class="line ore-editor ore-type-ui-small" data-testid="edit-line">
  <span class="where ore-type-code" data-testid="hover" title={session.hover?.block} aria-hidden="true">{#if session.hover}{at(session.hover.position)} · {session.hover.block.replace("minecraft:", "")}{:else}&nbsp;{/if}</span>
  <span class="msg" aria-live="polite">
    {#if session.error}<span class="bad ore-field__error" data-testid="edit-error" role="alert">{session.error}</span>
    {:else if session.message}<span data-testid="edit-message">{session.message}</span>
    {:else}<span class="dim">{session.toolHelp}</span>{/if}
  </span>
</p>

<style>
  /* The tools are the design's toggle segments, kept apart (there are too many for one joined row)
     and left to wrap. Undo, Redo and Hollow follow them in the same row. */
  .toolbar { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin: 0 0 var(--space-2); }
  .toolbar .ore-seg { flex: 0 0 auto; }
  .toolbar .ore-seg + .ore-seg { margin-left: 0; }
  /* the design's divider: a groove with a light line beside it */
  .sep { width: 4px; align-self: stretch; background: linear-gradient(to right, var(--groove) 2px, var(--tab-lo) 2px); margin: 0 var(--space-1); }
  .check { margin-left: var(--space-1); }
  /* The editor's status bar: an outlined strip, 4px line on top. A fixed height: if this line grew or shrank, the canvas below would move under the pointer. */
  .line { box-sizing: border-box; margin: var(--space-2) 0; height: 28px; padding: 0 var(--space-2); align-items: center; background: var(--surface-panel); border: 2px solid var(--outline); border-top-width: 4px; display: flex; gap: var(--space-4); overflow: hidden; white-space: nowrap; }
  .msg { flex: 1 1 auto; }
  .line > span { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .where { flex: 0 0 22ch; color: var(--ink-muted); }
  .dim { color: var(--ink-muted); }
</style>
