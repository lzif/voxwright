<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import type { EditSession } from "../editor-session.svelte.ts";

let {
  session,
  leftHanded = false,
  canConfirm = false,
  onconfirm,
  oncancel,
}: {
  session: EditSession;
  leftHanded?: boolean;
  canConfirm?: boolean;
  onconfirm?: () => void;
  oncancel?: () => void;
} = $props();

interface ModalSession {
  confirm?(): void;
  cancel?(): void;
}

function handleConfirm(): void {
  if (onconfirm) {
    onconfirm();
  } else {
    const s = session as unknown as ModalSession;
    if (typeof s.confirm === "function") {
      s.confirm();
    }
  }
}

function handleCancel(): void {
  if (oncancel) {
    oncancel();
  } else {
    const s = session as unknown as ModalSession;
    if (typeof s.cancel === "function") {
      s.cancel();
    } else {
      session.clearSelection();
    }
  }
}
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
    class="cluster-btn undo-btn"
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
    class="cluster-btn redo-btn"
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
    class="cluster-btn cancel-btn"
    onclick={handleCancel}
    aria-label="Cancel"
    title="Cancel"
    data-testid="cancel"
  >
    <span class="btn-icon" data-testid="thumb-cancel">✕</span>
  </button>

  <button
    type="button"
    class="cluster-btn confirm-btn"
    disabled={!canConfirm}
    onclick={handleConfirm}
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
    bottom: calc(64px + env(safe-area-inset-bottom, 0px));
    right: calc(12px + env(safe-area-inset-right, 0px));
    display: grid;
    grid-template-columns: repeat(2, 48px);
    gap: 8px;
    user-select: none;
    -webkit-user-select: none;
  }

  .thumb-cluster.left-handed {
    right: auto;
    left: calc(12px + env(safe-area-inset-left, 0px));
  }

  .cluster-btn {
    width: 48px;
    height: 48px;
    min-width: 48px;
    min-height: 48px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: #2b2925;
    color: #f4f1eb;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    cursor: pointer;
    touch-action: manipulation;
    padding: 0;
    transition: transform 0.1s ease, background 0.15s ease;
  }

  .cluster-btn:active {
    transform: scale(0.92);
  }

  .cluster-btn:disabled {
    opacity: 0.35;
    cursor: default;
    box-shadow: none;
  }

  .cancel-btn {
    background: #7a1f16;
    color: #ffffff;
  }

  .confirm-btn {
    background: #2e6930;
    color: #ffffff;
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
</style>
