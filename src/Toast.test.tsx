/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, test, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Toast } from "../src/Toast";
import { withFakeTimers } from "./utils/test";

describe("Toast", () => {
  test("renders", () => {
    const { queryByRole } = render(
      <Toast open={false} onDismiss={() => {}}>
        Hello world!
      </Toast>,
    );
    expect(queryByRole("dialog")).toBe(null);
    const { getByRole } = render(
      <Toast open={true} onDismiss={() => {}}>
        Hello world!
      </Toast>,
    );
    expect(getByRole("dialog")).toMatchSnapshot();
  });

  test("dismisses when Esc is pressed", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Toast open={true} onDismiss={onDismiss}>
        Hello world!
      </Toast>,
    );
    await user.keyboard("[Escape]");
    expect(onDismiss).toHaveBeenCalled();
  });

  test("dismisses when background is clicked", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const { getByRole } = render(
      <Toast open={true} onDismiss={onDismiss}>
        Hello world!
      </Toast>,
    );
    const background = getByRole("dialog").previousSibling! as Element;
    await user.click(background);
    expect(onDismiss).toHaveBeenCalled();
  });

  test("dismisses itself after the specified timeout", () => {
    withFakeTimers(() => {
      const onDismiss = vi.fn();
      render(
        <Toast open={true} onDismiss={onDismiss} autoDismiss={2000}>
          Hello world!
        </Toast>,
      );
      vi.advanceTimersByTime(2000);
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  // SelfMatrix Discord-style shell: the optional action button (e.g. "View
  // in spotlight" on the screen-share toast).
  describe("action", () => {
    test("renders the action button with the given label", () => {
      const { getByRole } = render(
        <Toast
          open={true}
          onDismiss={() => {}}
          action={{ label: "View in spotlight", onClick: () => {} }}
        >
          Hello world!
        </Toast>,
      );
      expect(
        getByRole("button", { name: "View in spotlight" }),
      ).toBeInTheDocument();
    });

    test("calls the action's onClick when clicked", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const { getByRole } = render(
        <Toast
          open={true}
          onDismiss={() => {}}
          action={{ label: "View in spotlight", onClick }}
        >
          Hello world!
        </Toast>,
      );
      await user.click(getByRole("button", { name: "View in spotlight" }));
      expect(onClick).toHaveBeenCalledOnce();
    });

    test("does not dismiss the toast when the action is clicked", async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const onClick = vi.fn();
      const { getByRole } = render(
        <Toast
          open={true}
          onDismiss={onDismiss}
          action={{ label: "View in spotlight", onClick }}
        >
          Hello world!
        </Toast>,
      );
      await user.click(getByRole("button", { name: "View in spotlight" }));
      expect(onClick).toHaveBeenCalledOnce();
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });
});
