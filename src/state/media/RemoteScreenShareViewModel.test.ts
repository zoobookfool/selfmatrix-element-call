/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, test, vi } from "vitest";
import {
  ParticipantEvent,
  RemoteTrackPublication,
  Track,
  VideoQuality,
} from "livekit-client";
import { TrackInfo } from "@livekit/protocol";

import { createRemoteScreenShare } from "./RemoteScreenShareViewModel";
import { constant } from "../Behavior";
import {
  flushPromises,
  mockRemoteParticipant,
  testScope,
} from "../../utils/test";

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

describe("RemoteScreenShareViewModel", () => {
  test("does not subscribe to tracks until watching is enabled", async () => {
    const video = mockPublication("video");
    const audio = mockPublication("audio");
    const participant = mockRemoteParticipant({
      getTrackPublication: (source) => {
        if (source === Track.Source.ScreenShare) return video;
        if (source === Track.Source.ScreenShareAudio) return audio;
        return undefined as unknown as RemoteTrackPublication;
      },
    });

    createRemoteScreenShare(testScope(), {
      id: "screenshare",
      userId: "@alice:example.org",
      participant$: constant(participant),
      encryptionSystem: { kind: 0 } as never,
      livekitRoom$: constant(undefined),
      focusUrl$: constant("https://rtc-example.org"),
      pretendToBeDisconnected$: constant(false),
      displayName$: constant("Alice"),
      mxcAvatarUrl$: constant(undefined),
    });

    await flushPromises();

    expect(video.setSubscribed).toHaveBeenCalledWith(false);
    expect(audio.setSubscribed).toHaveBeenCalledWith(false);
  });

  test("setWatching(true) subscribes to both video and audio tracks", async () => {
    const video = mockPublication("video");
    const audio = mockPublication("audio");
    const participant = mockRemoteParticipant({
      getTrackPublication: (source) => {
        if (source === Track.Source.ScreenShare) return video;
        if (source === Track.Source.ScreenShareAudio) return audio;
        return undefined as unknown as RemoteTrackPublication;
      },
    });

    const vm = createRemoteScreenShare(testScope(), {
      id: "screenshare",
      userId: "@alice:example.org",
      participant$: constant(participant),
      encryptionSystem: { kind: 0 } as never,
      livekitRoom$: constant(undefined),
      focusUrl$: constant("https://rtc-example.org"),
      pretendToBeDisconnected$: constant(false),
      displayName$: constant("Alice"),
      mxcAvatarUrl$: constant(undefined),
    });

    expect(vm.watching$.value).toBe(false);

    vm.setWatching(true);
    await flushPromises();

    expect(vm.watching$.value).toBe(true);
    expect(video.setSubscribed).toHaveBeenCalledWith(true);
    expect(audio.setSubscribed).toHaveBeenCalledWith(true);

    vm.setWatching(false);
    await flushPromises();
    expect(video.setSubscribed).toHaveBeenLastCalledWith(false);
    expect(audio.setSubscribed).toHaveBeenLastCalledWith(false);
  });

  test("re-applies the desired subscription state when a publication appears later", async () => {
    const audio = mockPublication("audio");
    const videoBox: { current?: RemoteTrackPublication } = {};
    const participant = mockRemoteParticipant({
      getTrackPublication: (source) => {
        if (source === Track.Source.ScreenShare) return videoBox.current!;
        if (source === Track.Source.ScreenShareAudio) return audio;
        return undefined as unknown as RemoteTrackPublication;
      },
    });

    const vm = createRemoteScreenShare(testScope(), {
      id: "screenshare",
      userId: "@alice:example.org",
      participant$: constant(participant),
      encryptionSystem: { kind: 0 } as never,
      livekitRoom$: constant(undefined),
      focusUrl$: constant("https://rtc-example.org"),
      pretendToBeDisconnected$: constant(false),
      displayName$: constant("Alice"),
      mxcAvatarUrl$: constant(undefined),
    });

    // The user opts in before the video publication exists yet.
    vm.setWatching(true);
    await flushPromises();

    // The screen share starts publishing afterwards.
    videoBox.current = mockPublication("video");
    participant.emit(ParticipantEvent.TrackPublished, videoBox.current);
    await flushPromises();

    expect(videoBox.current.setSubscribed).toHaveBeenCalledWith(true);
  });

  describe("video quality control (SelfMatrix)", () => {
    /**
     * Sets up a remote screen share with mock video/audio publications, and
     * optionally opts in to watching it.
     */
    function setUp({
      pinned = false,
      watching = true,
    }: {
      pinned?: boolean;
      watching?: boolean;
    }): {
      video: RemoteTrackPublication;
      audio: RemoteTrackPublication;
    } {
      const video = mockPublication("video");
      const audio = mockPublication("audio");
      const participant = mockRemoteParticipant({
        getTrackPublication: (source) => {
          if (source === Track.Source.ScreenShare) return video;
          if (source === Track.Source.ScreenShareAudio) return audio;
          return undefined as unknown as RemoteTrackPublication;
        },
      });

      const vm = createRemoteScreenShare(testScope(), {
        id: "screenshare",
        userId: "@alice:example.org",
        participant$: constant(participant),
        encryptionSystem: { kind: 0 } as never,
        livekitRoom$: constant(undefined),
        focusUrl$: constant("https://rtc-example.org"),
        pretendToBeDisconnected$: constant(false),
        displayName$: constant("Alice"),
        mxcAvatarUrl$: constant(undefined),
        pinned$: constant(pinned),
      });
      if (watching) vm.setWatching(true);

      return { video, audio };
    }

    test("sets video quality to HIGH when pinned and watching", async () => {
      const { video } = setUp({ pinned: true, watching: true });
      await flushPromises();

      expect(video.setVideoQuality).toHaveBeenCalledWith(VideoQuality.HIGH);
    });

    test("sets video quality to LOW when not pinned but watching", async () => {
      const { video } = setUp({ pinned: false, watching: true });
      await flushPromises();

      expect(video.setVideoQuality).toHaveBeenCalledWith(VideoQuality.LOW);
    });

    test("does not set video quality while not watching (unsubscribed)", async () => {
      const { video } = setUp({ pinned: true, watching: false });
      await flushPromises();

      expect(video.setVideoQuality).not.toHaveBeenCalled();
    });
  });
});
