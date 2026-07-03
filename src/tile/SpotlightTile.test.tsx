/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { test, expect, vi } from "vitest";
import { act, isInaccessible, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@vector-im/compound-web";
import { BehaviorSubject } from "rxjs";

import { SpotlightTile } from "./SpotlightTile";
import {
  mockLocalParticipant,
  mockMediaDevices,
  mockRtcMembership,
  mockLocalMedia,
  mockRemoteMedia,
  mockRemoteParticipant,
  mockRemoteScreenShare,
} from "../utils/test";
import { SpotlightTileViewModel } from "../state/TileViewModel";
import { constant } from "../state/Behavior";
import {
  createRingingMedia,
  type RingingMediaViewModel,
} from "../state/media/RingingMediaViewModel";
import { type MuteStates } from "../state/MuteStates";

global.IntersectionObserver = class MockIntersectionObserver {
  public observe(): void {}
  public unobserve(): void {}
} as unknown as typeof IntersectionObserver;

test("SpotlightTile is accessible", async () => {
  const vm1 = mockRemoteMedia(
    mockRtcMembership("@alice:example.org", "AAAA"),
    {
      rawDisplayName: "Alice",
      getMxcAvatarUrl: () => "mxc://adfsg",
    },
    mockRemoteParticipant({}),
  );

  const vm2 = mockLocalMedia(
    mockRtcMembership("@bob:example.org", "BBBB"),
    {
      rawDisplayName: "Bob",
      getMxcAvatarUrl: () => "mxc://dlskf",
    },
    mockLocalParticipant({}),
    mockMediaDevices({}),
  );

  const user = userEvent.setup();
  const toggleExpanded = vi.fn();
  const { container } = render(
    <SpotlightTile
      vm={new SpotlightTileViewModel(constant([vm1, vm2]), constant(false))}
      targetWidth={300}
      targetHeight={200}
      expanded={false}
      onToggleExpanded={toggleExpanded}
      showIndicators
      showNameTags
      focusable={true}
    />,
  );

  expect(await axe(container)).toHaveNoViolations();
  // Alice should be in the spotlight, with her name and avatar on the
  // first page
  screen.getByText("Alice");
  const aliceAvatar = screen.getByRole("img");
  expect(screen.queryByRole("button", { name: "common.back" })).toBe(null);
  // Bob should be out of the spotlight, and therefore invisible
  expect(isInaccessible(screen.getByText("Bob"))).toBe(true);
  // Now navigate to Bob
  await user.click(screen.getByRole("button", { name: "Next" }));
  screen.getByText("Bob");
  expect(screen.getByRole("img")).not.toBe(aliceAvatar);
  expect(isInaccessible(screen.getByText("Alice"))).toBe(true);
  // Can toggle whether the tile is expanded
  await user.click(screen.getByRole("button", { name: "Expand" }));
  expect(toggleExpanded).toHaveBeenCalled();
});

test("Screen share volume UI is shown when screen share has audio", async () => {
  const vm = mockRemoteScreenShare(
    mockRtcMembership("@alice:example.org", "AAAA"),
    {},
    mockRemoteParticipant({}),
  );

  vi.spyOn(vm, "audioEnabled$", "get").mockReturnValue(constant(true));

  const toggleExpanded = vi.fn();
  const { container } = render(
    <TooltipProvider>
      <SpotlightTile
        vm={new SpotlightTileViewModel(constant([vm]), constant(false))}
        targetWidth={300}
        targetHeight={200}
        expanded={false}
        onToggleExpanded={toggleExpanded}
        showIndicators
        showNameTags
        focusable
      />
    </TooltipProvider>,
  );

  expect(await axe(container)).toHaveNoViolations();

  // Volume menu button should exist
  expect(screen.queryByRole("button", { name: /volume/i })).toBeInTheDocument();
});

test("Screen share volume UI is hidden when screen share has no audio", async () => {
  const vm = mockRemoteScreenShare(
    mockRtcMembership("@alice:example.org", "AAAA"),
    {},
    mockRemoteParticipant({}),
  );

  vi.spyOn(vm, "audioEnabled$", "get").mockReturnValue(constant(false));

  const toggleExpanded = vi.fn();
  const { container } = render(
    <SpotlightTile
      vm={new SpotlightTileViewModel(constant([vm]), constant(false))}
      targetWidth={300}
      targetHeight={200}
      expanded={false}
      onToggleExpanded={toggleExpanded}
      showIndicators
      showNameTags
      focusable
    />,
  );

  expect(await axe(container)).toHaveNoViolations();

  // Volume menu button should not exist
  expect(
    screen.queryByRole("button", { name: /volume/i }),
  ).not.toBeInTheDocument();
});

test("Remote screen share shows a watch gate until the user opts in", async () => {
  const vm = mockRemoteScreenShare(
    mockRtcMembership("@alice:example.org", "AAAA"),
    { rawDisplayName: "Alice" },
    mockRemoteParticipant({}),
  );

  const user = userEvent.setup();
  const toggleExpanded = vi.fn();
  const { container } = render(
    <TooltipProvider>
      <SpotlightTile
        vm={new SpotlightTileViewModel(constant([vm]), constant(false))}
        targetWidth={300}
        targetHeight={200}
        expanded={false}
        onToggleExpanded={toggleExpanded}
        showIndicators
        showNameTags
        focusable
      />
    </TooltipProvider>,
  );

  expect(await axe(container)).toHaveNoViolations();

  // Not watching yet: the gate is shown, and there is no unwatch/popout button
  const watchButton = screen.getByTestId("incall_watch");
  expect(watchButton).toBeInTheDocument();
  expect(screen.queryByTestId("incall_unwatch")).not.toBeInTheDocument();
  expect(vm.watching$.value).toBe(false);

  await user.click(watchButton);

  // Opting in flips the view model's watching state and swaps the gate for
  // the "stop watching" control.
  expect(vm.watching$.value).toBe(true);
  expect(screen.queryByTestId("incall_watch")).not.toBeInTheDocument();
  const unwatchButton = screen.getByTestId("incall_unwatch");
  expect(unwatchButton).toBeInTheDocument();

  await user.click(unwatchButton);

  expect(vm.watching$.value).toBe(false);
  expect(screen.getByTestId("incall_watch")).toBeInTheDocument();
});

test("Split toggle is hidden with a single spotlight item", () => {
  const vm1 = mockRemoteMedia(
    mockRtcMembership("@alice:example.org", "AAAA"),
    { rawDisplayName: "Alice" },
    mockRemoteParticipant({}),
  );

  const toggleExpanded = vi.fn();
  render(
    <SpotlightTile
      vm={new SpotlightTileViewModel(constant([vm1]), constant(false))}
      targetWidth={300}
      targetHeight={200}
      expanded={false}
      onToggleExpanded={toggleExpanded}
      showIndicators
      showNameTags
      focusable={true}
    />,
  );

  expect(screen.queryByTestId("incall_split")).not.toBeInTheDocument();
});

test("Split mode shows two panes that each render an existing spotlight item", async () => {
  const vm1 = mockRemoteMedia(
    mockRtcMembership("@alice:example.org", "AAAA"),
    { rawDisplayName: "Alice" },
    mockRemoteParticipant({}),
  );

  const vm2 = mockLocalMedia(
    mockRtcMembership("@bob:example.org", "BBBB"),
    { rawDisplayName: "Bob" },
    mockLocalParticipant({}),
    mockMediaDevices({}),
  );

  const user = userEvent.setup();
  const toggleExpanded = vi.fn();
  const { container } = render(
    <SpotlightTile
      vm={new SpotlightTileViewModel(constant([vm1, vm2]), constant(false))}
      targetWidth={300}
      targetHeight={200}
      expanded={false}
      onToggleExpanded={toggleExpanded}
      showIndicators
      showNameTags
      focusable={true}
    />,
  );

  // Split button only appears once there are 2+ items in the spotlight.
  const splitButton = screen.getByTestId("incall_split");
  expect(splitButton).toHaveAttribute("aria-pressed", "false");

  await user.click(splitButton);

  expect(await axe(container)).toHaveNoViolations();
  expect(splitButton).toHaveAttribute("aria-pressed", "true");

  // Both panes should be present, and both Alice and Bob should be visible
  // at once (unlike the carousel, where only one item is visible).
  const panes = screen.getAllByTestId("split_pane");
  expect(panes).toHaveLength(2);
  expect(isInaccessible(screen.getByText("Alice"))).toBe(false);
  expect(isInaccessible(screen.getByText("Bob"))).toBe(false);

  // The carousel's back/next/indicator controls are not relevant while split.
  expect(screen.queryByRole("button", { name: "common.back" })).toBe(null);
  expect(screen.queryByRole("button", { name: "Next" })).toBe(null);

  // Clicking again returns to the single-pane carousel.
  await user.click(splitButton);
  expect(splitButton).toHaveAttribute("aria-pressed", "false");
  expect(screen.queryAllByTestId("split_pane")).toHaveLength(0);
});

test("Split mode auto-disables once the spotlight drops to a single item", async () => {
  const vm1 = mockRemoteMedia(
    mockRtcMembership("@alice:example.org", "AAAA"),
    { rawDisplayName: "Alice" },
    mockRemoteParticipant({}),
  );

  const vm2 = mockLocalMedia(
    mockRtcMembership("@bob:example.org", "BBBB"),
    { rawDisplayName: "Bob" },
    mockLocalParticipant({}),
    mockMediaDevices({}),
  );

  const user = userEvent.setup();
  const toggleExpanded = vi.fn();
  const media$ = new BehaviorSubject([vm1, vm2]);
  render(
    <SpotlightTile
      vm={new SpotlightTileViewModel(media$, constant(false))}
      targetWidth={300}
      targetHeight={200}
      expanded={false}
      onToggleExpanded={toggleExpanded}
      showIndicators
      showNameTags
      focusable={true}
    />,
  );

  await user.click(screen.getByTestId("incall_split"));
  expect(screen.getAllByTestId("split_pane")).toHaveLength(2);

  act(() => media$.next([vm1]));

  expect(screen.queryByTestId("incall_split")).not.toBeInTheDocument();
  expect(screen.queryAllByTestId("split_pane")).toHaveLength(0);
});

test("Split pane's next button cycles through media, skipping the other pane", async () => {
  const vm1 = mockRemoteMedia(
    mockRtcMembership("@alice:example.org", "AAAA"),
    { rawDisplayName: "Alice" },
    mockRemoteParticipant({}),
  );

  const vm2 = mockLocalMedia(
    mockRtcMembership("@bob:example.org", "BBBB"),
    { rawDisplayName: "Bob" },
    mockLocalParticipant({}),
    mockMediaDevices({}),
  );

  const vm3 = mockRemoteScreenShare(
    mockRtcMembership("@carol:example.org", "CCCC"),
    { rawDisplayName: "Carol" },
    mockRemoteParticipant({}),
  );

  const user = userEvent.setup();
  const toggleExpanded = vi.fn();
  render(
    <SpotlightTile
      vm={
        new SpotlightTileViewModel(constant([vm1, vm2, vm3]), constant(false))
      }
      targetWidth={300}
      targetHeight={200}
      expanded={false}
      onToggleExpanded={toggleExpanded}
      showIndicators
      showNameTags
      focusable={true}
    />,
  );

  await user.click(screen.getByTestId("incall_split"));

  // Default split: Alice on the left, Bob on the right.
  screen.getByText("Alice");
  screen.getByText("Bob");
  expect(screen.queryByText("Carol")).toBe(null);

  // With 3+ items, each pane gets its own "next" control.
  const nextButtons = screen.getAllByTestId("split_pane_next");
  expect(nextButtons).toHaveLength(2);

  // Advance the left pane: it should skip over Bob (shown on the right) and
  // land on Carol.
  await user.click(nextButtons[0]);
  expect(screen.queryByText("Alice")).toBe(null);
  screen.getByText("Carol");
  screen.getByText("Bob");
});

test("SpotlightTile displays ringing media", async () => {
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

  const toggleExpanded = vi.fn();
  const { container } = render(
    <SpotlightTile
      vm={new SpotlightTileViewModel(constant([vm]), constant(false))}
      targetWidth={300}
      targetHeight={200}
      expanded={false}
      onToggleExpanded={toggleExpanded}
      showIndicators
      showNameTags
      focusable={true}
    />,
  );

  expect(await axe(container)).toHaveNoViolations();
  // Alice should be in the spotlight with the right status
  screen.getByText("Alice");
  screen.getByText("Calling…");

  // Now we time out ringing to Alice
  act(() => pickupState$.next("timeout"));
  screen.getByText("Call ended");
});
