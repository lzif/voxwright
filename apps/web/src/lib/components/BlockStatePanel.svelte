<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { blockProperties } from "@voxwright/core";
import type { EditSession } from "../editor-session.svelte.ts";

let { session }: { session: EditSession } = $props();

const block = $derived(session.inspectedBlock);
const name = $derived(block === null ? "" : (block.split(/[[{]/, 1)[0] as string));
const entries = $derived(block === null ? [] : blockProperties(block));
let newKey = $state("");
let newValue = $state("");

function commit(key: string, e: Event): void {
  const el = e.currentTarget as HTMLInputElement | HTMLSelectElement;
  const value = el.value.trim();
  if (value === "") return;
  if (!session.setProperty(key, value)) el.value = entries.find((p) => p.key === key)?.value ?? "";
  el.blur(); // hand the keyboard back, so Ctrl+Z undoes this change
}

function add(): void {
  if (newKey.trim() === "" || newValue.trim() === "") return;
  if (session.setProperty(newKey.trim(), newValue.trim())) {
    newKey = "";
    newValue = "";
  }
}
</script>

<section data-testid="blockstate">
  <h2>Block state</h2>
  {#if block === null || session.inspected === null}
    <p class="hint">Point at a block to see and change its properties (facing, half, waterlogged, …).</p>
  {:else}
    <p class="name" data-testid="blockstate-name">{name.replace("minecraft:", "")} <span class="pos">at {session.inspected.join(", ")}</span></p>
    {#each entries as p (p.key)}
      <label class="row">
        <span>{p.key}</span>
        {#if p.exact && p.options}
          <select value={p.value} onchange={(e) => commit(p.key, e)} data-testid={`prop-${p.key}`}>
            {#each p.options as o}<option value={o}>{o}</option>{/each}
          </select>
        {:else}
          <input
            type="text"
            value={p.value}
            list={p.options ? `opts-${p.key}` : undefined}
            spellcheck="false"
            autocomplete="off"
            onchange={(e) => commit(p.key, e)}
            data-testid={`prop-${p.key}`}
          />
          {#if p.options}
            <datalist id={`opts-${p.key}`}>{#each p.options as o}<option value={o}></option>{/each}</datalist>
          {/if}
        {/if}
      </label>
    {:else}
      <p class="hint">This block has no properties.</p>
    {/each}
    <div class="row add">
      <input type="text" placeholder="property" bind:value={newKey} spellcheck="false" aria-label="New property name" data-testid="prop-new-key" />
      <input type="text" placeholder="value" bind:value={newValue} spellcheck="false" aria-label="New property value" data-testid="prop-new-value" onkeydown={(e) => e.key === "Enter" && add()} />
      <button onclick={add} data-testid="prop-add">Add</button>
    </div>
    <p class="hint">Suggested values are only a guess; any value can be typed. Press Enter to apply.</p>
  {/if}
</section>

<style>
  h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; margin: 1.2rem 0 0.4rem; color: #5f594f; }
  .name { margin: 0 0 0.3rem; font-weight: 600; }
  .pos { font-weight: 400; color: #5f594f; font-size: 0.8rem; }
  .row { display: grid; grid-template-columns: 6.5rem 1fr; gap: 0.4rem; align-items: center; margin: 0.2rem 0; font-size: 0.85rem; }
  .row.add { grid-template-columns: 1fr 1fr auto; }
  input, select { box-sizing: border-box; min-width: 0; width: 100%; padding: 0.25rem 0.4rem; font: inherit; font-size: 0.85rem; border: 1px solid #c9c3b6; border-radius: 6px; background: #fff; }
  button { background: #2b2925; color: #f4f1eb; border: 0; border-radius: 6px; padding: 0.3rem 0.6rem; cursor: pointer; font: inherit; font-size: 0.85rem; }
  .hint { color: #5f594f; font-size: 0.8rem; margin: 0.3rem 0 0; }
</style>
