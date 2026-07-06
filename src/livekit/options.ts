/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  DefaultReconnectPolicy,
  type RoomOptions,
  type TrackPublishDefaults,
  type TrackPublishOptions,
  VideoPreset,
  VideoPresets,
} from "livekit-client";

import {
  type ScreenShareFps,
  type ScreenShareQuality,
} from "../settings/settings";

// SelfMatrix: 4K60 画面共有 (requirements SHOULD)。実効ビットレートは内容依存。
// livekit-client の ScreenSharePresets には 4K60 相当が無いため (h1080fps30 が上限)、
// 自前で VideoPreset を定義する。maxBitrate は docs/architecture.md の見積 (4K60 ≈ 25Mbps) に一致。
const screenShare4k60 = new VideoPreset(3840, 2160, 25_000_000, 60);

// 非注視タイル (ミニタイル) 用の画面共有低解像度 simulcast 層。
const screenShare720p15Low = new VideoPreset(1280, 720, 1_500_000, 15);

// SelfMatrix: 画面共有の画質/FPS ピッカー (requirements §3 SHOULD, Discord 準拠) 用の
// 低解像度側の追加 simulcast 層。720p/480p を主レイヤーに選んだ場合、既存の
// screenShare720p15Low を主レイヤーより上位にはできないため専用の低層を用意する。
const screenShare360p15Low = new VideoPreset(640, 360, 400_000, 15);
const screenShare240p15Low = new VideoPreset(426, 240, 150_000, 15);

const defaultLiveKitPublishOptions: TrackPublishDefaults = {
  // SelfMatrix: Opus 384kbps ステレオ (requirements SHOULD)。ハイレゾ別系統は Phase 6。
  audioPreset: { maxBitrate: 384_000 },
  dtx: false,
  // disable red because the livekit server strips out red packets for clients
  // that don't support it (firefox) but of course that doesn't work with e2ee.
  red: false,
  forceStereo: true,
  simulcast: true,
  videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360] as VideoPreset[],
  screenShareEncoding: screenShare4k60.encoding,
  screenShareSimulcastLayers: [screenShare720p15Low] as VideoPreset[],
  stopMicTrackOnMute: false,
  videoCodec: "vp8",
  videoEncoding: VideoPresets.h720.encoding,
  backupCodec: { codec: "vp8", encoding: VideoPresets.h720.encoding },
} as const;

export const defaultLiveKitOptions: RoomOptions = {
  // automatically manage subscribed video quality
  adaptiveStream: true,

  // optimize publishing bandwidth and CPU for published tracks
  dynacast: true,

  // capture settings
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution,
  },

  // publish settings
  publishDefaults: defaultLiveKitPublishOptions,

  // default LiveKit options that seem to be sane
  stopLocalTrackOnUnpublish: true,
  reconnectPolicy: new DefaultReconnectPolicy(),
  disconnectOnPageLeave: true,
  webAudioMix: false,
};

// SelfMatrix: 画面共有の画質/FPS ピッカー (requirements §3 SHOULD, Discord 準拠)。
// capture 解像度は width/height のみで、frameRate は選択された FPS をそのまま使う。
const screenShareCaptureResolutions: Record<
  ScreenShareQuality,
  { width: number; height: number }
> = {
  "480": { width: 854, height: 480 },
  "720": { width: 1280, height: 720 },
  "1080": { width: 1920, height: 1080 },
  "2160": { width: 3840, height: 2160 },
};

// publish maxBitrate (bps) の表。SelfMatrix: 画質/FPS ピッカーの各組み合わせについて
// Discord 相当の実効ビットレートを見積もったもの (docs/architecture.md 4K60 ≈ 25Mbps に準拠)。
const screenShareMaxBitrates: Record<
  ScreenShareQuality,
  Record<ScreenShareFps, number>
> = {
  "2160": { 15: 12_000_000, 30: 18_000_000, 60: 25_000_000 },
  "1080": { 15: 3_000_000, 30: 5_000_000, 60: 8_000_000 },
  "720": { 15: 1_500_000, 30: 2_500_000, 60: 4_000_000 },
  "480": { 15: 800_000, 30: 1_200_000, 60: 2_000_000 },
};

// ミニタイル用の低解像度 simulcast 層。主レイヤーの解像度に対して常に一段低いものを選ぶ。
const screenShareLowLayers: Record<ScreenShareQuality, VideoPreset> = {
  "2160": screenShare720p15Low,
  "1080": screenShare720p15Low,
  "720": screenShare360p15Low,
  "480": screenShare240p15Low,
};

/**
 * SelfMatrix: 選択された画質/FPS から `getDisplayMedia` の capture 解像度制約を作る
 * (requirements §3 SHOULD)。開始時のみ適用される (共有中の変更は livekit-client が
 * unmute として扱い無視するため)。
 */
export function screenShareCaptureResolution(
  quality: ScreenShareQuality,
  fps: ScreenShareFps,
): { width: number; height: number; frameRate: number } {
  return { ...screenShareCaptureResolutions[quality], frameRate: fps };
}

/**
 * SelfMatrix: 選択された画質/FPS から publish 用の TrackPublishOptions を作る
 * (requirements §3 SHOULD)。`defaultLiveKitPublishOptions` 自体は変更せず、
 * フォールバックの既定値 (4K60) のまま維持する。
 */
export function screenSharePublishOptions(
  quality: ScreenShareQuality,
  fps: ScreenShareFps,
): TrackPublishOptions {
  const { width, height } = screenShareCaptureResolutions[quality];
  const maxBitrate = screenShareMaxBitrates[quality][fps];
  const encodingPreset = new VideoPreset(width, height, maxBitrate, fps);
  return {
    screenShareEncoding: encodingPreset.encoding,
    screenShareSimulcastLayers: [
      screenShareLowLayers[quality],
    ] as VideoPreset[],
  };
}
