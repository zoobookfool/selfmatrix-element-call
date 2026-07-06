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
  /**
   * SelfMatrix (UI design notes v1.4, agreement 3): whether grid mode's
   * emphasis selection is turned on. When true, clicking the tile toggles
   * emphasis selection instead of pinning (agreement 6: "強調選択 ON の
   * ときはタイルクリック = 選択トグルを優先").
   */
  emphasisEnabled?: boolean;
  /** Whether this tile is currently emphasized (selected). */
  emphasized?: boolean;
  /** Toggle whether this tile's media is emphasized. */
  onToggleEmphasized?: (id: string) => void;
}

/**
 * Wraps GridTile to allow the user to pin its media to the spotlight by
 * clicking anywhere on the tile that isn't already an interactive element
 * (such as the options menu button). This is a thin behavioral layer: it
 * forwards ref/style/className straight through to GridTile so that it
 * doesn't interfere with the tile grid's positioning and drag gestures,
 * which are applied directly to GridTile's root element.
 *
 * While emphasis selection is enabled, tile clicks toggle emphasis selection
 * rather than the spotlight pin.
 */
export const PinnableTile: FC<Props> = ({
  vm,
  pinnedSpeakerId,
  onTogglePinned,
  emphasisEnabled = false,
  emphasized = false,
  onToggleEmphasized,
  className,
  ...props
}) => {
  const { t } = useTranslation();
  const media = useBehavior(vm.media$);
  // Ringing media can't be pinned or emphasized; there's nothing to
  // spotlight/select yet.
  const selectableId = media.type === "ringing" ? null : media.id;
  const pinInteractive =
    !emphasisEnabled && selectableId !== null && onTogglePinned !== null;
  const emphasisInteractive =
    emphasisEnabled && selectableId !== null && onToggleEmphasized !== null;
  const interactive = pinInteractive || emphasisInteractive;
  const pinned = pinInteractive && selectableId === pinnedSpeakerId;

  const activate = useCallback(() => {
    if (selectableId === null) return;
    if (emphasisInteractive) onToggleEmphasized!(selectableId);
    else if (pinInteractive) onTogglePinned!(selectableId);
  }, [
    selectableId,
    emphasisInteractive,
    onToggleEmphasized,
    pinInteractive,
    onTogglePinned,
  ]);

  const onClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!interactive) return;
      // Ignore clicks that originated from an interactive element within the
      // tile (e.g. the options menu button, mute button, etc.) so that this
      // wrapper doesn't interfere with existing tile interactions. The tile
      // root itself has role="button" for the pin/emphasis action, so it must
      // not count as a nested interactive element here.
      const interactiveAncestor =
        e.target instanceof Element
          ? e.target.closest("button, a, [role='button'], [role='menuitem']")
          : null;
      if (
        interactiveAncestor !== null &&
        interactiveAncestor !== e.currentTarget
      )
        return;
      activate();
    },
    [interactive, activate],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!interactive) return;
      // Only handle key presses on the tile itself, not on nested
      // interactive elements (menu buttons etc.) which have their own
      // keyboard handling.
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    },
    [interactive, activate],
  );

  return (
    <GridTile
      vm={vm}
      className={classNames(className, {
        [styles.pinned]: pinned,
        [styles.emphasized]: emphasisInteractive && emphasized,
      })}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={
        emphasisInteractive ? emphasized : pinInteractive ? pinned : undefined
      }
      aria-label={
        emphasisInteractive
          ? emphasized
            ? t("video_tile.unemphasize")
            : t("video_tile.emphasize")
          : pinInteractive
            ? pinned
              ? t("video_tile.unpin")
              : t("video_tile.pin")
            : undefined
      }
      // SelfMatrix (FIX-5a): data-testid is kept stable as "tile_pin"
      // regardless of emphasis vs pin mode, so tests (and any other tooling
      // keying off of it) don't need to branch on emphasis state to find the
      // tile. The interactive mode itself is exposed via
      // data-emphasis-interactive instead.
      data-testid="tile_pin"
      data-pinned={pinInteractive ? pinned : undefined}
      data-emphasis-interactive={emphasisInteractive || undefined}
      data-emphasized={emphasisInteractive ? emphasized : undefined}
      {...props}
    />
  );
};

PinnableTile.displayName = "PinnableTile";
