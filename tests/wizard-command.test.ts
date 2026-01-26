import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runWizard } from '../src/commands/wizard.js';
import sharp from 'sharp';

describe('wizard command (no-interactive)', () => {
  let tempDir: string;
  const cwd = process.cwd();
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'appshot-wizard-'));
    process.chdir(tempDir);
    await mkdir(path.join(tempDir, '.appshot'), { recursive: true });
  });

  afterEach(() => {
    process.chdir(cwd);
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it('skips AI steps when no API key and continues with en only', async () => {
    delete process.env.OPENAI_API_KEY;
    await writeFile(
      path.join(tempDir, '.appshot', 'config.json'),
      JSON.stringify({
        version: 2,
        layout: 'header',
        caption: { font: 'SF Pro Display Bold', color: '#fff' },
        devices: { iphone: './screenshots/iphone' }
      })
    );

    const calls: string[][] = [];
    const runner = async (args: string[]) => {
      calls.push(args);
    };

    await runWizard({
      noInteractive: true,
      devices: 'iphone',
      layout: 'header',
      captionSource: 'filenames',
      langs: 'en,es,fr',
      enhance: true
    }, { runner });

    expect(calls).toEqual([
      ['caption', '--device', 'iphone', '--auto-caption'],
      ['build', '--devices', 'iphone', '--langs', 'en']
    ]);
  });

  it('runs translate + enhance when API key is present', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    await writeFile(
      path.join(tempDir, '.appshot', 'config.json'),
      JSON.stringify({
        version: 2,
        layout: 'header',
        caption: { font: 'SF Pro Display Bold', color: '#fff' },
        devices: { iphone: './screenshots/iphone' }
      })
    );

    const calls: string[][] = [];
    const runner = async (args: string[]) => {
      calls.push(args);
    };

    await runWizard({
      noInteractive: true,
      devices: 'iphone',
      layout: 'footer',
      captionSource: 'filenames',
      langs: 'en,es,fr',
      model: 'gpt-5-mini',
      enhance: true
    }, { runner });

    expect(calls).toEqual([
      ['caption', '--device', 'iphone', '--auto-caption', '--translate', '--langs', 'es,fr', '--model', 'gpt-5-mini'],
      ['caption', 'enhance', '--device', 'iphone', '--model', 'gpt-5-mini', '--langs', 'en,es,fr'],
      ['build', '--devices', 'iphone', '--langs', 'en,es,fr']
    ]);
  });

  it('applies template when provided', async () => {
    await writeFile(
      path.join(tempDir, '.appshot', 'config.json'),
      JSON.stringify({
        version: 2,
        layout: 'header',
        caption: { font: 'SF Pro Display Bold', color: '#fff' },
        devices: { iphone: './screenshots/iphone' }
      })
    );

    const calls: string[][] = [];
    const runner = async (args: string[]) => {
      calls.push(args);
    };

    await runWizard({
      noInteractive: true,
      devices: 'iphone',
      template: 'sunset-footer',
      captionSource: 'filenames',
      langs: 'en',
      noEnhance: true
    }, { runner });

    const updated = JSON.parse(
      await readFile(path.join(tempDir, '.appshot', 'config.json'), 'utf8')
    );

    expect(updated.layout).toBe('footer');
    expect(updated.background?.gradient?.colors).toEqual(['#FF5F6D', '#FFC371']);
    expect(calls).toEqual([
      ['caption', '--device', 'iphone', '--auto-caption'],
      ['build', '--devices', 'iphone', '--langs', 'en']
    ]);
  });

  it('auto-detects resolution from screenshots', async () => {
    await mkdir(path.join(tempDir, 'screenshots', 'iphone'), { recursive: true });
    const samplePath = path.join(tempDir, 'screenshots', 'iphone', 'sample.png');
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: '#ffffff'
      }
    }).png().toFile(samplePath);

    await writeFile(
      path.join(tempDir, '.appshot', 'config.json'),
      JSON.stringify({
        version: 2,
        layout: 'header',
        caption: { font: 'SF Pro Display Bold', color: '#fff' },
        devices: { iphone: './screenshots/iphone' }
      })
    );

    const runner = async (_args: string[]) => {};

    await runWizard({
      noInteractive: true,
      devices: 'iphone',
      captionSource: 'filenames',
      langs: 'en'
    }, { runner });

    const updated = JSON.parse(
      await readFile(path.join(tempDir, '.appshot', 'config.json'), 'utf8')
    );

    expect(updated.devices.iphone.resolution).toBe('1200x800');
  });
});
