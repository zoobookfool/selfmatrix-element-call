/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  type ComponentProps,
  type FC,
  type ReactNode,
  type Ref,
  type RefAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ExpandIcon,
  CollapseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  VolumeOffIcon,
  VolumeOnIcon,
  VolumeOffSolidIcon,
  VolumeOnSolidIcon,
  VideoCallSolidIcon,
  VoiceCallSolidIcon,
  EndCallIcon,
  PinSolidIcon,
  PopOutIcon,
  VisibilityOffIcon,
  SidebarIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { animated } from "@react-spring/web";
import { type Observable, map } from "rxjs";
import { useObservableRef } from "observable-hooks";
import { useTranslation } from "react-i18next";
import classNames from "classnames";
import { type TrackReferenceOrPlaceholder } from "@livekit/components-core";
import { Menu, MenuItem } from "@vector-im/compound-web";

import FullScreenMaximiseIcon from "../icons/FullScreenMaximise.svg?react";
import FullScreenMinimiseIcon from "../icons/FullScreenMinimise.svg?react";
import { MediaView } from "./MediaView";
import { WatchGate } from "./WatchGate";
import { PopoutActiveOverlay } from "./PopoutActiveOverlay";
import styles from "./SpotlightTile.module.css";
import { useInitial } from "../useInitial";
import { useMergedRefs } from "../useMergedRefs";
import { useReactiveState } from "../useReactiveState";
import { useLatest } from "../useLatest";
import { type SpotlightTileViewModel } from "../state/TileViewModel";
import { useBehavior } from "../useBehavior";
import { constant } from "../state/Behavior";
import { type MemberMediaViewModel } from "../state/media/MemberMediaViewModel";
import { type LocalUserMediaViewModel } from "../state/media/LocalUserMediaViewModel";
import { type RemoteUserMediaViewModel } from "../state/media/RemoteUserMediaViewModel";
import { type UserMediaViewModel } from "../state/media/UserMediaViewModel";
import { type ScreenShareViewModel } from "../state/media/ScreenShareViewModel";
import { type RemoteScreenShareViewModel } from "../state/media/RemoteScreenShareViewModel";
import { type MediaViewModel } from "../state/media/MediaViewModel";
import { Slider } from "../Slider";
import { platform } from "../Platform";
import { type RingingMediaViewModel } from "../state/media/RingingMediaViewModel";
import { usePopoutScreenShare } from "./popout/usePopoutScreenShare";

interface SpotlightItemBaseProps {
  ref?: Ref<HTMLDivElement>;
  className?: string;
  "data-id": string;
  targetWidth: number;
  targetHeight: number;
  userId: string;
  displayName: string;
  mxcAvatarUrl: string | undefined;
  showNameTags: boolean;
  focusable: boolean;
  "aria-hidden"?: boolean;
}

interface SpotlightMemberMediaItemBaseProps extends SpotlightItemBaseProps {
  video: TrackReferenceOrPlaceholder | undefined;
  unencryptedWarning: boolean;
  focusUrl: string | undefined;
}

interface SpotlightUserMediaItemBaseProps extends SpotlightMemberMediaItemBaseProps {
  videoFit: "contain" | "cover";
  videoEnabled: boolean;
}

interface SpotlightLocalUserMediaItemProps extends SpotlightUserMediaItemBaseProps {
  vm: LocalUserMediaViewModel;
}

const SpotlightLocalUserMediaItem: FC<SpotlightLocalUserMediaItemProps> = ({
  vm,
  ...props
}) => {
  const mirror = useBehavior(vm.mirror$);
  return <MediaView mirror={mirror} {...props} />;
};

SpotlightLocalUserMediaItem.displayName = "SpotlightLocalUserMediaItem";

interface SpotlightRemoteUserMediaItemProps extends SpotlightUserMediaItemBaseProps {
  vm: RemoteUserMediaViewModel;
}

const SpotlightRemoteUserMediaItem: FC<SpotlightRemoteUserMediaItemProps> = ({
  vm,
  ...props
}) => {
  const waitingForMedia = useBehavior(vm.waitingForMedia$);
  return (
    <MediaView waitingForMedia={waitingForMedia} mirror={false} {...props} />
  );
};

