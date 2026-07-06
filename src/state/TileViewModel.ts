/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type Behavior } from "./Behavior";
import { type MediaViewModel } from "./media/MediaViewModel";

let nextId = 0;
function createId(): string {
  return (nextId++).toString();
}

export class GridTileViewModel {
  public readonly id = createId();

  public constructor(
    /**
     * SelfMatrix (UI design notes v1.4, agreement 2): widened from
     * `UserMediaViewModel | RingingMediaViewModel` to the full
     * `MediaViewModel` union, since watched screen shares ("配信") are now
     * mixed directly into the grid as ordinary tiles.
     */
    public readonly media$: Behavior<MediaViewModel>,
  ) {}
}

export class SpotlightTileViewModel {
  public constructor(
    public readonly media$: Behavior<MediaViewModel[]>,
    public readonly maximised$: Behavior<boolean>,
  ) {}
}

export type TileViewModel = GridTileViewModel | SpotlightTileViewModel;
