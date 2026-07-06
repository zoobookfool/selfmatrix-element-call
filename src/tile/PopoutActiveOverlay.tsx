/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC } from "react";
import { Text } from "@vector-im/compound-web";
import { PopOutIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { useTranslation } from "react-i18next";

import styles from "./PopoutActiveOverlay.module.css";

interface Props {
  /**
   * Re-focuses the popout window when the overlay is clicked.
   */
  onFocus: () => void;
  focusable: boolean;
}

/**
 * Overlay shown on top of a screen share's tile in the main window while it
 * is currently popped out into its own window (SelfMatrix Slice 2). Mirrors
 * the WatchGate/SpeakerOverlay pattern of stacking content in the MediaView
 * "overlay" slot. Clicking the overlay re-focuses the popout window.
 */
export const PopoutActiveOverlay: FC<Props> = ({ onFocus, focusable }) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className={styles.overlay}
      data-testid="popout_active_overlay"
      onClick={onFocus}
      tabIndex={focusable ? undefined : -1}
    >
      <PopOutIcon aria-hidden width={20} height={20} />
      <Text as="span" size="md" weight="semibold" className={styles.label}>
        {t("video_tile.popout_active", {
          defaultValue: "Showing in another window",
        })}
      </Text>
    </button>
  );
};

PopoutActiveOverlay.displayName = "PopoutActiveOverlay";
