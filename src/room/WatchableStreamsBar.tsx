/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC } from "react";
import { Text } from "@vector-im/compound-web";
import { useTranslation } from "react-i18next";

import styles from "./WatchableStreamsBar.module.css";
import { useBehavior } from "../useBehavior";
import { type RemoteScreenShareViewModel } from "../state/media/RemoteScreenShareViewModel";

interface ChipProps {
  vm: RemoteScreenShareViewModel;
}

const WatchableStreamChip: FC<ChipProps> = ({ vm }) => {
  const { t } = useTranslation();
  const displayName = useBehavior(vm.displayName$);

  return (
    <div className={styles.chip} data-testid={`watch_stream_${vm.userId}`}>
      <Text
        as="span"
        size="sm"
        weight="medium"
        className={styles.chipName}
        title={displayName}
      >
        {displayName}
      </Text>
      <button
        className={styles.watchButton}
        data-testid="watch_stream"
        onClick={() => vm.setWatching(true)}
      >
        {t("watchable_streams_bar.watch_button")}
      </button>
    </div>
  );
};

WatchableStreamChip.displayName = "WatchableStreamChip";

interface Props {
  /**
   * Remote screen shares available to watch but not yet opted in to.
   */
  streams: RemoteScreenShareViewModel[];
}

/**
 * SelfMatrix (UI design notes v1.4, agreement 1/2): "視聴できる配信" chip
 * bar, shown above the call stage whenever there are screen shares the local
 * user could opt in to watching but hasn't yet. Replaces the previous
 * per-tile WatchGate overlay - unwatched streams never get a tile at all
 * (and so never split the screen), they only ever appear here until watched.
 * Disappears automatically once every available stream is either watched or
 * gone (i.e. `streams` becomes empty).
 */
export const WatchableStreamsBar: FC<Props> = ({ streams }) => {
  const { t } = useTranslation();

  if (streams.length === 0) return null;

  return (
    <div className={styles.bar} data-testid="watchable_streams_bar">
      <Text as="span" size="sm" weight="medium" className={styles.label}>
        {t("watchable_streams_bar.label")}
      </Text>
      {streams.map((vm) => (
        <WatchableStreamChip key={vm.id} vm={vm} />
      ))}
    </div>
  );
};

WatchableStreamsBar.displayName = "WatchableStreamsBar";
