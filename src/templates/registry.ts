/**
 * Template Registry for App Store Screenshots
 *
 * Each template includes a complete visual style preset with:
 * - Background (gradient or image configuration)
 * - Device positioning and scale
 * - Caption placement and styling
 * - Device-specific optimizations
 */

import type {
  CaptionConfig,
  CaptionBoxConfig,
  CaptionBackgroundConfig,
  CaptionBorderConfig,
  BackgroundConfig,
  AppshotConfig
} from '../types.js';

export interface TemplateDeviceOverride {
  frameScale?: number;
  framePosition?: 'top' | 'center' | 'bottom' | number;
  partialFrame?: boolean;
  frameOffset?: number;
  captionPosition?: 'above' | 'below' | 'overlay';
  captionSize?: number;
  captionBox?: CaptionBoxConfig;
  captionBackground?: CaptionBackgroundConfig;
  captionBorder?: CaptionBorderConfig;
}

export interface ScreenshotTemplate {
  id: string;
  name: string;
  description: string;
  category: 'modern' | 'minimal' | 'bold' | 'elegant' | 'playful' | 'professional';
  preview?: string; // URL or path to preview image

  // Visual settings
  background: BackgroundConfig;

  // Device positioning (applied to all devices unless overridden)
  deviceStyle: {
    frameScale: number;
    framePosition: 'top' | 'center' | 'bottom' | number;
    partialFrame?: boolean;
    frameOffset?: number;
  };

  // Caption styling
  captionStyle: Partial<CaptionConfig>;

  // Device-specific overrides
  deviceOverrides?: {
    iphone?: TemplateDeviceOverride;
    ipad?: TemplateDeviceOverride;
    mac?: TemplateDeviceOverride;
    watch?: TemplateDeviceOverride;
  };

  // Optional caption suggestions for this template
  captionSuggestions?: {
    hero?: string[];  // Main caption ideas
    features?: string[];  // Feature descriptions
    cta?: string[];  // Call-to-action phrases
  };
}

