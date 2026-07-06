/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type BehaviorSubject } from "rxjs";

import {
  type Alignment,
  type Layout,
  type LayoutMedia,
} from "./layout-types.ts";
import { type TileStore } from "./TileStore";

export type GridLikeLayoutType =
  | "grid"
  | "spotlight-landscape"
  | "spotlight-portrait";

/**
 * Produces a grid-like layout (any layout with a grid and possibly a spotlight)
 * with the given media.
 */
export function gridLikeLayout(
  media: LayoutMedia & { type: GridLikeLayoutType },
  spotlightAlignment$: BehaviorSubject<Alignment>,
  visibleTiles: number,
  setVisibleTiles: (value: number) => void,
  prevTiles: TileStore,
): [Layout & { type: GridLikeLayoutType }, TileStore] {
  const update = prevTiles.from(visibleTiles);
  if (media.spotlight !== undefined)
    update.registerSpotlight(
      media.spotlight,
      media.type === "spotlight-portrait",
    );
  for (const mediaVm of media.grid) update.registerGridTile(mediaVm);
  // SelfMatrix (UI design notes v1.4, agreement 2/3): grid mode's emphasis
  // selection carries a `strip` of tiles demoted out of the main grid; only
  // GridLayoutMedia has this field.
  if (media.type === "grid" && media.strip !== undefined)
    for (const mediaVm of media.strip) update.registerStripTile(mediaVm);
  const tiles = update.build();

  return [
    {
      type: media.type,
      spotlight: tiles.spotlightTile,
      grid: tiles.gridTiles,
      strip: media.type === "grid" ? tiles.stripTiles : undefined,
      spotlightAlignment$,
      setVisibleTiles,
    } as Layout & { type: GridLikeLayoutType },
    tiles,
  ];
}
