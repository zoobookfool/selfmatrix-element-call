/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC } from "react";

import { constant } from "../state/Behavior";
import { type ScreenShareViewModel } from "../state/media/ScreenShareViewModel";
import { type ScreenShareQualityInfo } from "../state/media/RemoteScreenShareViewModel";
import { useBehavior } from "../useBehavior";
import { useInitial } from "../useInitial";
import styles from "./ScreenShareQualityBadge.module.css";

function formatResolution(height: number | undefined): string | undefined {
  if (height === undefined || height <= 0) return undefined;
  const roundedHeight = Math.round(height);
  if (roundedHeight >= 2160) return "4K";
  return `${roundedHeight}p`;
}

function formatFps(fps: number | undefined): string | undefined {
  if (fps === undefined || fps <= 0) return undefined;
  return `${Math.round(fps)} FPS`;
}

export function formatScreenShareQuality(
  info: ScreenShareQualityInfo | undefined,
): string | undefined {
  const parts = [formatResolution(info?.height), formatFps(info?.fps)].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(" ") : undefined;
}

interface Props {
  vm: ScreenShareViewModel;
}

/**
 * Shows the quality the viewer is currently receiving for a remote stream.
 * Local shares do not need this badge because the local user already controls
 * their own capture preset in the share picker.
 */
export const ScreenShareQualityBadge: FC<Props> = ({ vm }) => {
  const noQuality$ = useInitial(() =>
    constant<ScreenShareQualityInfo | undefined>(undefined),
  );
  const quality = useBehavior(vm.local ? noQuality$ : vm.qualityInfo$);
  const label = formatScreenShareQuality(quality);
  if (!label) return null;

  return (
    <div className={styles.badge} data-testid="screen_share_quality_badge">
      {label}
    </div>
  );
};

ScreenShareQualityBadge.displayName = "ScreenShareQualityBadge";
