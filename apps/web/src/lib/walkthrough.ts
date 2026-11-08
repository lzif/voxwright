// SPDX-License-Identifier: AGPL-3.0-only

// The first-run walkthrough of the mobile editor: three steps that tick themselves as the user does
// them (place something, undo it, export). Which steps are done and when the card shows is decided
// here, as plain values, so it runs under Vitest; the card itself is `TouchIntro.svelte`.

/** Where the walkthrough's "seen" mark is kept in the browser. Not set: the user has not seen it. */
export const TOUCH_INTRO_KEY = "voxwright.touchintro";
/** What is stored once the card was closed or finished. */
export const TOUCH_INTRO_SEEN = "done";

export type IntroStep = "edit" | "undo" | "export";

export interface IntroStepInfo {
  readonly id: IntroStep;
  /** What the card says. */
  readonly text: string;
}

export const INTRO_STEPS: readonly IntroStepInfo[] = [
  { id: "edit", text: "Choose Place and tap the picture" },
  { id: "undo", text: "Tap Undo" },
  { id: "export", text: "Open Menu and Export" },
];

/** Which steps are done. */
export type IntroProgress = Readonly<Record<IntroStep, boolean>>;

export const FRESH_INTRO: IntroProgress = { edit: false, undo: false, export: false };

/** What the user did that a step waits for. */
export type IntroEvent = "edit" | "undo" | "export";

/** The progress after `event`. Each step ticks on its own event, in any order, and stays ticked. */
export function advanceIntro(progress: IntroProgress, event: IntroEvent): IntroProgress {
  if (progress[event]) return progress;
  return { ...progress, [event]: true };
}

/** Are all three steps done? */
export const introComplete = (progress: IntroProgress): boolean =>
  INTRO_STEPS.every((s) => progress[s.id]);

/** How many steps are done, for "2 of 3". */
export const introDoneCount = (progress: IntroProgress): number =>
  INTRO_STEPS.filter((s) => progress[s.id]).length;

/** Should the walkthrough show for a browser that stored this? Only a missing value (the first visit) shows it. */
export const shouldShowIntro = (stored: string | null | undefined): boolean =>
  stored === null || stored === undefined;

/** How long the finished card stays, so the last tick is seen, ms. */
export const INTRO_FINISH_MS = 1400;
