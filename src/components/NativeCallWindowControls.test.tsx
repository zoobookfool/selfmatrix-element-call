/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/
/* eslint-disable @typescript-eslint/require-await */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@vector-im/compound-web";

import { NativeCallWindowControls } from "./NativeCallWindowControls";
import type {
  SelfmatrixCallWindowBridge,
  SelfmatrixCallWindowState,
} from "../@types/global";

function installBridge(
  initialState: SelfmatrixCallWindowState,
): SelfmatrixCallWindowBridge {
  const bridge: SelfmatrixCallWindowBridge = {
    getState: vi.fn(async () => initialState),
    popout: vi.fn(async () => ({
      ...initialState,
      placement: "window" as const,
    })),
    popin: vi.fn(async () => ({ ...initialState, placement: "main" as const })),
    toggleAlwaysOnTop: vi.fn(async () => ({
      ...initialState,
      alwaysOnTop: !initialState.alwaysOnTop,
    })),
    toggleFullscreen: vi.fn(async () => ({
      ...initialState,
      fullScreen: !initialState.fullScreen,
    })),
    onStateChange: vi.fn(() => (): void => undefined),
  };
  window.selfmatrixCallWindow = bridge;
  return bridge;
}

afterEach(() => {
  delete window.selfmatrixCallWindow;
});

describe("NativeCallWindowControls", () => {
  test("opens the attached call in a separate window", async () => {
    const user = userEvent.setup();
    const bridge = installBridge({
      placement: "main",
      alwaysOnTop: false,
      fullScreen: false,
    });

    render(
      <TooltipProvider>
        <NativeCallWindowControls location="primary" />
      </TooltipProvider>,
    );

    await user.click(await screen.findByTestId("native_call_popout"));
    expect(bridge.popout).toHaveBeenCalledOnce();
  });

  test("shows pin and fullscreen controls only in the popout", async () => {
    installBridge({
      placement: "window",
      alwaysOnTop: true,
      fullScreen: false,
    });

    render(
      <TooltipProvider>
        <NativeCallWindowControls location="secondary" />
      </TooltipProvider>,
    );

    expect(await screen.findByTestId("native_call_pin")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("native_call_fullscreen")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
