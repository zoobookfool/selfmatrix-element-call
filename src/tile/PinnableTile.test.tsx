/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type RemoteTrackPublication } from "livekit-client";
import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { type MatrixRTCSession } from "matrix-js-sdk/lib/matrixrtc";

import { PinnableTile } from "./PinnableTile";
import {
  mockRtcMembership,
  mockRemoteMedia,
  mockRemoteParticipant,
} from "../utils/test";
import { GridTileViewModel } from "../state/TileViewModel";
import { ReactionsSenderProvider } from "../reactions/useReactionsSender";
import type { CallViewModel } from "../state/CallViewModel/CallViewModel";
import { constant } from "../state/Behavior";

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

function makeVm(): GridTileViewModel {
  const media = mockRemoteMedia(
    mockRtcMembership("@alice:example.org", "AAAA"),
    { rawDisplayName: "Alice", getMxcAvatarUrl: () => "mxc://adfsg" },
    mockRemoteParticipant({
      setVolume() {},
      getTrackPublication: () =>
        ({}) as Partial<RemoteTrackPublication> as RemoteTrackPublication,
    }),
  );
  return new GridTileViewModel(constant(media));
}

function renderTile(
  props: Partial<React.ComponentProps<typeof PinnableTile>> = {},
): ReturnType<typeof render> {
  return render(
    <ReactionsSenderProvider vm={callVm} rtcSession={fakeRtcSession}>
      <PinnableTile
        vm={makeVm()}
        pinnedSpeakerId={null}
        onTogglePinned={() => {}}
        onOpenProfile={null}
        targetWidth={300}
        targetHeight={200}
        showSpeakingIndicators
        showNameTags
        focusable
        {...props}
      />
    </ReactionsSenderProvider>,
  );
}

test("data-testid is always tile_pin, in pin mode", () => {
  renderTile({ emphasisEnabled: false });
  const tile = screen.getByTestId("tile_pin");
  expect(tile).toBeInTheDocument();
  expect(tile.getAttribute("data-emphasis-interactive")).toBeNull();
});

test("data-testid is always tile_pin, in emphasis mode too", () => {
  renderTile({
    emphasisEnabled: true,
    onToggleEmphasized: () => {},
    emphasized: false,
  });
  // Still the same testid - not "tile_emphasis" - so tooling doesn't need to
  // branch on emphasis state to find the tile (SelfMatrix FIX-5a).
  const tile = screen.getByTestId("tile_pin");
  expect(tile).toBeInTheDocument();
  expect(tile.getAttribute("data-emphasis-interactive")).toBe("true");
});

test("data-emphasized reflects the emphasized state while in emphasis mode", () => {
  const { rerender } = renderTile({
    emphasisEnabled: true,
    onToggleEmphasized: () => {},
    emphasized: false,
  });
  expect(screen.getByTestId("tile_pin").getAttribute("data-emphasized")).toBe(
    "false",
  );

  rerender(
    <ReactionsSenderProvider vm={callVm} rtcSession={fakeRtcSession}>
      <PinnableTile
        vm={makeVm()}
        pinnedSpeakerId={null}
        onTogglePinned={() => {}}
        onOpenProfile={null}
        targetWidth={300}
        targetHeight={200}
        showSpeakingIndicators
        showNameTags
        focusable
        emphasisEnabled
        onToggleEmphasized={() => {}}
        emphasized
      />
    </ReactionsSenderProvider>,
  );
  expect(screen.getByTestId("tile_pin").getAttribute("data-emphasized")).toBe(
    "true",
  );
});

test("clicking the tile toggles emphasis (not pin) while emphasis is enabled", () => {
  const onToggleEmphasized = vi.fn();
  const onTogglePinned = vi.fn();
  renderTile({
    emphasisEnabled: true,
    onToggleEmphasized,
    onTogglePinned,
    emphasized: false,
  });

  screen.getByTestId("tile_pin").click();

  // mockRemoteMedia always creates media with id "remote".
  expect(onToggleEmphasized).toHaveBeenCalledWith("remote");
  expect(onTogglePinned).not.toHaveBeenCalled();
});
