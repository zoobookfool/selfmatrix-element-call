/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/lib/logger";
import { BehaviorSubject } from "rxjs";

import { PosthogAnalytics } from "../analytics/PosthogAnalytics";
import { type Behavior } from "../state/Behavior";
import { useBehavior } from "../useBehavior";
import type { Alignment } from "../state/layout-types";

export class Setting<T> {
  public constructor(
    key: string,
    public readonly defaultValue: T,
  ) {
    this.key = `matrix-setting-${key}`;

    const storedValue = localStorage.getItem(this.key);
    let initialValue = defaultValue;
    if (storedValue !== null) {
      try {
        initialValue = JSON.parse(storedValue);
      } catch (e) {
        logger.warn(
          `Invalid value stored for setting ${key}: ${storedValue}.`,
          e,
        );
      }
    }

    this._value$ = new BehaviorSubject(initialValue);
    this.value$ = this._value$;
    this._lastUpdateReason$ = new BehaviorSubject<string | null>(null);
    this.lastUpdateReason$ = this._lastUpdateReason$;
  }

  private readonly key: string;

  private readonly _value$: BehaviorSubject<T>;
  private readonly _lastUpdateReason$: BehaviorSubject<string | null>;
  public readonly value$: Behavior<T>;
  public readonly lastUpdateReason$: Behavior<string | null>;

  public readonly setValue = (value: T, reason?: string): void => {
    this._value$.next(value);
    this._lastUpdateReason$.next(reason ?? null);
    localStorage.setItem(this.key, JSON.stringify(value));
  };
  public readonly getValue = (): T => {
    return this._value$.getValue();
  };

  /**
   * SelfMatrix: re-reads the setting straight from localStorage instead of
   * the in-memory BehaviorSubject. `Setting` only reads localStorage once, at
   * construction time, so a same-origin parent frame (the cinny shell) that
   * writes to this key *after* the module has initialised would otherwise be
   * invisible to `getValue()`. Used by the screen share quality/fps picker,
   * which lives in the cinny shell and writes to the same localStorage keys.
   * Falls back to the current in-memory value if nothing is stored or the
   * stored value fails to parse.
   */
  public readonly getStoredValue = (): T => {
    const storedValue = localStorage.getItem(this.key);
    if (storedValue !== null) {
      try {
        return JSON.parse(storedValue) as T;
      } catch (e) {
        logger.warn(
          `Invalid value stored for setting ${this.key}: ${storedValue}.`,
          e,
        );
      }
    }
    return this._value$.getValue();
  };
}

/**
 * React hook that returns a settings's current value and a setter.
 */
export function useSetting<T>(setting: Setting<T>): [T, (value: T) => void] {
  return [useBehavior(setting.value$), setting.setValue];
}

// null = undecided
export const optInAnalytics = new Setting<boolean | null>(
  "opt-in-analytics",
  null,
);
// TODO: This setting can be disabled. Work out an approach to disableable
// settings thats works for Observables in addition to React.
export const useOptInAnalytics = (): [
  boolean | null,
  ((value: boolean | null) => void) | null,
] => {
  const setting = useSetting(optInAnalytics);
  return PosthogAnalytics.instance.isEnabled() ? setting : [false, null];
};

export const developerMode = new Setting("developer-settings-tab", false);

export const duplicateTiles = new Setting("duplicate-tiles", 0);

export const debugTileLayout = new Setting("debug-tile-layout", false);

export const showConnectionStats = new Setting<boolean>(
  "show-connection-stats",
  false,
);

export const audioInput = new Setting<string | undefined>(
  "audio-input",
  undefined,
);
export const audioOutput = new Setting<string | undefined>(
  "audio-output",
  undefined,
);
export const videoInput = new Setting<string | undefined>(
  "video-input",
  undefined,
);

export const backgroundBlur = new Setting<boolean>("background-blur", false);

/**
 * SelfMatrix: ML-based background noise suppression (RNNoise via
 * NoiseSuppressionProcessor). Defaults to enabled, unlike backgroundBlur.
 */
export const noiseSuppressionMl = new Setting<boolean>(
  "noise-suppression-ml",
  true,
);

export const showHandRaisedTimer = new Setting<boolean>(
  "hand-raised-show-timer",
  false,
);