interface SpotlightUserMediaItemProps extends SpotlightMemberMediaItemBaseProps {
  vm: UserMediaViewModel;
}

const SpotlightUserMediaItem: FC<SpotlightUserMediaItemProps> = ({
  vm,
  targetWidth,
  targetHeight,
  ...props
}) => {
  const videoFit = useBehavior(vm.videoFit$);
  const videoEnabled = useBehavior(vm.videoEnabled$);

  // Whenever target bounds change, inform the viewModel
  useEffect(() => {
    if (targetWidth > 0 && targetHeight > 0) {
      vm.setTargetDimensions(targetWidth, targetHeight);
    }
  }, [targetWidth, targetHeight, vm]);

  const baseProps: SpotlightUserMediaItemBaseProps &
    RefAttributes<HTMLDivElement> = {
    videoFit,
    videoEnabled,
    targetWidth,
    targetHeight,
    ...props,
  };

  return vm.local ? (
    <SpotlightLocalUserMediaItem vm={vm} {...baseProps} />
  ) : (
    <SpotlightRemoteUserMediaItem vm={vm} {...baseProps} />
  );
};

SpotlightUserMediaItem.displayName = "SpotlightUserMediaItem";

interface SpotlightScreenShareItemProps extends SpotlightMemberMediaItemBaseProps {
  vm: ScreenShareViewModel;
  videoEnabled: boolean;
  overlay?: ReactNode;
}

const SpotlightScreenShareItem: FC<SpotlightScreenShareItemProps> = ({
  vm,
  ...props
}) => {
  return <MediaView videoFit="contain" mirror={false} {...props} />;
};

interface SpotlightRemoteScreenShareItemProps extends SpotlightMemberMediaItemBaseProps {
  vm: RemoteScreenShareViewModel;
  /**
   * The SelfMatrix speaker overlay (Slice 5), shown once the user has opted
   * in to watching this screen share.
   */
  speakerOverlay?: ReactNode;
  /**
   * The SelfMatrix "popped out" overlay (Slice 2), shown instead of the
   * speaker overlay/watch gate while this screen share is currently popped
   * out into its own window.
   */
  popoutOverlay?: ReactNode;
}

const SpotlightRemoteScreenShareItem: FC<
  SpotlightRemoteScreenShareItemProps
> = ({ vm, speakerOverlay, popoutOverlay, ...props }) => {
  const videoEnabled = useBehavior(vm.videoEnabled$);
  const watching = useBehavior(vm.watching$);
  return (
    <SpotlightScreenShareItem
      vm={vm}
      videoEnabled={videoEnabled}
      overlay={
        popoutOverlay ??
        (watching ? (
          speakerOverlay
        ) : (
          <WatchGate
            displayName={props.displayName}
            onWatch={() => vm.setWatching(true)}
            focusable={props.focusable}
          />
        ))
      }
      {...props}
    />
  );
};

interface SpotlightMemberMediaItemProps extends SpotlightItemBaseProps {
  vm: MemberMediaViewModel;
  /**
   * The SelfMatrix speaker overlay (Slice 5) to show on top of a screen
   * share that is currently being watched (local shares are always
   * "watched"). Ignored for user media (camera) items.
   */
  speakerOverlay?: ReactNode;
  /**
   * The SelfMatrix "popped out" overlay (Slice 2) to show instead, when this
   * screen share is currently popped out into its own window. Ignored for
   * user media (camera) items.
   */
  popoutOverlay?: ReactNode;
}

const SpotlightMemberMediaItem: FC<SpotlightMemberMediaItemProps> = ({
  vm,
  speakerOverlay,
  popoutOverlay,
  ...props
}) => {
  const video = useBehavior(vm.video$);
  const unencryptedWarning = useBehavior(vm.unencryptedWarning$);
  const focusUrl = useBehavior(vm.focusUrl$);

  const baseProps: SpotlightMemberMediaItemBaseProps &
    RefAttributes<HTMLDivElement> = {
    video: video ?? undefined,
    unencryptedWarning,
    focusUrl,
    ...props,
  };

  if (vm.type === "user")
    return <SpotlightUserMediaItem vm={vm} {...baseProps} />;
  return vm.local ? (
    <SpotlightScreenShareItem
      vm={vm}
      videoEnabled
      overlay={popoutOverlay ?? speakerOverlay}
      {...baseProps}
    />
  ) : (
    <SpotlightRemoteScreenShareItem
      vm={vm}
      speakerOverlay={speakerOverlay}
      popoutOverlay={popoutOverlay}
      {...baseProps}
    />
  );
};

