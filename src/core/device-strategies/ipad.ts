import type { DeviceStrategyV2 } from '../../types.js';

export const ipadStrategyV2: DeviceStrategyV2 = {
  deviceType: 'ipad',
  captionRatio: 0.18,
  minCaptionPx: 180,
  edgePadding: 48,
  regionGap: 48,
  captionMaxLines: 3,
  captionLineHeight: 1.4,
  fontScale: 0.038,
  fontMin: 40,
  fontMax: 88
};