// Template definitions
export const templates: ScreenshotTemplate[] = [
  {
    id: 'modern',
    name: 'Modern Vibrant',
    description: 'Eye-catching gradient with floating device and clean captions',
    category: 'modern',
    background: {
      mode: 'gradient',
      gradient: {
        colors: ['#667eea', '#764ba2', '#f093fb'],
        direction: 'diagonal'
      }
    },
    deviceStyle: {
      frameScale: 0.85,
      framePosition: 50  // Centered
    },
    captionStyle: {
      font: 'SF Pro Display',
      fontsize: 64,
      color: '#021d2f',
      position: 'above',
      align: 'center',
      box: {
        autoSize: true,
        maxLines: 3,
        lineHeight: 1.4,
        marginTop: 20,
        marginBottom: 20
      }
    },
    deviceOverrides: {
      mac: {
        frameScale: 0.9,
        framePosition: 25
      },
      iphone: {
        // Add sensible top clearance for 'above' captions on iPhone
        captionBox: { marginTop: 56 },
        captionSize: 72
      },
      watch: {
        frameScale: 0.9,
        framePosition: 100,
        partialFrame: true,
        frameOffset: 17,
        captionSize: 24,
        captionPosition: 'above',
        captionBox: {
          marginBottom: 8,
          marginTop: 18,
          autoSize: true,
          lineHeight: 1.4,
          maxLines: 2
        }
      },
      ipad: {
        frameScale: 0.90,
        framePosition: 60
      }
    }
  },

  {
    id: 'minimal',
    name: 'Minimal Clean',
    description: 'Soft pastel background with elegant typography',
    category: 'minimal',
    background: {
      mode: 'gradient',
      gradient: {
        colors: ['#ffecd2', '#fcb69f'],
        direction: 'top-bottom'
      }
    },
    deviceStyle: {
      frameScale: 0.95,
      framePosition: 50  // Lower position
    },
    captionStyle: {
      font: 'Helvetica Neue',
      fontsize: 56,
      color: '#1b2a3a',
      position: 'above',
      align: 'center',
      box: {
        autoSize: true,
        maxLines: 2,
        lineHeight: 1.3,
        marginTop: 40,
        marginBottom: 0
      }
    },
    deviceOverrides: {
      iphone: {
        frameScale: 0.95,
        framePosition: 50,
        captionBox: { marginTop: 56 },
        captionSize: 64
      },
      watch: {
        frameScale: 0.85,
        framePosition: 0,
        captionSize: 22,
        captionPosition: 'below',
        captionBox: {
          marginTop: 36,
          marginBottom: 12,
          autoSize: true,
          lineHeight: 1.4,
          maxLines: 2
        }
      },
      ipad: {
        frameScale: 0.90,
        framePosition: 50
      }, mac: {
        frameScale: 0.90,
        framePosition: 25
      }
    }
  },

  {
    id: 'bold',
    name: 'Bold Impact',
    description: 'Dark dramatic gradient with large device and overlay captions',
    category: 'bold',
    background: {
      mode: 'gradient',
      gradient: {
        colors: ['#0f0c29', '#302b63', '#24243e'],
        direction: 'diagonal'
      }
    },
    deviceStyle: {
      frameScale: 0.9,
      framePosition: 10  // Centered-high position
    },
    captionStyle: {
      font: 'SF Pro Display',
      fontsize: 64,
      color: '#FFFFFF',
      position: 'overlay',
      align: 'center'
    },
    deviceOverrides: {
      mac: {
        frameScale: 0.90,
        framePosition: 0,
        captionBox: {
          marginTop: 0,
          marginBottom: 20
        }
      },
      iphone: {
        frameScale: 0.90,
        framePosition: 20,
        captionBox: {
          marginTop: 0,
          marginBottom: 20
        },
        captionSize: 72
      },
      ipad: {
        frameScale: 0.90,
        framePosition: 25,
        captionBox: {
          marginTop: 0,
          marginBottom: 20
        }
      },
      watch: {
        frameScale: 0.9,
        framePosition: 0,
        partialFrame: true,
        frameOffset: 17,
        captionBox: {
          marginBottom: 10,
          lineHeight: 1.4,
          maxLines: 2
        }
      }
    }
  },

  {
    id: 'nerdy',
    name: 'Nerdy OSS',
    description: 'Grid-lined midnight background with JetBrains Mono captions',
    category: 'bold',
    background: {
      mode: 'auto'
    },
    deviceStyle: {
      frameScale: 0.9,
      framePosition: 12
    },
    captionStyle: {
      font: 'JetBrains Mono Bold',
      fontsize: 60,
      color: '#7CFFCB',
      position: 'overlay',
      align: 'center',
      box: {
        marginBottom: 32
      }
    },
    deviceOverrides: {
      mac: {
        frameScale: 0.9,
        framePosition: 8,
        captionBox: {
          marginTop: 0,
          marginBottom: 24
        }
      },
      iphone: {
        frameScale: 0.9,
        framePosition: 18,
        captionBox: {
          marginTop: 12,
          marginBottom: 24
        },
        captionSize: 70
      },
      ipad: {
        frameScale: 0.9,
        framePosition: 20,
        captionBox: {
          marginTop: 16,
          marginBottom: 24
        }
      },
      watch: {
        frameScale: 0.96,
        framePosition: 0,
        partialFrame: true,
        frameOffset: 17,
        captionSize: 26,
        captionPosition: 'below',
        captionBox: {
          marginTop: 14,
          marginBottom: 16,
          autoSize: true,
          lineHeight: 1.4,
          maxLines: 2
        }
      }
    }
  },

  {
    id: 'elegant',
    name: 'Elegant Professional',
    description: 'Sophisticated monochrome with floating device',
    category: 'elegant',
    background: {
      mode: 'gradient',
      gradient: {
        colors: ['#8e9eab', '#eef2f3'],
        direction: 'top-bottom'
      }
    },
    deviceStyle: {
      frameScale: 0.95,
      framePosition: 50
    },
    captionStyle: {
      font: 'Georgia',
      fontsize: 68,
      color: '#132235',
      position: 'below',
      align: 'center',
      box: {
        autoSize: true,
        maxLines: 2,
        lineHeight: 1.5,
        marginTop: 0,
        marginBottom: 60
      }
    },
    deviceOverrides: {
      iphone: {
        frameScale: 0.9,
        framePosition: 50,
        captionBox: { marginBottom: 60 },
        captionSize: 76
      },
      mac: {
        frameScale: 0.9,
        framePosition: 0
      },
      watch: {
        frameScale: 0.80,
        framePosition: 25,
        captionSize: 20,
        captionPosition: 'below',
        captionBox: {
          marginTop: 0,
          marginBottom: 0
        }
      },
      ipad: {
        frameScale: 0.90,
        framePosition: 25
      }
    }
  },

  {
    id: 'showcase',
    name: 'Showcase',
    description: 'Feature your app with custom backgrounds',
    category: 'professional',
    background: {
      mode: 'auto',  // Will auto-detect background.png
      fallback: 'gradient',
      gradient: {
        colors: ['#4facfe', '#00f2fe'],
        direction: 'left-right'
      }
    },
    deviceStyle: {
      frameScale: 0.90,
      framePosition: 50
    },
    captionStyle: {
      font: 'SF Pro Display',
      fontsize: 64,
      color: '#FFFFFF',
      position: 'above',
      align: 'center',
      box: {
        autoSize: true,
        maxLines: 3,
        lineHeight: 1.4,
        marginTop: 30,
        marginBottom: 10
      }
    },
    deviceOverrides: {
      mac: {
        frameScale: 0.90,
        framePosition: 50,
        captionBox: {
          marginTop: 20,
          marginBottom: 0
        }
      },
      watch: {
        frameScale: 0.75,
        framePosition: 95,
        captionSize: 28,
        captionPosition: 'above',
        captionBox: {
          marginTop: 10,
          marginBottom: 0
        }
      },
      ipad: {
        frameScale: 0.85,
        framePosition: 50,
        captionBox: {
          marginTop: 10,
          marginBottom: 0
        }
      }, iphone: {
        frameScale: 0.9,
        framePosition: 50,
        captionBox: { marginTop: 20 },
        captionSize: 72
      }
    }
  },

  {
    id: 'playful',
    name: 'Playful Energy',
    description: 'Bright, fun gradients perfect for games and entertainment apps',
    category: 'playful',
    background: {
      mode: 'gradient',
      gradient: {
        colors: ['#fa709a', '#fee140', '#fa709a'],
        direction: 'diagonal'
      }
    },
    deviceStyle: {
      frameScale: 0.95,
      framePosition: 60
    },
    captionStyle: {
      font: 'SF Pro Display',
      fontsize: 68,
      color: '#FFFFFF',
      position: 'above',
      align: 'center',
      box: {
        autoSize: true,
        maxLines: 2,
        lineHeight: 1.3,
        marginTop: 0,
        marginBottom: 0
      }
    },
    deviceOverrides: {
      mac: {
        frameScale: 0.90,
        framePosition: 25,
        captionBox: {
          marginTop: 20,
          marginBottom: 0
        }
      },
      iphone: {
        frameScale: 0.9,
        framePosition: 50,
        captionBox: { marginTop: 56 },
        captionSize: 76
      },
      watch: {
        frameScale: 0.75,
        framePosition: 40,
        captionSize: 24,
        captionPosition: 'below',
        captionBox: {
          marginTop: 0
        }
      },
      ipad: {
        frameScale: 0.90,
        framePosition: 50,
        captionBox: {
          marginTop: 20,
          marginBottom: 0
        }
      }
    }
  },

  {
    id: 'corporate',
    name: 'Corporate Professional',
    description: 'Clean, professional look for business and productivity apps',
    category: 'professional',
    background: {
      mode: 'gradient',
      gradient: {
        colors: ['#0077BE', '#33CCCC'],
        direction: 'top-bottom'
      }
    },
    deviceStyle: {
      frameScale: 0.85,
      framePosition: 50
    },
    captionStyle: {
      font: 'Helvetica',
      fontsize: 54,
      color: '#0f1e2d',
      position: 'above',
      align: 'center',
      box: {
        autoSize: true,
        maxLines: 3,
        lineHeight: 1.4,
        marginTop: 50,
        marginBottom: 20
      }
    },
    deviceOverrides: {
      mac: {
        frameScale: 0.90,
        framePosition: 25
      },
      iphone: {
        captionSize: 64
      },
      watch: {
        frameScale: 0.80,
        framePosition: 75,
        captionSize: 18,
        captionBox: {
          marginTop: 12,
          marginBottom: 12,
          lineHeight: 1.4,
          maxLines: 2
        }
      }
    }
  }
];

