/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, test, vi } from "vitest";
import {
  RemoteTrackPublication,
  Track,
  VideoQuality,
  type RemoteParticipant,
} from "livekit-client";
import { TrackInfo } from "@livekit/protocol";

import {
  createWrappedUserMedia,
  type WrappedUserMediaViewModel,
} from "./WrappedUserMediaViewModel";
import { constant } from "../Behavior";
import { E2eeType } from "../../e2ee/e2eeType";
import {
  flushPromises,
  mockRemoteParticipant,
  testScope,
} from "../../utils/test";

global.MediaStreamTrack = class {} as unknown as {
  new (): MediaStreamTrack;
  prototype: MediaStreamTrack;
};
global.MediaStream = class {} as unknown as {
  new (): MediaStream;
  prototype: MediaStream;
};

function mockPublication(sid: string): RemoteTrackPublication {
  const publication = new RemoteTrackPublication(
    Track.Kind.Video,
    new TrackInfo({ sid, name: sid }),
    true, // autoSubscribe, matching LiveKit's real default
  );
  vi.spyOn(publication, "setSubscribed");
  vi.spyOn(publication, "setVideoQuality");
  return publication;
}

/**
 * Sets up a remote member (with an active screen share) via
 * createWrappedUserMedia, given the raw pin request id to forward.
 */
function setUp(requestedPinnedSpeakerId: string | null): {
  memberId: string;
  video: RemoteTrackPublication;
  wrapped: WrappedUserMediaViewModel;
} {
  const memberId = "@alice:example.org:AAAA:0";
  const video = mockPublication("video");
  const audio = mockPublication("audio");

  const participant: RemoteParticipant = mockRemoteParticipant({
    isScreenShareEnabled: true,
    getTrackPublication: (source) => {
      if (source === Track.Source.ScreenShare) return video;
      if (source === Track.Source.ScreenShareAudio) return audio;
      return undefined as unknown as RemoteTrackPublication;
    },
  });

  const wrapped = createWrappedUserMedia(testScope(), {
    id: memberId,
    userId: "@alice:example.org",
    rtcBackendIdentity: "backend",
    participant: { type: "remote", value$: constant(participant) },
    encryptionSystem: { kind: E2eeType.PER_PARTICIPANT },
    livekitRoom$: constant(undefined),
    focusUrl$: constant("https://rtc-example.org"),
    mediaDevices: {} as never,
    pretendToBeDisconnected$: constant(false),
    displayName$: constant("Alice"),
    mxcAvatarUrl$: constant(undefined),
    handRaised$: constant(null),
    reaction$: constant(null),
    requestedPinnedSpeakerId$: constant(requestedPinnedSpeakerId),
  });

  return { memberId, video, wrapped };
}

function getScreenShareId(wrapped: WrappedUserMediaViewModel): string {
  const shares = wrapped.screenShares$.value;
  expect(shares).toHaveLength(1);
  return shares[0].id;
}

describe("createWrappedUserMedia (FIX-1: screen share pin wiring)", () => {
  test("pinning the screen share tile's own id raises its quality to HIGH", async () => {
    // First, discover the share tile's id with no pin in effect.
    const probe = setUp(null);
    await flushPromises();
    const shareId = getScreenShareId(probe.wrapped);
    expect(shareId).toBe(`${probe.memberId}:screen-share`);

    // Now pin *that* id specifically (not the member's id).
    const { video, wrapped } = setUp(shareId);
    const share = wrapped.screenShares$.value[0];
    if (!share.local) share.setWatching(true);
    await flushPromises();

    expect(video.setVideoQuality).toHaveBeenCalledWith(VideoQuality.HIGH);
  });

  test("pinning the owning member's id does NOT raise the screen share's quality", async () => {
    // Discover the member's own id first (setUp always uses the same fixed
    // member id internally), then request a pin *on that member id* - which
    // must be treated differently from pinning the share tile's own id.
    const probe = setUp(null);
    const memberId = probe.memberId;

    const { video, wrapped } = setUp(memberId);
    const share = wrapped.screenShares$.value[0];
    if (!share.local) share.setWatching(true);
    await flushPromises();

    // The member id itself was requested as pinned, but the share tile's id
    // is different (`${memberId}:screen-share`), so its quality must stay LOW.
    expect(video.setVideoQuality).toHaveBeenCalledWith(VideoQuality.LOW);
    expect(video.setVideoQuality).not.toHaveBeenCalledWith(VideoQuality.HIGH);
    // sanity: memberId itself is indeed distinct from the share tile's id
    expect(memberId).not.toBe(`${memberId}:screen-share`);
  });

  test("no pin request at all leaves the screen share's quality at LOW", async () => {
    const { video, wrapped } = setUp(null);
    const share = wrapped.screenShares$.value[0];
    if (!share.local) share.setWatching(true);
    await flushPromises();

    expect(video.setVideoQuality).toHaveBeenCalledWith(VideoQuality.LOW);
  });
});
