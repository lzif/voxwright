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

<section data-testid="blockstate" class="ore-editor" class:touch class:ore-pane={!touch} class:ore-pane--floating={!touch}>
  {#if !touch}
    <div class="ore-pane__header"><h2 class="ore-pane__title ore-type-ui">Block state</h2></div>
  {/if}
  <div class="body" class:ore-pane__body={!touch}>
  {#if touch}
    <!-- The readout line is under the sheet, so the sheet repeats what it says (the live region is that line). -->
    <p class="status ore-type-ui-small" class:bad={session.error !== ""} aria-hidden="true" hidden={status === ""} data-testid="sheet-message">{status}</p>
  {/if}
  {#if block === null || session.inspected === null}
    {#if touch}
      <p class="hint ore-type-ui-small">Tap a block to see and change its properties (facing, half, open, …). In View a tap is enough; with a tool, the last block you tapped is the one.</p>
    {:else}
      <p class="hint ore-type-ui-small">Point at a block to see and change its properties (facing, half, waterlogged, …).</p>
    {/if}
  {:else}
    <p class="name ore-type-ui" data-testid="blockstate-name">{name.replace("minecraft:", "")} <span class="pos ore-type-ui-small">at {session.inspected.join(", ")}</span></p>
    {#if touch}
      {#if rotation !== null}
        <button type="button" class="rotate ore-btn ore-btn--dark ore-btn--touch ore-type-ui" title={`Turn the ${rotation.key}: ${rotation.key} ${entries.find((p) => p.key === rotation.key)?.value} to ${rotation.value}`} onclick={rotate} data-testid="rotate-block">Rotate block</button>
      {/if}
      {#each entries as p (p.key)}
        {@const ctl = classifyProperty(p)}
        <div class="prop ore-panel" data-testid={`prop-row-${p.key}`}>
          <span class="prop-name ore-type-ui" id={`prop-label-${p.key}`}>{p.key}</span>
          {#if ctl.kind === "boolean"}
            <button
              type="button"
              role="switch"
              class="switch ore-switch"
              aria-checked={ctl.on}
              aria-labelledby={`prop-label-${p.key}`}
              onclick={() => apply(p.key, ctl.on ? "false" : "true", p.value)}
              data-testid={`prop-${p.key}`}
            ><span class="ore-switch__track" aria-hidden="true"></span><span class="ore-switch__glyph" aria-hidden="true">{ctl.on ? "I" : "O"}</span><span class="ore-switch__thumb" aria-hidden="true"></span></button>
          {:else if ctl.kind === "enum" || (ctl.kind === "numeric" && ctl.chips !== null)}
            {@const values = ctl.kind === "enum" ? ctl.values : (ctl.kind === "numeric" ? (ctl.chips ?? []) : [])}
            <div class="chips ore-toggle__group" role="group" aria-labelledby={`prop-label-${p.key}`} data-testid={`prop-${p.key}`}>
              {#each values as v (v)}
                <button
                  type="button"
                  class="chip ore-seg ore-type-ui"
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
              <button type="button" class="step ore-btn ore-btn--secondary ore-type-ui" aria-label={`Decrease ${p.key}`} disabled={down === null} onclick={() => down !== null && apply(p.key, down, p.value)} data-testid={`prop-${p.key}-dec`}>−</button>
              <output class="value ore-type-ui" data-testid={`prop-${p.key}-value`}>{p.value}</output>
              <button type="button" class="step ore-btn ore-btn--secondary ore-type-ui" aria-label={`Increase ${p.key}`} disabled={up === null} onclick={() => up !== null && apply(p.key, up, p.value)} data-testid={`prop-${p.key}-inc`}>+</button>
              {#if ctl.max !== null}<span class="range ore-type-ui-small">{ctl.min} to {ctl.max}</span>{/if}
            </div>
          {:else}
            <span class="free-value ore-type-ui" data-testid={`prop-${p.key}`}>{p.value} <span class="range ore-type-ui-small">(edit under Other…)</span></span>
          {/if}
        </div>
      {:else}
        <p class="hint ore-type-ui-small">This block has no properties.</p>
      {/each}

      <button type="button" class="other-toggle ore-btn ore-btn--secondary ore-type-ui" aria-expanded={other} aria-controls="state-other" onclick={() => (other = !other)} data-testid="prop-other-toggle">Other…</button>
      {#if other}
        <div id="state-other" class="other" data-testid="prop-other">
          {#each entries as p (p.key)}
            <label class="row">
              <span class="ore-type-ui">{p.key}</span>
              <input
                type="text"
                class="ore-input ore-type-ui"
                value={p.value}
                spellcheck="false"
                autocomplete="off"
                onchange={(e) => commit(p.key, e)}
                data-testid={`prop-other-${p.key}`}
              />
            </label>
          {/each}
          <div class="row add">
            <input type="text" class="ore-input ore-type-ui" placeholder="property" bind:value={newKey} spellcheck="false" aria-label="New property name" data-testid="prop-new-key" />
            <input type="text" class="ore-input ore-type-ui" placeholder="value" bind:value={newValue} spellcheck="false" aria-label="New property value" data-testid="prop-new-value" onkeydown={(e) => e.key === "Enter" && add()} />
            <button type="button" class="ore-btn ore-btn--dark ore-btn--touch ore-type-ui" onclick={add} data-testid="prop-add">Add</button>
          </div>
          <p class="hint ore-type-ui-small">Any value can be typed here, and a new property added. Leave the field to apply it.</p>
        </div>
      {/if}
    {:else}
      {#each entries as p (p.key)}
        <label class="row">
          <span class="ore-type-ui">{p.key}</span>
          {#if p.exact && p.options}
            <span class="ore-dd">
              <select class="ore-btn ore-btn--secondary ore-dd__btn ore-dd__select ore-type-ui" value={p.value} onchange={(e) => commit(p.key, e)} data-testid={`prop-${p.key}`}>
                {#each p.options as o}<option value={o}>{o}</option>{/each}
              </select>
              <svg class="ore-dd__chev" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="M3 5.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" /></svg>
            </span>
          {:else}
            <input
              type="text"
              class="ore-input ore-type-ui"
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
        <p class="hint ore-type-ui-small">This block has no properties.</p>
      {/each}
      <div class="row add">
        <input type="text" class="ore-input ore-type-ui" placeholder="property" bind:value={newKey} spellcheck="false" aria-label="New property name" data-testid="prop-new-key" />
        <input type="text" class="ore-input ore-type-ui" placeholder="value" bind:value={newValue} spellcheck="false" aria-label="New property value" data-testid="prop-new-value" onkeydown={(e) => e.key === "Enter" && add()} />
        <button class="ore-btn ore-btn--dark ore-type-ui" onclick={add} data-testid="prop-add">Add</button>
      </div>
      <p class="hint ore-type-ui-small">Suggested values are only a guess; any value can be typed. Press Enter to apply.</p>
    {/if}
  {/if}
  </div>
</section>

<style>
  /* The design's classes (ore-panel, ore-btn, ore-seg, ore-switch, ore-input, ore-toggle__group) come from the
     page's stylesheet; what is below places them and states what the design has no class for. On desktop the
     section is a panel. On touch the sheet is the panel, so each property is a tile of its own. */
  section { min-width: 0; }
  .name { margin: 0; color: var(--ink); }
  .pos { color: var(--ink-muted); }
  .hint { margin: var(--space-2) 0 0; color: var(--ink-muted); }
  .row { display: grid; grid-template-columns: 6.5rem minmax(0, 1fr); gap: var(--space-2); align-items: center; margin: var(--space-2) 0 0; color: var(--ink); }
  .row > span { overflow-wrap: anywhere; }
  .row.add { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); margin-top: var(--space-4); }
  .row.add button { grid-column: 1 / -1; }
  .ore-input { min-width: 0; }

  /* The desktop drop-down: a native select in the editor's 36px dropdown face (the secondary button, app.css),
     with the chevron drawn beside it as the design's dropdown does. */
  .ore-dd { display: block; min-width: 0; }
  select { display: block; min-width: 0; width: 100%; text-align: left; text-overflow: ellipsis; }

  /* Touch: every control at least 44 px, the sheet one column that wraps, never scrolls sideways. */
  /* top -12px: a sticky offset counts from the content box, so this is flush with the top of the scrolling sheet (its padding is 12px) and nothing scrolls past above it */
  .status { position: sticky; top: -12px; z-index: 1; margin: 0 0 var(--space-3); padding: var(--space-2) var(--space-3); background: var(--surface-panel); color: var(--ink); }
  .status.bad { background: var(--yellow); color: var(--ink-dark); }
  .status[hidden] { display: none; }
  .rotate { width: 100%; margin: var(--space-2) 0 0; }
  .prop { display: grid; gap: var(--space-2); margin: var(--space-2) 0 0; padding: var(--space-3) var(--space-4); }
  .prop > * { margin: 0; }
  .prop-name { color: var(--ink); }
  .chips { flex-wrap: wrap; gap: var(--space-2); }
  .chip { flex: 0 1 auto; min-width: 44px; max-width: 100%; touch-action: manipulation; }
  .chip + .chip { margin-left: 0; }
  /* ore-seg draws its pressed state from aria-checked; these are toggle buttons, so they read aria-pressed.
     The box stays 44 px tall: the band closes, the face does not drop. */
  .chip.ore-seg[aria-pressed="true"], .chip.ore-seg[aria-pressed="true"]:active:not(:disabled) { --bf: var(--green); --bh: var(--green-hi); --bl: var(--green-lo); --bt: var(--ink); min-height: 44px; padding-bottom: 0; box-shadow: inset 2px 2px 0 var(--bh), inset -2px -2px 0 var(--bl); }
  .chip.ore-seg[aria-pressed="true"]:hover:not(:disabled) { --bf: var(--green-hover); --bh: var(--green-hover-hi); --bl: var(--green-hover-lo); }
  .chip.ore-seg[aria-pressed="true"]::after { content: ""; position: absolute; left: 50%; bottom: 0; width: 44px; height: 2px; margin-left: -22px; background: var(--ink); }
  .stepper { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  .step { min-width: 44px; padding: 0; touch-action: manipulation; }
  .value { min-width: 2.2rem; text-align: center; color: var(--ink); }
  .range { color: var(--ink-muted); }
  .free-value { color: var(--ink); overflow-wrap: anywhere; }
  .switch { height: 44px; justify-self: start; touch-action: manipulation; }
  .switch .ore-switch__track, .switch .ore-switch__glyph, .switch .ore-switch__thumb { bottom: 8px; }
  .other-toggle { width: 100%; margin: var(--space-2) 0 0; touch-action: manipulation; }
  .other { margin: var(--space-2) 0 0; }
  /* 16 px keeps iOS from zooming into a field it focuses */
  .touch .other .ore-input { font-size: 1rem; }
  .touch .other .row { grid-template-columns: 6rem minmax(0, 1fr); }
  .touch .other .row.add { grid-template-columns: minmax(0, 1fr); margin-top: var(--space-2); }
  .touch .other .row.add button { grid-column: auto; }
</style>
