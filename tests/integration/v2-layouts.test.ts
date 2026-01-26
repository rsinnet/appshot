import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.join(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli.js');

const layouts = ['header', 'footer', 'screenshot-only'] as const;
const devices = ['iphone', 'ipad', 'mac', 'watch'] as const;

async function createScreenshot(filePath: string, width: number, height: number) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 120, g: 130, b: 140, alpha: 1 }
    }
  }).png().toFile(filePath);
}

describe('v2 layouts integration (dry-run)', { timeout: 30000 }, () => {
  let testDir: string;
  const originalCwd = process.cwd();

  beforeAll(async () => {
    testDir = path.join('/tmp', `appshot-v2-layouts-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);

    await fs.mkdir('.appshot/captions', { recursive: true });

    const resolutions: Record<string, { width: number; height: number }> = {
      iphone: { width: 1290, height: 2796 },
      ipad: { width: 2048, height: 2732 },
      mac: { width: 2880, height: 1800 },
      watch: { width: 410, height: 502 }
    };

    for (const device of devices) {
      await createScreenshot(
        path.join(testDir, 'screenshots', device, 'test.png'),
        resolutions[device].width,
        resolutions[device].height
      );

      await fs.writeFile(
        path.join(testDir, '.appshot/captions', `${device}.json`),
        JSON.stringify({ 'test.png': `${device} caption` }, null, 2)
      );
    }
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    await fs.rm(testDir, { recursive: true, force: true });
  });

  for (const layout of layouts) {
    it(`builds dry-run for layout ${layout}`, async () => {
      const config = {
        version: 2,
        layout,
        output: './final',
        frames: path.join(repoRoot, 'frames'),
        background: {
          mode: 'gradient',
          gradient: { colors: ['#111111', '#333333'], direction: 'top-bottom' }
        },
        caption: { font: 'SF Pro Display', color: '#FFFFFF' },
        devices: {
          iphone: { input: './screenshots/iphone', resolution: '1290x2796' },
          ipad: { input: './screenshots/ipad', resolution: '2048x2732' },
          mac: { input: './screenshots/mac', resolution: '2880x1800' },
          watch: { input: './screenshots/watch', resolution: '410x502' }
        }
      };

      await fs.mkdir('.appshot', { recursive: true });
      await fs.writeFile('.appshot/config.json', JSON.stringify(config, null, 2));

      const { stdout } = await execAsync(`node ${cliPath} build --dry-run --devices ${devices.join(',')}`);

      expect(stdout).toContain(`Layout: ${layout}`);
      expect(stdout).toContain('iphone:');
      expect(stdout).toContain('ipad:');
      expect(stdout).toContain('mac:');
      expect(stdout).toContain('watch:');
    });
  }
});
