/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC } from "react";
import { Button, Text } from "@vector-im/compound-web";
import { useTranslation } from "react-i18next";

import styles from "./WatchGate.module.css";

interface Props {
  /**
   * The display name of the participant sharing their screen.
   */
  displayName: string;
  /**
   * Called when the user opts in to watching the stream.
   */
  onWatch: () => void;
  focusable: boolean;
}

/**
 * Overlay shown on top of a remote screen share's tile until the local user
 * opts in to watching it (SelfMatrix Slice 4). While this is shown, we do
 * not hold a LiveKit subscription for the underlying tracks, so no
 * bandwidth is spent on streams nobody is looking at.
 */
export const WatchGate: FC<Props> = ({ displayName, onWatch, focusable }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.gate}>
      <Text as="p" size="md" weight="semibold" className={styles.prompt}>
        {t("video_tile.watch_stream_prompt", { displayName })}
      </Text>
      <Button
        kind="primary"
        size="md"
        data-testid="incall_watch"
        onClick={onWatch}
        tabIndex={focusable ? undefined : -1}
      >
        {t("video_tile.watch_stream")}
      </Button>
    </div>
  );
};

WatchGate.displayName = "WatchGate";
