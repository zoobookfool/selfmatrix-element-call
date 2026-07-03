/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "matrix-js-sdk/lib/logger";
import { type Track } from "livekit-client";
import { type TrackReference } from "@livekit/components-core";

import { useBehavior } from "../../useBehavior";
import { constant } from "../../state/Behavior";
import { useInitial } from "../../useInitial";
import { type MediaViewModel } from "../../state/media/MediaViewModel";

type TrackReferenceValue = TrackReference | undefined;

/**
 * How often to poll for the popout window having been closed by the user.
 * There is no reliable cross-browser event for this (window.open windows do
 * not fire a "close" event that the opener can observe), so we fall back to
 * polling `window.closed`.
 */
const CLOSED_POLL_INTERVAL_MS = 500;

interface PopoutScreenShare {
  /**
   * Opens (or focuses) a popout window showing this media's video track, or
   * null if this media is not a screen share and thus cannot be popped out.
   */
  popout: (() => void) | null;
  /**
   * Whether the popout window is currently open and showing video.
   */
  popoutActive: boolean;
}

/**
 * Sets up the video element inside a freshly opened popout window: sets the
 * window title, strips the document down to a full-bleed black background,
 * and inserts a <video> element sized to fill the window.
 */
function setUpPopoutDocument(
  popoutWindow: Window,
  title: string,
): HTMLVideoElement {
  const { document: popoutDocument } = popoutWindow;
  popoutDocument.title = title;

  const { body } = popoutDocument;
  body.style.margin = "0";
  body.style.background = "#000";
  body.style.overflow = "hidden";

  const video = popoutDocument.createElement("video");
  video.autoplay = true;
  video.style.width = "100%";
  video.style.height = "100vh";
  video.style.objectFit = "contain";
  body.appendChild(video);

  return video;
}

/**
 * Hook powering the Discord-style "pop out this stream into its own window"
 * feature (SelfMatrix Slice 2). This intentionally does not tear down or
 * reconnect any LiveKit subscription: the tile in the main window stays
 * mounted (and thus stays the adaptiveStream visibility anchor), and the
 * popout window is simply an additional `attach()` target for the very same
 * already-decrypted video track.
 */
export function usePopoutScreenShare(
  vm: MediaViewModel | undefined,
): PopoutScreenShare {
  const isScreenShare = vm?.type === "screen share";
  // Hooks must be called unconditionally. When this media isn't a screen
  // share (or there is no media at all) we fall back to Behaviors that never
  // emit anything meaningful, so the popout/video state stays inert.
  const noVideo$ = useInitial(() => constant<TrackReferenceValue>(undefined));
  const noName$ = useInitial(() => constant(""));
  const video = useBehavior(isScreenShare ? vm.video$ : noVideo$);
  const displayName = useBehavior(isScreenShare ? vm.displayName$ : noName$);

  const [popoutActive, setPopoutActive] = useState(false);
  const popoutWindowRef = useRef<Window | null>(null);
  const popoutVideoElRef = useRef<HTMLVideoElement | null>(null);
  const attachedTrackRef = useRef<Track | undefined>(undefined);

  const cleanUp = useCallback(() => {
    if (attachedTrackRef.current && popoutVideoElRef.current) {
      attachedTrackRef.current.detach(popoutVideoElRef.current);
    }
    attachedTrackRef.current = undefined;
    popoutVideoElRef.current = null;

    if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
      popoutWindowRef.current.close();
    }
    popoutWindowRef.current = null;

    setPopoutActive(false);
  }, []);

  const popout = useCallback(() => {
    if (!isScreenShare) return;

    // Re-use the existing popout window if the user clicks the button again.
    if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
      popoutWindowRef.current.focus();
      return;
    }

    const popoutWindow = window.open(
      "",
      `selfmatrix_stream_popout_${vm.id}`,
      "popup=yes,width=1280,height=720",
    );
    if (!popoutWindow) {
      logger.warn("usePopoutScreenShare: window.open was blocked or failed");
      return;
    }

    const title = `${displayName} — SelfMatrix Stream`;
    const videoEl = setUpPopoutDocument(popoutWindow, title);

    popoutWindowRef.current = popoutWindow;
    popoutVideoElRef.current = videoEl;
    setPopoutActive(true);

    const track = video?.publication.track;
    if (track) {
      track.attach(videoEl);
      attachedTrackRef.current = track;
    }
  }, [isScreenShare, vm, displayName, video]);

  // Keep the popout window's attached track in sync with the current video
  // track, and close the popout if the screen share stops.
  useEffect(() => {
    if (!popoutActive) return;

    if (!video) {
      // The stream ended: tear down the popout entirely.
      cleanUp();
      return;
    }

    const videoEl = popoutVideoElRef.current;
    if (!videoEl) return;

    const track = video.publication.track;
    if (track === attachedTrackRef.current) return;

    // The underlying track changed (e.g. reconnect/renegotiation) - move the
    // attachment over to the new track.
    if (attachedTrackRef.current) {
      attachedTrackRef.current.detach(videoEl);
      attachedTrackRef.current = undefined;
    }
    if (track) {
      track.attach(videoEl);
      attachedTrackRef.current = track;
    }
  }, [video, popoutActive, cleanUp]);

  // Poll for the user closing the popout window themselves.
  useEffect(() => {
    if (!popoutActive) return;

    const interval = window.setInterval(() => {
      if (popoutWindowRef.current?.closed) cleanUp();
    }, CLOSED_POLL_INTERVAL_MS);

    return (): void => window.clearInterval(interval);
  }, [popoutActive, cleanUp]);

  // Clean up on unmount.
  useEffect(() => cleanUp, [cleanUp]);

  return { popout: isScreenShare ? popout : null, popoutActive };
}
