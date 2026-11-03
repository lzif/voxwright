<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { canonicalize } from "@voxwright/core";
import { normalizeBlockInput, searchPalette } from "../editing.ts";
import type { EditSession } from "../editor-session.svelte.ts";

let { session }: { session: EditSession } = $props();

let query = $state("");
const found = $derived(searchPalette(session.paletteBlocks, query));
const typed = $derived(normalizeBlockInput(query));
const offerTyped = $derived(typed !== "" && !session.paletteBlocks.some((e) => e.block === typed));
const invalid = $derived.by(() => {
  try {
    canonicalize(session.block);
    return "";
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
});

function choose(block: string): void {
  session.block = block;
  session.error = "";
}

function onSearchKey(e: KeyboardEvent): void {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const first = found.shown[0];
  if (first !== undefined) choose(first.block);
  else if (offerTyped) choose(typed);
}
</script>

<section data-testid="palette">
  <h2>Block</h2>
  <label class="current">
    <span class="sr">Chosen block</span>
    <input
      type="text"
      spellcheck="false"
      autocomplete="off"
      bind:value={session.block}
      class:invalid={invalid !== ""}
      aria-invalid={invalid !== ""}
      data-testid="block-input"
    />
  </label>
  {#if invalid}<p class="hint bad">{invalid}</p>{:else}<p class="hint">Used by Place, Replace, Line, Rectangle, Fill and Replace-in-selection. Type any block, with properties if you like.</p>{/if}

  <input
    type="search"
    placeholder="Search blocks…"
    autocomplete="off"
    spellcheck="false"
    bind:value={query}
    onkeydown={onSearchKey}
    aria-label="Search blocks"
    data-testid="palette-search"
  />
  <ul class="list" data-testid="palette-list">
    {#if offerTyped}
      <li><button class="entry typed" onclick={() => choose(typed)} data-testid="palette-use-typed">Use “{typed}”</button></li>
    {/if}
    {#each found.shown as entry (entry.block)}
      <li>
        <button
          class="entry"
          class:on={session.block === entry.block}
          class:build={entry.source === "build"}
          title={`${entry.block} (${entry.source === "build" ? "used in this build" : "from the texture pack"})`}
          onclick={() => choose(entry.block)}
          data-block={entry.block}
        >{entry.block.replace("minecraft:", "")}</button>
      </li>
    {/each}
  </ul>
  <p class="hint">
    {found.total} match{found.total === 1 ? "" : "es"}{found.total > found.shown.length ? `, first ${found.shown.length} shown` : ""}.
    {session.packBlocks.length === 0 ? "No texture pack: only this build's blocks are listed; type any other block above." : ""}
  </p>
</section>

<style>
  h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 0.4rem; color: #6b655b; }
  input[type="text"], input[type="search"] { width: 100%; box-sizing: border-box; padding: 0.4rem 0.5rem; font: inherit; font-size: 0.9rem; border: 1px solid #c9c3b6; border-radius: 6px; background: #fff; }
  input.invalid { border-color: #b3382b; }
  .sr { position: absolute; left: -9999px; }
  .current { display: block; margin-bottom: 0.2rem; }
  .list { list-style: none; margin: 0.4rem 0 0; padding: 0; max-height: 17rem; overflow: auto; border: 1px solid #e2dccf; border-radius: 6px; background: #fff; }
  .entry { display: block; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; background: transparent; color: #2b2925; border: 0; border-radius: 0; padding: 0.2rem 0.5rem; font: inherit; font-size: 0.85rem; cursor: pointer; }
  .entry:hover { background: #f1ece0; }
  .entry.on { background: #2b2925; color: #f4f1eb; }
  .entry.build { font-weight: 600; }
  .entry.typed { font-style: italic; }
  .hint { color: #8a8378; font-size: 0.8rem; margin: 0.3rem 0 0; }
  .bad { color: #7a1f16; }
</style>
