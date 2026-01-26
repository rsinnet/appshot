import { Command } from 'commander';
import autocomplete from 'inquirer-autocomplete-standalone';
import { select } from '@inquirer/prompts';
import fuzzy from 'fuzzy';
import { promises as fs } from 'fs';
import path from 'path';
import pc from 'picocolors';
import type { CaptionsFile, CaptionEntry } from '../types.js';
import type { OpenAIModel } from '../types/ai.js';
import { translationService } from '../services/translation.js';
import { captionEnhancementService } from '../services/caption-enhancement.js';
import { loadConfig } from '../core/files.js';
import { detectConfigVersion } from '../utils/config-version.js';
import { showV1DeprecationBanner } from '../utils/v2-banner.js';
import { computeCaptionPadding, computeFontSize, computeRegions } from '../core/layouts/math.js';
import { layoutCaptionText } from '../core/layouts/text-layout.js';
import { getDeviceStrategyV2 } from '../core/device-strategies/index.js';
import sharp from 'sharp';
import {
  loadCaptionHistory,
  saveCaptionHistory,
  updateFrequency,
  addToSuggestions,
  getSuggestions,
  learnFromExistingCaptions
} from '../utils/caption-history.js';
import { filenameToCaption } from '../utils/filename-caption.js';
import { Spinner } from '../utils/spinner.js';

