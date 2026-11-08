// SPDX-License-Identifier: AGPL-3.0-only

// The mobile layout's last settings (MB8): vibration, and the two optional multi-finger shortcuts.
// Each is kept in the browser's storage as the text `true` or `false`; this module only reads that
// text, names the keys and does the vibrating. Nothing here touches the DOM beyond `navigator`, and
// nothing is ever required for the editor to work (storage can be blocked, `vibrate` can be missing).

import type { SessionEvent } from "./changes.ts";

/** Where "Vibrate on edits" is kept. */
export const HAPTICS_KEY = "voxwright.haptics";
/** Where "Two-finger tap undoes" is kept. */
export const TWO_FINGER_UNDO_KEY = "voxwright.twofingerundo";
/** Where "Three-finger tap redoes" is kept. */
export const THREE_FINGER_REDO_KEY = "voxwright.threefingerredo";

/** Vibration on edits is on unless the stored text is exactly "false". */
export const parseHaptics = (stored: string | null | undefined): boolean => stored !== "false";

/** The multi-finger shortcuts are off unless the stored text is exactly "true". */
export const parseTwoFingerUndo = (stored: string | null | undefined): boolean => stored === "true";
export const parseThreeFingerRedo = (stored: string | null | undefined): boolean =>
  stored === "true";

/** Which shortcuts are on. */
export interface MultiTapSettings {
  readonly twoFingerUndo: boolean;
  readonly threeFingerRedo: boolean;
}

/** What a quick tap with two or three fingers does under the given settings. */
export type MultiTapAction = "undo" | "redo" | null;

/** Two fingers undo and three redo, each only when its setting is on; otherwise the tap does nothing. */
export function multiTapAction(fingers: 2 | 3, settings: MultiTapSettings): MultiTapAction {
  if (fingers === 2) return settings.twoFingerUndo ? "undo" : null;
  return settings.threeFingerRedo ? "redo" : null;
}

/** The pulse for each kind of session event, ms: short on a commit, a little longer on a cancel or a refusal. */
export const HAPTIC_MS = { commit: 10, cancel: 20, refuse: 20 } as const;

/** The pulse an event asks for, or `null` (undo and redo are silent: the toast and the picture say so). */
export function hapticFor(event: SessionEvent): number | null {
  switch (event.kind) {
    case "commit":
      return HAPTIC_MS.commit;
    case "cancel":
      return HAPTIC_MS.cancel;
    case "refuse":
      return HAPTIC_MS.refuse;
    default:
      return null;
  }
}

/** The part of `navigator` the vibration needs. */
export interface Vibrator {
  vibrate?: (pattern: number | number[]) => boolean;
}

/**
 * Vibrate for `ms`, if the browser can. Never throws and never needs an answer: a missing method, a
 * browser that refuses (no recent tap) and one that throws are all the same to the caller. Returns
 * whether the browser accepted the pulse.
 */
export function vibrate(ms: number, nav: Vibrator | undefined = globalThis.navigator): boolean {
  try {
    if (nav === undefined || typeof nav.vibrate !== "function") return false;
    return nav.vibrate(ms) === true;
  } catch {
    return false;
  }
}