interface SpotlightRingingMediaItemProps extends SpotlightItemBaseProps {
  vm: RingingMediaViewModel;
}

const SpotlightRingingMediaItem: FC<SpotlightRingingMediaItemProps> = ({
  vm,
  ...props
}) => {
  const { t } = useTranslation();
  const pickupState = useBehavior(vm.pickupState$);
  const videoEnabled = useBehavior(vm.videoEnabled$);

  return (
    <MediaView
      video={undefined}
      unencryptedWarning={false}
      status={
        pickupState === "ringing"
          ? {
              text: t("video_tile.calling"),
              Icon: videoEnabled ? VideoCallSolidIcon : VoiceCallSolidIcon,
            }
          : { text: t("video_tile.call_ended"), Icon: EndCallIcon }
      }
      videoEnabled={false}
      videoFit="cover"
      mirror={false}
      {...props}
    />
  );
};

interface SpotlightItemProps {
  ref?: Ref<HTMLDivElement>;
  vm: MediaViewModel;
  /**
   * The width this tile will have once its animations have settled.
   */
  targetWidth: number;
  /**
   * The height this tile will have once its animations have settled.
   */
  targetHeight: number;
  showNameTags: boolean;
  focusable: boolean;
  /**
   * The intersection observer used to track which item is currently
   * scrolled into view, for carousel navigation. Omitted in split mode
   * (SelfMatrix Slice 6a), where items are rendered side by side rather
   * than scrolled, so there is nothing to track.
   */
  intersectionObserver$: Observable<IntersectionObserver> | undefined;
  /**
   * Whether this item should act as a scroll snapping point.
   */
  snap: boolean;
  "aria-hidden"?: boolean;
  /**
   * The SelfMatrix speaker overlay (Slice 5) to show on top of this item, if
   * it turns out to be a watched screen share.
   */
  speakerOverlay?: ReactNode;
  /**
   * The SelfMatrix "popped out" overlay (Slice 2) to show on top of this
   * item, if it turns out to be the screen share currently popped out into
   * its own window.
   */
  popoutOverlay?: ReactNode;
}

const SpotlightItem: FC<SpotlightItemProps> = ({
  ref: theirRef,
  vm,
  targetWidth,
  targetHeight,
  showNameTags,
  focusable,
  intersectionObserver$,
  snap,
  "aria-hidden": ariaHidden,
  speakerOverlay,
  popoutOverlay,
}) => {
  const ourRef = useRef<HTMLDivElement | null>(null);

  const ref = useMergedRefs(ourRef, theirRef);
  const displayName = useBehavior(vm.displayName$);
  const mxcAvatarUrl = useBehavior(vm.mxcAvatarUrl$);

  // Hook this item up to the intersection observer, if there is one (split
  // mode items don't scroll, so they opt out of this tracking entirely).
  useEffect(() => {
    if (intersectionObserver$ === undefined) return;
    const element = ourRef.current!;
    let prevIo: IntersectionObserver | null = null;
    const subscription = intersectionObserver$.subscribe((io) => {
      prevIo?.unobserve(element);
      io.observe(element);
      prevIo = io;
    });
    return (): void => {
      subscription.unsubscribe();
      prevIo?.unobserve(element);
    };
  }, [intersectionObserver$]);

  const baseProps: SpotlightItemBaseProps & RefAttributes<HTMLDivElement> = {
    ref,
    "data-id": vm.id,
    className: classNames(styles.item, { [styles.snap]: snap }),
    targetWidth,
    targetHeight,
    userId: vm.userId,
    displayName,
    mxcAvatarUrl,
    showNameTags,
    focusable,
    "aria-hidden": ariaHidden,
  };

  return vm.type === "ringing" ? (
    <SpotlightRingingMediaItem vm={vm} {...baseProps} />
  ) : (
    <SpotlightMemberMediaItem
      vm={vm}
      speakerOverlay={speakerOverlay}
      popoutOverlay={popoutOverlay}
      {...baseProps}
    />
  );
};

