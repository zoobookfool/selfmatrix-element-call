/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  AudioPresets,
  DefaultReconnectPolicy,
  type RoomOptions,
  ScreenSharePresets,
  type TrackPublishDefaults,
  type VideoPreset,
  VideoPresets,
} from "livekit-client";

const defaultLiveKitPublishOptions: TrackPublishDefaults = {
  // SPIKE(項目2): 音声ビットレート上書きテスト。既定 AudioPresets.music からカスタム値へ
  audioPreset: { maxBitrate: 128_000 },
  dtx: true,
  // disable red because the livekit server strips out red packets for clients
  // that don't support it (firefox) but of course that doesn't work with e2ee.
  red: false,
  forceStereo: false,
  simulcast: true,
  videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360] as VideoPreset[],
  // SPIKE(項目2): 画面共有パラメータ上書きテスト。既定 ScreenSharePresets.h1080fps30.encoding
  // (maxBitrate 3Mbps / maxFramerate 30) からカスタム値へ。webrtc-internals で fps≈5 を確認する
  screenShareEncoding: { maxBitrate: 800_000, maxFramerate: 5 },
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
