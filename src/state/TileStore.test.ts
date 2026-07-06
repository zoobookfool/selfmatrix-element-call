/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, test } from "vitest";

import { TileStore } from "./TileStore";
import { constant } from "./Behavior";
import { type MediaViewModel } from "./media/MediaViewModel";

/** A minimal stand-in for a MediaViewModel, sufficient for TileStore's id-based bookkeeping. */
function media(id: string): MediaViewModel {
  return { id, displayName$: constant(id) } as unknown as MediaViewModel;
}

describe("TileStore (FIX-2: grid<->strip tile reuse)", () => {
  test("moving a tile from grid to strip reuses the same GridTileViewModel", () => {
    const alice = media("alice");
    const bob = media("bob");

    // Generation 1: both in the grid, nobody in the strip.
    const gen1Builder = TileStore.empty().from(10);
    gen1Builder.registerGridTile(alice);
    gen1Builder.registerGridTile(bob);
    const gen1 = gen1Builder.build();

    const aliceGridTile = gen1.gridTilesByMedia.get(alice);
    expect(aliceGridTile).toBeDefined();

    // Generation 2: alice gets demoted to the strip (e.g. emphasis selection
    // narrowed the grid down to just bob), bob stays in the grid.
    const gen2Builder = gen1.from(10);
    gen2Builder.registerGridTile(bob);
    gen2Builder.registerStripTile(alice);
    const gen2 = gen2Builder.build();

    expect(gen2.stripTiles).toHaveLength(1);
    // The tile VM for alice in the strip must be the *same* VM (same id) as
    // her grid tile VM from generation 1 - not a freshly minted one.
    expect(gen2.stripTiles[0]).toBe(aliceGridTile);
    expect(gen2.stripTiles[0].id).toBe(aliceGridTile!.id);
  });

  test("moving a tile from strip to grid reuses the same GridTileViewModel", () => {
    const alice = media("alice");
    const bob = media("bob");

    // Generation 1: alice in the strip, bob in the grid.
    const gen1Builder = TileStore.empty().from(10);
    gen1Builder.registerGridTile(bob);
    gen1Builder.registerStripTile(alice);
    const gen1 = gen1Builder.build();

    const aliceStripTile = gen1.stripTiles[0];
    expect(aliceStripTile).toBeDefined();

    // Generation 2: alice is promoted back into the grid (e.g. emphasis
    // selection was toggled off), bob stays in the grid.
    const gen2Builder = gen1.from(10);
    gen2Builder.registerGridTile(alice);
    gen2Builder.registerGridTile(bob);
    const gen2 = gen2Builder.build();

    const aliceGridTile = gen2.gridTilesByMedia.get(alice);
    expect(aliceGridTile).toBeDefined();
    expect(aliceGridTile).toBe(aliceStripTile);
    expect(aliceGridTile!.id).toBe(aliceStripTile.id);
  });

  test("grid -> strip -> grid round trip keeps the same GridTileViewModel id throughout", () => {
    const alice = media("alice");
    const bob = media("bob");

    // Gen 1: alice + bob both in grid.
    const gen1Builder = TileStore.empty().from(10);
    gen1Builder.registerGridTile(alice);
    gen1Builder.registerGridTile(bob);
    const gen1 = gen1Builder.build();
    const originalId = gen1.gridTilesByMedia.get(alice)!.id;

    // Gen 2: alice demoted to strip.
    const gen2Builder = gen1.from(10);
    gen2Builder.registerGridTile(bob);
    gen2Builder.registerStripTile(alice);
    const gen2 = gen2Builder.build();
    expect(gen2.stripTiles[0].id).toBe(originalId);

    // Gen 3: alice promoted back to grid.
    const gen3Builder = gen2.from(10);
    gen3Builder.registerGridTile(alice);
    gen3Builder.registerGridTile(bob);
    const gen3 = gen3Builder.build();
    expect(gen3.gridTilesByMedia.get(alice)!.id).toBe(originalId);
  });

  test("a tile new to both grid and strip still gets a fresh GridTileViewModel", () => {
    const alice = media("alice");

    const builder = TileStore.empty().from(10);
    builder.registerGridTile(alice);
    const store = builder.build();

    expect(store.gridTilesByMedia.get(alice)).toBeDefined();
  });
});
