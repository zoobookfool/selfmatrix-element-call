/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, describe, expect, it } from "vitest";

import { canUseBrowserStreamPopout } from "./usePopoutScreenShare";

describe("canUseBrowserStreamPopout", () => {
  afterEach(() => {
    Object.defineProperty(window, "selfmatrixCallWindow", {
      configurable: true,
      value: undefined,
    });
  });

  it("keeps the browser stream popout available on web", () => {
    expect(canUseBrowserStreamPopout()).toBe(true);
  });

  it("hides the browser-only control in the native call view", () => {
    Object.defineProperty(window, "selfmatrixCallWindow", {
      configurable: true,
      value: {},
    });

    expect(canUseBrowserStreamPopout()).toBe(false);
  });
});
