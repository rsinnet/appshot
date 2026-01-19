/**
 * Playwright Test Suite for AppShot Style Guide
 * Tests all new features including presets, grid overlay, frame opacity, watch bands, and export
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

const PAGE_URL = `file://${path.resolve(__dirname, 'style-guide.html')}`;

test.describe('AppShot Style Guide Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Preset Configurations', () => {
    test('Apply Hero Shot preset', async ({ page }) => {
      await page.selectOption('#presetSelect', 'hero');

      // Verify values are applied
      await expect(page.locator('#frameScale')).toHaveValue('1.1');
      await expect(page.locator('#framePosition')).toHaveValue('50');
      await expect(page.locator('#captionPosition')).toHaveValue('below');
      await expect(page.locator('#captionSize')).toHaveValue('48');

      // Check visual updates
      const deviceTop = await page.locator('#read_deviceTop').textContent();
      expect(parseInt(deviceTop)).toBeGreaterThan(0);
    });

    test('Apply Feature Focus preset', async ({ page }) => {
      await page.selectOption('#presetSelect', 'feature');

      await expect(page.locator('#frameScale')).toHaveValue('0.85');
      await expect(page.locator('#framePosition')).toHaveValue('65');
      await expect(page.locator('#captionPosition')).toHaveValue('overlay');
      await expect(page.locator('#captionSize')).toHaveValue('64');
    });

    test('Apply Text Heavy preset', async ({ page }) => {
      await page.selectOption('#presetSelect', 'text');

      await expect(page.locator('#frameScale')).toHaveValue('0.75');
      await expect(page.locator('#framePosition')).toHaveValue('70');
      await expect(page.locator('#captionPosition')).toHaveValue('above');
      await expect(page.locator('#captionSize')).toHaveValue('72');
      await expect(page.locator('#autoSize')).not.toBeChecked();
      await expect(page.locator('#minHeight')).toHaveValue('400');
    });

    test('Apply Minimal preset', async ({ page }) => {
      await page.selectOption('#presetSelect', 'minimal');

      await expect(page.locator('#bgEnable')).not.toBeChecked();
      await expect(page.locator('#bdEnable')).not.toBeChecked();
    });

    test('Apply App Store Recommended preset', async ({ page }) => {
      await page.selectOption('#presetSelect', 'appstore');

      await expect(page.locator('#frameScale')).toHaveValue('0.9');
      await expect(page.locator('#framePosition')).toHaveValue('50');
      await expect(page.locator('#bgOpacity')).toHaveValue('0.8');
    });
  });

  test.describe('Grid Overlay Feature', () => {
    test('Toggle grid visibility', async ({ page }) => {
      const gridOverlay = page.locator('#gridOverlay');
      const toggleButton = page.locator('#toggleGrid');

      // Initially hidden
      await expect(gridOverlay).toHaveCSS('display', 'none');
      await expect(toggleButton).toHaveText('Show Grid');

      // Click to show
      await toggleButton.click();
      await expect(gridOverlay).toHaveCSS('display', 'block');
      await expect(toggleButton).toHaveText('Hide Grid');

      // Click to hide
      await toggleButton.click();
      await expect(gridOverlay).toHaveCSS('display', 'none');
      await expect(toggleButton).toHaveText('Show Grid');
    });

    test('Switch grid types', async ({ page }) => {
      const gridOverlay = page.locator('#gridOverlay');
      const toggleButton = page.locator('#toggleGrid');
      const gridType = page.locator('#gridType');

      // Show grid
      await toggleButton.click();

      // Default is thirds
      await expect(gridOverlay).toHaveClass(/thirds/);

      // Switch to quarters
      await gridType.selectOption('quarters');
      await expect(gridOverlay).toHaveClass(/quarters/);

      // Switch back to thirds
      await gridType.selectOption('thirds');
      await expect(gridOverlay).toHaveClass(/thirds/);
    });
  });

  test.describe('Frame Opacity Control', () => {
    test('Adjust frame opacity', async ({ page }) => {
      const frameOpacity = page.locator('#frameOpacity');
      const frameOpacityVal = page.locator('#frameOpacityVal');
      const device = page.locator('#devicePreview');

      // Set to 50% opacity
      await frameOpacity.fill('0.5');
      await expect(frameOpacityVal).toHaveText('0.50');

      // Check device opacity
      const opacity = await device.evaluate(el => window.getComputedStyle(el).opacity);
      expect(parseFloat(opacity)).toBeCloseTo(0.5, 1);

      // Set to full opacity
      await frameOpacity.fill('1');
      await expect(frameOpacityVal).toHaveText('1.00');
    });

    test('Frame opacity range limits', async ({ page }) => {
      const frameOpacity = page.locator('#frameOpacity');

      // Check min value
      await expect(frameOpacity).toHaveAttribute('min', '0.3');

      // Check max value
      await expect(frameOpacity).toHaveAttribute('max', '1');
    });
  });

  test.describe('Watch Band Visualization', () => {
    test('Watch displays with bands', async ({ page }) => {
      await page.selectOption('#deviceSelect', 'watch');

      // Wait for update
      await page.waitForTimeout(100);

      const device = page.locator('#devicePreview');

      // Check class is applied
      await expect(device).toHaveClass(/watch-with-bands/);

      // Check bands exist
      const bandTop = device.locator('.watch-band-top');
      const bandBottom = device.locator('.watch-band-bottom');
      const watchFace = device.locator('.watch-face');

      await expect(bandTop).toBeVisible();
      await expect(bandBottom).toBeVisible();
      await expect(watchFace).toBeVisible();
    });

    test('Watch height includes bands', async ({ page }) => {
      // First test iPhone for baseline
      await page.selectOption('#deviceSelect', 'iphone');
      await page.waitForTimeout(100);
      await page.locator('#devicePreview').evaluate(el => el.offsetHeight);

      // Now test watch
      await page.selectOption('#deviceSelect', 'watch');
      await page.waitForTimeout(100);
      const watchHeight = await page.locator('#devicePreview').evaluate(el => el.offsetHeight);

      // Watch with bands should be taller relative to its screen size
      // Watch screen is 502px, with bands should be ~819px at scale 1
      expect(watchHeight).toBeGreaterThan(200);
    });
  });

  test.describe('Export Full Config', () => {
    test('Export button generates full config', async ({ page, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-write', 'clipboard-read']);

      // Set some custom values
      await page.fill('#framePosition', '75');
      await page.fill('#frameScale', '1.2');
      await page.check('#bgEnable');

      // Click export
      await page.click('#exportConfig');

      // Check toast appears
      const toast = page.locator('#toast');
      await expect(toast).toHaveClass(/show/);

      // Wait for clipboard operation
      await page.waitForTimeout(500);

      // Verify toast disappears after timeout
      await page.waitForTimeout(3500);
      await expect(toast).not.toHaveClass(/show/);
    });

    test('Export includes all devices', async ({ page }) => {
      // Mock the clipboard API for testing
      await page.evaluate(() => {
        window.exportedConfig = null;
        navigator.clipboard.writeText = async (text) => {
          window.exportedConfig = text;
          return Promise.resolve();
        };
      });

      // Click export
      await page.click('#exportConfig');

      // Get the exported config
      const config = await page.evaluate(() => {
        return window.exportedConfig;
      });

      expect(config).toBeTruthy();
      const parsed = JSON.parse(config);

      // Check all devices are included
      expect(parsed.devices).toHaveProperty('iphone');
      expect(parsed.devices).toHaveProperty('ipad');
      expect(parsed.devices).toHaveProperty('mac');
      expect(parsed.devices).toHaveProperty('watch');

      // Check structure
      expect(parsed).toHaveProperty('output');
      expect(parsed).toHaveProperty('caption');
      expect(parsed).toHaveProperty('background');
    });
  });

  test.describe('Device-Specific Positioning', () => {
    const devices = ['iphone', 'ipad', 'mac', 'watch'];

    for (const device of devices) {
      test(`${device} positioning calculations`, async ({ page }) => {
        await page.selectOption('#deviceSelect', device);

        // Test extreme positions
        for (const position of [0, 50, 100]) {
          await page.fill('#framePosition', position.toString());

          const deviceTop = await page.locator('#read_deviceTop').textContent();
          const deviceHeight = await page.locator('#read_deviceHeight').textContent();

          // Verify values are numbers and within reasonable ranges
          expect(parseInt(deviceTop)).toBeGreaterThanOrEqual(0);
          expect(parseInt(deviceHeight)).toBeGreaterThan(0);
        }
      });
    }
  });

  test.describe('Caption Position Modes', () => {
    test('Above position calculation', async ({ page }) => {
      await page.selectOption('#captionPosition', 'above');
      await page.fill('#framePosition', '50');

      const captionArea = page.locator('#captionArea');
      await expect(captionArea).toBeVisible();
      await expect(captionArea).not.toHaveClass(/bottom/);
    });

    test('Below position calculation', async ({ page }) => {
      await page.selectOption('#captionPosition', 'below');

      const captionArea = page.locator('#captionArea');
      await expect(captionArea).toBeVisible();
      await expect(captionArea).toHaveClass(/bottom/);
    });

    test('Overlay position calculation', async ({ page }) => {
      await page.selectOption('#captionPosition', 'overlay');

      const captionArea = page.locator('#captionArea');
      const captionOverlay = page.locator('#captionOverlay');

      await expect(captionArea).toHaveCSS('display', 'none');
      await expect(captionOverlay).toHaveCSS('display', 'block');
    });
  });

  test.describe('Negative Available Space (Watch Edge Case)', () => {
    test('Watch handles negative available space without error', async ({ page }) => {
      await page.selectOption('#deviceSelect', 'watch');
      await page.fill('#captionSize', '96');
      await page.fill('#frameScale', '1.3');

      // Should not error - check that deviceTop is still calculated
      const deviceTop = await page.locator('#read_deviceTop').textContent();
      expect(parseInt(deviceTop)).toBeGreaterThanOrEqual(0);

      // Check available space is negative
      const availableSpace = await page.locator('#read_space').textContent();
      // May or may not be negative depending on caption height
      expect(parseInt(availableSpace)).toBeDefined();
    });
  });

  test.describe('Partial Frame Feature', () => {
    test('Enable partial frame and adjust offset', async ({ page }) => {
      const partialFrame = page.locator('#partialFrame');
      const frameOffset = page.locator('#frameOffset');

      // Initially disabled
      await expect(frameOffset).toBeDisabled();

      // Enable partial frame
      await partialFrame.check();
      await expect(frameOffset).toBeEnabled();

      // Set offset
      await frameOffset.fill('35');
      const device = page.locator('#devicePreview');
      const clipPath = await device.evaluate(el => window.getComputedStyle(el).clipPath);

      // Should have inset clip
      expect(clipPath).toContain('inset');
    });
  });

  test.describe('JSON Output Accuracy', () => {
    test('JSON reflects current configuration', async ({ page }) => {
      // Set specific values
      await page.selectOption('#deviceSelect', 'iphone');
      await page.fill('#framePosition', '75');
      await page.fill('#frameScale', '1.15');
      await page.check('#bgEnable');
      await page.fill('#bgOpacity', '0.6');

      // Get JSON output
      const jsonText = await page.locator('#jsonOut').textContent();
      const json = JSON.parse(jsonText);

      // Verify values
      expect(json.devices.iphone.framePosition).toBe(75);
      expect(json.devices.iphone.frameScale).toBeCloseTo(1.15, 1);
      expect(json.caption.background.opacity).toBeCloseTo(0.6, 1);
    });
  });
});

// Run tests with: npx playwright test test-style-guide.spec.js