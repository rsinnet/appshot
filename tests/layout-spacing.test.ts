import { describe, it, expect } from 'vitest';
import { applyTemplateToConfig, templates } from '../src/templates/registry.js';
import type { AppshotConfig, CaptionConfig, DeviceConfig } from '../src/types.js';
import { resolveLayoutSpacing, SAFETY_INSET } from '../src/core/layout-utils.js';

function buildBaseConfig(): Partial<AppshotConfig> {
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
    iphone: {
      input: 'screens/iphone.png',
      resolution: '1290x2796'
    },
    ipad: {
      input: 'screens/ipad.png',
      resolution: '2048x2732'
    },
    mac: {
      input: 'screens/mac.png',
      resolution: '2880x1800'
    },
    watch: {
      input: 'screens/watch.png',
      resolution: '1980x2426'
    }
  };

  return {
    caption,
    devices
  };
}

describe('Template spacing defaults', () => {
  it('enforces safety insets for every template/device combination', () => {
    for (const template of templates) {
      const baseConfig = buildBaseConfig();
      const merged = applyTemplateToConfig(template.id, baseConfig);
      const caption = merged.caption;
      expect(caption).toBeDefined();
      if (!caption || !merged.devices) continue;

      for (const [deviceName, deviceConfig] of Object.entries(merged.devices)) {
        const spacing = resolveLayoutSpacing(caption, deviceConfig as DeviceConfig);
        expect(spacing.bottomInset).toBeGreaterThanOrEqual(SAFETY_INSET);
        expect(spacing.overlayBottomSpacing).toBeGreaterThanOrEqual(SAFETY_INSET);
        expect(spacing.captionTopInsetAbove).toBeGreaterThanOrEqual(SAFETY_INSET);

        if (deviceName !== 'watch') {
          expect(spacing.deviceTopInsetBelow).toBeGreaterThanOrEqual(SAFETY_INSET);
        }
      }
    }
  });
});
