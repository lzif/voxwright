<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { makeBox, type Vec3 } from "@voxwright/core";
import { FILL_KEY, ROTATE_KEYS, withoutNbt } from "../editing.ts";
import type { EditSession } from "../editor-session.svelte.ts";
import { FACES } from "../nudge.ts";
import MovePad from "./MovePad.svelte";

// `touch` adds what the mobile layout needs: the face steppers, the move pad in place of the typed
// offsets, buttons of at least 44 px, and the hint worded for taps.
let {
  session,
  touch = false,
  azimuth = 45,
  onpaste,
}: {
  session: EditSession;
  touch?: boolean;
  /** The camera's azimuth in degrees, for the move pad's arrows (touch). */
  azimuth?: number;
  /** Called after Paste arms the paste tool on touch, so the page can close the sheet and free the picture for the tap. */
  onpaste?: () => void;
} = $props();

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
let sec = $state({ corners: true, fill: true, transform: true, move: true, clipboard: true });

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

/** Paste on touch: arm the Paste tool and hand the picture back, so the next tap sets the origin. */
function pasteByTouch(): void {
  session.setTool("paste");
  if (session.tool === "paste") onpaste?.();
}

/** What the sheet says in place of the readout line, which the sheet covers. */
const status = $derived(session.error !== "" ? session.error : session.message);
</script>

