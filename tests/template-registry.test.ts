import { describe, it, expect } from 'vitest';
import {
  templates,
  getTemplate,
  applyTemplateToConfig,
  getTemplateCaptionSuggestions,
  getTemplateCategories,
  resolveTemplateId
} from '../src/templates/registry.js';
import type { AppshotConfigV2 } from '../src/types.js';

describe('Template Registry (v2)', () => {
  it('should have expected template IDs', () => {
    const expectedIds = [
      'ocean-header',
      'pastel-header',
      'noir-footer',
      'silver-header',
      'clean-screenshot',
      'tropical-header',
      'slate-footer',
      'midnight-header'
    ];
    const actualIds = templates.map(t => t.id);
    expect(actualIds).toEqual(expect.arrayContaining(expectedIds));
  });

  it('should have required fields for each template', () => {
    templates.forEach(template => {
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('category');
      expect(template).toHaveProperty('layout');
      expect(template).toHaveProperty('background');
      expect(template).toHaveProperty('caption');

      expect(['header', 'footer', 'screenshot-only']).toContain(template.layout);

      if (template.background.mode === 'gradient') {
        expect(template.background.gradient?.colors?.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  it('resolves legacy aliases', () => {
    const resolved = resolveTemplateId('modern');
    expect(resolved.id).toBe('ocean-header');
    expect(resolved.isAlias).toBe(true);
  });

  it('returns template by ID', () => {
    const tpl = getTemplate('ocean-header');
    expect(tpl).toBeDefined();
    expect(tpl?.id).toBe('ocean-header');
  });

  it('applyTemplateToConfig should preserve existing devices', () => {
    const config: Partial<AppshotConfigV2> = {
      version: 2,
      devices: {
        iphone: { input: './custom/path', resolution: '1290x2796' }
      }
    };

    const result = applyTemplateToConfig('noir-footer', config);
    expect(result.devices.iphone).toBeDefined();
    expect(typeof result.devices.iphone).toBe('object');
  });

  it('getTemplateCaptionSuggestions returns defaults', () => {
    const suggestions = getTemplateCaptionSuggestions('ocean-header');
    expect(suggestions.hero.length).toBeGreaterThan(0);
    expect(suggestions.features.length).toBeGreaterThan(0);
    expect(suggestions.cta.length).toBeGreaterThan(0);
  });

  it('getTemplateCategories returns unique categories', () => {
    const categories = getTemplateCategories();
    expect(categories).toEqual([...new Set(categories)]);
  });
});
