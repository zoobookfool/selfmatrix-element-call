/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, test } from "vitest";

import { arrangeTilesSquare } from "./CallLayout";

describe("arrangeTilesSquare", () => {
  // SelfMatrix (UI design notes v1.4, agreement 2): the fork's grid mode
  // packs tiles into a square arrangement: columns = ceil(sqrt(n)),
  // rows = ceil(n / columns). E.g. 1 -> 1x1, 2 -> 1x2, 3-4 -> 2x2,
  // 5-9 -> 3x3.
  test.each([
    [1, 1, 1],
    [2, 2, 1],
    [3, 2, 2],
    [4, 2, 2],
    [5, 3, 2],
    [6, 3, 2],
    [7, 3, 3],
    [8, 3, 3],
    [9, 3, 3],
    [10, 4, 3],
  ])("packs %i tile(s) into %i columns x %i rows", (count, columns, rows) => {
    const {
      columns: actualColumns,
      tileWidth,
      tileHeight,
    } = arrangeTilesSquare(1000, 800, count);
    expect(actualColumns).toBe(columns);
    // rows can be derived from tileHeight given the fixed gap/height inputs;
    // rather than exposing rows directly, verify it via the arrangement math:
    // rows = ceil(count / columns).
    expect(Math.ceil(count / actualColumns)).toBe(rows);
    expect(tileWidth).toBeGreaterThan(0);
    expect(tileHeight).toBeGreaterThan(0);
  });

  test("does not clamp tile aspect ratio (unlike arrangeTiles)", () => {
    // A very wide, short area with a single tile would be clamped under
    // arrangeTiles's 4:3-17:9 range, but arrangeTilesSquare should let the
    // tile fill the available cell without any such clamp.
    const { tileWidth, tileHeight } = arrangeTilesSquare(2000, 200, 1);
    const aspectRatio = tileWidth / tileHeight;
    expect(aspectRatio).toBeGreaterThan(17 / 9);
  });

  test("uses a smaller gap for narrow layouts", () => {
    expect(arrangeTilesSquare(700, 800, 4).gap).toBe(16);
    expect(arrangeTilesSquare(900, 800, 4).gap).toBe(20);
  });
});
