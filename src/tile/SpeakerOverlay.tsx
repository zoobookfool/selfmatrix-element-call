/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  type CSSProperties,
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import classNames from "classnames";
import { type EventTypes, type Handler, useDrag } from "@use-gesture/react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  MenuItem,
  Text,
  ToggleMenuItem,
} from "@vector-im/compound-web";
import {
  MicOffIcon,
  MicOffSolidIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import styles from "./SpeakerOverlay.module.css";
import { Avatar, Size } from "../Avatar";
import { type Behavior } from "../state/Behavior";
import { useBehavior } from "../useBehavior";
import { type UserMediaViewModel } from "../state/media/UserMediaViewModel";
import { type RemoteUserMediaViewModel } from "../state/media/RemoteUserMediaViewModel";
import {
  type SpeakerOverlayPosition,
  speakerOverlayPosition,
  useSetting,
} from "../settings/settings";
import { Slider } from "../Slider";

interface SpeakerPillProps {
  vm: UserMediaViewModel;
}

/**
 * A single participant's avatar + name pill, as shown in the SelfMatrix
 * speaker overlay (Slice 5). Mirrors Discord's "StreamKit" overlay: a green
 * ring highlights whoever is currently speaking, and a muted mic icon is
 * shown for participants who have muted themselves.
 */
const SpeakerPillContent: FC<SpeakerPillProps> = ({ vm }) => {
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

interface RemoteSpeakerPillProps {
  vm: RemoteUserMediaViewModel;
  children: ReactNode;
}

const RemoteSpeakerPill: FC<RemoteSpeakerPillProps> = ({ vm, children }) => {
  const { t } = useTranslation();
  const displayName = useBehavior(vm.displayName$);
  const playbackMuted = useBehavior(vm.playbackMuted$);
  const playbackVolume = useBehavior(vm.playbackVolume$);
  const VolumeIcon = playbackMuted ? VolumeOffIcon : VolumeOnIcon;

  const onSelectMute = useCallback(
    (e: Event) => {
      e.preventDefault();
      vm.togglePlaybackMuted();
    },
    [vm],
  );

  return (
    <ContextMenu
      title={displayName}
      trigger={children}
      hasAccessibleAlternative
    >
      <ToggleMenuItem
        Icon={MicOffIcon}
        label={t("video_tile.mute_for_me")}
        checked={playbackMuted}
        onSelect={onSelectMute}
      />
      <MenuItem as="div" Icon={VolumeIcon} label={null} onSelect={null}>
        <Slider
          label={t("video_tile.volume")}
          value={playbackVolume}
          onValueChange={vm.adjustPlaybackVolume}
          onValueCommit={vm.commitPlaybackVolume}
          min={0}
          max={1}
          step={0.01}
        />
      </MenuItem>
    </ContextMenu>
  );
};

const SpeakerPill: FC<SpeakerPillProps> = ({ vm }) => {
  const content = <SpeakerPillContent vm={vm} />;
  if (vm.local) return content;
  return <RemoteSpeakerPill vm={vm}>{content}</RemoteSpeakerPill>;
};

SpeakerPill.displayName = "SpeakerPill";

type DragState = Parameters<Handler<"drag", EventTypes["drag"]>>[0];

interface SpeakerOverlayStyle extends CSSProperties {
  "--speaker-overlay-x": number;
  "--speaker-overlay-y": number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalisePosition(
  position: SpeakerOverlayPosition,
): SpeakerOverlayPosition {
  return {
    x: Number.isFinite(position.x) ? clamp(position.x, 0, 1) : 0,
    y: Number.isFinite(position.y) ? clamp(position.y, 0, 1) : 1,
  };
}

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
 * anyone who is muted. The whole overlay can be freely dragged around the
 * tile; the chosen placement is persisted so it's remembered across calls.
 */
export const SpeakerOverlay: FC<Props> = ({ members$, focusable = true }) => {
  const members = useBehavior(members$);
  const [position, setPosition] = useSetting(speakerOverlayPosition);
  const [draftPosition, setDraftPosition] = useState(() =>
    normalisePosition(position),
  );
  const ref = useRef<HTMLDivElement | null>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setDraftPosition(normalisePosition(position));
  }, [position]);

  const onDrag = useCallback(
    ({ first, last, xy: [x, y] }: DragState): void => {
      const overlay = ref.current;
      const container = overlay?.parentElement;
      if (!overlay || !container) return;

      const bounds = container.getBoundingClientRect();
      const overlayBounds = overlay.getBoundingClientRect();
      const maxX = Math.max(bounds.width - overlayBounds.width, 0);
      const maxY = Math.max(bounds.height - overlayBounds.height, 0);
      if (bounds.width === 0 || bounds.height === 0) return;

      if (first || dragOffset.current === null) {
        dragOffset.current = {
          x: x - overlayBounds.left,
          y: y - overlayBounds.top,
        };
      }

      const nextLeft = clamp(x - bounds.left - dragOffset.current.x, 0, maxX);
      const nextTop = clamp(y - bounds.top - dragOffset.current.y, 0, maxY);
      const nextPosition = {
        x: maxX === 0 ? 0 : nextLeft / maxX,
        y: maxY === 0 ? 0 : nextTop / maxY,
      };

      setDraftPosition(nextPosition);
      if (last) {
        setPosition(nextPosition);
        dragOffset.current = null;
      }
    },
    [setPosition],
  );

  useDrag(onDrag, { target: ref, filterTaps: true });

  if (members.length === 0) return null;

  return (
    <div
      ref={ref}
      className={styles.overlay}
      data-testid="speaker_overlay"
      data-overlay-x={draftPosition.x}
      data-overlay-y={draftPosition.y}
      style={
        {
          "--speaker-overlay-x": draftPosition.x,
          "--speaker-overlay-y": draftPosition.y,
        } as SpeakerOverlayStyle
      }
      tabIndex={focusable ? undefined : -1}
    >
      {members.map((vm) => (
        <SpeakerPill key={vm.id} vm={vm} />
      ))}
    </div>
  );
};

SpeakerOverlay.displayName = "SpeakerOverlay";
