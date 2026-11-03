// SPDX-License-Identifier: AGPL-3.0-only

import type { Volume } from "../volume/index.ts";
import {
  applyCommand,
  type Command,
  isEmptyCommand,
  mergeCommands,
  revertCommand,
} from "./command.ts";
import { DirtyTracker } from "./dirty.ts";
import { History, type HistoryOptions } from "./history.ts";
import type { Clipboard } from "./selection.ts";

/**
 * One drag as one undo step. Commands run through {@link Stroke.apply} take
 * effect at once, so the user sees them; {@link Stroke.commit} turns them
 * into a single history entry and {@link Stroke.cancel} takes them back.
 */
export class Stroke {
  private readonly applied: Command[] = [];
  private open = true;

  private readonly editor: Editor;
  readonly label: string;

  constructor(editor: Editor, label: string) {
    this.editor = editor;
    this.label = label;
  }

  /** Apply a tool's command now. Build each one from the editor's current volume. */
  apply(command: Command): void {
    this.assertOpen();
    if (isEmptyCommand(command)) return;
    applyCommand(this.editor.volume, command);
    this.editor.dirty.markCommand(command);
    this.applied.push(command);
  }

  /** End the stroke and record it as one history entry. Returns false if it changed nothing. */
  commit(): boolean {
    this.assertOpen();
    this.open = false;
    const merged = mergeCommands(this.label, this.applied);
    if (isEmptyCommand(merged)) return false;
    this.editor.history.push(merged);
    return true;
  }

  /** End the stroke and undo everything it did. */
  cancel(): void {
    this.assertOpen();
    this.open = false;
    for (let i = this.applied.length - 1; i >= 0; i--) {
      const c = this.applied[i] as Command;
      revertCommand(this.editor.volume, c);
      this.editor.dirty.markCommand(c);
    }
  }

  private assertOpen(): void {
    if (!this.open) throw new Error("stroke is already finished");
  }
}

/**
 * A volume being edited, with its history, dirty sections and clipboard.
 * The editor works on the Volume it is given and never touches the file it
 * came from; export is a separate step.
 */
export class Editor {
  readonly history: History;
  readonly dirty = new DirtyTracker();
  clipboard: Clipboard | null = null;

  readonly volume: Volume;

  constructor(volume: Volume, options: HistoryOptions = {}) {
    this.volume = volume;
    this.history = new History(options);
  }

  /** Apply a command, record it for undo and mark its sections dirty. Returns false if it was empty. */
  run(command: Command): boolean {
    if (isEmptyCommand(command)) return false;
    applyCommand(this.volume, command);
    this.dirty.markCommand(command);
    this.history.push(command);
    return true;
  }

  /** Begin a drag; see {@link Stroke}. */
  beginStroke(label: string): Stroke {
    return new Stroke(this, label);
  }

  undo(): boolean {
    const c = this.history.undo(this.volume);
    if (c === null) return false;
    this.dirty.markCommand(c);
    return true;
  }

  redo(): boolean {
    const c = this.history.redo(this.volume);
    if (c === null) return false;
    this.dirty.markCommand(c);
    return true;
  }
}
