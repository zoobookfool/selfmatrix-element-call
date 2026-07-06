/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC, useState } from "react";
import { Button, Menu, MenuItem, MenuTitle } from "@vector-im/compound-web";
import {
  CheckIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import classNames from "classnames";
import { useTranslation } from "react-i18next";

import styles from "./ShareScreenMenuButton.module.css";
import { ShareScreenButton } from "../button";
import {
  useSetting,
  screenShareFps,
  screenShareQuality,
  type ScreenShareFps,
  type ScreenShareQuality,
} from "../settings/settings";

export interface ShareScreenMenuButtonProps {
  /** Whether screen sharing is currently active. */
  sharing: boolean;
  /** Callback to toggle screen sharing on/off. */
  onToggle: () => void;
  size: "md" | "lg";
  className?: string;
}

const QUALITY_OPTIONS: { id: ScreenShareQuality; label: string }[] = [
  { id: "480", label: "480p" },
  { id: "720", label: "720p" },
  { id: "1080", label: "1080p" },
  { id: "2160", label: "4K" },
];

const FPS_OPTIONS: { id: ScreenShareFps; label: string }[] = [
  { id: 15, label: "15" },
  { id: 30, label: "30" },
  { id: 60, label: "60" },
];

/**
 * SelfMatrix: screen share button with an adjacent options menu for picking
 * capture quality and frame rate, Discord-style (requirements §3 SHOULD).
 * The selection is persisted and only applied the next time a share starts:
 * livekit-client treats a later setScreenShareEnabled(true) call on an
 * already-sharing track as an unmute and ignores capture options, so changes
 * are disabled while sharing is active.
 */
export const ShareScreenMenuButton: FC<ShareScreenMenuButtonProps> = ({
  sharing,
  onToggle,
  size,
  className,
}) => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [quality, setQuality] = useSetting(screenShareQuality);
  const [fps, setFps] = useSetting(screenShareFps);

  return (
    <div
      className={classNames(className, styles.container, {
        [styles.containerOpen]: menuOpen,
      })}
    >
      <ShareScreenButton
        size={size}
        enabled={sharing}
        onClick={onToggle}
        data-testid="incall_screenshare"
      />
      <Menu
        title={t("screen_share_options.menu_title")}
        showTitle={true}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        side="top"
        trigger={
          <Button
            iconOnly
            className={classNames({
              [styles.menuButton]: true,
              [styles.chevronIconOpen]: menuOpen,
            })}
            Icon={menuOpen ? ChevronUpIcon : ChevronDownIcon}
            kind="tertiary"
            size="lg"
            aria-label={t("screen_share_options.options_button_label")}
            data-testid="screenshare_options"
          />
        }
      >
        <MenuTitle title={t("screen_share_options.quality")} />
        {QUALITY_OPTIONS.map(({ id, label }) => (
          <MenuItem
            key={id}
            role="menuitemradio"
            aria-checked={quality === id}
            hideChevron
            label={label}
            disabled={sharing}
            data-testid={`ss_quality_${id}`}
            onSelect={(e) => {
              e.preventDefault();
              setQuality(id);
            }}
          >
            {quality === id && <CheckIcon width={24} height={24} />}
          </MenuItem>
        ))}
        <hr />
        <MenuTitle title={t("screen_share_options.fps")} />
        {FPS_OPTIONS.map(({ id, label }) => (
          <MenuItem
            key={id}
            role="menuitemradio"
            aria-checked={fps === id}
            hideChevron
            label={label}
            disabled={sharing}
            data-testid={`ss_fps_${id}`}
            onSelect={(e) => {
              e.preventDefault();
              setFps(id);
            }}
          >
            {fps === id && <CheckIcon width={24} height={24} />}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
};

ShareScreenMenuButton.displayName = "ShareScreenMenuButton";
