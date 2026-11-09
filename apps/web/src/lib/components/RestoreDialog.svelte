<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import type { Snapshot } from "../snapshot.ts";

let {
  offer,
  busy,
  error,
  onrestore,
  ondiscard,
}: {
  offer: Snapshot | "damaged" | null;
  busy: boolean;
  error: string;
  onrestore: () => void;
  ondiscard: () => void;
} = $props();

let dialog: HTMLDialogElement;

// A modal dialog: the page behind it is inert and the focus stays inside until the user decides.
$effect(() => {
  if (offer !== null && !dialog.open) dialog.showModal();
  else if (offer === null && dialog.open) dialog.close();
});

const snap = $derived(offer === null || offer === "damaged" ? null : offer);
</script>

<!-- The design's dialog on the native <dialog>: header, body in prose, footer with the buttons stacked,
     main action first. Restoring is the offer, so Restore is the primary button and Discard the quieter
     one (it is not the dialog's own verb, so not the red destructive button); a damaged session can only
     be discarded, and then Discard is the main action. -->
<dialog
  bind:this={dialog}
  class="ore-dialog"
  aria-labelledby="restore-title"
  aria-describedby="restore-body"
  oncancel={(e) => e.preventDefault()}
  data-testid="restore-dialog"
>
  <div class="ore-dialog__header">
    <h2 id="restore-title" class="ore-dialog__title ore-type-heading">Restore your unsaved work?</h2>
  </div>
  <div id="restore-body" class="ore-dialog__body ore-type-prose">
    {#if snap}
      <p>
        An earlier visit left edits that were never exported:
      </p>
      <dl>
        <dt class="ore-type-caption">File</dt><dd class="ore-type-body" data-testid="restore-name">{snap.name}</dd>
        <dt class="ore-type-caption">Saved</dt><dd class="ore-type-body" data-testid="restore-time">{new Date(snap.savedAt).toLocaleString()}</dd>
        <dt class="ore-type-caption">Edits</dt><dd class="ore-type-body" data-testid="restore-edits">{snap.edits}</dd>
      </dl>
      <p>Undo history is not kept: after a restore you can export or keep editing, but you cannot undo the edits you are getting back. The file you opened is never changed.</p>
    {:else}
      <p>A saved session was found, but it cannot be read. It can only be discarded.</p>
    {/if}
    {#if error}<p class="ore-field__error ore-type-caption" role="alert" data-testid="restore-error">{error}</p>{/if}
  </div>
  <div class="ore-dialog__footer">
    {#if snap}<button type="button" class="ore-btn ore-btn--primary ore-type-label" onclick={onrestore} disabled={busy} data-testid="restore">Restore</button>{/if}
    <button type="button" class={["ore-btn", snap ? "ore-btn--secondary" : "ore-btn--primary", "ore-type-label"]} onclick={ondiscard} disabled={busy} data-testid="discard">Discard</button>
  </div>
</dialog>

<style>
  /* .ore-dialog sets display, position and width for a plain <div>; on the native element it must keep the
     browser's open and closed states and its place in the top layer. The scrim is the design's. */
  dialog { position: fixed; inset: 0; margin: auto; padding: 0; width: calc(100% - 2 * var(--space-4)); height: fit-content; max-height: calc(100dvh - 2 * var(--space-4)); overflow: auto; }
  dialog:not([open]) { display: none; }
  dialog::backdrop { background: var(--outline); opacity: 0.7; }
  p { margin: var(--space-2) 0; }
  dl { display: grid; grid-template-columns: 4rem 1fr; gap: var(--space-1) var(--space-3); margin: var(--space-2) 0; align-items: baseline; }
  dt { color: var(--ink-muted); }
  dd { margin: 0; overflow-wrap: anywhere; }
</style>
