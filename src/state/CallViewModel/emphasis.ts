/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  merge,
  Subject,
  scan,
} from "rxjs";

import { type Behavior } from "../Behavior";
import { type ObservableScope } from "../ObservableScope";
import { type MediaViewModel } from "../media/MediaViewModel";
import { shallowEquals } from "../../utils/array";
import { type GridMode } from "./CallViewModel";

type EmphasisAction =
  | { type: "setEnabled"; enabled: boolean }
  | { type: "toggle"; id: string };

/**
 * SelfMatrix (UI design notes v1.4, agreement 2/3): "emphasis selection" is a
 * grid-mode-only feature that lets the user pick a subset of the currently
 * visible grid tiles (participants and/or watched screen shares) to
 * highlight. While enabled with at least one selection, the stage rearranges
 * to show only the selected tiles (still packed into a square grid), and the
 * rest are demoted to a mini tile strip - all without leaving grid mode
 * (gridMode$ never changes as a result of this feature; see CallViewModel's
 * layoutMedia$ for how the selection is turned into a layout).
 *
 * This module only tracks the raw (presence-unaware) selection request
 * state, mirroring the split between createRequestedPinnedSpeaker$ and
 * createPinnedSpeaker$ in pinnedSpeaker.ts.
 *
 * SelfMatrix (FIX-5b): emphasis selection is grid-mode-only, so leaving grid
 * mode (e.g. switching to spotlight) must turn it off - and, per the
 * `setEnabled` semantics below, clear the selection - rather than letting it
 * silently persist and reappear the next time the user switches back to
 * grid mode. `gridMode$` is optional only for convenience in tests that
 * don't care about this behaviour.
 */
export function createEmphasisSelection$(
  scope: ObservableScope,
  visibleMedia$: Behavior<MediaViewModel[]>,
  gridMode$?: Behavior<GridMode>,
): {
  emphasisEnabled$: Behavior<boolean>;
  emphasizedIds$: Behavior<string[]>;
  setEmphasisEnabled: (enabled: boolean) => void;
  toggleEmphasized: (id: string) => void;
} {
  const actions$ = new Subject<EmphasisAction>();

  const setEmphasisEnabled = (enabled: boolean): void =>
    actions$.next({ type: "setEnabled", enabled });
  const toggleEmphasized = (id: string): void =>
    actions$.next({ type: "toggle", id });

  // SelfMatrix (FIX-5b): synthesize a "disable" action whenever gridMode$
  // transitions away from "grid", so the exact same code path that handles
  // the user manually turning emphasis off (below) also clears the
  // selection here - there is no other kind of "off" state to reason about.
  const autoDisableOnLeaveGrid$ = gridMode$
    ? gridMode$.pipe(
        distinctUntilChanged(),
        filter((mode) => mode !== "grid"),
        map((): EmphasisAction => ({ type: "setEnabled", enabled: false })),
      )
    : undefined;

  const allActions$ = autoDisableOnLeaveGrid$
    ? merge(actions$, autoDisableOnLeaveGrid$)
    : actions$;

  /**
   * Whether emphasis selection is turned on. Turning it off always clears
   * the selection (agreement: "OFF に戻すと選択クリアで均等グリッドへ").
   */
  const emphasisEnabled$ = scope.behavior<boolean>(
    allActions$.pipe(
      filter(
        (action): action is Extract<EmphasisAction, { type: "setEnabled" }> =>
          action.type === "setEnabled",
      ),
      map((action) => action.enabled),
      distinctUntilChanged(),
    ),
    false,
  );

  /**
   * The raw (presence-unaware) set of emphasized media ids, as an ordered
   * array (insertion order, for stable layout). Cleared whenever emphasis is
   * disabled.
   */
  const requestedEmphasizedIds$ = scope.behavior<string[]>(
    allActions$.pipe(
      scan<EmphasisAction, string[]>((prev, action) => {
        switch (action.type) {
          case "setEnabled":
            return action.enabled ? prev : [];
          case "toggle":
            return prev.includes(action.id)
              ? prev.filter((id) => id !== action.id)
              : [...prev, action.id];
        }
      }, []),
      distinctUntilChanged(shallowEquals),
    ),
    [],
  );

  /**
   * The emphasized ids, automatically pruned once their media is no longer
   * part of the visible grid (e.g. the participant left, or a screen share
   * was un-watched/ended).
   */
  const emphasizedIds$ = scope.behavior<string[]>(
    combineLatest([requestedEmphasizedIds$, visibleMedia$], (ids, media) => {
      const presentIds = new Set(media.map((m) => m.id));
      return ids.filter((id) => presentIds.has(id));
    }).pipe(distinctUntilChanged(shallowEquals)),
  );

  return {
    emphasisEnabled$,
    emphasizedIds$,
    setEmphasisEnabled,
    toggleEmphasized,
  };
}
