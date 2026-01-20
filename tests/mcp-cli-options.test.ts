import { describe, it, expect } from 'vitest';
import {
  createBuildArgs,
  createFrameArgs,
  createExportArgs,
  createInitArgs,
  createSpecsArgs,
  createValidateArgs,
  createCleanArgs,
  createLocalizeArgs,
  createPresetsArgs,
  createFontsArgs,
  createTemplateArgs,
  createQuickstartArgs
} from '../src/mcp/cli-options.js';

describe('MCP CLI argument builders', () => {
  it('creates build args with optional lists and flags', () => {
    const args = createBuildArgs({
      devices: ['iphone', 'ipad'],
      presets: ['iphone-6-9'],
      languages: ['en', 'fr'],
      configPath: 'config/appshot.json',
      dryRun: true,
      noFrame: true,
      backgroundFit: 'contain',
      autoBackground: true,
      concurrency: 8
    });

    expect(args).toEqual([
      'build',
      '--devices',
      'iphone,ipad',
      '--preset',
      'iphone-6-9',
      '--langs',
      'en,fr',
      '--config',
      'config/appshot.json',
      '--background-fit',
      'contain',
      '--concurrency',
      '8',
      '--dry-run',
      '--no-frame',
      '--auto-background'
    ]);
  });

  it('creates build args with auto-caption flag', () => {
    const args = createBuildArgs({
      devices: ['iphone'],
      autoCaption: true
    });

    expect(args).toEqual([
      'build',
      '--devices',
      'iphone',
      '--auto-caption'
    ]);
  });

  it('creates frame args including tone option', () => {
    const args = createFrameArgs({
      input: './screenshots',
      outputDir: './framed',
      device: 'iphone',
      recursive: true,
      overwrite: true,
      frameTone: 'neutral'
    });

    expect(args).toEqual([
      'frame',
      'screenshots',
      '--output',
      './framed',
      '--device',
      'iphone',
      '--recursive',
      '--overwrite',
      '--frame-tone',
      'neutral'
    ]);
  });

  it('creates export args with format override and booleans', () => {
    const args = createExportArgs({
      format: 'fastlane',
      sourceDir: './final',
      outputDir: './fastlane/screenshots',
      languages: ['en-US', 'fr-FR'],
      devices: ['iphone'],
      copy: true,
      clean: true,
      dryRun: true,
      json: true
    });

    expect(args).toEqual([
      'export',
      '--source',
      './final',
      '--output',
      './fastlane/screenshots',
      '--langs',
      'en-US,fr-FR',
      '--devices',
      'iphone',
      '--copy',
      '--clean',
      '--dry-run',
      '--json'
    ]);
  });

  it('creates init args with force flag', () => {
    expect(createInitArgs({})).toEqual(['init']);
    expect(createInitArgs({ force: true })).toEqual(['init', '--force']);
  });

  it('creates specs args with device filter and required flag', () => {
    expect(createSpecsArgs({})).toEqual(['specs', '--json']);
    expect(createSpecsArgs({ device: 'iphone', required: true })).toEqual([
      'specs', '--device', 'iphone', '--required', '--json'
    ]);
  });

  it('creates validate args with strict and fix flags', () => {
    expect(createValidateArgs({})).toEqual(['validate', '--json']);
    expect(createValidateArgs({ strict: true, fix: true })).toEqual([
      'validate', '--strict', '--fix', '--json'
    ]);
  });

  it('creates clean args with output dir and cleanup flags', () => {
    expect(createCleanArgs({})).toEqual(['clean', '--yes']);
    expect(createCleanArgs({
      outputDir: './output',
      all: true,
      history: true,
      keepHistory: true
    })).toEqual([
      'clean', '--output', './output', '--all', '--history', '--keep-history', '--yes'
    ]);
  });

  it('creates localize args with required languages and options', () => {
    expect(createLocalizeArgs({ languages: ['es', 'fr'] })).toEqual([
      'localize', '--langs', 'es,fr'
    ]);
    expect(createLocalizeArgs({
      languages: ['de', 'ja'],
      device: 'iphone',
      model: 'gpt-4o',
      sourceLanguage: 'en',
      overwrite: true
    })).toEqual([
      'localize', '--langs', 'de,ja', '--device', 'iphone',
      '--model', 'gpt-4o', '--source-language', 'en', '--overwrite'
    ]);
  });

  it('creates presets args with list, category, and generate options', () => {
    expect(createPresetsArgs({})).toEqual(['presets', '--json']);
    expect(createPresetsArgs({ list: true, required: true })).toEqual([
      'presets', '--list', '--required', '--json'
    ]);
    expect(createPresetsArgs({
      category: 'iphone',
      generate: ['iphone-6-9', 'ipad-13'],
      outputFile: './config.json'
    })).toEqual([
      'presets', '--category', 'iphone', '--generate', 'iphone-6-9,ipad-13',
      '--output', './config.json', '--json'
    ]);
  });

  it('creates fonts args for list, embedded, and validate actions', () => {
    expect(createFontsArgs({ action: 'list' })).toEqual(['fonts', '--json']);
    expect(createFontsArgs({ action: 'embedded' })).toEqual(['fonts', '--json', '--embedded']);
    expect(createFontsArgs({ action: 'validate', font: 'Inter' })).toEqual([
      'fonts', '--json', '--validate', 'Inter'
    ]);
  });

  it('creates template args with template ID and options', () => {
    expect(createTemplateArgs({ list: true })).toEqual(['template', '--list']);
    expect(createTemplateArgs({ template: 'modern' })).toEqual(['template', 'modern']);
    expect(createTemplateArgs({
      template: 'bold',
      caption: 'Hello World',
      device: 'iphone',
      dryRun: true
    })).toEqual([
      'template', 'bold', '--caption', 'Hello World', '--device', 'iphone', '--dry-run'
    ]);
    expect(createTemplateArgs({
      preview: 'elegant',
      noBackup: true
    })).toEqual(['template', '--preview', 'elegant', '--no-backup']);
  });

  it('creates quickstart args with template and caption', () => {
    expect(createQuickstartArgs({})).toEqual(['quickstart']);
    expect(createQuickstartArgs({ template: 'modern' })).toEqual([
      'quickstart', '--template', 'modern'
    ]);
    expect(createQuickstartArgs({
      template: 'bold',
      caption: 'My App',
      force: true,
      noInteractive: true
    })).toEqual([
      'quickstart', '--template', 'bold', '--caption', 'My App', '--no-interactive', '--force'
    ]);
  });
});
