import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import pc from 'picocolors';
import inquirer from 'inquirer';
import {
  getTemplate,
  getTemplateCaptionSuggestions,
  resolveTemplateId,
  applyTemplateToConfig
} from '../templates/registry.js';
import {
  validateTemplateId,
  sanitizeCaption,
  validateDeviceArray
} from '../utils/validation.js';
import type { AppshotConfigV2 } from '../types.js';

export default function quickstartCmd() {
  const cmd = new Command('quickstart')
    .description('Get started with App Store screenshots in seconds')
    .option('--template <id>', 'template to use (default: ocean-header)')
    .option('--caption <text>', 'main caption for screenshots')
    .option('--no-interactive', 'skip interactive prompts')
    .option('--force', 'overwrite existing configuration')
    .addHelpText('after', `
${pc.bold('What This Does:')}
  1. Initializes project structure
  2. Applies a professional template
  3. Sets up example captions
  4. Shows you exactly what to do next

${pc.bold('Examples:')}
  ${pc.dim('# Interactive quickstart')}
  $ appshot quickstart
  
  ${pc.dim('# With specific template')}
  $ appshot quickstart --template pastel-header
  
  ${pc.dim('# Non-interactive with caption')}
  $ appshot quickstart --template noir-footer --caption "Amazing App" --no-interactive

${pc.bold('Templates (v2):')}
  ${pc.cyan('ocean-header')}     - Cool blue gradient, header layout (default)
  ${pc.cyan('sunset-footer')}    - Warm sunset gradient, footer layout
  ${pc.cyan('clean-screenshot')} - Minimal, screenshot-only layout
  ${pc.cyan('pastel-header')}    - Soft pastel gradient, header layout
  ${pc.cyan('noir-footer')}      - Dark dramatic gradient, footer layout
  ${pc.cyan('silver-header')}    - Elegant silver gradient, header layout
  ${pc.cyan('tropical-header')}  - Bright tropical gradient, header layout
  ${pc.cyan('slate-footer')}     - Professional slate gradient, footer layout
  ${pc.cyan('midnight-header')}  - Deep blue gradient, header layout`)
    .action(async (opts) => {
      try {
        console.log(pc.cyan(`
     _                       _           _   
    / \\   _ __  _ __  ___| |__   ___ | |_ 
   / _ \\ | '_ \\| '_ \\/ __| '_ \\ / _ \\| __|
  / ___ \\| |_) | |_) \\__ \\ | | | (_) | |_ 
 /_/   \\_\\ .__/| .__/|___/_| |_|\\___/ \\__|
         |_|   |_|  Quick Start                        
        `));

        console.log(pc.bold('\n🚀 Welcome to Appshot Quick Start!\n'));
        console.log('Let\'s set up professional App Store screenshots in seconds.\n');

        // Check if already initialized
        const configPath = path.join(process.cwd(), '.appshot', 'config.json');
        const configExists = await fileExists(configPath);

        if (configExists && !opts.force) {
          const overwrite = opts.interactive === false ? false : await confirmOverwrite();
          if (!overwrite) {
            console.log(pc.yellow('Setup cancelled. Use --force to overwrite existing configuration.'));
            process.exit(0);
          }
        }

        // Interactive or direct mode
        let templateId = opts.template || 'ocean-header';
        let caption = opts.caption;
        let devices = ['iphone', 'ipad'];

        // Validate template if provided
        if (opts.template && !validateTemplateId(opts.template)) {
          console.error(pc.red(`Template "${opts.template}" not found`));
          console.log(pc.dim('Run "appshot template --list" to see available templates'));
          process.exit(1);
        }

        // Sanitize caption if provided
        if (caption) {
          try {
            caption = sanitizeCaption(caption);
          } catch (err) {
            console.error(pc.red(`Invalid caption: ${err instanceof Error ? err.message : 'Unknown error'}`));
            process.exit(1);
          }
        }

        if (opts.interactive !== false && (!opts.template || !opts.caption)) {
          // Interactive prompts
          const answers = await inquirer.prompt([
            {
              type: 'list',
              name: 'template',
              message: 'Choose a visual style:',
              choices: [
                { name: '🌊 Ocean Header - Cool blue gradient', value: 'ocean-header' },
                { name: '🌅 Sunset Footer - Warm gradient', value: 'sunset-footer' },
                { name: '🧼 Clean Screenshot - Minimal', value: 'clean-screenshot' },
                { name: '🍑 Pastel Header - Soft gradient', value: 'pastel-header' },
                { name: '🕶️ Noir Footer - Dark dramatic', value: 'noir-footer' },
                { name: '🤍 Silver Header - Elegant', value: 'silver-header' },
                { name: '🍍 Tropical Header - Bright playful', value: 'tropical-header' },
                { name: '🧱 Slate Footer - Professional', value: 'slate-footer' },
                { name: '🌌 Midnight Header - Deep blue', value: 'midnight-header' }
              ],
              default: templateId
            },
            {
              type: 'input',
              name: 'caption',
              message: 'Enter your main caption:',
              default: caption || 'Your App Name',
              validate: (input) => input.length > 0 || 'Caption is required'
            },
            {
              type: 'checkbox',
              name: 'devices',
              message: 'Which devices do you need?',
              choices: [
                { name: 'iPhone', value: 'iphone', checked: true },
                { name: 'iPad', value: 'ipad', checked: true },
                { name: 'Mac', value: 'mac' },
                { name: 'Apple Watch', value: 'watch' }
              ],
              validate: (choices) => choices.length > 0 || 'Select at least one device'
            }
          ]);

          templateId = answers.template;
          caption = sanitizeCaption(answers.caption);
          devices = answers.devices;
        }

        // Validate devices array
        try {
          devices = validateDeviceArray(devices);
        } catch (err) {
          console.error(pc.red(`Invalid devices: ${err instanceof Error ? err.message : 'Unknown error'}`));
          process.exit(1);
        }

        const resolved = resolveTemplateId(templateId);
        if (resolved.isAlias) {
          console.log(pc.yellow(`⚠ Legacy template \"${templateId}\" mapped to \"${resolved.id}\"`));
          templateId = resolved.id;
        }

        // Step 1: Initialize project structure
        console.log('\n' + pc.bold('Step 1:'), 'Creating project structure...');
        await initializeProject(devices);

        // Step 2: Apply template
        console.log(pc.bold('Step 2:'), `Applying "${templateId}" template...`);
        const config = await applyTemplate(templateId, devices);

        // Step 3: Set up captions
        console.log(pc.bold('Step 3:'), 'Setting up captions...');
        await setupCaptions(devices, caption || 'Your App Name', templateId);

        // Step 4: Save configuration
        console.log(pc.bold('Step 4:'), 'Saving configuration...');
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        // Success!
        console.log('\n' + pc.green('✨ Quick Start Complete!'));

        const template = getTemplate(templateId);
        if (template) {
          console.log(pc.dim(`Template: ${template.name} - ${template.description}`));
        }

        // Instructions
        console.log('\n' + pc.bold('📋 Next Steps:'));
        console.log();
        console.log('1. Add your screenshots:');
        for (const device of devices) {
          console.log(`   ${pc.cyan(`cp your-screenshots/*.png screenshots/${device}/`)}`);
        }
        console.log();
        console.log('2. Build your App Store screenshots:');
        console.log(`   ${pc.cyan('appshot build')}`);
        console.log();
        console.log('3. Find your screenshots in:', pc.green('final/'));
        console.log();

        // Tips
        console.log(pc.bold('💡 Pro Tips:'));
        console.log('• Customize captions:', pc.cyan('appshot caption --device iphone'));
        console.log('• Try other templates:', pc.cyan('appshot template --list'));
        console.log('• Add translations:', pc.cyan('appshot caption --translate --langs es,fr'));
        console.log('• Validate for App Store:', pc.cyan('appshot validate'));

        // Check if in Big Brother project
        const isBigBrother = process.cwd().includes('bigbrother');
        if (isBigBrother) {
          console.log('\n' + pc.yellow('📱 Big Brother Project Detected!'));
          console.log('You already have screenshots ready. Just run:', pc.cyan('appshot build'));
        }

      } catch (error) {
        console.error(pc.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * Initialize project structure
 */
async function initializeProject(devices: string[]) {
  const dirs = [
    '.appshot',
    '.appshot/captions',
    ...devices.map(d => `screenshots/${d}`),
    'final'
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Create caption files
  for (const device of devices) {
    const captionFile = path.join('.appshot', 'captions', `${device}.json`);
    if (!await fileExists(captionFile)) {
      await fs.writeFile(captionFile, '{}');
    }
  }
}

/**
 * Apply template and create configuration
 */
async function applyTemplate(templateId: string, devices: string[]): Promise<AppshotConfigV2> {
  const resolved = resolveTemplateId(templateId);
  const template = getTemplate(resolved.id);
  if (!template) {
    throw new Error(`Template "${templateId}" not found`);
  }

  const baseConfig: AppshotConfigV2 = {
    version: 2,
    output: './final',
    frames: './frames',
    layout: template.layout,
    caption: {
      font: template.caption.font || 'SF Pro Display',
      color: template.caption.color || '#FFFFFF',
      background: template.caption.background
    },
    background: template.background,
    devices: {}
  };

  const resolutions: Record<string, string> = {
    iphone: '1290x2796',
    ipad: '2048x2732',
    mac: '2880x1800',
    watch: '410x502'
  };

  for (const device of devices) {
    baseConfig.devices[device] = {
      input: `./screenshots/${device}`,
      resolution: resolutions[device] || '1290x2796'
    };
  }

  return applyTemplateToConfig(resolved.id, baseConfig);
}

/**
 * Set up example captions
 */
async function setupCaptions(devices: string[], mainCaption: string, templateId: string) {
  const suggestions = getTemplateCaptionSuggestions(templateId);

  // Sanitize the main caption
  const sanitizedMainCaption = sanitizeCaption(mainCaption);

  // Create example captions for common screenshot names
  const exampleCaptions: Record<string, string> = {
    'home.png': sanitizedMainCaption,
    'dashboard.png': sanitizedMainCaption,
    'main.png': sanitizedMainCaption,
    'features.png': suggestions.features[0],
    'settings.png': 'Customize Everything',
    'profile.png': 'Your Personal Space',
    'search.png': 'Find What You Need',
    'notifications.png': 'Stay Updated'
  };

  for (const device of devices) {
    const captionFile = path.join('.appshot', 'captions', `${device}.json`);

    // Load existing captions if any
    let captions: Record<string, string> = {};
    try {
      const existing = await fs.readFile(captionFile, 'utf-8');
      captions = JSON.parse(existing);
    } catch {
      // File doesn't exist or is empty
    }

    // Merge with example captions (don't overwrite existing)
    for (const [file, caption] of Object.entries(exampleCaptions)) {
      if (!captions[file]) {
        captions[file] = caption;
      }
    }

    // Save captions
    await fs.writeFile(captionFile, JSON.stringify(captions, null, 2));
  }
}

/**
 * Confirm overwrite of existing configuration
 */
async function confirmOverwrite(): Promise<boolean> {
  const answer = await inquirer.prompt([{
    type: 'confirm',
    name: 'overwrite',
    message: 'Configuration already exists. Overwrite?',
    default: false
  }]);

  return answer.overwrite;
}

/**
 * Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
