import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { filenameToCaption } from '../src/utils/filename-caption.js';

describe('MCP Captions Tool', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'appshot-mcp-test-'));
    originalCwd = process.cwd();
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

    // Set up project structure
    const appshotDir = path.join(tempDir, '.appshot');
    const captionsDir = path.join(appshotDir, 'captions');
    const screenshotsDir = path.join(tempDir, 'screenshots', 'iphone');

    await fs.mkdir(captionsDir, { recursive: true });
    await fs.mkdir(screenshotsDir, { recursive: true });

    // Create config
    const config = {
      output: './final',
      frames: './frames',
      gradient: { colors: ['#000', '#fff'], direction: 'top-bottom' },
      caption: { font: 'Arial', fontsize: 48, color: '#000' },
      devices: {
        iphone: { input: './screenshots/iphone', resolution: '1290x2796' }
      }
    };
    await fs.writeFile(
      path.join(appshotDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    if (process.platform === 'win32') {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      await fs.rm(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('filenameToCaption utility', () => {
    it('should be used for auto caption generation', () => {
      expect(filenameToCaption('home-screen.png')).toBe('Home Screen');
      expect(filenameToCaption('settings_page.png')).toBe('Settings Page');
    });
  });

  describe('bulk-set action simulation', () => {
    it('should parse JSON and set multiple captions', async () => {
      const captionFile = path.join(tempDir, '.appshot', 'captions', 'iphone.json');

      // Simulate bulk-set action
      const captionsToSet = {
        'screen1.png': 'Welcome Screen',
        'screen2.png': 'Dashboard View'
      };

      const captions: Record<string, Record<string, string>> = {};
      const lang = 'en';

      for (const [filename, captionText] of Object.entries(captionsToSet)) {
        captions[filename] = { [lang]: captionText };
      }

      await fs.writeFile(captionFile, JSON.stringify(captions, null, 2));

      // Verify
      const saved = JSON.parse(await fs.readFile(captionFile, 'utf8'));
      expect(saved['screen1.png']).toEqual({ en: 'Welcome Screen' });
      expect(saved['screen2.png']).toEqual({ en: 'Dashboard View' });
    });

    it('should handle different languages', async () => {
      const captionFile = path.join(tempDir, '.appshot', 'captions', 'iphone.json');

      // Set initial English captions
      const captions: Record<string, Record<string, string>> = {
        'screen1.png': { en: 'Welcome' }
      };

      // Add French translation
      captions['screen1.png']['fr'] = 'Bienvenue';

      await fs.writeFile(captionFile, JSON.stringify(captions, null, 2));

      // Verify
      const saved = JSON.parse(await fs.readFile(captionFile, 'utf8'));
      expect(saved['screen1.png']).toEqual({ en: 'Welcome', fr: 'Bienvenue' });
    });

    it('should reject invalid JSON', () => {
      const invalidJson = '{ invalid json }';
      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });

  describe('auto action simulation', () => {
    it('should generate captions from filenames', async () => {
      const screenshotsDir = path.join(tempDir, 'screenshots', 'iphone');

      // Create test screenshots
      await fs.writeFile(path.join(screenshotsDir, 'home-screen.png'), '');
      await fs.writeFile(path.join(screenshotsDir, 'settings_page.png'), '');
      await fs.writeFile(path.join(screenshotsDir, 'user-profile.png'), '');

      // Simulate auto action
      const files = (await fs.readdir(screenshotsDir))
        .filter(f => /\.(png|jpg|jpeg)$/i.test(f));

      const captions: Record<string, Record<string, string>> = {};
      const lang = 'en';

      for (const filename of files) {
        const captionText = filenameToCaption(filename);
        captions[filename] = { [lang]: captionText };
      }

      expect(captions['home-screen.png']).toEqual({ en: 'Home Screen' });
      expect(captions['settings_page.png']).toEqual({ en: 'Settings Page' });
      expect(captions['user-profile.png']).toEqual({ en: 'User Profile' });
    });

    it('should not overwrite existing captions by default', async () => {
      const captionFile = path.join(tempDir, '.appshot', 'captions', 'iphone.json');
      const screenshotsDir = path.join(tempDir, 'screenshots', 'iphone');

      // Create test screenshots
      await fs.writeFile(path.join(screenshotsDir, 'home-screen.png'), '');
      await fs.writeFile(path.join(screenshotsDir, 'new-feature.png'), '');

      // Set up existing captions
      const existing: Record<string, Record<string, string>> = {
        'home-screen.png': { en: 'My Custom Caption' }
      };
      await fs.writeFile(captionFile, JSON.stringify(existing, null, 2));

      // Simulate auto action with overwrite=false
      const files = (await fs.readdir(screenshotsDir))
        .filter(f => /\.(png|jpg|jpeg)$/i.test(f));

      const captions = JSON.parse(await fs.readFile(captionFile, 'utf8'));
      const lang = 'en';
      const overwrite = false;

      for (const filename of files) {
        const hasCaption = captions[filename] && captions[filename][lang];
        if (hasCaption && !overwrite) {
          continue;
        }
        const captionText = filenameToCaption(filename);
        captions[filename] = { ...(captions[filename] || {}), [lang]: captionText };
      }

      // Existing caption should be preserved
      expect(captions['home-screen.png']).toEqual({ en: 'My Custom Caption' });
      // New caption should be generated
      expect(captions['new-feature.png']).toEqual({ en: 'New Feature' });
    });

    it('should overwrite existing captions when requested', async () => {
      const captionFile = path.join(tempDir, '.appshot', 'captions', 'iphone.json');
      const screenshotsDir = path.join(tempDir, 'screenshots', 'iphone');

      // Create test screenshots
      await fs.writeFile(path.join(screenshotsDir, 'home-screen.png'), '');

      // Set up existing captions
      const existing: Record<string, Record<string, string>> = {
        'home-screen.png': { en: 'My Custom Caption' }
      };
      await fs.writeFile(captionFile, JSON.stringify(existing, null, 2));

      // Simulate auto action with overwrite=true
      const files = (await fs.readdir(screenshotsDir))
        .filter(f => /\.(png|jpg|jpeg)$/i.test(f));

      const captions = JSON.parse(await fs.readFile(captionFile, 'utf8'));
      const lang = 'en';
      const overwrite = true;

      for (const filename of files) {
        const hasCaption = captions[filename] && captions[filename][lang];
        if (hasCaption && !overwrite) {
          continue;
        }
        const captionText = filenameToCaption(filename);
        captions[filename] = { ...(captions[filename] || {}), [lang]: captionText };
      }

      // Caption should be overwritten
      expect(captions['home-screen.png']).toEqual({ en: 'Home Screen' });
    });

    it('should filter only image files', async () => {
      const screenshotsDir = path.join(tempDir, 'screenshots', 'iphone');

      // Create mixed files
      await fs.writeFile(path.join(screenshotsDir, 'valid.png'), '');
      await fs.writeFile(path.join(screenshotsDir, 'valid.jpg'), '');
      await fs.writeFile(path.join(screenshotsDir, 'valid.jpeg'), '');
      await fs.writeFile(path.join(screenshotsDir, 'invalid.txt'), '');
      await fs.writeFile(path.join(screenshotsDir, 'invalid.json'), '');

      const files = (await fs.readdir(screenshotsDir))
        .filter(f => /\.(png|jpg|jpeg)$/i.test(f));

      expect(files).toHaveLength(3);
      expect(files).toContain('valid.png');
      expect(files).toContain('valid.jpg');
      expect(files).toContain('valid.jpeg');
      expect(files).not.toContain('invalid.txt');
      expect(files).not.toContain('invalid.json');
    });

    it('should handle empty screenshots directory', async () => {
      const screenshotsDir = path.join(tempDir, 'screenshots', 'iphone');

      const files = (await fs.readdir(screenshotsDir))
        .filter(f => /\.(png|jpg|jpeg)$/i.test(f));

      expect(files).toHaveLength(0);
    });
  });
});
