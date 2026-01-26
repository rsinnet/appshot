import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import pc from 'picocolors';
import inquirer from 'inquirer';
import { loadConfig } from '../core/files.js';
import {
  templates,
  getTemplate,
  applyTemplateToConfig,
  getTemplateCaptionSuggestions,
  getTemplateCategories,
  resolveTemplateId
} from '../templates/registry.js';
import {
  validateTemplateId,
  sanitizeCaption,
  validateJson
} from '../utils/validation.js';
import type { AppshotConfigV2, CaptionsFile } from '../types.js';
import { detectConfigVersion } from '../utils/config-version.js';
import { showV1DeprecationBanner } from '../utils/v2-banner.js';

export default function templateCmd() {
  const cmd = new Command('template')
    .description('Apply professional screenshot templates for quick App Store setup')
    .argument('[template]', 'template ID to apply (e.g., modern, minimal, bold)')
    .option('--list', 'list all available templates')
    .option('--preview <id>', 'preview template configuration')
    .option('--caption <text>', 'add a single caption to all screenshots')
    .option('--captions <json>', 'add multiple captions as JSON')
    .option('--device <name>', 'apply template to specific device only')
    .option('--no-backup', 'skip creating backup of current config')
    .option('--dry-run', 'preview changes without applying')
    .addHelpText('after', `
${pc.bold('Available Templates (v2):')}
  ${pc.cyan('ocean-header')}     - Cool blue gradient, header layout
  ${pc.cyan('sunset-footer')}    - Warm sunset gradient, footer layout
  ${pc.cyan('clean-screenshot')} - Minimal, screenshot-only layout
  ${pc.cyan('pastel-header')}    - Soft pastel gradient, header layout
  ${pc.cyan('noir-footer')}      - Dark dramatic gradient, footer layout
  ${pc.cyan('silver-header')}    - Elegant silver gradient, header layout
  ${pc.cyan('tropical-header')}  - Bright tropical gradient, header layout
  ${pc.cyan('slate-footer')}     - Professional slate gradient, footer layout
  ${pc.cyan('midnight-header')}  - Deep blue gradient, header layout

${pc.bold('Examples:')}
  ${pc.dim('# Apply a template')}
  $ appshot template ocean-header
  
  ${pc.dim('# Apply with caption')}
  $ appshot template pastel-header --caption "Beautiful & Simple"
  
  ${pc.dim('# List all templates')}
  $ appshot template --list
  
  ${pc.dim('# Preview template settings')}
  $ appshot template --preview noir-footer
  
  ${pc.dim('# Apply to specific device')}
  $ appshot template silver-header --device iphone

${pc.bold('Quick Start:')}
  $ appshot template ocean-header --caption "Your App Name"
  $ appshot build
  
${pc.bold('Output:')}
  Updates ${pc.cyan('.appshot/config.json')} with template settings`)
    .action(async (templateId, opts) => {
      try {
        // List templates
        if (opts.list) {
          listTemplates();
          return;
        }

        // Preview template
        if (opts.preview) {
          const previewResolved = resolveTemplateId(opts.preview);
          if (!validateTemplateId(previewResolved.id)) {
            console.error(pc.red(`Template "${opts.preview}" not found`));
            console.log(pc.dim('Run "appshot template --list" to see available templates'));
            process.exit(1);
          }
          if (previewResolved.isAlias) {
            console.log(pc.yellow(`⚠ Legacy template "${opts.preview}" mapped to "${previewResolved.id}"`));
          }
          previewTemplate(previewResolved.id);
          return;
        }

        // Interactive selection if no template specified
        if (!templateId) {
          templateId = await selectTemplate();
        }

        const resolved = resolveTemplateId(templateId);

        // Validate template
        if (!validateTemplateId(resolved.id)) {
          console.error(pc.red(`Template "${templateId}" not found`));
          console.log(pc.dim('Run "appshot template --list" to see available templates'));
          process.exit(1);
        }

        const template = getTemplate(resolved.id);
        if (!template) {
          // This shouldn't happen after validation, but keep as safety
          console.error(pc.red(`Template "${templateId}" not found`));
          process.exit(1);
        }

        // Load current configuration
        const configPath = path.join(process.cwd(), '.appshot', 'config.json');
        let config: Partial<AppshotConfigV2>;

        try {
          const loaded = await loadConfig();
          const version = detectConfigVersion(loaded);
          if (version === 1) {
            showV1DeprecationBanner();
            console.error(pc.red('Template presets are v2 only. Run "appshot migrate" first.'));
            process.exit(1);
          }
          config = loaded as AppshotConfigV2;
        } catch {
          console.log(pc.yellow('No existing config found, creating new one'));
          config = createDefaultConfig();
        }

        // Backup current config
        if (!opts.noBackup && await fileExists(configPath)) {
          const backupPath = configPath.replace('.json', '.backup.json');
          await fs.copyFile(configPath, backupPath);
          console.log(pc.dim(`Backup saved to ${path.basename(backupPath)}`));
        }

        // Apply template
        if (resolved.isAlias) {
          console.log(pc.yellow(`⚠ Legacy template "${templateId}" mapped to "${resolved.id}"`));
        }

        const newConfig = applyTemplateToConfig(resolved.id, config);

        // Apply to specific device only if requested
        if (opts.device && newConfig.devices) {
          const deviceConfig = newConfig.devices[opts.device];
          if (!deviceConfig) {
            console.error(pc.red(`Device "${opts.device}" not found in configuration`));
            process.exit(1);
          }

          // Keep original config but update only specified device
          config.devices = config.devices || {};
          config.devices[opts.device] = deviceConfig;
        } else {
          config = newConfig;
        }

        // Add captions if provided
        if (opts.caption || opts.captions) {
          await addCaptions(config, opts.caption, opts.captions);
        }

        // Dry run mode
        if (opts.dryRun) {
          console.log(pc.bold('\n🔍 Dry Run - Configuration Preview:\n'));
          console.log(JSON.stringify(config, null, 2));
          console.log(pc.dim('\nNo changes made. Remove --dry-run to apply template.'));
          return;
        }

        // Save configuration
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        // Success message
        console.log('\n' + pc.green('✨'), pc.bold(`Template "${template.name}" applied successfully!`));
        console.log(pc.dim(template.description));

        // Show what was configured
        console.log('\n' + pc.cyan('Template Configuration:'));
        console.log(`  Background: ${template.background.mode === 'gradient' ? 'Gradient' : 'Image/Auto'}`);
        console.log(`  Layout: ${template.layout}`);
        console.log(`  Font: ${template.caption.font || 'SF Pro Display'}`);

        // Suggest next steps
        console.log('\n' + pc.bold('Next Steps:'));
        console.log('  1. Add your screenshots to', pc.cyan('screenshots/'));

        if (!opts.caption && !opts.captions) {
          console.log('  2. Add captions:', pc.cyan('appshot caption --device iphone'));
          console.log('  3. Build screenshots:', pc.cyan('appshot build'));
        } else {
          console.log('  2. Build screenshots:', pc.cyan('appshot build'));
        }

        // Show caption suggestions
        if (!opts.caption && !opts.captions) {
          const suggestions = getTemplateCaptionSuggestions(resolved.id);
          console.log('\n' + pc.dim('Caption suggestions for this template:'));
          console.log(pc.dim(`  Hero: "${suggestions.hero[0]}"`));
          console.log(pc.dim(`  Feature: "${suggestions.features[0]}"`));
        }

      } catch (error) {
        console.error(pc.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * List all available templates
 */
function listTemplates() {
  console.log(pc.bold('\n📱 Screenshot Templates\n'));

  const categories = getTemplateCategories();

  for (const category of categories) {
    console.log(pc.cyan(category.toUpperCase()));
    console.log(pc.dim('─'.repeat(50)));

    const categoryTemplates = templates.filter(t => t.category === category);

    for (const template of categoryTemplates) {
      console.log(`\n  ${pc.bold(template.id)}`);
      console.log(`  ${template.name}`);
      console.log(`  ${pc.dim(template.description)}`);

      // Show key features
      const features = [];
      if (template.background.mode === 'gradient') {
        features.push('Gradient');
      } else if (template.background.mode === 'auto') {
        features.push('Auto Background');
      }

      features.push(`Layout: ${template.layout}`);

      if (features.length > 0) {
        console.log(`  ${pc.green('Features:')} ${features.join(', ')}`);
      }
    }
    console.log();
  }

  console.log(pc.dim('─'.repeat(50)));
  console.log(pc.dim('\nUse "appshot template <id>" to apply a template'));
  console.log(pc.dim('Use "appshot template --preview <id>" for detailed view'));
}

/**
 * Preview template configuration
 */
function previewTemplate(templateId: string) {
  const template = getTemplate(templateId);

  if (!template) {
    console.error(pc.red(`Template "${templateId}" not found`));
    process.exit(1);
  }

  console.log(pc.bold(`\n📋 Template: ${template.name}\n`));
  console.log(pc.dim(template.description));
  console.log();

  // Background
  console.log(pc.cyan('Background:'));
  if (template.background.mode === 'gradient' && template.background.gradient) {
    console.log(`  Type: Gradient (${template.background.gradient.direction})`);
    console.log(`  Colors: ${template.background.gradient.colors.join(' → ')}`);
  } else if (template.background.mode === 'auto') {
    console.log('  Type: Auto-detect (looks for background.png)');
    if (template.background.gradient) {
      console.log('  Fallback: Gradient');
    }
  }

  // Layout
  console.log('\n' + pc.cyan('Layout:'));
  console.log(`  Mode: ${template.layout}`);

  // Caption Style
  console.log('\n' + pc.cyan('Caption Style:'));
  console.log(`  Font: ${template.caption.font || 'SF Pro Display'}`);
  console.log(`  Color: ${template.caption.color || '#FFFFFF'}`);

  if (template.caption.background) {
    console.log(`  Background: ${template.caption.background.color} (${Math.round((template.caption.background.opacity || 1) * 100)}% opacity)`);
  }

  // Caption Suggestions
  const suggestions = getTemplateCaptionSuggestions(templateId);
  console.log('\n' + pc.cyan('Caption Suggestions:'));
  console.log(`  Hero: "${suggestions.hero[0]}"`);
  console.log(`  Feature: "${suggestions.features[0]}"`);
  console.log(`  CTA: "${suggestions.cta[0]}"`);

  console.log('\n' + pc.dim('─'.repeat(50)));
  console.log(pc.green('Apply this template:'), pc.cyan(`appshot template ${templateId}`));
}

/**
 * Interactive template selection
 */
async function selectTemplate(): Promise<string> {
  console.log(pc.bold('\n🎨 Select a Screenshot Template\n'));

  // Not used - choices are built in categorizedChoices below

  // Add separators by category
  const categorizedChoices: any[] = [];
  const categories = getTemplateCategories();

  for (const category of categories) {
    categorizedChoices.push(new inquirer.Separator(`── ${category.toUpperCase()} ──`));
    const categoryTemplates = templates.filter(t => t.category === category);
    for (const template of categoryTemplates) {
      categorizedChoices.push({
        name: `${pc.bold(template.name)} - ${template.description}`,
        value: template.id,
        short: template.name
      });
    }
  }

  const answer = await inquirer.prompt([{
    type: 'list',
    name: 'template',
    message: 'Choose a template:',
    choices: categorizedChoices,
    pageSize: 12
  }]);

  return answer.template;
}

/**
 * Create default configuration
 */
function createDefaultConfig(): Partial<AppshotConfigV2> {
  return {
    version: 2,
    output: './final',
    frames: './frames',
    layout: 'header',
    caption: {
      font: 'SF Pro Display',
      color: '#FFFFFF'
    },
    background: {
      mode: 'gradient',
      gradient: {
        colors: ['#667eea', '#764ba2'],
        direction: 'top-bottom'
      }
    },
    devices: {
      iphone: {
        input: './screenshots/iphone',
        resolution: '1290x2796'
      },
      ipad: {
        input: './screenshots/ipad',
        resolution: '2048x2732'
      },
      mac: {
        input: './screenshots/mac',
        resolution: '2880x1800'
      },
      watch: {
        input: './screenshots/watch',
        resolution: '410x502'
      }
    }
  };
}

/**
 * Add captions to configuration
 */
async function addCaptions(
  config: Partial<AppshotConfigV2>,
  singleCaption?: string,
  captionsJson?: string
) {
  const captionsDir = path.join(process.cwd(), '.appshot', 'captions');
  await fs.mkdir(captionsDir, { recursive: true });

  if (singleCaption) {
    // Sanitize the caption
    const sanitizedCaption = sanitizeCaption(singleCaption);

    // Apply single caption to all devices
    if (config.devices) {
      for (const device of Object.keys(config.devices)) {
        const captionFile = path.join(captionsDir, `${device}.json`);

        // Load existing captions or create new
        let captions: CaptionsFile = {};
        try {
          const existing = await fs.readFile(captionFile, 'utf-8');
          captions = JSON.parse(existing);
        } catch {
          // File doesn't exist yet
        }

        // Add caption to all screenshots (we'll use a generic key)
        captions['default'] = sanitizedCaption;

        await fs.writeFile(captionFile, JSON.stringify(captions, null, 2));
      }
    }

    console.log(pc.dim(`Caption "${sanitizedCaption}" added to all devices`));
  } else if (captionsJson) {
    // Parse and apply JSON captions
    try {
      const captions = validateJson(captionsJson);

      if (config.devices) {
        for (const device of Object.keys(config.devices)) {
          const captionFile = path.join(captionsDir, `${device}.json`);
          await fs.writeFile(captionFile, JSON.stringify(captions, null, 2));
        }
      }

      console.log(pc.dim('Captions added from JSON'));
    } catch {
      console.error(pc.red('Invalid JSON for captions'));
      process.exit(1);
    }
  }
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