export const showReactions = new Setting<boolean>("reactions-show", true);

export const playReactionsSound = new Setting<boolean>(
  "reactions-play-sound",
  true,
);

export const soundEffectVolume = new Setting<number>(
  "sound-effect-volume",
  0.5,
);

export const muteAllAudio = new Setting<boolean>("mute-all-audio", false);

export const alwaysShowSelf = new Setting<boolean>("always-show-self", true);

export const alwaysShowIphoneEarpiece = new Setting<boolean>(
  "always-show-iphone-earpiece",
  false,
);

export const enableExtendedLivekitLogs = new Setting<boolean>(
  "extended-livekit-logs",
  false,
);

export enum MatrixRTCMode {
  Legacy = "legacy",
  Compatibility = "compatibility",
  /** This implies using
   *  - sticky events
   *  - hashed RTC backend identity
   *  - the new endpoint for the jwt token on the local membership (remote memberships will always try the new jwt endpoint first -> then the legacy one)
   *  - use the hashed identity for the local membership
   */
  Matrix_2_0 = "matrix_2_0",
}

export const matrixRTCMode = new Setting<MatrixRTCMode>(
  "matrix-rtc-mode",
  MatrixRTCMode.Legacy,
);

export const customLivekitUrl = new Setting<string | null>(
  "custom-livekit-url",
  null,
);

/**
 * Corner (in the SpotlightTile's screen share) that the SelfMatrix speaker
 * overlay (Slice 5, Discord StreamKit-style) is snapped to. Persisted across
 * sessions like the other alignment-driven layout settings.
 */
export const speakerOverlayAlignment = new Setting<Alignment>(
  "speaker-overlay-alignment",
  { block: "end", inline: "start" },
);

/**
 * Which edge of the spotlight-landscape layout the mini-tile strip (the
 * scrolling rail of participant tiles) is docked to (SelfMatrix Slice 6b).
 * Defaults to "bottom" to match Discord's layout convention, which differs
 * from upstream Element Call's original default of a right-hand strip.
 */
export type MiniTileStripPosition = "top" | "bottom" | "left" | "right";

export const miniTileStripPosition = new Setting<MiniTileStripPosition>(
  "mini-tile-strip-position",
  "bottom",
);

/**
 * SelfMatrix: screen share quality preset (requirements §3 SHOULD, Discord
 * parity). Selected in the screen share options menu and applied only when a
 * new share is started (livekit-client treats a later `setScreenShareEnabled`
 * call on an already-sharing track as an unmute, ignoring capture options).
 * "2160" (4K) matches the existing default behaviour.
 */
export type ScreenShareQuality = "480" | "720" | "1080" | "2160";

export const screenShareQuality = new Setting<ScreenShareQuality>(
  "screen-share-quality",
  "2160",
);

/**
 * SelfMatrix: screen share frame rate preset, paired with
 * {@link screenShareQuality}. Defaults to 60fps, matching the existing
 * default behaviour.
 */
export type ScreenShareFps = 15 | 30 | 60;

export const screenShareFps = new Setting<ScreenShareFps>(
  "screen-share-fps",
  60,
);

/**
 * SelfMatrix: validates a value read back from localStorage (which may have
 * been written by the cinny shell's screen share quality/fps picker, a
 * same-origin but independently-versioned parent frame) before it is used to
 * configure screen capture. Falls back to {@link screenShareQuality}'s
 * default for anything that isn't one of the known presets.
 */
export function sanitizeScreenShareQuality(value: unknown): ScreenShareQuality {
  if (
    value === "480" ||
    value === "720" ||
    value === "1080" ||
    value === "2160"
  ) {
    return value;
  }
  return screenShareQuality.defaultValue;
}

/**
 * SelfMatrix: validates a value read back from localStorage (which may have
 * been written by the cinny shell's screen share quality/fps picker, a
 * same-origin but independently-versioned parent frame) before it is used to
 * configure screen capture. Falls back to {@link screenShareFps}'s default
 * for anything that isn't one of the known presets.
 */
export function sanitizeScreenShareFps(value: unknown): ScreenShareFps {
  if (value === 15 || value === 30 || value === 60) {
    return value;
  }
  return screenShareFps.defaultValue;
}
