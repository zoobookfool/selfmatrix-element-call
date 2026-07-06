/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useMemo,
} from "react";
import { distinctUntilChanged } from "rxjs";
import { useObservableEagerState } from "observable-hooks";

import { type GridLayout as GridLayoutModel } from "../state/layout-types.ts";
import styles from "./GridLayout.module.css";
import { useInitial } from "../useInitial";
import { type CallLayout, arrangeTilesSquare } from "./CallLayout";
import { type DragCallback, useUpdateLayout, useVisibleTiles } from "./Grid";
import { miniTileStripPosition, useSetting } from "../settings/settings";

interface GridCSSProperties extends CSSProperties {
  "--gap": string;
  "--width": string;
  "--height": string;
}

/**
 * SelfMatrix (FIX-4): the footprint reserved for the emphasis-selection mini
 * tile strip when docked to each edge, in pixels. Must stay in sync with
 * GridLayout.module.css's .stripLayer inline-size/block-size (180px for
 * left/right, 135px for top/bottom) and the matching
 * .scrolling[data-strip-position] padding rules, which reserve the same
 * amount of space in the scrolling grid layer so tiles never render
 * underneath the strip.
 */
const STRIP_SIZE_PX = {
  left: 180,
  right: 180,
  top: 135,
  bottom: 135,
} as const;

/**
 * An implementation of the "grid" layout, in which all participants are shown
 * together in a scrolling grid.
 */
export const makeGridLayout: CallLayout<GridLayoutModel> = ({
  minBounds$,
}) => ({
  foreground: "fixed",

  // The "fixed" (non-scrolling) part of the layout is where the spotlight
  // tile lives, and (SelfMatrix UI design notes v1.4) the emphasis selection
  // mini tile strip, if any.
  fixed: function GridLayoutFixed({ ref, model, Slot }): ReactNode {
    useUpdateLayout();
    const alignment = useObservableEagerState(
      useInitial(() =>
        model.spotlightAlignment$.pipe(
          distinctUntilChanged(
            (a1, a2) => a1.block === a2.block && a1.inline === a2.inline,
          ),
        ),
      ),
    );

    const onDragSpotlight: DragCallback = useCallback(
      ({ xRatio, yRatio }) =>
        model.spotlightAlignment$.next({
          block: yRatio < 0.5 ? "start" : "end",
          inline: xRatio < 0.5 ? "start" : "end",
        }),
      [model.spotlightAlignment$],
    );

    const [stripPosition] = useSetting(miniTileStripPosition);

    return (
      <div ref={ref} className={styles.fixed}>
        {model.spotlight && (
          <Slot
            className={styles.slot}
            id="spotlight"
            model={model.spotlight}
            onDrag={onDragSpotlight}
            data-block-alignment={alignment.block}
            data-inline-alignment={alignment.inline}
          />
        )}
        {model.strip && model.strip.length > 0 && (
          <div
            className={styles.stripLayer}
            data-strip-position={stripPosition}
            data-testid="emphasis_strip"
          >
            {model.strip.map((m) => (
              <Slot key={m.id} className={styles.slot} id={m.id} model={m} />
            ))}
          </div>
        )}
      </div>
    );
  },

  // The scrolling part of the layout is where all the grid tiles live
  scrolling: function GridLayout({ ref, model, Slot }): ReactNode {
    useUpdateLayout();
    useVisibleTiles(model.setVisibleTiles);
    const { width, height: minHeight } = useObservableEagerState(minBounds$);
    const [stripPosition] = useSetting(miniTileStripPosition);
    // SelfMatrix (FIX-4): while the mini tile strip is showing, the strip's
    // docked edge is reserved via padding (see GridLayout.module.css's
    // .scrolling[data-strip-position] rules), so the grid's *effective* area
    // for arranging/sizing tiles must be shrunk by the same amount - other-
    // wise arrangeTilesSquare would size tiles for the full area, causing
    // them to overflow into (and visually clip behind) the strip's padding.
    const stripActive = model.strip !== undefined && model.strip.length > 0;
    const effectiveWidth =
      stripActive && (stripPosition === "left" || stripPosition === "right")
        ? Math.max(0, width - STRIP_SIZE_PX[stripPosition])
        : width;
    const effectiveMinHeight =
      stripActive && (stripPosition === "top" || stripPosition === "bottom")
        ? Math.max(0, minHeight - STRIP_SIZE_PX[stripPosition])
        : minHeight;
    // SelfMatrix (UI design notes v1.4, agreement 2): the fork's grid mode
    // packs tiles into a square arrangement rather than upstream's 16:9-ish
    // arrangement, and never clamps tile aspect ratio.
    const { gap, tileWidth, tileHeight } = useMemo(
      () =>
        arrangeTilesSquare(
          effectiveWidth,
          effectiveMinHeight,
          model.grid.length,
        ),
      [effectiveWidth, effectiveMinHeight, model.grid.length],
    );

    return (
      <div
        ref={ref}
        className={styles.scrolling}
        data-strip-position={stripActive ? stripPosition : undefined}
        style={
          {
            width,
            "--gap": `${gap}px`,
            "--width": `${Math.floor(tileWidth)}px`,
            "--height": `${Math.floor(tileHeight)}px`,
          } as GridCSSProperties
        }
      >
        {model.grid.map((m) => (
          <Slot key={m.id} className={styles.slot} id={m.id} model={m} />
        ))}
      </div>
    );
  },
});