SpotlightItem.displayName = "SpotlightItem";

interface ScreenShareVolumeButtonProps {
  vm: RemoteScreenShareViewModel;
}

const ScreenShareVolumeButton: FC<ScreenShareVolumeButtonProps> = ({ vm }) => {
  const { t } = useTranslation();

  const audioEnabled = useBehavior(vm.audioEnabled$);
  const playbackMuted = useBehavior(vm.playbackMuted$);
  const playbackVolume = useBehavior(vm.playbackVolume$);

  const VolumeIcon = playbackMuted ? VolumeOffIcon : VolumeOnIcon;
  const VolumeSolidIcon = playbackMuted
    ? VolumeOffSolidIcon
    : VolumeOnSolidIcon;

  const [volumeMenuOpen, setVolumeMenuOpen] = useState(false);
  const onMuteButtonClick = useCallback(() => vm.togglePlaybackMuted(), [vm]);
  const onVolumeChange = useCallback(
    (v: number) => vm.adjustPlaybackVolume(v),
    [vm],
  );
  const onVolumeCommit = useCallback(() => vm.commitPlaybackVolume(), [vm]);

  return (
    audioEnabled && (
      <Menu
        open={volumeMenuOpen}
        onOpenChange={setVolumeMenuOpen}
        title={t("video_tile.screen_share_volume")}
        side="top"
        align="end"
        trigger={
          <button
            className={styles.expand}
            aria-label={t("video_tile.screen_share_volume")}
          >
            <VolumeSolidIcon aria-hidden width={20} height={20} />
          </button>
        }
      >
        <MenuItem
          as="div"
          className={styles.volumeMenuItem}
          onSelect={null}
          label={null}
          hideChevron={true}
        >
          <button className={styles.menuMuteButton} onClick={onMuteButtonClick}>
            <VolumeIcon aria-hidden width={24} height={24} />
          </button>
          <Slider
            className={styles.volumeSlider}
            label={t("video_tile.volume")}
            value={playbackVolume}
            min={0}
            max={1}
            step={0.01}
            onValueChange={onVolumeChange}
            onValueCommit={onVolumeCommit}
          />
        </MenuItem>
      </Menu>
    )
  );
};

interface Props {
  ref?: Ref<HTMLDivElement>;
  vm: SpotlightTileViewModel;
  expanded: boolean;
  onToggleExpanded: (() => void) | null;
  targetWidth: number;
  targetHeight: number;
  showIndicators: boolean;
  showNameTags: boolean;
  focusable: boolean;
  /** Whether a participant is manually pinned to the spotlight. */
  pinned?: boolean;
  /** Clears the manual spotlight pin. Null if unpinning is unavailable. */
  onUnpin?: (() => void) | null;
  className?: string;
  style?: ComponentProps<typeof animated.div>["style"];
  /**
   * The SelfMatrix speaker overlay (Slice 5), shown on top of a screen share
   * that is currently being watched.
   */
  speakerOverlay?: ReactNode;
}

