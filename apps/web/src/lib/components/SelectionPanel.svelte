<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { makeBox, type Vec3 } from "@voxwright/core";
import { FILL_KEY, ROTATE_KEYS, withoutNbt } from "../editing.ts";
import type { EditSession } from "../editor-session.svelte.ts";
import { FACES } from "../nudge.ts";

// `touch` adds what the mobile layout needs: the face steppers, and the hint worded for taps.
let { session, touch = false }: { session: EditSession; touch?: boolean } = $props();

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
// A way to change single blocks without a pointer: type the cell.
let at = $state<[number, number, number]>([0, 0, 0]);
const span = $derived.by(() => {
  void session.revision;
  const bb = session.volume.placedBounds();
  return bb === null
    ? ""
    : `The build spans x ${bb[0][0]} to ${bb[1][0]}, y ${bb[0][1]} to ${bb[1][1]}, z ${bb[0][2]} to ${bb[1][2]}.`;
});
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

<!-- On touch the selection comes first: its size and the face steppers are what the sheet is opened for. -->
<div class="panels" class:touch>
<section data-testid="coords-panel" aria-labelledby="coords-title">
  <h2 id="coords-title">Block at coordinates</h2>
  <div class="move">
    {#each AXES as a}
      <label>{"xyz"[a]} <input type="number" bind:value={at[a]} data-testid={`at-${"xyz"[a]}`} /></label>
    {/each}
  </div>
  <div class="actions">
    <button onclick={() => session.placeAt([at[0], at[1], at[2]], session.block)} data-testid="at-set">Set to chosen block</button>
    <button class="ghost" onclick={() => session.eraseAt([at[0], at[1], at[2]])} data-testid="at-erase">Erase</button>
  </div>
  <p class="hint">Works with the keyboard alone. {span} The block state panel then shows that block.</p>
</section>

<section data-testid="selection-panel">
  <h2>Selection</h2>
  {#if sel === null || size === null}
    {#if touch}
      <p class="hint">Choose the Select tool and tap two blocks, then confirm with the check mark, or <button class="link" onclick={() => session.selectAll()} data-testid="select-all">select everything</button>.</p>
    {:else}
      <p class="hint">Choose the Select tool and drag from one block to another, or <button class="link" onclick={() => session.selectAll()} data-testid="select-all">select everything</button>.</p>
    {/if}
  {:else}
    <p class="size" data-testid="selection-size">{size.join(" × ")} blocks</p>
    {#if touch}
      <!-- One block per press, on one face at a time. Growing adds a layer on that side; shrinking takes one away. -->
      <div class="faces" role="group" aria-label="Resize the selection by one block" data-testid="face-steppers">
        {#each FACES as f (f.name)}
          {@const name = f.name.toLowerCase()}
          <div class="face" role="group" aria-label={`${f.name} face`}>
            <span class="face-name">{f.name}</span>
            <button type="button" class="step" aria-label={`Grow the ${name} face by one block`} title={`${f.name} +1: one more layer on the ${name} side`} data-testid={`face-${name}-grow`} onclick={() => session.stepSelectionFace(f.axis, f.side, true)}>+1</button>
            <button type="button" class="step" aria-label={`Shrink the ${name} face by one block`} title={`${f.name} −1: take one layer off the ${name} side`} data-testid={`face-${name}-shrink`} onclick={() => session.stepSelectionFace(f.axis, f.side, false)}>−1</button>
          </div>
        {/each}
      </div>
      <p class="hint">+1 adds a layer on that side, −1 takes one away. West and East are x, Bottom and Top are y, North and South are z.</p>
    {/if}
    <div class="coords" role="group" aria-label="Selection corners">
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
</div>

<style>
  .panels.touch { display: flex; flex-direction: column; }
  .panels.touch > [data-testid="coords-panel"] { order: 2; }
  h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; margin: 1.2rem 0 0.4rem; color: #5f594f; }
  .size { margin: 0 0 0.3rem; font-weight: 600; }
  .faces { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem 0.6rem; margin: 0.4rem 0; }
  .face { display: grid; grid-template-columns: 1fr 48px 48px; gap: 0.3rem; align-items: center; }
  .face-name { font-size: 0.85rem; font-weight: 600; }
  .step { width: 48px; height: 48px; min-width: 48px; min-height: 48px; padding: 0; font-size: 0.95rem; font-weight: 600; touch-action: manipulation; }
  .coords { display: grid; grid-template-columns: 1rem 1fr 1fr; gap: 0.25rem 0.3rem; align-items: center; }
  .axis { color: #5f594f; font-size: 0.8rem; }
  input[type="number"], input[type="text"] { box-sizing: border-box; min-width: 0; width: 100%; padding: 0.25rem 0.4rem; font: inherit; font-size: 0.85rem; border: 1px solid #c9c3b6; border-radius: 6px; background: #fff; }
  button { background: #2b2925; color: #f4f1eb; border: 0; border-radius: 6px; padding: 0.35rem 0.6rem; cursor: pointer; font: inherit; font-size: 0.85rem; }
  button:disabled { opacity: 0.45; cursor: default; }
  button.small { padding: 0.25rem 0.45rem; background: #e2dccf; color: #2b2925; }
  button.ghost { background: #e2dccf; color: #2b2925; }
  button.link { background: transparent; color: #2b2925; padding: 0; text-decoration: underline; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; margin: 0.5rem 0 0; }
  .replace { margin: 0.5rem 0 0; display: grid; gap: 0.3rem; }
  .move { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; margin: 0.5rem 0 0; }
  .move label { display: inline-flex; gap: 0.2rem; align-items: center; width: 4.4rem; font-size: 0.8rem; color: #5f594f; }
  .nudges { display: inline-flex; gap: 0.2rem; }
  .check { font-size: 0.8rem; display: flex; gap: 0.3rem; align-items: center; color: #5f594f; }
  .hint { color: #5f594f; font-size: 0.8rem; margin: 0.2rem 0 0; }
  code { font-size: 0.75rem; }
</style>
