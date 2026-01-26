# Appshot v2 Migration Guide

This guide covers moving from the v1 layout/config format to the v2 fixed-layout system.

## Why v2?

v2 replaces the flexible (but complex) v1 layout rules with three deterministic layouts:
- `header` (caption top, device bottom)
- `footer` (device top, caption bottom)
- `screenshot-only` (device only)

Layout proportions are fixed per device type and no longer user-adjustable. Styling (fonts, colors, backgrounds) remains customizable.

## Quick Migration

Use the built-in command:

```bash
appshot migrate
```

This will:
- Detect your v1 config
- Convert to v2 defaults
- Warn about options that cannot be migrated
- Save a backup to `.appshot/config.v1.json`

## v1 → v2 Field Mapping

The migration tool maps the most important fields:

- `caption.position` → `layout`
  - `above` → `header`
  - `below` → `footer`
  - `overlay` → `header` (overlay is removed in v2)
- `caption.font` → `caption.font`
- `caption.color` → `caption.color`
- `background.*` → `background.*`
- `devices.*.input` → `devices.*`

## Options Removed in v2

The following v1 options are **not supported** in v2:

- `caption.position: "overlay"`
- `caption.fontsize`
- `caption.box.*`
- `caption.paddingTop` / `caption.paddingBottom`
- `devices.*.framePosition`
- `devices.*.frameScale`
- `devices.*.partialFrame`
- `devices.*.frameOffset`
- `devices.*.captionPosition`
- `devices.*.captionSize`
- `devices.*.captionBox`

These are replaced by fixed per-device strategies in v2.

## Example Configs

### v1 (Legacy)

```json
{
  "caption": {
    "position": "above",
    "font": "SF Pro Display",
    "fontsize": 64,
    "color": "#FFFFFF",
    "box": {
      "autoSize": true,
      "marginTop": 0,
      "marginBottom": 48
    }
  },
  "background": {
    "gradient": ["#667eea", "#764ba2"]
  },
  "devices": {
    "iphone": {
      "input": "./screenshots/iphone",
      "frameScale": 0.9,
      "framePosition": 50
    }
  }
}
```

### v2 (Current)

```json
{
  "version": 2,
  "layout": "header",
  "caption": {
    "font": "SF Pro Display",
    "color": "#FFFFFF"
  },
  "background": {
    "gradient": ["#667eea", "#764ba2"]
  },
  "devices": {
    "iphone": "./screenshots/iphone"
  }
}
```

## Troubleshooting

- If your captions feel too large or small, check your output resolution. v2 scales text by screenshot size.
- If you need a different layout, switch `layout` between `header`, `footer`, and `screenshot-only`.
- If you relied on overlay layouts, the closest v2 alternative is `header`.

## Next Steps

- Review `docs/layout-v2.md` for the exact sizing rules.
- Run `appshot build --dry-run --verbose` to inspect layout calculations.
