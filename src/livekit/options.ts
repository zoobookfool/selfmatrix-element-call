/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  DefaultReconnectPolicy,
  type RoomOptions,
  type TrackPublishDefaults,
  VideoPreset,
  VideoPresets,
} from "livekit-client";

// SelfMatrix: 4K60 画面共有 (requirements SHOULD)。実効ビットレートは内容依存。
// livekit-client の ScreenSharePresets には 4K60 相当が無いため (h1080fps30 が上限)、
// 自前で VideoPreset を定義する。maxBitrate は docs/architecture.md の見積 (4K60 ≈ 25Mbps) に一致。
const screenShare4k60 = new VideoPreset(3840, 2160, 25_000_000, 60);

// 非注視タイル (ミニタイル) 用の画面共有低解像度 simulcast 層。
const screenShare720p15Low = new VideoPreset(1280, 720, 1_500_000, 15);

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
