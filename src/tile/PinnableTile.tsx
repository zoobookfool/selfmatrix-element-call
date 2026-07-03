/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  type ComponentProps,
  type FC,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
} from "react";
import classNames from "classnames";
import { useTranslation } from "react-i18next";

import { GridTile } from "./GridTile";
import styles from "./PinnableTile.module.css";
import { useBehavior } from "../useBehavior";
import { type GridTileViewModel } from "../state/TileViewModel";

interface Props extends ComponentProps<typeof GridTile> {
  vm: GridTileViewModel;
  /**
   * The id (see BaseMediaViewModel.id) of the media currently pinned to the
   * spotlight, or null if there is no manual pin.
   */
  pinnedSpeakerId: string | null;
  /** Toggle whether this tile's media is pinned to the spotlight. Null if pinning is not available. */
  onTogglePinned: ((id: string) => void) | null;
}

/**
 * Wraps GridTile to allow the user to pin its media to the spotlight by
 * clicking anywhere on the tile that isn't already an interactive element
 * (such as the options menu button). This is a thin behavioral layer: it
 * forwards ref/style/className straight through to GridTile so that it
 * doesn't interfere with the tile grid's positioning and drag gestures,
 * which are applied directly to GridTile's root element.
 */
export const PinnableTile: FC<Props> = ({
  vm,
  pinnedSpeakerId,
  onTogglePinned,
  className,
  ...props
}) => {
  const { t } = useTranslation();
  const media = useBehavior(vm.media$);
  // Ringing media can't be pinned; there's nothing to spotlight yet.
  const pinnableId = media.type === "ringing" ? null : media.id;
  const interactive = pinnableId !== null && onTogglePinned !== null;
  const pinned = interactive && pinnableId === pinnedSpeakerId;

  const onClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (pinnableId === null || onTogglePinned === null) return;
      // Ignore clicks that originated from an interactive element within the
      // tile (e.g. the options menu button, mute button, etc.) so that this
      // wrapper doesn't interfere with existing tile interactions. The tile
      // root itself has role="button" for the pin action, so it must not
      // count as a nested interactive element here.
      const interactiveAncestor =
        e.target instanceof Element
          ? e.target.closest("button, a, [role='button'], [role='menuitem']")
          : null;
      if (
        interactiveAncestor !== null &&
        interactiveAncestor !== e.currentTarget
      )
        return;
      onTogglePinned(pinnableId);
    },
    [pinnableId, onTogglePinned],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (pinnableId === null || onTogglePinned === null) return;
      // Only handle key presses on the tile itself, not on nested
      // interactive elements (menu buttons etc.) which have their own
      // keyboard handling.
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onTogglePinned(pinnableId);
      }
    },
    [pinnableId, onTogglePinned],
  );

  return (
    <GridTile
      vm={vm}
      className={classNames(className, { [styles.pinned]: pinned })}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? pinned : undefined}
      aria-label={
        interactive
          ? pinned
            ? t("video_tile.unpin")
            : t("video_tile.pin")
          : undefined
      }
      data-testid="tile_pin"
      data-pinned={interactive ? pinned : undefined}
      {...props}
    />
  );
};

PinnableTile.displayName = "PinnableTile";
