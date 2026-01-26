import { describe, it, expect } from 'vitest';
import type { CaptionConfig, DeviceConfig } from '../src/types.js';
import { resolveLayoutSpacing, SAFETY_INSET } from '../src/core/layout-utils.js';

describe('Layout spacing defaults (v1)', () => {
  it('enforces safety insets for a baseline config', () => {
    const caption: CaptionConfig = {
      font: 'SF Pro Display',
      fontsize: 60,
      color: '#FFFFFF',
      align: 'center',
      paddingTop: 100,
      paddingBottom: 60,
      position: 'above'
    };

    const devices: Record<string, DeviceConfig> = {
      iphone: { input: 'screens/iphone.png', resolution: '1290x2796' },
      ipad: { input: 'screens/ipad.png', resolution: '2048x2732' },
      mac: { input: 'screens/mac.png', resolution: '2880x1800' },
      watch: { input: 'screens/watch.png', resolution: '1980x2426' }
    };

    for (const [deviceName, deviceConfig] of Object.entries(devices)) {
      const spacing = resolveLayoutSpacing(caption, deviceConfig);
      expect(spacing.bottomInset).toBeGreaterThanOrEqual(SAFETY_INSET);
      expect(spacing.overlayBottomSpacing).toBeGreaterThanOrEqual(SAFETY_INSET);
      expect(spacing.captionTopInsetAbove).toBeGreaterThanOrEqual(SAFETY_INSET);

      if (deviceName !== 'watch') {
        expect(spacing.deviceTopInsetBelow).toBeGreaterThanOrEqual(SAFETY_INSET);
      }
    }
  });
});
