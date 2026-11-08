// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  advanceIntro,
  FRESH_INTRO,
  INTRO_STEPS,
  introComplete,
  introDoneCount,
  shouldShowIntro,
  TOUCH_INTRO_KEY,
  TOUCH_INTRO_SEEN,
} from "../src/lib/walkthrough.ts";

describe("the walkthrough's steps", () => {
  it("are the three of the brief, in order", () => {
    expect(INTRO_STEPS.map((s) => s.text)).toEqual([
      "Choose Place and tap the picture",
      "Tap Undo",
      "Open Menu and Export",
    ]);
    expect(INTRO_STEPS.map((s) => s.id)).toEqual(["edit", "undo", "export"]);
  });

  it("start undone", () => {
    expect(FRESH_INTRO).toEqual({ edit: false, undo: false, export: false });
    expect(introComplete(FRESH_INTRO)).toBe(false);
    expect(introDoneCount(FRESH_INTRO)).toBe(0);
  });
});

describe("advanceIntro", () => {
  it("ticks the step of the event and leaves the others", () => {
    const a = advanceIntro(FRESH_INTRO, "edit");
    expect(a).toEqual({ edit: true, undo: false, export: false });
    expect(introDoneCount(a)).toBe(1);
    expect(advanceIntro(a, "undo")).toEqual({ edit: true, undo: true, export: false });
  });

  it("does not change the input and returns it when the step was already done", () => {
    const a = advanceIntro(FRESH_INTRO, "edit");
    expect(FRESH_INTRO.edit).toBe(false);
    expect(advanceIntro(a, "edit")).toBe(a);
  });

  it("takes the steps in any order, and is complete only when all three are done", () => {
    let p = advanceIntro(FRESH_INTRO, "export");
    expect(introComplete(p)).toBe(false);
    p = advanceIntro(p, "edit");
    expect(introComplete(p)).toBe(false);
    p = advanceIntro(p, "undo");
    expect(introComplete(p)).toBe(true);
    expect(introDoneCount(p)).toBe(3);
  });
});

describe("shouldShowIntro", () => {
  it("shows only when nothing is stored", () => {
    expect(shouldShowIntro(null)).toBe(true);
    expect(shouldShowIntro(undefined)).toBe(true);
    expect(shouldShowIntro(TOUCH_INTRO_SEEN)).toBe(false);
    expect(shouldShowIntro("")).toBe(false);
    expect(shouldShowIntro("anything")).toBe(false);
  });

  it("is kept under its own key", () => {
    expect(TOUCH_INTRO_KEY).toBe("voxwright.touchintro");
  });
});
