import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import pc from 'picocolors';
import sharp from 'sharp';
import { loadConfig, loadCaptions } from '../core/files.js';
import { autoSelectFrame, getImageDimensions, initializeFrameRegistry } from '../core/devices.js';
import { composeAppStoreScreenshot, composeV2 } from '../core/compose.js';
import { resolveLanguages, normalizeLanguageCode } from '../utils/language.js';
import { filenameToCaption } from '../utils/filename-caption.js';
import type { AppshotConfig, AppshotConfigV2 } from '../types.js';
import { detectConfigVersion } from '../utils/config-version.js';
import { showV1DeprecationBanner } from '../utils/v2-banner.js';
import { Spinner } from '../utils/spinner.js';

export default function buildCmd() {
  const cmd = new Command('build')
    .description('Generate final screenshots with frames, gradients, and captions')
    .option('--devices <list>', 'comma-separated device list (e.g., iphone,ipad)', 'iphone,ipad,mac,watch,android')
    .option('--preset <ids>', 'use specific App Store presets (e.g., iphone-6-9,ipad-13)')
    .option('--config <file>', 'use specific config file', 'appshot.json')
    .option('--langs <list>', 'comma-separated language codes (e.g., en,fr,de)')
    .option('--preview', 'generate low-res preview images')
    .option('--concurrency <n>', 'number of parallel renders', '4')
    .option('--no-frame', 'skip device frames')
    .option('--no-gradient', 'skip gradient backgrounds')
    .option('--no-caption', 'skip captions')
    .option('--background <image>', 'use specific background image')
    .option('--no-background', 'disable background (transparent)')
    .option('--background-fit <mode>', 'background fit mode: cover, contain, fill, scale-down', 'cover')
    .option('--auto-background', 'auto-detect background.png in device folders')
    .option('--dry-run', 'show what would be rendered without generating images')
    .option('--verbose', 'show detailed rendering information')
    .option('--auto-caption', 'generate captions from filenames when none exist')
    .addHelpText('after', `
${pc.bold('Examples:')}
  ${pc.dim('# Build all devices')}
  $ appshot build
  
  ${pc.dim('# Build specific devices')}
  $ appshot build --devices iphone,ipad
  
  ${pc.dim('# Build for multiple languages')}
  $ appshot build --langs en,es,fr,de
  
  ${pc.dim('# Use App Store presets')}
  $ appshot build --preset iphone-6-9,ipad-13
  
  ${pc.dim('# Fast preview mode')}
  $ appshot build --preview --concurrency 8
  
  ${pc.dim('# Frames only (no gradient/caption)')}
  $ appshot build --no-gradient --no-caption
  
  ${pc.dim('# Use custom background image')}
  $ appshot build --background ./assets/sunset.jpg
  
  ${pc.dim('# Auto-detect background.png in device folders')}
  $ appshot build --auto-background
  
  ${pc.dim('# Preview what would be built')}
  $ appshot build --dry-run
  
  ${pc.dim('# Show detailed rendering info')}
  $ appshot build --verbose

  ${pc.dim('# Auto-generate captions from filenames')}
  $ appshot build --auto-caption

${pc.bold('Output:')}
  Screenshots are saved to: ${pc.cyan('final/[device]/[language]/')}

${pc.bold('v2 Layouts:')}
  Layout modes: header, footer, screenshot-only
  v1 configs are deprecated; run ${pc.cyan('appshot migrate')} to upgrade
  
${pc.bold('Language Detection:')}
  1. --langs parameter (if provided)
  2. Languages in caption files
  3. defaultLanguage in config.json
  4. System locale
  5. Fallback to 'en'`)
    .action(async (opts) => {
      let spinner: Spinner | null = null;
      let showSpinner = false;
      try {
        const logo = String.raw`     _                       _           _   
    / \   _ __  _ __  ___| |__   ___ | |_ 
   / _ \ | '_ \| '_ \/ __| '_ \ / _ \| __|
  / ___ \| |_) | |_) \__ \ | | | (_) | |_ 
 /_/   \_\ .__/| .__/|___/_| |_|\___/ \__|
         |_|   |_|                          `;

        if (opts.dryRun) {
          console.log(pc.cyan(logo));
          console.log(pc.bold('\nDry run mode - no images will be generated\n'));
        } else {
          console.log(pc.cyan(logo));
          console.log(pc.bold('\nBuilding screenshots...'));
        }

        // Load configuration
        const config = await loadConfig(opts.config);
        const configVersion = detectConfigVersion(config);
        const isV2 = configVersion === 2;
        if (configVersion === 1) {
          showV1DeprecationBanner();
          if (!opts.dryRun) {
            console.log(
              pc.yellow('\n⚠ Layout behavior notice (v0.9.0):') +
              pc.dim('\n  • "below/above" captions now enforce a minimum optical gap from the device, and will adjust placement to remain truly below/above.') +
              pc.dim('\n  • Overlay captions anchor to the bottom of their outer box (padding/border included); explicit zeros are respected.') +
              pc.dim('\n  • In edge cases where device + caption cannot both fit, the engine adapts placement; visuals may differ from 0.8.x.') +
              '\n'
            );
          }
        }

        const configV1 = config as AppshotConfig;
        const configV2 = config as AppshotConfigV2;
        const devices = opts.devices.split(',').map((d: string) => d.trim());
        const concurrency = parseInt(opts.concurrency, 10);

        // Initialize frame registry from Frames.json if available
        const framesDir = isV2 ? (configV2.frames || './frames') : configV1.frames;
        await initializeFrameRegistry(path.resolve(framesDir));

        // Ensure output directory exists
        const outputRoot = isV2 ? (configV2.output || './final') : configV1.output;
        await fs.mkdir(outputRoot, { recursive: true });

        showSpinner = !opts.verbose && !opts.dryRun && process.stdout.isTTY;
        spinner = new Spinner({ enabled: showSpinner });
        let totalProcessed = 0;
        let totalErrors = 0;
        let totalTasks = 0;

        // Process each device
        for (const device of devices) {
          const deviceEntry = isV2 ? configV2.devices[device] : configV1.devices[device];
          if (!deviceEntry) {
            console.log(pc.yellow('⚠'), `Device '${device}' not configured in appshot.json`);
            continue;
          }

          const deviceConfig = isV2 ? undefined : deviceEntry;
          const inputPath = isV2
            ? (typeof deviceEntry === 'string' ? deviceEntry : deviceEntry.input)
            : (deviceConfig as AppshotConfig['devices'][string]).input;
          const inputDir = path.resolve(inputPath);
          const outputDir = path.join(outputRoot, device);

          // Check if input directory exists
          try {
            await fs.access(inputDir);
          } catch {
            console.log(pc.yellow('⚠'), `Input directory not found: ${inputDir}`);
            continue;
          }

          // Create device output directory
          await fs.mkdir(outputDir, { recursive: true });

          // Get screenshots (excluding background images)
          const screenshots = (await fs.readdir(inputDir))
            .filter(f => f.match(/\.(png|jpg|jpeg)$/i))
            .filter(f => !f.match(/^background\.(png|jpg|jpeg)$/i))
            .sort();

          if (screenshots.length === 0) {
            console.log(pc.yellow('⚠'), `No screenshots found in ${inputDir}`);
            continue;
          }

          // Load captions from .appshot/captions/
          const captionsPath = path.join(process.cwd(), '.appshot', 'captions', `${device}.json`);
          const captions = await loadCaptions(captionsPath);

          // Resolve languages for this device
          const cliLangs = opts.langs ? opts.langs.split(',').map((l: string) => normalizeLanguageCode(l.trim())) : undefined;
          const { languages, source } = resolveLanguages(cliLangs, captions, config);

          console.log(pc.cyan(`\n${device}:`), `${opts.dryRun ? 'Would process' : 'Processing'} ${screenshots.length} screenshots`);
          if (!cliLangs) {
            console.log(pc.dim(`  Using language: ${languages.join(', ')} (from ${source})`));
          }
          totalTasks += screenshots.length * languages.length;
          if (showSpinner) {
            spinner?.update(`Preparing ${totalTasks} render(s)...`);
          }

          // Process each language
          for (const lang of languages) {
            // Always use language subdirectory
            const langDir = path.join(outputDir, lang);
            if (!opts.dryRun) {
              await fs.mkdir(langDir, { recursive: true });
            }

            // Process screenshots in batches
            for (let i = 0; i < screenshots.length; i += concurrency) {
              const batch = screenshots.slice(i, i + concurrency);
              const promises = batch.map(async (screenshot) => {
                try {
                  const inputPath = path.join(inputDir, screenshot);
                  const outputPath = path.join(langDir, screenshot);

                  // Get caption for this screenshot and language
                  const captionData = captions[screenshot];
                  let captionText = '';
                  if (typeof captionData === 'string') {
                    captionText = captionData;
                  } else if (captionData && typeof captionData === 'object') {
                    captionText = captionData[lang] || '';
                  }

                  // Fallback to auto-caption from filename
                  if (!captionText && opts.autoCaption) {
                    captionText = filenameToCaption(screenshot);
                  }

                  // Get screenshot dimensions and orientation
                  const { width: srcWidth, height: srcHeight, orientation } = await getImageDimensions(inputPath);

                  // In dry-run mode, skip loading the screenshot buffer
                  let screenshotBuffer: Buffer | undefined;
                  if (!opts.dryRun) {
                    try {
                      // First verify the file exists and is readable
                      await fs.access(inputPath, fs.constants.R_OK);

                      // Load the screenshot into a buffer
                      screenshotBuffer = await sharp(inputPath)
                        .png() // Ensure output is PNG
                        .toBuffer();
                    } catch (error) {
                      console.error(pc.red(`  ✗ ${path.basename(inputPath)}`), `Failed to load screenshot: ${error instanceof Error ? error.message : String(error)}`);
                      totalErrors++;
                      totalProcessed++;
                      if (showSpinner) {
                        spinner?.update(`Rendering ${totalProcessed}/${totalTasks} • ${device}/${lang} ${screenshot}`);
                      }
                      return;
                    }
                  }

                  const resolution = isV2
                    ? (typeof deviceEntry === 'string' ? undefined : deviceEntry.resolution)
                    : (deviceConfig as AppshotConfig['devices'][string]).resolution;

                  let outWidth: number;
                  let outHeight: number;

                  if (resolution) {
                    const [configWidth, configHeight] = resolution.split('x').map(Number);

                    if (orientation === 'portrait') {
                      outWidth = Math.min(configWidth, configHeight);
                      outHeight = Math.max(configWidth, configHeight);
                    } else {
                      outWidth = Math.max(configWidth, configHeight);
                      outHeight = Math.min(configWidth, configHeight);
                    }

                    const configOrientation = configWidth > configHeight ? 'landscape' : 'portrait';
                    if (configOrientation !== orientation) {
                      console.log(pc.yellow('    ⚠'), pc.dim(`Config specifies ${configOrientation} (${resolution}) but screenshot is ${orientation} - auto-adjusting`));
                    }
                  } else {
                    outWidth = srcWidth;
                    outHeight = srcHeight;
                  }

                  // Auto-select frame if enabled
                  let frame = null;
                  let frameMetadata = null;
                  let frameUsed = false;

                  // Load frame if not disabled via CLI
                  if (opts.frame !== false) {
                    // If autoFrame is disabled but preferredFrame is set, use the preferred frame
                    // Otherwise, auto-select a frame
                    const result = await autoSelectFrame(
                      inputPath,
                      path.resolve(framesDir),
                      device as 'iphone' | 'ipad' | 'mac' | 'watch' | 'android',
                      isV2 ? undefined : (deviceConfig as AppshotConfig['devices'][string]).preferredFrame,
                      opts.dryRun // Pass dry-run flag
                    );

                    frame = result.frame;
                    frameMetadata = result.metadata;

                    if (frameMetadata) {
                      frameUsed = true;
                      if (opts.verbose || opts.dryRun) {
                        console.log(pc.dim(`    ${opts.dryRun ? 'Would use' : 'Using'} ${frameMetadata.displayName} ${orientation} frame`));
                      }
                    } else if (!opts.dryRun && frameMetadata && !frame) {
                      console.error(pc.red('    ERROR: Frame metadata found but image failed to load!'));
                    }
                  }

                  // Handle dry-run vs actual rendering
                  if (opts.dryRun) {
                    // Dry-run output
                    console.log(pc.cyan(`  ${screenshot}`) + pc.dim(` → ${lang}`));

                    // Show source dimensions
                    console.log(pc.dim(`    Source: ${srcWidth}x${srcHeight} (${orientation})`));

                    // Show frame info
                    if (frameMetadata) {
                      console.log(pc.dim(`    Frame: ${frameMetadata.displayName} (${frameMetadata.frameWidth}x${frameMetadata.frameHeight})`));
                    } else if (opts.frame !== false) {
                      console.log(pc.dim('    Frame: No matching frame found'));
                    }

                    // Show caption info
                    if (captionText && opts.caption !== false) {
                      const lines = captionText.split('\n').length;
                      console.log(pc.dim(`    Caption: "${captionText.substring(0, 50)}${captionText.length > 50 ? '...' : ''}" (${captionText.length} chars, ${lines} line${lines > 1 ? 's' : ''})`));

                      // Show font info
                      const fontName = isV2
                        ? configV2.caption.font
                        : (deviceConfig as AppshotConfig['devices'][string]).captionFont || configV1.caption.font;
                      console.log(pc.dim(`    Font: ${fontName}`));
                    }

                    // Show output info
                    console.log(pc.dim(`    Output: ${outWidth}x${outHeight} → ${outputPath}`));
                    if (isV2) {
                      const hasCaption = typeof captionText === 'string' && captionText.trim().length > 0 && opts.caption !== false;
                      const effectiveLayout = hasCaption ? configV2.layout : 'screenshot-only';
                      console.log(pc.dim(`    Layout: ${effectiveLayout}`));
                      if (!hasCaption && configV2.layout !== 'screenshot-only') {
                        console.log(pc.dim('    Layout override: no caption → screenshot-only'));
                      }
                    }

                    totalProcessed++;
                  } else {
                    // Actual rendering
                    let image: Buffer;
                    try {
                      // Configure background
                      let backgroundConfig = isV2 ? configV2.background : configV1.background;

                      // Override with command line options
                      if (opts.background) {
                        backgroundConfig = {
                          mode: 'image',
                          image: opts.background,
                          fit: opts.backgroundFit || 'cover',
                          warnOnMismatch: true
                        };
                      } else if (opts.autoBackground) {
                        backgroundConfig = {
                          mode: 'auto',
                          fit: opts.backgroundFit || 'cover',
                          warnOnMismatch: true
                        };
                      } else if (opts.noBackground) {
                        backgroundConfig = undefined;
                      }

                      if (isV2) {
                        image = await composeV2({
                          screenshot: screenshotBuffer!,
                          frame: frame,
                          frameMetadata: frameMetadata ? {
                            frameWidth: frameMetadata.frameWidth,
                            frameHeight: frameMetadata.frameHeight,
                            screenRect: frameMetadata.screenRect,
                            maskPath: frameMetadata.maskPath,
                            deviceType: frameMetadata.deviceType,
                            displayName: frameMetadata.displayName,
                            name: frameMetadata.name
                          } : undefined,
                          caption: opts.caption !== false ? captionText : undefined,
                          captionConfig: configV2.caption,
                          backgroundConfig: backgroundConfig,
                          outputWidth: outWidth,
                          outputHeight: outHeight,
                          layout: configV2.layout,
                          deviceType: device as 'iphone' | 'ipad' | 'mac' | 'watch' | 'android',
                          deviceInputPath: inputDir,
                          verbose: opts.verbose
                        });
                      } else {
                        image = await composeAppStoreScreenshot({
                          screenshot: screenshotBuffer!,
                          frame: frame,
                          frameMetadata: frameMetadata ? {
                            frameWidth: frameMetadata.frameWidth,
                            frameHeight: frameMetadata.frameHeight,
                            screenRect: frameMetadata.screenRect,
                            maskPath: frameMetadata.maskPath,
                            deviceType: frameMetadata.deviceType,
                            displayName: frameMetadata.displayName,
                            name: frameMetadata.name
                          } : undefined,
                          caption: opts.caption !== false ? captionText : undefined,
                          captionConfig: configV1.caption,
                          gradientConfig: opts.gradient === false ? undefined : configV1.gradient,
                          backgroundConfig: backgroundConfig,
                          deviceConfig: deviceConfig as AppshotConfig['devices'][string],
                          outputWidth: outWidth,
                          outputHeight: outHeight,
                          verbose: opts.verbose
                        });
                      }
                    } catch (error) {
                      console.error(pc.red(`  ✗ ${path.basename(inputPath)}`), error instanceof Error ? error.message : String(error));
                      totalErrors++;
                      totalProcessed++;
                      if (showSpinner) {
                        spinner?.update(`Rendering ${totalProcessed}/${totalTasks} • ${device}/${lang} ${screenshot}`);
                      }
                      return;
                    }

                    // Save final image
                    await sharp(image)
                      .resize(opts.preview ? 800 : undefined, undefined, {
                        fit: 'inside',
                        withoutEnlargement: true
                      })
                      .png()  // Ensure output is PNG
                      .toFile(outputPath);

                    if (!showSpinner) {
                      console.log(pc.green('  ✓'), path.basename(outputPath),
                        pc.dim(`[${orientation}${frameUsed ? ', framed' : ''}${captionText ? ', captioned' : ''}]`));
                    }
                    totalProcessed++;
                    if (showSpinner) {
                      spinner?.update(`Rendering ${totalProcessed}/${totalTasks} • ${device}/${lang} ${screenshot}`);
                    }
                  }
                } catch (error) {
                  console.log(pc.red('  ✗'), screenshot, pc.dim(error instanceof Error ? error.message : String(error)));
                  totalErrors++;
                  totalProcessed++;
                  if (showSpinner) {
                    spinner?.update(`Rendering ${totalProcessed}/${totalTasks} • ${device}/${lang} ${screenshot}`);
                  }
                }
              });

              await Promise.all(promises);
            }
          }
        }

        if (showSpinner) {
          if (totalErrors > 0) {
            spinner?.fail(`Rendered ${totalProcessed} image(s) with ${totalErrors} error(s)`);
          } else {
            spinner?.succeed(`Rendered ${totalProcessed} image(s)`);
          }
        }

        // Summary
        if (opts.dryRun) {
          console.log('\n' + pc.bold('Dry run complete!'));
          console.log(pc.cyan(`→ ${totalProcessed} screenshots would be generated`));
        } else {
          console.log('\n' + pc.bold('Build complete!'));
          console.log(pc.green(`✓ ${totalProcessed} screenshots processed`));
          if (totalErrors > 0) {
            console.log(pc.red(`✗ ${totalErrors} errors`));
          }
          console.log(pc.dim(`Output directory: ${outputRoot}`));
        }

      } catch (error) {
        if (showSpinner) {
          spinner?.fail('Build failed');
        }
        console.error(pc.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return cmd;
}
