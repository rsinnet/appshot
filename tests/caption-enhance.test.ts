import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import path from 'path';
import os from 'os';
import { mkdtemp } from 'node:fs/promises';
import captionCmd from '../src/commands/caption.js';

vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn()
  }
}));

vi.mock('../src/core/files.js', () => ({
  loadConfig: vi.fn()
}));

vi.mock('../src/services/caption-enhancement.js', () => ({
  captionEnhancementService: {
    hasApiKey: vi.fn(() => true),
    enhanceBatch: vi.fn(async (options: { captions: Record<string, string> }) => {
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(options.captions)) {
        out[key] = `Enhanced ${value}`;
      }
      return out;
    })
  }
}));

describe('caption enhance command', () => {
  let program: Command;
  let mockReadFile: any;
  let mockWriteFile: any;
  let mockReaddir: any;
  let mockLoadConfig: any;
  let tempDir: string;
  const cwd = process.cwd();

  beforeEach(async () => {
    const fsMock = await import('fs');
    const files = await import('../src/core/files.js');
    mockReadFile = fsMock.promises.readFile;
    mockWriteFile = fsMock.promises.writeFile;
    mockReaddir = fsMock.promises.readdir;
    mockLoadConfig = files.loadConfig;

    tempDir = await mkdtemp(path.join(os.tmpdir(), 'appshot-caption-enhance-'));
    process.chdir(tempDir);

    program = new Command();
    program.exitOverride();
    program.addCommand(captionCmd());

    mockReaddir.mockResolvedValue([]);
    mockWriteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.chdir(cwd);
    vi.clearAllMocks();
  });

  it('enhances captions for specified languages and writes updates', async () => {
    mockLoadConfig.mockResolvedValue({
      version: 2,
      layout: 'header',
      caption: { font: 'SF Pro Display Bold', color: '#fff' },
      devices: {
        iphone: {
          input: './screenshots/iphone',
          resolution: '1290x2796'
        }
      }
    });

    const captions = {
      'home.png': { en: 'Original caption', fr: 'Texte original' },
      'simple.png': 'Simple caption'
    };

    mockReadFile.mockResolvedValue(JSON.stringify(captions));

    await program.parseAsync([
      'node',
      'test',
      'caption',
      'enhance',
      '--device',
      'iphone',
      '--langs',
      'en,fr',
      '--model',
      'gpt-5-mini'
    ]);

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
    expect(written['home.png'].en).toBe('Enhanced Original caption');
    expect(written['home.png'].fr).toBe('Enhanced Texte original');
    expect(written['simple.png']).toBe('Enhanced Simple caption');
  });

  it('supports dry-run without writing files', async () => {
    mockLoadConfig.mockResolvedValue({
      version: 2,
      layout: 'header',
      caption: { font: 'SF Pro Display Bold', color: '#fff' },
      devices: {
        iphone: {
          input: './screenshots/iphone',
          resolution: '1290x2796'
        }
      }
    });

    const captions = {
      'home.png': { en: 'Original caption' }
    };

    mockReadFile.mockResolvedValue(JSON.stringify(captions));

    await program.parseAsync([
      'node',
      'test',
      'caption',
      'enhance',
      '--device',
      'iphone',
      '--model',
      'gpt-5-mini',
      '--dry-run'
    ]);

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('rejects non GPT-5 models', async () => {
    mockLoadConfig.mockResolvedValue({
      version: 2,
      layout: 'header',
      caption: { font: 'SF Pro Display Bold', color: '#fff' },
      devices: {
        iphone: {
          input: './screenshots/iphone',
          resolution: '1290x2796'
        }
      }
    });

    mockReadFile.mockResolvedValue(JSON.stringify({ 'home.png': { en: 'Original caption' } }));

    await expect(
      program.parseAsync([
        'node',
        'test',
        'caption',
        'enhance',
        '--device',
        'iphone',
        '--model',
        'gpt-4o-mini'
      ])
    ).rejects.toThrow();

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('fails when config is v1', async () => {
    mockLoadConfig.mockResolvedValue({
      output: './final',
      caption: { font: 'SF Pro', fontsize: 64, color: '#fff' },
      devices: { iphone: { input: './screenshots/iphone', resolution: '1290x2796' } }
    });

    mockReadFile.mockResolvedValue(JSON.stringify({ 'home.png': { en: 'Original caption' } }));

    await expect(
      program.parseAsync([
        'node',
        'test',
        'caption',
        'enhance',
        '--device',
        'iphone',
        '--model',
        'gpt-5-mini'
      ])
    ).rejects.toThrow();
  });
});
