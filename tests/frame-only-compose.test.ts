import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { composeFrameOnly } from '../src/core/compose.js';

describe('composeFrameOnly', () => {
  it('should place screenshot onto transparent frame canvas at screenRect', async () => {
    const frameWidth = 40;
    const frameHeight = 60;
    const screenRect = { x: 10, y: 15, width: 16, height: 24 };

    // Create a simple opaque red screenshot exactly the size of screenRect
    const screenshot = await sharp({
      create: {
        width: screenRect.width,
        height: screenRect.height,
        channels: 4,
        background: { r: 200, g: 0, b: 0, alpha: 1 }
      }
    }).png().toBuffer();

    // Create a fully transparent frame overlay (no visual frame)
    const frame = await sharp({
      create: {
        width: frameWidth,
        height: frameHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    }).png().toBuffer();

    const buffer = await composeFrameOnly({
      screenshot,
      frame,
      frameMetadata: {
        frameWidth,
        frameHeight,
        screenRect,
        deviceType: 'mac' // avoid iPhone rounded-corner heuristic
      },
      outputFormat: 'png'
    });

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(frameWidth);
    expect(meta.height).toBe(frameHeight);
    expect(meta.hasAlpha).toBe(true);

    // Probe a pixel inside the screenRect (should be opaque/red)
    const insideX = screenRect.x + Math.floor(screenRect.width / 2);
    const insideY = screenRect.y + Math.floor(screenRect.height / 2);

    const outsideX = 2;
    const outsideY = 2;

    const raw = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const stride = meta.width! * 4;

    const idxInside = insideY * stride + insideX * 4;
    const alphaInside = raw.data[idxInside + 3];
    expect(alphaInside).toBeGreaterThan(0);

    const idxOutside = outsideY * stride + outsideX * 4;
    const alphaOutside = raw.data[idxOutside + 3];
    expect(alphaOutside).toBe(0);
  });

  it('supports neutral frame tone by desaturating the frame', async () => {
    const frameWidth = 20;
    const frameHeight = 20;
    const screenRect = { x: 5, y: 5, width: 10, height: 10 };

    const screenshot = await sharp({
      create: {
        width: screenRect.width,
        height: screenRect.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      }
    }).png().toBuffer();

    const coloredFrame = await sharp({
      create: {
        width: frameWidth,
        height: frameHeight,
        channels: 4,
        background: { r: 250, g: 100, b: 180, alpha: 1 }
      }
    }).png().toBuffer();

    const neutral = await composeFrameOnly({
      screenshot,
      frame: coloredFrame,
      frameMetadata: {
        frameWidth,
        frameHeight,
        screenRect,
        deviceType: 'mac'
      },
      outputFormat: 'png',
      frameTone: 'neutral'
    });

    const original = await composeFrameOnly({
      screenshot,
      frame: coloredFrame,
      frameMetadata: {
        frameWidth,
        frameHeight,
        screenRect,
        deviceType: 'mac'
      },
      outputFormat: 'png',
      frameTone: 'original'
    });

    const neutralPixel = await sharp(neutral).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const originalPixel = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    const idx = 0; // top-left pixel (outside screenRect)
    const nR = neutralPixel.data[idx];
    const nG = neutralPixel.data[idx + 1];
    const nB = neutralPixel.data[idx + 2];

    const oR = originalPixel.data[idx];
    const oG = originalPixel.data[idx + 1];
    const oB = originalPixel.data[idx + 2];

    expect(Math.abs(nR - nG)).toBeLessThan(3);
    expect(Math.abs(nR - nB)).toBeLessThan(3);
    // Original frame should remain colorful (channel variance)
    expect(Math.abs(oR - oG)).toBeGreaterThan(5);
    expect(Math.abs(oR - oB)).toBeGreaterThan(5);
  });
});
