<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { makeBox, type Vec3 } from "@voxwright/core";
import { FILL_KEY, ROTATE_KEYS, withoutNbt } from "../editing.ts";
import type { EditSession } from "../editor-session.svelte.ts";

let { session }: { session: EditSession } = $props();

const sel = $derived(session.selection);
const size = $derived(
  sel === null
    ? null
    : ([
        sel.max[0] - sel.min[0] + 1,
        sel.max[1] - sel.min[1] + 1,
        sel.max[2] - sel.min[2] + 1,
      ] satisfies Vec3),
);
const AXES = [0, 1, 2] as const;
let from = $state("");
let delta = $state<[number, number, number]>([0, 0, 0]);

function setCorner(which: "min" | "max", axis: 0 | 1 | 2, e: Event): void {
  if (sel === null) return;
  const v = Math.trunc(Number((e.currentTarget as HTMLInputElement).value));
  if (!Number.isFinite(v)) return;
  const a = [...sel.min] as [number, number, number];
  const b = [...sel.max] as [number, number, number];
  (which === "min" ? a : b)[axis] = v;
  session.setSelection(makeBox(a, b));
}

function useInspected(): void {
  const b = session.inspectedBlock;
  if (b !== null) from = withoutNbt(b);
}

const nudge = (axis: 0 | 1 | 2, by: number): void => {
  const d: [number, number, number] = [0, 0, 0];
  d[axis] = by;
  session.move(d);
};
</script>

<section data-testid="selection-panel">
  <h2>Selection</h2>
  {#if sel === null || size === null}
    <p class="hint">Choose the Select tool and drag from one block to another, or <button class="link" onclick={() => session.selectAll()} data-testid="select-all">select everything</button>.</p>
  {:else}
    <p class="size" data-testid="selection-size">{size.join(" × ")} blocks</p>
    <div class="coords" aria-label="Selection corners">
      {#each AXES as a}
        <span class="axis">{"xyz"[a]}</span>
        <input type="number" value={sel.min[a]} onchange={(e) => setCorner("min", a, e)} aria-label={`From ${"xyz"[a]}`} data-testid={`sel-min-${"xyz"[a]}`} />
        <input type="number" value={sel.max[a]} onchange={(e) => setCorner("max", a, e)} aria-label={`To ${"xyz"[a]}`} data-testid={`sel-max-${"xyz"[a]}`} />
      {/each}
    </div>

    <div class="actions">
      <button title={`Fill the selection with the chosen block (${FILL_KEY.toUpperCase()})`} onclick={() => session.fill()} data-testid="fill">Fill</button>
      <label class="check"><input type="checkbox" bind:checked={session.onlyEmpty} /> only empty cells</label>
    </div>

    <div class="replace">
      <input type="text" placeholder="block to replace" bind:value={from} spellcheck="false" autocomplete="off" aria-label="Block to replace" data-testid="replace-from" />
      <button class="small" title="Use the block last pointed at" onclick={useInspected} data-testid="replace-use">Pointed-at</button>
      <button onclick={() => session.replace(from)} data-testid="replace">Replace with the chosen block</button>
      <p class="hint">Matches the whole block state, such as <code>minecraft:stone</code> or <code>minecraft:oak_stairs[facing=north,…]</code>.</p>
    </div>

    <div class="actions">
      <button title="Turn the selection a quarter turn anticlockwise ({ROTATE_KEYS.ccw})" onclick={() => session.rotate("COUNTERCLOCKWISE_90")} data-testid="rotate-ccw">Rotate ↺</button>
      <button title="Turn the selection a quarter turn clockwise ({ROTATE_KEYS.cw})" onclick={() => session.rotate("CLOCKWISE_90")} data-testid="rotate-cw">Rotate ↻</button>
      <button title="Mirror east to west" onclick={() => session.mirror("x")} data-testid="mirror-x">Mirror E–W</button>
      <button title="Mirror north to south" onclick={() => session.mirror("z")} data-testid="mirror-z">Mirror N–S</button>
    </div>

    <div class="move">
      {#each AXES as a}
        <label>{"xyz"[a]} <input type="number" bind:value={delta[a]} aria-label={`Move along ${"xyz"[a]}`} data-testid={`move-${"xyz"[a]}`} /></label>
      {/each}
      <button onclick={() => session.move([delta[0], delta[1], delta[2]])} data-testid="move">Move</button>
      <span class="nudges">
        <button class="small" title="Up one block" onclick={() => nudge(1, 1)}>↑</button>
        <button class="small" title="Down one block" onclick={() => nudge(1, -1)}>↓</button>
      </span>
    </div>

    <div class="actions">
      <button title="Copy the selection (Ctrl+C)" onclick={() => session.copy()} data-testid="copy">Copy</button>
      <button title="Paste the copied blocks where you click (Ctrl+V)" disabled={session.clipboardCells === 0} onclick={() => session.setTool("paste")} data-testid="paste">Paste</button>
      <button class="ghost" title="Deselect (Esc)" onclick={() => session.clearSelection()} data-testid="select-none">Clear</button>
    </div>
    <label class="check"><input type="checkbox" bind:checked={session.skipAir} /> leave the target alone where there is air (paste and move)</label>
  {/if}
  {#if sel === null && session.clipboardCells > 0}
    <div class="actions">
      <button title="Paste the copied blocks where you click (Ctrl+V)" onclick={() => session.setTool("paste")} data-testid="paste">Paste {session.clipboardCells} blocks</button>
    </div>
  {/if}
</section>

<style>
  h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; margin: 1.2rem 0 0.4rem; color: #6b655b; }
  .size { margin: 0 0 0.3rem; font-weight: 600; }
  .coords { display: grid; grid-template-columns: 1rem 1fr 1fr; gap: 0.25rem 0.3rem; align-items: center; }
  .axis { color: #8a8378; font-size: 0.8rem; }
  input[type="number"], input[type="text"] { box-sizing: border-box; min-width: 0; width: 100%; padding: 0.25rem 0.4rem; font: inherit; font-size: 0.85rem; border: 1px solid #c9c3b6; border-radius: 6px; background: #fff; }
  button { background: #2b2925; color: #f4f1eb; border: 0; border-radius: 6px; padding: 0.35rem 0.6rem; cursor: pointer; font: inherit; font-size: 0.85rem; }
  button:disabled { opacity: 0.45; cursor: default; }
  button.small { padding: 0.25rem 0.45rem; background: #e2dccf; color: #2b2925; }
  button.ghost { background: #e2dccf; color: #2b2925; }
  button.link { background: transparent; color: #2b2925; padding: 0; text-decoration: underline; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; margin: 0.5rem 0 0; }
  .replace { margin: 0.5rem 0 0; display: grid; gap: 0.3rem; }
  .move { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; margin: 0.5rem 0 0; }
  .move label { display: inline-flex; gap: 0.2rem; align-items: center; width: 4.4rem; font-size: 0.8rem; color: #6b655b; }
  .nudges { display: inline-flex; gap: 0.2rem; }
  .check { font-size: 0.8rem; display: flex; gap: 0.3rem; align-items: center; color: #6b655b; }
  .hint { color: #8a8378; font-size: 0.8rem; margin: 0.2rem 0 0; }
  code { font-size: 0.75rem; }
</style>
