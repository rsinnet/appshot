import type { CaptionConfig, DeviceConfig } from '../types.js';

export const SAFETY_INSET = 40;
const DEFAULT_GAP_ABOVE = 48;
const DEFAULT_GAP_BELOW = 36;

export interface LayoutSpacing {
  captionTopInsetAbove: number;
  deviceTopInsetBelow: number;
  bottomInset: number;
  gapAbove: number;
  gapBelow: number;
  overlayBottomSpacing: number;
}

export function resolveLayoutSpacing(
  captionConfig: CaptionConfig,
  deviceConfig: DeviceConfig
): LayoutSpacing {
  const captionBox = {
    ...(captionConfig.box || {}),
    ...(deviceConfig.captionBox || {})
  };
  const marginTop = captionBox.marginTop;
  const marginBottom = captionBox.marginBottom;
  const borderWidth = (deviceConfig.captionBorder || captionConfig.border)?.width || 0;
  const overlayFallback = captionConfig.paddingBottom ?? 60;

  const minGap = Math.max(Math.round(borderWidth / 2), 12);
  const gapAbove = captionBox.marginBottom !== undefined
    ? Math.max(minGap, captionBox.marginBottom)
    : Math.max(DEFAULT_GAP_ABOVE, minGap);
  const fallbackBelowGap = Math.max(DEFAULT_GAP_BELOW, Math.round(borderWidth / 2), 12);
  const gapBelow = marginTop !== undefined ? marginTop : fallbackBelowGap;

  return {
    captionTopInsetAbove: SAFETY_INSET + (marginTop ?? 0),
    deviceTopInsetBelow: SAFETY_INSET,
    bottomInset: SAFETY_INSET + (marginBottom ?? 0),
    gapAbove,
    gapBelow,
    overlayBottomSpacing: SAFETY_INSET + (marginBottom ?? overlayFallback)
  };
}
