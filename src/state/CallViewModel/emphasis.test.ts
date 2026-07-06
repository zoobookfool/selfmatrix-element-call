/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, test } from "vitest";

import { createEmphasisSelection$ } from "./emphasis";
import { testScope, withTestScheduler } from "../../utils/test";
import { constant } from "../Behavior";
import { type MediaViewModel } from "../media/MediaViewModel";
import { type GridMode } from "./CallViewModel";

/** A minimal stand-in for a MediaViewModel, sufficient for emphasis.ts's id-based bookkeeping. */
function media(id: string): MediaViewModel {
  return { id } as MediaViewModel;
}

describe("createEmphasisSelection$", () => {
  test("defaults to disabled with no selection", () => {
    withTestScheduler(({ expectObservable }) => {
      const { emphasisEnabled$, emphasizedIds$ } = createEmphasisSelection$(
        testScope(),
        constant([media("a"), media("b")]),
      );
      expectObservable(emphasisEnabled$).toBe("e", { e: false });
      expectObservable(emphasizedIds$).toBe("e", { e: [] });
    });
  });

  test("toggling emphasized ids only takes effect once enabled, and disabling clears the selection", () => {
    withTestScheduler(({ schedule, expectObservable }) => {
      const visibleMedia$ = constant([media("a"), media("b")]);
      const {
        emphasisEnabled$,
        emphasizedIds$,
        setEmphasisEnabled,
        toggleEmphasized,
      } = createEmphasisSelection$(testScope(), visibleMedia$);

      // Toggling "a" before enabling still records the selection (agreement:
      // the toggle itself doesn't require being enabled first - the UI only
      // exposes the toggle while grid mode is active, but the underlying
      // state is not otherwise gated); enabling then reveals it.
      schedule("-a-e-b-d", {
        a: () => toggleEmphasized("a"),
        e: () => setEmphasisEnabled(true),
        b: () => toggleEmphasized("b"),
        d: () => setEmphasisEnabled(false),
      });

      expectObservable(emphasisEnabled$).toBe("x--y---z", {
        x: false,
        y: true,
        z: false,
      });
      expectObservable(emphasizedIds$).toBe("xy---z-w", {
        x: [],
        y: ["a"],
        z: ["a", "b"],
        w: [],
      });
    });
  });

  test("toggling an already-emphasized id removes it from the selection", () => {
    withTestScheduler(({ schedule, expectObservable }) => {
      const visibleMedia$ = constant([media("a"), media("b")]);
      const { emphasizedIds$, setEmphasisEnabled, toggleEmphasized } =
        createEmphasisSelection$(testScope(), visibleMedia$);

      schedule("-e-a-a", {
        e: () => setEmphasisEnabled(true),
        a: () => toggleEmphasized("a"),
      });

      expectObservable(emphasizedIds$).toBe("x--y-x", {
        x: [],
        y: ["a"],
      });
    });
  });

  test("prunes emphasized ids once their media is no longer visible", () => {
    withTestScheduler(({ behavior, schedule, expectObservable }) => {
      // Alice and Bob are visible throughout; Carol appears then leaves.
      const visibleMedia$ = behavior("a-b-c", {
        a: [media("alice"), media("bob")],
        b: [media("alice"), media("bob"), media("carol")],
        c: [media("alice"), media("bob")],
      });
      const { emphasizedIds$, setEmphasisEnabled, toggleEmphasized } =
        createEmphasisSelection$(testScope(), visibleMedia$);

      schedule("-e-c", {
        e: () => setEmphasisEnabled(true),
        c: () => toggleEmphasized("carol"),
      });

      // Carol is emphasized once selected (at frame 3, while she's still
      // visible), then pruned the moment visibleMedia$ drops her again
      // (frame 4, "c" in the visibleMedia$ marbles).
      expectObservable(emphasizedIds$).toBe("x--yz", {
        x: [],
        y: ["carol"],
        z: [],
      });
    });
  });

  test("FIX-5b: leaving grid mode (e.g. to spotlight) turns emphasis off and clears the selection", () => {
    withTestScheduler(({ behavior, schedule, expectObservable }) => {
      const visibleMedia$ = constant([media("a"), media("b")]);
      // Starts in "grid", switches to "spotlight" at frame 4, then back to
      // "grid" at frame 6.
      const gridMode$ = behavior<GridMode>("a---b-c", {
        a: "grid",
        b: "spotlight",
        c: "grid",
      });
      const {
        emphasisEnabled$,
        emphasizedIds$,
        setEmphasisEnabled,
        toggleEmphasized,
      } = createEmphasisSelection$(testScope(), visibleMedia$, gridMode$);

      schedule("-e-a", {
        e: () => setEmphasisEnabled(true),
        a: () => toggleEmphasized("a"),
      });

      // x: initial (disabled, empty)
      // y: enabled after setEmphasisEnabled(true) at frame 1
      // z: "a" emphasized after toggleEmphasized("a") at frame 3
      // w: auto-disabled the moment gridMode$ leaves "grid" at frame 4 -
      //    selection is cleared exactly like a manual OFF toggle would.
      // Switching back to "grid" at frame 6 must NOT resurrect the old
      // selection - emphasis stays off until the user re-enables it.
      expectObservable(emphasisEnabled$).toBe("xy--w", {
        x: false,
        y: true,
        w: false,
      });
      expectObservable(emphasizedIds$).toBe("x--yz", {
        x: [],
        y: ["a"],
        z: [],
      });
    });
  });

  test("emphasized ids not currently visible are filtered out even if selected while absent", () => {
    withTestScheduler(({ behavior, schedule, expectObservable }) => {
      // Bob only becomes visible at frame 4, after he's already been
      // (attempted to be) selected at frame 3.
      const visibleMedia$ = behavior("a---b", {
        a: [media("alice")],
        b: [media("alice"), media("bob")],
      });
      const { emphasizedIds$, setEmphasisEnabled, toggleEmphasized } =
        createEmphasisSelection$(testScope(), visibleMedia$);

      // Select "bob" while he isn't visible yet (frame 1: enable; frame 3:
      // select him, before he's visible).
      schedule("-e-b", {
        e: () => setEmphasisEnabled(true),
        b: () => toggleEmphasized("bob"),
      });

      // The selection is recorded (requestedEmphasizedIds$) but filtered out
      // of emphasizedIds$ (still just the initial "[]") until Bob actually
      // becomes visible at frame 4.
      expectObservable(emphasizedIds$).toBe("x---y", {
        x: [],
        y: ["bob"],
      });
    });
  });
});
