/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { of, BehaviorSubject } from "rxjs";

import { Grid } from "./Grid";
import { makeGridLayout } from "./GridLayout";
import { GridTileViewModel } from "../state/TileViewModel";
import { constant } from "../state/Behavior";
import {
  miniTileStripPosition as miniTileStripPositionSetting,
  type MiniTileStripPosition,
} from "../settings/settings";
import type {
  Alignment,
  GridLayout as GridLayoutModel,
} from "../state/layout-types";
import { type MediaViewModel } from "../state/media/MediaViewModel";

// A no-op Tile renderer: we only care about the layout's own root element
// (data-strip-position attribute and the --width/--height CSS variables it
// derives), not the tiles Grid overlays on top.
function NoopTile(): null {
  return null;
}

function media(id: string): MediaViewModel {
  return { id, displayName$: constant(id) } as unknown as MediaViewModel;
}

function makeModel(gridCount: number, stripCount: number): GridLayoutModel {
  const grid = Array.from(
    { length: gridCount },
    (_, i) => new GridTileViewModel(constant(media(`grid-${i}`))),
  );
  const strip =
    stripCount > 0
      ? Array.from(
          { length: stripCount },
          (_, i) => new GridTileViewModel(constant(media(`strip-${i}`))),
        )
      : undefined;
  return {
    type: "grid",
    grid,
    strip,
    spotlightAlignment$: new BehaviorSubject<Alignment>({
      block: "end",
      inline: "end",
    }),
    setVisibleTiles: (): void => {},
  };
}

describe("GridLayout (FIX-4: strip reservation)", () => {
  beforeAll(() => {
    // Grid uses react-use-measure, which needs ResizeObserver; jsdom does not
    // implement it, so provide a minimal stub (mirrors VideoPreview.test.tsx).
    window.ResizeObserver = class ResizeObserver {
      public observe(): void {
        // do nothing
      }
      public unobserve(): void {
        // do nothing
      }
      public disconnect(): void {
        // do nothing
      }
    };
  });

  afterEach(() => {
    cleanup();
    miniTileStripPositionSetting.setValue(
      miniTileStripPositionSetting.defaultValue,
    );
  });

  it("has no data-strip-position and reserves no space when there is no strip", () => {
    const layout = makeGridLayout({
      minBounds$: of({ width: 800, height: 600 }),
    });

    const { container } = render(
      <Grid
        model={makeModel(4, 0)}
        Layout={layout.scrolling}
        Tile={NoopTile}
      />,
    );

    const scrolling = container.querySelector(
      `[class*="scrolling"]`,
    ) as HTMLElement;
    expect(scrolling).not.toBeNull();
    expect(scrolling.getAttribute("data-strip-position")).toBeNull();
  });

  it.each<MiniTileStripPosition>(["top", "bottom", "left", "right"])(
    "reserves space for the strip on the %s edge",
    (position) => {
      miniTileStripPositionSetting.setValue(position);

      const layout = makeGridLayout({
        minBounds$: of({ width: 800, height: 600 }),
      });

      const withStrip = render(
        <Grid
          model={makeModel(4, 2)}
          Layout={layout.scrolling}
          Tile={NoopTile}
        />,
      );
      const scrollingWithStrip = withStrip.container.querySelector(
        `[class*="scrolling"]`,
      ) as HTMLElement;
      expect(scrollingWithStrip.getAttribute("data-strip-position")).toBe(
        position,
      );

      const withStripWidth = parseFloat(
        scrollingWithStrip.style.getPropertyValue("--width"),
      );
      const withStripHeight = parseFloat(
        scrollingWithStrip.style.getPropertyValue("--height"),
      );
      withStrip.unmount();

      // Compare against the same grid with no strip at all: the effective
      // packed tile size must shrink once the strip reserves its footprint
      // (whether that's a width or height reduction depends on the strip's
      // orientation).
      const withoutStrip = render(
        <Grid
          model={makeModel(4, 0)}
          Layout={layout.scrolling}
          Tile={NoopTile}
        />,
      );
      const scrollingWithoutStrip = withoutStrip.container.querySelector(
        `[class*="scrolling"]`,
      ) as HTMLElement;
      const withoutStripWidth = parseFloat(
        scrollingWithoutStrip.style.getPropertyValue("--width"),
      );
      const withoutStripHeight = parseFloat(
        scrollingWithoutStrip.style.getPropertyValue("--height"),
      );
      withoutStrip.unmount();

      if (position === "left" || position === "right") {
        expect(withStripWidth).toBeLessThan(withoutStripWidth);
      } else {
        expect(withStripHeight).toBeLessThan(withoutStripHeight);
      }
    },
  );
});
