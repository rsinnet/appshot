import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import pc from 'picocolors';
import { select, input } from '@inquirer/prompts';
import sharp from 'sharp';
import { validateBackgroundDimensions, detectBestFit } from '../core/background.js';
import { loadConfig, saveConfig } from '../core/files.js';
import { isV2Config } from '../utils/config-version.js';
import type { AppshotConfig } from '../types.js';

export default function backgroundsCommand(): Command {
  const cmd = new Command('backgrounds')
    .description('Manage background images for screenshots')
    .addHelpText('after', `
${pc.bold('Examples:')}
  $ appshot backgrounds set iphone ./backgrounds/sunset.jpg
  $ appshot backgrounds validate
  $ appshot backgrounds preview
  $ appshot backgrounds clear iphone
  $ appshot backgrounds list

${pc.bold('Background Locations:')}
  Device-specific:  screenshots/<device>/background.png
  Global:          screenshots/background.png
  Custom:          Specified via config or command

${pc.bold('Fit Modes:')}
  cover      Scale to cover entire area (may crop)
  contain    Scale to fit within area (may add bars)
  fill       Stretch to exact dimensions (may distort)
  scale-down Only scale down if larger, never scale up

${pc.bold('v2 vs v1:')}
  v2 configs only support a global background.
  Per-device backgrounds are legacy and only apply to v1 configs.
`);

  // Set background for a device
  cmd
    .command('set')
    .description('Set background image for a device')
    .argument('[device]', 'Device type (iphone, ipad, mac, watch)')
    .argument('[image]', 'Path to background image')
    .option('-f, --fit <mode>', 'Fit mode: cover, contain, fill, scale-down', 'cover')
    .option('--global', 'Set as global background for all devices')
    .action(async (device, image, options) => {
      try {
        // Interactive mode if arguments not provided
        if (!device && !options.global) {
          device = await select({
            message: 'Select device type:',
            choices: [
              { name: 'iPhone', value: 'iphone' },
              { name: 'iPad', value: 'ipad' },
              { name: 'Mac', value: 'mac' },
              { name: 'Watch', value: 'watch' },
              { name: 'All Devices (Global)', value: 'global' }
            ]
          });

          if (device === 'global') {
            options.global = true;
            device = undefined;
          }
        }

        if (!image) {
          image = await input({
            message: 'Enter path to background image:',
            validate: async (value) => {
              try {
                await fs.access(value);
                return true;
              } catch {
                return 'File not found';
              }
            }
          });
        }

        // Validate image exists
        try {
          await fs.access(image);
        } catch {
          console.error(pc.red(`❌ Background image not found: ${image}`));
          process.exit(1);
        }

        // Load config
        const config = await loadConfig();
        if (isV2Config(config)) {
          if (!options.global && device) {
            console.log(pc.yellow('Per-device backgrounds are not supported in v2. Use --global or omit the device.'));
            return;
          }

          config.background = config.background ?? { mode: 'image', warnOnMismatch: true };
          config.background.mode = 'image';
          config.background.image = image;
          config.background.fit = options.fit;
          await saveConfig(config);
          console.log(pc.green(`✅ Set global background: ${image}`));
          return;
        }

        // Initialize background config if not exists
        if (!config.background) {
          config.background = {
            mode: 'image',
            warnOnMismatch: true
          };
        }

        // Set background
        if (options.global) {
          config.background.image = image;
          config.background.fit = options.fit;
          console.log(pc.green(`✅ Set global background: ${image}`));
        } else {
          // Device-specific background
          if (!config.devices[device]) {
            console.error(pc.red(`❌ Device '${device}' not found in config`));
            console.log(pc.dim(`Available devices: ${Object.keys(config.devices).join(', ')}`));
            process.exit(1);
          }

          if (!config.devices[device].background) {
            config.devices[device].background = {};
          }

          config.devices[device].background!.image = image;
          config.devices[device].background!.fit = options.fit;

          console.log(pc.green(`✅ Set ${device} background: ${image}`));
        }

        // Save config
        await saveConfig(config);
        console.log(pc.dim('Configuration saved'));

      } catch (error) {
        console.error(pc.red('Error setting background:'), error);
        process.exit(1);
      }
    });

  // Validate backgrounds
  cmd
    .command('validate')
    .description('Validate background dimensions against App Store specs')
    .option('-d, --device <type>', 'Validate specific device only')
    .action(async (options) => {
      try {
        const config = await loadConfig();
        if (isV2Config(config)) {
          const devices = options.device
            ? [options.device]
            : Object.keys(config.devices);

          console.log(pc.bold('\n📐 Validating background dimensions (v2)...\n'));

          let hasWarnings = false;

          for (const device of devices) {
            const deviceEntry = config.devices[device];
            if (!deviceEntry) continue;

            const inputDir = typeof deviceEntry === 'string' ? deviceEntry : deviceEntry.input;
            const resolution = typeof deviceEntry === 'object' ? deviceEntry.resolution : undefined;

            let backgroundPath: string | null = null;
            if (config.background?.image) {
              backgroundPath = config.background.image;
            } else {
              const candidates = [
                path.join(inputDir, 'background.png'),
                path.join(inputDir, 'background.jpg'),
                path.join(inputDir, 'background.jpeg'),
                path.join('screenshots', 'background.png'),
                path.join('screenshots', 'background.jpg'),
                path.join('screenshots', 'background.jpeg')
              ];

              for (const candidate of candidates) {
                try {
                  await fs.access(candidate);
                  backgroundPath = candidate;
                  break;
                } catch {
                  // Continue checking
                }
              }
            }

            if (!backgroundPath) {
              console.log(pc.dim(`${device}: No background image found`));
              continue;
            }

            const inputPath = path.resolve(inputDir);
            let files: string[] = [];
            try {
              files = await fs.readdir(inputPath);
            } catch {
              console.log(pc.yellow(`${device}: Input directory not found: ${inputDir}`));
              continue;
            }

            const screenshots = files.filter(f => f.match(/\.(png|jpg|jpeg)$/i));
            if (screenshots.length === 0) {
              console.log(pc.dim(`${device}: No screenshots found`));
              continue;
            }

            for (const screenshot of screenshots) {
              const screenshotPath = path.join(inputPath, screenshot);
              const metadata = await sharp(screenshotPath).metadata();
              if (!metadata.width || !metadata.height) {
                console.log(pc.yellow(`${device}: Unable to read ${screenshot}`));
                continue;
              }

              const orientation = metadata.width > metadata.height ? 'landscape' : 'portrait';
              let targetWidth = metadata.width;
              let targetHeight = metadata.height;

              if (resolution) {
                const [configWidth, configHeight] = resolution.split('x').map(Number);
                if (orientation === 'portrait') {
                  targetWidth = Math.min(configWidth, configHeight);
                  targetHeight = Math.max(configWidth, configHeight);
                } else {
                  targetWidth = Math.max(configWidth, configHeight);
                  targetHeight = Math.min(configWidth, configHeight);
                }
              }

              const validation = await validateBackgroundDimensions(
                backgroundPath,
                targetWidth,
                targetHeight
              );

              console.log(pc.cyan(`${device}: ${screenshot}`));
              console.log(pc.dim(`  Background: ${backgroundPath}`));
              console.log(pc.dim(`  Source: ${validation.dimensions.source.width}x${validation.dimensions.source.height}`));
              console.log(pc.dim(`  Target: ${validation.dimensions.target.width}x${validation.dimensions.target.height}`));

              if (validation.warnings.length > 0) {
                hasWarnings = true;
                validation.warnings.forEach(warning => {
                  console.log(pc.yellow(`  ⚠️  ${warning}`));
                });

                const bestFit = detectBestFit(
                  validation.dimensions.source.width,
                  validation.dimensions.source.height,
                  validation.dimensions.target.width,
                  validation.dimensions.target.height
                );
                console.log(pc.cyan(`  💡 Suggested fit mode: ${bestFit}`));
              } else {
                console.log(pc.green('  ✅ Dimensions OK'));
              }

              console.log();
            }
          }

          if (hasWarnings) {
            console.log(pc.yellow('⚠️  Some backgrounds have dimension warnings'));
            console.log(pc.dim('Run "appshot backgrounds set" to adjust fit modes'));
          } else {
            console.log(pc.green('✅ All backgrounds validated successfully'));
          }
          return;
        }
        const v1Config = config as AppshotConfig;
        let hasWarnings = false;

        // Get devices to validate
        const devices = options.device
          ? [options.device]
          : Object.keys(v1Config.devices);

        console.log(pc.bold('\n📐 Validating background dimensions...\n'));

        for (const device of devices) {
          const deviceConfig = v1Config.devices[device];
          if (!deviceConfig) continue;

          // Find background image
          let backgroundPath: string | null = null;

          if (deviceConfig.background?.image) {
            backgroundPath = deviceConfig.background.image;
          } else if (v1Config.background?.image) {
            backgroundPath = v1Config.background.image;
          } else {
            // Check for auto-detected background
            const candidates = [
              path.join(deviceConfig.input, 'background.png'),
              path.join(deviceConfig.input, 'background.jpg'),
              path.join('screenshots', 'background.png'),
              path.join('screenshots', 'background.jpg')
            ];

            for (const candidate of candidates) {
              try {
                await fs.access(candidate);
                backgroundPath = candidate;
                break;
              } catch {
                // Continue checking
              }
            }
          }

          if (!backgroundPath) {
            console.log(pc.dim(`${device}: No background image found`));
            continue;
          }

          // Get target dimensions
          const [width, height] = deviceConfig.resolution.split('x').map(Number);

          // Validate
          const validation = await validateBackgroundDimensions(
            backgroundPath,
            width,
            height
          );

          // Display results
          console.log(pc.cyan(`${device}:`));
          console.log(pc.dim(`  Background: ${backgroundPath}`));
          console.log(pc.dim(`  Source: ${validation.dimensions.source.width}x${validation.dimensions.source.height}`));
          console.log(pc.dim(`  Target: ${validation.dimensions.target.width}x${validation.dimensions.target.height}`));

          if (validation.warnings.length > 0) {
            hasWarnings = true;
            validation.warnings.forEach(warning => {
              console.log(pc.yellow(`  ⚠️  ${warning}`));
            });

            // Suggest best fit mode
            const bestFit = detectBestFit(
              validation.dimensions.source.width,
              validation.dimensions.source.height,
              validation.dimensions.target.width,
              validation.dimensions.target.height
            );
            console.log(pc.cyan(`  💡 Suggested fit mode: ${bestFit}`));
          } else {
            console.log(pc.green('  ✅ Dimensions OK'));
          }

          console.log();
        }

        if (hasWarnings) {
          console.log(pc.yellow('⚠️  Some backgrounds have dimension warnings'));
          console.log(pc.dim('Run "appshot backgrounds set" to adjust fit modes'));
        } else {
          console.log(pc.green('✅ All backgrounds validated successfully'));
        }

      } catch (error) {
        console.error(pc.red('Error validating backgrounds:'), error);
        process.exit(1);
      }
    });

  // Preview backgrounds
  cmd
    .command('preview')
    .description('Generate preview of screenshots with backgrounds')
    .option('-d, --device <type>', 'Preview specific device only')
    .option('-o, --output <dir>', 'Output directory', './preview')
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const outputDir = options.output;

        // Create output directory
        await fs.mkdir(outputDir, { recursive: true });

        console.log(pc.bold('\n🎨 Generating background previews...\n'));

        // This would integrate with the compose system
        // For now, just show what would be generated
        const devices = options.device
          ? [options.device]
          : Object.keys(config.devices);

        for (const device of devices) {
          console.log(pc.cyan(`${device}:`));
          if (isV2Config(config)) {
            const deviceEntry = config.devices[device];
            const inputDir = typeof deviceEntry === 'string' ? deviceEntry : deviceEntry?.input;
            console.log(pc.dim(`  Input: ${inputDir || 'unknown'}`));
          }
          console.log(pc.dim(`  Would generate preview in ${outputDir}/${device}/`));
        }

        console.log(pc.dim('\nNote: Full preview generation requires running "appshot build --preview"'));

      } catch (error) {
        console.error(pc.red('Error generating preview:'), error);
        process.exit(1);
      }
    });

  // Clear background
  cmd
    .command('clear')
    .description('Remove background configuration')
    .argument('[device]', 'Device type to clear (or "all" for global)')
    .action(async (device) => {
      try {
        if (!device) {
          device = await select({
            message: 'Clear background for:',
            choices: [
              { name: 'iPhone', value: 'iphone' },
              { name: 'iPad', value: 'ipad' },
              { name: 'Mac', value: 'mac' },
              { name: 'Watch', value: 'watch' },
              { name: 'All Devices (Global)', value: 'all' }
            ]
          });
        }

        const config = await loadConfig();
        if (isV2Config(config)) {
          if (device !== 'all') {
            console.log(pc.yellow('Per-device backgrounds are not supported in v2. Use "all" to clear global background.'));
            return;
          }

          if (config.background) {
            delete config.background.image;
            console.log(pc.green('✅ Cleared global background'));
          }

          await saveConfig(config);
          console.log(pc.dim('Configuration saved'));
          return;
        }

        if (device === 'all') {
          // Clear global background
          if (config.background) {
            delete config.background.image;
            console.log(pc.green('✅ Cleared global background'));
          }
        } else {
          // Clear device-specific background
          if (config.devices[device]?.background) {
            delete config.devices[device].background!.image;
            console.log(pc.green(`✅ Cleared ${device} background`));
          }
        }

        await saveConfig(config);
        console.log(pc.dim('Configuration saved'));

      } catch (error) {
        console.error(pc.red('Error clearing background:'), error);
        process.exit(1);
      }
    });

  // List backgrounds
  cmd
    .command('list')
    .description('List configured backgrounds')
    .action(async () => {
      try {
        const config = await loadConfig();
        if (isV2Config(config)) {
          console.log(pc.bold('\n📋 Configured Backgrounds (v2):\n'));
          if (config.background?.image) {
            console.log(pc.cyan('Global:'));
            console.log(pc.dim(`  Image: ${config.background.image}`));
            console.log(pc.dim(`  Fit: ${config.background.fit || 'cover'}`));
          } else {
            console.log(pc.dim('  No global background configured.'));
          }
          console.log(pc.dim('\nPer-device backgrounds are not supported in v2.'));
          return;
        }

        const v1Config = config as AppshotConfig;

        console.log(pc.bold('\n📋 Configured Backgrounds:\n'));

        // Global background
        if (v1Config.background?.image) {
          console.log(pc.cyan('Global:'));
          console.log(pc.dim(`  Image: ${v1Config.background.image}`));
          console.log(pc.dim(`  Fit: ${v1Config.background.fit || 'cover'}`));
          console.log();
        }

        // Device-specific backgrounds
        for (const [device, deviceConfig] of Object.entries(v1Config.devices)) {
          if (deviceConfig.background?.image) {
            console.log(pc.cyan(`${device}:`));
            console.log(pc.dim(`  Image: ${deviceConfig.background.image}`));
            console.log(pc.dim(`  Fit: ${deviceConfig.background.fit || 'cover'}`));
            console.log();
          }
        }

        // Auto-detected backgrounds
        console.log(pc.bold('Auto-detected backgrounds:'));
        for (const [device, deviceConfig] of Object.entries(v1Config.devices)) {
          const candidates = [
            path.join(deviceConfig.input, 'background.png'),
            path.join(deviceConfig.input, 'background.jpg')
          ];

          for (const candidate of candidates) {
            try {
              await fs.access(candidate);
              console.log(pc.dim(`  ${device}: ${candidate}`));
              break;
            } catch {
              // Not found
            }
          }
        }

      } catch (error) {
        console.error(pc.red('Error listing backgrounds:'), error);
        process.exit(1);
      }
    });

  return cmd;
}
