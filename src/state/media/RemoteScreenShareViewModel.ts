/*
Copyright 2023, 2024 New Vector Ltd.
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  RemoteTrackPublication,
  Track,
  type RemoteParticipant,
  type TrackPublication,
} from "livekit-client";
import { BehaviorSubject, combineLatest, map, of, switchMap } from "rxjs";
import { logger } from "matrix-js-sdk/lib/logger";

import { type Behavior } from "../Behavior";
import {
  type BaseScreenShareInputs,
  type BaseScreenShareViewModel,
  createBaseScreenShare,
} from "./ScreenShareViewModel";
import { type ObservableScope } from "../ObservableScope";
import { createVolumeControls, type VolumeControls } from "../VolumeControls";
import { observeTrackReference$ } from "../observeTrackReference";

export interface RemoteScreenShareViewModel
  extends BaseScreenShareViewModel, VolumeControls {
  local: false;
  /**
   * Whether this screen share's video should be displayed.
   */
  videoEnabled$: Behavior<boolean>;
  /**
   * Whether this screen share should be considered to have an audio track.
   */
  audioEnabled$: Behavior<boolean>;
  /**
   * Whether the local user has opted in to watching this remote screen
   * share. Remote screen shares are opt-in: until this is true, we do not
   * hold a LiveKit subscription for the ScreenShare/ScreenShareAudio tracks,
   * to avoid spending bandwidth on streams nobody is looking at.
   */
  watching$: Behavior<boolean>;
  /**
   * Sets whether the local user wants to watch this remote screen share.
   * Toggling this subscribes/unsubscribes the underlying LiveKit tracks.
   */
  setWatching(watching: boolean): void;
}

export interface RemoteScreenShareInputs extends BaseScreenShareInputs {
  participant$: Behavior<RemoteParticipant | null>;
  pretendToBeDisconnected$: Behavior<boolean>;
}

/**
 * Applies the desired subscription state to a single track publication's
 * `setSubscribed`, swallowing (and logging) any errors. `setSubscribed` is
 * safe to call at any time (it has no `isManualOperationAllowed` guard,
 * unlike e.g. `setEnabled`/`setVideoQuality`), but the publication may not
 * exist yet (screen share not published), or may briefly reflect
 * `autoSubscribe`'s default (subscribed) before our desired state below is
 * applied - that initial race is acceptable (the stream may flash on for a
 * few hundred ms before being stopped).
 */
function applySubscription(
  publication: TrackPublication | undefined,
  subscribed: boolean,
): void {
  // Only RemoteTrackPublications are subscribable; this should always be the
  // case here (these come from a RemoteParticipant), but guard defensively.
  if (!(publication instanceof RemoteTrackPublication)) return;
  try {
    publication.setSubscribed(subscribed);
  } catch (e) {
    logger.warn(
      `RemoteScreenShareViewModel: failed to set subscribed=${subscribed} on track publication`,
      e,
    );
  }
}

export function createRemoteScreenShare(
  scope: ObservableScope,
  { pretendToBeDisconnected$, ...inputs }: RemoteScreenShareInputs,
): RemoteScreenShareViewModel {
  // Not derived from an external source, so we manage this Behavior directly
  // rather than through `scope.behavior`. Screen shares are opt-in: nobody is
  // watching until the user explicitly asks to.
  const watchingSubject$ = new BehaviorSubject(false);
  const watching$: Behavior<boolean> = watchingSubject$;

  // Whenever the desired watching state changes, or the underlying track
  // publications (re)appear (e.g. the share (re)starts, or LiveKit's
  // autoSubscribe default kicks in before we get a chance to react), (re)apply
  // the desired subscription state to both the video and audio publications.
  // Reacting to publication appearance (rather than just `watching$`) is what
  // makes this resilient to publish-after-subscribe ordering and to
  // reconnects resetting the subscription state.
  scope.reconcile(
    scope.behavior(
      combineLatest([watching$, inputs.participant$]).pipe(
        switchMap(([watching, p]) => {
          if (!p) return of({ watching, video: undefined, audio: undefined });
          return combineLatest([
            observeTrackReference$(p, Track.Source.ScreenShare),
            observeTrackReference$(p, Track.Source.ScreenShareAudio),
          ]).pipe(map(([video, audio]) => ({ watching, video, audio })));
        }),
      ),
    ),
    // eslint-disable-next-line @typescript-eslint/require-await -- reconcile's contract requires an async callback, but our work here is synchronous
    async ({ watching, video, audio }) => {
      applySubscription(video?.publication, watching);
      applySubscription(audio?.publication, watching);
    },
  );

  return {
    ...createBaseScreenShare(scope, inputs),
    ...createVolumeControls(scope, {
      pretendToBeDisconnected$,
      sink$: scope.behavior(
        inputs.participant$.pipe(
          map(
            (p) => (volume) =>
              p?.setVolume(volume, Track.Source.ScreenShareAudio),
          ),
        ),
      ),
    }),
    local: false,
    videoEnabled$: scope.behavior(
      pretendToBeDisconnected$.pipe(map((disconnected) => !disconnected)),
    ),
    audioEnabled$: scope.behavior(
      inputs.participant$.pipe(
        switchMap((p) =>
          p
            ? observeTrackReference$(p, Track.Source.ScreenShareAudio)
            : of(null),
        ),
        map(Boolean),
      ),
    ),
    watching$,
    setWatching: (watching: boolean): void => {
      watchingSubject$.next(watching);
    },
  };
}