export default function captionCmd() {
  const cmd = new Command('caption')
    .enablePositionalOptions()
    .description('Interactively add/edit captions for screenshots')
    .option('--device <name>', 'device name (iphone|ipad|mac|watch)')
    .option('--lang <code>', 'primary language code', 'en')
    .option('--translate', 'enable AI-powered translation')
    .option('--langs <codes>', 'target languages for translation (comma-separated)')
    .option('--model <name>', 'OpenAI model to use', 'gpt-4o-mini')
    .option('--auto-caption', 'generate captions from filenames (non-interactive)')
    .addHelpText('after', `
${pc.bold('Examples:')}
  ${pc.dim('# Add captions for iPhone screenshots')}
  $ appshot caption --device iphone
  
  ${pc.dim('# Add captions with real-time translation')}
  $ appshot caption --device iphone --translate --langs es,fr,de
  
  ${pc.dim('# Auto-generate captions from filenames and translate')}
  $ appshot caption --device iphone --auto-caption --translate --langs es,fr

  ${pc.dim('# Use specific AI model for translation')}
  $ appshot caption --device ipad --translate --model gpt-4o
  
  ${pc.dim('# Edit captions for a specific language')}
  $ appshot caption --device mac --lang fr

${pc.bold('Features:')}
  • Intelligent autocomplete with fuzzy search
  • Learning from existing captions
  • Real-time AI translation to 25+ languages
  • Pattern detection ("Track your *", "Manage your *")
  • Device-specific suggestions
  
${pc.bold('Supported Languages:')}
  en, es, fr, de, it, pt, pt-BR, nl, sv, no, da, fi, pl, ru,
  ja, ko, zh-CN, zh-TW, ar, he, tr, hi, th, vi, id, ms
  
${pc.bold('Requires:')}
  OPENAI_API_KEY environment variable for translation`)
    .action(async ({ device, lang, translate, langs, model, autoCaption }) => {
      try {
        if (!device) {
          console.error(pc.red('Error:'), 'Missing required option: --device <name>');
          process.exit(1);
        }
        try {
          const config = await loadConfig();
          if (detectConfigVersion(config) === 1) {
            showV1DeprecationBanner();
          }
        } catch {
          // Ignore config load failures for caption flow.
        }

        const dir = path.join(process.cwd(), 'screenshots', device);
        const captionsFile = path.join(process.cwd(), '.appshot', 'captions', `${device}.json`);

        // Check if directory exists
        try {
          await fs.access(dir);
        } catch {
          console.error(pc.red('Error:'), `Directory ${dir} does not exist`);
          console.log(pc.dim('Run'), pc.cyan('appshot init'), pc.dim('first to set up the project structure'));
          process.exit(1);
        }

        // Get all image files
        const files = (await fs.readdir(dir))
          .filter(f => f.match(/\.(png|jpg|jpeg)$/i))
          .sort();

        if (files.length === 0) {
          console.log(pc.yellow('No screenshots found in'), dir);
          console.log(pc.dim('Add .png, .jpg, or .jpeg files to this directory first'));
          process.exit(0);
        }

        // Load existing captions
        let captions: CaptionsFile = {};
        try {
          const content = await fs.readFile(captionsFile, 'utf8');
          captions = JSON.parse(content);
        } catch {
          // File doesn't exist or is invalid, start fresh
        }

        // Load caption history for autocomplete
        const history = await loadCaptionHistory();
        await learnFromExistingCaptions(history);

        // Check translation setup
        let targetLanguages: string[] = [];
        let selectedModel = model as OpenAIModel;

        if (translate) {
          if (!translationService.hasApiKey()) {
            if (autoCaption) {
              console.log(pc.yellow('⚠'), 'OPENAI_API_KEY not found. Skipping translation.');
              translate = false;
              targetLanguages = [];
            } else {
              console.error(pc.red('Error:'), 'OpenAI API key not found');
              console.log(pc.dim('Set the OPENAI_API_KEY environment variable to enable translations'));
              process.exit(1);
            }
          }

          // Parse target languages
          if (langs) {
            targetLanguages = langs.split(',').map((l: string) => l.trim());
          } else if (autoCaption) {
            console.error(pc.red('Error:'), 'Missing required option: --langs <codes> for auto-caption translation');
            process.exit(1);
          } else {
            // Ask for target languages if not provided
            console.log(pc.cyan('\nSelect target languages for translation:'));
            const supportedLangs = translationService.getSupportedLanguages().map(l => l.code).join(', ');
            console.log(pc.dim(`Supported: ${supportedLangs}`));
            const langsInput = await autocomplete({
              message: 'Target languages (comma-separated):',
              default: 'es,fr,de',
              source: async () => []
            });
            targetLanguages = (langsInput as string).split(',').map((l: string) => l.trim());
          }

          // Validate model selection
          const availableModels = translationService.getAvailableModels();
          if (!availableModels.includes(selectedModel)) {
            if (autoCaption) {
              console.error(pc.red('Error:'), `Model "${selectedModel}" is not available for translation.`);
              process.exit(1);
            }
            console.log(pc.yellow('\nSelect AI model for translation:'));
            selectedModel = await select({
              message: 'Choose model:',
              choices: availableModels.map(m => {
                const info = translationService.getModelInfo(m);
                return {
                  value: m,
                  description: info ? `Context: ${info.contextWindow}, Max output: ${info.maxTokens}` : ''
                };
              })
            }) as OpenAIModel;
          }

          await translationService.loadConfig();
          console.log(pc.green('✓'), `Translation enabled: ${lang} → ${targetLanguages.join(', ')}`);
          console.log(pc.dim(`Using model: ${selectedModel}\n`));
        }

        if (autoCaption) {
          console.log(pc.bold(`\nAuto-generating captions for ${device} (${lang}):`));

          const baseCaptions: Record<string, string> = {};
          for (const file of files) {
            const baseCaption = filenameToCaption(file);
            baseCaptions[file] = baseCaption;
            updateFrequency(history, baseCaption);
            addToSuggestions(history, baseCaption, device);
          }

          if (!translate || targetLanguages.length === 0) {
            for (const [file, baseCaption] of Object.entries(baseCaptions)) {
              captions[file] = baseCaption;
            }
          } else {
            const spinner = new Spinner({ enabled: process.stdout.isTTY });
            spinner.start(`Translating ${Object.keys(baseCaptions).length} captions (${lang} → ${targetLanguages.join(', ')})`);
            let translationsByFile: Record<string, Record<string, string>>;
            try {
              translationsByFile = await translationService.translateCaptionsBatch(
                baseCaptions,
                targetLanguages,
                selectedModel
              );
              spinner.succeed(`Translated ${Object.keys(baseCaptions).length} captions`);
            } catch (error) {
              spinner.fail('Translation failed');
              throw error;
            }

            for (const [file, baseCaption] of Object.entries(baseCaptions)) {
              captions[file] = {} as CaptionEntry;
              (captions[file] as CaptionEntry)[lang] = baseCaption;
              const translated = translationsByFile[file] || {};
              for (const [langCode, translation] of Object.entries(translated)) {
                (captions[file] as CaptionEntry)[langCode] = translation;
              }
            }
          }

          await fs.mkdir(path.dirname(captionsFile), { recursive: true });
          await fs.writeFile(captionsFile, JSON.stringify(captions, null, 2), 'utf8');
          await saveCaptionHistory(history);

          console.log('\n' + pc.green('✓'), `Updated ${path.relative(process.cwd(), captionsFile)}`);
          console.log(pc.dim('Run'), pc.cyan('appshot build'), pc.dim('to generate screenshots with these captions'));
          return;
        }

        console.log(pc.bold(`\nAdding captions for ${device} (${lang}):`));
        console.log(pc.dim('Type to search suggestions, use arrow keys to navigate'));
        console.log(pc.dim('Press Tab to autocomplete, Enter to confirm\n'));

        // Process each file
        for (const file of files) {
          const existing = captions[file];
          let currentCaption = '';

          if (typeof existing === 'string') {
            currentCaption = existing;
          } else if (existing && typeof existing === 'object') {
            currentCaption = existing[lang] || '';
          }

          // Get suggestions for this device
          const suggestions = getSuggestions(history, device);

          // Use autocomplete prompt
          const text = await autocomplete({
            message: `${file}:`,
            default: currentCaption,
            source: async (input) => {
              if (!input) {
                // Show all suggestions when no input
                return suggestions.map(s => ({
                  value: s,
                  description: history.frequency[s] ?
                    pc.dim(` (used ${history.frequency[s]} times)`) : ''
                }));
              }

              // Use fuzzy search to filter suggestions
              const results = fuzzy.filter(input, suggestions);

              // Also allow typing a new caption not in suggestions
              const matches = results.map(r => ({
                value: r.string,
                description: history.frequency[r.string] ?
                  pc.dim(` (used ${history.frequency[r.string]} times)`) : ''
              }));

              // Add the current input as an option if it's not in suggestions
              if (!suggestions.includes(input)) {
                matches.unshift({
                  value: input,
                  description: pc.cyan(' (new caption)')
                });
              }

              return matches;
            }
          });

          // Update history with the new caption
          if (text && text !== currentCaption) {
            updateFrequency(history, text);
            addToSuggestions(history, text, device);
          }

          // Store caption in structured format
          if (!captions[file] || typeof captions[file] === 'string') {
            captions[file] = {} as CaptionEntry;
          }
          (captions[file] as CaptionEntry)[lang] = text;

          // Translate if enabled
          if (translate && text && targetLanguages.length > 0) {
            process.stdout.write(pc.dim('  Translating...'));

            try {
              const translations = await translationService.translate({
                text,
                targetLanguages,
                model: selectedModel
              });

              // Clear the "Translating..." message
              process.stdout.write('\r\x1b[K');

              // Store translations
              for (const [langCode, translation] of Object.entries(translations)) {
                (captions[file] as CaptionEntry)[langCode] = translation;
                console.log(pc.dim(`  ${langCode}: ${translation}`));
              }
            } catch (error) {
              // Clear the "Translating..." message
              process.stdout.write('\r\x1b[K');
              console.error(pc.yellow('  Translation failed:'), error instanceof Error ? error.message : String(error));
              // Continue without translations
            }
          }
        }

        // Save updated captions
        await fs.writeFile(captionsFile, JSON.stringify(captions, null, 2), 'utf8');

        // Save updated history
        await saveCaptionHistory(history);

        console.log('\n' + pc.green('✓'), `Updated ${path.relative(process.cwd(), captionsFile)}`);
        console.log(pc.dim('Run'), pc.cyan('appshot build'), pc.dim('to generate screenshots with these captions'));
      } catch (error) {
        console.error(pc.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  cmd.command('enhance')
    .description('Enhance existing captions using OpenAI (no translation)')
    .option('--device <name>', 'device name (iphone|ipad|mac|watch)')
    .option('--lang <code>', 'primary language code', 'en')
    .option('--langs <codes>', 'languages to enhance (comma-separated)')
    .option('--model <name>', 'OpenAI model to use', 'gpt-5-mini')
    .option('--dry-run', 'preview changes without writing')
    .addHelpText('after', `
${pc.bold('Examples:')}
  ${pc.dim('# Enhance English captions for iPhone')}
  $ appshot caption enhance --device iphone

  ${pc.dim('# Enhance specific languages only')}
  $ appshot caption enhance --device ipad --langs en,fr

  ${pc.dim('# Use GPT-5 model explicitly')}
  $ appshot caption enhance --device mac --model gpt-5-mini

${pc.bold('Notes:')}
  • Enhances existing captions only; does not translate
  • Requires OPENAI_API_KEY
`)
    .action(async (options, command) => {
      try {
        const { device, lang, langs, model, dryRun } = options as {
          device?: string;
          lang: string;
          langs?: string;
          model: string;
          dryRun?: boolean;
        };
        const parent = command?.parent;
        const parentOpts = parent?.opts?.() ?? {};
        const parentDevice = parentOpts.device as string | undefined;
        const resolvedDevice = device ?? parentDevice;
        const resolvedLang =
          command?.getOptionValueSource?.('lang') === 'default' && parentOpts.lang
            ? (parentOpts.lang as string)
            : (lang ?? 'en');
        const resolvedModel =
          command?.getOptionValueSource?.('model') === 'default' && parentOpts.model
            ? (parentOpts.model as string)
            : (model ?? 'gpt-5-mini');
        const resolvedLangs = (langs ?? parentOpts.langs) as string | undefined;
        const resolvedDryRun = (dryRun ?? parentOpts.dryRun ?? false) as boolean;

        if (!resolvedDevice) {
          console.error(pc.red('Error:'), 'Missing required option: --device <name>');
          process.exit(1);
        }
        const config = await loadConfig();
        if (detectConfigVersion(config) === 1) {
          showV1DeprecationBanner();
          console.error(pc.red('Error:'), 'Caption enhancement requires v2 config. Run appshot migrate first.');
          process.exit(1);
        }

        if (!captionEnhancementService.hasApiKey()) {
          console.error(pc.red('Error:'), 'OpenAI API key not found');
          console.log(pc.dim('Set the OPENAI_API_KEY environment variable to enable caption enhancement'));
          process.exit(1);
        }

        const selectedModel = resolvedModel as OpenAIModel;
        if (!selectedModel.startsWith('gpt-5')) {
          console.error(pc.red('Error:'), 'Caption enhancement requires a GPT-5 model (e.g., gpt-5-mini).');
          process.exit(1);
        }

        const targetLanguages = resolvedLangs
          ? resolvedLangs.split(',').map((l: string) => l.trim()).filter(Boolean)
          : [resolvedLang];

        const deviceKey = resolvedDevice.toLowerCase();
        if (!['iphone', 'ipad', 'mac', 'watch'].includes(deviceKey)) {
          console.error(pc.red('Error:'), 'Device must be one of: iphone, ipad, mac, watch');
          process.exit(1);
        }

        const deviceEntry = (config as any).devices?.[deviceKey];
        if (!deviceEntry) {
          console.error(pc.red('Error:'), `Device "${deviceKey}" not found in config`);
          process.exit(1);
        }

        const inputDir = typeof deviceEntry === 'string' ? deviceEntry : deviceEntry.input;
        const resolution = typeof deviceEntry === 'object' ? deviceEntry.resolution : undefined;
        const { width: outputWidth, height: outputHeight } = await resolveOutputSize(
          inputDir,
          resolution,
          deviceKey as 'iphone' | 'ipad' | 'mac' | 'watch'
        );

        const layout = (config as any).layout || 'header';
        const constraintLayout = layout === 'screenshot-only' ? 'header' : layout;
        const strategy = getDeviceStrategyV2(deviceKey as 'iphone' | 'ipad' | 'mac' | 'watch');
        const regions = computeRegions({
          canvasWidth: outputWidth,
          canvasHeight: outputHeight,
          layout: constraintLayout,
          strategy
        });
        const captionRegion = regions.caption ?? {
          x: 0,
          y: 0,
          width: outputWidth,
          height: Math.max(strategy.minCaptionPx, Math.round(outputHeight * strategy.captionRatio))
        };
        const fontSize = computeFontSize(outputHeight, strategy);
        const maxLines = strategy.captionMaxLines;
        const maxChars = estimateMaxChars(captionRegion.width, captionRegion.height, fontSize, maxLines);

        const captionsFile = path.join(process.cwd(), '.appshot', 'captions', `${deviceKey}.json`);
        let captions: CaptionsFile = {};
        try {
          const content = await fs.readFile(captionsFile, 'utf8');
          captions = JSON.parse(content);
        } catch {
          console.error(pc.red('Error:'), `Captions file not found for ${deviceKey}`);
          process.exit(1);
        }

        let updated = 0;
        let skipped = 0;

        const fileMapByLang = new Map<string, Record<string, string>>();
        const singleLangMap: Record<string, string> = {};

        for (const [file, entry] of Object.entries(captions)) {
          if (typeof entry === 'string') {
            if (targetLanguages.includes(resolvedLang)) {
              singleLangMap[file] = entry;
            }
            continue;
          }
          if (entry && typeof entry === 'object') {
            const entryObj = entry as CaptionEntry;
            for (const targetLang of targetLanguages) {
              const original = entryObj[targetLang];
              if (!original) {
                continue;
              }
              const bucket = fileMapByLang.get(targetLang) ?? {};
              bucket[file] = original;
              fileMapByLang.set(targetLang, bucket);
            }
          }
        }

        if (Object.keys(singleLangMap).length > 0) {
          const existing = fileMapByLang.get(resolvedLang) ?? {};
          fileMapByLang.set(resolvedLang, { ...existing, ...singleLangMap });
        }

        for (const [targetLang, fileMap] of fileMapByLang.entries()) {
          if (Object.keys(fileMap).length === 0) {
            continue;
          }

          const spinner = new Spinner({ enabled: process.stdout.isTTY });
          spinner.start(`Enhancing ${Object.keys(fileMap).length} captions (${targetLang})`);
          let enhancedMap: Record<string, string>;
          try {
            enhancedMap = await captionEnhancementService.enhanceBatch({
              captions: fileMap,
              language: targetLang,
              model: selectedModel,
              maxLines,
              maxChars,
              deviceType: deviceKey,
              layout: constraintLayout,
              attempt: 1
            });
            spinner.succeed(`Enhanced ${Object.keys(fileMap).length} captions (${targetLang})`);
          } catch (error) {
            spinner.fail(`Enhancement failed (${targetLang})`);
            throw error;
          }

          const truncated: Record<string, string> = {};
          for (const [file, enhanced] of Object.entries(enhancedMap)) {
            const fitCheck = layoutCaptionText(enhanced, captionRegion, fontSize, strategy);
            if (fitCheck.truncated) {
              truncated[file] = enhanced;
            }
          }

          let finalMap = enhancedMap;
          if (Object.keys(truncated).length > 0) {
            const retrySpinner = new Spinner({ enabled: process.stdout.isTTY });
            retrySpinner.start(`Shortening ${Object.keys(truncated).length} captions (${targetLang})`);
            let shorterMap: Record<string, string>;
            try {
              shorterMap = await captionEnhancementService.enhanceBatch({
                captions: truncated,
                language: targetLang,
                model: selectedModel,
                maxLines,
                maxChars: Math.max(10, Math.floor(maxChars * 0.85)),
                deviceType: deviceKey,
                layout: constraintLayout,
                attempt: 2
              });
              retrySpinner.succeed(`Shortened ${Object.keys(truncated).length} captions (${targetLang})`);
            } catch (error) {
              retrySpinner.fail(`Shortening failed (${targetLang})`);
              throw error;
            }
            finalMap = { ...enhancedMap, ...shorterMap };
          }

          for (const [file, enhanced] of Object.entries(finalMap)) {
            const original = fileMap[file];
            if (!enhanced || enhanced === original) {
              skipped++;
              continue;
            }

            if (!resolvedDryRun) {
              const entry = captions[file];
              if (typeof entry === 'string') {
                captions[file] = enhanced;
              } else if (entry && typeof entry === 'object') {
                (entry as CaptionEntry)[targetLang] = enhanced;
              }
            }
            updated++;
            console.log(pc.green('✓'), `${file} (${targetLang})`, pc.dim('→'), enhanced);
          }
        }

        if (!resolvedDryRun && updated > 0) {
          await fs.writeFile(captionsFile, JSON.stringify(captions, null, 2), 'utf8');
        }

        console.log('\n' + pc.green('✓'), `Enhanced ${updated} caption(s)`);
        if (skipped > 0) {
          console.log(pc.dim(`Skipped ${skipped} caption(s) (missing language or unchanged).`));
        }
        if (resolvedDryRun) {
          console.log(pc.dim('Dry run: no files were modified.'));
        }
      } catch (error) {
        console.error(pc.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return cmd;
}

async function resolveOutputSize(
  inputDir: string,
  resolution: string | undefined,
  deviceType: 'iphone' | 'ipad' | 'mac' | 'watch'
): Promise<{ width: number; height: number }> {
  if (resolution) {
    const [configWidth, configHeight] = resolution.split('x').map(Number);
    return {
      width: Math.min(configWidth, configHeight),
      height: Math.max(configWidth, configHeight)
    };
  }

  try {
    const files = (await fs.readdir(inputDir)).filter(f => f.match(/\.(png|jpg|jpeg)$/i));
    if (files.length > 0) {
      const sample = path.join(inputDir, files[0]);
      const metadata = await sharp(sample).metadata();
      if (metadata.width && metadata.height) {
        return {
          width: metadata.width,
          height: metadata.height
        };
      }
    }
  } catch {
    // Fall back to defaults below
  }

  const defaults: Record<string, { width: number; height: number }> = {
    iphone: { width: 1290, height: 2796 },
    ipad: { width: 2048, height: 2732 },
    mac: { width: 2880, height: 1800 },
    watch: { width: 410, height: 502 }
  };

  return defaults[deviceType];
}

function estimateMaxChars(regionWidth: number, regionHeight: number, fontSize: number, maxLines: number): number {
  const padding = computeCaptionPadding(regionHeight);
  const maxWidth = Math.max(0, regionWidth - padding * 2);
  const avgCharWidth = Math.max(1, fontSize * 0.55);
  const charsPerLine = Math.max(5, Math.floor(maxWidth / avgCharWidth));
  return Math.max(charsPerLine, charsPerLine * maxLines);
}
