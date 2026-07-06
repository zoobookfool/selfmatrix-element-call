/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { createContext, type FC, type JSX, use, useMemo } from "react";
import {
  type AudioProcessorOptions,
  type LocalAudioTrack,
  type Track,
  type TrackProcessor,
} from "livekit-client";
import { combineLatest, map, type Observable } from "rxjs";
import { useObservable } from "observable-hooks";

import {
  noiseSuppressionMl as noiseSuppressionMlSetting,
  useSetting,
} from "../settings/settings";
import { NoiseSuppressionProcessor } from "./NoiseSuppressionProcessor";
import { type Behavior } from "../state/Behavior";
import { type ObservableScope } from "../state/ObservableScope";

// Sibling to TrackProcessorContext.tsx, which holds the analogous state for
// the video pipeline (background blur). Kept as a separate context rather
// than folding into `ProcessorState` because the video processor has many
// more consumers (LobbyView, InCallView, Publisher, ConnectionFactory) than
// the audio one currently needs (only ConnectionFactory, for the initial
// room connection's `audioCaptureDefaults.processor`).

export type AudioProcessorState = {
  supported: boolean | undefined;
  processor:
    | undefined
    | TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>;
};

const AudioProcessorContext = createContext<AudioProcessorState | undefined>(
  undefined,
);

export function useAudioTrackProcessor(): AudioProcessorState {
  const state = use(AudioProcessorContext);
  if (state === undefined)
    throw new Error(
      "useAudioTrackProcessor must be used within an AudioProcessorProvider",
    );
  return state;
}

export function useAudioTrackProcessorObservable$(): Observable<AudioProcessorState> {
  const state = use(AudioProcessorContext);
  if (state === undefined)
    throw new Error(
      "useAudioTrackProcessor must be used within an AudioProcessorProvider",
    );
  const state$ = useObservable(
    (init$) => init$.pipe(map(([init]) => init)),
    [state],
  );

  return state$;
}

/**
 * Updates your audio track to always use the given processor.
 * Mirrors {@link ../livekit/TrackProcessorContext.tsx#trackProcessorSync} for video.
 */
export const audioTrackProcessorSync = (
  scope: ObservableScope,
  audioTrack$: Behavior<LocalAudioTrack | null>,
  processor$: Behavior<AudioProcessorState>,
): void => {
  combineLatest([audioTrack$, processor$])
    .pipe(scope.bind())
    .subscribe(([audioTrack, processorState]) => {
      if (!processorState) return;
      if (!audioTrack) return;
      const { processor } = processorState;
      if (processor && !audioTrack.getProcessor()) {
        void audioTrack.setProcessor(processor);
      }
      if (!processor && audioTrack.getProcessor()) {
        void audioTrack.stopProcessor();
      }
    });
};

/**
 * Whether this browser supports the AudioWorklet-based ML noise suppression
 * processor (RNNoise). AudioWorklet is required; there is no fallback path.
 */
export function supportsMlNoiseSuppression(): boolean {
  return typeof AudioWorklet !== "undefined";
}

interface Props {
  children: JSX.Element;
}

export const AudioProcessorProvider: FC<Props> = ({ children }) => {
  // The setting the user wants to have
  const [noiseSuppressionActivated] = useSetting(noiseSuppressionMlSetting);
  const supported = useMemo(() => supportsMlNoiseSuppression(), []);
  const processor = useMemo(() => new NoiseSuppressionProcessor(), []);

  // This is the actual state exposed through the context
  const processorState = useMemo(
    () => ({
      supported,
      processor:
        supported && noiseSuppressionActivated ? processor : undefined,
    }),
    [supported, noiseSuppressionActivated, processor],
  );

  return (
    <AudioProcessorContext value={processorState}>
      {children}
    </AudioProcessorContext>
  );
};
