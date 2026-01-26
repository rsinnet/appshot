import type { DeviceStrategyV2 } from '../../types.js';

export const iphoneStrategyV2: DeviceStrategyV2 = {
  deviceType: 'iphone',
  captionRatio: 0.2,
  minCaptionPx: 200,
  edgePadding: 40,
  regionGap: 40,
  captionMaxLines: 3,
  captionLineHeight: 1.4,
  fontScale: 0.055,
  fontMin: 40,
  fontMax: 86
};
