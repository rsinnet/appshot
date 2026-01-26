# Layout System v2 (Draft Spec)

This document defines the v2 layout system rules. v2 is a clean break from v1: overlay mode is removed, and layout is fixed by device strategy constants.

## Goals
- Predictable layouts with minimal configuration.
- Deterministic sizing rules tied to device screenshots.
- Clear separation between layout (fixed) and appearance (customizable).

## Layout Modes
- `header`: caption region on top, device region below.
- `footer`: device region on top, caption region below.
- `screenshot-only`: device region only; no caption.

## Terminology
- **Canvas**: final output image.
- **Usable area**: canvas minus edge padding on all sides.
- **Caption region**: fixed percentage of **canvas height** (header/footer only).
- **Device region**: remaining canvas height after caption region.

## Region Sizing Rules (Header/Footer)
1. Compute caption height:
   - `captionHeight = max(minCaptionPx, round(canvasHeight * captionRatio))`
2. Compute device height:
   - `deviceHeight = canvasHeight - captionHeight`
3. Rounding: use `Math.round` for `captionHeight`. Any leftover pixel goes to the device region.

## Region Sizing (Screenshot-only)
- `deviceHeight = usableHeight`
- No caption region.

## Edge Padding
- Edge padding always applies horizontally.
- Vertical padding applies in screenshot-only mode (device uses the usable area).

## Caption Layout
- Text is horizontally and vertically centered within the caption region.
- Caption region has internal padding equal to **10% of the caption height** on all sides.
- Text wraps to a maximum number of lines (per device strategy).
- If text exceeds max lines, the final line truncates with an ellipsis (`...`).
- Truncation occurs at word boundary when possible; mid-word truncation allowed if a single word exceeds the available width.
- When truncation occurs, log a CLI warning.

## Device Placement
- The device frame is centered in the device region.
- The device frame scales to **fit the device region** while preserving aspect ratio.
- If a fixed device scale would overflow the region, **scale-to-fit wins**.

## Deterministic Font Size
Font size is computed from the device screenshot size, not the canvas size.

Rule:
```
fontSize = clamp(round(screenRect.height * fontScale), minFontSize, maxFontSize)
```

Initial scales (subject to tuning):
Final scales:
- watch: scale 0.045, min 18, max 28
- iphone: scale 0.042, min 34, max 72
- ipad: scale 0.038, min 40, max 88
- mac: scale 0.040, min 48, max 96

## Orientation
- Orientation is chosen by matching screenshot aspect ratio to the frame `screenRect` aspect ratio.
- iPhone and iPad support both portrait and landscape frames (with a few portrait-only models).
- Mac and Watch are single-orientation only.

## Removed in v2
- Overlay layout.
- Per-device layout overrides (framePosition, frameScale, captionPosition, captionSize, captionBox, etc.).
- Content-driven caption region sizing.

## Compatibility
- v2 configs require `version: 2`.
- v1 configs remain supported in v2.x with a deprecation banner.
- v1 support is removed in v3.0.

## CLI Messaging (Deprecation + Help)
### Deprecation Banner (v1 config detected)
```
╔══════════════════════════════════════════════════════════════╗
║ ⚠️  Deprecated config format detected                         ║
║                                                              ║
║ Your .appshot/config.json uses v1 layout settings. v1 is      ║
║ deprecated in 2.x and will be removed in 3.0.                 ║
║                                                              ║
║ Run: appshot migrate                                          ║
║                                                              ║
║ This will convert your config to the new v2 layout format.    ║
╚══════════════════════════════════════════════════════════════╝
```

Show on:
- `appshot build`
- `appshot style`
- `appshot caption`

### `--help` updates
- Mention v2 layout modes: header, footer, screenshot-only.
- Note that overlay is removed in v2.
- Note v1 deprecation + migration command.

### `--doctor` updates
- Detect v1 configs and recommend `appshot migrate`.
- Confirm v2 config version when present.
