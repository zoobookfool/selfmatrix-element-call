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
 * Creates the raw (presence-unaware) pin request state: which media id the
 * user last asked to pin, ignoring whether that participant is still present
 * in the call.
 *
 * This is split out from `createPinnedSpeaker$` so that it can be created
 * before `userMedia$` exists, and fed into per-member view models (e.g. for
 * SelfMatrix's screen share quality control - requirements MUST) without
 * creating a circular dependency on `userMedia$`. Such consumers don't need
 * presence-awareness: when the pinned member actually leaves, their view
 * model is torn down anyway, so no stale "pinned" state can leak.
 *
 * @param scope - The observable scope to manage subscriptions.
 */
export function createRequestedPinnedSpeaker$(scope: ObservableScope): {
  requestedPinnedSpeakerId$: Behavior<string | null>;
  setPinnedSpeaker: (id: string | null) => void;
  togglePinnedSpeaker: (id: string) => void;
} {
  const actions$ = new Subject<PinAction>();

  const setPinnedSpeaker = (id: string | null): void =>
    actions$.next({ type: "set", id });
  const togglePinnedSpeaker = (id: string): void =>
    actions$.next({ type: "toggle", id });

  const requestedPinnedSpeakerId$ = scope.behavior<string | null>(
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

  return { requestedPinnedSpeakerId$, setPinnedSpeaker, togglePinnedSpeaker };
}

/**
 * Creates the state needed for manually pinning a participant's tile to the
 * spotlight, overriding the automatic (speaker-based) selection.
 *
 * The pin is automatically cleared once the pinned participant's media is no
 * longer present in the call (e.g. they left).
 *
 * @param scope - The observable scope to manage subscriptions.
 * @param requestedPinnedSpeakerId$ - The raw pin request, from
 * `createRequestedPinnedSpeaker$`.
 * @param userMedia$ - The list of user media currently participating in the
 * call, used to detect when the pinned participant leaves.
 */
export function createPinnedSpeaker$(
  scope: ObservableScope,
  requestedPinnedSpeakerId$: Behavior<string | null>,
  userMedia$: Behavior<UserMediaViewModel[]>,
): {
  pinnedSpeakerId$: Behavior<string | null>;
} {
  /**
   * The pinned speaker's id, automatically cleared once that participant's
   * media is no longer part of the call.
   */
  const pinnedSpeakerId$ = scope.behavior<string | null>(
    combineLatest(
      [requestedPinnedSpeakerId$, userMedia$],
      (pin, userMedia) =>
        pin !== null && userMedia.some((m) => m.id === pin) ? pin : null,
    ),
  );

  return { pinnedSpeakerId$ };
}
