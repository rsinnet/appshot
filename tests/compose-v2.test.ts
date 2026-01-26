import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { composeV2 } from '../src/core/compose.js';

async function createScreenshot(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 120, g: 140, b: 160, alpha: 1 }
    }
  }).png().toBuffer();
}

describe('composeV2', () => {
  it('renders header/footer/screenshot-only layouts', async () => {
    const screenshot = await createScreenshot(200, 400);
    const layouts = ['header', 'footer', 'screenshot-only'] as const;

    for (const layout of layouts) {
      const buffer = await composeV2({
        screenshot,
        outputWidth: 800,
        outputHeight: 1600,
        layout,
        deviceType: 'iphone',
        caption: layout === 'screenshot-only' ? undefined : 'Test caption',
        captionConfig: { font: 'SF Pro Display', color: '#FFFFFF' }
      });

      const meta = await sharp(buffer).metadata();
      expect(meta.width).toBe(800);
      expect(meta.height).toBe(1600);
    }
  });
});
