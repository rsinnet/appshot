import type { DeviceStrategyV2 } from '../../types.js';

export const androidStrategyV2: DeviceStrategyV2 = {
  deviceType: 'android',
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
