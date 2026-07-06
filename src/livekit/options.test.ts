/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, test } from "vitest";

import {
  screenShareCaptureResolution,
  screenSharePublishOptions,
} from "./options";
import {
  type ScreenShareFps,
  type ScreenShareQuality,
} from "../settings/settings";

const QUALITIES: ScreenShareQuality[] = ["480", "720", "1080", "2160"];
const FPSES: ScreenShareFps[] = [15, 30, 60];

const expectedResolutions: Record<
  ScreenShareQuality,
  { width: number; height: number }
> = {
  "480": { width: 854, height: 480 },
  "720": { width: 1280, height: 720 },
  "1080": { width: 1920, height: 1080 },
  "2160": { width: 3840, height: 2160 },
};

describe("screenShareCaptureResolution", () => {
  for (const quality of QUALITIES) {
    for (const fps of FPSES) {
      test(`returns the expected capture constraints for ${quality}p@${fps}`, () => {
        const result = screenShareCaptureResolution(quality, fps);
        expect(result).toEqual({
          ...expectedResolutions[quality],
          frameRate: fps,
        });
      });
    }
  }
});

describe("screenSharePublishOptions", () => {
  test("matches the existing 4K60 default encoding", () => {
    const options = screenSharePublishOptions("2160", 60);
    expect(options.screenShareEncoding).toMatchObject({
      maxBitrate: 25_000_000,
      maxFramerate: 60,
    });
  });

  test("simulcast low layer is always strictly lower resolution than the main layer", () => {
    for (const quality of QUALITIES) {
      for (const fps of FPSES) {
        const options = screenSharePublishOptions(quality, fps);
        const mainResolution = expectedResolutions[quality];
        const lowLayers = options.screenShareSimulcastLayers ?? [];
        expect(lowLayers.length).toBeGreaterThan(0);
        for (const layer of lowLayers) {
          expect(layer.width).toBeLessThan(mainResolution.width);
          expect(layer.height).toBeLessThan(mainResolution.height);
        }
      }
    }
  });

  test("bitrate is monotonically non-decreasing with fps for a fixed quality", () => {
    for (const quality of QUALITIES) {
      let previousBitrate = 0;
      for (const fps of FPSES) {
        const options = screenSharePublishOptions(quality, fps);
        const bitrate = options.screenShareEncoding?.maxBitrate ?? 0;
        expect(bitrate).toBeGreaterThan(previousBitrate);
        previousBitrate = bitrate;
      }
    }
  });

  test("bitrate is monotonically non-decreasing with quality for a fixed fps", () => {
    for (const fps of FPSES) {
      let previousBitrate = 0;
      for (const quality of QUALITIES) {
        const options = screenSharePublishOptions(quality, fps);
        const bitrate = options.screenShareEncoding?.maxBitrate ?? 0;
        expect(bitrate).toBeGreaterThan(previousBitrate);
        previousBitrate = bitrate;
      }
    }
  });
});
