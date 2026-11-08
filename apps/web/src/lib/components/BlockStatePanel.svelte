<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { blockProperties } from "@voxwright/core";
import { classifyProperty, rotationStep, stepNumeric } from "../block-state.ts";
import type { EditSession } from "../editor-session.svelte.ts";

// `touch` draws the properties for fingers: switches for true / false, chips for a few named values,
// chips or a stepper for numbers, a "Rotate block" button, and the text fields behind "Other…".
let { session, touch = false }: { session: EditSession; touch?: boolean } = $props();

const block = $derived(session.inspectedBlock);
const name = $derived(block === null ? "" : (block.split(/[[{]/, 1)[0] as string));
const entries = $derived(block === null ? [] : blockProperties(block));
const rotation = $derived(touch ? rotationStep(entries) : null);
let newKey = $state("");
let newValue = $state("");
let other = $state(false);

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

/** A tap on a switch, a chip or a stepper: one property change, one undo step. A chip that is already on does nothing. */
function apply(key: string, value: string, current: string): void {
  if (value === current) return;
  session.setProperty(key, value);
}

function rotate(): void {
  if (rotation !== null) session.setProperty(rotation.key, rotation.value);
}

/** What the sheet says in place of the readout line, which the sheet covers. */
const status = $derived(session.error !== "" ? session.error : session.message);
</script>

<section data-testid="blockstate" class:touch>
  <h2>Block state</h2>
  {#if touch}
    <!-- The readout line is under the sheet, so the sheet repeats what it says (the live region is that line). -->
    <p class="status" class:bad={session.error !== ""} aria-hidden="true" hidden={status === ""} data-testid="sheet-message">{status}</p>
  {/if}
  {#if block === null || session.inspected === null}
    {#if touch}
      <p class="hint">Tap a block to see and change its properties (facing, half, open, …). In View a tap is enough; with a tool, the last block you tapped is the one.</p>
    {:else}
      <p class="hint">Point at a block to see and change its properties (facing, half, waterlogged, …).</p>
    {/if}
  {:else}
    <p class="name" data-testid="blockstate-name">{name.replace("minecraft:", "")} <span class="pos">at {session.inspected.join(", ")}</span></p>
    {#if touch}
      {#if rotation !== null}
        <button type="button" class="rotate" title={`Turn the ${rotation.key}: ${rotation.key} ${entries.find((p) => p.key === rotation.key)?.value} to ${rotation.value}`} onclick={rotate} data-testid="rotate-block">Rotate block</button>
      {/if}
      {#each entries as p (p.key)}
        {@const ctl = classifyProperty(p)}
        <div class="prop" data-testid={`prop-row-${p.key}`}>
          <span class="prop-name" id={`prop-label-${p.key}`}>{p.key}</span>
          {#if ctl.kind === "boolean"}
            <button
              type="button"
              role="switch"
              class="switch"
              class:on={ctl.on}
              aria-checked={ctl.on}
              aria-labelledby={`prop-label-${p.key}`}
              onclick={() => apply(p.key, ctl.on ? "false" : "true", p.value)}
              data-testid={`prop-${p.key}`}
            ><span class="switch-text" aria-hidden="true">{ctl.on ? "On" : "Off"}</span></button>
          {:else if ctl.kind === "enum" || (ctl.kind === "numeric" && ctl.chips !== null)}
            {@const values = ctl.kind === "enum" ? ctl.values : (ctl.kind === "numeric" ? (ctl.chips ?? []) : [])}
            <div class="chips" role="group" aria-labelledby={`prop-label-${p.key}`} data-testid={`prop-${p.key}`}>
              {#each values as v (v)}
                <button
                  type="button"
                  class="chip"
                  aria-pressed={p.value === v}
                  onclick={() => apply(p.key, v, p.value)}
                  data-testid={`prop-${p.key}-${v}`}
                >{v}</button>
              {/each}
            </div>
          {:else if ctl.kind === "numeric"}
            {@const down = stepNumeric(ctl, p.value, -1)}
            {@const up = stepNumeric(ctl, p.value, 1)}
            <div class="stepper" role="group" aria-labelledby={`prop-label-${p.key}`} data-testid={`prop-${p.key}`}>
              <button type="button" class="chip step" aria-label={`Decrease ${p.key}`} disabled={down === null} onclick={() => down !== null && apply(p.key, down, p.value)} data-testid={`prop-${p.key}-dec`}>−</button>
              <output class="value" data-testid={`prop-${p.key}-value`}>{p.value}</output>
              <button type="button" class="chip step" aria-label={`Increase ${p.key}`} disabled={up === null} onclick={() => up !== null && apply(p.key, up, p.value)} data-testid={`prop-${p.key}-inc`}>+</button>
              {#if ctl.max !== null}<span class="range">{ctl.min} to {ctl.max}</span>{/if}
            </div>
          {:else}
            <span class="free-value" data-testid={`prop-${p.key}`}>{p.value} <span class="range">(edit under Other…)</span></span>
          {/if}
        </div>
      {:else}
        <p class="hint">This block has no properties.</p>
      {/each}

      <button type="button" class="other-toggle" aria-expanded={other} aria-controls="state-other" onclick={() => (other = !other)} data-testid="prop-other-toggle">Other…</button>
      {#if other}
        <div id="state-other" class="other" data-testid="prop-other">
          {#each entries as p (p.key)}
            <label class="row">
              <span>{p.key}</span>
              <input
                type="text"
                value={p.value}
                spellcheck="false"
                autocomplete="off"
                onchange={(e) => commit(p.key, e)}
                data-testid={`prop-other-${p.key}`}
              />
            </label>
          {/each}
          <div class="row add">
            <input type="text" placeholder="property" bind:value={newKey} spellcheck="false" aria-label="New property name" data-testid="prop-new-key" />
            <input type="text" placeholder="value" bind:value={newValue} spellcheck="false" aria-label="New property value" data-testid="prop-new-value" onkeydown={(e) => e.key === "Enter" && add()} />
            <button type="button" onclick={add} data-testid="prop-add">Add</button>
          </div>
          <p class="hint">Any value can be typed here, and a new property added. Leave the field to apply it.</p>
        </div>
      {/if}
    {:else}
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

  /* Touch: every control at least 44 px; the sheet is one column that wraps, never scrolls sideways. */
  /* top -12px: flush with the top of the scrolling sheet (its padding is 12px), so nothing scrolls past above it */
  .status { position: sticky; top: -12px; z-index: 1; margin: 0 0 0.3rem; padding: 12px 0 0.25rem; background: #fffdf8; color: #5f594f; font-size: 0.85rem; font-weight: 600; }
  .status.bad { color: #7a1f16; }
  .status[hidden] { display: none; }
  .touch button { min-height: 44px; min-width: 44px; font-size: 0.95rem; touch-action: manipulation; }
  .touch .rotate { width: 100%; min-height: 48px; margin: 0.2rem 0 0.4rem; }
  .prop { display: grid; gap: 0.3rem; margin: 0.6rem 0; }
  .prop-name { font-size: 0.85rem; font-weight: 600; color: #2b2925; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { min-width: 44px; padding: 0 14px; background: #e2dccf; color: #2b2925; }
  .chip[aria-pressed="true"] { background: #2b2925; color: #f4f1eb; font-weight: 600; }
  .stepper { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .stepper .step { font-size: 1.3rem; padding: 0; }
  .stepper .step:disabled { opacity: 0.45; cursor: default; }
  .value { min-width: 2.2rem; text-align: center; font-size: 1.1rem; font-weight: 600; color: #2b2925; }
  .range { color: #5f594f; font-size: 0.8rem; font-weight: 400; }
  .free-value { color: #2b2925; font-size: 0.95rem; word-break: break-word; }
  .switch { min-width: 84px; padding: 0 14px; background: #e2dccf; color: #2b2925; display: inline-flex; align-items: center; justify-content: center; justify-self: start; }
  .switch.on { background: #2e6930; color: #ffffff; }
  .switch-text { font-weight: 600; }
  .other-toggle { width: 100%; margin-top: 0.4rem; background: #e2dccf; color: #2b2925; }
  .other { margin-top: 0.3rem; }
  .touch .other input { min-height: 44px; font-size: 1rem; }
  .touch .other .row { grid-template-columns: 6rem 1fr; }
  .touch .other .row.add { grid-template-columns: 1fr; gap: 8px; }
</style>