export const SpotlightTile: FC<Props> = ({
  ref: theirRef,
  vm,
  expanded,
  onToggleExpanded,
  targetWidth,
  targetHeight,
  showIndicators,
  showNameTags,
  focusable = true,
  pinned = false,
  onUnpin = null,
  className,
  style,
  speakerOverlay,
}) => {
  const { t } = useTranslation();
  const [ourRef, root$] = useObservableRef<HTMLDivElement | null>(null);
  const ref = useMergedRefs(ourRef, theirRef);
  const maximised = useBehavior(vm.maximised$);
  const media = useBehavior(vm.media$);
  const [visibleId, setVisibleId] = useState<string | undefined>(media[0]?.id);
  const latestMedia = useLatest(media);
  const latestVisibleId = useLatest(visibleId);
  const visibleIndex = media.findIndex((vm) => vm.id === visibleId);
  const visibleMedia = media.at(visibleIndex);
  const canGoBack = visibleIndex > 0;
  const canGoToNext = visibleIndex !== -1 && visibleIndex < media.length - 1;

  // Remote screen shares are opt-in (SelfMatrix Slice 4): while not watched,
  // no LiveKit subscription is held for their tracks. All other media types
  // (including local screen shares) are always considered "watched".
  const visibleRemoteScreenShare =
    visibleMedia?.type === "screen share" && !visibleMedia.local
      ? visibleMedia
      : undefined;
  const alwaysWatching$ = useInitial(() => constant(true));
  const watching = useBehavior(
    visibleRemoteScreenShare?.watching$ ?? alwaysWatching$,
  );

  const { popout, popoutActive } = usePopoutScreenShare(
    watching ? visibleMedia : undefined,
  );

  const onFocusPopout = useCallback(() => popout?.(), [popout]);

  // SelfMatrix Slice 2: while the visible screen share is popped out into
  // its own window, show a lightweight placeholder overlay in its tile here
  // in the main window instead of the speaker overlay/watch gate, so it's
  // clear at a glance that the stream has moved elsewhere.
  const popoutOverlay = popoutActive ? (
    <PopoutActiveOverlay onFocus={onFocusPopout} focusable={focusable} />
  ) : undefined;

  // SelfMatrix Slice 6a: when there are 2 or more items in the spotlight
  // carousel, the user can switch to a "split" mode that shows two of them
  // side by side instead of paging through them one at a time. Each pane
  // tracks its own media selection independently, and automatically skips
  // over whatever the other pane is currently showing.
  const [split, setSplit] = useState(false);
  const canSplit = media.length >= 2;
  // Split mode only makes sense with 2+ items; fall back to the carousel
  // automatically if the call drops back down to 0 or 1 items in the
  // spotlight (e.g. a screen share ends).
  useEffect(() => {
    if (!canSplit) setSplit(false);
  }, [canSplit]);

  const [splitPaneIds, setSplitPaneIds] = useReactiveState<
    [string | undefined, string | undefined]
  >(
    (prev) => {
      const [prevLeft, prevRight] = prev ?? [undefined, undefined];
      // Keep any still-valid selections; otherwise default the left pane to
      // whatever the carousel currently has visible, and the right pane to
      // the next item after it (wrapping, and never matching the left pane).
      const left =
        prevLeft !== undefined && media.some((m) => m.id === prevLeft)
          ? prevLeft
          : (visibleMedia?.id ?? media[0]?.id);
      const rightCandidate =
        prevRight !== undefined && media.some((m) => m.id === prevRight)
          ? prevRight
          : undefined;
      const right =
        rightCandidate !== undefined && rightCandidate !== left
          ? rightCandidate
          : media.find((m) => m.id !== left)?.id;
      return [left, right];
    },
    [media, visibleMedia?.id],
  );
  const [splitLeftId, splitRightId] = splitPaneIds;
  const splitLeftMedia = media.find((m) => m.id === splitLeftId);
  const splitRightMedia = media.find((m) => m.id === splitRightId);

  /**
   * Advances a single split pane to the next available media item, cycling
   * through the full list in order while skipping over the item currently
   * shown in the other pane.
   */
  const advanceSplitPane = useCallback(
    (pane: "left" | "right") => {
      setSplitPaneIds(([left, right]) => {
        const currentId = pane === "left" ? left : right;
        const otherId = pane === "left" ? right : left;
        const currentIndex = media.findIndex((m) => m.id === currentId);
        if (media.length === 0) return [left, right];
        const order =
          currentIndex === -1
            ? media.map((_, i) => i)
            : media.map((_, i) => (currentIndex + 1 + i) % media.length);
        const nextId =
          media[order.find((i) => media[i].id !== otherId) ?? order[0]]?.id;
        return pane === "left" ? [nextId, right] : [left, nextId];
      });
    },
    [media, setSplitPaneIds],
  );

  const onSplitLeftNext = useCallback(
    () => advanceSplitPane("left"),
    [advanceSplitPane],
  );
  const onSplitRightNext = useCallback(
    () => advanceSplitPane("right"),
    [advanceSplitPane],
  );

  const onToggleSplit = useCallback(() => setSplit((s) => !s), []);

  const isFullscreen = useCallback((): boolean => {
    const rootElement = document.body;
    if (rootElement && document.fullscreenElement) return true;
    return false;
  }, []);

  const FullScreenIcon = isFullscreen()
    ? FullScreenMinimiseIcon
    : FullScreenMaximiseIcon;

  const onToggleFullscreen = useCallback(() => {
    const rootElement = document.body;
    if (!rootElement) return;
    if (isFullscreen()) {
      void document?.exitFullscreen();
    } else {
      void rootElement.requestFullscreen();
    }
  }, [isFullscreen]);

  // To keep track of which item is visible, we need an intersection observer
  // hooked up to the root element and the items. Because the items will run
  // their effects before their parent does, we need to do this dance with an
  // Observable to actually give them the intersection observer.
  const intersectionObserver$ = useInitial<Observable<IntersectionObserver>>(
    () =>
      root$.pipe(
        map(
          (r) =>
            new IntersectionObserver(
              (entries) => {
                const visible = entries.find((e) => e.isIntersecting);
                if (visible !== undefined)
                  setVisibleId(visible.target.getAttribute("data-id")!);
              },
              { root: r, threshold: 0.5 },
            ),
        ),
      ),
  );

  const [scrollToId, setScrollToId] = useReactiveState<string | null>(
    (prev) =>
      prev == null || prev === visibleId || media.every((vm) => vm.id !== prev)
        ? null
        : prev,
    [visibleId],
  );

  const onBackClick = useCallback(() => {
    const media = latestMedia.current;
    const visibleIndex = media.findIndex(
      (vm) => vm.id === latestVisibleId.current,
    );
    if (visibleIndex > 0) setScrollToId(media[visibleIndex - 1].id);
  }, [latestVisibleId, latestMedia, setScrollToId]);

  const onNextClick = useCallback(() => {
    const media = latestMedia.current;
    const visibleIndex = media.findIndex(
      (vm) => vm.id === latestVisibleId.current,
    );
    if (visibleIndex !== -1 && visibleIndex !== media.length - 1)
      setScrollToId(media[visibleIndex + 1].id);
  }, [latestVisibleId, latestMedia, setScrollToId]);

  const ToggleExpandIcon = expanded ? CollapseIcon : ExpandIcon;

  return (
    <animated.div
      ref={ref}
      className={classNames(className, styles.tile, {
        [styles.maximised]: maximised,
      })}
      style={style}
    >
      {!split && canGoBack && (
        <button
          className={classNames(styles.advance, styles.back)}
          aria-label={t("common.back")}
          onClick={onBackClick}
          tabIndex={focusable ? undefined : -1}
        >
          <ChevronLeftIcon aria-hidden width={24} height={24} />
        </button>
      )}
      {split ? (
        <div className={styles.splitContents}>
          <div className={styles.splitPane} data-testid="split_pane">
            {splitLeftMedia && (
              <SpotlightItem
                key={splitLeftMedia.id}
                vm={splitLeftMedia}
                targetWidth={targetWidth / 2}
                targetHeight={targetHeight}
                showNameTags={showNameTags}
                focusable={focusable}
                intersectionObserver$={undefined}
                snap={false}
                speakerOverlay={speakerOverlay}
                popoutOverlay={
                  splitLeftMedia.id === visibleMedia?.id
                    ? popoutOverlay
                    : undefined
                }
              />
            )}
            {media.length >= 3 && (
              <button
                className={classNames(styles.expand, styles.splitPaneNext)}
                aria-label={t("video_tile.split_view_next")}
                data-testid="split_pane_next"
                onClick={onSplitLeftNext}
                tabIndex={focusable ? undefined : -1}
              >
                <ChevronRightIcon aria-hidden width={20} height={20} />
              </button>
            )}
          </div>
          <div className={styles.splitPane} data-testid="split_pane">
            {splitRightMedia && (
              <SpotlightItem
                key={splitRightMedia.id}
                vm={splitRightMedia}
                targetWidth={targetWidth / 2}
                targetHeight={targetHeight}
                showNameTags={showNameTags}
                focusable={focusable}
                intersectionObserver$={undefined}
                snap={false}
                // The SelfMatrix speaker overlay is only shown on the left
                // pane, to avoid rendering it twice.
                speakerOverlay={undefined}
              />
            )}
            {media.length >= 3 && (
              <button
                className={classNames(styles.expand, styles.splitPaneNext)}
                aria-label={t("video_tile.split_view_next")}
                data-testid="split_pane_next"
                onClick={onSplitRightNext}
                tabIndex={focusable ? undefined : -1}
              >
                <ChevronRightIcon aria-hidden width={20} height={20} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.contents}>
          {media.map((vm) => (
            <SpotlightItem
              key={vm.id}
              vm={vm}
              targetWidth={targetWidth}
              targetHeight={targetHeight}
              showNameTags={showNameTags}
              focusable={focusable}
              intersectionObserver$={intersectionObserver$}
              // This is how we get the container to scroll to the right media
              // when the previous/next buttons are clicked: we temporarily
              // remove all scroll snap points except for just the one media
              // that we want to bring into view
              snap={scrollToId === null || scrollToId === vm.id}
              aria-hidden={(scrollToId ?? visibleId) !== vm.id}
              speakerOverlay={vm.id === visibleId ? speakerOverlay : undefined}
              popoutOverlay={vm.id === visibleId ? popoutOverlay : undefined}
            />
          ))}
        </div>
      )}

      <div className={styles.bottomRightButtons}>
        {canSplit && (
          <button
            className={classNames(styles.expand)}
            aria-label={
              split ? t("video_tile.unsplit_view") : t("video_tile.split_view")
            }
            aria-pressed={split}
            data-testid="incall_split"
            onClick={onToggleSplit}
            tabIndex={focusable ? undefined : -1}
          >
            <SidebarIcon aria-hidden width={20} height={20} />
          </button>
        )}
        {pinned && onUnpin && (
          <button
            className={classNames(styles.expand)}
            aria-label={t("video_tile.unpin")}
            aria-pressed
            data-testid="incall_unpin"
            onClick={onUnpin}
            tabIndex={focusable ? undefined : -1}
          >
            <PinSolidIcon aria-hidden width={20} height={20} />
          </button>
        )}
        {!split && visibleRemoteScreenShare && watching && (
          <button
            className={classNames(styles.expand)}
            aria-label={t("video_tile.stop_watching")}
            data-testid="incall_unwatch"
            onClick={() => visibleRemoteScreenShare.setWatching(false)}
            tabIndex={focusable ? undefined : -1}
          >
            <VisibilityOffIcon aria-hidden width={20} height={20} />
          </button>
        )}
        {!split &&
          visibleMedia?.type === "screen share" &&
          !visibleMedia.local && <ScreenShareVolumeButton vm={visibleMedia} />}
        {!split && popout && (
          <button
            className={classNames(styles.expand)}
            aria-label={"pop out"}
            aria-pressed={popoutActive}
            data-testid="incall_popout"
            onClick={popout}
            tabIndex={focusable ? undefined : -1}
          >
            <PopOutIcon aria-hidden width={20} height={20} />
          </button>
        )}
        {platform === "desktop" && (
          <button
            className={classNames(styles.expand)}
            aria-label={"maximise"}
            onClick={onToggleFullscreen}
            tabIndex={focusable ? undefined : -1}
          >
            <FullScreenIcon aria-hidden width={20} height={20} />
          </button>
        )}
        {onToggleExpanded && (
          <button
            className={classNames(styles.expand)}
            aria-label={
              expanded ? t("video_tile.collapse") : t("video_tile.expand")
            }
            aria-pressed={expanded}
            data-testid="incall_hide_minitiles"
            onClick={onToggleExpanded}
            tabIndex={focusable ? undefined : -1}
          >
            <ToggleExpandIcon aria-hidden width={20} height={20} />
          </button>
        )}
      </div>

      {!split && canGoToNext && (
        <button
          className={classNames(styles.advance, styles.next)}
          aria-label={t("common.next")}
          onClick={onNextClick}
          tabIndex={focusable ? undefined : -1}
        >
          <ChevronRightIcon aria-hidden width={24} height={24} />
        </button>
      )}
      {!split && !expanded && (
        <div
          className={classNames(styles.indicators, {
            [styles.show]: showIndicators && media.length > 1,
          })}
        >
          {media.map((vm) => (
            <div
              data-testid="screenshare-indicator"
              key={vm.id}
              className={styles.item}
              data-visible={vm.id === visibleId}
            />
          ))}
        </div>
      )}
    </animated.div>
  );
};

SpotlightTile.displayName = "SpotlightTile";
