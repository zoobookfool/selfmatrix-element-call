/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { TooltipProvider } from "@vector-im/compound-web";
import { type ReactNode } from "react";

import { ShareScreenMenuButton } from "./ShareScreenMenuButton";
import { screenShareFps, screenShareQuality } from "../settings/settings";

function renderComponent(component: ReactNode): ReturnType<typeof render> {
  return render(<TooltipProvider>{component}</TooltipProvider>);
}

describe("ShareScreenMenuButton", () => {
  beforeEach(() => {
    screenShareQuality.setValue(screenShareQuality.defaultValue);
    screenShareFps.setValue(screenShareFps.defaultValue);
  });

  afterEach(() => {
    screenShareQuality.setValue(screenShareQuality.defaultValue);
    screenShareFps.setValue(screenShareFps.defaultValue);
  });

  test("renders the share screen button", () => {
    const onToggle = vi.fn();
    renderComponent(
      <ShareScreenMenuButton sharing={false} onToggle={onToggle} size="lg" />,
    );

    expect(
      screen.getByRole("switch", { name: "Share screen" }),
    ).toBeInTheDocument();
  });

  test("calls onToggle when the share screen button is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderComponent(
      <ShareScreenMenuButton sharing={false} onToggle={onToggle} size="lg" />,
    );

    await user.click(screen.getByRole("switch", { name: "Share screen" }));
    expect(onToggle).toHaveBeenCalled();
  });

  test("opens the options menu and shows the default 4K/60 selection", async () => {
    const user = userEvent.setup();
    renderComponent(
      <ShareScreenMenuButton sharing={false} onToggle={vi.fn()} size="lg" />,
    );

    await user.click(screen.getByRole("button", { name: "Stream settings" }));

    expect(screen.getByTestId("ss_quality_2160")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("ss_fps_60")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // Sanity check that the other options are not selected.
    expect(screen.getByTestId("ss_quality_720")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByTestId("ss_fps_30")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("clicking a quality option updates the setting", async () => {
    const user = userEvent.setup();
    renderComponent(
      <ShareScreenMenuButton sharing={false} onToggle={vi.fn()} size="lg" />,
    );

    await user.click(screen.getByRole("button", { name: "Stream settings" }));
    await user.click(screen.getByTestId("ss_quality_720"));

    expect(screenShareQuality.getValue()).toBe("720");
  });

  test("clicking an fps option updates the setting", async () => {
    const user = userEvent.setup();
    renderComponent(
      <ShareScreenMenuButton sharing={false} onToggle={vi.fn()} size="lg" />,
    );

    await user.click(screen.getByRole("button", { name: "Stream settings" }));
    await user.click(screen.getByTestId("ss_fps_30"));

    expect(screenShareFps.getValue()).toBe(30);
  });

  test("disables options while sharing", async () => {
    const user = userEvent.setup();
    renderComponent(
      <ShareScreenMenuButton sharing={true} onToggle={vi.fn()} size="lg" />,
    );

    await user.click(screen.getByRole("button", { name: "Stream settings" }));

    expect(screen.getByTestId("ss_quality_720")).toBeDisabled();
    expect(screen.getByTestId("ss_fps_30")).toBeDisabled();
  });

  test("has no accessibility violations", async () => {
    const { container } = renderComponent(
      <ShareScreenMenuButton sharing={false} onToggle={vi.fn()} size="lg" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
