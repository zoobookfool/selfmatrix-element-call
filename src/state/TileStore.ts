/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { BehaviorSubject } from "rxjs";
import { logger } from "matrix-js-sdk/lib/logger";

import { GridTileViewModel, SpotlightTileViewModel } from "./TileViewModel";
import { fillGaps } from "../utils/iter";
import { debugTileLayout } from "../settings/settings";
import { type MediaViewModel } from "./media/MediaViewModel";
import { type UserMediaViewModel } from "./media/UserMediaViewModel";

function debugEntries(entries: GridTileData[]): string[] {
  return entries.map((e) => e.media.displayName$.value);
}

let DEBUG_ENABLED = false;
debugTileLayout.value$.subscribe((value) => (DEBUG_ENABLED = value));

class SpotlightTileData {
  private readonly media$: BehaviorSubject<MediaViewModel[]>;
  public get media(): MediaViewModel[] {
    return this.media$.value;
  }
  public set media(value: MediaViewModel[]) {
    this.media$.next(value);
  }

  private readonly maximised$: BehaviorSubject<boolean>;
  public get maximised(): boolean {
    return this.maximised$.value;
  }
  public set maximised(value: boolean) {
    this.maximised$.next(value);
  }

  public readonly vm: SpotlightTileViewModel;

  public constructor(media: MediaViewModel[], maximised: boolean) {
    this.media$ = new BehaviorSubject(media);
    this.maximised$ = new BehaviorSubject(maximised);
    this.vm = new SpotlightTileViewModel(this.media$, this.maximised$);
  }
}

class GridTileData {
  private readonly media$: BehaviorSubject<MediaViewModel>;
  public get media(): MediaViewModel {
    return this.media$.value;
  }
  public set media(value: MediaViewModel) {
    this.media$.next(value);
  }

  public readonly vm: GridTileViewModel;

  public constructor(media: MediaViewModel) {
    this.media$ = new BehaviorSubject(media);
    this.vm = new GridTileViewModel(this.media$);
  }
}

/**
 * An immutable collection of tiles to be mapped to a layout.
 */
export class TileStore {
  private constructor(
    private readonly spotlight: SpotlightTileData | null,
    private readonly grid: GridTileData[],
    /**
     * SelfMatrix (UI design notes v1.4, agreement 2/3): tiles demoted to the
     * mini tile strip while grid mode's emphasis selection narrows the main
     * grid down to just the selected tiles. See `registerStripTile`.
     */
    private readonly strip: GridTileData[],
    /**
     * A number incremented on each update, just for debugging purposes.
     */
    public readonly generation: number,
  ) {}

  public readonly spotlightTile = this.spotlight?.vm;
  public readonly gridTiles = this.grid.map(({ vm }) => vm);
  public readonly gridTilesByMedia = new Map(
    this.grid.map(({ vm, media }) => [media, vm]),
  );
  public readonly stripTiles = this.strip.map(({ vm }) => vm);

  /**
   * Creates an an empty collection of tiles.
   */
  public static empty(): TileStore {
    return new TileStore(null, [], [], 0);
  }

  /**
   * Creates a builder which can be used to update the collection, passing
   * ownership of the tiles to the updated collection.
   */
  public from(visibleTiles: number): TileStoreBuilder {
    return new TileStoreBuilder(
      this.spotlight,
      this.grid,
      this.strip,
      (spotlight, grid, strip) =>
        new TileStore(spotlight, grid, strip, this.generation + 1),
      visibleTiles,
      this.generation,
    );
  }
}

/**
 * A builder for a new collection of tiles. Will reuse tiles and destroy unused
 * tiles from a previous collection where appropriate.
 */
export class TileStoreBuilder {
  private spotlight: SpotlightTileData | null = null;
  private readonly prevSpotlightSpeaker: UserMediaViewModel | null =
    this.prevSpotlight?.media.length === 1 &&
    "speaking$" in this.prevSpotlight.media[0]
      ? this.prevSpotlight.media[0]
      : null;

  private readonly prevGridByMedia: Map<
    MediaViewModel,
    [GridTileData, number]
  > = new Map(
    this.prevGrid.map((entry, i) => [entry.media, [entry, i]] as const),
  );

  private readonly prevStripByMedia: Map<MediaViewModel, GridTileData> =
    new Map(this.prevStrip.map((entry) => [entry.media, entry]));
  private readonly stripEntries: GridTileData[] = [];

  // The total number of grid entries that we have so far
  private numGridEntries = 0;
  // A sparse array of grid entries which should be kept in the same spots as
  // which they appeared in the previous grid
  private readonly stationaryGridEntries: GridTileData[] = new Array(
    this.prevGrid.length,
  );
  // Grid entries which should now enter the visible section of the grid
  private readonly visibleGridEntries: GridTileData[] = [];
  // Grid entries which should now enter the invisible section of the grid
  private readonly invisibleGridEntries: GridTileData[] = [];

