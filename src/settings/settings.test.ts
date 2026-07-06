/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, describe, expect, test } from "vitest";

import {
  sanitizeScreenShareFps,
  sanitizeScreenShareQuality,
  screenShareFps,
  screenShareQuality,
} from "./settings";

describe("Setting.getStoredValue", () => {
  afterEach(() => {
    // Restore defaults so this test doesn't leak state into other tests.
    screenShareQuality.setValue(screenShareQuality.defaultValue);
    screenShareFps.setValue(screenShareFps.defaultValue);
  });

  test("re-reads localStorage directly, unlike getValue()", () => {
    expect(screenShareQuality.getValue()).toBe(screenShareQuality.defaultValue);

    // Simulate a same-origin parent frame (the cinny shell) writing to the
    // same localStorage key after this module has already initialised.
    localStorage.setItem("matrix-setting-screen-share-quality", '"480"');

    // The in-memory BehaviorSubject was never told about the write, so
    // getValue() still returns the stale (default) value.
    expect(screenShareQuality.getValue()).toBe(screenShareQuality.defaultValue);

    // getStoredValue() re-reads localStorage and picks up the new value.
    expect(screenShareQuality.getStoredValue()).toBe("480");
  });

  test("falls back to the in-memory value when nothing is stored", () => {
    localStorage.removeItem("matrix-setting-screen-share-fps");
    expect(screenShareFps.getStoredValue()).toBe(screenShareFps.getValue());
  });

  test("falls back to the in-memory value when the stored value fails to parse", () => {
    localStorage.setItem("matrix-setting-screen-share-fps", "{not json");
    expect(screenShareFps.getStoredValue()).toBe(screenShareFps.getValue());
  });
});

describe("sanitizeScreenShareQuality", () => {
  test("passes through known presets", () => {
    for (const value of ["480", "720", "1080", "2160"] as const) {
      expect(sanitizeScreenShareQuality(value)).toBe(value);
    }
  });

  test("falls back to the default for unknown values", () => {
    for (const value of ["9999", "abc", null, undefined, 12, {}]) {
      expect(sanitizeScreenShareQuality(value)).toBe(
        screenShareQuality.defaultValue,
      );
    }
  });
});

describe("sanitizeScreenShareFps", () => {
  test("passes through known presets", () => {
    for (const value of [15, 30, 60] as const) {
      expect(sanitizeScreenShareFps(value)).toBe(value);
    }
  });

  test("falls back to the default for unknown values", () => {
    for (const value of [9999, "abc", null, undefined, "30", {}]) {
      expect(sanitizeScreenShareFps(value)).toBe(screenShareFps.defaultValue);
    }
  });
});
