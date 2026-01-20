---
name: appshot
description: Create and manage App Store screenshot projects using appshot MCP tools. This skill should be used when users want to generate professional App Store screenshots with device frames, gradients, and captions. Triggers include requests to create screenshot projects, add captions, apply styling, or build final screenshots.
---

# AppShot Screenshot Generator

## Overview

AppShot generates App Store-ready screenshots with device frames, gradient backgrounds, and captions. This skill orchestrates the appshot MCP tools to create complete screenshot projects.

## Available MCP Tools

| Tool | Purpose |
|------|---------|
| `appshot.init` | Initialize new project structure |
| `appshot.captions` | Read/write/auto-generate caption text |
| `appshot.gradients` | List/apply gradient presets |
| `appshot.backgrounds` | Configure background images |
| `appshot.fonts` | List/validate available fonts |
| `appshot.config` | Modify device-specific settings |
| `appshot.build` | Generate final screenshots |
| `appshot.validate` | Check App Store compliance |
| `appshot.specs` | View App Store specifications |
| `appshot.doctor` | System diagnostics |
| `appshot.presets` | App Store preset configurations |
| `appshot.localize` | AI-powered caption translation |
| `appshot.languages` | Discover available translations |
| `appshot.frame` | Apply device frames only |
| `appshot.export` | Export for Fastlane |
| `appshot.clean` | Remove generated files |

## Project Workflow

### 1. Initialize Project

```
appshot.init with force: true
```

Creates the project structure:
```
.appshot/
├── config.json          # Main configuration
└── captions/
    ├── iphone.json      # Caption files per device
    ├── ipad.json
    ├── mac.json
    └── watch.json
screenshots/
├── iphone/              # Place screenshots here
├── ipad/
├── mac/
└── watch/
final/                   # Generated output
```

### 2. Add Captions

List existing captions:
```
appshot.captions with device: "iphone", action: "list"
```

Set a caption:
```
appshot.captions with device: "iphone", action: "set", filename: "home.png", caption: "Welcome Home", language: "en"
```

Auto-generate captions from filenames:
```
appshot.captions with device: "iphone", action: "auto"
```
This converts filenames like `home-screen.png` → "Home Screen"

Bulk set multiple captions:
```
appshot.captions with device: "iphone", action: "bulk-set", captions: "{\"home.png\": \"Welcome\", \"settings.png\": \"Settings\"}"
```

Add translations:
```
appshot.captions with device: "iphone", action: "set", filename: "home.png", caption: "Bienvenido", language: "es"
```

### 3. Apply Styling

List gradient presets:
```
appshot.gradients with action: "list"
```

Apply a gradient:
```
appshot.gradients with action: "apply", preset: "ocean"
```

Set background image:
```
appshot.backgrounds with action: "set", image: "./bg.jpg", fit: "cover"
```

Configure device settings:
```
appshot.config with device: "iphone", frameScale: 0.85, captionPosition: "above"
```

### 4. Build Screenshots

Build all devices and languages:
```
appshot.build
```

Build specific devices:
```
appshot.build with devices: ["iphone", "ipad"]
```

Build with App Store presets:
```
appshot.build with presets: ["iphone-6-9", "ipad-13"]
```

### 5. Frame Only (No Background)

Apply device frames without gradients or captions:
```
appshot.frame with input: "./screenshots/iphone"
```

Frame with output directory:
```
appshot.frame with input: "./screenshots/iphone", outputDir: "./framed"
```

Frame recursively:
```
appshot.frame with input: "./screenshots", recursive: true
```

Preview what would be framed:
```
appshot.frame with input: "./screenshots/iphone", dryRun: true
```

### 6. Validate

Check App Store compliance:
```
appshot.validate
```

## Common Scenarios

### New iPhone-Only Project

1. `appshot.init` with `force: true`
2. User adds screenshots to `screenshots/iphone/`
3. `appshot.captions` - set captions for each screenshot
4. `appshot.gradients` - apply preferred gradient
5. `appshot.build` with `devices: ["iphone"]`

### Multi-Language App Store Submission

1. `appshot.init` with `force: true`
2. `appshot.captions` - add English captions
3. `appshot.localize` with `languages: ["es", "fr", "de", "ja"]`
4. `appshot.build` with `languages: ["en", "es", "fr", "de", "ja"]`
5. `appshot.validate`

### Quick Styling Update

1. `appshot.gradients` with `action: "list"` to see options
2. `appshot.gradients` with `action: "apply", preset: "sunset"`
3. `appshot.build`

### Quick Auto-Caption Project

When filenames are descriptive (e.g., `home-screen.png`, `settings_page.png`):

1. `appshot.init` with `force: true`
2. User adds screenshots to `screenshots/iphone/`
3. `appshot.captions` with `device: "iphone", action: "auto"`
4. `appshot.gradients` with `action: "apply", preset: "ocean"`
5. `appshot.build` with `devices: ["iphone"]`

Captions are auto-generated from filenames (hyphens/underscores become spaces, title case applied).

### Frame Only (Design Mockups)

For quick device mockups without backgrounds or captions:

1. `appshot.frame` with `input: "./screenshots/iphone", outputDir: "./framed"`

Output has transparent background - perfect for presentations, design comps, or overlaying on custom backgrounds.

## Device Resolutions

### Required for App Store
- **iPhone 6.9"**: 1290x2796 or 1320x2868
- **iPad 13"**: 2064x2752 or 2048x2732

### Optional
- **Mac**: 2880x1800 (16:10)
- **Watch Ultra**: 410x502

## Configuration Options

### Frame Positioning
- `frameScale`: 0.1-1.5 (default: 0.9)
- `framePosition`: 0-100 or "center"
- `captionPosition`: "above", "below", "overlay"

### Caption Styling
- `captionSize`: Font size in pixels
- `marginTop`: Top margin for caption
- `marginBottom`: Bottom margin for caption

## Resources

- `references/templates.md` - All 8 templates with styles, colors, and recommendations
- `references/gradients.md` - All 24 gradient presets with colors
- `references/fonts.md` - All 10 embedded font families
- `references/troubleshooting.md` - Common errors and solutions
