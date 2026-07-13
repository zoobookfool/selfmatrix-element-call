/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC, useCallback, useEffect, useState } from "react";
import { Button, Tooltip } from "@vector-im/compound-web";
import {
  ArrowLeftIcon,
  ExitFullScreenIcon,
  FullScreenIcon,
  PinIcon,
  PinSolidIcon,
  PopOutIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { useTranslation } from "react-i18next";

import styles from "./CallFooter.module.css";
import type {
  SelfmatrixCallWindowBridge,
  SelfmatrixCallWindowState,
} from "../@types/global";

interface NativeCallWindowControlsProps {
  location: "primary" | "secondary";
}

interface NativeCallWindowHook {
  bridge: SelfmatrixCallWindowBridge | undefined;
  state: SelfmatrixCallWindowState | undefined;
  pending: boolean;
  run: (action: () => Promise<SelfmatrixCallWindowState>) => Promise<void>;
}

function useNativeCallWindow(): NativeCallWindowHook {
  const bridge = window.selfmatrixCallWindow;
  const [state, setState] = useState<SelfmatrixCallWindowState>();
  const [pending, setPending] = useState(false);

  useEffect((): (() => void) | undefined => {
    if (!bridge) return undefined;

    let active = true;
    const unsubscribe = bridge.onStateChange((nextState) => {
      if (active) setState(nextState);
    });
    void bridge
      .getState()
      .then((nextState) => {
        if (active) setState(nextState);
      })
      .catch(() => undefined);

    return (): void => {
      active = false;
      unsubscribe();
    };
  }, [bridge]);

  const run = useCallback(
    async (action: () => Promise<SelfmatrixCallWindowState>): Promise<void> => {
      if (pending) return;
      setPending(true);
      try {
        setState(await action());
      } catch {
        // The main-process state push will restore the authoritative state.
      } finally {
        setPending(false);
      }
    },
    [pending],
  );

  return { bridge, state, pending, run };
}

/** Controls supplied only by the trusted SelfMatrix desktop preload. */
export const NativeCallWindowControls: FC<NativeCallWindowControlsProps> = ({
  location,
}) => {
  const { t } = useTranslation();
  const { bridge, state, pending, run } = useNativeCallWindow();

  if (!bridge || !state || state.placement === "none") return null;

  if (location === "primary") {
    const poppedOut = state.placement === "window";
    const label = poppedOut
      ? t("native_call_window.popin")
      : t("native_call_window.popout");
    const action = poppedOut ? bridge.popin : bridge.popout;

    return (
      <Tooltip label={label}>
        <Button
          iconOnly
          Icon={poppedOut ? ArrowLeftIcon : PopOutIcon}
          kind="secondary"
          disabled={pending}
          aria-label={label}
          data-testid={poppedOut ? "native_call_popin" : "native_call_popout"}
          onClick={() => void run(action)}
        />
      </Tooltip>
    );
  }

  if (state.placement !== "window") return null;

  const pinLabel = state.alwaysOnTop
    ? t("native_call_window.unpin")
    : t("native_call_window.pin");
  const fullscreenLabel = state.fullScreen
    ? t("native_call_window.exit_fullscreen")
    : t("native_call_window.enter_fullscreen");

  return (
    <div className={styles.nativeWindowControls}>
      <Tooltip label={pinLabel}>
        <Button
          iconOnly
          Icon={state.alwaysOnTop ? PinSolidIcon : PinIcon}
          kind={state.alwaysOnTop ? "primary" : "secondary"}
          disabled={pending}
          aria-label={pinLabel}
          aria-pressed={state.alwaysOnTop}
          data-testid="native_call_pin"
          onClick={() => void run(bridge.toggleAlwaysOnTop)}
        />
      </Tooltip>
      <Tooltip label={fullscreenLabel}>
        <Button
          iconOnly
          Icon={state.fullScreen ? ExitFullScreenIcon : FullScreenIcon}
          kind={state.fullScreen ? "primary" : "secondary"}
          disabled={pending}
          aria-label={fullscreenLabel}
          aria-pressed={state.fullScreen}
          data-testid="native_call_fullscreen"
          onClick={() => void run(bridge.toggleFullscreen)}
        />
      </Tooltip>
    </div>
  );
};
