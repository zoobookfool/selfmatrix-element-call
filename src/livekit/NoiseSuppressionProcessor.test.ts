/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { Track, type AudioProcessorOptions } from "livekit-client";

import { NoiseSuppressionProcessor } from "./NoiseSuppressionProcessor";

// jsdom does not implement AudioWorklet/AudioContext, which matches the
// real-world "unsupported browser" fallback path we need to exercise here.
// The full happy-path graph (addModule + wasm load + AudioWorkletNode) can
// only be meaningfully tested in a real browser, so we only assert the
// fallback contract: init() must never throw, and must leave the processor
// in a clearly "not active" (pass-through) state.
describe("NoiseSuppressionProcessor", () => {
  it("falls back to pass-through when AudioWorklet is unsupported, without throwing", async () => {
    // jsdom doesn't implement AudioContext at all (a stub AudioWorkletNode is
    // registered globally in vitest.setup.ts just so importing the
    // `@sapphi-red/web-noise-suppressor` package doesn't crash at module load
    // time). What's actually absent -- matching real unsupported browsers --
    // is `AudioContext.audioWorklet`, which our fake `audioContext: {}` below
    // doesn't have either.

    const processor = new NoiseSuppressionProcessor();
    const fakeTrack = { id: "fake-audio-track" } as unknown as MediaStreamTrack;
    const opts: AudioProcessorOptions = {
      kind: Track.Kind.Audio,
      track: fakeTrack,
      audioContext: {} as AudioContext,
    };

    await expect(processor.init(opts)).resolves.toBeUndefined();

    expect(processor.failed).toBe(true);
    expect(processor.processedTrack).toBeUndefined();
  });

  it("does not throw when destroy() is called without a prior successful init()", async () => {
    const processor = new NoiseSuppressionProcessor();
    await expect(processor.destroy()).resolves.toBeUndefined();
  });

  it("marks failed and does not throw on restart() when no AudioContext is available", async () => {
    const processor = new NoiseSuppressionProcessor();
    const fakeTrack = { id: "fake-audio-track" } as unknown as MediaStreamTrack;

    await expect(
      processor.restart({
        kind: Track.Kind.Audio,
        track: fakeTrack,
      } as AudioProcessorOptions),
    ).resolves.toBeUndefined();

    expect(processor.failed).toBe(true);
    expect(processor.processedTrack).toBeUndefined();
  });

  it("fails gracefully (not a throw) when the worklet module fails to load", async () => {
    const processor = new NoiseSuppressionProcessor();
    const fakeTrack = { id: "fake-audio-track" } as unknown as MediaStreamTrack;
    // Swap in a fake AudioContext whose audioWorklet.addModule rejects, to
    // exercise the try/catch around setup() deterministically regardless of
    // AudioWorkletNode global availability.
    const fakeAudioContext = {
      state: "running",
      audioWorklet: {
        addModule: vi.fn().mockRejectedValue(new Error("module load failed")),
      },
    } as unknown as AudioContext;

    // Force AudioWorkletNode to appear supported so we reach the addModule call.
    const originalAudioWorkletNode = (
      globalThis as { AudioWorkletNode?: unknown }
    ).AudioWorkletNode;
    (globalThis as { AudioWorkletNode?: unknown }).AudioWorkletNode =
      class {} as unknown;

    try {
      await expect(
        processor.init({
          kind: Track.Kind.Audio,
          track: fakeTrack,
          audioContext: fakeAudioContext,
        }),
      ).resolves.toBeUndefined();
    } finally {
      (globalThis as { AudioWorkletNode?: unknown }).AudioWorkletNode =
        originalAudioWorkletNode;
    }

    expect(processor.failed).toBe(true);
    expect(processor.processedTrack).toBeUndefined();
  });
});
