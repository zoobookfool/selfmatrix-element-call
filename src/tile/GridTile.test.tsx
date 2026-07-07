/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type RemoteTrackPublication } from "livekit-client";
import { test, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { type MatrixRTCSession } from "matrix-js-sdk/lib/matrixrtc";
import { BehaviorSubject } from "rxjs";

import { GridTile } from "./GridTile";
import {
  mockLivekitRoom,
  mockLocalParticipant,
  mockRtcMembership,
  mockRemoteMedia,
  mockRemoteParticipant,
  mockRemoteScreenShare,
  testScope,
} from "../utils/test";
import { GridTileViewModel } from "../state/TileViewModel";
import { ReactionsSenderProvider } from "../reactions/useReactionsSender";
import type { CallViewModel } from "../state/CallViewModel/CallViewModel";
import { constant } from "../state/Behavior";
import {
  createRingingMedia,
  type RingingMediaViewModel,
} from "../state/media/RingingMediaViewModel";
import { type MuteStates } from "../state/MuteStates";
import { createLocalScreenShare } from "../state/media/LocalScreenShareViewModel";
import { E2eeType } from "../e2ee/e2eeType";

global.IntersectionObserver = class MockIntersectionObserver {
  public observe(): void {}
  public unobserve(): void {}
  public disconnect(): void {}
} as unknown as typeof IntersectionObserver;

const fakeRtcSession = {
  on: () => {},
  off: () => {},
  room: {
    on: () => {},
    off: () => {},
    client: {
      getUserId: () => null,
      getDeviceId: () => null,
      on: () => {},
      off: () => {},
    },
  },
  memberships: [],
} as unknown as MatrixRTCSession;

const callVm = {
  reactions$: constant({}),
  handsRaised$: constant({}),
} as Partial<CallViewModel> as CallViewModel;

test("GridTile is accessible", async () => {
  const vm = mockRemoteMedia(
    mockRtcMembership("@alice:example.org", "AAAA"),
    {
      rawDisplayName: "Alice",
      getMxcAvatarUrl: () => "mxc://adfsg",
    },
    mockRemoteParticipant({
      setVolume() {},
      getTrackPublication: () =>
        ({}) as Partial<RemoteTrackPublication> as RemoteTrackPublication,
    }),
  );

  const { container } = render(
    <ReactionsSenderProvider vm={callVm} rtcSession={fakeRtcSession}>
      <GridTile
        vm={new GridTileViewModel(constant(vm))}
        onOpenProfile={() => {}}
        targetWidth={300}
        targetHeight={200}
        showSpeakingIndicators
        showNameTags
        focusable
      />
    </ReactionsSenderProvider>,
  );
  expect(await axe(container)).toHaveNoViolations();
  // Name should be visible
  screen.getByText("Alice");
});

test("GridTile displays ringing media", async () => {
  const pickupState$ = new BehaviorSubject<
    RingingMediaViewModel["pickupState$"]["value"]
  >("ringing");
  const vm = createRingingMedia({
    pickupState$,
    muteStates: {
      video: { enabled$: constant(false) },
    } as unknown as MuteStates,
    id: "test",
    userId: "@alice:example.org",
    displayName$: constant("Alice"),
    mxcAvatarUrl$: constant(undefined),
  });

  const { container } = render(
    <ReactionsSenderProvider vm={callVm} rtcSession={fakeRtcSession}>
      <GridTile
        vm={new GridTileViewModel(constant(vm))}
        onOpenProfile={() => {}}
        targetWidth={300}
        targetHeight={200}
        showSpeakingIndicators
        showNameTags
        focusable
      />
    </ReactionsSenderProvider>,
  );
  expect(await axe(container)).toHaveNoViolations();
  // Name and status should be visible
  screen.getByText("Alice");
  screen.getByText("Calling…");

  // Alice declines the call
  act(() => pickupState$.next("decline"));
  screen.getByText("Call ended");
});

test("GridTile displays a watched remote screen share as an ordinary tile", async () => {
  // SelfMatrix (UI design notes v1.4, agreement 1/2): watched screen shares
  // ("配信") are mixed into the grid as ordinary tiles - GridTile must be
  // able to render them directly (not just user/ringing media). Only
  // watched shares ever reach the grid (see CallViewModel's grid$/
  // watchedScreenShares$), so this always shows the "stop watching" control,
  // never a watch gate.
  const vm = mockRemoteScreenShare(
    mockRtcMembership("@alice:example.org", "AAAA"),
    { rawDisplayName: "Alice" },
    mockRemoteParticipant({}),
  );
  vm.setWatching(true);

  const { container } = render(
    <ReactionsSenderProvider vm={callVm} rtcSession={fakeRtcSession}>
      <GridTile
        vm={new GridTileViewModel(constant(vm))}
        onOpenProfile={() => {}}
        targetWidth={300}
        targetHeight={200}
        showSpeakingIndicators
        showNameTags
        focusable
      />
    </ReactionsSenderProvider>,
  );
  expect(await axe(container)).toHaveNoViolations();

  screen.getByText("Alice");
  const unwatchButton = screen.getByTestId("incall_unwatch");
  expect(unwatchButton).toBeInTheDocument();

  act(() => {
    unwatchButton.click();
  });
  expect(vm.watching$.value).toBe(false);
});

test("GridTile shows volume control on watched remote screen shares", async () => {
  const vm = mockRemoteScreenShare(
    mockRtcMembership("@alice:example.org", "AAAA"),
    { rawDisplayName: "Alice" },
    mockRemoteParticipant({}),
  );
  vm.setWatching(true);
  vi.spyOn(vm, "audioEnabled$", "get").mockReturnValue(constant(true));

  const { container } = render(
    <ReactionsSenderProvider vm={callVm} rtcSession={fakeRtcSession}>
      <GridTile
        vm={new GridTileViewModel(constant(vm))}
        onOpenProfile={() => {}}
        targetWidth={300}
        targetHeight={200}
        showSpeakingIndicators
        showNameTags
        focusable
      />
    </ReactionsSenderProvider>,
  );
  expect(await axe(container)).toHaveNoViolations();

  expect(
    screen.getByRole("button", { name: /screen share volume/i }),
  ).toBeInTheDocument();
});

test("GridTile hides screen share volume control when unavailable", () => {
  const remoteVm = mockRemoteScreenShare(
    mockRtcMembership("@alice:example.org", "AAAA"),
    { rawDisplayName: "Alice" },
    mockRemoteParticipant({}),
  );
  remoteVm.setWatching(true);
  vi.spyOn(remoteVm, "audioEnabled$", "get").mockReturnValue(constant(false));

  const { unmount } = render(
    <ReactionsSenderProvider vm={callVm} rtcSession={fakeRtcSession}>
      <GridTile
        vm={new GridTileViewModel(constant(remoteVm))}
        onOpenProfile={() => {}}
        targetWidth={300}
        targetHeight={200}
        showSpeakingIndicators
        showNameTags
        focusable
      />
    </ReactionsSenderProvider>,
  );

  expect(
    screen.queryByRole("button", { name: /screen share volume/i }),
  ).not.toBeInTheDocument();
  unmount();

  const localParticipant = mockLocalParticipant({});
  const localVm = createLocalScreenShare(testScope(), {
    id: "local-screen-share",
    userId: "@alice:example.org",
    participant$: constant(localParticipant),
    encryptionSystem: { kind: E2eeType.PER_PARTICIPANT },
    livekitRoom$: constant(mockLivekitRoom({ localParticipant })),
    focusUrl$: constant("https://rtc-example.org"),
    displayName$: constant("Alice"),
    mxcAvatarUrl$: constant(undefined),
  });

  render(
    <ReactionsSenderProvider vm={callVm} rtcSession={fakeRtcSession}>
      <GridTile
        vm={new GridTileViewModel(constant(localVm))}
        onOpenProfile={() => {}}
        targetWidth={300}
        targetHeight={200}
        showSpeakingIndicators
        showNameTags
        focusable
      />
    </ReactionsSenderProvider>,
  );

  expect(
    screen.queryByRole("button", { name: /screen share volume/i }),
  ).not.toBeInTheDocument();
});
