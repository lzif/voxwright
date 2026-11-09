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
  class:ore-notice={shown !== null}
  class:ore-notice--info={shown !== null}
  class:left-handed={leftHanded}
  data-testid="undo-toast"
  data-shown={shown !== null}
>
  <span class="toast-text ore-type-label" role="status" data-testid="undo-toast-text">{shown?.text ?? ""}</span>
  {#if shown}
    <button
      type="button"
      class="toast-undo ore-btn ore-btn--secondary ore-type-label"
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
    gap: var(--space-1);
    max-width: 100%;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .toast.left-handed {
    flex-direction: row-reverse;
  }

  /* While a toast shows it is the design's info notice (blue, white text, outlined, square), with the
     message left-aligned and the Undo button, a secondary one, at the end. */
  .toast.shown {
    pointer-events: auto;
    justify-content: flex-start;
    padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
    text-align: left;
  }

  .toast.shown.left-handed {
    padding: var(--space-1) var(--space-3) var(--space-1) var(--space-1);
  }

  .toast-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toast-undo {
    flex: 0 0 auto;
    min-width: 64px;
    min-height: 48px;
    touch-action: manipulation;
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
