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

<dialog
  bind:this={dialog}
  aria-labelledby="restore-title"
  aria-describedby="restore-body"
  oncancel={(e) => e.preventDefault()}
  data-testid="restore-dialog"
>
  <h2 id="restore-title">Restore your unsaved work?</h2>
  <div id="restore-body">
    {#if snap}
      <p>
        An earlier visit left edits that were never exported:
      </p>
      <dl>
        <dt>File</dt><dd data-testid="restore-name">{snap.name}</dd>
        <dt>Saved</dt><dd data-testid="restore-time">{new Date(snap.savedAt).toLocaleString()}</dd>
        <dt>Edits</dt><dd data-testid="restore-edits">{snap.edits}</dd>
      </dl>
      <p>Undo history is not kept: after a restore you can export or keep editing, but you cannot undo the edits you are getting back. The file you opened is never changed.</p>
    {:else}
      <p>A saved session was found, but it cannot be read. It can only be discarded.</p>
    {/if}
    {#if error}<p class="bad" role="alert" data-testid="restore-error">{error}</p>{/if}
  </div>
  <div class="actions">
    {#if snap}<button onclick={onrestore} disabled={busy} data-testid="restore">Restore</button>{/if}
    <button class="ghost" onclick={ondiscard} disabled={busy} data-testid="discard">Discard</button>
  </div>
</dialog>

<style>
  dialog { max-width: 30rem; border: 1px solid #c9c3b6; border-radius: 10px; background: #fffdf8; color: #2b2925; padding: 1.2rem 1.4rem; }
  dialog::backdrop { background: rgb(43 41 37 / 0.55); }
  h2 { margin: 0 0 0.6rem; font-size: 1.15rem; }
  p { margin: 0.4rem 0; }
  dl { display: grid; grid-template-columns: 4rem 1fr; gap: 0.2rem 0.6rem; margin: 0.4rem 0; }
  dt { color: #4d483f; }
  dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
  .actions { display: flex; gap: 0.5rem; margin-top: 0.9rem; }
  button { background: #2b2925; color: #f4f1eb; border: 0; border-radius: 6px; padding: 0.5rem 0.9rem; cursor: pointer; font: inherit; }
  button.ghost { background: #e2dccf; color: #2b2925; }
  button:disabled { opacity: 0.6; cursor: default; }
  .bad { color: #7a1f16; }
</style>
