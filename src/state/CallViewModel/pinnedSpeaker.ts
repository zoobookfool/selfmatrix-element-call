/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { combineLatest, Subject, scan } from "rxjs";

import { type Behavior } from "../Behavior";
import { type ObservableScope } from "../ObservableScope";
import { type UserMediaViewModel } from "../media/UserMediaViewModel";

type PinAction =
  | { type: "set"; id: string | null }
  | { type: "toggle"; id: string };

/**
 * Creates the state needed for manually pinning a participant's tile to the
 * spotlight, overriding the automatic (speaker-based) selection.
 *
 * The pin is automatically cleared once the pinned participant's media is no
 * longer present in the call (e.g. they left).
 *
 * @param scope - The observable scope to manage subscriptions.
 * @param userMedia$ - The list of user media currently participating in the
 * call, used to detect when the pinned participant leaves.
 */
export function createPinnedSpeaker$(
  scope: ObservableScope,
  userMedia$: Behavior<UserMediaViewModel[]>,
): {
  pinnedSpeakerId$: Behavior<string | null>;
  setPinnedSpeaker: (id: string | null) => void;
  togglePinnedSpeaker: (id: string) => void;
} {
  const actions$ = new Subject<PinAction>();

  const setPinnedSpeaker = (id: string | null): void =>
    actions$.next({ type: "set", id });
  const togglePinnedSpeaker = (id: string): void =>
    actions$.next({ type: "toggle", id });

  /**
   * The pin as requested by the user, ignoring whether the pinned
   * participant is still present in the call.
   */
  const requestedPin$ = scope.behavior<string | null>(
    actions$.pipe(
      scan<PinAction, string | null>((prev, action) => {
        switch (action.type) {
          case "set":
            return action.id;
          case "toggle":
            return prev === action.id ? null : action.id;
        }
      }, null),
    ),
    null,
  );

  /**
   * The pinned speaker's id, automatically cleared once that participant's
   * media is no longer part of the call.
   */
  const pinnedSpeakerId$ = scope.behavior<string | null>(
    combineLatest([requestedPin$, userMedia$], (pin, userMedia) =>
      pin !== null && userMedia.some((m) => m.id === pin) ? pin : null,
    ),
  );

  return { pinnedSpeakerId$, setPinnedSpeaker, togglePinnedSpeaker };
}
