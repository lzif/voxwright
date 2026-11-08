<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { TOAST_MS } from "../changes.ts";
import type { EditSession } from "../editor-session.svelte.ts";

// "Placed 12 blocks · Undo", for about four seconds after every edit that adds an undo step. The
// Undo takes back exactly that step and only while it is still the newest: once anything else was
// undone, redone or edited, the session's `lastChange` is another one (or none) and the button is
// gone. It sits under the top bar, away from the thumb cluster, the nudge pad, the readout line and
// the toolbar at the bottom, and it mirrors with the left-handed setting. The words are in a status
// region that is always in the page, so a screen reader announces each new one without taking the
// focus.

let {
  session,
  leftHanded = false,
  duration = TOAST_MS,
}: {
  session: EditSession;
  leftHanded?: boolean;
  /** How long a toast stays, ms. */
  duration?: number;
} = $props();

/** The id of the change whose toast was dismissed by the clock; a newer change shows again. */
let expiredId = $state(0);

const change = $derived(session.lastChange);
const shown = $derived(change !== null && change.id !== expiredId ? change : null);

$effect(() => {
  const c = session.lastChange;
  if (c === null) return;
  const timer = window.setTimeout(() => {
    expiredId = c.id;
  }, duration);
  return () => window.clearTimeout(timer);
});
</script>

<div
  class="toast"
  class:shown={shown !== null}
  class:left-handed={leftHanded}
  data-testid="undo-toast"
  data-shown={shown !== null}
>
  <span class="toast-text" role="status" data-testid="undo-toast-text">{shown?.text ?? ""}</span>
  {#if shown}
    <button
      type="button"
      class="toast-undo"
      aria-label="Undo"
      title={`Undo: ${shown.text}`}
      onclick={() => session.undoChange(shown.id)}
      data-testid="undo-toast-undo"
    >Undo</button>
  {/if}
</div>

<style>
  .toast {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .toast.left-handed {
    flex-direction: row-reverse;
  }

  .toast.shown {
    pointer-events: auto;
    padding: 4px 4px 4px 14px;
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: #2b2925;
    color: #f4f1eb;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  }

  .toast.shown.left-handed {
    padding: 4px 14px 4px 4px;
  }

  .toast-text {
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toast-undo {
    flex: 0 0 auto;
    min-width: 64px;
    min-height: 48px;
    padding: 0 16px;
    border: 0;
    border-radius: 24px;
    background: #f4f1eb;
    color: #24221f;
    font: inherit;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
  }

  .toast-undo:active {
    filter: brightness(0.9);
  }

  /* A short slide-in, only for people who have not asked for less motion. */
  @media (prefers-reduced-motion: no-preference) {
    .toast.shown {
      animation: toast-in 160ms ease-out;
    }
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
