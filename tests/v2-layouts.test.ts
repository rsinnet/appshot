import { describe, it, expect } from 'vitest';
import { computeRegions, computeFontSize } from '../src/core/layouts/math.js';
import { fitBoxToRegion } from '../src/core/layouts/device-fit.js';
import { layoutCaptionText } from '../src/core/layouts/text-layout.js';
import type { DeviceStrategyV2 } from '../src/types.js';

const strategy: DeviceStrategyV2 = {
  deviceType: 'iphone',
  captionRatio: 0.2,
  minCaptionPx: 200,
  edgePadding: 40,
  regionGap: 40,
  captionMaxLines: 2,
  captionLineHeight: 1.4,
  fontScale: 0.04,
  fontMin: 40,
  fontMax: 88
};

describe('v2 layout math', () => {
  it('computes header regions from usable height', () => {
    const regions = computeRegions({
      canvasWidth: 1000,
      canvasHeight: 2000,
      layout: 'header',
      strategy
    });

    expect(regions.usable.width).toBe(920);
    expect(regions.usable.height).toBe(1920);
    expect(regions.caption?.height).toBe(384);
    expect(regions.caption?.y).toBe(40);
    expect(regions.device.height).toBe(1496);
    expect(regions.device.y).toBe(464);
  });

  it('computes footer regions from usable height', () => {
    const regions = computeRegions({
      canvasWidth: 1000,
      canvasHeight: 2000,
      layout: 'footer',
      strategy
    });

    expect(regions.caption?.height).toBe(384);
    expect(regions.device.height).toBe(1496);
    expect(regions.caption?.y).toBe(1576);
  });

  it('uses full usable area for screenshot-only', () => {
    const regions = computeRegions({
      canvasWidth: 1000,
      canvasHeight: 2000,
      layout: 'screenshot-only',
      strategy
    });

    expect(regions.caption).toBeUndefined();
    expect(regions.device.width).toBe(920);
    expect(regions.device.height).toBe(1920);
  });

  it('clamps font size to min/max', () => {
    expect(computeFontSize(500, strategy)).toBe(40);
    expect(computeFontSize(2000, strategy)).toBe(80);
    expect(computeFontSize(4000, strategy)).toBe(88);
  });
});

describe('v2 device fit', () => {
  it('centers a frame inside a region', () => {
    const region = { x: 0, y: 0, width: 200, height: 200 };
    const fit = fitBoxToRegion(100, 200, region);

    expect(fit.width).toBe(100);
    expect(fit.height).toBe(200);
    expect(fit.x).toBe(50);
    expect(fit.y).toBe(0);
    expect(fit.scale).toBe(1);
  });
});

describe('v2 text layout', () => {
  it('wraps and truncates to max lines', () => {
    const region = { x: 0, y: 0, width: 300, height: 120 };
    const result = layoutCaptionText(
      'One two three four five six seven eight nine ten',
      region,
      32,
      strategy
    );

    expect(result.lines.length).toBeLessThanOrEqual(2);
    expect(result.truncated).toBe(true);
  });
});