/**
 * Get template by ID
 */
export function getTemplate(id: string): ScreenshotTemplate | undefined {
  return templates.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): ScreenshotTemplate[] {
  return templates.filter(t => t.category === category);
}

/**
 * Get all template categories
 */
export function getTemplateCategories(): string[] {
  return [...new Set(templates.map(t => t.category))];
}

/**
 * Apply template to configuration
 */
export function applyTemplateToConfig(
  templateId: string,
  existingConfig: Partial<AppshotConfig>
): Partial<AppshotConfig> {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Template "${templateId}" not found`);
  }

  // Start with existing config
  const config: Partial<AppshotConfig> = { ...existingConfig };

  // Apply background
  config.background = template.background;

  const templateCaptionStyle = template.captionStyle || {};
  const captionBackgroundProvided = Object.prototype.hasOwnProperty.call(templateCaptionStyle, 'background');
  const captionBorderProvided = Object.prototype.hasOwnProperty.call(templateCaptionStyle, 'border');

  // Apply caption style (respect explicit zeros via nullish coalescing)
  const mergedCaption: CaptionConfig = {
    ...(config.caption || {}),
    ...templateCaptionStyle,
    paddingTop: templateCaptionStyle.paddingTop ?? (config.caption?.paddingTop ?? 100),
    paddingBottom: templateCaptionStyle.paddingBottom ?? (config.caption?.paddingBottom ?? 60)
  } as CaptionConfig;

  if (!captionBackgroundProvided) {
    delete (mergedCaption as any).background;
  }
  if (!captionBorderProvided) {
    delete (mergedCaption as any).border;
  }

  config.caption = mergedCaption;

  // Apply device styles
  if (config.devices) {
    for (const [deviceName, deviceConfig] of Object.entries(config.devices)) {
      const override = template.deviceOverrides?.[deviceName as keyof typeof template.deviceOverrides];

      // Apply base device style
      const mergedDevice: any = {
        ...deviceConfig,
        frameScale: template.deviceStyle.frameScale,
        framePosition: template.deviceStyle.framePosition,
        partialFrame: template.deviceStyle.partialFrame,
        frameOffset: template.deviceStyle.frameOffset,
        captionPosition: template.captionStyle.position,
        ...override  // Apply device-specific overrides
      };

      const overrideHasBackground = !!override && Object.prototype.hasOwnProperty.call(override, 'captionBackground');
      const overrideHasBorder = !!override && Object.prototype.hasOwnProperty.call(override, 'captionBorder');
      if (!overrideHasBackground) {
        delete mergedDevice.captionBackground;
      }
      if (!overrideHasBorder) {
        delete mergedDevice.captionBorder;
      }

      // Ensure template font size changes take effect:
      // If the template did NOT provide a per-device captionSize override,
      // remove any existing device-level captionSize so compose.ts falls back
      // to the template/global caption.fontsize.
      if (!override || override.captionSize === undefined) {
        delete mergedDevice.captionSize;
      }

      config.devices[deviceName] = mergedDevice;
    }
  }

  return config;
}

/**
 * Generate caption suggestions for a template
 */
export function getTemplateCaptionSuggestions(templateId: string): {
  hero: string[];
  features: string[];
  cta: string[];
} {
  const template = getTemplate(templateId);

  // Default suggestions if template doesn't have specific ones
  const defaults = {
    hero: [
      'Powerful Features, Beautiful Design',
      'Everything You Need in One App',
      'Designed for You',
      'Simple. Fast. Powerful.'
    ],
    features: [
      'Track Everything',
      'Stay Organized',
      'Real-Time Updates',
      'Secure & Private',
      'Works Everywhere'
    ],
    cta: [
      'Download Now',
      'Get Started Today',
      'Try It Free',
      'Join Millions of Users'
    ]
  };

  if (template?.captionSuggestions) {
    return {
      hero: template.captionSuggestions.hero || defaults.hero,
      features: template.captionSuggestions.features || defaults.features,
      cta: template.captionSuggestions.cta || defaults.cta
    };
  }

  return defaults;
}
