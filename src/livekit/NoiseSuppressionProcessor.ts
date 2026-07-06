/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  loadRnnoise,
  RnnoiseWorkletNode,
} from "@sapphi-red/web-noise-suppressor";
import rnnoiseWorkletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import rnnoiseWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseWasmSimdPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";
import {
  type AudioProcessorOptions,
  type Track,
  type TrackProcessor,
} from "livekit-client";
import { logger as rootLogger } from "matrix-js-sdk/lib/logger";

const logger = rootLogger.getChild("[NoiseSuppressionProcessor]");

// RNNoise is trained on and only operates on 48kHz mono/stereo audio, but the
// worklet itself supports up to this many channels of input.
const maxChannels = 2;

/**
 * SelfMatrix: ML-based background noise suppression, built on RNNoise
 * (via `@sapphi-red/web-noise-suppressor`'s AudioWorklet + WASM bundle).
 *
 * Implements livekit-client's `TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>`
 * so it can be assigned to `audioCaptureDefaults.processor` / `LocalAudioTrack.setProcessor()`,
 * mirroring how {@link ../livekit/BlurBackgroundTransformer.ts} plugs into the video
 * pipeline via `@livekit/track-processors`. That package is video-only, so this
 * processor is hand-rolled directly against the livekit-client `TrackProcessor`
 * interface instead.
 *
 * Audio graph: MediaStreamTrack -> MediaStreamAudioSourceNode -> RnnoiseWorkletNode
 * -> MediaStreamAudioDestinationNode -> `processedTrack`.
 *
 * If AudioWorklet is unavailable, or the worklet module / wasm binary fails to
 * load, `init()` swallows the error, logs a single warning, sets
 * {@link NoiseSuppressionProcessor.failed} to `true`, and leaves
 * `processedTrack` unset so livekit-client falls back to passing the original
 * (unprocessed) track through untouched.
 */
export class NoiseSuppressionProcessor
  implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>
{
  public readonly name = "selfmatrix-noise-suppression-rnnoise";
  public processedTrack?: MediaStreamTrack;

  /**
   * Set to `true` if initialization failed for any reason (AudioWorklet not
   * supported, wasm/module load failure, etc). Readable from the outside so
   * the settings UI / logs can reflect that suppression is not actually active
   * even though the setting is enabled.
   */
  public failed = false;

  private audioContext?: AudioContext;
  private sourceNode?: MediaStreamAudioSourceNode;
  private rnnoiseNode?: RnnoiseWorkletNode;
  private destinationNode?: MediaStreamAudioDestinationNode;
  private moduleLoaded = false;

  public async init(opts: AudioProcessorOptions): Promise<void> {
    try {
      await this.setup(opts);
      this.failed = false;
    } catch (e) {
      this.failed = true;
      this.teardown();
      logger.warn(
        "Failed to initialize RNNoise noise suppression, falling back to unprocessed audio",
        e,
      );
    }
  }

  public async restart(opts: AudioProcessorOptions): Promise<void> {
    // livekit-client's `restart()` call (from `setMediaStreamTrack`, e.g. on
    // device switch) does not re-provide `audioContext`, so reuse the one
    // captured during `init()`.
    const audioContext = opts.audioContext ?? this.audioContext;
    if (!audioContext) {
      this.failed = true;
      logger.warn(
        "Cannot restart RNNoise noise suppression: no AudioContext available",
      );
      return;
    }
    this.teardown();
    await this.init({ ...opts, audioContext });
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- TrackProcessor's contract requires an async destroy(), but our teardown here is synchronous
  public async destroy(): Promise<void> {
    this.teardown();
  }

  private async setup(opts: AudioProcessorOptions): Promise<void> {
    const { audioContext, track } = opts;

    if (typeof AudioWorkletNode === "undefined" || !audioContext.audioWorklet) {
      throw new Error("AudioWorklet is not supported in this browser");
    }

    // livekit-client may hand us an AudioContext that is still suspended
    // (e.g. created before any user gesture). It generally resumes this
    // itself once possible, but resume defensively here too since a suspended
    // context will silently produce no output on the processed track.
    if (audioContext.state === "suspended") {
      await audioContext.resume().catch((e: unknown) => {
        logger.warn("Failed to resume suspended AudioContext", e);
      });
    }

    // Only register the worklet module once per AudioContext -- addModule()
    // throws if you try to load the same module URL into a context that
    // already has it (harmless but noisy), and there is no "is registered"
    // query API, so we track this ourselves per-processor-instance. Since a
    // given AudioContext is reused across restarts of the *same* processor,
    // and livekit-client mints a single AudioContext per Room, this is
    // sufficient in practice.
    if (!this.moduleLoaded) {
      await audioContext.audioWorklet.addModule(rnnoiseWorkletPath);
      this.moduleLoaded = true;
    }

    const wasmBinary = await loadRnnoise({
      url: rnnoiseWasmPath,
      simdUrl: rnnoiseWasmSimdPath,
    });

    const sourceNode = audioContext.createMediaStreamSource(
      new MediaStream([track]),
    );
    const rnnoiseNode = new RnnoiseWorkletNode(audioContext, {
      maxChannels,
      wasmBinary,
    });
    const destinationNode = audioContext.createMediaStreamDestination();

    sourceNode.connect(rnnoiseNode);
    rnnoiseNode.connect(destinationNode);

    this.audioContext = audioContext;
    this.sourceNode = sourceNode;
    this.rnnoiseNode = rnnoiseNode;
    this.destinationNode = destinationNode;
    this.processedTrack = destinationNode.stream.getAudioTracks()[0];
  }

  private teardown(): void {
    this.sourceNode?.disconnect();
    this.rnnoiseNode?.disconnect();
    // Releases the wasm-backed worklet processor's resources.
    this.rnnoiseNode?.destroy();
    this.destinationNode?.disconnect();
    this.destinationNode?.stream.getTracks().forEach((t) => t.stop());

    this.sourceNode = undefined;
    this.rnnoiseNode = undefined;
    this.destinationNode = undefined;
    this.processedTrack = undefined;
    // Deliberately not clearing `this.audioContext` / `this.moduleLoaded` here:
    // the AudioContext is owned by livekit-client (not us), stays alive across
    // restarts, and the worklet module remains registered on it once added.
  }
}
