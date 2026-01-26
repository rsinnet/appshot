import type { DeviceStrategyV2 } from '../../types.js';

export const macStrategyV2: DeviceStrategyV2 = {
  deviceType: 'mac',
  captionRatio: 0.15,
  minCaptionPx: 150,
  edgePadding: 60,
  regionGap: 56,
  captionMaxLines: 2,
  captionLineHeight: 1.35,
  fontScale: 0.04,
  fontMin: 48,
  fontMax: 96
};