{#snippet axisBadge(a: 0 | 1 | 2)}
<span class="ore-num__axis ore-type-ui-strong" data-axis={"xyz"[a]} aria-hidden="true">{"XYZ"[a]}</span>
{/snippet}

{#snippet coordsPanel()}
<section data-testid="coords-panel" aria-labelledby="coords-title" class:ore-pane={!touch} class:ore-pane--floating={!touch} class:stack={touch}>
  {#if touch}
    <h2 id="coords-title" class="ore-type-ui-strong">Block at coordinates</h2>
  {:else}
    <div class="ore-pane__header"><h2 id="coords-title" class="ore-pane__title ore-type-ui">Block at coordinates</h2></div>
  {/if}
  <div class:ore-pane__body={!touch} class="body" class:stack={touch}>
    <div class="move" class:ore-panel={touch}>
      {#each AXES as a}
        <label class="axis-field ore-num ore-type-ui"><span class="ore-num__axis ore-type-ui-strong" data-axis={"xyz"[a]}>{"XYZ"[a]}</span><input type="number" class="ore-num__input ore-type-ui" bind:value={at[a]} data-testid={`at-${"xyz"[a]}`} /></label>
      {/each}
    </div>
    <div class="actions">
      <button class="ore-btn ore-btn--dark ore-type-ui" class:ore-btn--touch={touch} onclick={() => session.placeAt([at[0], at[1], at[2]], session.block)} data-testid="at-set">Set to chosen block</button>
      <button class="ore-btn ore-btn--secondary ore-type-ui" class:ore-btn--touch={touch} onclick={() => session.eraseAt([at[0], at[1], at[2]])} data-testid="at-erase">Erase</button>
    </div>
    <p class="hint ore-type-ui-small">Works with the keyboard alone. {span} The block state panel then shows that block.</p>
  </div>
</section>
{/snippet}

{#snippet sectionHead(id: string, title: string, key: keyof typeof sec)}
  <button
    type="button"
    class="ore-section__head ore-type-ui"
    aria-expanded={sec[key]}
    aria-controls={id}
    onclick={() => (sec[key] = !sec[key])}
  >
    <svg class="ore-icon ore-section__caret" width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" /></svg>
    <span>{title}</span>
  </button>
{/snippet}

{#snippet corners()}
  <div class="coords" role="group" aria-label="Selection corners">
    {#if sel !== null}
      <span class="corner-name ore-type-ui-small">From</span>
      <div class="corner-row">
        {#each AXES as a}
          <span class="ore-num">{@render axisBadge(a)}<input type="number" class="ore-num__input ore-type-ui" value={sel.min[a]} onchange={(e) => setCorner("min", a, e)} aria-label={`From ${"xyz"[a]}`} data-testid={`sel-min-${"xyz"[a]}`} /></span>
        {/each}
      </div>
      <span class="corner-name ore-type-ui-small">To</span>
      <div class="corner-row">
        {#each AXES as a}
          <span class="ore-num">{@render axisBadge(a)}<input type="number" class="ore-num__input ore-type-ui" value={sel.max[a]} onchange={(e) => setCorner("max", a, e)} aria-label={`To ${"xyz"[a]}`} data-testid={`sel-max-${"xyz"[a]}`} /></span>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<!-- On touch the selection comes first: its size, the face steppers and the actions are what the sheet is
     opened for; the typed coordinates come last. They are last in the markup too, not only on screen, so
     the tab order is the reading order. -->
<div class="panels ore-editor" class:touch>
{#if touch}
  <!-- The readout line is under the sheet, so the sheet repeats what it says (the live region is that line). -->
  <p class="status ore-type-ui-small" class:bad={session.error !== ""} aria-hidden="true" hidden={status === ""} data-testid="sheet-message">{status}</p>
{/if}
{#if !touch}
  {@render coordsPanel()}
{/if}

<section data-testid="selection-panel" class:ore-pane={!touch} class:ore-pane--floating={!touch} class:stack={touch}>
  {#if !touch}
    <div class="ore-pane__header"><h2 class="ore-pane__title ore-type-ui">Selection</h2></div>
  {/if}
  <div class:ore-pane__body={!touch} class="body" class:stack={touch}>
  {#if sel === null || size === null}
    {#if touch}
      <p class="hint ore-type-ui-small">Choose the Select tool and tap two blocks, then confirm with the check mark, or select everything.</p>
      <div class="actions grid">
        <button class="ore-btn ore-btn--secondary ore-btn--touch ore-type-ui" onclick={() => session.selectAll()} data-testid="select-all">Select all</button>
      </div>
    {:else}
      <p class="hint ore-type-ui-small">Choose the Select tool and drag from one block to another, or <button class="link ore-type-ui-small" onclick={() => session.selectAll()} data-testid="select-all">select everything</button>.</p>
    {/if}
  {:else}
    <p class="size ore-type-ui" data-testid="selection-size">{size.join(" × ")} blocks</p>
    {#if touch}
      <!-- One block per press, on one face at a time. Growing adds a layer on that side; shrinking takes one away.
           The accessible name starts with the visible text ("+1", "−1"), so a voice command that says what is on the button works (WCAG 2.5.3). -->
      <div class="faces ore-panel" role="group" aria-label="Resize the selection by one block" data-testid="face-steppers">
        {#each FACES as f (f.name)}
          {@const name = f.name.toLowerCase()}
          <div class="face" role="group" aria-label={`${f.name} face`}>
            <span class="face-name ore-type-ui-small">{f.name}</span>
            <button type="button" class="step ore-btn ore-btn--secondary ore-btn--touch ore-type-ui" aria-label={`+1 ${f.name}: grow the ${name} face by one block`} title={`${f.name} +1: one more layer on the ${name} side`} data-testid={`face-${name}-grow`} onclick={() => session.stepSelectionFace(f.axis, f.side, true)}>+1</button>
            <button type="button" class="step ore-btn ore-btn--secondary ore-btn--touch ore-type-ui" aria-label={`−1 ${f.name}: shrink the ${name} face by one block`} title={`${f.name} −1: take one layer off the ${name} side`} data-testid={`face-${name}-shrink`} onclick={() => session.stepSelectionFace(f.axis, f.side, false)}>−1</button>
          </div>
        {/each}
      </div>
      <p class="hint ore-type-ui-small">+1 adds a layer on that side, −1 takes one away. West and East are x, Bottom and Top are y, North and South are z.</p>
    {/if}

    {#if touch}
      <div class="actions">
        <button class="ore-btn ore-btn--dark ore-btn--touch ore-type-ui" title={`Fill the selection with the chosen block (${FILL_KEY.toUpperCase()})`} onclick={() => session.fill()} data-testid="fill">Fill</button>
        <!-- The checkbox as the design draws it: the native input (hidden), the drawn box, the words. -->
        <label class="check ore-choice__row">
          <input type="checkbox" class="ore-choice__input" bind:checked={session.onlyEmpty} />
          <span class="ore-box" aria-hidden="true"><svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="M2 6.5l3 3 5-6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" /></svg></span>
          <span class="ore-choice__text ore-type-ui">only empty cells</span>
        </label>
      </div>

      <div class="replace ore-panel">
        <input type="text" class="ore-input ore-type-ui" placeholder="block to replace" bind:value={from} spellcheck="false" autocomplete="off" aria-label="Block to replace" data-testid="replace-from" />
        <button class="ore-btn ore-btn--secondary ore-btn--touch ore-type-ui" title="Use the block that was last tapped" disabled={session.inspectedBlock === null} onclick={useInspected} data-testid="replace-use">Use inspected block</button>
        <button class="ore-btn ore-btn--dark ore-btn--touch ore-type-ui" onclick={() => session.replace(from)} data-testid="replace">Replace with the chosen block</button>
        <p class="hint ore-type-ui-small">Matches the whole block state, such as <code>minecraft:stone</code> or <code>minecraft:oak_stairs[facing=north,…]</code>.</p>
      </div>

      <div class="actions grid">
        <button class="ore-btn ore-btn--dark ore-btn--touch ore-type-ui" title="Turn the selection a quarter turn anticlockwise ({ROTATE_KEYS.ccw})" onclick={() => session.rotate("COUNTERCLOCKWISE_90")} data-testid="rotate-ccw">Rotate ↺</button>
        <button class="ore-btn ore-btn--dark ore-btn--touch ore-type-ui" title="Turn the selection a quarter turn clockwise ({ROTATE_KEYS.cw})" onclick={() => session.rotate("CLOCKWISE_90")} data-testid="rotate-cw">Rotate ↻</button>
        <button class="ore-btn ore-btn--dark ore-btn--touch ore-type-ui" title="Mirror east to west" onclick={() => session.mirror("x")} data-testid="mirror-x">Mirror E–W</button>
        <button class="ore-btn ore-btn--dark ore-type-ui ore-btn--touch" title="Mirror north to south" onclick={() => session.mirror("z")} data-testid="mirror-z">Mirror N–S</button>
      </div>

      <h3 class="ore-type-ui-strong">Move</h3>
      <MovePad {session} {azimuth} />
      <p class="hint ore-type-ui-small">Each press moves the selected blocks one step and is one undo step. ×8 makes a step eight blocks.</p>

      <div class="actions grid">
        <button class="ore-btn ore-btn--dark ore-btn--touch ore-type-ui" title="Copy the selection" onclick={() => session.copy(true)} data-testid="copy">Copy</button>
        <button class="ore-btn ore-btn--dark ore-btn--touch ore-type-ui" title="Paste the copied blocks where you tap" disabled={session.clipboardCells === 0} onclick={pasteByTouch} data-testid="paste">Paste</button>
        <button class="ore-btn ore-btn--secondary ore-btn--touch ore-type-ui" title="Select every block of the build" onclick={() => session.selectAll()} data-testid="select-all">Select all</button>
        <button class="ore-btn ore-btn--secondary ore-btn--touch ore-type-ui" title="Deselect" onclick={() => session.clearSelection()} data-testid="select-none">Clear</button>
      </div>
      <label class="check ore-choice__row">
        <input type="checkbox" class="ore-choice__input" bind:checked={session.skipAir} />
        <span class="ore-box" aria-hidden="true"><svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="M2 6.5l3 3 5-6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" /></svg></span>
        <span class="ore-choice__text ore-type-ui">leave the target alone where there is air (paste and move)</span>
      </label>

      <h3 class="ore-type-ui-strong">Corners, typed</h3>
      <div class="ore-panel">
        {@render corners()}
      </div>
    {:else}
      <div class="ore-section">
        {@render sectionHead("sel-sec-corners", "Corners", "corners")}
        <div class="ore-section__body" id="sel-sec-corners" hidden={!sec.corners}>
          {@render corners()}
        </div>
      </div>

      <div class="ore-pane__divider" role="separator"></div>

      <div class="ore-section">
        {@render sectionHead("sel-sec-fill", "Fill & replace", "fill")}
        <div class="ore-section__body" id="sel-sec-fill" hidden={!sec.fill}>
          <div class="actions">
            <button class="ore-btn ore-btn--dark ore-type-ui" title={`Fill the selection with the chosen block (${FILL_KEY.toUpperCase()})`} onclick={() => session.fill()} data-testid="fill">Fill</button>
            <!-- The checkbox as the design draws it: the native input (hidden), the drawn box, the words. -->
            <label class="check ore-choice__row">
              <input type="checkbox" class="ore-choice__input" bind:checked={session.onlyEmpty} />
              <span class="ore-box" aria-hidden="true"><svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="M2 6.5l3 3 5-6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" /></svg></span>
              <span class="ore-choice__text ore-type-ui">only empty cells</span>
            </label>
          </div>
          <div class="replace">
            <input type="text" class="ore-input ore-type-ui" placeholder="block to replace" bind:value={from} spellcheck="false" autocomplete="off" aria-label="Block to replace" data-testid="replace-from" />
            <button class="ore-btn ore-btn--secondary ore-type-ui" title="Use the block last pointed at" onclick={useInspected} data-testid="replace-use">Pointed-at</button>
            <button class="ore-btn ore-btn--dark ore-type-ui" onclick={() => session.replace(from)} data-testid="replace">Replace with the chosen block</button>
            <p class="hint ore-type-ui-small">Matches the whole block state, such as <code>minecraft:stone</code> or <code>minecraft:oak_stairs[facing=north,…]</code>.</p>
          </div>
        </div>
      </div>

      <div class="ore-pane__divider" role="separator"></div>

      <div class="ore-section">
        {@render sectionHead("sel-sec-transform", "Transform", "transform")}
        <div class="ore-section__body" id="sel-sec-transform" hidden={!sec.transform}>
          <div class="actions">
            <button class="ore-btn ore-btn--dark ore-type-ui" title="Turn the selection a quarter turn anticlockwise ({ROTATE_KEYS.ccw})" onclick={() => session.rotate("COUNTERCLOCKWISE_90")} data-testid="rotate-ccw">Rotate ↺</button>
            <button class="ore-btn ore-btn--dark ore-type-ui" title="Turn the selection a quarter turn clockwise ({ROTATE_KEYS.cw})" onclick={() => session.rotate("CLOCKWISE_90")} data-testid="rotate-cw">Rotate ↻</button>
            <button class="ore-btn ore-btn--dark ore-type-ui" title="Mirror east to west" onclick={() => session.mirror("x")} data-testid="mirror-x">Mirror E–W</button>
            <button class="ore-btn ore-btn--dark ore-type-ui" title="Mirror north to south" onclick={() => session.mirror("z")} data-testid="mirror-z">Mirror N–S</button>
          </div>
        </div>
      </div>

      <div class="ore-pane__divider" role="separator"></div>

      <div class="ore-section">
        {@render sectionHead("sel-sec-move", "Move", "move")}
        <div class="ore-section__body" id="sel-sec-move" hidden={!sec.move}>
          <div class="move">
            {#each AXES as a}
              <label class="axis-field ore-num ore-type-ui"><span class="ore-num__axis ore-type-ui-strong" data-axis={"xyz"[a]}>{"XYZ"[a]}</span><input type="number" class="ore-num__input ore-type-ui" bind:value={delta[a]} aria-label={`Move along ${"xyz"[a]}`} data-testid={`move-${"xyz"[a]}`} /></label>
            {/each}
            <button class="ore-btn ore-btn--dark ore-type-ui" onclick={() => session.move([delta[0], delta[1], delta[2]])} data-testid="move">Move</button>
            <span class="nudges">
              <button class="small ore-btn ore-btn--secondary ore-type-ui" title="Up one block" onclick={() => nudge(1, 1)}>↑</button>
              <button class="small ore-btn ore-btn--secondary ore-type-ui" title="Down one block" onclick={() => nudge(1, -1)}>↓</button>
            </span>
          </div>
        </div>
      </div>

      <div class="ore-pane__divider" role="separator"></div>

      <div class="ore-section">
        {@render sectionHead("sel-sec-clipboard", "Clipboard", "clipboard")}
        <div class="ore-section__body" id="sel-sec-clipboard" hidden={!sec.clipboard}>
          <div class="actions">
            <button class="ore-btn ore-btn--dark ore-type-ui" title="Copy the selection (Ctrl+C)" onclick={() => session.copy()} data-testid="copy">Copy</button>
            <button class="ore-btn ore-btn--dark ore-type-ui" title="Paste the copied blocks where you click (Ctrl+V)" disabled={session.clipboardCells === 0} onclick={() => session.setTool("paste")} data-testid="paste">Paste</button>
            <button class="ore-btn ore-btn--secondary ore-type-ui" title="Deselect (Esc)" onclick={() => session.clearSelection()} data-testid="select-none">Clear</button>
          </div>
          <label class="check ore-choice__row">
            <input type="checkbox" class="ore-choice__input" bind:checked={session.skipAir} />
            <span class="ore-box" aria-hidden="true"><svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="M2 6.5l3 3 5-6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" /></svg></span>
            <span class="ore-choice__text ore-type-ui">leave the target alone where there is air (paste and move)</span>
          </label>
        </div>
      </div>
    {/if}
  {/if}
  {#if sel === null && session.clipboardCells > 0}
    <div class="actions">
      <button class="ore-btn ore-btn--dark ore-type-ui" class:ore-btn--touch={touch} title={touch ? "Paste the copied blocks where you tap" : "Paste the copied blocks where you click (Ctrl+V)"} onclick={touch ? pasteByTouch : () => session.setTool("paste")} data-testid="paste">Paste {session.clipboardCells} blocks</button>
    </div>
  {/if}
  </div>
</section>

{#if touch}
  {@render coordsPanel()}
{/if}
</div>

<style>
  /* The design's classes (ore-pane, ore-btn, ore-num, ore-input, ore-choice__row, ore-box) come from the
     page's stylesheet; what is below places them and states what the design has no class for. On desktop
     each section is an editor pane: a sunken header bar, then its body, whose children are 8 px apart
     (ore-pane__body does that). On touch the sheet is the pane, so a section keeps a rhythm itself
     (.stack) and the groups that need one are tiles. */
  .panels { min-width: 0; }
  .panels.touch { display: flex; flex-direction: column; }
  .panels > section + section { margin-top: var(--space-6); }
  .stack > * + * { margin-top: var(--space-4); }
  .body.stack > * + * { margin-top: var(--space-4); }
  .ore-section__body[hidden] { display: none; }

  h3, .touch h2 { margin: 0; padding-top: var(--space-3); border-top: 2px solid var(--panel-hi); color: var(--ink); }
  .size { margin: 0; color: var(--ink); }
  .hint { margin: var(--space-2) 0 0; color: var(--ink-muted); }
  code { font-family: var(--font-mono); font-size: var(--type-ui-small-size); color: var(--ink); overflow-wrap: anywhere; }
  .link { display: inline; min-height: 0; margin: 0; padding: 0; background: transparent; color: var(--ink); border: 0; border-radius: var(--radius-none); text-decoration: underline; cursor: pointer; }
  .link:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .small { min-width: 44px; }
  .panels .small { padding: 0; }
  .nudges { display: inline-flex; gap: var(--space-2); }

  /* From and To, each a row of x, y and z with the axis letter in its badge. */
  .coords { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-1); }
  .coords > * { margin: 0; }
  .corner-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-1); }
  .corner-name { color: var(--ink-muted); }
  .ore-input { min-width: 0; }

  /* x, y and z one under the other, because the panel is narrow; Move and the two nudges share the row after them. */
  .move { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-2); align-items: center; }
  .move > * { margin: 0; }
  .axis-field { grid-column: 1 / -1; color: var(--ink); }
  .replace { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-2); }
  .replace > * { margin: 0; }
  .replace .hint { margin: 0; }

  /* The design's checkbox row; the words may wrap. */
  .check { display: flex; min-width: 0; color: var(--ink); }
  .check .ore-choice__text { min-width: 0; }
  /* the box draws the ring (ore-ui.css), so the hidden input draws none */
  .check .ore-choice__input:focus-visible { outline: none; }

  /* Touch: every control at least 44 px, the main actions 48 px (ore-btn--touch), and the actions in two columns. */
  /* top -12px: a sticky offset counts from the content box, so this is flush with the top of the scrolling sheet (its padding is 12px) and nothing scrolls past above it */
  .status { position: sticky; top: -12px; z-index: 1; margin: 0 0 var(--space-3); padding: var(--space-2) var(--space-3); background: var(--surface-panel); color: var(--ink); }
  .status.bad { background: var(--yellow); color: var(--ink-dark); }
  .status[hidden] { display: none; }
  .touch .ore-btn { touch-action: manipulation; }
  .touch .actions.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .touch .actions.grid .ore-btn { width: 100%; }
  .touch .replace .ore-btn { width: 100%; }
  /* tiles on the sheet: a group with its own surface */
  .touch .ore-panel { padding: var(--space-3); }
  .touch .ore-panel .coords { gap: var(--space-2); }
  .faces { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
  .faces > * { margin: 0; }
  .face { display: grid; grid-template-columns: minmax(0, 1fr) 48px 48px; gap: var(--space-1); align-items: center; }
  .face-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
  .panels .step { min-width: 48px; padding: 0; }
  .touch .check { min-height: 44px; }
</style>
