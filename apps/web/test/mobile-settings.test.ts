// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  HAPTIC_MS,
  HAPTICS_KEY,
  hapticFor,
  multiTapAction,
  parseHaptics,
  parseThreeFingerRedo,
  parseTwoFingerUndo,
  THREE_FINGER_REDO_KEY,
  TWO_FINGER_UNDO_KEY,
  vibrate,
} from "../src/lib/mobile-settings.ts";

describe("the stored settings", () => {
  it("name their keys", () => {
    expect(HAPTICS_KEY).toBe("voxwright.haptics");
    expect(TWO_FINGER_UNDO_KEY).toBe("voxwright.twofingerundo");
    expect(THREE_FINGER_REDO_KEY).toBe("voxwright.threefingerredo");
  });

  it("vibration is on unless the text is exactly false", () => {
    expect(parseHaptics(null)).toBe(true);
    expect(parseHaptics(undefined)).toBe(true);
    expect(parseHaptics("true")).toBe(true);
    expect(parseHaptics("")).toBe(true);
    expect(parseHaptics("nonsense")).toBe(true);
    expect(parseHaptics("false")).toBe(false);
    expect(parseHaptics("False")).toBe(true);
  });

  it("the multi-finger shortcuts are off unless the text is exactly true", () => {
    for (const parse of [parseTwoFingerUndo, parseThreeFingerRedo]) {
      expect(parse(null)).toBe(false);
      expect(parse(undefined)).toBe(false);
      expect(parse("")).toBe(false);
      expect(parse("false")).toBe(false);
      expect(parse("1")).toBe(false);
      expect(parse("TRUE")).toBe(false);
      expect(parse("true")).toBe(true);
    }
  });
});

describe("multiTapAction", () => {
  const off = { twoFingerUndo: false, threeFingerRedo: false };

  it("does nothing by default", () => {
    expect(multiTapAction(2, off)).toBeNull();
    expect(multiTapAction(3, off)).toBeNull();
  });

  it("two fingers undo only with the two-finger setting", () => {
    expect(multiTapAction(2, { ...off, twoFingerUndo: true })).toBe("undo");
    expect(multiTapAction(2, { ...off, threeFingerRedo: true })).toBeNull();
  });

  it("three fingers redo only with the three-finger setting", () => {
    expect(multiTapAction(3, { ...off, threeFingerRedo: true })).toBe("redo");
    expect(multiTapAction(3, { ...off, twoFingerUndo: true })).toBeNull();
  });

  it("each setting acts alone and together they do not mix the fingers up", () => {
    const both = { twoFingerUndo: true, threeFingerRedo: true };
    expect(multiTapAction(2, both)).toBe("undo");
    expect(multiTapAction(3, both)).toBe("redo");
  });
});

describe("hapticFor", () => {
  const change = { id: 1, label: "place", count: 1, text: "Placed 1 block" };

  it("a short pulse for a commit and a longer one for a cancel or a refusal", () => {
    expect(hapticFor({ kind: "commit", change })).toBe(10);
    expect(hapticFor({ kind: "cancel" })).toBe(20);
    expect(hapticFor({ kind: "refuse" })).toBe(20);
    expect(HAPTIC_MS.commit).toBeLessThan(HAPTIC_MS.cancel);
  });

  it("undo and redo are silent", () => {
    expect(hapticFor({ kind: "undo" })).toBeNull();
    expect(hapticFor({ kind: "redo" })).toBeNull();
  });
});

describe("vibrate", () => {
  it("calls the browser's method with the pulse and reports what it answered", () => {
    const calls: unknown[] = [];
    const nav = {
      vibrate(p: number | number[]) {
        calls.push(p);
        return true;
      },
    };
    expect(vibrate(10, nav)).toBe(true);
    expect(calls).toEqual([10]);
  });

  it("keeps the method's own this, as the browser requires", () => {
    const nav = {
      tag: "navigator",
      vibrate(this: { tag: string }) {
        return this.tag === "navigator";
      },
    };
    expect(vibrate(10, nav)).toBe(true);
  });

  it("is false and quiet when the browser has no vibrate", () => {
    expect(vibrate(10, {})).toBe(false);
    expect(vibrate(10, undefined)).toBe(false);
  });

  it("is false when the browser refuses", () => {
    expect(vibrate(10, { vibrate: () => false })).toBe(false);
  });

  it("never throws, whatever the browser does", () => {
    const nav = {
      vibrate() {
        throw new Error("blocked: no recent tap");
      },
    };
    expect(() => vibrate(10, nav)).not.toThrow();
    expect(vibrate(10, nav)).toBe(false);
  });
});
