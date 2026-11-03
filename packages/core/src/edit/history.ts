// SPDX-License-Identifier: AGPL-3.0-only

import type { Volume } from "../volume/index.ts";
import { applyCommand, type Command, commandBytes, revertCommand } from "./command.ts";

export interface HistoryOptions {
  /** Memory budget for the stored commands, in bytes. Default 64 MiB. */
  maxBytes?: number;
}

export const DEFAULT_HISTORY_BYTES = 64 * 1024 * 1024;

/**
 * Undo and redo stacks, unlimited by count and capped by memory. When a push
 * takes the total past the budget, the oldest undo entries are dropped. The
 * newest command is always kept, even if it alone is over budget, so the
 * last edit can always be undone.
 */
export class History {
  readonly maxBytes: number;
  private undoStack: { command: Command; bytes: number }[] = [];
  private redoStack: { command: Command; bytes: number }[] = [];
  private total = 0;

  constructor(options: HistoryOptions = {}) {
    this.maxBytes = options.maxBytes ?? DEFAULT_HISTORY_BYTES;
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  /** Bytes held by both stacks. */
  get bytes(): number {
    return this.total;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Labels of the undo stack, oldest first. */
  get undoLabels(): string[] {
    return this.undoStack.map((e) => e.command.label);
  }

  /**
   * Record a command that has already been applied. Clears the redo stack.
   * Returns how many old entries were dropped to stay in budget.
   */
  push(command: Command): number {
    for (const e of this.redoStack) this.total -= e.bytes;
    this.redoStack = [];
    const bytes = commandBytes(command);
    this.undoStack.push({ command, bytes });
    this.total += bytes;
    let drop = 0;
    while (this.total > this.maxBytes && drop < this.undoStack.length - 1) {
      this.total -= (this.undoStack[drop] as { bytes: number }).bytes;
      drop++;
    }
    if (drop > 0) this.undoStack.splice(0, drop);
    return drop;
  }

  /** Revert the latest command on `volume`. Returns it, or `null` if there is nothing to undo. */
  undo(volume: Volume): Command | null {
    const entry = this.undoStack.pop();
    if (entry === undefined) return null;
    revertCommand(volume, entry.command);
    this.redoStack.push(entry);
    return entry.command;
  }

  /** Re-apply the latest undone command. Returns it, or `null` if there is nothing to redo. */
  redo(volume: Volume): Command | null {
    const entry = this.redoStack.pop();
    if (entry === undefined) return null;
    applyCommand(volume, entry.command);
    this.undoStack.push(entry);
    return entry.command;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.total = 0;
  }
}
