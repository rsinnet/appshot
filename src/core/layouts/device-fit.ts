import type { LayoutBox } from './math.js';

export interface DeviceFitResult {
  width: number;
  height: number;
  x: number;
  y: number;
  scale: number;
}

export function fitBoxToRegion(
  frameWidth: number,
  frameHeight: number,
  region: LayoutBox
): DeviceFitResult {
  if (frameWidth <= 0 || frameHeight <= 0 || region.width <= 0 || region.height <= 0) {
    return {
      width: 0,
      height: 0,
      x: region.x,
      y: region.y,
      scale: 0
    };
  }

  const scale = Math.min(region.width / frameWidth, region.height / frameHeight);
  const width = Math.round(frameWidth * scale);
  const height = Math.round(frameHeight * scale);
  const x = Math.round(region.x + (region.width - width) / 2);
  const y = Math.round(region.y + (region.height - height) / 2);

  return { width, height, x, y, scale };
}
