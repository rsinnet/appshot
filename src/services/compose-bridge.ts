import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import pc from 'picocolors';
import { UnifiedDevice } from '../types/device.js';
import { composeAppStoreScreenshot, composeFrameOnly, composeV2 } from '../core/compose.js';
import { frameRegistry, findBestFrame } from '../core/devices.js';
import { loadCaptions } from '../core/files.js';
import { AppshotConfig, AppshotConfigV2 } from '../types.js';
import { isV2Config } from '../utils/config-version.js';

export interface ProcessOptions {
  frameOnly?: boolean;
  skipFrame?: boolean;
  skipGradient?: boolean;
  skipCaption?: boolean;
  outputPath?: string;
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface ProcessResult {
  inputPath: string;
  outputPath: string;
  device: UnifiedDevice;
  dimensions: { width: number; height: number };
  frameUsed?: string;
  success: boolean;
  error?: string;
}

export class ComposeBridge {
  constructor(private config: AppshotConfig | AppshotConfigV2) {}

  async processDeviceScreenshot(options: {
    screenshotPath: string;
    device: UnifiedDevice;
    processOptions?: ProcessOptions;
  }): Promise<ProcessResult> {
    const { screenshotPath, device, processOptions = {} } = options;

    try {
      // 1. Load screenshot and get metadata
      const screenshotBuffer = await fs.readFile(screenshotPath);
      const metadata = await sharp(screenshotBuffer).metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to determine screenshot dimensions');
      }

      const dimensions = {
        width: metadata.width,
        height: metadata.height
      };

      // 2. Determine if portrait or landscape
      const isPortrait = dimensions.height > dimensions.width;

      // 3. Find best matching frame
      const frameKey = this.findFrameKey(device, dimensions, isPortrait);

      if (!frameKey && !processOptions.skipFrame) {
        console.warn(pc.yellow(`⚠️  No frame found for ${device.name} (${dimensions.width}x${dimensions.height})`));
      }

      const isV2 = isV2Config(this.config);
      const deviceEntry = this.config.devices?.[device.category];
      const deviceConfig = !isV2 ? (this.config as AppshotConfig).devices?.[device.category] || {} : undefined;
      const deviceInputPath = isV2
        ? (typeof deviceEntry === 'string' ? deviceEntry : deviceEntry?.input)
        : (deviceConfig as any)?.input;

      // 5. Get captions if needed
      let caption = '';
      if (!processOptions.skipCaption) {
        const captions = await this.loadDeviceCaptions(device.category);
        const screenshotName = path.basename(screenshotPath, path.extname(screenshotPath));
        caption = captions[`${screenshotName}.png`] || captions[screenshotName] || '';
      }

      // 6. Process based on options
      let processedBuffer: Buffer;

      if (processOptions.frameOnly && frameKey) {
        // Frame only mode (no gradient/caption)
        const frame = await this.loadFrame(frameKey);
        if (frame) {
          processedBuffer = await composeFrameOnly({
            screenshot: screenshotBuffer,
            frame,
            frameMetadata: this.getFrameMetadata(frameKey)!,
            outputFormat: 'png'
          });
        } else {
          // No frame available, return original
          processedBuffer = screenshotBuffer;
        }
      } else {
        // Full processing with background and caption
        let outputWidth: number;
        let outputHeight: number;

        if (isV2) {
          const resolution = typeof deviceEntry === 'object' ? deviceEntry?.resolution : undefined;
          if (resolution) {
            const [configWidth, configHeight] = resolution.split('x').map(Number);
            if (isPortrait) {
              outputWidth = Math.min(configWidth, configHeight);
              outputHeight = Math.max(configWidth, configHeight);
            } else {
              outputWidth = Math.max(configWidth, configHeight);
              outputHeight = Math.min(configWidth, configHeight);
            }
          } else {
            outputWidth = dimensions.width;
            outputHeight = dimensions.height;
          }

          const v2Config = this.config as AppshotConfigV2;
          processedBuffer = await composeV2({
            screenshot: screenshotBuffer,
            frame: frameKey ? await this.loadFrame(frameKey) : null,
            frameMetadata: frameKey ? this.getFrameMetadata(frameKey) : undefined,
            caption,
            captionConfig: v2Config.caption,
            backgroundConfig: v2Config.background,
            outputWidth,
            outputHeight,
            layout: v2Config.layout,
            deviceType: device.category as 'iphone' | 'ipad' | 'mac' | 'watch' | 'android',
            deviceInputPath
          });
        } else {
          // Determine output dimensions based on device or use defaults
          outputWidth = device.resolution ? parseInt(device.resolution.split('x')[0]) : 1290;
          outputHeight = device.resolution ? parseInt(device.resolution.split('x')[1]) : 2796;

          const v1Config = this.config as AppshotConfig;
          const resolvedDeviceConfig = deviceConfig || ({} as AppshotConfig['devices'][string]);
          processedBuffer = await composeAppStoreScreenshot({
            screenshot: screenshotBuffer,
            frame: frameKey ? await this.loadFrame(frameKey) : null,
            frameMetadata: frameKey ? this.getFrameMetadata(frameKey) : undefined,
            caption,
            captionConfig: v1Config.caption || {},
            gradientConfig: v1Config.gradient || {
              colors: ['#000000', '#333333'],
              direction: 'top-bottom'
            },
            deviceConfig: resolvedDeviceConfig,
            outputWidth,
            outputHeight
          });
        }
      }

      // 7. Determine output path
      const outputPath = processOptions.outputPath || this.getDefaultOutputPath(screenshotPath, device);

      // 8. Ensure output directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // 9. Save processed screenshot
      if (processOptions.format === 'jpeg' && processOptions.quality) {
        processedBuffer = await sharp(processedBuffer)
          .jpeg({ quality: processOptions.quality })
          .toBuffer();
      }

      await fs.writeFile(outputPath, processedBuffer);

      return {
        inputPath: screenshotPath,
        outputPath,
        device,
        dimensions,
        frameUsed: frameKey || undefined,
        success: true
      };
    } catch (error) {
      console.error(pc.red(`❌ Failed to process screenshot: ${error}`));

      return {
        inputPath: screenshotPath,
        outputPath: '',
        device,
        dimensions: { width: 0, height: 0 },
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async processBatch(screenshots: Array<{
    path: string;
    device: UnifiedDevice;
  }>, processOptions?: ProcessOptions): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];

    console.log(pc.cyan(`\n🎨 Processing ${screenshots.length} screenshots...\n`));

    for (const [index, screenshot] of screenshots.entries()) {
      console.log(pc.dim(`[${index + 1}/${screenshots.length}]`) + ` Processing ${path.basename(screenshot.path)}...`);

      const result = await this.processDeviceScreenshot({
        screenshotPath: screenshot.path,
        device: screenshot.device,
        processOptions
      });

      if (result.success) {
        console.log(pc.green(`  ✅ Saved to: ${result.outputPath}`));
      } else {
        console.log(pc.red(`  ❌ Failed: ${result.error}`));
      }

      results.push(result);
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    console.log(pc.cyan('\n📊 Processing Summary:'));
    console.log(pc.green(`  ✅ Successful: ${successful}`));
    if (failed > 0) {
      console.log(pc.red(`  ❌ Failed: ${failed}`));
    }

    return results;
  }

  private findFrameKey(device: UnifiedDevice, dimensions: { width: number; height: number }, _isPortrait: boolean): string | null {
    // Use findBestFrame which returns a DeviceFrame
    const deviceType = device.category === 'iphone' || device.category === 'ipad' ||
                      device.category === 'mac' || device.category === 'watch'
      ? device.category
      : 'iphone'; // Default to iphone for unsupported types

    const bestFrame = findBestFrame(dimensions.width, dimensions.height, deviceType);

    if (!bestFrame) return null;

    // Find the key for this frame in the registry
    for (const [key, frame] of Object.entries(frameRegistry)) {
      if (frame === bestFrame) {
        return key;
      }
    }

    return null;
  }

  private async loadFrame(frameKey: string): Promise<Buffer | null> {
    try {
      const frame = (frameRegistry as any)[frameKey];
      if (!frame) return null;

      const framePath = path.join(process.cwd(), 'frames', frame.file);
      return await fs.readFile(framePath);
    } catch {
      console.warn(pc.yellow(`⚠️  Failed to load frame: ${frameKey}`));
      return null;
    }
  }

  private getFrameMetadata(frameKey: string) {
    const frame = (frameRegistry as any)[frameKey];
    if (!frame) return undefined;

    return {
      frameWidth: frame.frameWidth,
      frameHeight: frame.frameHeight,
      screenRect: frame.screenRect,
      deviceType: frame.deviceType,
      displayName: frame.displayName
    };
  }

  private async loadDeviceCaptions(deviceCategory: string): Promise<Record<string, string>> {
    try {
      const captions = await loadCaptions(deviceCategory);
      // Convert to simple string record
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(captions)) {
        if (typeof value === 'string') {
          result[key] = value;
        } else if (value && typeof value === 'object' && 'en' in value) {
          result[key] = (value as any).en || '';
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  private getDefaultOutputPath(inputPath: string, _device: UnifiedDevice): string {
    // Transform screenshots/device/file.png to final/device/file.png
    const dir = path.dirname(inputPath);
    const filename = path.basename(inputPath);

    const finalDir = dir.replace('/screenshots/', '/final/');
    return path.join(finalDir, filename);
  }

  async validateDimensions(device: UnifiedDevice, dimensions: { width: number; height: number }): Promise<boolean> {
    // Check if dimensions match App Store requirements
    if (!device.resolution) return true;

    const [expectedWidth, expectedHeight] = device.resolution.split('x').map(Number);

    // Allow either orientation
    const matchesPortrait = dimensions.width === expectedWidth && dimensions.height === expectedHeight;
    const matchesLandscape = dimensions.width === expectedHeight && dimensions.height === expectedWidth;

    return matchesPortrait || matchesLandscape;
  }
}

export function createComposeBridge(config: AppshotConfig | AppshotConfigV2): ComposeBridge {
  return new ComposeBridge(config);
}