  public constructor(
    private readonly prevSpotlight: SpotlightTileData | null,
    private readonly prevGrid: GridTileData[],
    private readonly prevStrip: GridTileData[],
    private readonly construct: (
      spotlight: SpotlightTileData | null,
      grid: GridTileData[],
      strip: GridTileData[],
    ) => TileStore,
    private readonly visibleTiles: number,
    /**
     * A number incremented on each update, just for debugging purposes.
     */
    private readonly generation: number,
  ) {}

  /**
   * Sets the contents of the spotlight tile. If this is never called, there
   * will be no spotlight tile.
   */
  public registerSpotlight(media: MediaViewModel[], maximised: boolean): void {
    if (DEBUG_ENABLED)
      logger.debug(
        `[TileStore, ${this.generation}] register spotlight: ${media.map((m) => m.displayName$.value)}`,
      );

    if (this.spotlight !== null) throw new Error("Spotlight already set");
    if (this.numGridEntries > 0)
      throw new Error("Spotlight must be registered before grid tiles");

    // Reuse the previous spotlight tile if it exists
    if (this.prevSpotlight === null) {
      this.spotlight = new SpotlightTileData(media, maximised);
    } else {
      this.spotlight = this.prevSpotlight;
      this.spotlight.media = media;
      this.spotlight.maximised = maximised;
    }
  }

  /**
   * Sets up a grid tile for the given media. If this is never called for some
   * media, then that media will have no grid tile.
   *
   * SelfMatrix (UI design notes v1.4): widened to accept any `MediaViewModel`
   * (not just user/ringing media), since watched screen shares are now mixed
   * directly into the grid.
   */
  public registerGridTile(media: MediaViewModel): void {
    if (DEBUG_ENABLED)
      logger.debug(
        `[TileStore, ${this.generation}] register grid tile: ${media.displayName$.value}`,
      );

    if (this.spotlight !== null) {
      // We actually *don't* want spotlight speakers to appear in both the
      // spotlight and the grid, so they're filtered out here
      if (
        !(media.type === "user" && media.local) &&
        this.spotlight.media.includes(media)
      )
        return;
      // When the spotlight speaker changes, we would see one grid tile appear
      // and another grid tile disappear. This would be an undesirable layout
      // shift, so instead what we do is take the speaker's grid tile and swap
      // the media out, so it can remain where it is in the layout.
      if (
        media === this.prevSpotlightSpeaker &&
        this.spotlight.media.length === 1 &&
        "speaking$" in this.spotlight.media[0] &&
        this.prevSpotlightSpeaker !==
          (this.spotlight.media[0] satisfies UserMediaViewModel)
      ) {
        const prev = this.prevGridByMedia.get(this.spotlight.media[0]);
        if (prev !== undefined) {
          const [entry, prevIndex] = prev;
          const previouslyVisible = prevIndex < this.visibleTiles;
          const nowVisible = this.numGridEntries < this.visibleTiles;

          // If it doesn't need to move between the visible/invisible sections of
          // the grid, then we can keep it where it was and swap the media
          if (previouslyVisible === nowVisible) {
            this.stationaryGridEntries[prevIndex] = entry;
            // Do the media swap
            entry.media = media;
            this.prevGridByMedia.delete(this.spotlight.media[0]);
            this.prevGridByMedia.set(media, prev);
          } else {
            // Create a new tile; this will cause a layout shift but I'm not
            // sure there's any other straightforward option in this case
            (nowVisible
              ? this.visibleGridEntries
              : this.invisibleGridEntries
            ).push(new GridTileData(media));
          }

          this.numGridEntries++;
          return;
        }
      }
    }

    // Was there previously a tile with this same media?
    const prev = this.prevGridByMedia.get(media);
    if (prev === undefined) {
      // SelfMatrix (FIX-2): the media may have previously been in the mini
      // tile strip rather than the main grid (e.g. emphasis selection was
      // just toggled, moving this tile from strip to grid). Reuse that
      // tile's GridTileData/vm rather than minting a new one, so the tile
      // doesn't unmount/remount (and its vm.id - and any associated DOM/CSS
      // transition state - stays stable across the grid<->strip move).
      const prevStripEntry = this.prevStripByMedia.get(media);
      if (prevStripEntry !== undefined) {
        // Consume it so it can't also be reused by a later
        // registerStripTile call for the same media (shouldn't normally
        // happen - each media is registered on one side or the other - but
        // guards against double-use if it ever did).
        this.prevStripByMedia.delete(media);
        (this.numGridEntries < this.visibleTiles
          ? this.visibleGridEntries
          : this.invisibleGridEntries
        ).push(prevStripEntry);
      } else {
        // Create a new tile
        (this.numGridEntries < this.visibleTiles
          ? this.visibleGridEntries
          : this.invisibleGridEntries
        ).push(new GridTileData(media));
      }
    } else {
      // Reuse the existing tile
      const [entry, prevIndex] = prev;
      const previouslyVisible = prevIndex < this.visibleTiles;
      const nowVisible = this.numGridEntries < this.visibleTiles;
      // If it doesn't need to move between the visible/invisible sections of
      // the grid, then we can keep it exactly where it was previously
      if (previouslyVisible === nowVisible)
        this.stationaryGridEntries[prevIndex] = entry;
      // Otherwise, queue this tile to be moved
      else
        (nowVisible ? this.visibleGridEntries : this.invisibleGridEntries).push(
          entry,
        );
    }

    this.numGridEntries++;
  }

