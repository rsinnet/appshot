import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import templateCmd from '../src/commands/template.js';
import { templates, getTemplate, applyTemplateToConfig, getTemplateCaptionSuggestions, getTemplateCategories } from '../src/templates/registry.js';

// Mock modules
vi.mock('fs/promises', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    copyFile: vi.fn(),
    access: vi.fn(),
    readFile: vi.fn()
  },
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    copyFile: vi.fn(),
    access: vi.fn(),
    readFile: vi.fn()
  }
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
    Separator: vi.fn()
  }
}));

describe('Template Command (v2)', () => {
  const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct command name and options', () => {
    const cmd = templateCmd();
    expect(cmd.name()).toBe('template');

    const optionNames = cmd.options.map(opt => opt.long);
    expect(optionNames).toContain('--list');
    expect(optionNames).toContain('--preview');
    expect(optionNames).toContain('--caption');
    expect(optionNames).toContain('--captions');
    expect(optionNames).toContain('--device');
    expect(optionNames).toContain('--no-backup');
    expect(optionNames).toContain('--dry-run');
  });

  it('should list templates from registry', () => {
    for (const template of templates) {
      const resolved = getTemplate(template.id);
      expect(resolved).toBeDefined();
    }
  });

  it('should apply template to config', () => {
    const config = {
      version: 2,
      devices: {
        iphone: { input: './screenshots/iphone', resolution: '1290x2796' }
      }
    };

    const result = applyTemplateToConfig('ocean-header', config);
    expect(result.background).toBeDefined();
    expect(result.caption).toBeDefined();
    expect(result.layout).toBeDefined();
  });

  it('should provide caption suggestions', () => {
    const suggestions = getTemplateCaptionSuggestions('ocean-header');
    expect(suggestions.hero.length).toBeGreaterThan(0);
    expect(suggestions.features.length).toBeGreaterThan(0);
    expect(suggestions.cta.length).toBeGreaterThan(0);
  });

  it('should include all template categories', () => {
    const categories = getTemplateCategories();
    const templateCategories = templates.map(t => t.category);
    for (const category of templateCategories) {
      expect(categories).toContain(category);
    }
  });

  it('should reference validation utilities', async () => {
    const fs = await import('fs');
    const sourceCode = fs.readFileSync(path.join(process.cwd(), 'src/commands/template.ts'), 'utf-8');

    expect(sourceCode).toContain('validateTemplateId');
    expect(sourceCode).toContain('sanitizeCaption');
    expect(sourceCode).toContain('validateJson');
  });
});
