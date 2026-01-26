import type { DeviceStrategyV2 } from '../../types.js';

export const watchStrategyV2: DeviceStrategyV2 = {
  deviceType: 'watch',
  captionRatio: 0.25,
  minCaptionPx: 100,
  edgePadding: 20,
  regionGap: 28,
  captionMaxLines: 2,
  captionLineHeight: 1.3,
  fontScale: 0.045,
  fontMin: 18,
  fontMax: 28
};
