/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC, useCallback, useRef } from "react";
import classNames from "classnames";
import { useDrag } from "@use-gesture/react";
import { useTranslation } from "react-i18next";
import { Text } from "@vector-im/compound-web";
import { MicOffSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import styles from "./SpeakerOverlay.module.css";
import { Avatar, Size } from "../Avatar";
import { type Behavior } from "../state/Behavior";
import { useBehavior } from "../useBehavior";
import { type UserMediaViewModel } from "../state/media/UserMediaViewModel";
import { speakerOverlayAlignment, useSetting } from "../settings/settings";

interface SpeakerPillProps {
  vm: UserMediaViewModel;
}

/**
 * A single participant's avatar + name pill, as shown in the SelfMatrix
 * speaker overlay (Slice 5). Mirrors Discord's "StreamKit" overlay: a green
 * ring highlights whoever is currently speaking, and a muted mic icon is
 * shown for participants who have muted themselves.
 */
const SpeakerPill: FC<SpeakerPillProps> = ({ vm }) => {
  const { t } = useTranslation();
  const speaking = useBehavior(vm.speaking$);
  const audioEnabled = useBehavior(vm.audioEnabled$);
  const displayName = useBehavior(vm.displayName$);
  const mxcAvatarUrl = useBehavior(vm.mxcAvatarUrl$);

  return (
    <div
      className={classNames(styles.pill, { [styles.speaking]: speaking })}
      data-testid="speaker_pill"
      data-speaking={speaking}
      data-muted={!audioEnabled}
    >
      <Avatar
        id={vm.userId}
        name={displayName}
        size={Size.XS}
        src={mxcAvatarUrl}
        className={styles.avatar}
      />
      <Text
        as="span"
        size="sm"
        weight="medium"
        className={classNames(styles.name, {
          [styles.speakingName]: speaking,
        })}
      >
        {displayName}
      </Text>
      {!audioEnabled && (
        <MicOffSolidIcon
          width={16}
          height={16}
          className={styles.muteIcon}
          aria-label={t("microphone_off")}
        />
      )}
    </div>
  );
};

SpeakerPill.displayName = "SpeakerPill";

interface Props {
  /**
   * The list of participants' user media to show pills for, including the
   * local user.
   */
  members$: Behavior<UserMediaViewModel[]>;
  /**
   * Whether the overlay's contents should be reachable by keyboard/AT focus.
   * Mirrors the `focusable` convention used elsewhere in the tile tree.
   */
  focusable?: boolean;
}

/**
 * Discord StreamKit-style overlay shown on top of a watched screen share
 * (SelfMatrix Slice 5). Displays an avatar + name pill for every participant
 * in the call, highlighting whoever is currently speaking and flagging
 * anyone who is muted. The whole overlay can be dragged to snap to any of
 * the four corners of the tile; the chosen corner is persisted so it's
 * remembered across calls.
 */
export const SpeakerOverlay: FC<Props> = ({ members$, focusable = true }) => {
  const members = useBehavior(members$);
  const [alignment, setAlignment] = useSetting(speakerOverlayAlignment);
  const ref = useRef<HTMLDivElement | null>(null);

  const onDrag = useCallback(
    ({
      last,
      xy: [x, y],
    }: Parameters<Parameters<typeof useDrag>[0]>[0]): void => {
      // Only commit the new corner once the drag gesture has ended, so the
      // overlay doesn't jump around mid-drag (it stays under the cursor via
      // native browser dragging feedback is not used here; instead we just
      // snap on release, matching the lightweight feel of GridLayout's
      // spotlight alignment drag).
      if (!last) return;
      const container = ref.current?.parentElement;
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;
      const xRatio = (x - bounds.left) / bounds.width;
      const yRatio = (y - bounds.top) / bounds.height;
      setAlignment({
        inline: xRatio < 0.5 ? "start" : "end",
        block: yRatio < 0.5 ? "start" : "end",
      });
    },
    [setAlignment],
  );

  useDrag(onDrag, { target: ref, filterTaps: true });

  if (members.length === 0) return null;

  return (
    <div
      ref={ref}
      className={styles.overlay}
      data-testid="speaker_overlay"
      data-block-alignment={alignment.block}
      data-inline-alignment={alignment.inline}
      tabIndex={focusable ? undefined : -1}
    >
      {members.map((vm) => (
        <SpeakerPill key={vm.id} vm={vm} />
      ))}
    </div>
  );
};

SpeakerOverlay.displayName = "SpeakerOverlay";
