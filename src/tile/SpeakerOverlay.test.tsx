/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";

import { SpeakerOverlay } from "./SpeakerOverlay";
import {
  mockLocalMedia,
  mockLocalParticipant,
  mockMediaDevices,
  mockRemoteMedia,
  mockRemoteParticipant,
  mockRtcMembership,
} from "../utils/test";
import { constant } from "../state/Behavior";
import { type UserMediaViewModel } from "../state/media/UserMediaViewModel";

function mockMembers(): UserMediaViewModel[] {
  const alice = mockRemoteMedia(
    mockRtcMembership("@alice:example.org", "AAAA"),
    { rawDisplayName: "Alice", getMxcAvatarUrl: () => "mxc://alice" },
    mockRemoteParticipant({}),
  );
  const bob = mockLocalMedia(
    mockRtcMembership("@bob:example.org", "BBBB"),
    { rawDisplayName: "Bob", getMxcAvatarUrl: () => undefined },
    mockLocalParticipant({}),
    mockMediaDevices({}),
  );

  vi.spyOn(alice, "speaking$", "get").mockReturnValue(constant(true));
  vi.spyOn(alice, "audioEnabled$", "get").mockReturnValue(constant(true));
  vi.spyOn(bob, "speaking$", "get").mockReturnValue(constant(false));
  vi.spyOn(bob, "audioEnabled$", "get").mockReturnValue(constant(false));

  return [alice, bob];
}

test("SpeakerOverlay is accessible", async () => {
  const members = mockMembers();
  const { container } = render(<SpeakerOverlay members$={constant(members)} />);
  expect(await axe(container)).toHaveNoViolations();
});

test("renders nothing when there are no members", () => {
  render(<SpeakerOverlay members$={constant([])} />);
  expect(screen.queryByTestId("speaker_overlay")).not.toBeInTheDocument();
});

test("renders a pill per member with speaking/muted state reflected", () => {
  const members = mockMembers();
  render(<SpeakerOverlay members$={constant(members)} />);

  expect(screen.getByTestId("speaker_overlay")).toBeInTheDocument();

  const pills = screen.getAllByTestId("speaker_pill");
  expect(pills).toHaveLength(2);

  const alicePill = screen
    .getByText("Alice")
    .closest('[data-testid="speaker_pill"]');
  const bobPill = screen
    .getByText("Bob")
    .closest('[data-testid="speaker_pill"]');

  expect(alicePill).toHaveAttribute("data-speaking", "true");
  expect(alicePill).toHaveAttribute("data-muted", "false");

  expect(bobPill).toHaveAttribute("data-speaking", "false");
  expect(bobPill).toHaveAttribute("data-muted", "true");
});

test("the overlay snaps to the persisted corner", () => {
  const members = mockMembers();
  render(<SpeakerOverlay members$={constant(members)} />);

  const overlay = screen.getByTestId("speaker_overlay");
  // Default alignment set in settings.ts
  expect(overlay).toHaveAttribute("data-block-alignment", "end");
  expect(overlay).toHaveAttribute("data-inline-alignment", "start");
});
