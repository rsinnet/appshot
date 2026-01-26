import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createCleanCommand } from '../src/commands/clean.js';

describe('clean command', () => {
  let tempDir: string;
  const cwd = process.cwd();

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'appshot-clean-'));
    process.chdir(tempDir);
    await fs.mkdir(path.join(tempDir, 'screenshots', 'iphone'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.appshot'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'final'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'gradient-samples'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'screenshots', 'iphone', 'test.png'), 'fake');
    await fs.writeFile(path.join(tempDir, '.appshot', 'config.json'), '{}');
    await fs.writeFile(path.join(tempDir, 'final', 'out.png'), 'fake');
    await fs.writeFile(path.join(tempDir, 'gradient-samples', 'sample.png'), 'fake');
  });

  afterEach(async () => {
    process.chdir(cwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('reset removes generated files but keeps screenshots', async () => {
    const cmd = createCleanCommand();
    await cmd.parseAsync(['node', 'appshot', '--reset', '--yes']);

    const screenshotsExists = await fs.access(path.join(tempDir, 'screenshots'))
      .then(() => true)
      .catch(() => false);
    const appshotExists = await fs.access(path.join(tempDir, '.appshot'))
      .then(() => true)
      .catch(() => false);
    const finalExists = await fs.access(path.join(tempDir, 'final'))
      .then(() => true)
      .catch(() => false);
    const gradientsExists = await fs.access(path.join(tempDir, 'gradient-samples'))
      .then(() => true)
      .catch(() => false);

    expect(screenshotsExists).toBe(true);
    expect(appshotExists).toBe(false);
    expect(finalExists).toBe(false);
    expect(gradientsExists).toBe(false);
  });
});
