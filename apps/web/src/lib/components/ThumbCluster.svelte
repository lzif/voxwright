<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import type { EditSession } from "../editor-session.svelte.ts";

let {
  session,
  leftHanded = false,
  canConfirm,
  canCancel,
  onconfirm,
  oncancel,
}: {
  session: EditSession;
  leftHanded?: boolean;
  /** Is something pending that Confirm would run? */
  canConfirm: boolean;
  /** Is something pending that Cancel would drop? */
  canCancel: boolean;
  onconfirm: () => void;
  oncancel: () => void;
} = $props();
</script>

<div
  class="thumb-cluster"
  class:left-handed={leftHanded}
  role="group"
  aria-label="Floating thumb action controls"
  data-testid="thumb-cluster"
>
  <button
    type="button"
    class="cluster-btn undo-btn ore-btn ore-btn--secondary ore-type-title"
    disabled={!session.canUndo}
    onclick={() => session.undo()}
    aria-label="Undo"
    title="Undo"
    data-testid="undo"
  >
    <span class="btn-icon" data-testid="thumb-undo">↶</span>
  </button>

  <button
    type="button"
    class="cluster-btn redo-btn ore-btn ore-btn--secondary ore-type-title"
    disabled={!session.canRedo}
    onclick={() => session.redo()}
    aria-label="Redo"
    title="Redo"
    data-testid="redo"
  >
    <span class="btn-icon" data-testid="thumb-redo">↷</span>
  </button>

  <button
    type="button"
    class="cluster-btn cancel-btn ore-btn ore-btn--secondary ore-type-title"
    disabled={!canCancel}
    onclick={oncancel}
    aria-label="Cancel"
    title="Cancel"
    data-testid="cancel"
  >
    <span class="btn-icon" data-testid="thumb-cancel">✕</span>
  </button>

  <button
    type="button"
    class="cluster-btn confirm-btn ore-btn ore-btn--primary ore-type-title"
    disabled={!canConfirm}
    onclick={onconfirm}
    aria-label="Confirm"
    title="Confirm"
    data-testid="confirm"
  >
    <span class="btn-icon" data-testid="thumb-confirm">✓</span>
  </button>
</div>

<style>
  .thumb-cluster {
    position: fixed;
    z-index: 35;
    /* Clear of the readout line (28 px, or 44 px while it holds the Edit state chip) and the toolbar below (56 px) and a border, so neither is covered. */
    bottom: calc(108px + env(safe-area-inset-bottom, 0px));
    right: calc(12px + env(safe-area-inset-right, 0px));
    display: grid;
    grid-template-columns: repeat(2, 48px);
    grid-auto-rows: 48px;
    gap: var(--space-2);
    user-select: none;
    -webkit-user-select: none;
  }

  .thumb-cluster.left-handed {
    right: auto;
    left: calc(12px + env(safe-area-inset-left, 0px));
  }

  /* Secondary (light) for Undo, Redo and Cancel (Cancel changes nothing, so it is not destructive),
     primary (green) for Confirm, all from .ore-btn. The cell is 48 px; the button fills it, and
     .ore-btn's pressed state lowers the face by 4 px inside it. */
  .cluster-btn {
    width: 48px;
    min-width: 48px;
    min-height: 48px;
    padding-left: 0;
    padding-right: 0;
    touch-action: manipulation;
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
</style>