  /**
   * SelfMatrix (UI design notes v1.4, agreement 2/3): sets up a mini tile
   * strip tile for the given media (a tile demoted out of the main grid by
   * emphasis selection). Reuses the previous strip tile for the same media if
   * one exists, so unselected tiles don't flicker/remount as the emphasis
   * selection changes. Unlike the main grid, strip tiles are never virtualized
   * (there are normally few enough that this isn't a concern).
   *
   * SelfMatrix (FIX-2): also falls back to reusing a tile that was previously
   * in the main grid (rather than the strip), so that toggling emphasis
   * selection - which moves media between grid and strip - reuses the same
   * underlying tile/vm instead of destroying and recreating it (which would
   * cause an undesirable unmount/mount animation).
   */
  public registerStripTile(media: MediaViewModel): void {
    if (DEBUG_ENABLED)
      logger.debug(
        `[TileStore, ${this.generation}] register strip tile: ${media.displayName$.value}`,
      );

    const prev = this.prevStripByMedia.get(media);
    if (prev !== undefined) {
      this.stripEntries.push(prev);
      return;
    }

    // Fall back to a tile that was previously in the main grid for this same
    // media (see FIX-2 doc comment above). Consume it from prevGridByMedia so
    // registerGridTile can't also try to reuse it as stationary/moved grid
    // entry for the same media (shouldn't normally happen, since media is
    // only ever registered on one side per builder pass, but this keeps the
    // bookkeeping consistent either way).
    const prevGridEntry = this.prevGridByMedia.get(media);
    if (prevGridEntry !== undefined) {
      this.prevGridByMedia.delete(media);
      this.stripEntries.push(prevGridEntry[0]);
      return;
    }

    this.stripEntries.push(new GridTileData(media));
  }

  /**
   * Sets up a PiP tile for the given media. This is a special kind of grid tile
   * that is expected to stand on its own and switch between speakers, so this
   * method will more eagerly try to reuse an existing tile, replacing its
   * media, than registerGridTile would.
   */
  public registerPipTile(media: UserMediaViewModel): void {
    if (DEBUG_ENABLED)
      logger.debug(
        `[TileStore, ${this.generation}] register PiP tile: ${media.displayName$.value}`,
      );

    // If there is a single grid tile that we can reuse
    if (this.prevGrid.length === 1) {
      const entry = this.prevGrid[0];
      this.stationaryGridEntries[0] = entry;
      // Do the media swap
      entry.media = media;
      this.prevGridByMedia.delete(entry.media);
      this.prevGridByMedia.set(media, [entry, 0]);
    } else {
      this.visibleGridEntries.push(new GridTileData(media));
    }

    this.numGridEntries++;
  }

  /**
   * Constructs a new collection of all registered tiles, transferring ownership
   * of the tiles to the new collection. Any tiles present in the previous
   * collection but not the new collection will be destroyed.
   */
  public build(): TileStore {
    // Piece together the grid
    const grid = [
      ...fillGaps(this.stationaryGridEntries, [
        ...this.visibleGridEntries,
        ...this.invisibleGridEntries,
      ]),
    ];
    if (DEBUG_ENABLED) {
      logger.debug(
        `[TileStore, ${this.generation}] stationary: ${debugEntries(this.stationaryGridEntries)}`,
      );
      logger.debug(
        `[TileStore, ${this.generation}] visible: ${debugEntries(this.visibleGridEntries)}`,
      );
      logger.debug(
        `[TileStore, ${this.generation}] invisible: ${debugEntries(this.invisibleGridEntries)}`,
      );
      logger.debug(
        `[TileStore, ${this.generation}] result: ${debugEntries(grid)}`,
      );
    }

    return this.construct(this.spotlight, grid, this.stripEntries);
  }
}
