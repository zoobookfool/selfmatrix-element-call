/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { of } from "rxjs";

import { Grid } from "./Grid";
import { makeSpotlightLandscapeLayout } from "./SpotlightLandscapeLayout";
import { SpotlightTileViewModel } from "../state/TileViewModel";
import { constant } from "../state/Behavior";
import {
  miniTileStripPosition as miniTileStripPositionSetting,
  type MiniTileStripPosition,
} from "../settings/settings";
import type { SpotlightLandscapeLayout as SpotlightLandscapeLayoutModel } from "../state/layout-types";

// A no-op Tile renderer: the strip-position behavior is entirely about the
// layout's own root element, not the tiles that Grid overlays on top.
function NoopTile(): null {
  return null;
}

function makeModel(): SpotlightLandscapeLayoutModel {
  const spotlight = new SpotlightTileViewModel(constant([]), constant(false));
  return {
    type: "spotlight-landscape",
    spotlight,
    grid: [],
    setVisibleTiles: (): void => {},
  };
}

describe("SpotlightLandscapeLayout", () => {
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
    // Reset the persisted setting between tests so they don't leak state via
    // localStorage.
    miniTileStripPositionSetting.setValue(
      miniTileStripPositionSetting.defaultValue,
    );
  });

  it("defaults to a bottom-docked strip", () => {
    const layout = makeSpotlightLandscapeLayout({
      minBounds$: of({ width: 800, height: 600 }),
    });

    const { container } = render(
      <Grid model={makeModel()} Layout={layout.scrolling} Tile={NoopTile} />,
    );

    const layer = container.querySelector("[data-strip-position]");
    expect(layer).not.toBeNull();
    expect(layer!.getAttribute("data-strip-position")).toBe("bottom");
  });

  it.each<MiniTileStripPosition>(["top", "bottom", "left", "right"])(
    "reflects the mini-tile-strip-position setting (%s) on both layers",
    (position) => {
      miniTileStripPositionSetting.setValue(position);

      const layout = makeSpotlightLandscapeLayout({
        minBounds$: of({ width: 800, height: 600 }),
      });
      const model = makeModel();

      const { container: fixedContainer } = render(
        <Grid model={model} Layout={layout.fixed} Tile={NoopTile} />,
      );
      const { container: scrollingContainer } = render(
        <Grid model={model} Layout={layout.scrolling} Tile={NoopTile} />,
      );

      expect(
        fixedContainer
          .querySelector("[data-strip-position]")!
          .getAttribute("data-strip-position"),
      ).toBe(position);
      expect(
        scrollingContainer
          .querySelector("[data-strip-position]")!
          .getAttribute("data-strip-position"),
      ).toBe(position);
    },
  );

  it("updates the data attribute reactively when the setting changes", () => {
    const layout = makeSpotlightLandscapeLayout({
      minBounds$: of({ width: 800, height: 600 }),
    });

    const { container } = render(
      <Grid model={makeModel()} Layout={layout.scrolling} Tile={NoopTile} />,
    );

    const layer = (): Element =>
      container.querySelector("[data-strip-position]")!;
    expect(layer().getAttribute("data-strip-position")).toBe("bottom");

    act(() => {
      miniTileStripPositionSetting.setValue("left");
    });
    expect(layer().getAttribute("data-strip-position")).toBe("left");
  });
});
